#!/usr/bin/env node
import { createProjectGraphAsync, workspaceRoot } from '@nx/devkit';
import { execSync } from 'node:child_process';
import { rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { URL } from 'node:url';
import { isRelativeVersionKeyword } from 'nx/src/command-line/release/utils/semver';
import { ReleaseType, parse } from 'semver';
import * as yargs from 'yargs';

const LARGE_BUFFER = 1024 * 1000000;

(async () => {
  const options = parseArgs();
  // Perform minimal logging by default
  let isVerboseLogging = process.env.NX_VERBOSE_LOGGING === 'true';

  if (options.clearLocalRegistry) {
    rmSync(join(__dirname, '../build/local-registry/storage'), {
      recursive: true,
      force: true,
    });
  }

  const buildCommand = 'pnpm build';
  console.log(`> ${buildCommand}`);
  execSync(buildCommand, {
    stdio: [0, 1, 2],
    maxBuffer: LARGE_BUFFER,
  });

  // Ensure all the native-packages directories are available at the top level of the build directory, enabling consistent packageRoot structure
  execSync(`pnpm nx copy-native-package-directories nx`, {
    stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
    maxBuffer: LARGE_BUFFER,
  });

  // Expected to run as part of the Github `publish` workflow
  if (!options.local && process.env.NPM_TOKEN) {
    // Delete all .node files that were built during the previous steps
    // Always run before the artifacts step because we still need the .node files for native-packages
    execSync('find ./build -name "*.node" -delete', {
      stdio: [0, 1, 2],
      maxBuffer: LARGE_BUFFER,
    });

    execSync('pnpm nx run-many --target=artifacts', {
      stdio: [0, 1, 2],
      maxBuffer: LARGE_BUFFER,
    });
  }

  const runNxReleaseVersion = () => {
    let versionCommand = `pnpm nx release version${
      options.version ? ` --specifier ${options.version}` : ''
    }`;
    if (options.dryRun) {
      versionCommand += ' --dry-run';
    }
    console.log(`> ${versionCommand}`);
    execSync(versionCommand, {
      stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
      maxBuffer: LARGE_BUFFER,
    });
  };

  // Intended for creating a github release which triggers the publishing workflow
  if (!options.local && !process.env.NPM_TOKEN) {
    // For this important use-case it makes sense to always have full logs
    isVerboseLogging = true;

    execSync('git status --ahead-behind');

    if (isRelativeVersionKeyword(options.version)) {
      throw new Error(
        'When creating actual releases, you must use an exact semver version'
      );
    }

    runNxReleaseVersion();

    execSync(`pnpm nx run-many -t add-extra-dependencies --parallel 8`, {
      stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
      maxBuffer: LARGE_BUFFER,
    });

    let changelogCommand = `pnpm nx release changelog ${options.version} --tagVersionPrefix="" --file false --create-release github --interactive`;
    if (options.from) {
      changelogCommand += ` --from ${options.from}`;
    }
    if (options.gitRemote) {
      changelogCommand += ` --git-remote ${options.gitRemote}`;
    }
    if (options.dryRun) {
      changelogCommand += ' --dry-run';
    }
    console.log(`> ${changelogCommand}`);
    execSync(changelogCommand, {
      stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
      maxBuffer: LARGE_BUFFER,
    });

    console.log(
      'Check github: https://github.com/nrwl/nx/actions/workflows/publish.yml'
    );
    process.exit(0);
  }

  runNxReleaseVersion();

  execSync(`pnpm nx run-many -t add-extra-dependencies --parallel 8`, {
    stdio: isVerboseLogging ? [0, 1, 2] : 'ignore',
    maxBuffer: LARGE_BUFFER,
  });

  if (options.dryRun) {
    console.warn('Not Publishing because --dryRun was passed');
  } else {
    // If publishing locally, force all projects to not be private first
    if (options.local) {
      console.log(
        '\nPublishing locally, so setting all resolved packages to not be private'
      );
      const projectGraph = await createProjectGraphAsync();
      for (const proj of Object.values(projectGraph.nodes)) {
        if (proj.data.targets?.['nx-release-publish']) {
          const packageJsonPath = join(
            workspaceRoot,
            proj.data.targets?.['nx-release-publish']?.options.packageRoot,
            'package.json'
          );
          try {
            const packageJson = require(packageJsonPath);
            if (packageJson.private) {
              console.log(
                '- Publishing private package locally:',
                packageJson.name
              );
              writeFileSync(
                packageJsonPath,
                JSON.stringify({ ...packageJson, private: false })
              );
            }
          } catch {}
        }
      }
    }

    const distTag = determineDistTag(options.version);

    // Run with dynamic output-style so that we have more minimal logs by default but still always see errors
    let publishCommand = `pnpm nx release publish --registry=${getRegistry()} --tag=${distTag} --output-style=dynamic --parallel=8`;
    if (options.dryRun) {
      publishCommand += ' --dry-run';
    }
    console.log(`\n> ${publishCommand}`);
    execSync(publishCommand, {
      stdio: [0, 1, 2],
      maxBuffer: LARGE_BUFFER,
    });
  }

  process.exit(0);
})();

function parseArgs() {
  const parsedArgs = yargs
    .scriptName('pnpm nx-release')
    .wrap(144)
    .strictOptions()
    .version(false)
    .command(
      '$0 [version]',
      'This script is for publishing Nx both locally and publically'
    )
    .option('dryRun', {
      type: 'boolean',
      description: 'Dry-run flag to be passed to all `nx release` commands',
    })
    .option('clearLocalRegistry', {
      type: 'boolean',
      description:
        'Clear existing versions in the local registry so that you can republish the same version',
      default: true,
    })
    .option('local', {
      type: 'boolean',
      description: 'Publish Nx locally, not to actual NPM',
      alias: 'l',
      default: true,
    })
    .option('force', {
      type: 'boolean',
      description: "Don't use this unless you really know what it does",
      hidden: true,
    })
    .option('from', {
      type: 'string',
      description:
        'Git ref to pass to `nx release changelog`. Not applicable for local publishing or e2e tests.',
    })
    .positional('version', {
      type: 'string',
      description:
        'The version to publish. This does not need to be passed and can be inferred.',
      default: 'minor',
    })
    .option('gitRemote', {
      type: 'string',
      description:
        'Alternate git remote name to publish tags to (useful for testing changelog)',
      default: 'origin',
    })
    .example(
      '$0',
      `By default, this will locally publish a minor version bump as latest. Great for local development. Most developers should only need this.`
    )
    .example(
      '$0 --local false 2.3.4-beta.0',
      `This will really publish a new version to npm as next.`
    )
    .example(
      '$0 --local false 2.3.4',
      `Given the current latest major version on npm is 2, this will really publish a new version to npm as latest.`
    )
    .example(
      '$0 --local false 1.3.4-beta.0',
      `Given the current latest major version on npm is 2, this will really publish a new version to npm as previous.`
    )
    .group(
      ['local', 'clearLocalRegistry'],
      'Local Publishing Options for most developers'
    )
    .group(
      ['gitRemote', 'force'],
      'Real Publishing Options for actually publishing to NPM'
    )
    .demandOption('version')
    .check((args) => {
      const registry = getRegistry();
      const registryIsLocalhost = registry.hostname === 'localhost';
      if (!args.local) {
        if (!process.env.GH_TOKEN) {
          throw new Error('process.env.GH_TOKEN is not set');
        }
        if (!args.force && registryIsLocalhost) {
          throw new Error(
            'Registry is still set to localhost! Run "pnpm local-registry disable" or pass --force'
          );
        }
      } else {
        if (!args.force && !registryIsLocalhost) {
          throw new Error('--local was passed and registry is not localhost');
        }
      }

      return true;
    })
    .parseSync();

  return parsedArgs;
}

function getRegistry() {
  return new URL(execSync('npm config get registry').toString().trim());
}

function determineDistTag(newVersion: string): 'latest' | 'next' | 'previous' {
  // For a relative version keyword, it cannot be previous
  if (isRelativeVersionKeyword(newVersion)) {
    const prereleaseKeywords: ReleaseType[] = [
      'premajor',
      'preminor',
      'prepatch',
      'prerelease',
    ];
    return prereleaseKeywords.includes(newVersion) ? 'next' : 'latest';
  }

  const parsedGivenVersion = parse(newVersion);
  if (!parsedGivenVersion) {
    throw new Error(
      `Unable to parse the given version: "${newVersion}". Is it valid semver?`
    );
  }

  const currentLatestVersion = execSync('npm view nx version')
    .toString()
    .trim();
  const parsedCurrentLatestVersion = parse(currentLatestVersion);
  if (!parsedCurrentLatestVersion) {
    throw new Error(
      `The current version resolved from the npm registry could not be parsed (resolved "${currentLatestVersion}")`
    );
  }

  const distTag =
    parsedGivenVersion.prerelease.length > 0
      ? 'next'
      : parsedGivenVersion.major < parsedCurrentLatestVersion.major
      ? 'previous'
      : 'latest';

  return distTag;
}

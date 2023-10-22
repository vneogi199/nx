import { execFileSync, fork } from 'child_process';
import * as chalk from 'chalk';
import {
  ExecutorContext,
  parseTargetString,
  readTargetOptions,
} from '@nx/devkit';
import { copyFileSync, unlinkSync } from 'fs';
import { Schema } from './schema';
import { platform } from 'os';
import { join, resolve } from 'path';
import { readModulePackageJson } from 'nx/src/utils/package-json';
import * as detectPort from 'detect-port';
import { daemonClient } from 'nx/src/daemon/client/client';

// platform specific command name
const pmCmd = platform() === 'win32' ? `npx.cmd` : 'npx';

function getHttpServerArgs(options: Schema) {
  const args = [`-c${options.cacheSeconds}`];

  if (options.cors) {
    args.push(`--cors`);
  }
  if (options.host) {
    args.push(`-a=${options.host}`);
  }
  if (options.ssl) {
    args.push(`-S`);
  }
  if (options.sslCert) {
    args.push(`-C=${options.sslCert}`);
  }
  if (options.sslKey) {
    args.push(`-K=${options.sslKey}`);
  }
  if (options.proxyUrl) {
    args.push(`-P=${options.proxyUrl}`);
  }
  if (options.gzip) {
    args.push('-g');
  }
  if (options.brotli) {
    args.push('-b');
  }

  if (options.proxyOptions) {
    Object.keys(options.proxyOptions).forEach((key) => {
      args.push(`--proxy-options.${key}=${options.proxyOptions[key]}`);
    });
  }
  return args;
}

function getBuildTargetCommand(options: Schema) {
  const cmd = ['nx', 'run', options.buildTarget];
  if (options.parallel) {
    cmd.push(`--parallel`);
  }
  if (options.maxParallel) {
    cmd.push(`--maxParallel=${options.maxParallel}`);
  }
  return cmd;
}

function getBuildTargetOutputPath(options: Schema, context: ExecutorContext) {
  if (options.staticFilePath) {
    return options.staticFilePath;
  }

  let buildOptions;
  try {
    const target = parseTargetString(options.buildTarget, context);
    buildOptions = readTargetOptions(target, context);
  } catch (e) {
    throw new Error(`Invalid buildTarget: ${options.buildTarget}`);
  }

  // TODO: vsavkin we should also check outputs
  const outputPath = buildOptions.outputPath;
  if (!outputPath) {
    throw new Error(
      `Unable to get the outputPath from buildTarget ${options.buildTarget}. Make sure ${options.buildTarget} has an outputPath property or manually provide an staticFilePath property`
    );
  }

  return outputPath;
}

function createFileWatcher(
  project: string | undefined,
  changeHandler: () => void
) {
  return daemonClient.registerFileWatcher(
    {
      watchProjects: project ? [project] : 'all',
      includeGlobalWorkspaceFiles: true,
      includeDependentProjects: true,
    },
    async (error, { changedFiles }) => {
      if (error === 'closed') {
        throw new Error('Watch error: Daemon closed the connection');
      } else if (error) {
        throw new Error(`Watch error: ${error?.message ?? 'Unknown'}`);
      } else if (changedFiles.length > 0) {
        changeHandler();
      }
    }
  );
}

export default async function* fileServerExecutor(
  options: Schema,
  context: ExecutorContext
) {
  let running = false;

  const run = () => {
    if (!running) {
      running = true;
      try {
        const args = getBuildTargetCommand(options);
        execFileSync(pmCmd, args, {
          stdio: [0, 1, 2],
        });
      } catch {
        throw new Error(
          `Build target failed: ${chalk.bold(options.buildTarget)}`
        );
      } finally {
        running = false;
      }
    }
  };

  let disposeWatch: () => void;
  if (options.watch) {
    const projectRoot =
      context.projectsConfigurations.projects[context.projectName].root;
    disposeWatch = await createFileWatcher(context.projectName, run);
  }

  // perform initial run
  run();

  const outputPath = getBuildTargetOutputPath(options, context);

  if (options.spa) {
    const src = join(outputPath, 'index.html');
    const dst = join(outputPath, '404.html');

    // See: https://github.com/http-party/http-server#magic-files
    copyFileSync(src, dst);
  }

  const args = getHttpServerArgs(options);

  const { path: pathToHttpServerPkgJson, packageJson } = readModulePackageJson(
    'http-server',
    module.paths
  );
  const pathToHttpServerBin = packageJson.bin['http-server'];
  const pathToHttpServer = resolve(
    pathToHttpServerPkgJson.replace('package.json', ''),
    pathToHttpServerBin
  );

  // detect port as close to when used to prevent port being used by another process
  // when running in  parallel
  const port = await detectPort(options.port || 8080);
  args.push(`-p=${port}`);

  const serve = fork(pathToHttpServer, [outputPath, ...args], {
    stdio: 'pipe',
    cwd: context.root,
    env: {
      FORCE_COLOR: 'true',
      ...process.env,
    },
  });

  const processExitListener = () => {
    serve.kill();
    if (disposeWatch) {
      disposeWatch();
    }

    if (options.spa) {
      unlinkSync(join(outputPath, '404.html'));
    }
  };
  process.on('exit', processExitListener);
  process.on('SIGTERM', processExitListener);

  serve.stdout.on('data', (chunk) => {
    if (chunk.toString().indexOf('GET') === -1) {
      process.stdout.write(chunk);
    }
  });
  serve.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  yield {
    success: true,
    baseUrl: `${options.ssl ? 'https' : 'http'}://${options.host}:${port}`,
  };

  return new Promise<{ success: boolean }>((res) => {
    serve.on('exit', (code) => {
      if (code == 0) {
        res({ success: true });
      } else {
        res({ success: false });
      }
    });
  });
}

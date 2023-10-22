import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';

import setupSsr from '../../setup-ssr/setup-ssr';
import {
  corsVersion,
  expressVersion,
  moduleFederationNodeVersion,
  typesCorsVersion,
  typesExpressVersion,
} from '../../../utils/versions';

export async function addSsr(
  tree: Tree,
  {
    appName,
    port,
    standalone,
    typescriptConfiguration,
  }: {
    appName: string;
    port: number;
    standalone: boolean;
    typescriptConfiguration: boolean;
  }
) {
  let project = readProjectConfiguration(tree, appName);

  await setupSsr(tree, {
    project: appName,
    standalone,
  });

  tree.rename(
    joinPathFragments(project.sourceRoot, 'main.server.ts'),
    joinPathFragments(project.sourceRoot, 'bootstrap.server.ts')
  );

  tree.write(
    joinPathFragments(project.root, 'server.ts'),
    "import('./src/main.server');"
  );

  const browserBundleOutput = joinPathFragments(
    project.targets.build.options.outputPath,
    'browser'
  );
  const serverBundleOutput = joinPathFragments(
    project.targets.build.options.outputPath,
    'server'
  );

  generateFiles(
    tree,
    joinPathFragments(__dirname, `../files/common`),
    project.root,
    {
      appName,
      browserBundleOutput,
      serverBundleOutput,
      standalone,
      tmpl: '',
    }
  );

  const pathToTemplateFiles = typescriptConfiguration ? 'base-ts' : 'base';

  generateFiles(
    tree,
    joinPathFragments(__dirname, `../files/${pathToTemplateFiles}`),
    project.root,
    {
      tmpl: '',
    }
  );

  if (standalone) {
    generateFiles(
      tree,
      joinPathFragments(__dirname, '../files/standalone'),
      project.root,
      {
        appName,
        standalone,
        tmpl: '',
      }
    );
  }

  // update project.json
  project = readProjectConfiguration(tree, appName);

  project.targets.server.executor = '@nx/angular:webpack-server';
  project.targets.server.options.customWebpackConfig = {
    path: joinPathFragments(
      project.root,
      `webpack.server.config.${typescriptConfiguration ? 'ts' : 'js'}`
    ),
  };
  project.targets['serve-ssr'].options = {
    ...(project.targets['serve-ssr'].options ?? {}),
    port,
  };

  project.targets['static-server'] = {
    dependsOn: ['build', 'server'],
    executor: 'nx:run-commands',
    options: {
      command: `PORT=${port} node ${joinPathFragments(
        project.targets.server.options.outputPath,
        'main.js'
      )}`,
    },
  };

  updateProjectConfiguration(tree, appName, project);

  const installTask = addDependenciesToPackageJson(
    tree,
    {
      cors: corsVersion,
      express: expressVersion,
      '@module-federation/node': moduleFederationNodeVersion,
    },
    {
      '@types/cors': typesCorsVersion,
      '@types/express': typesExpressVersion,
    }
  );

  return installTask;
}

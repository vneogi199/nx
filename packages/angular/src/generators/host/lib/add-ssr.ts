import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nx/devkit';
import type { Schema } from '../schema';

import setupSsr from '../../setup-ssr/setup-ssr';
import {
  corsVersion,
  expressVersion,
  moduleFederationNodeVersion,
  typesCorsVersion,
  typesExpressVersion,
} from '../../../utils/versions';
import { join } from 'path';

export async function addSsr(
  tree: Tree,
  options: Schema,
  appName: string,
  typescriptConfiguration: boolean
) {
  let project = readProjectConfiguration(tree, appName);

  await setupSsr(tree, {
    project: appName,
    standalone: options.standalone,
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

  generateFiles(tree, join(__dirname, '../files/common'), project.root, {
    appName,
    browserBundleOutput,
    standalone: options.standalone,
    tmpl: '',
  });

  const pathToTemplateFiles = typescriptConfiguration ? 'ts' : 'js';

  generateFiles(
    tree,
    join(__dirname, '../files', pathToTemplateFiles),
    project.root,
    {
      tmpl: '',
    }
  );

  // update project.json
  project = readProjectConfiguration(tree, appName);

  project.targets.server.executor = '@nx/angular:webpack-server';
  project.targets.server.options.customWebpackConfig = {
    path: joinPathFragments(
      project.root,
      `webpack.server.config.${pathToTemplateFiles}`
    ),
  };

  project.targets['serve-ssr'].executor =
    '@nx/angular:module-federation-dev-ssr';

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

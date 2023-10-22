import {
  addDependenciesToPackageJson,
  ensurePackage,
  GeneratorCallback,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';

import { reactDomVersion, reactVersion } from '@nx/react/src/utils/versions';
import reactInitGenerator from '@nx/react/src/generators/init/init';
import { initGenerator as jsInitGenerator } from '@nx/js';

import {
  eslintConfigNextVersion,
  nextVersion,
  nxVersion,
  tsLibVersion,
} from '../../utils/versions';
import { InitSchema } from './schema';
import { addGitIgnoreEntry } from '../../utils/add-gitignore-entry';

function updateDependencies(host: Tree) {
  return addDependenciesToPackageJson(
    host,
    {
      next: nextVersion,
      react: reactVersion,
      'react-dom': reactDomVersion,
      tslib: tsLibVersion,
    },
    {
      '@nx/next': nxVersion,
      'eslint-config-next': eslintConfigNextVersion,
    }
  );
}

export async function nextInitGenerator(host: Tree, schema: InitSchema) {
  const tasks: GeneratorCallback[] = [];

  tasks.push(
    await jsInitGenerator(host, {
      ...schema,
      skipFormat: true,
    })
  );

  if (!schema.unitTestRunner || schema.unitTestRunner === 'jest') {
    const { jestInitGenerator } = ensurePackage<typeof import('@nx/jest')>(
      '@nx/jest',
      nxVersion
    );
    const jestTask = await jestInitGenerator(host, schema);
    tasks.push(jestTask);
  }
  if (schema.e2eTestRunner === 'cypress') {
    const { cypressInitGenerator } = ensurePackage<
      typeof import('@nx/cypress')
    >('@nx/cypress', nxVersion);
    const cypressTask = await cypressInitGenerator(host, {});
    tasks.push(cypressTask);
  } else if (schema.e2eTestRunner === 'playwright') {
    const { initGenerator } = ensurePackage<typeof import('@nx/playwright')>(
      '@nx/playwright',
      nxVersion
    );
    const playwrightTask = await initGenerator(host, {
      skipFormat: true,
      skipPackageJson: schema.skipPackageJson,
    });
    tasks.push(playwrightTask);
  }

  // @ts-ignore
  // TODO(jack): remove once the React Playwright PR lands first
  const reactTask = await reactInitGenerator(host, {
    ...schema,
    skipFormat: true,
  });
  tasks.push(reactTask);

  if (!schema.skipPackageJson) {
    const installTask = updateDependencies(host);
    tasks.push(installTask);
  }

  addGitIgnoreEntry(host);

  return runTasksInSerial(...tasks);
}

export default nextInitGenerator;

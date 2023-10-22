import {
  formatFiles,
  getProjects,
  joinPathFragments,
  runTasksInSerial,
  stripIndents,
  Tree,
} from '@nx/devkit';
import { determineProjectNameAndRootOptions } from '@nx/devkit/src/generators/project-name-and-root-utils';
import { lt } from 'semver';
import { E2eTestRunner } from '../../utils/test-runners';
import applicationGenerator from '../application/application';
import remoteGenerator from '../remote/remote';
import { setupMf } from '../setup-mf/setup-mf';
import { getInstalledAngularVersionInfo } from '../utils/version-utils';
import { addSsr } from './lib';
import type { Schema } from './schema';

export async function host(tree: Tree, options: Schema) {
  return await hostInternal(tree, {
    projectNameAndRootFormat: 'derived',
    ...options,
  });
}

export async function hostInternal(tree: Tree, schema: Schema) {
  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);

  if (lt(installedAngularVersionInfo.version, '14.1.0') && schema.standalone) {
    throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using ${installedAngularVersionInfo.version}.
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  }

  const { typescriptConfiguration = true, ...options }: Schema = schema;

  const projects = getProjects(tree);

  const remotesToGenerate: string[] = [];
  const remotesToIntegrate: string[] = [];

  if (options.remotes && options.remotes.length > 0) {
    options.remotes.forEach((remote) => {
      if (!projects.has(remote)) {
        remotesToGenerate.push(remote);
      } else {
        remotesToIntegrate.push(remote);
      }
    });
  }

  const { projectName: hostProjectName, projectNameAndRootFormat } =
    await determineProjectNameAndRootOptions(tree, {
      name: options.name,
      projectType: 'application',
      directory: options.directory,
      projectNameAndRootFormat: options.projectNameAndRootFormat,
      callingGenerator: '@nx/angular:host',
    });
  options.projectNameAndRootFormat = projectNameAndRootFormat;

  const appInstallTask = await applicationGenerator(tree, {
    ...options,
    standalone: options.standalone ?? false,
    routing: true,
    port: 4200,
    skipFormat: true,
  });

  const skipE2E =
    !options.e2eTestRunner || options.e2eTestRunner === E2eTestRunner.None;
  await setupMf(tree, {
    appName: hostProjectName,
    mfType: 'host',
    routing: true,
    port: 4200,
    remotes: remotesToIntegrate ?? [],
    federationType: options.dynamic ? 'dynamic' : 'static',
    skipPackageJson: options.skipPackageJson,
    skipFormat: true,
    skipE2E,
    e2eProjectName: skipE2E ? undefined : `${hostProjectName}-e2e`,
    prefix: options.prefix,
    typescriptConfiguration,
  });

  let installTasks = [appInstallTask];
  if (options.ssr) {
    let ssrInstallTask = await addSsr(
      tree,
      options,
      hostProjectName,
      typescriptConfiguration
    );
    installTasks.push(ssrInstallTask);
  }

  for (const remote of remotesToGenerate) {
    let remoteDirectory = options.directory;
    if (
      options.projectNameAndRootFormat === 'as-provided' &&
      options.directory
    ) {
      /**
       * With the `as-provided` format, the provided directory would be the root
       * of the host application. Append the remote name to the host parent
       * directory to get the remote directory.
       */
      remoteDirectory = joinPathFragments(options.directory, '..', remote);
    }

    await remoteGenerator(tree, {
      ...options,
      name: remote,
      directory: remoteDirectory,
      host: hostProjectName,
      skipFormat: true,
      standalone: options.standalone,
      typescriptConfiguration,
    });
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }

  return runTasksInSerial(...installTasks);
}

export default host;

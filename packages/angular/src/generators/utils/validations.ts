import type { Tree } from '@nx/devkit';
import { getProjects, stripIndents } from '@nx/devkit';
import { lt } from 'semver';
import { getInstalledAngularVersionInfo } from './version-utils';

export function validateProject(tree: Tree, projectName: string): void {
  const projects = getProjects(tree);

  if (!projects.has(projectName)) {
    throw new Error(
      `Project "${projectName}" does not exist! Please provide an existing project name.`
    );
  }
}

export function validateStandaloneOption(
  tree: Tree,
  standalone: boolean | undefined,
  angularVersion?: string
): void {
  if (!standalone) {
    return;
  }

  const installedAngularVersion =
    angularVersion ?? getInstalledAngularVersionInfo(tree).version;

  if (lt(installedAngularVersion, '14.1.0')) {
    throw new Error(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using "${installedAngularVersion}".
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  }
}

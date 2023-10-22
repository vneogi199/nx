import type { ExecutorContext } from '@nx/devkit';
import { eachValueFrom } from '@nx/devkit/src/utils/rxjs-for-await';
import {
  calculateProjectBuildableDependencies,
  checkDependentProjectsHaveBeenBuilt,
  createTmpTsConfig,
  DependentBuildableProjectNode,
} from '@nx/js/src/utils/buildable-libs-utils';
import type { NgPackagr } from 'ng-packagr';
import { resolve } from 'path';
import { from } from 'rxjs';
import { mapTo, switchMap, tap } from 'rxjs/operators';
import { parseRemappedTsConfigAndMergeDefaults } from '../utilities/typescript';
import { NX_ENTRY_POINT_PROVIDERS } from './ng-packagr-adjustments/ng-package/entry-point/entry-point.di';
import { nxProvideOptions } from './ng-packagr-adjustments/ng-package/options.di';
import {
  NX_PACKAGE_PROVIDERS,
  NX_PACKAGE_TRANSFORM,
} from './ng-packagr-adjustments/ng-package/package.di';
import type { BuildAngularLibraryExecutorOptions } from './schema';

async function initializeNgPackagr(
  options: BuildAngularLibraryExecutorOptions,
  context: ExecutorContext,
  projectDependencies: DependentBuildableProjectNode[]
): Promise<NgPackagr> {
  const packager = new (await import('ng-packagr')).NgPackagr([
    ...NX_PACKAGE_PROVIDERS,
    ...NX_ENTRY_POINT_PROVIDERS,
    nxProvideOptions({
      tailwindConfig: options.tailwindConfig,
      watch: options.watch,
    }),
  ]);

  packager.forProject(resolve(context.root, options.project));
  packager.withBuildTransform(NX_PACKAGE_TRANSFORM.provide);

  if (options.tsConfig) {
    const remappedTsConfigFilePath = createTmpTsConfig(
      options.tsConfig,
      context.root,
      context.projectsConfigurations.projects[context.projectName].root,
      projectDependencies
    );
    const tsConfig = await parseRemappedTsConfigAndMergeDefaults(
      context.root,
      options.tsConfig,
      remappedTsConfigFilePath
    );
    packager.withTsConfig(tsConfig);
  }

  return packager;
}

/**
 * Creates an executor function that executes the library build of an Angular
 * package using ng-packagr.
 * @param initializeNgPackagr function that returns an ngPackagr instance to use for the build.
 */
export function createLibraryExecutor(
  initializeNgPackagr: (
    options: BuildAngularLibraryExecutorOptions,
    context: ExecutorContext,
    projectDependencies: DependentBuildableProjectNode[]
  ) => Promise<NgPackagr>
) {
  return async function* (
    options: BuildAngularLibraryExecutorOptions,
    context: ExecutorContext
  ) {
    const { target, dependencies, topLevelDependencies } =
      calculateProjectBuildableDependencies(
        context.taskGraph,
        context.projectGraph,
        context.root,
        context.projectName,
        context.targetName,
        context.configurationName
      );
    if (
      !checkDependentProjectsHaveBeenBuilt(
        context.root,
        context.projectName,
        context.targetName,
        dependencies
      )
    ) {
      return Promise.resolve({ success: false });
    }

    if (options.watch) {
      return yield* eachValueFrom(
        from(initializeNgPackagr(options, context, dependencies)).pipe(
          switchMap((packagr) => packagr.watch()),
          mapTo({ success: true })
        )
      );
    }

    return from(initializeNgPackagr(options, context, dependencies))
      .pipe(
        switchMap((packagr) => packagr.build()),
        mapTo({ success: true })
      )
      .toPromise();
  };
}

export const packageExecutor = createLibraryExecutor(initializeNgPackagr);

export default packageExecutor;

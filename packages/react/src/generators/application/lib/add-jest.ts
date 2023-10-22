import { ensurePackage, GeneratorCallback, Tree } from '@nx/devkit';
import { NormalizedSchema } from '../schema';
import { nxVersion } from '../../../utils/versions';

export async function addJest(
  host: Tree,
  options: NormalizedSchema
): Promise<GeneratorCallback> {
  const { configurationGenerator } = ensurePackage<typeof import('@nx/jest')>(
    '@nx/jest',
    nxVersion
  );

  if (options.unitTestRunner !== 'jest') {
    return () => {};
  }

  return await configurationGenerator(host, {
    ...options,
    project: options.projectName,
    supportTsx: true,
    skipSerializers: true,
    setupFile: 'none',
    compiler: options.compiler,
    skipFormat: true,
  });
}

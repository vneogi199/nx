import {
  formatFiles,
  readProjectConfiguration,
  runTasksInSerial,
  Tree,
} from '@nx/devkit';
import { storybookConfigurationGenerator as vueStorybookConfigurationGenerator } from '@nx/vue';
import { Schema } from './schema';

/*
 * This generator is basically the Vue one, but for Nuxt we
 * are just adding the styles in `.storybook/preview.ts`
 */
export async function storybookConfigurationGenerator(
  host: Tree,
  options: Schema
) {
  const storybookConfigurationGenerator =
    await vueStorybookConfigurationGenerator(host, {
      ...options,
    });

  const projectConfiguration = readProjectConfiguration(host, options.name);

  const storybookConfigFolder =
    projectConfiguration.targets?.storybook?.options?.configDir;

  host.write(
    `${storybookConfigFolder}/preview.${options.tsConfiguration ? 'ts' : 'js'}`,
    `import '../src/assets/css/styles.css';`
  );

  await formatFiles(host);
  return runTasksInSerial(storybookConfigurationGenerator);
}

export default storybookConfigurationGenerator;

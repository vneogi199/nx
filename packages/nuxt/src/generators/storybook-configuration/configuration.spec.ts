import { logger, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import applicationGenerator from '../application/application';
import componentGenerator from '../component/component';
import storybookConfigurationGenerator from './configuration';

const componentContent = `<script setup lang="ts">
defineProps<{
  name: string;
  displayAge: boolean;
  age: number;
}>();
</script>

<template>
  <p>Welcome to Vlv!</p>
</template>

<style scoped>
</style>
`;

describe('nuxt:storybook-configuration', () => {
  let appTree;
  beforeEach(async () => {
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    jest.resetModules();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should configure with vue3 framework and styles import', async () => {
    appTree = await createTestApp('test-ui-app');
    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-app',
    });

    expect(
      appTree.read('test-ui-app/.storybook/main.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      appTree.read('test-ui-app/.storybook/preview.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(appTree.exists('test-ui-app/tsconfig.storybook.json')).toBeTruthy();
  });

  it('should generate stories for components and not pages', async () => {
    appTree = await createTestApp('test-ui-app');
    appTree.write(
      'test-ui-app/src/components/my-component/my-component.vue',
      componentContent
    );
    appTree.write('test-ui-app/src/pages/about.vue', componentContent);

    await storybookConfigurationGenerator(appTree, {
      name: 'test-ui-app',
      generateStories: true,
    });

    expect(
      appTree.exists(
        'test-ui-app/src/components/my-component/my-component.stories.ts'
      )
    ).toBeTruthy();
    expect(
      appTree.exists('test-ui-app/src/pages/about.stories.ts')
    ).toBeFalsy();
  });
});

export async function createTestApp(
  appName: string,
  plainJS = false
): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();

  await applicationGenerator(appTree, {
    e2eTestRunner: 'none',
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: appName,
    js: plainJS,
    projectNameAndRootFormat: 'as-provided',
  });

  await componentGenerator(appTree, {
    name: 'my-component',
    project: appName,
  });

  return appTree;
}

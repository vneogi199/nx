import { Tree } from '@nx/devkit';
import storiesGenerator from './stories';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import applicationGenerator from '../application/application';
import { Linter } from '@nx/eslint';
import { reactNativeComponentGenerator } from '../component/component';

describe('react:stories for applications', () => {
  let appTree: Tree;

  beforeEach(async () => {
    appTree = await createTestUIApp('test-ui-app');
  });

  it('should create the stories', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'another-cmp',
      project: 'test-ui-app',
    });
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    expect(appTree.exists('test-ui-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('test-ui-app/src/app/App.stories.tsx')).toBeTruthy();
    expect(
      appTree.exists('test-ui-app/src/app/another-cmp/another-cmp.stories.tsx')
    ).toBeTruthy();
  });

  it('should ignore paths', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'another-cmp',
      project: 'test-ui-app',
    });
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      ignorePaths: ['test-ui-app/src/app/**'],
    });

    expect(appTree.exists('test-ui-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('test-ui-app/src/app/App.stories.tsx')).toBeFalsy();
    expect(
      appTree.exists('test-ui-app/src/app/another-cmp/another-cmp.stories.tsx')
    ).toBeFalsy();
  });

  it('should ignore paths with a direct path to a component', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'another-new-cmp',
      project: 'test-ui-app',
    });

    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      ignorePaths: ['test-ui-app/src/app/another-new-cmp/another-new-cmp.tsx'],
    });

    expect(appTree.exists('test-ui-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('test-ui-app/src/app/App.stories.tsx')).toBeTruthy();
    expect(
      appTree.exists(
        'test-ui-app/src/app/another-new-cmp/another-new-cmp.stories.tsx'
      )
    ).toBeFalsy();
  });

  it('should ignore a path that has a nested component, but still generate nested component stories', async () => {
    await reactNativeComponentGenerator(appTree, {
      name: 'another-new-cmp',
      project: 'test-ui-app',
    });
    await reactNativeComponentGenerator(appTree, {
      name: 'comp-a',
      directory: 'app/another-new-cmp',
      project: 'test-ui-app',
    });
    await storiesGenerator(appTree, {
      project: 'test-ui-app',
      ignorePaths: ['test-ui-app/src/app/another-new-cmp/another-new-cmp.tsx'],
    });

    expect(appTree.exists('test-ui-app/src/app/App.tsx')).toBeTruthy();
    expect(appTree.exists('test-ui-app/src/app/App.stories.tsx')).toBeTruthy();
    expect(
      appTree.exists(
        'test-ui-app/src/app/another-new-cmp/comp-a/comp-a.stories.tsx'
      )
    ).toBeTruthy();
    expect(
      appTree.exists(
        'test-ui-app/src/app/another-new-cmp/another-new-cmp.stories.tsx'
      )
    ).toBeFalsy();
  });

  it('should ignore files that do not contain components', async () => {
    // create another component
    appTree.write(
      'test-ui-app/src/app/some-utils.js',
      `export const add = (a: number, b: number) => a + b;`
    );

    await storiesGenerator(appTree, {
      project: 'test-ui-app',
    });

    // should just create the story and not error, even though there's a js file
    // not containing any react component
    expect(appTree.exists('test-ui-app/src/app/App.stories.tsx')).toBeTruthy();
  });
});

export async function createTestUIApp(libName: string): Promise<Tree> {
  let appTree = createTreeWithEmptyWorkspace();
  appTree.write('.gitignore', '');

  await applicationGenerator(appTree, {
    linter: Linter.EsLint,
    skipFormat: false,
    style: 'css',
    unitTestRunner: 'none',
    name: libName,
    install: false,
    projectNameAndRootFormat: 'as-provided',
  });
  return appTree;
}

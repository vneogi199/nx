import { readProjectConfiguration, Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { Linter } from '@nx/eslint';
import { libraryGenerator } from '@nx/js';
import { addLinting } from './add-linting';

describe('Add Linting', () => {
  let tree: Tree;

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace();
    await libraryGenerator(tree, {
      name: 'my-lib',
      linter: Linter.None,
      projectNameAndRootFormat: 'as-provided',
    });
  });

  it('should add update configuration when eslint is passed', () => {
    addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.EsLint,
      tsConfigPaths: ['my-lib/tsconfig.lib.json'],
      projectRoot: 'my-lib',
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeDefined();
    expect(project.targets.lint.executor).toEqual('@nx/eslint:lint');
  });

  it('should not add lint target when "none" is passed', async () => {
    addLinting(tree, {
      projectName: 'my-lib',
      linter: Linter.None,
      tsConfigPaths: ['my-lib/tsconfig.lib.json'],
      projectRoot: 'my-lib',
    });
    const project = readProjectConfiguration(tree, 'my-lib');

    expect(project.targets.lint).toBeUndefined();
  });
});

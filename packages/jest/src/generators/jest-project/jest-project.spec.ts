import {
  addProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { jestConfigObject } from '../../utils/config/functions';

import { jestProjectGenerator } from './jest-project';
import { JestProjectSchema } from './schema.d';

describe('jestProject', () => {
  let tree: Tree;
  let defaultOptions: Omit<JestProjectSchema, 'project'> = {
    supportTsx: false,
    skipSetupFile: false,
    skipSerializers: false,
    testEnvironment: 'jsdom',
    setupFile: 'none',
    skipFormat: false,
    compiler: 'tsc',
  };

  beforeEach(async () => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      root: 'libs/lib1',
      sourceRoot: 'libs/lib1/src',
      targets: {
        lint: {
          executor: '@angular-devkit/build-angular:tslint',
          options: {
            tsConfig: [],
          },
        },
      },
    });
    writeJson(tree, 'libs/lib1/tsconfig.json', {
      files: [],
      include: [],
      references: [],
    });
  });

  it('should generate files', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      setupFile: 'angular',
    } as JestProjectSchema);
    expect(tree.read('libs/lib1/src/test-setup.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import 'jest-preset-angular/setup-jest';
      "
    `);
    expect(tree.exists('libs/lib1/jest.config.ts')).toBeTruthy();
    expect(tree.exists('libs/lib1/tsconfig.spec.json')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should alter project configuration', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      setupFile: 'angular',
    } as JestProjectSchema);
    const lib1 = readProjectConfiguration(tree, 'lib1');
    expect(lib1.targets.test).toEqual({
      executor: '@nx/jest:jest',
      outputs: ['{workspaceRoot}/coverage/{projectRoot}'],
      options: {
        jestConfig: 'libs/lib1/jest.config.ts',
        passWithNoTests: true,
      },
      configurations: {
        ci: {
          ci: true,
          codeCoverage: true,
        },
      },
    });
    expect(lib1.targets.lint.options.tsConfig).toContain(
      'libs/lib1/tsconfig.spec.json'
    );
  });

  it('should create a jest.config.ts', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
    } as JestProjectSchema);
    expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
  });

  it('should add a reference to solution tsconfig.json', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
    } as JestProjectSchema);
    const tsConfig = readJson(tree, 'libs/lib1/tsconfig.json');
    expect(tsConfig.references).toContainEqual({
      path: './tsconfig.spec.json',
    });
  });

  it('should create a tsconfig.spec.json', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      setupFile: 'angular',
    } as JestProjectSchema);
    const tsConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
    expect(tsConfig).toEqual({
      extends: './tsconfig.json',
      compilerOptions: {
        module: 'commonjs',
        outDir: '../../dist/out-tsc',
        types: ['jest', 'node'],
        target: 'es2016',
      },
      files: ['src/test-setup.ts'],
      include: [
        'jest.config.ts',
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/**/*.d.ts',
      ],
    });
  });

  describe('--setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
      } as JestProjectSchema);
      expect(tree.exists('src/test-setup.ts')).toBeFalsy();
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).not.toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
    });

    it('should have setupFilesAfterEnv in the jest.config when generated for web-components', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'web-components',
      } as JestProjectSchema);
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
    });

    it('should have setupFilesAfterEnv and globals.ts-jest in the jest.config when generated for angular', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'angular',
      } as JestProjectSchema);

      const jestConfig = tree.read('libs/lib1/jest.config.ts', 'utf-8');
      expect(jestConfig).toContain(
        `setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],`
      );
      expect(jestConfig).toMatchSnapshot();
    });

    it('should not list the setup file in project configuration', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'none',
      } as JestProjectSchema);
      const lib1 = readProjectConfiguration(tree, 'lib1');
      expect(lib1.targets.test.options.setupFile).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        setupFile: 'none',
      } as JestProjectSchema);
      const tsConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-setup-file', () => {
    it('should generate src/test-setup.ts', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSetupFile: true,
      } as JestProjectSchema);
      expect(tree.exists('src/test-setup.ts')).toBeFalsy();
    });

    it('should not list the setup file in project configuration', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSetupFile: true,
      } as JestProjectSchema);
      const lib1 = readProjectConfiguration(tree, 'lib1');
      expect(lib1.targets.test.options.setupFile).toBeUndefined();
    });

    it('should not list the setup file in tsconfig.spec.json', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSetupFile: true,
      } as JestProjectSchema);
      const tsConfig = readJson(tree, 'libs/lib1/tsconfig.spec.json');
      expect(tsConfig.files).toBeUndefined();
    });
  });

  describe('--skip-serializers', () => {
    it('should not list the serializers in jest.config.ts', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        skipSerializers: true,
      } as JestProjectSchema);
      const jestConfig = tree.read('libs/lib1/jest.config.ts', 'utf-8');
      expect(jestConfig).not.toContain(`
      snapshotSerializers: [
        'jest-preset-angular/build/AngularNoNgAttributesSnapshotSerializer.js,
        'jest-preset-angular/build/AngularSnapshotSerializer.js',
        'jest-preset-angular/build/HTMLCommentSerializer.js'
      ]
    `);
    });
  });

  describe('--support-tsx', () => {
    it('should add jest.transform', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        supportTsx: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.ts');
      expect(jestConfig.transform).toEqual({
        '^.+\\.[tj]sx?$': [
          'ts-jest',
          { tsconfig: '<rootDir>/tsconfig.spec.json' },
        ],
      });
    });

    it('should add tsx to moduleExtensions', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        supportTsx: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.ts');
      expect(jestConfig.moduleFileExtensions).toEqual([
        'ts',
        'tsx',
        'js',
        'jsx',
      ]);
    });
  });

  it('should create jest.config.js with --js flag', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('jest.preset.js')).toBeTruthy();
    expect(tree.exists('jest.config.js')).toBeTruthy();
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toContain(
      "preset: '../../jest.preset.js',"
    );
  });

  it('should use jest.config.js in project config with --js flag', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(
      readProjectConfiguration(tree, 'lib1').targets['test']
    ).toMatchSnapshot();
  });

  it('should always use jest.preset.js with --js', async () => {
    tree.write('jest.preset.ts', '');
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toContain(
      "preset: '../../jest.preset.js',"
    );
  });

  it('should use module.exports with --js flag', async () => {
    await jestProjectGenerator(tree, {
      ...defaultOptions,
      project: 'lib1',
      js: true,
    } as JestProjectSchema);
    expect(tree.exists('libs/lib1/jest.config.js')).toBeTruthy();
    expect(tree.read('libs/lib1/jest.config.js', 'utf-8')).toContain(
      'module.exports = {'
    );
  });

  describe('--babelJest', () => {
    it('should generate proper jest.transform when babelJest is true', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        babelJest: true,
      } as JestProjectSchema);
      const jestConfig = jestConfigObject(tree, 'libs/lib1/jest.config.ts');

      expect(jestConfig.globals).not.toEqual({
        'ts-jest': {
          tsConfig: '<rootDir>/tsconfig.spec.json',
        },
      });
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should generate proper jest.transform when babelJest and supportTsx is true', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        babelJest: true,
        supportTsx: true,
      } as JestProjectSchema);
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
    });

    it('should generate proper jest.transform when --compiler=swc and supportTsx is true', async () => {
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'lib1',
        compiler: 'swc',
        supportTsx: true,
      } as JestProjectSchema);
      expect(tree.read('libs/lib1/jest.config.ts', 'utf-8')).toMatchSnapshot();
    });
  });

  describe('root project', () => {
    it('root jest.config.ts should be project config', async () => {
      writeJson(tree, 'tsconfig.json', {
        files: [],
        include: [],
        references: [],
      });
      addProjectConfiguration(tree, 'my-project', {
        root: '',
        sourceRoot: 'src',
        name: 'my-project',
        targets: {},
      });
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'my-project',
      });
      expect(tree.read('jest.config.ts', 'utf-8')).toMatchInlineSnapshot(`
        "/* eslint-disable */
        export default {
          displayName: 'my-project',
          preset: './jest.preset.js',
          coverageDirectory: './coverage/my-project',
          testMatch: [
            '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
            '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)',
          ],
        };
        "
      `);
    });

    it('root jest.config.js should be project config', async () => {
      writeJson(tree, 'tsconfig.json', {
        files: [],
        include: [],
        references: [],
      });
      addProjectConfiguration(tree, 'my-project', {
        root: '',
        sourceRoot: 'src',
        name: 'my-project',
        targets: {},
      });
      await jestProjectGenerator(tree, {
        ...defaultOptions,
        project: 'my-project',
        js: true,
      });
      expect(tree.read('jest.config.js', 'utf-8')).toMatchInlineSnapshot(`
        "/* eslint-disable */
        module.exports = {
          displayName: 'my-project',
          preset: './jest.preset.js',
          coverageDirectory: './coverage/my-project',
          testMatch: [
            '<rootDir>/src/**/__tests__/**/*.[jt]s?(x)',
            '<rootDir>/src/**/*(*.)@(spec|test).[jt]s?(x)',
          ],
        };
        "
      `);
    });
  });
});

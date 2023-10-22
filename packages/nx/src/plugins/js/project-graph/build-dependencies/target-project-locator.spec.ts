import { vol } from 'memfs';
jest.mock('../../../../utils/workspace-root', () => ({
  workspaceRoot: '/root',
}));
jest.mock('fs', () => require('memfs').fs);
import { TargetProjectLocator } from './target-project-locator';
import {
  ProjectGraphExternalNode,
  ProjectGraphProcessorContext,
  ProjectGraphProjectNode,
} from '../../../../config/project-graph';

describe('findTargetProjectWithImport', () => {
  let projects: Record<string, ProjectGraphProjectNode>;
  let npmProjects: Record<string, ProjectGraphExternalNode>;
  let fsJson;
  let targetProjectLocator: TargetProjectLocator;
  beforeEach(() => {
    const nxJson = {
      npmScope: 'proj',
    };
    const tsConfig = {
      compilerOptions: {
        baseUrl: '.',
        resolveJsonModule: true,
        paths: {
          '@proj/proj': ['libs/proj'],
          '@proj/my-second-proj': ['libs/proj2'],
          '@proj/my-second-proj/*': ['libs/proj2/*'],
          '@proj/project-3': ['libs/proj3a'],
          '@proj/proj4ab': ['libs/proj4ab'],
          '@proj/proj5': ['./libs/proj5/*'],
          '@proj/proj6': ['../root/libs/proj6/*'],
          '@proj/proj7': ['/libs/proj7/*'],
          '@proj/proj123': ['libs/proj123'],
          '@proj/proj123/*': ['libs/proj123/*'],
          '@proj/proj1234': ['libs/proj1234'],
          '@proj/proj1234/*': ['libs/proj1234/*'],
          '@proj/proj1234-child': ['libs/proj1234-child'],
          '@proj/proj1234-child/*': ['libs/proj1234-child/*'],
          '#hash-path': ['libs/hash-project/src/index.ts'],
          'parent-path/*': ['libs/parent-path/*'],
        },
      },
    };
    fsJson = {
      './nx.json': JSON.stringify(nxJson),
      './tsconfig.base.json': JSON.stringify(tsConfig),
    };
    vol.fromJSON(fsJson, '/root');
    projects = {
      rootProj: {
        name: 'rootProj',
        type: 'lib',
        data: {
          root: '.',
        },
      },
      proj3a: {
        name: 'proj3a',
        type: 'lib',
        data: {
          root: 'libs/proj3a',
        },
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: {
          root: 'libs/proj2',
        },
      },
      proj: {
        name: 'proj',
        type: 'lib',
        data: {
          root: 'libs/proj',
        },
      },
      proj1234: {
        name: 'proj1234',
        type: 'lib',
        data: {
          root: 'libs/proj1234',
        },
      },
      proj123: {
        name: 'proj123',
        type: 'lib',
        data: {
          root: 'libs/proj123',
        },
      },
      proj4ab: {
        name: 'proj4ab',
        type: 'lib',
        data: {
          root: 'libs/proj4ab',
        },
      },
      proj5: {
        name: 'proj5',
        type: 'lib',
        data: {
          root: 'libs/proj5',
        },
      },
      proj6: {
        name: 'proj6',
        type: 'lib',
        data: {
          root: 'libs/proj6',
        },
      },
      proj7: {
        name: 'proj7',
        type: 'lib',
        data: {
          root: 'libs/proj7',
        },
      },
      'proj1234-child': {
        name: 'proj1234-child',
        type: 'lib',
        data: {
          root: 'libs/proj1234-child',
        },
      },
      'hash-project': {
        name: 'hash-project',
        type: 'lib',
        data: {
          root: 'libs/hash-project',
        },
      },
      'parent-project': {
        name: 'parent-project',
        type: 'lib',
        data: {
          root: 'libs/parent-path',
        },
      },
      'child-project': {
        name: 'child-project',
        type: 'lib',
        data: {
          root: 'libs/parent-path/child-path',
        },
      },
    };
    npmProjects = {
      'npm:@ng/core': {
        name: 'npm:@ng/core',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@ng/core',
        },
      },
      'npm:@ng/common': {
        name: 'npm:@ng/common',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@ng/common',
        },
      },
      'npm:npm-package': {
        name: 'npm:npm-package',
        type: 'npm',
        data: {
          version: '1',
          packageName: 'npm-package',
        },
      },
      'npm:@proj/my-second-proj': {
        name: 'npm:@proj/my-second-proj',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/my-second-proj',
        },
      },
      'npm:@proj/proj5': {
        name: 'npm:@proj/proj5',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/proj5',
        },
      },
      'npm:@proj/proj6': {
        name: 'npm:@proj/proj6',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/proj6',
        },
      },
      'npm:@proj/proj7': {
        name: 'npm:@proj/proj7',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/proj7',
        },
      },
      'npm:@proj/proj123-base': {
        name: 'npm:@proj/proj123-base',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/proj123-base',
        },
      },
    };

    targetProjectLocator = new TargetProjectLocator(projects, npmProjects);
  });

  it('should be able to resolve a module by using relative paths', () => {
    const res1 = targetProjectLocator.findProjectWithImport(
      './class.ts',
      'libs/proj/index.ts'
    );
    const res2 = targetProjectLocator.findProjectWithImport(
      '../index.ts',
      'libs/proj/src/index.ts'
    );
    const res3 = targetProjectLocator.findProjectWithImport(
      '../proj/../proj2/index.ts',
      'libs/proj/index.ts'
    );
    const res4 = targetProjectLocator.findProjectWithImport(
      '../proj/../index.ts',
      'libs/proj/src/index.ts'
    );
    const res5 = targetProjectLocator.findProjectWithImport(
      '../../../index.ts',
      'libs/proj/src/index.ts'
    );

    expect(res1).toEqual('proj');
    expect(res2).toEqual('proj');
    expect(res3).toEqual('proj2');
    expect(res4).toEqual('proj');
    expect(res5).toEqual('rootProj');
  });

  it('should be able to resolve a module by using tsConfig paths', () => {
    const proj2 = targetProjectLocator.findProjectWithImport(
      '@proj/my-second-proj',
      'libs/proj1/index.ts'
    );
    // const proj3a = targetProjectLocator.findProjectWithImport(
    //   '@proj/project-3',
    //   'libs/proj1/index.ts'
    // );

    expect(proj2).toEqual('proj2');
    // expect(proj3a).toEqual('proj3a');
  });

  it('should be able to resolve nested files using tsConfig paths', () => {
    const proj2deep = targetProjectLocator.findProjectWithImport(
      '@proj/my-second-proj/deep',
      'libs/proj1/index.ts'
    );

    expect(proj2deep).toEqual('proj2');
  });

  it('should be able to resolve nested files using tsConfig paths when having a root tsconfig.json instead of tsconfig.base.json', () => {
    fsJson['./tsconfig.json'] = fsJson['./tsconfig.base.json'];
    delete fsJson['./tsconfig.base.json'];

    const proj2deep = targetProjectLocator.findProjectWithImport(
      '@proj/my-second-proj/deep',
      'libs/proj1/index.ts'
    );

    expect(proj2deep).toEqual('proj2');
  });

  it('should be able to resolve nested files using tsConfig paths that have similar names', () => {
    const proj = targetProjectLocator.findProjectWithImport(
      '@proj/proj123/deep',
      ''
    );
    expect(proj).toEqual('proj123');

    const childProj = targetProjectLocator.findProjectWithImport(
      '@proj/proj1234-child/deep',
      ''
    );
    expect(childProj).toEqual('proj1234-child');

    const parentProj = targetProjectLocator.findProjectWithImport(
      '@proj/proj1234/deep',
      ''
    );
    expect(parentProj).toEqual('proj1234');
  });

  it('should be able to locate npm dependencies', () => {
    const result1 = targetProjectLocator.findProjectWithImport(
      '@ng/core',
      'libs/proj1/index.ts'
    );
    const result2 = targetProjectLocator.findProjectWithImport(
      'npm-package',
      'libs/proj1/index.ts'
    );

    expect(result1).toEqual('npm:@ng/core');
    expect(result2).toEqual('npm:npm-package');
  });

  it('should be able to resolve wildcard paths', () => {
    const parentProject = targetProjectLocator.findProjectWithImport(
      'parent-path',
      'libs/proj1/index.ts'
    );

    expect(parentProject).toEqual('parent-project');

    const childProject = targetProjectLocator.findProjectWithImport(
      'parent-path/child-path',
      'libs/proj1/index.ts'
    );

    expect(childProject).toEqual('child-project');
  });

  it('should be able to resolve paths that start with a #', () => {
    const proj = targetProjectLocator.findProjectWithImport(
      '#hash-path',
      'libs/proj1/index.ts'
    );

    expect(proj).toEqual('hash-project');
  });

  it('should be able to resolve a modules when npm packages exist', () => {
    const proj5 = targetProjectLocator.findProjectWithImport(
      '@proj/proj5',
      'libs/proj1/index.ts'
    );
    // const proj6 = targetProjectLocator.findProjectWithImport(
    //   '@proj/proj6',
    //   'libs/proj1/index.ts'
    // );
    // const proj7 = targetProjectLocator.findProjectWithImport(
    //   '@proj/proj7',
    //   'libs/proj1/index.ts'
    // );

    expect(proj5).toEqual('proj5');
    // expect(proj6).toEqual('proj6');
    // expect(proj7).toEqual('proj7');
  });
  it('should be able to resolve paths that have similar names', () => {
    const proj = targetProjectLocator.findProjectWithImport(
      '@proj/proj123',
      ''
    );
    expect(proj).toEqual('proj123');

    const childProj = targetProjectLocator.findProjectWithImport(
      '@proj/proj1234-child',
      ''
    );
    expect(childProj).toEqual('proj1234-child');

    const parentProj = targetProjectLocator.findProjectWithImport(
      '@proj/proj1234',
      ''
    );
    expect(parentProj).toEqual('proj1234');
  });

  it('should be able to resolve npm projects', () => {
    const similarImportFromNpm = targetProjectLocator.findProjectWithImport(
      '@proj/proj123-base',
      'libs/proj/index.ts'
    );
    expect(similarImportFromNpm).toEqual('npm:@proj/proj123-base');

    const similarDeepImportFromNpm = targetProjectLocator.findProjectWithImport(
      '@proj/proj123-base/deep',
      'libs/proj/index.ts'
    );
    expect(similarDeepImportFromNpm).toEqual('npm:@proj/proj123-base');
  });

  // TODO(meeroslav): This should fail if path is missing in tsconfig,
  // but passes because of implicit check for project's prefix
  it('should be able to resolve packages using project prefix', () => {
    const proj5 = targetProjectLocator.findProjectWithImport(
      '@proj/proj5',
      'libs/proj/index.ts'
    );
    expect(proj5).toEqual('proj5');
  });
});

describe('findTargetProjectWithImport (without tsconfig.json)', () => {
  let ctx: ProjectGraphProcessorContext;
  let projects: Record<string, ProjectGraphProjectNode>;
  let npmProjects: Record<string, ProjectGraphExternalNode>;
  let fsJson;
  let targetProjectLocator: TargetProjectLocator;

  beforeEach(() => {
    const projectsConfigurations = {
      projects: {
        proj1: {},
      },
    };
    const nxJson = {
      npmScope: 'proj',
    };
    fsJson = {
      './workspace.json': JSON.stringify(projectsConfigurations),
      './nx.json': JSON.stringify(nxJson),
      './libs/proj/index.ts': `import {a} from '@proj/my-second-proj';
                              import('@proj/project-3');
                              const a = { loadChildren: '@proj/proj4ab#a' };
      `,
      './libs/proj2/index.ts': `export const a = 2;`,
      './libs/proj2/deep/index.ts': `export const a = 22;`,
      './libs/proj3a/index.ts': `export const a = 3;`,
      './libs/proj4ab/index.ts': `export const a = 4;`,
      './libs/proj5/index.ts': `export const a = 5;`,
      './libs/proj6/index.ts': `export const a = 6;`,
      './libs/proj7/index.ts': `export const a = 7;`,
      './libs/proj123/index.ts': 'export const a = 123',
      './libs/proj1234/index.ts': 'export const a = 1234',
      './libs/proj1234-child/index.ts': 'export const a = 12345',
    };
    vol.fromJSON(fsJson, '/root');
    ctx = {
      workspace: {
        ...projectsConfigurations,
        ...nxJson,
      } as any,
      fileMap: {
        proj: [
          {
            file: 'libs/proj/index.ts',
            hash: 'some-hash',
          },
        ],
        proj2: [
          {
            file: 'libs/proj2/index.ts',
            hash: 'some-hash',
          },
          {
            file: 'libs/proj2/deep/index.ts',
            hash: 'some-hash',
          },
        ],
        proj3a: [
          {
            file: 'libs/proj3a/index.ts',
            hash: 'some-hash',
          },
        ],
        proj4ab: [
          {
            file: 'libs/proj4ab/index.ts',
            hash: 'some-hash',
          },
        ],
        proj5: [
          {
            file: 'libs/proj5/index.ts',
            hash: 'some-hash',
          },
        ],
        proj6: [
          {
            file: 'libs/proj6/index.ts',
            hash: 'some-hash',
          },
        ],
        proj7: [
          {
            file: 'libs/proj7/index.ts',
            hash: 'some-hash',
          },
        ],
        proj123: [
          {
            file: 'libs/proj123/index.ts',
            hash: 'some-hash',
          },
        ],
        proj1234: [
          {
            file: 'libs/proj1234/index.ts',
            hash: 'some-hash',
          },
        ],
        'proj1234-child': [
          {
            file: 'libs/proj1234-child/index.ts',
            hash: 'some-hash',
          },
        ],
      },
    } as any;

    projects = {
      '@org/proj1': {
        name: '@org/proj1',
        type: 'lib',
        data: {
          root: 'libs/proj1',
        },
      },
      proj3a: {
        name: 'proj3a',
        type: 'lib',
        data: {
          root: 'libs/proj3a',
        },
      },
      proj2: {
        name: 'proj2',
        type: 'lib',
        data: {
          root: 'libs/proj2',
        },
      },
      proj: {
        name: 'proj',
        type: 'lib',
        data: {
          root: 'libs/proj',
        },
      },
      proj1234: {
        name: 'proj1234',
        type: 'lib',
        data: {
          root: 'libs/proj1234',
        },
      },
      proj123: {
        name: 'proj123',
        type: 'lib',
        data: {
          root: 'libs/proj123',
        },
      },
      proj4ab: {
        name: 'proj4ab',
        type: 'lib',
        data: {
          root: 'libs/proj4ab',
        },
      },
      proj5: {
        name: 'proj5',
        type: 'lib',
        data: {
          root: 'libs/proj5',
        },
      },
      proj6: {
        name: 'proj6',
        type: 'lib',
        data: {
          root: 'libs/proj6',
        },
      },
      proj7: {
        name: 'proj7',
        type: 'lib',
        data: {
          root: 'libs/proj7',
        },
      },
      'proj1234-child': {
        name: 'proj1234-child',
        type: 'lib',
        data: {
          root: 'libs/proj1234-child',
        },
      },
    };
    npmProjects = {
      'npm:@ng/core': {
        name: 'npm:@ng/core',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@ng/core',
        },
      },
      'npm:@ng/common': {
        name: 'npm:@ng/common',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@ng/common',
        },
      },
      'npm:npm-package': {
        name: 'npm:npm-package',
        type: 'npm',
        data: {
          version: '1',
          packageName: 'npm-package',
        },
      },
      'npm:@proj/my-second-proj': {
        name: 'npm:@proj/my-second-proj',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/my-second-proj',
        },
      },
      'npm:@proj/proj5': {
        name: 'npm:@proj/proj5',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/proj5',
        },
      },
      'npm:@proj/proj6': {
        name: 'npm:@proj/proj6',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/proj6',
        },
      },
      'npm:@proj/proj7': {
        name: 'npm:@proj/proj7',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/proj7',
        },
      },
      'npm:@proj/proj123-base': {
        name: 'npm:@proj/proj123-base',
        type: 'npm',
        data: {
          version: '1',
          packageName: '@proj/proj123-base',
        },
      },
    };

    targetProjectLocator = new TargetProjectLocator(projects, npmProjects);
  });

  it('should work without a tsconfig file', () => {
    expect(targetProjectLocator).toBeDefined();
  });

  it('should be able to resolve a module by using relative paths', () => {
    const res1 = targetProjectLocator.findProjectWithImport(
      './class.ts',
      'libs/proj/index.ts'
    );
    const res2 = targetProjectLocator.findProjectWithImport(
      '../index.ts',
      'libs/proj/src/index.ts'
    );
    const res3 = targetProjectLocator.findProjectWithImport(
      '../proj/../proj2/index.ts',
      'libs/proj/index.ts'
    );
    const res4 = targetProjectLocator.findProjectWithImport(
      '../proj/../index.ts',
      'libs/proj/src/index.ts'
    );

    expect(res1).toEqual('proj');
    expect(res2).toEqual('proj');
    expect(res3).toEqual('proj2');
    expect(res4).toEqual('proj');
  });

  it('should be able to resolve local project', () => {
    jest
      .spyOn(targetProjectLocator as any, 'resolveImportWithRequire')
      .mockReturnValue('libs/proj1/index.ts');

    const result1 = targetProjectLocator.findProjectWithImport(
      '@org/proj1',
      'libs/proj1/index.ts'
    );
    expect(result1).toEqual('@org/proj1');

    jest
      .spyOn(targetProjectLocator as any, 'resolveImportWithRequire')
      .mockReturnValue('libs/proj1/some/nested/file.ts');
    const result2 = targetProjectLocator.findProjectWithImport(
      '@org/proj1/some/nested/path',
      'libs/proj1/index.ts'
    );
    expect(result2).toEqual('@org/proj1');
  });

  it('should be able to npm dependencies', () => {
    const result1 = targetProjectLocator.findProjectWithImport(
      '@ng/core',
      'libs/proj1/index.ts'
    );
    const result2 = targetProjectLocator.findProjectWithImport(
      'npm-package',
      'libs/proj1/index.ts'
    );

    expect(result1).toEqual('npm:@ng/core');
    expect(result2).toEqual('npm:npm-package');
  });

  it('should be able to resolve paths that have similar names', () => {
    const proj = targetProjectLocator.findProjectWithImport(
      '@proj/proj123',
      ''
    );
    expect(proj).toEqual('proj123');

    const childProj = targetProjectLocator.findProjectWithImport(
      '@proj/proj1234-child',
      ''
    );
    expect(childProj).toEqual('proj1234-child');

    const parentProj = targetProjectLocator.findProjectWithImport(
      '@proj/proj1234',
      ''
    );
    expect(parentProj).toEqual('proj1234');
  });

  it('should be able to resolve npm projects', () => {
    const similarImportFromNpm = targetProjectLocator.findProjectWithImport(
      '@proj/proj123-base',
      'libs/proj/index.ts'
    );
    expect(similarImportFromNpm).toEqual('npm:@proj/proj123-base');

    const similarDeepImportFromNpm = targetProjectLocator.findProjectWithImport(
      '@proj/proj123-base/deep',
      'libs/proj/index.ts'
    );
    expect(similarDeepImportFromNpm).toEqual('npm:@proj/proj123-base');
  });

  it('should return null for native modules', () => {
    const result = targetProjectLocator.findProjectWithImport(
      'path',
      'libs/proj/index.ts'
    );
    expect(result).toEqual(null);
  });

  it('should return null for unresolved paths', () => {
    const result = targetProjectLocator.findProjectWithImport(
      'unresolved-path',
      'libs/proj/index.ts'
    );
    expect(result).toEqual(null);
  });
});

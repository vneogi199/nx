import {
  addProjectConfiguration,
  stripIndents,
  updateJson,
  writeJson,
} from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { componentGenerator } from './component';

describe('component Generator', () => {
  it('should create component files correctly', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.ts', 'utf-8')
    ).toMatchSnapshot('component');
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.html', 'utf-8')
    ).toMatchSnapshot('template');
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.css', 'utf-8')
    ).toMatchSnapshot('stylesheet');
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.spec.ts', 'utf-8')
    ).toMatchSnapshot('component test file');
    expect(tree.read('libs/lib1/src/index.ts', 'utf-8')).toMatchSnapshot(
      'entry point file'
    );
  });

  it('should not generate test file when --skip-tests=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      skipTests: true,
    });

    // ASSERT
    expect(
      tree.exists('libs/lib1/src/lib/example/example.component.spec.ts')
    ).toBe(false);
  });

  it('should inline template when --inline-template=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      inlineTemplate: true,
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(
      tree.exists('libs/lib1/src/lib/example/example.component.html')
    ).toBe(false);
  });

  it('should inline styles when --inline-style=true', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      inlineStyle: true,
    });

    // ASSERT
    expect(
      tree.read('libs/lib1/src/lib/example/example.component.ts', 'utf-8')
    ).toMatchSnapshot();
    expect(tree.exists('libs/lib1/src/lib/example/example.component.css')).toBe(
      false
    );
  });

  it('should not create a style file when --style=none', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      style: 'none',
    });

    // ASSERT
    expect(
      tree.exists('libs/lib1/src/lib/example/example.component.none')
    ).toBeFalsy();
    expect(tree.read('libs/lib1/src/lib/example/example.component.ts', 'utf-8'))
      .toMatchInlineSnapshot(`
      "import { Component } from '@angular/core';

      @Component({
        selector: 'proj-example',
        templateUrl: './example.component.html',
      })
      export class ExampleComponent {}
      "
    `);
  });

  it('should create the component correctly and export it in the entry point when "export=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toMatchSnapshot();
  });

  it('should create the component correctly and export it in the entry point when is standalone and "export=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      standalone: true,
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toMatchInlineSnapshot(`
      "export * from './lib/example/example.component';
      "
    `);
  });

  it('should create the component correctly and not export it in the entry point when "export=false"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: false,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(
      `export * from "./lib/example/example.component";`
    );
  });

  it('should create the component correctly and not export it in the entry point when is standalone and "export=false"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      standalone: true,
      export: false,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(
      `export * from "./lib/example/example.component";`
    );
  });

  it('should create the component correctly and not export it when "--skip-import=true"', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      skipImport: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).not.toContain(
      `export * from "./lib/example/example.component";`
    );
  });

  it('should create the component correctly but not export it in the entry point when it does not exist', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const componentSource = tree.read(
      'libs/lib1/src/lib/example/example.component.ts',
      'utf-8'
    );
    expect(componentSource).toMatchSnapshot();

    const indexExists = tree.exists('libs/lib1/src/index.ts');
    expect(indexExists).toBeFalsy();
  });

  it('should not export the component in the entry point when the module it belongs to is not exported', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });
    tree.write(
      'libs/lib1/src/lib/lib.module.ts',
      `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
    );
    tree.write('libs/lib1/src/index.ts', '');

    // ACT
    await componentGenerator(tree, {
      name: 'example',
      project: 'lib1',
      export: true,
    });

    // ASSERT
    const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
    expect(indexSource).toBe('');
  });

  describe('--flat', () => {
    it('should create the component correctly and export it in the entry point', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        flat: true,
        export: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toContain(`export * from './lib/example.component';`);
    });

    it('should create the component correctly and not export it when "export=false"', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        flat: true,
        export: false,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).not.toContain(
        `export * from "./lib/example.component";`
      );
    });
  });

  describe('--path', () => {
    it('should create the component correctly and export it in the entry point', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        path: 'libs/lib1/src/lib/mycomp',
        export: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/src/lib/mycomp/example/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toContain(
        `export * from './lib/mycomp/example/example.component';`
      );
    });

    it('should throw if the path specified is not under the project root', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT & ASSERT
      await expect(
        componentGenerator(tree, {
          name: 'example',
          project: 'lib1',
          path: 'apps/app1/src/mycomp',
          export: false,
        })
      ).rejects.toThrow();
    });
  });

  describe('--module', () => {
    it.each([
      './lib.module.ts',
      'lib.module.ts',
      './lib.module',
      'lib.module',
      './lib',
      'lib',
    ])(
      'should export it in the entry point when "--module" is set to "%s"',
      async (module) => {
        // ARRANGE
        const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
        addProjectConfiguration(tree, 'lib1', {
          projectType: 'library',
          sourceRoot: 'libs/lib1/src',
          root: 'libs/lib1',
        });
        tree.write(
          'libs/lib1/src/lib/lib.module.ts',
          `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
        );
        tree.write(
          'libs/lib1/src/index.ts',
          'export * from "./lib/lib.module";'
        );

        // ACT
        await componentGenerator(tree, {
          name: 'example',
          project: 'lib1',
          module,
          export: true,
        });

        // ASSERT
        const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
        expect(indexSource).toContain(
          `export * from './lib/example/example.component';`
        );
      }
    );

    it('should import the component correctly to the module file when flat is false', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'shared-ui', {
        projectType: 'library',
        sourceRoot: 'libs/shared/ui/src',
        root: 'libs/shared/ui',
      });
      tree.write(
        'libs/shared/ui/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write(
        'libs/shared/ui/src/index.ts',
        'export * from "./lib/lib.module";'
      );

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'shared-ui',
        export: true,
        flat: false,
      });

      // ASSERT
      const moduleSource = tree.read(
        'libs/shared/ui/src/lib/lib.module.ts',
        'utf-8'
      );
      expect(moduleSource).toMatchSnapshot();
    });

    it('should not export it in the entry point when the module it belong to is not exported', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write(
        'libs/lib1/src/lib/not-exported.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class NotExportedModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        module: 'not-exported',
        export: true,
      });

      // ASSERT
      const indexSource = tree.read('libs/lib1/src/index.ts', 'utf-8');
      expect(indexSource).toMatchInlineSnapshot(`
        "export * from './lib/lib.module';
        "
      `);
    });

    it('should throw an error when the module is not found', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );

      // ACT & ASSERT
      await expect(
        componentGenerator(tree, {
          name: 'example',
          project: 'lib1',
          path: 'libs/lib1/src/lib',
          module: 'not-found',
        })
      ).rejects.toThrow();
    });

    it('should throw an error when there are more than one candidate modules that the component can be added to', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class LibModule {}`
      );
      tree.write(
        'libs/lib1/src/lib/lib2.module.ts',
        `
    import { NgModule } from '@angular/core';
    
    @NgModule({
      declarations: [],
      exports: []
    })
    export class Lib2Module {}`
      );

      // ACT & ASSERT
      await expect(
        componentGenerator(tree, {
          name: 'example',
          project: 'lib1',
          path: 'libs/lib1/src/lib',
        })
      ).rejects.toThrow();
    });
  });

  describe('secondary entry points', () => {
    it('should create the component correctly and export it in the entry point', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // secondary entry point
      writeJson(tree, 'libs/lib1/secondary/ng-package.json', {
        lib: { entryFile: './src/index.ts' },
      });
      tree.write(
        'libs/lib1/secondary/src/index.ts',
        'export * from "./lib/secondary.module";'
      );
      tree.write(
        'libs/lib1/secondary/src/lib/secondary.module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class SecondaryModule {}`
      );

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        path: 'libs/lib1/secondary/src/lib',
        export: true,
      });

      // ASSERT
      const componentSource = tree.read(
        'libs/lib1/secondary/src/lib/example/example.component.ts',
        'utf-8'
      );
      expect(componentSource).toMatchSnapshot();

      const secondaryIndexSource = tree.read(
        'libs/lib1/secondary/src/index.ts',
        'utf-8'
      );
      expect(secondaryIndexSource).toMatchSnapshot();
    });

    it('should not export the component in the entry point when the module it belongs to is not exported', async () => {
      // ARRANGE
      const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
      addProjectConfiguration(tree, 'lib1', {
        projectType: 'library',
        sourceRoot: 'libs/lib1/src',
        root: 'libs/lib1',
      });
      tree.write(
        'libs/lib1/src/lib/lib.module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class LibModule {}`
      );
      tree.write('libs/lib1/src/index.ts', 'export * from "./lib/lib.module";');

      // secondary entry point
      writeJson(tree, 'libs/lib1/secondary/ng-package.json', {
        lib: { entryFile: './src/index.ts' },
      });
      tree.write('libs/lib1/secondary/src/index.ts', '');
      tree.write(
        'libs/lib1/secondary/src/lib/secondary.module.ts',
        `
      import { NgModule } from '@angular/core';
      
      @NgModule({
        declarations: [],
        exports: []
      })
      export class SecondaryModule {}`
      );

      // ACT
      await componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        export: true,
      });

      // ASSERT
      const indexSource = tree.read(
        'libs/lib1/secondary/src/index.ts',
        'utf-8'
      );
      expect(indexSource).toBe('');
    });
  });

  it('should error correctly when Angular version does not support standalone', async () => {
    // ARRANGE
    const tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
    updateJson(tree, 'package.json', (json) => ({
      ...json,
      dependencies: {
        '@angular/core': '14.0.0',
      },
    }));

    addProjectConfiguration(tree, 'lib1', {
      projectType: 'library',
      sourceRoot: 'libs/lib1/src',
      root: 'libs/lib1',
    });

    // ACT & ASSERT
    await expect(
      componentGenerator(tree, {
        name: 'example',
        project: 'lib1',
        standalone: true,
      })
    ).rejects
      .toThrow(stripIndents`The "standalone" option is only supported in Angular >= 14.1.0. You are currently using "14.0.0".
    You can resolve this error by removing the "standalone" option or by migrating to Angular 14.1.0.`);
  });
});

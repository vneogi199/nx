# nx.json

The `nx.json` file configures the Nx CLI and project defaults. The full [machine readable schema](https://github.com/nrwl/nx/blob/master/packages/nx/schemas/nx-schema.json) is available on GitHub.

The following is an expanded example showing all options. Your `nx.json` will likely be much shorter. For a more intuitive understanding of the roles of each option, you can highlight the options in the excerpt below that relate to different categories.

```json {% fileName="nx.json" lineGroups={ Caching:[15,16,17,18,19,20,21,22,23,24,25,26,29], Orchestration:[3,4,5,28,30], Execution:[28,31,32,33,34] } %}
{
  "extends": "nx/presets/npm.json",
  "affected": {
    "defaultBase": "main"
  },
  "workspaceLayout": {
    "projectNameAndRootFormat": "as-provided"
  },
  "generators": {
    "@nx/js:library": {
      "buildable": true
    }
  },
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "cacheableOperations": ["build", "lint", "test", "e2e"]
      }
    }
  },
  "namedInputs": {
    "default": ["{projectRoot}/**/*"],
    "production": ["!{projectRoot}/**/*.spec.tsx"]
  },
  "targetDefaults": {
    "build": {
      "inputs": ["production", "^production"],
      "dependsOn": ["^build"],
      "executor": "@nrwl/js:tsc",
      "options": {
        "main": "{projectRoot}/src/index.ts"
      },
      "cache": true
    }
  }
}
```

### Extends

Some presets use the `extends` property to hide some default options in a separate json file. The json file specified in the `extends` property is located in your `node_modules` folder. The Nx preset files are specified in [the `nx` package](https://github.com/nrwl/nx/tree/master/packages/nx/presets).

### NPM Scope

The `npmScope` property of the `nx.json` file is deprecated as of version 16.2.0. `npmScope` was used as a prefix for the names of newly created projects. The new recommended way to define the organization prefix is to set the `name` property in the root `package.json` file to `@my-org/root`. Then `@my-org/` will be used as a prefix for all newly created projects.

In Nx 16, if the `npmScope` property is present, it will be used as a prefix. If the `npmScope` property is not present, the `name` property of the root `package.json` file will be used to infer the prefix.

In Nx 17, the `npmScope` property is ignored.

### Affected

Tells Nx which branch and HEAD to use when calculating affected projects.

- `defaultBase` defines the default base branch, defaulted to `main`.

### Workspace Layout

You can add a `workspaceLayout` property to modify where libraries and apps are located. As of Nx 16.8.0, there is a property called `projectNameAndRootFormat` that determines how this configuration block is interpreted. The default setting is `"projectNameAndRootFormat": "as-provided"`.

```json
{
  "workspaceLayout": {
    "projectNameAndRootFormat": "as-provided"
  }
}
```

This setting makes app or lib generators behave in the following way:

- `nx g app my-app` creates a new application named `my-app` in the `/my-app` folder
- `nx g lib my-lib` creates a new library named `my-lib` in the `/my-lib` folder
- `nx g app my-app --directory=apps/nested/my-app` creates a new application named `my-app` in the `/apps/nested/my-app` folder
- `nx g lib my-lib --directory=libs/shared/ui/my-lib` creates a new library named `my-lib` in the `/libs/shared/ui/my-lib` folder

The other style is `"projectNameAndRootFormat": "derived"`, which behaves the way Nx did before version 16.8.0.

```json
{
  "workspaceLayout": {
    "projectNameAndRootFormat": "derived",
    "appsDir": "demos",
    "libsDir": "packages"
  }
}
```

These settings would store apps in `/demos/` and libraries in `/packages/`. The paths specified are relative to the
workspace root.

This makes app or lib generators behave in the following way:

- `nx g app my-app` creates a new application named `my-app` in the `/demos/my-app` folder
- `nx g lib my-lib` creates a new library named `my-lib` in the `/packages/my-lib` folder
- `nx g app my-app --directory=nested` creates a new application named `nested-my-app` in the `/demos/nested/my-app` folder
- `nx g lib my-lib --directory=shared/ui` creates a new library named `shared-ui-my-lib` in the `/packages/shared/ui/my-lib` folder

If you accidentally generate a project in the wrong folder, use the [move generator](/nx-api/workspace/generators/move) to move it to the correct location.

### inputs & namedInputs

Named inputs defined in `nx.json` are merged with the named inputs defined in each project's project.json. In other words, every project has a set of named inputs, and it's defined as: `{...namedInputsFromNxJson, ...namedInputsFromProjectsProjectJson}`.

Defining `inputs` for a given target would replace the set of inputs for that target name defined in `nx.json`.
Using pseudocode `inputs = projectJson.targets.build.inputs || nxJson.targetDefaults.build.inputs`.

You can also define and redefine named inputs. This enables one key use case, where your `nx.json` can define things like this (which applies to every project):

```
"test": {
  "inputs": [
    "default",
    "^production"
  ]
}
```

And projects can define their `production` inputs, without having to redefine the inputs for the `test` target.

```json {% fileName="project.json" %}
{
  "namedInputs": {
    "production": ["default", "!{projectRoot}/**/*.test.js"]
  }
}
```

In this case Nx will use the right `production` input for each project.

{% cards %}
{% card title="Project Configuration reference" type="documentation" description="inputs and namedInputs are also described in the project configuration reference" url="/reference/project-configuration#inputs-&-namedinputs" /%}
{% card title="Customizing inputs and namedInputs" type="documentation" description="This guide walks through a few examples of how to customize inputs and namedInputs" url="/recipes/running-tasks/customizing-inputs" /%}
{% /cards %}

### Target Defaults

Target defaults provide ways to set common options for a particular target in your workspace. When building your project's configuration, we merge it with up to 1 default from this map. For a given target, we look at its name and its executor. We then check target defaults for any of the following combinations:

- `` `${executor}` ``
- `` `${targetName}` ``

Whichever of these we find first, we use as the base for that target's configuration. Some common scenarios for this follow.

Targets can depend on other targets. A common scenario is having to build dependencies of a project first before
building the project. The `dependsOn` property in `project.json` can be used to define the list of dependencies of an
individual target.

Often the same `dependsOn` configuration has to be defined for every project in the repo, and that's when
defining `targetDefaults` in `nx.json` is helpful.

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

The configuration above is identical to adding `{"dependsOn": ["^build"]}` to every build target of every project.

For full documentation of the `dependsOn` property, see the [project configuration reference](/reference/project-configuration#dependson).
{% cards %}
{% card title="Project Configuration reference" type="documentation" description="For full documentation of the `dependsOn` property, see the project configuration reference" url="/reference/project-configuration#dependson" /%}
{% /cards %}

Another target default you can configure is `outputs`:

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "build": {
      "outputs": ["{projectRoot}/custom-dist"]
    }
  }
}
```

When defining any options or configurations inside of a target default, you may use the `{workspaceRoot}` and `{projectRoot}` tokens. This is useful for defining things like the outputPath or tsconfig for many build targets.

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "@nx/js:tsc": {
      "options": {
        "main": "{projectRoot}/src/index.ts"
      },
      "configurations": {
        "prod": {
          "tsconfig": "{projectRoot}/tsconfig.prod.json"
        }
      },
      "inputs": ["prod"],
      "outputs": ["{workspaceRoot}/{projectRoot}"]
    },
    "build": {
      "inputs": ["prod"],
      "outputs": ["{workspaceRoot}/{projectRoot}"],
      "cache": true
    }
  }
}
```

{% callout type="note" title="Target Default Priority" %}
Note that the inputs and outputs are respecified on the @nx/js:tsc default configuration. This is **required**, as when reading target defaults Nx will only ever look at one key. If there is a default configuration based on the executor used, it will be read first. If not, Nx will fall back to looking at the configuration based on target name. For instance, running `nx build project` will read the options from `targetDefaults[@nx/js:tsc]` if the target configuration for build uses the @nx/js:tsc executor. It **would not** read any of the configuration from the `build` target default configuration unless the executor does not match.
{% /callout %}

#### Cache

In Nx 17 and higher, caching is configured by specifying `"cache": true` in a target's configuration. This will tell Nx that it's ok to cache the results of a given target. For instance, if you have a target that runs tests, you can specify `"cache": true` in the target default configuration for `test` and Nx will cache the results of running tests.

```json {% fileName="nx.json" %}
{
  "targetDefaults": {
    "test": {
      "cache": true
    }
  }
}
```

{% callout type="warning" title="Per Project Caching + DTE" %}

If you are using distributed task execution and disable caching for a given target, you will not be able to use distributed task execution for that target. This is because distributed task execution requires caching to be enabled. This means that the target you have disabled caching for, and any targets which depend on that target will fail the pipeline if you try to run them with DTE enabled.

{% /callout %}

### Generators

Default generator options are configured in `nx.json` as well. For instance, the following tells Nx to always
pass `--buildable=true` when creating new libraries.

```json {% fileName="nx.json" %}
{
  "generators": {
    "@nx/js:library": {
      "buildable": true
    }
  }
}
```

### Tasks Runner Options

> A task is an invocation of a target.

Tasks runners are invoked when you run `nx test`, `nx build`, `nx run-many`, `nx affected`, and so on. The tasks runner
named "default" is used by default. Specify a different one like this `nx run-many -t build --runner=another`.

Tasks runners can accept different options. The following are the options supported
by `"nx/tasks-runners/default"` and `"nx-cloud"`.

| Property                | Description                                                                                                                                                                                                                                                                                                                             |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cacheableOperations     | defines the list of targets/operations that are cached by Nx                                                                                                                                                                                                                                                                            |
| parallel                | defines the max number of targets ran in parallel (in older versions of Nx you had to pass `--parallel --maxParallel=3` instead of `--parallel=3`)                                                                                                                                                                                      |
| captureStderr           | defines whether the cache captures stderr or just stdout                                                                                                                                                                                                                                                                                |
| skipNxCache             | defines whether the Nx Cache should be skipped (defaults to `false`)                                                                                                                                                                                                                                                                    |
| cacheDirectory          | defines where the local cache is stored (defaults to `node_modules/.cache/nx`)                                                                                                                                                                                                                                                          |
| encryptionKey           | (when using `"nx-cloud"` only) defines an encryption key to support end-to-end encryption of your cloud cache. You may also provide an environment variable with the key `NX_CLOUD_ENCRYPTION_KEY` that contains an encryption key as its value. The Nx Cloud task runner normalizes the key length, so any length of key is acceptable |
| selectivelyHashTsConfig | only hash the path mapping of the active project in the `tsconfig.base.json` (e.g., adding/removing projects doesn't affect the hash of existing projects) (defaults to `false`)                                                                                                                                                        |

You can configure `parallel` in `nx.json`, but you can also pass them in the
terminal `nx run-many -t test --parallel=5`.

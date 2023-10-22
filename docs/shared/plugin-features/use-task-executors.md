# Use Task Executors

Executors perform actions on your code. This can include building, linting, testing, serving and many other actions.

There are two main differences between an executor and a shell script or an npm script:

1. Executors encourage a consistent methodology for performing similar actions on unrelated projects. i.e. A developer switching between teams can be confident that `nx build project2` will build `project2` with the default settings, just like `nx build project1` built `project1`.
2. Nx can leverage this consistency to run the same target across multiple projects. i.e. `nx affected -t test` will run the `test` executor associated with the `test` target on every project that is affected by the current code change.
3. Executors provide metadata to define the available options. This metadata allows the Nx CLI to show prompts in the terminal and Nx Console to generate a GUI for the executor.

## Executor definitions

Executors are associated with specific targets in a project's `project.json` file.

```jsonc {% fileName="project.json" %}
{
  "root": "apps/cart",
  "sourceRoot": "apps/cart/src",
  "projectType": "application",
  "generators": {},
  "targets": {
    "build": {
      "executor": "@nx/webpack:webpack",
      "options": {
        "outputPath": "dist/apps/cart",
        ...
      },
      "configurations": {
        "production": {
          "sourceMap": false,
          ...
        }
      }
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        ...
      }
    }
  }
}
```

Each project has targets configured to run an executor with a specific set of options. In this snippet, `cart` has two targets defined - `build` and `test`.

{% callout type="note" title="More details" %}
`build` and `test` can be any strings you choose. For the sake of consistency, we make `test` run unit tests for every project and `build` produce compiled code for the projects which can be built.
{% /callout %}

Each executor definition has an `executor` property and, optionally, an `options` and a `configurations` property.

- `executor` is a string of the form `[package name]:[executor name]`. For the `build` executor, the package name is `@nx/webpack` and the executor name is `webpack`.
- `options` is an object that contains any configuration defaults for the executor. These options vary from executor to executor.
- `configurations` allows you to create presets of options for different scenarios. All the configurations start with the properties defined in `options` as a baseline and then overwrite those options. In the example, there is a `production` configuration that overrides the default options to set `sourceMap` to `false`.

## Running executors

The [`nx run`](/nx-api/nx/documents/run) cli command (or the shorthand versions) can be used to run executors.

```shell
nx run [project]:[command]
nx run cart:build
```

As long as your command name doesn't conflict with an existing nx cli command, you can use this short hand:

```shell
nx [command] [project]
nx build cart
```

You can also use a specific configuration preset like this:

```shell
nx [command] [project] --configuration=[configuration]
nx build cart --configuration=production
```

Or you can overwrite individual executor options like this:

```shell
nx [command] [project] --[optionNameInCamelCase]=[value]
nx build cart --outputPath=some/other/path
```

## Running a single command

If defining a new target that needs to run a single shell command, there is a shorthand for the `nx:run-commands` executor that can be used.

```jsonc {% fileName="project.json" %}
{
  "root": "apps/cart",
  "sourceRoot": "apps/cart/src",
  "projectType": "application",
  "generators": {},
  "targets": {
    "echo": {
      "command": "echo 'hello world'"
    }
  }
}
```

For more info, see the [run-commands documentation](/nx-api/nx/executors/run-commands)

## Use Executor Configurations

The `configurations` property provides extra sets of values that will be merged into the options map.

```json {% fileName="project.json" %}
{
  "build": {
    "executor": "@nx/js:tsc",
    "outputs": ["{workspaceRoot}/dist/libs/mylib"],
    "dependsOn": ["^build"],
    "options": {
      "tsConfig": "libs/mylib/tsconfig.lib.json",
      "main": "libs/mylib/src/main.ts"
    },
    "configurations": {
      "production": {
        "tsConfig": "libs/mylib/tsconfig-prod.lib.json"
      }
    }
  }
}
```

You can select a configuration like this: `nx build mylib --configuration=production`
or `nx run mylib:build:production`.

The following code snippet shows how the executor options get constructed:

```javascript
require(`@nx/jest`).executors['jest']({
  ...options,
  ...selectedConfiguration,
  ...commandLineArgs,
}); // Pseudocode
```

The selected configuration adds/overrides the default options, and the provided command line args add/override the
configuration options.

### Default Configuration

When using multiple configurations for a given target, it's helpful to provide a default configuration.
For example, running e2e tests for multiple environments. By default it would make sense to use a `dev` configuration for day to day work, but having the ability to run against an internal staging environment for the QA team.

```json {% fileName="project.json" %}
{
  "e2e": {
    "executor": "@nx/cypress:cypress",
    "options": {
      "cypressConfig": "apps/my-app-e2e/cypress.config.ts"
    },
    "configurations": {
      "dev": {
        "devServerTarget": "my-app:serve"
      },
      "qa": {
        "baseUrl": "https://some-internal-url.example.com"
      }
    },
    "defaultConfiguration": "dev"
  }
}
```

When running `nx e2e my-app-e2e`, the _dev_ configuration will be used. In this case using the local dev server for `my-app`.
You can always run the other configurations by explicitly providing the configuration i.e. `nx e2e my-app-e2e --configuration=qa` or `nx run my-app-e2e:e2e:qa`

## Build your own Executor

Nx comes with a Devkit that allows you to build your own executor to automate your Nx workspace. Learn more about it in the [docs page about creating a local executor](/extending-nx/recipes/local-executors).

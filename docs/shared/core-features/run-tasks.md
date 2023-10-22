# Run Tasks

Monorepos can have hundreds or even thousands of projects, so being able to run actions against all (or some) of them is a key feature of a tool like Nx.

## Definitions

- **Command -** anything the developer types into the terminal (e.g., `nx run header:build`).
- **Target -** the name of an action taken on a project (e.g., `build`)
- **Task -** an invocation of a target on a specific project (e.g., `header:build`).

## Define Tasks

For these examples, we'll imagine a repo that has three projects: `myapp`, `header` and `footer`. `myapp` is a deployable app and uses the `header` and `footer` libraries.

Each project has the `test` and `build` targets defined. Tasks can be defined as npm scripts in a project's `package.json` file or as targets in a `project.json` file:

{% tabs %}
{% tab label="package.json" %}

```json {% fileName="package.json" %}
{
  "scripts": {
    "build": "webpack -c webpack.conf.js",
    "test": "jest --coverage"
  }
}
```

{% /tab %}
{% tab label="project.json" %}

```json {% fileName="project.json" %}
{
  "targets": {
    "build": {
      "command": "webpack -c webpack.conf.js"
    },
    "test": {
      "executor": "@nx/jest:jest",
      "options": {
        "codeCoverage": true
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

## Running Tasks

Nx uses the following syntax:

![Syntax for Running Tasks in Nx](/shared/images/run-target-syntax.svg)

### Run a Single Task

To run the `test` target on the `header` project run this command:

```shell
npx nx test header
```

### Run Tasks for Multiple Projects

You can use the `run-many` command to run a task for multiple projects. Here are a couple of examples.

Run the `build` target for all projects in the repo:

```shell
npx nx run-many -t build
```

Run the `build`, `lint` and `test` target for all projects in the repo:

```shell
npx nx run-many -t build lint test
```

Run the `build`, `lint` and `test` target just on the `header` and `footer` projects:

```shell
npx nx run-many -t build lint test -p header footer
```

Note that Nx parallelizes all these tasks making also sure they are run in the right order based on their dependencies and the [task pipeline configuration](/concepts/task-pipeline-configuration).

Learn more about the [run-many](/nx-api/nx/documents/run-many) command.

### Run Tasks in Parallel

If you want to increase the number of processes running tasks to, say, 5 (by default, it is 3), pass the
following:

```shell
npx nx build myapp --parallel=5
```

Note, you can also change the default in `nx.json`, like this:

{% tabs %}
{% tab label="Nx >= 17" %}

```json {% fileName="nx.json"%}
{
  "parallel": 5
}
```

{% /tab %}
{% tab label="Nx < 17" %}

```json {% fileName="nx.json"%}
{
  "tasksRunnerOptions": {
    "default": {
      "runner": "nx/tasks-runners/default",
      "options": {
        "parallel": 5
      }
    }
  }
}
```

{% /tab %}
{% /tabs %}

### Run Tasks on Projects Affected by a PR

You can also run a command for all the projects affected by your PR like this:

```shell
npx nx affected -t test
```

Learn more about the affected command [here](/concepts/affected).

## Defining a Task Pipeline

It is pretty common to have dependencies between tasks, requiring one task to be run before another. For example, you might want to run the `build` target on the `header` project before running the `build` target on the `app` project.

Nx is already able to automatically understand the dependencies between projects (see [project graph](/core-features/explore-graph)).

{% graph height="450px" %}

```json
{
  "projects": [
    {
      "name": "myreactapp",
      "type": "app",
      "data": {
        "tags": []
      }
    },
    {
      "name": "shared-ui",
      "type": "lib",
      "data": {
        "tags": []
      }
    },
    {
      "name": "feat-products",
      "type": "lib",
      "data": {
        "tags": []
      }
    }
  ],
  "dependencies": {
    "myreactapp": [
      { "source": "myreactapp", "target": "feat-products", "type": "static" }
    ],
    "shared-ui": [],
    "feat-products": [
      {
        "source": "feat-products",
        "target": "shared-ui",
        "type": "static"
      }
    ]
  },
  "workspaceLayout": { "appsDir": "", "libsDir": "" },
  "affectedProjectIds": [],
  "focus": null,
  "groupByFolder": false
}
```

{% /graph %}

However, you need to define for which targets such ordering matters. In the following example we are telling Nx that before running the `build` target it needs to run the `build` target on all the projects the current project depends on:

```json {% fileName="nx.json" %}
{
  ...
  "targetDefaults": {
    "build": {
      "dependsOn": ["^build"]
    }
  }
}
```

Meaning, if we run `nx build myreactapp`, Nx will first run `build` on `modules-shared-ui` and `modules-products` before running `build` on `myreactapp`. You can define these task dependencies globally for your workspace in `nx.json` or individually in each project's `project.json` file.

Learn all the details:

- [What a task pipeline is all about](/concepts/task-pipeline-configuration)
- [How to configure a task pipeline](/recipes/running-tasks/defining-task-pipeline)

## Run Root-Level Tasks

Sometimes you have tasks that apply to the entire codebase rather than to a single project. But you still want those tasks to go through the "Nx pipeline" in order to benefit from caching. You can define these in the root-level `package.json` as follows:

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "scripts": {
    "docs": "node ./generateDocsSite.js"
  },
  "nx": {}
}
```

> Note the `nx: {}` property on the `package.json`. This is necessary to inform Nx about this root-level project. The property can also be expanded to specify cache inputs and outputs.

To invoke it, use:

```shell
npx nx docs
```

If you want Nx to cache the task, but prefer to use npm (or pnpm/yarn) to run the script (i.e. `npm run docs`) you can use the [nx exec](/nx-api/nx/documents/exec) command:

```json {% fileName="package.json" %}
{
  "name": "myorg",
  "scripts": {
    "docs": "nx exec -- node ./generateDocsSite.js"
  },
  "nx": {}
}
```

Learn more about root-level tasks [in our dedicated recipe page](/recipes/running-tasks/root-level-scripts).

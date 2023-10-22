The React plugin contains executors and generators for managing React applications and libraries within an Nx workspace.
It provides:

- Integration with libraries such as Jest, Cypress, and Storybook.
- Generators for applications, libraries, components, hooks, and more.
- Library build support for publishing packages to npm or other registries.
- Utilities for automatic workspace refactoring.

## Setting Up React

To create a new workspace with React, run `npx create-nx-workspace@latest --preset=react-standalone`.

{% callout type="note" title="Keep Nx Package Versions In Sync" %}
Make sure to install the `@nx/react` version that matches the version of `nx` in your repository. If the version numbers get out of sync, you can encounter some difficult to debug errors. You can [fix Nx version mismatches with this recipe](/recipes/tips-n-tricks/keep-nx-versions-in-sync).
{% /callout %}

To add the React plugin to an existing workspace, run one of the following:

```shell
# For npm users
npm install -D @nx/react

# For yarn users
yarn add -D @nx/react
```

### Creating Applications and Libraries

You can add a new application with the following:

```shell
nx g @nx/react:app my-new-app
```

To start the application in development mode, run `nx serve my-new-app`.

And add a new library as follows:

```shell
nx g @nx/react:lib my-new-lib

# If you want the library to be buildable or publishable to npm
nx g @nx/react:lib my-new-lib --bundler=vite
nx g @nx/react:lib my-new-lib --bundler=rollup
nx g @nx/react:lib my-new-lib \
--publishable \
--importPath=@myorg/my-new-lib
```

Read more about [building and publishing libraries here](/concepts/more-concepts/buildable-and-publishable-libraries).

### Creating Components

Adding a component to an existing project can be done with:

```shell
nx g @nx/react:component my-new-component \
--project=my-new-app

# Note: If you want to export the component
# from the library use  --export
nx g @nx/react:component my-new-component \
--project=my-new-lib \
--export
```

Replace `my-new-app` and `my-new-lib` with the name of your projects.

### Creating Hooks

If you want to add a new hook, run the following

```shell
nx g @nx/react:hook my-new-hook --project=my-new-lib
```

Replace `my-new-lib` with the name of your project.

## Using React

### Testing Projects

You can run unit tests with:

```shell
nx test my-new-app
nx test my-new-lib
```

Replace `my-new-app` with the name or your project. This command works for both applications and libraries.

You can also run E2E tests for applications:

```shell
nx e2e my-new-app-e2e
```

Replace `my-new-app-e2e` with the name or your project with `-e2e` appended.

### Building Projects

React applications can be build with:

```shell
nx build my-new-app
```

And if you generated a library with `--bundler` specified, then you can build a library as well:

```shell
nx build my-new-lib
```

The output is in the `dist` folder. You can customize the output folder by setting `outputPath` in the
project's `project.json` file.

The application in `dist` is deployable, and you can try it out locally with:

```shell
npx http-server dist/apps/my-new-app
```

The library in `dist` is publishable to npm or a private registry.

## More Documentation

- [Using Cypress](/nx-api/cypress)
- [Using Jest](/nx-api/jest)
- [Using Storybook](/recipes/storybook/overview-react)

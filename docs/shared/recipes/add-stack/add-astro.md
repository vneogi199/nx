# Add an Astro Project

The code for this example is available on GitHub:

{% github-repository url="https://github.com/nrwl/nx-recipes/tree/main/astro-standalone" /%}

**Supported Features**

Because we are not using an Nx plugin for Astro, there are few items we'll have to configure manually. We'll have to configure our own build system. There are no pre-created Astro-specific code generators. And we'll have to take care of updating any framework dependencies as needed.

{% pill url="/core-features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/core-features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/core-features/remote-cache" %}✅ Remote Caching{% /pill %}
{% pill url="/core-features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/core-features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/core-features/integrate-with-editors" %}✅ Integrate with Editors{% /pill %}
{% pill url="/core-features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/recipes/enforce-module-boundaries" %}✅ Enforce Project Boundaries{% /pill %}
{% pill url="/core-features/plugin-features/use-task-executors" %}🚫 Use Task Executors{% /pill %}
{% pill url="/core-features/plugin-features/use-code-generators" %}🚫 Use Code Generators{% /pill %}
{% pill url="/core-features/automate-updating-dependencies" %}🚫 Automate Updating Framework Dependencies{% /pill %}

## Create an astro app

```shell
npm create astro@latest
```

## Add Nx

We can leverage [`nx init`](/recipes/adopting-nx/adding-to-existing-project#installing-nx-on-a-non-monorepo-project) to add Nx to the Astro application.

```{% command="npx nx@latest init" path="~/astro-app"%}
 >  NX   🐳 Nx initialization


 >  NX   🧑‍🔧 Please answer the following questions about the scripts found in your package.json in order to generate task runner configuration

✔ Which of the following scripts are cacheable? (Produce the same output given the same input, e.g. build, test and lint usually are, serve and start are not). You can use spacebar to select one or more scripts. · build

✔ Does the "build" script create any outputs? If not, leave blank, otherwise provide a path (e.g. dist, lib, build, coverage) · dist
✔ Enable distributed caching to make your CI faster · No

 >  NX   📦 Installing dependencies

 >  NX   🎉 Done!

   - Enabled computation caching!
   - Learn more at https://nx.dev/recipes/adopting-nx/adding-to-existing-project.
```

You can add a task as cacheable after the fact by updating the `cacheableOperations` in the `nx.json` file. Learn more about [caching task results](/recipes/adopting-nx/adding-to-existing-project#installing-nx-on-a-non-monorepo-project) or [how caching works](/core-features/cache-task-results).

## Running Tasks

Because Nx [understands package.json scripts](/reference/project-configuration#project-configuration), You can run the predefined scripts via Nx.

```shell
nx build
```

If you plan on using your package manager to run the tasks, then you'll want to use [`nx exec`](/nx-api/nx/documents/exec) to wrap the command

i.e.

```json {% fileName="package.json" %}
{
  "scripts": {
    "e2e": "nx exec -- playwright test"
  }
}
```

Now when running `npm run e2e` Nx will be able to check if there is a cache hit or not.

If you plan to only run tasks with the Nx CLI, then you can omit `nx exec`. The safest way is to always include it in the package.json script.

## Using Other Plugins

With Nx plugins, you can create projects to help break out functionality of the project. For example, using the [`@nx/js:library`](/nx-api/js/generators/library#@nx/js:library) to contain our reusable `.astro` components.

Install `@nx/js` plugin.

> Note: you should make sure any first party, `@nx/` scoped, plugins match the `nx` package version

```shell
npm i -DE @nx/js@<nx-version>
```

Then generate a project

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [workspace layout documentation](/reference/nx-json#workspace-layout) for more details.
{% /callout %}

```{% command="nx g @nx/js:lib ui --directory=libs/ui --simpleName --minimal}
>  NX  Generating @nx/js:library

✔ Which unit test runner would you like to use? · none
✔ Which bundler would you like to use to build the library? Choose 'none' to skip build setup. · none

CREATE ui/tsconfig.json
CREATE ui/src/index.ts
CREATE ui/src/lib/ui.ts
CREATE ui/tsconfig.lib.json
CREATE ui/project.json
CREATE ui/.eslintrc.json
UPDATE tsconfig.json
```

If you plan to import `.astro` files within `.ts` files, then you can install the [`@astrojs/ts-plugin`](https://www.npmjs.com/package/@astrojs/ts-plugin).

```json {% fileName="tsconfig.json" %}
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "plugins": [
      {
        "name": "@astrojs/ts-plugin"
      }
    ],
    "paths": {
      "@myrepo/ui": ["ui/src/index.ts"]
    }
  }
}
```

An easier option is to allow importing the files directly instead of reexporting the `.astro` files via the `index.ts`.
You can do this by allowing deep imports in the tsconfig paths

```json {% fileName="tsconfig.json" %}
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      // Note: the * allowing the deep imports
      "@myrepo/ui/*": ["ui/src/*"]
    }
  }
}
```

This allows imports in our `.astro` files from other projects like so.

```ts {% fileName="src/pages/index.astro" %}
import Card from '@myrepo/ui/Card.astro';
import Footer from '@myrepo/ui/Footer.astro';
import Header from '@myrepo/ui/Header.astro';
```

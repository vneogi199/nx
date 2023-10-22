# Add a New Fastify Project

{% youtube
src="https://www.youtube.com/embed/LHLW0b4fr2w"
title="Easy, Modular Node Applications!"
width="100%" /%}

**Supported Features**

Because we are using an Nx plugin for Fastify, all the features of Nx are available.

{% pill url="/core-features/run-tasks" %}✅ Run Tasks{% /pill %}
{% pill url="/core-features/cache-task-results" %}✅ Cache Task Results{% /pill %}
{% pill url="/core-features/remote-cache" %}✅ Share Your Cache{% /pill %}
{% pill url="/core-features/explore-graph" %}✅ Explore the Graph{% /pill %}
{% pill url="/core-features/distribute-task-execution" %}✅ Distribute Task Execution{% /pill %}
{% pill url="/core-features/integrate-with-editors" %}✅ Integrate with Editors{% /pill %}
{% pill url="/core-features/automate-updating-dependencies" %}✅ Automate Updating Nx{% /pill %}
{% pill url="/core-features/enforce-module-boundaries" %}✅ Enforce Module Boundaries{% /pill %}
{% pill url="/core-features/plugin-features/use-task-executors" %}✅ Use Task Executors{% /pill %}
{% pill url="/core-features/plugin-features/use-code-generators" %}✅ Use Code Generators{% /pill %}
{% pill url="/core-features/automate-updating-dependencies" %}✅ Automate Updating Framework Dependencies{% /pill %}

## Create a New Workspace with a Fastify App

If you're starting from scratch, you can use a preset to get you started quickly.

```shell
npx create-nx-workspace@latest --preset=node-monorepo --framework=fastify --appName=fastify-api
```

Then you can skip to the [Create a Library](#create-a-library) section.

If you are adding Fastify to an existing repo, continue to the next section.

## Install the Node Plugin

{% tabs %}
{%tab label="npm"%}

```shell
npm i --save-dev @nx/node
```

{% /tab %}
{%tab label="yarn"%}

```shell
yarn add --dev @nx/node
```

{% /tab %}
{% /tabs %}

## Create an Application

Use the `app` generator to create a new Fastify app.

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [workspace layout documentation](/reference/nx-json#workspace-layout) for more details.
{% /callout %}

```shell
nx g @nx/node:app fastify-api --directory=apps/fastify-api
```

Serve the API by running

```shell
nx serve fastify-api
```

This starts the application on localhost:3000/api by default.

## Create a Library

To create a new library, run:

{% callout type="note" title="Directory Flag Behavior Changes" %}
The command below uses the `as-provided` directory flag behavior, which is the default in Nx 16.8.0. If you're on an earlier version of Nx or using the `derived` option, omit the `--directory` flag. See the [workspace layout documentation](/reference/nx-json#workspace-layout) for more details.
{% /callout %}

```shell
nx g @nx/node:lib my-lib --directory=libs/my-lib
```

Once the library is created, update the following files.

```typescript {% fileName="libs/my-lib/src/lib/my-lib.ts" %}
export function someFunction(): string {
  return 'some function';
}
```

```typescript {% fileName="apps/fastify-app/src/app/routes/root.ts" %}
import { someFunction } from '@my-org/my-lib';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

export default async function (fastify: FastifyInstance) {
  fastify.get(
    '/',
    async function (request: FastifyRequest, reply: FastifyReply) {
      return { message: 'Hello API ' + someFunction };
    }
  );
}
```

Now when you serve your API, you'll see the content from the library being displayed.

## More Documentation

- [@nx/node](/nx-api/node)
- [Using Mongo with Fastify](/showcase/example-repos/mongo-fastify)
- [Using Redis with Fastify](/showcase/example-repos/redis-fastify)
- [Using Postgres with Fastify](/showcase/example-repos/postgres-fastify)
- [Using PlanetScale with Serverless Fastify](/showcase/example-repos/serverless-fastify-planetscale)
- [Fastify](https://fastify.dev/)

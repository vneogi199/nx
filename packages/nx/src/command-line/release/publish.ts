import { NxJsonConfiguration, readNxJson } from '../../config/nx-json';
import {
  ProjectGraph,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { output } from '../../devkit-exports';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import { runCommand } from '../../tasks-runner/run-command';
import {
  createOverrides,
  readGraphFileFromGraphArg,
} from '../../utils/command-line-utils';
import { logger } from '../../utils/logger';
import { generateGraph } from '../graph/graph';
import { PublishOptions } from './command-object';
import {
  createNxReleaseConfig,
  handleNxReleaseConfigError,
} from './config/config';
import { filterReleaseGroups } from './config/filter-release-groups';

export async function publishHandler(
  args: PublishOptions & { __overrides_unparsed__: string[] }
): Promise<void> {
  const projectGraph = await createProjectGraphAsync({ exitOnError: true });
  const nxJson = readNxJson();

  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  // Apply default configuration to any optional user configuration
  const { error: configError, nxReleaseConfig } = await createNxReleaseConfig(
    projectGraph,
    nxJson.release,
    'nx-release-publish'
  );
  if (configError) {
    return await handleNxReleaseConfigError(configError);
  }

  const {
    error: filterError,
    releaseGroups,
    releaseGroupToFilteredProjects,
  } = filterReleaseGroups(
    projectGraph,
    nxReleaseConfig,
    args.projects,
    args.groups
  );
  if (filterError) {
    output.error(filterError);
    process.exit(1);
  }

  if (args.projects?.length) {
    /**
     * Run publishing for all remaining release groups and filtered projects within them
     */
    for (const releaseGroup of releaseGroups) {
      await runPublishOnProjects(
        args,
        projectGraph,
        nxJson,
        Array.from(releaseGroupToFilteredProjects.get(releaseGroup))
      );
    }

    return process.exit(0);
  }

  /**
   * Run publishing for all remaining release groups
   */
  for (const releaseGroup of releaseGroups) {
    await runPublishOnProjects(
      args,
      projectGraph,
      nxJson,
      releaseGroup.projects
    );
  }

  if (args.dryRun) {
    logger.warn(
      `\nNOTE: The "dryRun" flag means no projects were actually published.`
    );
  }

  process.exit(0);
}

async function runPublishOnProjects(
  args: PublishOptions & { __overrides_unparsed__: string[] },
  projectGraph: ProjectGraph,
  nxJson: NxJsonConfiguration,
  projectNames: string[]
) {
  const projectsToRun: ProjectGraphProjectNode[] = projectNames.map(
    (projectName) => projectGraph.nodes[projectName]
  );

  const overrides = createOverrides(args.__overrides_unparsed__);

  if (args.registry) {
    overrides.registry = args.registry;
  }
  if (args.tag) {
    overrides.tag = args.tag;
  }
  if (args.dryRun) {
    overrides.dryRun = args.dryRun;
  }

  if (args.verbose) {
    process.env.NX_VERBOSE_LOGGING = 'true';
  }

  const targets = ['nx-release-publish'];

  if (args.graph) {
    const file = readGraphFileFromGraphArg(args);
    const projectNames = projectsToRun.map((t) => t.name);
    return await generateGraph(
      {
        watch: false,
        all: false,
        open: true,
        view: 'tasks',
        targets,
        projects: projectNames,
        file,
      },
      projectNames
    );
  } else {
    /**
     * Run the relevant nx-release-publish executor on each of the selected projects.
     */
    const status = await runCommand(
      projectsToRun,
      projectGraph,
      { nxJson },
      {
        targets,
        outputStyle: 'static',
        ...(args as any),
      },
      overrides,
      null,
      {},
      { excludeTaskDependencies: false, loadDotEnvFiles: true }
    );

    if (status !== 0) {
      // fix for https://github.com/nrwl/nx/issues/1666
      if (process.stdin['unref']) (process.stdin as any).unref();
      process.exit(status);
    }
  }
}

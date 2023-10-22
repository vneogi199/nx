import { createHash } from 'crypto';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { copySync, ensureDirSync } from 'fs-extra';
import * as http from 'http';
import * as minimatch from 'minimatch';
import { URL } from 'node:url';
import * as open from 'open';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  parse,
  relative,
} from 'path';
import { performance } from 'perf_hooks';
import { readNxJson, workspaceLayout } from '../../config/configuration';
import {
  ProjectFileMap,
  ProjectGraph,
  ProjectGraphDependency,
  ProjectGraphProjectNode,
} from '../../config/project-graph';
import { writeJsonFile } from '../../utils/fileutils';
import { output } from '../../utils/output';
import { workspaceRoot } from '../../utils/workspace-root';

import { Server } from 'net';

import { FileData } from '../../config/project-graph';
import { TaskGraph } from '../../config/task-graph';
import { daemonClient } from '../../daemon/client/client';
import { filterUsingGlobPatterns } from '../../hasher/task-hasher';
import { getRootTsConfigPath } from '../../plugins/js/utils/typescript';
import { pruneExternalNodes } from '../../project-graph/operators';
import { createProjectGraphAsync } from '../../project-graph/project-graph';
import {
  createTaskGraph,
  mapTargetDefaultsToDependencies,
} from '../../tasks-runner/create-task-graph';
import { allFileData } from '../../utils/all-file-data';
import { splitArgsIntoNxArgsAndOverrides } from '../../utils/command-line-utils';
import { NxJsonConfiguration } from '../../config/nx-json';
import { HashPlanner } from '../../native';
import { transformProjectGraphForRust } from '../../native/transform-objects';
import { getAffectedGraphNodes } from '../affected/affected';
import { readFileMapCache } from '../../project-graph/nx-deps-cache';

export interface ProjectGraphClientResponse {
  hash: string;
  projects: ProjectGraphProjectNode[];
  dependencies: Record<string, ProjectGraphDependency[]>;
  fileMap: ProjectFileMap;
  layout: { appsDir: string; libsDir: string };
  affected: string[];
  focus: string;
  groupByFolder: boolean;
  exclude: string[];
}

export interface TaskGraphClientResponse {
  taskGraphs: Record<string, TaskGraph>;
  plans?: Record<string, string[]>;
  errors: Record<string, string>;
}

export interface ExpandedTaskInputsReponse {
  [taskId: string]: Record<string, string[]>;
}

// maps file extention to MIME types
const mimeType = {
  '.ico': 'image/x-icon',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.eot': 'appliaction/vnd.ms-fontobject',
  '.ttf': 'aplication/font-sfnt',
};

function buildEnvironmentJs(
  exclude: string[],
  watchMode: boolean,
  localMode: 'build' | 'serve',
  depGraphClientResponse?: ProjectGraphClientResponse,
  taskGraphClientResponse?: TaskGraphClientResponse,
  expandedTaskInputsReponse?: ExpandedTaskInputsReponse
) {
  let environmentJs = `window.exclude = ${JSON.stringify(exclude)};
  window.watch = ${!!watchMode};
  window.environment = 'release';
  window.localMode = '${localMode}';

  window.appConfig = {
    showDebugger: false,
    showExperimentalFeatures: false,
    workspaces: [
      {
        id: 'local',
        label: 'local',
        projectGraphUrl: 'project-graph.json',
        taskGraphUrl: 'task-graph.json',
        taskInputsUrl: 'task-inputs.json',
      }
    ],
    defaultWorkspaceId: 'local',
  };
  `;

  if (localMode === 'build') {
    environmentJs += `window.projectGraphResponse = ${JSON.stringify(
      depGraphClientResponse
    )};
    `;

    environmentJs += `window.taskGraphResponse = ${JSON.stringify(
      taskGraphClientResponse
    )};
    `;
    environmentJs += `window.expandedTaskInputsResponse = ${JSON.stringify(
      expandedTaskInputsReponse
    )};`;
  } else {
    environmentJs += `window.projectGraphResponse = null;`;
    environmentJs += `window.taskGraphResponse = null;`;
    environmentJs += `window.expandedTaskInputsResponse = null;`;
  }

  return environmentJs;
}

function projectExists(
  projects: ProjectGraphProjectNode[],
  projectToFind: string
) {
  return (
    projects.find((project) => project.name === projectToFind) !== undefined
  );
}

function hasPath(
  graph: ProjectGraph,
  target: string,
  node: string,
  visited: string[]
) {
  if (target === node) return true;

  for (let d of graph.dependencies[node] || []) {
    if (visited.indexOf(d.target) > -1) continue;
    visited.push(d.target);
    if (hasPath(graph, target, d.target, visited)) return true;
  }
  return false;
}

function filterGraph(
  graph: ProjectGraph,
  focus: string,
  exclude: string[]
): ProjectGraph {
  let projectNames = (
    Object.values(graph.nodes) as ProjectGraphProjectNode[]
  ).map((project) => project.name);

  let filteredProjectNames: Set<string>;

  if (focus !== null) {
    filteredProjectNames = new Set<string>();
    projectNames.forEach((p) => {
      const isInPath =
        hasPath(graph, p, focus, []) || hasPath(graph, focus, p, []);

      if (isInPath) {
        filteredProjectNames.add(p);
      }
    });
  } else {
    filteredProjectNames = new Set<string>(projectNames);
  }

  if (exclude.length !== 0) {
    exclude.forEach((p) => filteredProjectNames.delete(p));
  }

  let filteredGraph: ProjectGraph = {
    nodes: {},
    dependencies: {},
  };

  filteredProjectNames.forEach((p) => {
    filteredGraph.nodes[p] = graph.nodes[p];
    filteredGraph.dependencies[p] = graph.dependencies[p];
  });

  return filteredGraph;
}

export async function generateGraph(
  args: {
    file?: string;
    host?: string;
    port?: number;
    groupByFolder?: boolean;
    watch?: boolean;
    open?: boolean;
    view: 'projects' | 'tasks';
    projects?: string[];
    all?: boolean;
    targets?: string[];
    focus?: string;
    exclude?: string[];
    affected?: boolean;
  },
  affectedProjects: string[]
): Promise<void> {
  if (
    Array.isArray(args.targets) &&
    args.targets.length > 1 &&
    args.file &&
    !(args.file === 'stdout' || args.file.endsWith('.json'))
  ) {
    output.warn({
      title: 'Showing Multiple Targets is not supported yet',
      bodyLines: [
        `Only the task graph for "${args.targets[0]}" tasks will be shown`,
      ],
    });
  }

  // TODO: Graph Client should support multiple targets
  const target = Array.isArray(args.targets && args.targets.length >= 1)
    ? args.targets[0]
    : args.targets;

  const rawGraph = await createProjectGraphAsync({ exitOnError: true });
  let prunedGraph = pruneExternalNodes(rawGraph);

  const projects = Object.values(
    prunedGraph.nodes
  ) as ProjectGraphProjectNode[];
  projects.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  if (args.focus) {
    if (!projectExists(projects, args.focus)) {
      output.error({
        title: `Project to focus does not exist.`,
        bodyLines: [`You provided --focus=${args.focus}`],
      });
      process.exit(1);
    }
  }

  if (args.affected) {
    affectedProjects = (
      await getAffectedGraphNodes(
        splitArgsIntoNxArgsAndOverrides(
          args,
          'affected',
          { printWarnings: true },
          readNxJson()
        ).nxArgs,
        rawGraph
      )
    ).map((n) => n.name);
  }

  if (args.exclude) {
    const invalidExcludes: string[] = [];

    args.exclude.forEach((project) => {
      if (!projectExists(projects, project)) {
        invalidExcludes.push(project);
      }
    });

    if (invalidExcludes.length > 0) {
      output.error({
        title: `The following projects provided to --exclude do not exist:`,
        bodyLines: invalidExcludes,
      });
      process.exit(1);
    }
  }

  let html = readFileSync(
    join(__dirname, '../../core/graph/index.html'),
    'utf-8'
  );

  prunedGraph = filterGraph(
    prunedGraph,
    args.focus || null,
    args.exclude || []
  );

  if (args.file) {
    // stdout is a magical constant that doesn't actually write a file
    if (args.file === 'stdout') {
      console.log(
        JSON.stringify(
          createJsonOutput(prunedGraph, args.projects, args.targets),
          null,
          2
        )
      );
      process.exit(0);
    }

    const workspaceFolder = workspaceRoot;
    const ext = extname(args.file);
    const fullFilePath = isAbsolute(args.file)
      ? args.file
      : join(workspaceFolder, args.file);
    const fileFolderPath = dirname(fullFilePath);

    if (ext === '.html') {
      const assetsFolder = join(fileFolderPath, 'static');
      const assets: string[] = [];
      copySync(join(__dirname, '../../core/graph'), assetsFolder, {
        filter: (_src, dest) => {
          const isntHtml = !/index\.html/.test(dest);
          if (isntHtml && dest.includes('.')) {
            assets.push(dest);
          }
          return isntHtml;
        },
      });

      const depGraphClientResponse = await createDepGraphClientResponse(
        affectedProjects
      );

      const taskGraphClientResponse = await createTaskGraphClientResponse();
      const taskInputsReponse = await createExpandedTaskInputResponse(
        taskGraphClientResponse,
        depGraphClientResponse
      );

      const environmentJs = buildEnvironmentJs(
        args.exclude || [],
        args.watch,
        !!args.file && args.file.endsWith('html') ? 'build' : 'serve',
        depGraphClientResponse,
        taskGraphClientResponse,
        taskInputsReponse
      );
      html = html.replace(/src="/g, 'src="static/');
      html = html.replace(/href="styles/g, 'href="static/styles');
      html = html.replace('<base href="/" />', '');
      html = html.replace(/type="module"/g, '');

      writeFileSync(fullFilePath, html);
      writeFileSync(join(assetsFolder, 'environment.js'), environmentJs);

      output.success({
        title: `HTML output created in ${fileFolderPath}`,
        bodyLines: [fileFolderPath, ...assets],
      });
    } else if (ext === '.json') {
      ensureDirSync(dirname(fullFilePath));

      const json = createJsonOutput(prunedGraph, args.projects, args.targets);
      json.affectedProjects = affectedProjects;
      json.criticalPath = affectedProjects;

      writeJsonFile(fullFilePath, json);

      output.warn({
        title: 'JSON output contains deprecated fields:',
        bodyLines: [
          '- affectedProjects',
          '- criticalPath',
          '',
          'These fields will be removed in Nx 18. If you need to see which projects were affected, use `nx show projects --affected`.',
        ],
      });

      output.success({
        title: `JSON output created in ${fileFolderPath}`,
        bodyLines: [fullFilePath],
      });
    } else {
      output.error({
        title: `Please specify a filename with either .json or .html extension.`,
        bodyLines: [`You provided --file=${args.file}`],
      });
      process.exit(1);
    }
    process.exit(0);
  } else {
    const environmentJs = buildEnvironmentJs(
      args.exclude || [],
      args.watch,
      !!args.file && args.file.endsWith('html') ? 'build' : 'serve'
    );

    const { app, url } = await startServer(
      html,
      environmentJs,
      args.host || '127.0.0.1',
      args.port || 4211,
      args.watch,
      affectedProjects,
      args.focus,
      args.groupByFolder,
      args.exclude
    );

    url.pathname = args.view;

    if (args.focus) {
      url.pathname += '/' + args.focus;
    }

    if (target) {
      url.pathname += '/' + target;
    }
    if (args.all) {
      url.pathname += '/all';
    } else if (args.projects) {
      url.searchParams.append(
        'projects',
        args.projects.map((projectName) => projectName).join(' ')
      );
    } else if (args.affected) {
      url.pathname += '/affected';
    }
    if (args.groupByFolder) {
      url.searchParams.append('groupByFolder', 'true');
    }

    output.success({
      title: `Project graph started at ${url.toString()}`,
    });

    if (args.open) {
      open(url.toString());
    }

    return new Promise((res) => {
      app.once('close', res);
    });
  }
}

async function startServer(
  html: string,
  environmentJs: string,
  host: string,
  port = 4211,
  watchForchanges = false,
  affected: string[] = [],
  focus: string = null,
  groupByFolder: boolean = false,
  exclude: string[] = []
) {
  let unregisterFileWatcher: (() => void) | undefined;
  if (watchForchanges) {
    unregisterFileWatcher = await createFileWatcher();
  }

  currentDepGraphClientResponse = await createDepGraphClientResponse(affected);
  currentDepGraphClientResponse.focus = focus;
  currentDepGraphClientResponse.groupByFolder = groupByFolder;
  currentDepGraphClientResponse.exclude = exclude;

  const app = http.createServer(async (req, res) => {
    // parse URL
    const parsedUrl = new URL(req.url, `http://${host}:${port}`);
    // extract URL path
    // Avoid https://en.wikipedia.org/wiki/Directory_traversal_attack
    // e.g curl --path-as-is http://localhost:9000/../fileInDanger.txt
    // by limiting the path to current directory only

    const sanitizePath = basename(parsedUrl.pathname);
    if (sanitizePath === 'project-graph.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(currentDepGraphClientResponse));
      return;
    }

    if (sanitizePath === 'task-graph.json') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(await createTaskGraphClientResponse()));
      return;
    }

    if (sanitizePath === 'task-inputs.json') {
      performance.mark('task input generation:start');

      const taskId = parsedUrl.searchParams.get('taskId');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const inputs = await getExpandedTaskInputs(taskId);
      performance.mark('task input generation:end');

      res.end(JSON.stringify({ [taskId]: inputs }));
      performance.measure(
        'task input generation',
        'task input generation:start',
        'task input generation:end'
      );
      return;
    }

    if (sanitizePath === 'currentHash') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ hash: currentDepGraphClientResponse.hash }));
      return;
    }

    if (sanitizePath === 'environment.js') {
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(environmentJs);
      return;
    }

    let pathname = join(__dirname, '../../core/graph/', sanitizePath);
    // if the file is not found or is a directory, return index.html
    if (!existsSync(pathname) || statSync(pathname).isDirectory()) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
      return;
    }

    try {
      const data = readFileSync(pathname);

      const ext = parse(pathname).ext;
      res.setHeader('Content-type', mimeType[ext] || 'text/plain');
      res.end(data);
    } catch (err) {
      res.statusCode = 500;
      res.end(`Error getting the file: ${err}.`);
    }
  });

  const handleTermination = async (exitCode: number) => {
    if (unregisterFileWatcher) {
      unregisterFileWatcher();
    }
    process.exit(exitCode);
  };
  process.on('SIGINT', () => handleTermination(128 + 2));
  process.on('SIGTERM', () => handleTermination(128 + 15));

  return new Promise<{ app: Server; url: URL }>((res) => {
    app.listen(port, host, () => {
      res({ app, url: new URL(`http://${host}:${port}`) });
    });
  });
}

let currentDepGraphClientResponse: ProjectGraphClientResponse = {
  hash: null,
  projects: [],
  dependencies: {},
  fileMap: {},
  layout: {
    appsDir: '',
    libsDir: '',
  },
  affected: [],
  focus: null,
  groupByFolder: false,
  exclude: [],
};

function debounce(fn: (...args) => void, time: number) {
  let timeout: NodeJS.Timeout;

  return (...args) => {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => fn(...args), time);
  };
}

function createFileWatcher() {
  return daemonClient.registerFileWatcher(
    { watchProjects: 'all', includeGlobalWorkspaceFiles: true },
    debounce(async (error, changes) => {
      if (error === 'closed') {
        output.error({ title: `Watch error: Daemon closed the connection` });
        process.exit(1);
      } else if (error) {
        output.error({ title: `Watch error: ${error?.message ?? 'Unknown'}` });
      } else if (changes !== null && changes.changedFiles.length > 0) {
        output.note({ title: 'Recalculating project graph...' });

        const newGraphClientResponse = await createDepGraphClientResponse();

        if (
          newGraphClientResponse.hash !== currentDepGraphClientResponse.hash
        ) {
          output.note({ title: 'Graph changes updated.' });

          currentDepGraphClientResponse = newGraphClientResponse;
        } else {
          output.note({ title: 'No graph changes found.' });
        }
      }
    }, 500)
  );
}

async function createDepGraphClientResponse(
  affected: string[] = []
): Promise<ProjectGraphClientResponse> {
  performance.mark('project graph watch calculation:start');

  let graph = pruneExternalNodes(
    await createProjectGraphAsync({ exitOnError: true })
  );
  let fileMap = readFileMapCache().fileMap.projectFileMap;
  performance.mark('project graph watch calculation:end');
  performance.mark('project graph response generation:start');

  const layout = workspaceLayout();
  const projects: ProjectGraphProjectNode[] = Object.values(graph.nodes);
  const dependencies = graph.dependencies;

  const hasher = createHash('sha256');
  hasher.update(JSON.stringify({ layout, projects, dependencies }));

  const hash = hasher.digest('hex');

  performance.mark('project graph response generation:end');

  performance.measure(
    'project graph watch calculation',
    'project graph watch calculation:start',
    'project graph watch calculation:end'
  );

  performance.measure(
    'project graph response generation',
    'project graph response generation:start',
    'project graph response generation:end'
  );

  return {
    ...currentDepGraphClientResponse,
    hash,
    layout,
    projects,
    dependencies,
    affected,
    fileMap,
  };
}

async function createTaskGraphClientResponse(
  pruneExternal: boolean = false
): Promise<TaskGraphClientResponse> {
  let graph: ProjectGraph;
  if (pruneExternal) {
    graph = pruneExternalNodes(
      await createProjectGraphAsync({ exitOnError: true })
    );
  } else {
    graph = await createProjectGraphAsync({ exitOnError: true });
  }

  const nxJson = readNxJson();

  performance.mark('task graph generation:start');
  const taskGraphs = getAllTaskGraphsForWorkspace(nxJson, graph);
  performance.mark('task graph generation:end');

  const planner = new HashPlanner(
    workspaceRoot,
    nxJson,
    transformProjectGraphForRust(graph)
  );
  performance.mark('task hash plan generation:start');
  const plans: Record<string, string[]> = {};
  for (const individualTaskGraph of Object.values(taskGraphs.taskGraphs)) {
    for (const task of Object.values(individualTaskGraph.tasks)) {
      if (plans[task.id]) {
        continue;
      }

      plans[task.id] = planner.getPlans([task.id], individualTaskGraph)[
        task.id
      ];
    }
  }
  performance.mark('task hash plan generation:end');

  performance.measure(
    'task graph generation',
    'task graph generation:start',
    'task graph generation:end'
  );

  performance.measure(
    'task hash plan generation',
    'task hash plan generation:start',
    'task hash plan generation:end'
  );

  return {
    ...taskGraphs,
    plans,
  };
}

async function createExpandedTaskInputResponse(
  taskGraphClientResponse: TaskGraphClientResponse,
  depGraphClientResponse: ProjectGraphClientResponse
): Promise<ExpandedTaskInputsReponse> {
  performance.mark('task input static generation:start');

  const allWorkspaceFiles = await allFileData();
  const response: Record<string, Record<string, string[]>> = {};

  Object.entries(taskGraphClientResponse.plans).forEach(([key, inputs]) => {
    const [project] = key.split(':');

    const expandedInputs = expandInputs(
      inputs,
      depGraphClientResponse.projects.find((p) => p.name === project),
      allWorkspaceFiles,
      depGraphClientResponse
    );

    response[key] = expandedInputs;
  });
  performance.mark('task input static generation:end');
  performance.measure(
    'task input static generation',
    'task input static generation:start',
    'task input static generation:end'
  );
  return response;
}

function getAllTaskGraphsForWorkspace(
  nxJson: NxJsonConfiguration,
  projectGraph: ProjectGraph
): {
  taskGraphs: Record<string, TaskGraph>;
  errors: Record<string, string>;
} {
  const defaultDependencyConfigs = mapTargetDefaultsToDependencies(
    nxJson.targetDefaults
  );

  const taskGraphs: Record<string, TaskGraph> = {};
  const taskGraphErrors: Record<string, string> = {};

  // TODO(cammisuli): improve performance here. Cache results or something.
  for (const projectName in projectGraph.nodes) {
    const project = projectGraph.nodes[projectName];
    const targets = Object.keys(project.data.targets ?? {});

    targets.forEach((target) => {
      const taskId = createTaskId(projectName, target);
      try {
        taskGraphs[taskId] = createTaskGraph(
          projectGraph,
          defaultDependencyConfigs,
          [projectName],
          [target],
          undefined,
          {}
        );
      } catch (err) {
        taskGraphs[taskId] = {
          tasks: {},
          dependencies: {},
          roots: [],
        };

        taskGraphErrors[taskId] = err.message;
      }

      const configurations = Object.keys(
        project.data.targets[target]?.configurations || {}
      );

      if (configurations.length > 0) {
        configurations.forEach((configuration) => {
          const taskId = createTaskId(projectName, target, configuration);
          try {
            taskGraphs[taskId] = createTaskGraph(
              projectGraph,
              defaultDependencyConfigs,
              [projectName],
              [target],
              configuration,
              {}
            );
          } catch (err) {
            taskGraphs[taskId] = {
              tasks: {},
              dependencies: {},
              roots: [],
            };

            taskGraphErrors[taskId] = err.message;
          }
        });
      }
    });
  }

  return { taskGraphs, errors: taskGraphErrors };
}

function createTaskId(
  projectId: string,
  targetId: string,
  configurationId?: string
) {
  if (configurationId) {
    return `${projectId}:${targetId}:${configurationId}`;
  } else {
    return `${projectId}:${targetId}`;
  }
}

async function getExpandedTaskInputs(
  taskId: string
): Promise<Record<string, string[]>> {
  const [project] = taskId.split(':');
  const taskGraphResponse = await createTaskGraphClientResponse(false);

  const allWorkspaceFiles = await allFileData();

  const inputs = taskGraphResponse.plans[taskId];
  if (inputs) {
    return expandInputs(
      inputs,
      currentDepGraphClientResponse.projects.find((p) => p.name === project),
      allWorkspaceFiles,
      currentDepGraphClientResponse
    );
  }
  return {};
}

function expandInputs(
  inputs: string[],
  project: ProjectGraphProjectNode,
  allWorkspaceFiles: FileData[],
  depGraphClientResponse: ProjectGraphClientResponse
): Record<string, string[]> {
  const projectNames = depGraphClientResponse.projects.map((p) => p.name);

  const workspaceRootInputs: string[] = [];
  const projectRootInputs: string[] = [];
  const externalInputs: string[] = [];
  const otherInputs: string[] = [];
  inputs.forEach((input) => {
    if (input.startsWith('{workspaceRoot}')) {
      workspaceRootInputs.push(input);
      return;
    }
    const maybeProjectName = input.split(':')[0];
    if (projectNames.includes(maybeProjectName)) {
      projectRootInputs.push(input);
      return;
    }
    if (
      input === 'ProjectConfiguration' ||
      input === 'TsConfig' ||
      input === 'AllExternalDependencies'
    ) {
      otherInputs.push(input);
      return;
    }
    // there shouldn't be any other imports in here, but external ones are always going to have a modifier in front
    if (input.includes(':')) {
      externalInputs.push(input);
      return;
    }
  });

  const workspaceRootsExpanded: string[] = workspaceRootInputs.flatMap(
    (input) => {
      const matches = [];
      const withoutWorkspaceRoot = input.substring(16);
      const matchingFile = allWorkspaceFiles.find(
        (t) => t.file === withoutWorkspaceRoot
      );
      if (matchingFile) {
        matches.push(matchingFile.file);
      } else {
        allWorkspaceFiles
          .filter((f) => minimatch(f.file, withoutWorkspaceRoot))
          .forEach((f) => {
            matches.push(f.file);
          });
      }
      return matches;
    }
  );

  const otherInputsExpanded = otherInputs.map((input) => {
    if (input === 'TsConfig') {
      return relative(workspaceRoot, getRootTsConfigPath());
    }
    if (input === 'ProjectConfiguration') {
      return depGraphClientResponse.fileMap[project.name].find(
        (file) =>
          file.file === `${project.data.root}/project.json` ||
          file.file === `${project.data.root}/package.json`
      ).file;
    }

    return input;
  });

  const projectRootsExpanded = projectRootInputs
    .map((input) => {
      const fileSetProjectName = input.split(':')[0];
      const fileSetProject = depGraphClientResponse.projects.find(
        (p) => p.name === fileSetProjectName
      );
      const fileSets = input.replace(`${fileSetProjectName}:`, '').split(',');

      const projectInputExpanded = {
        [fileSetProject.name]: filterUsingGlobPatterns(
          fileSetProject.data.root,
          depGraphClientResponse.fileMap[fileSetProject.name],
          fileSets
        ).map((f) => f.file),
      };

      return projectInputExpanded;
    })
    .reduce((curr, acc) => {
      for (let key in curr) {
        acc[key] = curr[key];
      }
      return acc;
    }, {});

  return {
    general: [...workspaceRootsExpanded, ...otherInputsExpanded],
    ...projectRootsExpanded,
    external: externalInputs,
  };
}

interface GraphJsonResponse {
  tasks?: TaskGraph;
  graph: ProjectGraph;

  /**
   * @deprecated To see affected projects, use `nx show projects --affected`. This will be removed in Nx 18.
   */
  affectedProjects?: string[];

  /**
   * @deprecated To see affected projects, use `nx show projects --affected`. This will be removed in Nx 18.
   */
  criticalPath?: string[];
}

function createJsonOutput(
  graph: ProjectGraph,
  projects: string[],
  targets?: string[]
): GraphJsonResponse {
  const response: GraphJsonResponse = {
    graph,
  };

  if (targets?.length) {
    const nxJson = readNxJson();

    const defaultDependencyConfigs = mapTargetDefaultsToDependencies(
      nxJson.targetDefaults
    );

    response.tasks = createTaskGraph(
      graph,
      defaultDependencyConfigs,
      projects,
      targets,
      undefined,
      {}
    );
  }

  return response;
}

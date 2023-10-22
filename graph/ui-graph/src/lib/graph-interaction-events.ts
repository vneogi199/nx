import { VirtualElement } from '@floating-ui/react';
import { ProjectNodeDataDefinition } from './util-cytoscape/project-node';
import { TaskNodeDataDefinition } from './util-cytoscape/task-node';
import { ProjectEdgeDataDefinition } from './util-cytoscape';

interface ProjectNodeClickEvent {
  type: 'ProjectNodeClick';
  ref: VirtualElement;
  id: string;
  data: ProjectNodeDataDefinition;
}

interface TaskNodeClickEvent {
  type: 'TaskNodeClick';
  ref: VirtualElement;
  id: string;
  data: TaskNodeDataDefinition;
}

interface EdgeClickEvent {
  type: 'EdgeClick';
  ref: VirtualElement;
  id: string;
  data: ProjectEdgeDataDefinition;
}

interface GraphRegeneratedEvent {
  type: 'GraphRegenerated';
}

interface BackgroundClickEvent {
  type: 'BackgroundClick';
}

interface FileLinkClickEvent {
  type: 'FileLinkClick';
  sourceRoot: string;
  file: string;
}

interface ProjectOpenConfigClickEvent {
  type: 'ProjectOpenConfigClick';
  projectName: string;
}

interface RunTaskClickEvent {
  type: 'RunTaskClick';
  taskId: string;
}

export type GraphInteractionEvents =
  | ProjectNodeClickEvent
  | EdgeClickEvent
  | GraphRegeneratedEvent
  | TaskNodeClickEvent
  | BackgroundClickEvent
  | FileLinkClickEvent
  | ProjectOpenConfigClickEvent
  | RunTaskClickEvent;

import type {MotionAssetType} from './motionTypes';

export type MotionAssetDefinition = {
  type: MotionAssetType;
  path: string;
  label: string;
  category: 'agent' | 'infrastructure' | 'communication';
};

export const MOTION_ASSETS: Record<MotionAssetType, MotionAssetDefinition> = {
  agent: {
    type: 'agent',
    path: 'assets/motion/agent.svg',
    label: 'Agent',
    category: 'agent',
  },
  'message-board': {
    type: 'message-board',
    path: 'assets/motion/message-board.svg',
    label: 'Message board',
    category: 'communication',
  },
  server: {
    type: 'server',
    path: 'assets/motion/server.svg',
    label: 'Server',
    category: 'infrastructure',
  },
  folder: {
    type: 'folder',
    path: 'assets/motion/folder.svg',
    label: 'Folder',
    category: 'infrastructure',
  },
  'agent-ui': {
    type: 'agent-ui',
    path: 'assets/motion/agent-ui.svg',
    label: 'Agent UI',
    category: 'agent',
  },
  'message-board-ui': {
    type: 'message-board-ui',
    path: 'assets/motion/message-board-ui.svg',
    label: 'Message Board UI',
    category: 'communication',
  },
  'server-ui': {
    type: 'server-ui',
    path: 'assets/motion/server-ui.svg',
    label: 'Server UI',
    category: 'infrastructure',
  },
  'task-module-ui': {
    type: 'task-module-ui',
    path: 'assets/motion/task-module-ui.svg',
    label: 'Task Module UI',
    category: 'infrastructure',
  },
  'folder-ui': {
    type: 'folder-ui',
    path: 'assets/motion/folder-ui.svg',
    label: 'Folder UI',
    category: 'infrastructure',
  },
  'experiment-ui': {
    type: 'experiment-ui',
    path: 'assets/motion/experiment-ui.svg',
    label: 'Experiment UI',
    category: 'infrastructure',
  },
};

export const getMotionAsset = (type: MotionAssetType) =>
  MOTION_ASSETS[type];

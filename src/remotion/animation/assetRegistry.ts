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
    path: 'assets/motion/agent-ui.svg',
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
    path: 'assets/motion/artifactory-ui.svg',
    label: 'Artifactory',
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
    path: 'assets/motion/artifactory-ui.svg',
    label: 'Artifactory',
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
  ellipsis: { type: 'ellipsis', path: 'assets/motion/ellipsis.svg', label: 'Ellipsis', category: 'infrastructure' },
  'experiment-ui': {
    type: 'experiment-ui',
    path: 'assets/motion/experiment-ui.svg',
    label: 'Experiment UI',
    category: 'infrastructure',
  },
  'openai-ui': {
    type: 'openai-ui',
    path: 'assets/motion/openai-ui.svg',
    label: 'OpenAI',
    category: 'infrastructure',
  },
  'document-ui': {
    type: 'document-ui',
    path: 'assets/motion/document-ui.svg',
    label: 'Document',
    category: 'communication',
  },
  'message-ui': {
    type: 'message-ui',
    path: 'assets/motion/message-ui.svg',
    label: 'Message',
    category: 'communication',
  },
  'flag-ui': {
    type: 'flag-ui',
    path: 'assets/motion/flag-ui.svg',
    label: 'Flag',
    category: 'infrastructure',
  },
  'idea-ui': {
    type: 'idea-ui',
    path: 'assets/motion/idea-ui.svg',
    label: 'Idea',
    category: 'infrastructure',
  },
  'artifactory-ui': {
    type: 'artifactory-ui',
    path: 'assets/motion/artifactory-ui.svg',
    label: 'Artifactory',
    category: 'infrastructure',
  },
  'internet-ui': {
    type: 'internet-ui',
    path: 'assets/motion/internet-ui.svg',
    label: 'Internet',
    category: 'infrastructure',
  },
};

export const getMotionAsset = (type: MotionAssetType) =>
  MOTION_ASSETS[type];

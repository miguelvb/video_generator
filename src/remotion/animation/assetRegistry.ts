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
  'agent-ui': {
    type: 'agent-ui',
    path: 'assets/motion/agent-ui.svg',
    label: 'Agent UI',
    category: 'agent',
  },
  'task-module-ui': {
    type: 'task-module-ui',
    path: 'assets/motion/task-module-ui.svg',
    label: 'Task Module UI',
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
  'repo-ui': {type: 'repo-ui', path: 'assets/motion/repo-ui.svg', label: 'Repository', category: 'infrastructure'},
  'lock-ui': {type: 'lock-ui', path: 'assets/motion/lock-ui.svg', label: 'Lock', category: 'infrastructure'},
  'key-ui': {type: 'key-ui', path: 'assets/motion/key-ui.svg', label: 'Key', category: 'infrastructure'},
  'cloud-ui': {type: 'cloud-ui', path: 'assets/motion/cloud-ui.svg', label: 'Cloud', category: 'infrastructure'},
  'database-ui': {type: 'database-ui', path: 'assets/motion/database-ui.svg', label: 'Database', category: 'infrastructure'},
  'alarm-ui': {type: 'alarm-ui', path: 'assets/motion/alarm-ui.svg', label: 'Alarm', category: 'infrastructure'},
};

export const getMotionAsset = (type: MotionAssetType) =>
  MOTION_ASSETS[type];

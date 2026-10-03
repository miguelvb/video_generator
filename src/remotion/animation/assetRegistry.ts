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
};

export const getMotionAsset = (type: MotionAssetType) =>
  MOTION_ASSETS[type];

import type {MotionAssetType} from './motionTypes';

export type MotionAssetDefinition = {
  type: MotionAssetType;
  path: string;
};

export const MOTION_ASSETS: Record<MotionAssetType, MotionAssetDefinition> = {
  agent: {
    type: 'agent',
    path: 'assets/motion/agent.svg',
  },
  'message-board': {
    type: 'message-board',
    path: 'assets/motion/message-board.svg',
  },
  server: {
    type: 'server',
    path: 'assets/motion/server.svg',
  },
};

export const getMotionAsset = (type: MotionAssetType) =>
  MOTION_ASSETS[type];

export type MotionAssetType = 'agent' | 'message-board' | 'server' | 'folder' | 'agent-ui' | 'server-ui' | 'message-board-ui' | 'task-module-ui' | 'folder-ui' | 'experiment-ui';

export type MotionNodeState = 'normal' | 'active' | 'success' | 'error';
export type MotionEdgeState = 'normal' | 'active' | 'success' | 'error';

export type MotionStateChange<T extends string> = {
  frame: number;
  state: T;
};

export type MotionPositionChange = {
  startFrame: number;
  durationInFrames: number;
  x: number;
  y: number;
};

export type MotionAction =
  | {
      type: 'appear';
      targetId: string;
      startFrame: number;
      durationInFrames?: number;
    }
  | {
      type: 'move';
      targetId: string;
      startFrame: number;
      durationInFrames: number;
      x: number;
      y: number;
    }
  | {
      type: 'activate' | 'succeed' | 'error';
      targetId: string;
      frame: number;
    }
  | {
      type: 'connect';
      targetId: string;
      startFrame: number;
    }
  | {
      type: 'send';
      targetId: string;
      startFrame: number;
      durationInFrames: number;
    }
  | {
      type: 'focus';
      groupId: string;
      startFrame: number;
      durationInFrames: number;
      zoom: number | 'fit';
    }
  | {
      type: 'set-node-state';
      targetId: string;
      frame: number;
      state: MotionNodeState;
    }
  | {
      type: 'set-edge-state';
      targetId: string;
      frame: number;
      state: MotionEdgeState;
    };

export type MotionNode = {
  id: string;
  x: number;
  y: number;
  size?: number;
  opacity?: number;
  delay?: number;
  asset?: MotionAssetType;
  state?: MotionNodeState;
  stateChanges?: MotionStateChange<MotionNodeState>[];
  positionChanges?: MotionPositionChange[];
};

export type MotionGroup = {
  id: string;
  nodeIds: string[];
  offsetX?: number;
  offsetY?: number;
  delay?: number;
  durationInFrames?: number;
};

export type MotionEdge = {
  id: string;
  from: string;
  to: string;
  delay?: number;
  curvature?: number;
  state?: MotionEdgeState;
  stateChanges?: MotionStateChange<MotionEdgeState>[];
  sendAction?: {startFrame: number; durationInFrames: number};
};

export type MotionCameraFocus = {
  groupId: string;
  zoom: number | 'fit';
  startFrame?: number;
  durationInFrames?: number;
};

export type TwoDMotionEngineProps = {
  nodes: MotionNode[];
  edges: MotionEdge[];
  groups?: MotionGroup[];
  cameraFocus?: MotionCameraFocus;
  durationInFrames: number;
  color?: string;
  actions?: MotionAction[];
  showDebugLabel?: boolean;
  backgroundAsset?: string;
};

export type MotionAssetType = 'agent' | 'message-board' | 'server' | 'folder';

export type MotionNodeState = 'normal' | 'active' | 'success' | 'error';
export type MotionEdgeState = 'normal' | 'active' | 'success' | 'error';

export type MotionStateChange<T extends string> = {
  frame: number;
  state: T;
};

export type MotionNode = {
  id: string;
  x: number;
  y: number;
  size?: number;
  delay?: number;
  asset?: MotionAssetType;
  state?: MotionNodeState;
  stateChanges?: MotionStateChange<MotionNodeState>[];
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
};

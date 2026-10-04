export type MotionAssetType =
  | 'agent'
  | 'agent-ui'
  | 'task-module-ui'
  | 'experiment-ui'
  | 'ellipsis'
  | 'openai-ui'
  | 'document-ui'
  | 'flag-ui'
  | 'idea-ui'
  | 'artifactory-ui'
  | 'internet-ui';

export type MotionNodeState = 'normal' | 'active' | 'success' | 'error';
export type MotionEdgeState = 'normal' | 'active' | 'success' | 'error';

/** Low-level actions consumed by the engine. Frames are local to the scene. */
export type MotionAction =
  | {type: 'appear'; targetId: string; startFrame: number; durationInFrames?: number}
  | {type: 'move'; targetId: string; startFrame: number; durationInFrames: number; x: number; y: number}
  | {type: 'pulse'; targetId: string; startFrame: number; durationInFrames: number}
  | {type: 'fade'; targetId: string; startFrame: number; durationInFrames: number; to: number}
  | {type: 'connect'; targetId: string; startFrame: number}
  | {type: 'send'; targetId: string; startFrame: number; durationInFrames: number}
  | {type: 'set-node-state'; targetId: string; frame: number; state: MotionNodeState}
  | {type: 'set-edge-state'; targetId: string; frame: number; state: MotionEdgeState};

export type MotionNode = {
  id: string;
  x: number;
  y: number;
  size?: number;
  opacity?: number;
  asset?: MotionAssetType;
  label?: string;
  shape?: 'boundary';
  state?: MotionNodeState;
};

export type MotionSend = {startFrame: number; durationInFrames: number};

export type MotionEdge = {
  id: string;
  from: string;
  to: string;
  curvature?: number;
  state?: MotionEdgeState;
  /** Frame at which the line starts drawing. Undefined = present (no draw-on). */
  connectFrame?: number;
  /** Every authored packet on this connection. No entry = no packet. */
  sends?: MotionSend[];
};

/** Groups only define a set of nodes for camera focus; they are never drawn. */
export type MotionGroup = {id: string; nodeIds: string[]};

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
  backgroundAsset?: string;
};

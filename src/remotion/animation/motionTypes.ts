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

export type MotionStateChange<T extends string> = { frame: number; state: T };
export type MotionPositionChange = { startFrame: number; durationInFrames: number; x: number; y: number };

type MotionActionDependency = { afterTargetIds?: string[] };

export type MotionAction =
  | ({ type: 'appear'; targetId: string; startFrame: number; durationInFrames?: number })
  | ({ type: 'move'; targetId: string; startFrame: number; durationInFrames: number; x: number; y: number })
  | ({ type: 'pulse'; targetId: string; startFrame: number; durationInFrames: number })
  | ({ type: 'fade'; targetId: string; startFrame: number; durationInFrames: number; to: number })
  | ({ type: 'activate' | 'succeed' | 'error'; targetId: string; frame: number })
  | ({ type: 'connect'; targetId: string; startFrame: number })
  | ({ type: 'send'; targetId: string; startFrame: number; durationInFrames: number })
  | ({ type: 'focus'; groupId: string; startFrame: number; durationInFrames: number; zoom: number | 'fit' })
  | ({ type: 'set-node-state'; targetId: string; frame: number; state: MotionNodeState })
  | ({ type: 'set-edge-state'; targetId: string; frame: number; state: MotionEdgeState });

export type MotionNode = {
  id: string; x: number; y: number; size?: number; opacity?: number; delay?: number;
  asset?: MotionAssetType; label?: string; state?: MotionNodeState;
  stateChanges?: MotionStateChange<MotionNodeState>[]; positionChanges?: MotionPositionChange[];
};
export type MotionGroup = { id: string; nodeIds: string[]; offsetX?: number; offsetY?: number; delay?: number; durationInFrames?: number };
export type MotionEdge = { id: string; from: string; to: string; delay?: number; curvature?: number; state?: MotionEdgeState; stateChanges?: MotionStateChange<MotionEdgeState>[]; sendAction?: {startFrame:number;durationInFrames:number} };
export type MotionCameraFocus = { groupId: string; zoom: number | 'fit'; startFrame?: number; durationInFrames?: number };

export type TwoDMotionEngineProps = {
  nodes: MotionNode[]; edges: MotionEdge[]; groups?: MotionGroup[]; cameraFocus?: MotionCameraFocus;
  durationInFrames: number; color?: string; actions?: MotionAction[]; showDebugLabel?: boolean; backgroundAsset?: string;
};

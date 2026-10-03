export type MotionAssetType = 'agent' | 'message-board' | 'server' | 'folder';

export type MotionNode = {
  id: string;
  x: number;
  y: number;
  size?: number;
  delay?: number;
  asset?: MotionAssetType;
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
};

export type TwoDMotionEngineProps = {
  nodes: MotionNode[];
  edges: MotionEdge[];
  groups?: MotionGroup[];
  durationInFrames: number;
  color?: string;
};

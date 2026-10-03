export type MotionAssetType = 'agent' | 'message-board' | 'server';

export type MotionNode = {
  id: string;
  x: number;
  y: number;
  size?: number;
  delay?: number;
  asset?: MotionAssetType;
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
  durationInFrames: number;
  color?: string;
};

import type {
  MotionAction,
  MotionAssetType,
  MotionEdge,
  MotionNode,
  TwoDMotionEngineProps,
} from './motionTypes';

export type MotionSceneNode = {
  id: string;
  asset: MotionAssetType;
  x: number;
  y: number;
  size?: number;
};

export type MotionSceneConnection = {
  id: string;
  from: string;
  to: string;
  curvature?: number;
};

export type MotionSceneAction =
  | {type: 'appear'; target: string; at: number; duration?: number}
  | {type: 'move'; target: string; at: number; duration: number; x: number; y: number}
  | {type: 'connect'; target: string; at: number}
  | {type: 'send'; target: string; at: number; duration: number}
  | {type: 'activate'; target: string; at: number}
  | {type: 'succeed'; target: string; at: number}
  | {type: 'error'; target: string; at: number};

export type MotionSceneDefinition = {
  nodes: MotionSceneNode[];
  connections: MotionSceneConnection[];
  actions: MotionSceneAction[];
  durationInFrames: number;
  color?: string;
};

const compileAction = (action: MotionSceneAction): MotionAction => {
  switch (action.type) {
    case 'appear':
      return {
        type: 'appear',
        targetId: action.target,
        startFrame: action.at,
        durationInFrames: action.duration,
      };
    case 'move':
      return {
        type: 'move',
        targetId: action.target,
        startFrame: action.at,
        durationInFrames: action.duration,
        x: action.x,
        y: action.y,
      };
    case 'connect':
      return {
        type: 'connect',
        targetId: action.target,
        startFrame: action.at,
      };
    case 'send':
      return {
        type: 'send',
        targetId: action.target,
        startFrame: action.at,
        durationInFrames: action.duration,
      };
    case 'activate':
      return {
        type: 'set-node-state',
        targetId: action.target,
        frame: action.at,
        state: 'active',
      };
    case 'succeed':
      return {
        type: 'set-node-state',
        targetId: action.target,
        frame: action.at,
        state: 'success',
      };
    case 'error':
      return {
        type: 'set-node-state',
        targetId: action.target,
        frame: action.at,
        state: 'error',
      };
  }
};

export const compileMotionScene = (
  scene: MotionSceneDefinition,
): TwoDMotionEngineProps => {
  const nodes: MotionNode[] = scene.nodes.map((node) => ({
    id: node.id,
    x: node.x,
    y: node.y,
    size: node.size,
    asset: node.asset,
  }));

  const edges: MotionEdge[] = scene.connections.map((connection) => ({
    id: connection.id,
    from: connection.from,
    to: connection.to,
    curvature: connection.curvature,
  }));

  return {
    nodes,
    edges,
    actions: scene.actions.map(compileAction),
    durationInFrames: scene.durationInFrames,
    color: scene.color,
  };
};

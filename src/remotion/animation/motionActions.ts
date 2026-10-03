import type {
  MotionAction,
  MotionEdge,
  MotionNode,
  MotionNodeState,
  MotionEdgeState,
} from './motionTypes';

const stateAt = <T extends string>(
  base: T,
  changes: {frame: number; state: T}[] | undefined,
  frame: number,
): T => {
  let state = base;
  for (const change of changes ?? []) {
    if (frame >= change.frame) state = change.state;
  }
  return state;
};

export const resolveMotionActions = (
  nodes: MotionNode[],
  edges: MotionEdge[],
  actions: MotionAction[] | undefined,
  frame: number,
) => {
  if (!actions || actions.length === 0) {
    return {nodes, edges};
  }

  const moveActions = actions.filter((action) => action.type === 'move');
  const sendActions = actions.filter((action) => action.type === 'send');
  const connectActions = actions.filter((action) => action.type === 'connect');
  const appearActions = actions.filter((action) => action.type === 'appear');

  const resolvedNodes = nodes.map((node) => {
    const moves = moveActions.filter((action) => action.targetId === node.id);
    const appears = appearActions.filter((action) => action.targetId === node.id);
    let x = node.x;
    let y = node.y;

    for (const move of moves) {
      const progress = Math.max(
        0,
        Math.min(
          1,
          (frame - move.startFrame) / Math.max(1, move.durationInFrames),
        ),
      );
      x = x + (move.x - x) * progress;
      y = y + (move.y - y) * progress;
      if (frame >= move.startFrame + move.durationInFrames) {
        x = move.x;
        y = move.y;
      }
    }

    const stateChanges = actions
      .filter(
        (action) =>
          action.type === 'set-node-state' && action.targetId === node.id,
      )
      .map((action) => ({frame: action.frame, state: action.state as MotionNodeState}));

    let opacity = 1;
    if (appears.length > 0) {
      opacity = 0;
      for (const appear of appears) {
        const duration = appear.durationInFrames ?? 24;
        opacity = Math.max(
          opacity,
          Math.max(0, Math.min(1, (frame - appear.startFrame) / Math.max(1, duration))),
        );
      }
    }

    return {
      ...node,
      x,
      y,
      state: stateAt(node.state ?? 'normal', stateChanges, frame),
      opacity,
    };
  });

  const resolvedEdges = edges.map((edge) => {
    const send = sendActions.find((action) => action.targetId === edge.id);
    const connect = connectActions.find((action) => action.targetId === edge.id);
    const stateChanges = actions
      .filter(
        (action) =>
          action.type === 'set-edge-state' && action.targetId === edge.id,
      )
      .map((action) => ({frame: action.frame, state: action.state as MotionEdgeState}));

    return {
      ...edge,
      sendAction: send ? {startFrame: send.startFrame, durationInFrames: send.durationInFrames} : edge.sendAction,
      delay: connect ? connect.startFrame : edge.delay,
      state: stateAt(edge.state ?? 'normal', stateChanges, frame),
    };
  });

  return {nodes: resolvedNodes, edges: resolvedEdges};
};

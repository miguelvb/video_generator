import {moveProgress} from './motionGeometry';
import type {
  MotionAction,
  MotionEdge,
  MotionEdgeState,
  MotionNode,
  MotionNodeState,
} from './motionTypes';

type StateChange<T extends string> = {frame: number; state: T};

const DEFAULT_APPEAR_FRAMES = 24;

const stateAt = <T extends string>(base: T, changes: StateChange<T>[], frame: number): T => {
  let state = base;
  for (const change of [...changes].sort((a, b) => a.frame - b.frame)) {
    if (frame >= change.frame) state = change.state;
  }
  return state;
};

const actionStart = (action: MotionAction): number =>
  action.type === 'set-node-state' || action.type === 'set-edge-state'
    ? action.frame
    : action.startFrame;

const ofType = <K extends MotionAction['type']>(actions: MotionAction[], type: K, targetId: string) =>
  actions
    .filter((a): a is Extract<MotionAction, {type: K}> => a.type === type && a.targetId === targetId)
    .sort((a, b) => actionStart(a) - actionStart(b));

/**
 * Deterministic local action renderer.
 *
 * The storyboard is authoritative: an action starts at the frame authored for
 * the current scene. Nothing happens that was not authored — there is no
 * global scheduler, dependency solver, automatic packet or retiming here.
 */
export const resolveMotionActions = (
  nodes: MotionNode[],
  edges: MotionEdge[],
  actions: MotionAction[] | undefined,
  frame: number,
) => {
  const all = actions ?? [];

  const resolvedNodes = nodes.map((node) => {
    // Moves chain in time order: each one starts from wherever the previous left the node.
    let x = node.x;
    let y = node.y;
    for (const move of ofType(all, 'move', node.id)) {
      const progress = moveProgress(frame, move.startFrame, move.durationInFrames);
      x += (move.x - x) * progress;
      y += (move.y - y) * progress;
    }

    // A node with appear actions is invisible until its first appear.
    let opacity = node.opacity ?? 1;
    const appears = ofType(all, 'appear', node.id);
    if (appears.length) {
      opacity = 0;
      for (const appear of appears) {
        const duration = appear.durationInFrames ?? DEFAULT_APPEAR_FRAMES;
        const progress = duration <= 1
          ? (frame >= appear.startFrame ? 1 : 0)
          : Math.max(0, Math.min(1, (frame - appear.startFrame) / duration));
        opacity = Math.max(opacity, progress);
      }
    }
    for (const fade of ofType(all, 'fade', node.id)) {
      opacity *= 1 + (fade.to - 1) * moveProgress(frame, fade.startFrame, fade.durationInFrames);
    }

    const stateChanges: StateChange<MotionNodeState>[] = [
      ...ofType(all, 'set-node-state', node.id).map((a) => ({frame: a.frame, state: a.state})),
      ...ofType(all, 'pulse', node.id).flatMap((a) => [
        {frame: a.startFrame, state: 'active' as const},
        {frame: a.startFrame + a.durationInFrames, state: 'normal' as const},
      ]),
    ];

    return {...node, x, y, opacity, state: stateAt(node.state ?? 'normal', stateChanges, frame)};
  });

  const resolvedEdges = edges.map((edge) => {
    const connects = ofType(all, 'connect', edge.id);
    const connectFrame = connects.length ? connects[0].startFrame : edge.connectFrame;

    const sends = [
      ...(edge.sends ?? []),
      ...ofType(all, 'send', edge.id).map((a) => ({
        startFrame: a.startFrame,
        durationInFrames: a.durationInFrames,
      })),
    ].sort((a, b) => a.startFrame - b.startFrame);

    const stateChanges: StateChange<MotionEdgeState>[] = ofType(all, 'set-edge-state', edge.id)
      .map((a) => ({frame: a.frame, state: a.state}));

    return {
      ...edge,
      connectFrame,
      sends,
      state: stateAt(edge.state ?? 'normal', stateChanges, frame),
    };
  });

  return {nodes: resolvedNodes, edges: resolvedEdges};
};

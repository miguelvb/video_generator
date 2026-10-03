import {interpolate} from 'remotion';
import type {MotionNode} from './motionTypes';

export const resolveNodePositions = (
  nodes: MotionNode[],
  frame: number,
) => {
  return nodes.map((node) => {
    const changes = node.positionChanges;
    if (!changes || changes.length === 0) return node;

    let x = node.x;
    let y = node.y;

    for (const change of changes) {
      const progress = interpolate(
        frame,
        [change.startFrame, change.startFrame + change.durationInFrames],
        [0, 1],
        {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
      );

      x = x + (change.x - x) * progress;
      y = y + (change.y - y) * progress;

      if (frame >= change.startFrame + change.durationInFrames) {
        x = change.x;
        y = change.y;
      }
    }

    return {...node, x, y};
  });
};

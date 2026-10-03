import type {MotionGroup, MotionNode} from './motionTypes';
import {clamp01} from './motionGeometry';

export const resolveGroupedNodes = (
  nodes: MotionNode[],
  groups: MotionGroup[],
  frame: number,
) => {
  return nodes.map((node) => {
    const group = groups.find((candidate) =>
      candidate.nodeIds.includes(node.id),
    );

    if (!group) return node;

    const progress = clamp01(
      (frame - (group.delay ?? 0)) /
        (group.durationInFrames ?? 24),
    );
    const scale = 0.7 + (1 - 0.7) * progress;
    const minX = Math.min(
      ...nodes
        .filter((candidate) => group.nodeIds.includes(candidate.id))
        .map((candidate) => candidate.x),
    );
    const maxX = Math.max(
      ...nodes
        .filter((candidate) => group.nodeIds.includes(candidate.id))
        .map((candidate) => candidate.x),
    );
    const minY = Math.min(
      ...nodes
        .filter((candidate) => group.nodeIds.includes(candidate.id))
        .map((candidate) => candidate.y),
    );
    const maxY = Math.max(
      ...nodes
        .filter((candidate) => group.nodeIds.includes(candidate.id))
        .map((candidate) => candidate.y),
    );

    const originX = (minX + maxX) / 2;
    const originY = (minY + maxY) / 2;

    return {
      ...node,
      x:
        originX +
        (node.x - originX) * scale +
        (group.offsetX ?? 0) * progress,
      y:
        originY +
        (node.y - originY) * scale +
        (group.offsetY ?? 0) * progress,
      size: (node.size ?? 100) * scale,
    };
  });
};

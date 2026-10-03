import React from 'react';
import {clamp01, getQuadraticControlPoint, getQuadraticPoint} from './motionGeometry';
import type {MotionEdge, MotionNode} from './motionTypes';

export const MotionPacket: React.FC<{
  edge: MotionEdge;
  nodesById: Record<string, MotionNode>;
  frame: number;
  color: string;
}> = ({edge, nodesById, frame, color}) => {
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!from || !to) return null;

  const start = (edge.delay ?? 0) + 30;
  const progress = clamp01((frame - start) / 42);
  if (progress <= 0 || progress >= 1) return null;

  const control = getQuadraticControlPoint(
    from,
    to,
    edge.curvature ?? 0,
  );
  const point = getQuadraticPoint(from, control, to, progress);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${point.x}%`,
        top: `${point.y}%`,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 26px 8px ${color}`,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
};

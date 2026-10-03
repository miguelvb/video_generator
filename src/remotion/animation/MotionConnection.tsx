import React from 'react';
import {interpolate} from 'remotion';
import {
  edgeProgress,
  getQuadraticControlPoint,
} from './motionGeometry';
import type {MotionEdge, MotionNode} from './motionTypes';

export const MotionConnection: React.FC<{
  edge: MotionEdge;
  nodesById: Record<string, MotionNode>;
  frame: number;
  color: string;
}> = ({edge, nodesById, frame, color}) => {
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!from || !to) return null;

  const progress = edgeProgress(frame, edge.delay ?? 0);
  const control = getQuadraticControlPoint(
    from,
    to,
    edge.curvature ?? 0,
  );
  const path = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <g opacity={opacity}>
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="100 100"
        strokeDashoffset={100 * (1 - progress)}
        markerEnd="url(#motion-arrow)"
      />
    </g>
  );
};

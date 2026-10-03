import React from 'react';
import {interpolate} from 'remotion';
import {
  edgeProgress,
  getQuadraticControlPoint,
} from './motionGeometry';
import type {MotionEdge, MotionNode} from './motionTypes';
import {resolveMotionState} from './motionState';

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

  const state = resolveMotionState(edge.state ?? 'normal', edge.stateChanges, frame);
  const stateColor =
    state === 'error'
      ? '#ff0000'
      : state === 'success'
        ? '#008000'
        : state === 'active'
          ? '#ff0000'
          : color;

  const strokeWidth = state === 'active' ? 0.7 : state === 'success' ? 0.65 : 0.45;

  return (
    <g opacity={opacity}>
      {state === 'active' && (
        <path
          d={path}
          fill="none"
          stroke={stateColor}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.16"
        />
      )}
      <path
        d={path}
        fill="none"
        stroke={stateColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        pathLength="100"
        strokeDasharray="100 100"
        strokeDashoffset={100 * (1 - progress)}
      />
    </g>
  );
};

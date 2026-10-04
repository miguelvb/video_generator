import React from 'react';
import {interpolate} from 'remotion';
import {edgeProgress, getQuadraticControlPoint} from './motionGeometry';
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

  // A connection is never more visible than its least visible endpoint, so it
  // fades in with its nodes instead of popping in.
  const endpointOpacity = Math.min(from.opacity ?? 1, to.opacity ?? 1);
  if (endpointOpacity <= 0) return null;

  // With a connect action the line draws on from that frame; without one it
  // is simply present (and follows its endpoints' visibility).
  const progress = edge.connectFrame === undefined ? 1 : edgeProgress(frame, edge.connectFrame);
  const control = getQuadraticControlPoint(from, to, edge.curvature ?? 0);
  const path = `M ${from.x} ${from.y} Q ${control.x} ${control.y} ${to.x} ${to.y}`;
  const opacity = endpointOpacity * interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const state = edge.state ?? 'normal';
  const stateColor =
    state === 'error'
      ? '#ff5b67'
      : state === 'success'
        ? '#8d7cff'
        : state === 'active'
          ? '#39f6ff'
          : color;

  const strokeWidth = state === 'active' ? 0.75 : 0.55;

  return (
    <g opacity={opacity}>
      {state === 'active' && (
        <path
          d={path}
          fill="none"
          stroke="#39f6ff"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.18"
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

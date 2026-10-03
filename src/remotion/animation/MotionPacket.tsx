import React from 'react';
import {clamp01} from './motionGeometry';
import {getQuadraticControlPoint, getQuadraticPoint} from './motionGeometry';
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

  const state = edge.state ?? 'normal';
  const packetColor =
    state === 'error'
      ? '#ff0000'
      : state === 'success'
        ? '#008000'
        : state === 'active'
          ? '#ff0000'
          : color;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${point.x}%`,
        top: `${point.y}%`,
        width: state === 'active' ? 38 : 28,
        height: state === 'active' ? 38 : 28,
        borderRadius: '50%',
        background: packetColor,
        boxShadow: `0 0 26px 8px ${packetColor}`,
        transform: 'translate(-50%, -50%)',
        zIndex: 5,
      }}
    />
  );
};

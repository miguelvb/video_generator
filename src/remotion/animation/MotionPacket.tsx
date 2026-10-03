import React from 'react';
import {clamp01, easeInOutCubic} from './motionGeometry';
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

  const sendAction = edge.sendAction;
  const start = sendAction ? sendAction.startFrame : (edge.delay ?? 0) + 30;
  const duration = sendAction ? sendAction.durationInFrames : 42;
  const rawProgress = clamp01((frame - start) / duration);
  if (rawProgress <= 0 || rawProgress >= 1) return null;

  const progress = easeInOutCubic(rawProgress);
  const edgeFade = Math.min(
    easeInOutCubic(rawProgress * 5),
    easeInOutCubic((1 - rawProgress) * 5),
  );

  const control = getQuadraticControlPoint(from, to, edge.curvature ?? 0);
  const point = getQuadraticPoint(from, control, to, progress);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${point.x}%`,
        top: `${point.y}%`,
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 10px 2px ${color}`,
        transform: 'translate(-50%, -50%)',
        opacity: edgeFade,
        zIndex: 5,
      }}
    />
  );
};

import React from 'react';
import {clamp01, easeInOutCubic} from './motionGeometry';
import {getQuadraticControlPoint, getQuadraticPoint} from './motionGeometry';
import type {MotionEdge, MotionNode} from './motionTypes';
import {resolveMotionState} from './motionState';

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

  const control = getQuadraticControlPoint(
    from,
    to,
    edge.curvature ?? 0,
  );
  const point = getQuadraticPoint(from, control, to, progress);

  const state = resolveMotionState(edge.state ?? 'normal', edge.stateChanges, frame);
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
        width: state === 'active' ? 10 : 8,
        height: state === 'active' ? 10 : 8,
        borderRadius: '50%',
        background: packetColor,
        boxShadow: `0 0 12px 3px ${packetColor}`,
        transform: 'translate(-50%, -50%)',
        opacity: edgeFade,
        zIndex: 5,
      }}
    />
  );
};

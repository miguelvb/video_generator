import React from 'react';
import {clamp01, easeInOutCubic, getQuadraticControlPoint, getQuadraticPoint} from './motionGeometry';
import type {MotionEdge, MotionNode, MotionSend} from './motionTypes';

/**
 * Renders the packets authored with `send` on one connection. A connection
 * without send actions never shows a packet.
 */
export const MotionPacket: React.FC<{
  edge: MotionEdge;
  nodesById: Record<string, MotionNode>;
  frame: number;
  color: string;
}> = ({edge, nodesById, frame, color}) => {
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!from || !to || !edge.sends?.length) return null;
  if ((from.opacity ?? 1) <= 0 || (to.opacity ?? 1) <= 0) return null;

  const control = getQuadraticControlPoint(from, to, edge.curvature ?? 0);

  const renderPacket = (send: MotionSend, index: number) => {
    // A packet cannot leave before its connection has started drawing.
    const start = edge.connectFrame === undefined
      ? send.startFrame
      : Math.max(send.startFrame, edge.connectFrame + 1);
    const rawProgress = clamp01((frame - start) / Math.max(1, send.durationInFrames));
    if (rawProgress <= 0 || rawProgress >= 1) return null;

    const point = getQuadraticPoint(from, control, to, easeInOutCubic(rawProgress));
    const edgeFade = Math.min(
      easeInOutCubic(rawProgress * 5),
      easeInOutCubic((1 - rawProgress) * 5),
    );

    return (
      <div
        key={index}
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

  return <>{edge.sends.map(renderPacket)}</>;
};

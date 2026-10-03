import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {nodeProgress} from './motionGeometry';
import type {MotionNode} from './motionTypes';
import {resolveMotionState} from './motionState';
import {getMotionAsset} from './assetRegistry';

export const MotionAsset: React.FC<{
  node: MotionNode;
  frame: number;
}> = ({node, frame}) => {
  const progress = nodeProgress(frame, node.delay ?? 0);
  const size = node.size ?? 100;
  const scale = interpolate(progress, [0, 1], [0.92, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const state = resolveMotionState(node.state ?? 'normal', node.stateChanges, frame);
  const isAgent = node.asset === 'agent-ui';
  const isBoard = node.asset === 'message-board-ui';
  const stateColor =
    state === 'error'
      ? '#ff5b67'
      : state === 'success'
        ? '#8d7cff'
        : state === 'active'
          ? '#39f6ff'
          : '#39f6ff';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.x}%`,
        top: `${node.y}%`,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: opacity * (node.opacity ?? 1),
        filter: state === 'active' ? `drop-shadow(0 0 12px ${stateColor})` : 'none',
      }}
    >
      {node.asset && (
        <Img
          src={staticFile(getMotionAsset(node.asset).path)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          }}
        />
      )}

      {state === 'active' && (
        <div
          style={{
            position: 'absolute',
            inset: '-5%',
            border: '2px solid rgba(57,246,255,.7)',
            borderRadius: 24,
            boxShadow: '0 0 18px rgba(57,246,255,.35)',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  );
};

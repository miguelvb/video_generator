import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {nodeProgress} from './motionGeometry';
import type {MotionNode} from './motionTypes';
import {getMotionAsset} from './assetRegistry';

const STATE_LABELS = {
  normal: '',
  active: 'ACTIVE',
  success: 'SUCCESS',
  error: 'ERROR',
} as const;

export const MotionAsset: React.FC<{
  node: MotionNode;
  frame: number;
}> = ({node, frame}) => {
  const progress = nodeProgress(frame, node.delay ?? 0);
  const size = node.size ?? 100;
  const scale = interpolate(progress, [0, 1], [0.45, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const pulseStart = (node.delay ?? 0) + 30;
  const cycle = ((frame - pulseStart) % 60 + 60) % 60;
  const pulse = cycle / 60;
  const ringScale = 0.8 + pulse * 1.25;
  const ringOpacity = 0.8 * (1 - pulse);

  const state = node.state ?? 'normal';
  const stateColor =
    state === 'error'
      ? '#ff0000'
      : state === 'success'
        ? '#008000'
        : state === 'active'
          ? '#ff0000'
          : 'transparent';

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.x}%`,
        top: `${node.y}%`,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity,
      }}
    >
      {node.asset === 'agent' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: '7px solid #ff0000',
            borderRadius: '50%',
            opacity: ringOpacity,
            transform: `scale(${ringScale})`,
          }}
        />
      )}
      {node.asset && (
        <Img
          src={staticFile(getMotionAsset(node.asset).path)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
          }}
        />
      )}
      {state !== 'normal' && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '-28px',
            transform: 'translateX(-50%)',
            padding: '4px 8px',
            border: `3px solid ${stateColor}`,
            background: '#fff',
            color: stateColor,
            fontFamily: 'Arial, sans-serif',
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {STATE_LABELS[state]}
        </div>
      )}
    </div>
  );
};

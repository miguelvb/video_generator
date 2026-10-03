import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {nodeProgress} from './motionGeometry';
import type {MotionNode} from './motionTypes';
import {getMotionAsset} from './assetRegistry';

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
    </div>
  );
};

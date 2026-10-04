import React from 'react';
import {Img, interpolate, staticFile, useCurrentFrame} from 'remotion';
import {nodeProgress} from './motionGeometry';
import type {MotionNode} from './motionTypes';
import {resolveMotionState} from './motionState';
import {getMotionAsset} from './assetRegistry';

export const MotionAsset: React.FC<{
  node: MotionNode;
  frame: number;
}> = ({node, frame}) => {
  const currentFrame = useCurrentFrame();
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
  const stateColor =
    state === 'error'
      ? '#ff5b67'
      : state === 'success'
        ? '#8d7cff'
        : '#39f6ff';
  // Only agents may show activity. Message destinations and infrastructure
  // assets never brighten, blink, pulse, or otherwise change on packet arrival.
  const activePhase = ((currentFrame % 24) / 24);
  const activeBrightness = isAgent && state === 'active'
    ? interpolate(activePhase, [0, 0.5, 1], [1, 1.16, 1], {extrapolateLeft:'clamp',extrapolateRight:'clamp'})
    : 1;
  const activeOpacity = isAgent && state === 'active'
    ? interpolate(activePhase, [0, 0.5, 1], [0.82, 1, 0.82], {extrapolateLeft:'clamp',extrapolateRight:'clamp'})
    : 1;

  if (node.shape === 'boundary') {
    const boundaryOpacity = opacity * (node.opacity ?? 1);
    return (
      <div
        style={{
          position: 'absolute',
          left: '10%',
          top: '25%',
          width: '80%',
          height: '50%',
          boxSizing: 'border-box',
          border: '1.5px solid rgba(216,251,255,.62)',
          borderRadius: 10,
          background: 'rgba(216,251,255,.035)',
          opacity: boundaryOpacity,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: `${node.x}%`,
        top: `${node.y}%`,
        width: size,
        height: size,
        transform: `translate(-50%, -50%) scale(${scale})`,
        opacity: opacity * (node.opacity ?? 1) * activeOpacity,
        zIndex: 2,
        filter: isAgent && state === 'active' ? `brightness(${activeBrightness}) drop-shadow(0 0 8px ${stateColor})` : 'none',
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
    </div>
  );
};

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
  const isBoard = node.asset === 'message-board-ui';
  const stateColor =
    state === 'error'
      ? '#ff5b67'
      : state === 'success'
        ? '#8d7cff'
        : '#39f6ff';
  const activePhase = ((currentFrame % 18) / 18);
  const activeBrightness = state === 'active'
    ? interpolate(activePhase, [0, 0.5, 1], [1, 1.22, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
    : 1;
  const activeOpacity = state === 'active'
    ? interpolate(activePhase, [0, 0.5, 1], [0.72, 1, 0.72], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
    : 1;

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
        filter: state === 'active' ? `brightness(${activeBrightness}) drop-shadow(0 0 8px ${stateColor})` : 'none',
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

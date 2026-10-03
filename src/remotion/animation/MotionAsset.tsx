import React from 'react';
import {Img, interpolate, staticFile} from 'remotion';
import {nodeProgress} from './motionGeometry';
import type {MotionNode} from './motionTypes';
import {resolveMotionState} from './motionState';
import {getMotionAsset} from './assetRegistry';

const getNodeLabel = (id: string) => {
  if (id === 'board') return 'SHARED CHANNEL';
  const match = id.match(/^agent-([a-z])$/i);
  return match ? `agent-${match[1].toLowerCase()}` : id;
};

const getNodeIndex = (id: string) => {
  const match = id.match(/^agent-([a-z])$/i);
  return match ? `#00${match[1].toLowerCase().charCodeAt(0) - 96}` : '';
};

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

      {isAgent && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '34%',
            transform: 'translate(-50%, -50%)',
            color: '#d8fbff',
            fontFamily: 'Arial, sans-serif',
            fontSize: Math.max(10, size * 0.105),
            fontWeight: 600,
            letterSpacing: 0.3,
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(57,246,255,.35)',
          }}
        >
          {getNodeLabel(node.id)}
        </div>
      )}

      {isAgent && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '48%',
            transform: 'translateX(-50%)',
            color: '#39f6ff',
            fontFamily: 'Arial, sans-serif',
            fontSize: Math.max(7, size * 0.06),
            fontWeight: 500,
            letterSpacing: 1,
            opacity: 0.7,
          }}
        >
          {getNodeIndex(node.id)}
        </div>
      )}

      {isBoard && (
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '48%',
            transform: 'translate(-50%, -50%)',
            color: '#d8fbff',
            fontFamily: 'Arial, sans-serif',
            fontSize: Math.max(9, size * 0.075),
            fontWeight: 600,
            letterSpacing: 1.5,
            whiteSpace: 'nowrap',
            textShadow: '0 0 8px rgba(57,246,255,.35)',
          }}
        >
          {getNodeLabel(node.id)}
        </div>
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

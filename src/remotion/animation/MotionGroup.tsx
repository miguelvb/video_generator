import React from 'react';
import {interpolate} from 'remotion';
import type {MotionGroup as MotionGroupType, MotionNode} from './motionTypes';

export const MotionGroup: React.FC<{
  group: MotionGroupType;
  nodes: MotionNode[];
  frame: number;
  color: string;
}> = ({group, nodes, frame, color}) => {
  if (nodes.length === 0) return null;

  const progress = interpolate(
    frame,
    [group.delay ?? 0, (group.delay ?? 0) + (group.durationInFrames ?? 24)],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const minX = Math.min(...nodes.map((node) => node.x));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxY = Math.max(...nodes.map((node) => node.y));

  const padding = 7;
  const left = minX - padding;
  const top = minY - padding;
  const width = Math.max(10, maxX - minX + padding * 2);
  const height = Math.max(10, maxY - minY + padding * 2);

  const opacity = interpolate(progress, [0, 1], [0, 1]);
  const scale = interpolate(progress, [0, 1], [0.7, 1]);

  return (
    <div
      style={{
        position: 'absolute',
        left: `${left}%`,
        top: `${top}%`,
        width: `${width}%`,
        height: `${height}%`,
        border: `5px dashed ${color}`,
        borderRadius: 28,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 14,
          top: 10,
          padding: '4px 10px',
          background: color,
          color: '#fff',
          fontFamily: 'Arial, sans-serif',
          fontSize: 16,
          fontWeight: 800,
          letterSpacing: 1,
          borderRadius: 6,
        }}
      >
        GROUP
      </div>
    </div>
  );
};

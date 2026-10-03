import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {MotionAsset} from './MotionAsset';
import {MotionConnection} from './MotionConnection';
import {MotionPacket} from './MotionPacket';
import type {
  MotionEdge,
  MotionNode,
  TwoDMotionEngineProps,
} from './motionTypes';

export type {MotionAssetType, MotionEdge, MotionNode, TwoDMotionEngineProps} from './motionTypes';

export const TwoDMotionEngine: React.FC<TwoDMotionEngineProps> = ({
  nodes,
  edges,
  durationInFrames,
  color = '#ff0000',
}) => {
  const frame = useCurrentFrame();
  const nodesById = Object.fromEntries(
    nodes.map((node) => [node.id, node]),
  );

  void durationInFrames;

  return (
    <AbsoluteFill
      style={{
        background: '#f4efe3',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 45%, rgba(47,111,103,0.08), transparent 55%)',
        }}
      />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
        }}
      >
        <defs>
          <marker
            id="motion-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        </defs>

        {edges.map((edge) => (
          <MotionConnection
            key={edge.id}
            edge={edge}
            nodesById={nodesById}
            frame={frame}
            color={color}
          />
        ))}
      </svg>

      {edges.map((edge) => (
        <MotionPacket
          key={`packet-${edge.id}`}
          edge={edge}
          nodesById={nodesById}
          frame={frame}
          color={color}
        />
      ))}

      {nodes.map((node) => (
        <MotionAsset
          key={node.id}
          node={node}
          frame={frame}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          left: 32,
          top: 28,
          color: '#111',
          fontFamily: 'Arial, sans-serif',
          fontSize: 26,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        MOTION ASSET NETWORK TEST
      </div>
    </AbsoluteFill>
  );
};

export const MotionEngineTest: React.FC = () => {
  const nodes: MotionNode[] = [
    {id: 'agent-a', x: 20, y: 48, size: 150, delay: 0, asset: 'agent'},
    {id: 'server', x: 50, y: 48, size: 180, delay: 15, asset: 'server'},
    {id: 'board', x: 80, y: 48, size: 210, delay: 30, asset: 'message-board'},
    {id: 'agent-b', x: 65, y: 22, size: 130, delay: 45, asset: 'agent'},
    {id: 'agent-c', x: 65, y: 76, size: 130, delay: 60, asset: 'agent'},
    {id: 'folder', x: 50, y: 82, size: 150, delay: 75, asset: 'folder'},
  ];

  const edges: MotionEdge[] = [
    {id: 'a-server', from: 'agent-a', to: 'server', delay: 70, curvature: 8},
    {id: 'server-board', from: 'server', to: 'board', delay: 90, curvature: -10},
    {id: 'board-b', from: 'board', to: 'agent-b', delay: 110, curvature: 12},
    {id: 'board-c', from: 'board', to: 'agent-c', delay: 130, curvature: -12},
  ];

  return (
    <TwoDMotionEngine
      nodes={nodes}
      edges={edges}
      durationInFrames={240}
      color="#ff0000"
    />
  );
};

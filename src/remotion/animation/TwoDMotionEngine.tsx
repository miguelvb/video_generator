import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {MotionAsset} from './MotionAsset';
import {MotionConnection} from './MotionConnection';
import {MotionPacket} from './MotionPacket';
import {MotionGroup} from './MotionGroup';
import {resolveGroupedNodes} from './motionGroups';
import {resolveNodePositions} from './motionPositions';
import {MotionCamera} from './MotionCamera';
import {resolveCameraFocus} from './motionCameraFocus';
import type {
  MotionEdge,
  MotionNode,
  MotionGroup as MotionGroupType,
  TwoDMotionEngineProps,
} from './motionTypes';

export type {MotionAssetType, MotionEdge, MotionGroup, MotionNode, TwoDMotionEngineProps} from './motionTypes';

export const TwoDMotionEngine: React.FC<TwoDMotionEngineProps> = ({
  nodes,
  edges,
  groups,
  cameraFocus,
  durationInFrames,
  color = '#ff0000',
}) => {
  const frame = useCurrentFrame();
  const positionedNodes = resolveNodePositions(nodes, frame);
  const resolvedNodes = resolveGroupedNodes(positionedNodes, groups ?? [], frame);
  const nodesById = Object.fromEntries(
    resolvedNodes.map((node) => [node.id, node]),
  );
  const cameraTarget = resolveCameraFocus(
    cameraFocus,
    groups ?? [],
    resolvedNodes,
  );

  void durationInFrames;

  return (
    <AbsoluteFill
      style={{
        background: '#f4efe3',
        overflow: 'hidden',
      }}
    >
      <MotionCamera
        startTarget={{x: 50, y: 50, scale: 1}}
        target={cameraTarget}
        startFrame={cameraFocus?.startFrame ?? 0}
        durationInFrames={cameraFocus?.durationInFrames ?? 1}
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

      {(groups ?? []).map((group: MotionGroupType) => (
        <MotionGroup
          key={group.id}
          group={group}
          nodes={resolvedNodes.filter((node) => group.nodeIds.includes(node.id))}
          frame={frame}
          color={color}
        />
      ))}

      {edges.map((edge) => (
        <MotionPacket
          key={`packet-${edge.id}`}
          edge={edge}
          nodesById={nodesById}
          frame={frame}
          color={color}
        />
      ))}

      {resolvedNodes.map((node) => (
        <MotionAsset
          key={node.id}
          node={node}
          frame={frame}
        />
      ))}

      </MotionCamera>

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
  const groups: MotionGroupType[] = [
    {
      id: 'network-group',
      nodeIds: ['agent-b', 'agent-c', 'board'],
      offsetX: -5,
      offsetY: 0,
      delay: 150,
      durationInFrames: 45,
    },
  ];

  const nodes: MotionNode[] = [
    {id: 'agent-a', x: 20, y: 48, size: 150, delay: 0, asset: 'agent', positionChanges: [{startFrame: 60, durationInFrames: 45, x: 50, y: 48}]},
    {id: 'server', x: 50, y: 48, size: 180, delay: 15, asset: 'server'},
    {id: 'board', x: 80, y: 48, size: 210, delay: 30, asset: 'message-board', stateChanges: [{frame: 120, state: 'active'}, {frame: 180, state: 'success'}]},
    {id: 'agent-b', x: 65, y: 22, size: 130, delay: 45, asset: 'agent'},
    {id: 'agent-c', x: 65, y: 76, size: 130, delay: 60, asset: 'agent'},
    {id: 'folder', x: 50, y: 82, size: 150, delay: 75, asset: 'folder'},
  ];

  const edges: MotionEdge[] = [
    {id: 'a-server', from: 'agent-a', to: 'server', delay: 70, curvature: 8},
    {id: 'server-board', from: 'server', to: 'board', delay: 90, curvature: -10, state: 'active'},
    {id: 'board-b', from: 'board', to: 'agent-b', delay: 110, curvature: 12},
    {id: 'board-c', from: 'board', to: 'agent-c', delay: 130, curvature: -12},
  ];

  return (
    <TwoDMotionEngine
      nodes={nodes}
      edges={edges}
      groups={groups}
      cameraFocus={{groupId: 'network-group', zoom: 'fit', startFrame: 150, durationInFrames: 45}}
      durationInFrames={240}
      color="#ff0000"
    />
  );
};

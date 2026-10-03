import React from 'react';
import {AbsoluteFill, useCurrentFrame} from 'remotion';
import {MotionAsset} from './MotionAsset';
import {MotionConnection} from './MotionConnection';
import {MotionPacket} from './MotionPacket';
import {MotionGroup} from './MotionGroup';
import {resolveGroupedNodes} from './motionGroups';
import {resolveNodePositions} from './motionPositions';
import {resolveMotionActions} from './motionActions';
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
  actions,
  color = '#ff0000',
}) => {
  const frame = useCurrentFrame();
  const actionResult = resolveMotionActions(nodes, edges, actions, frame);
  const positionedNodes = resolveNodePositions(actionResult.nodes, frame);
  const resolvedNodes = resolveGroupedNodes(positionedNodes, groups ?? [], frame);
  const resolvedEdges = actionResult.edges;
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

        {resolvedEdges.map((edge) => (
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

      {resolvedEdges.map((edge) => (
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
  const nodes: MotionNode[] = [
    {
      id: 'agent-a',
      x: 25,
      y: 50,
      size: 170,
      delay: 0,
      asset: 'agent-ui',
    },
    {
      id: 'server',
      x: 75,
      y: 50,
      size: 190,
      delay: 0,
      asset: 'server-ui',
    },
  ];

  const edges: MotionEdge[] = [
    {
      id: 'agent-server',
      from: 'agent-a',
      to: 'server',
      delay: 0,
      curvature: 0,
    },
  ];

  return (
    <TwoDMotionEngine
      nodes={nodes}
      edges={edges}
      actions={[
        {
          type: 'move',
          targetId: 'agent-a',
          startFrame: 45,
          durationInFrames: 45,
          x: 45,
          y: 50,
        },
        {
          type: 'connect',
          targetId: 'agent-server',
          startFrame: 90,
        },
        {
          type: 'send',
          targetId: 'agent-server',
          startFrame: 105,
          durationInFrames: 42,
        },
        {
          type: 'set-edge-state',
          targetId: 'agent-server',
          frame: 105,
          state: 'active',
        },
        {
          type: 'set-edge-state',
          targetId: 'agent-server',
          frame: 150,
          state: 'success',
        },
        {
          type: 'set-node-state',
          targetId: 'server',
          frame: 150,
          state: 'success',
        },
      ]}
      durationInFrames={210}
      color="#ff0000"
    />
  );
};

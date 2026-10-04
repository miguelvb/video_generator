import React from 'react';
import {AbsoluteFill, staticFile, useCurrentFrame} from 'remotion';
import {MotionAsset} from './MotionAsset';
import {MotionConnection} from './MotionConnection';
import {MotionPacket} from './MotionPacket';
import {resolveMotionActions} from './motionActions';
import {MotionCamera} from './MotionCamera';
import {resolveCameraFocus} from './motionCameraFocus';
import type {TwoDMotionEngineProps} from './motionTypes';

export type {MotionAssetType, MotionEdge, MotionGroup, MotionNode, TwoDMotionEngineProps} from './motionTypes';

export const TwoDMotionEngine: React.FC<TwoDMotionEngineProps> = ({
  nodes,
  edges,
  groups,
  cameraFocus,
  durationInFrames,
  actions,
  backgroundAsset,
  color = '#ff0000',
}) => {
  const frame = useCurrentFrame();
  const {nodes: resolvedNodes, edges: resolvedEdges} = resolveMotionActions(nodes, edges, actions, frame);
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
        background: '#000',
        overflow: 'hidden',
      }}
    >
      {backgroundAsset && (
        <img
          src={staticFile(backgroundAsset)}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
      )}
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

    </AbsoluteFill>
  );
};

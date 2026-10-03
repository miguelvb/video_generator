import React from 'react';
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';

export type MotionAssetType = 'agent' | 'message-board' | 'server';

export type MotionNode = {
  id: string;
  x: number;
  y: number;
  size?: number;
  delay?: number;
  asset?: MotionAssetType;
};

export type MotionEdge = {
  id: string;
  from: string;
  to: string;
  delay?: number;
};

export type TwoDMotionEngineProps = {
  nodes: MotionNode[];
  edges: MotionEdge[];
  durationInFrames: number;
  color?: string;
};

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const nodeProgress = (frame: number, delay: number) =>
  clamp01((frame - delay) / 18);

const edgeProgress = (frame: number, delay: number) =>
  clamp01((frame - delay) / 24);

const assetPath = (asset: MotionAssetType) =>
  staticFile(`assets/motion/${asset}.svg`);

const MotionAsset: React.FC<{
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
          src={assetPath(node.asset)}
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

const Edge: React.FC<{
  edge: MotionEdge;
  nodesById: Record<string, MotionNode>;
  frame: number;
  color: string;
}> = ({edge, nodesById, frame, color}) => {
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!from || !to) return null;

  const progress = edgeProgress(frame, edge.delay ?? 0);
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <line
      x1=`${from.x}%`
      y1=`${from.y}%`
      x2=`${to.x}%`
      y2=`${to.y}%`
      stroke={color}
      strokeWidth="6"
      strokeLinecap="round"
      opacity={opacity}
      strokeDasharray="100 100"
      strokeDashoffset={100 * (1 - progress)}
    />
  );
};

const Packet: React.FC<{
  edge: MotionEdge;
  nodesById: Record<string, MotionNode>;
  frame: number;
  color: string;
}> = ({edge, nodesById, frame, color}) => {
  const from = nodesById[edge.from];
  const to = nodesById[edge.to];
  if (!from || !to) return null;

  const start = (edge.delay ?? 0) + 30;
  const progress = clamp01((frame - start) / 42);
  if (progress <= 0 || progress >= 1) return null;

  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 26px 8px ${color}`,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
};

export const TwoDMotionEngine: React.FC<TwoDMotionEngineProps> = ({
  nodes,
  edges,
  durationInFrames,
  color = '#ff0000',
}) => {
  const frame = useCurrentFrame();
  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));

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
        {edges.map((edge) => (
          <Edge
            key={edge.id}
            edge={edge}
            nodesById={nodesById}
            frame={frame}
            color={color}
          />
        ))}
      </svg>

      {edges.map((edge) => (
        <Packet
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
  ];

  const edges: MotionEdge[] = [
    {id: 'a-server', from: 'agent-a', to: 'server', delay: 70},
    {id: 'server-board', from: 'server', to: 'board', delay: 90},
    {id: 'board-b', from: 'board', to: 'agent-b', delay: 110},
    {id: 'board-c', from: 'board', to: 'agent-c', delay: 130},
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

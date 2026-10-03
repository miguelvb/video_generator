import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

export type MotionNode = {
  id: string;
  x: number;
  y: number;
  size?: number;
  delay?: number;
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
  clamp01((frame - delay) / 12);

const edgeProgress = (frame: number, delay: number) =>
  clamp01((frame - delay) / 18);

const Node: React.FC<{
  node: MotionNode;
  frame: number;
  color: string;
}> = ({node, frame, color}) => {
  const progress = nodeProgress(frame, node.delay ?? 0);
  const size = node.size ?? 56;
  const scale = interpolate(progress, [0, 1], [0.15, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const opacity = interpolate(progress, [0, 1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const pulseStart = (node.delay ?? 0) + 24;
  const pulseCycle = ((frame - pulseStart) % 48 + 48) % 48;
  const pulse = pulseCycle / 48;
  const pulseOpacity = 0.7 * (1 - pulse);
  const pulseScale = 1 + 0.28 * pulse;

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
      {pulseOpacity > 0 && (
        <div
          style={{
            position: 'absolute',
            inset: -18 * pulseScale,
            border: `5px solid ${color}`,
            borderRadius: '50%',
            opacity: pulseOpacity,
          }}
        />
      )}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          border: `4px solid ${color}`,
          boxShadow: `0 0 28px ${color}`,
        }}
      />
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

  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const startX = from.x + nx * 0.0;
  const startY = from.y + ny * 0.0;

  return (
    <line
      x1={`${startX}%`}
      y1={`${startY}%`}
      x2={`${to.x}%`}
      y2={`${to.y}%`}
      stroke={color}
      strokeWidth="7"
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

  const start = (edge.delay ?? 0) + 24;
  const progress = clamp01((frame - start) / 36);
  if (progress <= 0 || progress >= 1) return null;

  const x = from.x + (to.x - from.x) * progress;
  const y = from.y + (to.y - from.y) * progress;

  return (
    <div
      style={{
        position: 'absolute',
        left: `${x}%`,
        top: `${y}%`,
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 24px 8px ${color}`,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
};

export const TwoDMotionEngine: React.FC<TwoDMotionEngineProps> = ({
  nodes,
  edges,
  durationInFrames,
  color = '#ff2020',
}) => {
  const frame = useCurrentFrame();
  const nodesById = Object.fromEntries(nodes.map((node) => [node.id, node]));

  return (
    <AbsoluteFill style={{background: '#111', overflow: 'hidden'}}>
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
        <Node
          key={node.id}
          node={node}
          frame={frame}
          color={color}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          left: 24,
          top: 20,
          padding: '8px 12px',
          border: `3px solid ${color}`,
          color,
          fontFamily: 'Arial, sans-serif',
          fontSize: 18,
          fontWeight: 800,
          letterSpacing: 1,
        }}
      >
        2D MOTION ENGINE TEST
      </div>
    </AbsoluteFill>
  );
};

export const MotionEngineTest: React.FC = () => {
  const nodes: MotionNode[] = [
    {id: 'A', x: 18, y: 48, size: 96, delay: 0},
    {id: 'B', x: 36, y: 25, size: 82, delay: 10},
    {id: 'C', x: 54, y: 50, size: 110, delay: 20},
    {id: 'D', x: 74, y: 25, size: 82, delay: 30},
    {id: 'E', x: 78, y: 72, size: 82, delay: 40},
    {id: 'F', x: 38, y: 75, size: 82, delay: 50},
  ];

  return (
    <TwoDMotionEngine
      nodes={nodes}
      edges={[]}
      durationInFrames={240}
      color="#ff0000"
    />
  );
};

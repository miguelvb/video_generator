import React from 'react';
import {TwoDMotionEngine} from './TwoDMotionEngine';
import type {MotionEdge, MotionNode} from './motionTypes';

export const MotionSceneExample: React.FC = () => {
  const nodes: MotionNode[] = [
    {id: 'agent-a', x: 18, y: 50, size: 150, asset: 'agent-ui'},
    {id: 'server', x: 50, y: 50, size: 180, asset: 'server-ui'},
    {id: 'agent-b', x: 82, y: 28, size: 150, asset: 'agent-ui'},
    {id: 'agent-c', x: 82, y: 72, size: 150, asset: 'agent-ui'},
  ];

  const edges: MotionEdge[] = [
    {id: 'a-server', from: 'agent-a', to: 'server', curvature: 0},
    {id: 'server-b', from: 'server', to: 'agent-b', curvature: -6},
    {id: 'server-c', from: 'server', to: 'agent-c', curvature: 6},
  ];

  return (
    <TwoDMotionEngine
      nodes={nodes}
      edges={edges}
      actions={[
        {type: 'appear', targetId: 'agent-a', startFrame: 0, durationInFrames: 18},
        {type: 'appear', targetId: 'server', startFrame: 18, durationInFrames: 18},
        {type: 'move', targetId: 'agent-a', startFrame: 30, durationInFrames: 36, x: 28, y: 50},
        {type: 'connect', targetId: 'a-server', startFrame: 72},
        {type: 'send', targetId: 'a-server', startFrame: 84, durationInFrames: 48},
        {type: 'set-edge-state', targetId: 'a-server', frame: 84, state: 'active'},

        {type: 'appear', targetId: 'agent-b', startFrame: 132, durationInFrames: 18},
        {type: 'move', targetId: 'agent-b', startFrame: 150, durationInFrames: 36, x: 72, y: 35},
        {type: 'connect', targetId: 'server-b', startFrame: 198},
        {type: 'send', targetId: 'server-b', startFrame: 210, durationInFrames: 48},
        {type: 'set-edge-state', targetId: 'server-b', frame: 210, state: 'active'},

        {type: 'appear', targetId: 'agent-c', startFrame: 252, durationInFrames: 18},
        {type: 'move', targetId: 'agent-c', startFrame: 270, durationInFrames: 36, x: 72, y: 65},
        {type: 'connect', targetId: 'server-c', startFrame: 318},
        {type: 'send', targetId: 'server-c', startFrame: 330, durationInFrames: 48},
        {type: 'set-edge-state', targetId: 'server-c', frame: 330, state: 'active'},
      ]}
      durationInFrames={390}
      color="#39f6ff"
      showDebugLabel={false}
    />
  );
};

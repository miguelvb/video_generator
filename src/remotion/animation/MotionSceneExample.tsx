import React from 'react';
import {TwoDMotionEngine} from './TwoDMotionEngine';
import {compileMotionScene, type MotionSceneDefinition} from './motionScene';

const scene: MotionSceneDefinition = {
  nodes: [
    {id: 'agent-a', asset: 'agent-ui', x: 18, y: 50, size: 150},
    {id: 'server', asset: 'artifactory-ui', x: 50, y: 50, size: 180},
    {id: 'agent-b', asset: 'agent-ui', x: 82, y: 28, size: 150},
    {id: 'agent-c', asset: 'agent-ui', x: 82, y: 72, size: 150},
  ],
  connections: [
    {id: 'a-server', from: 'agent-a', to: 'server'},
    {id: 'server-b', from: 'server', to: 'agent-b', curvature: -6},
    {id: 'server-c', from: 'server', to: 'agent-c', curvature: 6},
  ],
  actions: [
    {type: 'appear', target: 'agent-a', at: 0, duration: 18},
    {type: 'appear', target: 'server', at: 18, duration: 18},
    {type: 'move', target: 'agent-a', at: 30, duration: 36, x: 28, y: 50},
    {type: 'connect', target: 'a-server', at: 72},
    {type: 'send', target: 'a-server', at: 84, duration: 48},
    {type: 'activate', target: 'a-server', at: 84},

    {type: 'appear', target: 'agent-b', at: 132, duration: 18},
    {type: 'move', target: 'agent-b', at: 150, duration: 36, x: 72, y: 35},
    {type: 'connect', target: 'server-b', at: 198},
    {type: 'send', target: 'server-b', at: 210, duration: 48},
    {type: 'activate', target: 'server-b', at: 210},

    {type: 'appear', target: 'agent-c', at: 252, duration: 18},
    {type: 'move', target: 'agent-c', at: 270, duration: 36, x: 72, y: 65},
    {type: 'connect', target: 'server-c', at: 318},
    {type: 'send', target: 'server-c', at: 330, duration: 48},
    {type: 'activate', target: 'server-c', at: 330},
  ],
  durationInFrames: 390,
  color: '#39f6ff',
};

export const MOTION_SCENE_EXAMPLE_FRAMES = scene.durationInFrames;

export const MotionSceneExample: React.FC = () => <TwoDMotionEngine {...compileMotionScene(scene)} />;

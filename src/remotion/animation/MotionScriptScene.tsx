import React from 'react';
import {TwoDMotionEngine} from './TwoDMotionEngine';
import {compileMotionScene, type MotionSceneDefinition} from './motionScene';
import {DEMO_COLLECTIVE_MOTION_SCENE} from '../../generated/demoCollectiveMotionScene';

const scene = DEMO_COLLECTIVE_MOTION_SCENE as unknown as MotionSceneDefinition;

export const MotionScriptScene: React.FC = () => {
  if (!scene) {
    return null;
  }

  return (
    <TwoDMotionEngine
      {...compileMotionScene(scene)}
      showDebugLabel={false}
    />
  );
};

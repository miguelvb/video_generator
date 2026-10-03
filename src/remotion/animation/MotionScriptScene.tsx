import React from 'react';
import {TwoDMotionEngine} from './TwoDMotionEngine';
import {compileMotionScene, type MotionSceneDefinition} from './motionScene';
import {MOTION_SCENES} from '../../generated/motionScenes';

const scene = MOTION_SCENES['001'] as unknown as MotionSceneDefinition;

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

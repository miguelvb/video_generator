import React from 'react';
import {TwoDMotionEngine} from './TwoDMotionEngine';
import {compileMotionScene, type MotionSceneDefinition} from './motionScene';

type MotionScriptSceneProps = {
  scene: MotionSceneDefinition;
  durationInFrames?: number;
};

export const MotionScriptScene: React.FC<MotionScriptSceneProps> = ({
  scene,
  durationInFrames,
}) => {
  if (!scene) return null;

  return (
    <TwoDMotionEngine
      {...compileMotionScene(scene, durationInFrames)}
    />
  );
};

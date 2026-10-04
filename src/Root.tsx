import React from 'react';
import {Composition} from 'remotion';
import {MainVideo, TOTAL_DURATION_FRAMES} from './remotion/MainVideo';
import {VIDEO_CONFIG} from './generated/videoConfig';
import {MotionEngineTest} from './remotion/animation/TwoDMotionEngine';
import {MotionCameraTest} from './remotion/animation/MotionCameraTest';
import {MotionSceneExample} from './remotion/animation/MotionSceneExample';
import {MotionScriptScene} from './remotion/animation/MotionScriptScene';
import type {MotionSceneDefinition} from './remotion/animation/motionScene';
import {DEMO_COLLECTIVE_MOTION_SCENE} from './generated/demoCollectiveMotionScene';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="DemoCollective"
        component={MotionScriptScene}
        defaultProps={{scene: DEMO_COLLECTIVE_MOTION_SCENE as unknown as MotionSceneDefinition}}
        durationInFrames={Number(DEMO_COLLECTIVE_MOTION_SCENE.durationInFrames)}
        fps={Number(VIDEO_CONFIG.fps)}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
      <Composition
        id="MotionSceneExample"
        component={MotionSceneExample}
        durationInFrames={390}
        fps={Number(VIDEO_CONFIG.fps)}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
      <Composition
        id="MotionCameraTest"
        component={MotionCameraTest}
        durationInFrames={180}
        fps={Number(VIDEO_CONFIG.fps)}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
      <Composition
        id="MotionEngineTest"
        component={MotionEngineTest}
        durationInFrames={240}
        fps={Number(VIDEO_CONFIG.fps)}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={TOTAL_DURATION_FRAMES}
        fps={Number(VIDEO_CONFIG.fps)}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
    </>
  );
};

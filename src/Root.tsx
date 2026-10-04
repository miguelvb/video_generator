import React from 'react';
import {Composition} from 'remotion';
import {MainVideo, TOTAL_DURATION_FRAMES} from './remotion/MainVideo';
import {VIDEO_CONFIG} from './generated/videoConfig';
import {MotionSceneExample, MOTION_SCENE_EXAMPLE_FRAMES} from './remotion/animation/MotionSceneExample';

const size = {
  fps: Number(VIDEO_CONFIG.fps),
  width: Number(VIDEO_CONFIG.width),
  height: Number(VIDEO_CONFIG.height),
};

export const Root: React.FC = () => (
  <>
    {/* The video described by project/script.md. */}
    <Composition id="MainVideo" component={MainVideo} durationInFrames={TOTAL_DURATION_FRAMES} {...size} />
    {/* A small standalone motion scene for trying out the 2D motion engine in Studio. */}
    <Composition id="MotionSceneExample" component={MotionSceneExample} durationInFrames={MOTION_SCENE_EXAMPLE_FRAMES} {...size} />
  </>
);

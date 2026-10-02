import React from 'react';
import {Composition} from 'remotion';
import {MainVideo, TOTAL_DURATION_FRAMES} from './remotion/MainVideo';
import {VIDEO_CONFIG} from './generated/videoConfig';
import {MotionEngineTest} from './remotion/animation/TwoDMotionEngine';

export const Root: React.FC = () => {
  return (
    <>
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

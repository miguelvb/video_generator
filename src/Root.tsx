import React from 'react';
import {Composition} from 'remotion';
import {MainVideo, TOTAL_DURATION_FRAMES} from './remotion/MainVideo';
import {VIDEO_CONFIG} from './generated/videoConfig';

export const Root: React.FC = () => {
  return (
    <Composition
      id="MainVideo"
      component={MainVideo}
      durationInFrames={TOTAL_DURATION_FRAMES}
      fps={Number(VIDEO_CONFIG.fps)}
      width={Number(VIDEO_CONFIG.width)}
      height={Number(VIDEO_CONFIG.height)}
    />
  );
};

import React from 'react';
import {Audio, Composition, staticFile} from 'remotion';
import {MainVideo, TOTAL_DURATION_FRAMES} from './remotion/MainVideo';
import {VIDEO_CONFIG} from './generated/videoConfig';
import {VIDEO_CONTENT} from './generated/videoContent';
import {AUDIO_TIMINGS} from './generated/audioTimings';
import {MotionEngineTest} from './remotion/animation/TwoDMotionEngine';
import {MotionCameraTest} from './remotion/animation/MotionCameraTest';
import {MotionSceneExample} from './remotion/animation/MotionSceneExample';
import {MotionScriptScene} from './remotion/animation/MotionScriptScene';

const FPS = Number(VIDEO_CONFIG.fps);
const demoScene = (VIDEO_CONTENT.scenes as any[]).find((scene) => String(scene.scene_id) === '001');
const demoTiming = (AUDIO_TIMINGS as Record<string, any>)['001'];
const demoDurationInFrames = Math.max(
  1,
  Math.ceil(Number(
    demoTiming?.durationSeconds ??
      demoTiming?.duration_seconds ??
      demoScene?.motion_scene?.durationInFrames ??
      1,
  ) * FPS),
);

const DemoCollective: React.FC = () => {
  if (!demoScene?.motion_scene) return null;
  return (
    <>
      <MotionScriptScene
        scene={demoScene.motion_scene}
        durationInFrames={demoDurationInFrames}
      />
      {demoTiming?.audioFile && <Audio src={staticFile(demoTiming.audioFile)} />}
    </>
  );
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="DemoCollective"
        component={DemoCollective}
        durationInFrames={demoDurationInFrames}
        fps={FPS}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
      <Composition
        id="MotionSceneExample"
        component={MotionSceneExample}
        durationInFrames={390}
        fps={FPS}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
      <Composition
        id="MotionCameraTest"
        component={MotionCameraTest}
        durationInFrames={180}
        fps={FPS}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
      <Composition
        id="MotionEngineTest"
        component={MotionEngineTest}
        durationInFrames={240}
        fps={FPS}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
      <Composition
        id="MainVideo"
        component={MainVideo}
        durationInFrames={TOTAL_DURATION_FRAMES}
        fps={FPS}
        width={Number(VIDEO_CONFIG.width)}
        height={Number(VIDEO_CONFIG.height)}
      />
    </>
  );
};

import React from 'react';
import {interpolate, useCurrentFrame} from 'remotion';

export type MotionCameraTarget = {
  x: number;
  y: number;
  scale?: number;
};

export type MotionCameraProps = {
  children: React.ReactNode;
  target?: MotionCameraTarget;
  startTarget?: MotionCameraTarget;
  startFrame?: number;
  durationInFrames?: number;
};

export const MotionCamera: React.FC<MotionCameraProps> = ({
  children,
  target = {x: 50, y: 50, scale: 1},
  startTarget = {x: 50, y: 50, scale: 1},
  startFrame = 0,
  durationInFrames = 30,
}) => {
  const frame = useCurrentFrame();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationInFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    },
  );

  const x =
    startTarget.x + (target.x - startTarget.x) * progress;
  const y =
    startTarget.y + (target.y - startTarget.y) * progress;
  const scale =
    (startTarget.scale ?? 1) +
    ((target.scale ?? 1) - (startTarget.scale ?? 1)) * progress;

  // The stage always has the composition dimensions because it is sized
  // with 100vw/100vh by its parent. Translation is expressed in percentages
  // of the stage so the camera does not depend on a hard-coded resolution.
  const translateX = (50 - x) * scale;
  const translateY = (50 - y) * scale;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          transformOrigin: 'center center',
          transform: `translate3d(${translateX}%, ${translateY}%, 0) scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
};

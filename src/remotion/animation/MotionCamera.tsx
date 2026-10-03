import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';

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
  width: number;
  height: number;
};

export const MotionCamera: React.FC<MotionCameraProps> = ({
  children,
  target = {x: 50, y: 50, scale: 1},
  startTarget = {x: 50, y: 50, scale: 1},
  startFrame = 0,
  durationInFrames = 30,
  width,
  height,
}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationInFrames],
    [0, 1],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const x = startTarget.x + (target.x - startTarget.x) * progress;
  const y = startTarget.y + (target.y - startTarget.y) * progress;
  const scale =
    (startTarget.scale ?? 1) +
    ((target.scale ?? 1) - (startTarget.scale ?? 1)) * progress;

  const translateX = width / 2 - (x / 100) * width;
  const translateY = height / 2 - (y / 100) * height;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          width,
          height,
          transform: `translate(${translateX}px, ${translateY}px) scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

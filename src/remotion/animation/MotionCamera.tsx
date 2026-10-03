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

  // Scale around the composition center while keeping the requested point
  // centered in the viewport.
  const translateX = ((50 - x) / 100) * width * scale;
  const translateY = ((50 - y) / 100) * height * scale;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width,
          height,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width,
            height,
            transform: `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

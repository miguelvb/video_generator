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
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );

  const x = startTarget.x + (target.x - startTarget.x) * progress;
  const y = startTarget.y + (target.y - startTarget.y) * progress;
  const scale =
    (startTarget.scale ?? 1) +
    ((target.scale ?? 1) - (startTarget.scale ?? 1)) * progress;

  // Keep the stage exactly the size of the Remotion composition.
  // The camera moves the stage itself; it must never introduce a second
  // fixed-size 1920x1080 canvas inside the preview.
  const translateX = (50 - x) * scale;
  const translateY = (50 - y) * scale;

  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            transform: `translate3d(${translateX}%, ${translateY}%, 0) scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

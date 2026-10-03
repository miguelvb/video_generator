import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MotionCamera} from './MotionCamera';

const Corner: React.FC<{
  label: string;
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
}> = ({label, left, right, top, bottom}) => (
  <div
    style={{
      position: 'absolute',
      left,
      right,
      top,
      bottom,
      padding: '1.2% 1.8%',
      background: '#ff0000',
      color: '#fff',
      fontFamily: 'Arial, sans-serif',
      fontSize: '3vw',
      fontWeight: 900,
    }}
  >
    {label}
  </div>
);

export const MotionCameraTest: React.FC = () => {
  return (
    <AbsoluteFill style={{background: '#111'}}>
      <MotionCamera
        startTarget={{x: 50, y: 50, scale: 1}}
        target={{x: 75, y: 25, scale: 2}}
        startFrame={30}
        durationInFrames={90}
      >
        <AbsoluteFill
          style={{
            background: '#f4efe3',
            border: '2vw solid #ff0000',
            boxSizing: 'border-box',
          }}
        >
          <Corner label="TOP LEFT" left="3%" top="5%" />
          <Corner label="TOP RIGHT" right="3%" top="5%" />
          <Corner label="BOTTOM LEFT" left="3%" bottom="5%" />
          <Corner label="BOTTOM RIGHT" right="3%" bottom="5%" />

          <div
            style={{
              position: 'absolute',
              left: '45%',
              top: '42%',
              width: '10%',
              aspectRatio: '1',
              borderRadius: '50%',
              background: '#ff0000',
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              color: '#111',
              fontFamily: 'Arial, sans-serif',
              fontSize: '5vw',
              fontWeight: 900,
              whiteSpace: 'nowrap',
            }}
          >
            FULL STAGE
          </div>
        </AbsoluteFill>
      </MotionCamera>
    </AbsoluteFill>
  );
};

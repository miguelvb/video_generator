import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MotionCamera} from './MotionCamera';

export const MotionCameraTest: React.FC = () => {
  const width = 1920;
  const height = 1080;

  return (
    <AbsoluteFill style={{background: '#111'}}>
      <MotionCamera
        width={width}
        height={height}
        startTarget={{x: 50, y: 50, scale: 1}}
        target={{x: 80, y: 28, scale: 2.2}}
        startFrame={30}
        durationInFrames={90}
      >
        <AbsoluteFill
          style={{
            background: '#f4efe3',
            border: '18px solid #ff0000',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: '15%',
              top: '35%',
              width: 260,
              height: 260,
              borderRadius: '50%',
              background: '#ff0000',
              boxShadow: '0 0 60px 20px rgba(255,0,0,0.8)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '72%',
              top: '20%',
              width: 360,
              height: 360,
              border: '30px solid #ff0000',
              borderRadius: '50%',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '70%',
              top: '62%',
              width: 180,
              height: 180,
              background: '#ff0000',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 50,
              top: 50,
              color: '#111',
              fontFamily: 'Arial, sans-serif',
              fontSize: 52,
              fontWeight: 900,
            }}
          >
            CAMERA TEST
          </div>
        </AbsoluteFill>
      </MotionCamera>
    </AbsoluteFill>
  );
};

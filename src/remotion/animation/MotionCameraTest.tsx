import React from 'react';
import {AbsoluteFill} from 'remotion';
import {MotionCamera} from './MotionCamera';

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
          <div
            style={{
              position: 'absolute',
              left: '12%',
              top: '30%',
              width: '18%',
              aspectRatio: '1',
              borderRadius: '50%',
              background: '#ff0000',
              boxShadow: '0 0 60px 20px rgba(255,0,0,0.8)',
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: '72%',
              top: '15%',
              width: '20%',
              aspectRatio: '1',
              border: '3vw solid #ff0000',
              borderRadius: '50%',
              boxSizing: 'border-box',
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: '70%',
              top: '62%',
              width: '10%',
              aspectRatio: '1',
              background: '#ff0000',
            }}
          />

          <div
            style={{
              position: 'absolute',
              left: '4%',
              top: '4%',
              color: '#111',
              fontFamily: 'Arial, sans-serif',
              fontSize: '5vw',
              fontWeight: 900,
            }}
          >
            CAMERA TEST
          </div>

          <div
            style={{
              position: 'absolute',
              right: '3%',
              top: '4%',
              padding: '1% 1.5%',
              background: '#ff0000',
              color: '#fff',
              fontFamily: 'Arial, sans-serif',
              fontSize: '2.5vw',
              fontWeight: 900,
            }}
          >
            TARGET
          </div>
        </AbsoluteFill>
      </MotionCamera>
    </AbsoluteFill>
  );
};

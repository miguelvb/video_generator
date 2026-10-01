import React from 'react';
import {
  AbsoluteFill,
  Audio,
  Img,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import {AUDIO_TIMINGS} from '../generated/audioTimings';

const FPS = 30;
const SCENE_001_BASE_SECONDS = 8;
const SCENE_002_BASE_SECONDS = 18;

const scene001Seconds = Math.max(
  SCENE_001_BASE_SECONDS,
  AUDIO_TIMINGS['001'].durationSeconds,
);
const scene002Seconds = Math.max(
  SCENE_002_BASE_SECONDS,
  AUDIO_TIMINGS['002'].durationSeconds,
);

export const TOTAL_DURATION_FRAMES = Math.ceil(
  (scene001Seconds + scene002Seconds) * FPS,
);

const Paper: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill
    style={{
      backgroundColor: '#e8dcc5',
      color: '#34291f',
      overflow: 'hidden',
      fontFamily: 'Georgia, serif',
    }}
  >
    {children}
  </AbsoluteFill>
);

const QuoteOverlay: React.FC<{
  text: string;
  top: number;
  left: number;
  width: number;
}> = ({text, top, left, width}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, 14, 24], [0, 0.95, 0.95, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width,
        padding: '20px 26px',
        background: 'rgba(247,238,218,.90)',
        border: '2px solid rgba(80,60,40,.5)',
        boxShadow: '0 8px 20px rgba(50,35,20,.12)',
        fontFamily: 'Courier New, monospace',
        fontSize: 29,
        lineHeight: 1.25,
        color: '#34291f',
        opacity,
      }}
    >
      &quot;{text}&quot;
    </div>
  );
};

const Scene01: React.FC = () => {
  const frame = useCurrentFrame();
  const durationFrames = Math.ceil(scene001Seconds * FPS);
  const opacity = interpolate(
    frame,
    [0, 20, Math.max(20, durationFrames - 20), durationFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const x = interpolate(frame, [0, durationFrames], [0, -90], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <Paper>
      <Img
        src={staticFile('assets/generated/scene_001.png')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(1.08) translateX(${x}px)`,
          opacity,
        }}
      />
      <Audio src={staticFile(`audio/${AUDIO_TIMINGS['001'].audioFile}`)} />
    </Paper>
  );
};

const Scene02: React.FC = () => {
  const frame = useCurrentFrame();
  const durationFrames = Math.ceil(scene002Seconds * FPS);
  const opacity = interpolate(
    frame,
    [0, 20, Math.max(20, durationFrames - 40), durationFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
  );
  const zoom = interpolate(frame, [0, durationFrames], [1, 1.08], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const quoteSegments = AUDIO_TIMINGS['002'].segments.filter(
    (segment) => segment.language === 'en-US',
  );

  return (
    <Paper>
      <Img
        src={staticFile('assets/generated/scene_002.png')}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: `scale(${zoom})`,
          opacity,
        }}
      />

      <Audio src={staticFile(`audio/${AUDIO_TIMINGS['002'].audioFile}`)} />

      {quoteSegments.map((segment, index) => {
        const start = Math.round(segment.startSeconds * FPS);
        const duration = Math.max(
          1,
          Math.round(segment.durationSeconds * FPS),
        );

        return (
          <Sequence
            key={segment.id}
            from={start}
            durationInFrames={duration}
          >
            <QuoteOverlay
              text={segment.text}
              top={index === 0 ? 630 : 630}
              left={index === 0 ? 980 : 900}
              width={index === 0 ? 760 : 820}
            />
          </Sequence>
        );
      })}
    </Paper>
  );
};

export const MainVideo: React.FC = () => (
  <AbsoluteFill>
    <Sequence from={0} durationInFrames={Math.ceil(scene001Seconds * FPS)}>
      <Scene01 />
    </Sequence>
    <Sequence
      from={Math.ceil(scene001Seconds * FPS)}
      durationInFrames={Math.ceil(scene002Seconds * FPS)}
    >
      <Scene02 />
    </Sequence>
  </AbsoluteFill>
);

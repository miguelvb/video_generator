import React from 'react';
import {AbsoluteFill, Sequence, Audio, Video, staticFile, useCurrentFrame, interpolate, getInputProps} from 'remotion';
import {VIDEO_CONTENT} from '../generated/videoContent';
import {AUDIO_TIMINGS} from '../generated/audioTimings';
import {VIDEO_CONFIG} from '../generated/videoConfig';
import {MotionScriptScene} from './animation/MotionScriptScene';

/*
 * MainVideo is a generic renderer: everything it shows comes from the parsed
 * script (videoContent.ts), the measured narration (audioTimings.ts) and the
 * project config (videoConfig.ts). Nothing here is specific to one video.
 */

type CardConfig = {
  enabled?: string; title?: string; subtitle?: string; background?: string;
  hold_seconds?: string; fade_in_seconds?: string; fade_out_seconds?: string; music_fade_out_seconds?: string;
};
type MusicConfig = {
  enabled?: string; file?: string; volume?: string; ducking?: string; ducking_volume?: string;
  fade_in_seconds?: string; fade_out_seconds?: string;
};
type TimedSegment = {id: string; kind: string; text: string; startSeconds: number; durationSeconds: number};
type SceneTiming = {durationSeconds: number; audioFile: string; segments: TimedSegment[]};
type OnScreenText = {
  text: string; left_percent: number; top_percent: number; width_percent: number;
  start_seconds: number; end_seconds?: number | null; style: string; font_size?: number | null;
};

const FPS = Number(VIDEO_CONFIG.fps);
const props = getInputProps() as {sceneIds?: string[]; music?: MusicConfig; intro?: CardConfig; ending?: CardConfig};
const config = VIDEO_CONFIG as unknown as {music?: MusicConfig; intro?: CardConfig; ending?: CardConfig};
const TIMINGS = AUDIO_TIMINGS as unknown as Record<string, SceneTiming>;

const isTrue = (value: unknown, fallback = false) =>
  value === undefined || value === null || value === '' ? fallback : String(value).toLowerCase() === 'true';
const seconds = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const toFrames = (value: unknown, fallback: number) => Math.max(1, Math.round(seconds(value, fallback) * FPS));
const clampInterp = (frame: number, input: number[], output: number[]) =>
  interpolate(frame, input, output, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});

// ---------------------------------------------------------------- timeline --

const selectedIds = Array.isArray(props.sceneIds) ? new Set(props.sceneIds.map(String)) : null;
const scenes = (VIDEO_CONTENT.scenes as unknown as any[]).filter((scene) => !selectedIds || selectedIds.has(String(scene.scene_id)));

// Scene length is the measured narration length. Without timings (e.g. a fresh
// checkout opened in Studio) a scene falls back to its motion duration or 1s.
const sceneFrames = scenes.map((scene) => {
  const timing = TIMINGS[scene.scene_id];
  if (timing) return Math.max(1, Math.ceil(timing.durationSeconds * FPS));
  if (scene.motion_scene?.durationInFrames) return Math.max(1, Number(scene.motion_scene.durationInFrames));
  return FPS;
});
const SCENE_TOTAL_FRAMES = sceneFrames.reduce((a, b) => a + b, 0);

const intro: CardConfig = props.intro ?? config.intro ?? {};
const ending: CardConfig = props.ending ?? config.ending ?? {};
const music: MusicConfig = props.music ?? config.music ?? {};

const introEnabled = isTrue(intro.enabled);
const introFadeIn = introEnabled ? toFrames(intro.fade_in_seconds, 1.5) : 0;
const introHold = introEnabled ? toFrames(intro.hold_seconds, 4) : 0;
const introFadeOut = introEnabled ? toFrames(intro.fade_out_seconds, 2.5) : 0;
// hold_seconds is the fully visible time; the fades are added around it.
const INTRO_FRAMES = introFadeIn + introHold + introFadeOut;

const endingEnabled = isTrue(ending.enabled);
const ENDING_FRAMES = endingEnabled ? toFrames(ending.hold_seconds, 4) : 0;

export const TOTAL_DURATION_FRAMES = Math.max(1, INTRO_FRAMES + SCENE_TOTAL_FRAMES + ENDING_FRAMES);

const sceneStarts = sceneFrames.map((_, i) => INTRO_FRAMES + sceneFrames.slice(0, i).reduce((a, b) => a + b, 0));
const TRANSITION_FRAMES = Math.max(1, Math.round(FPS));

// ------------------------------------------------------------ scene visual --

const CAMERA_MOVES: Record<string, (p: number) => {x: number; y: number; scale: number}> = {
  static: () => ({x: 0, y: 0, scale: 1.035}),
  push_in: (p) => ({x: 0, y: 0, scale: clampInterp(p, [0, 1], [1.045, 1.13])}),
  pull_out: (p) => ({x: 0, y: 0, scale: clampInterp(p, [0, 1], [1.13, 1.045])}),
  pan_right: (p) => ({x: clampInterp(p, [0, 1], [-18, 18]), y: 0, scale: 1.045}),
  pan_left: (p) => ({x: clampInterp(p, [0, 1], [18, -18]), y: 0, scale: 1.045}),
  pan_down: (p) => ({x: 0, y: clampInterp(p, [0, 1], [-14, 14]), scale: 1.045}),
  diagonal_drift: (p) => ({x: clampInterp(p, [0, 1], [-12, 12]), y: clampInterp(p, [0, 1], [8, -8]), scale: 1.065}),
};

const CameraImage: React.FC<{scene: any; duration: number}> = ({scene, duration}) => {
  const frame = useCurrentFrame();
  const progress = duration <= 1 ? 1 : frame / (duration - 1);
  const mode = String(scene.remotion_camera ?? 'static').trim().toLowerCase();
  const {x, y, scale} = (CAMERA_MOVES[mode] ?? CAMERA_MOVES.static)(progress);
  return (
    <img
      src={staticFile(`assets/generated/scene_${scene.scene_id}.png`)}
      style={{
        position: 'absolute', inset: -36, width: 'calc(100% + 72px)', height: 'calc(100% + 72px)',
        objectFit: 'cover', transform: `translate3d(${x}px,${y}px,0) scale(${scale})`,
      }}
    />
  );
};

const AIClips: React.FC<{scene: any; duration: number}> = ({scene, duration}) => {
  const clips: any[] = Array.isArray(scene.video_clips) ? scene.video_clips : [];
  let offset = 0;
  return (
    <AbsoluteFill>
      {clips.map((clip, index) => {
        if (offset >= duration) return null;
        const clipFrames = Math.max(1, Math.min(duration - offset, Math.round(Number(clip.duration_seconds) * FPS)));
        const from = offset;
        offset += clipFrames;
        return (
          <Sequence key={`${scene.scene_id}-${clip.clip_index ?? index}`} from={from} durationInFrames={clipFrames}>
            <Video
              src={staticFile(String(clip.file).replace(/^public\//, ''))}
              muted
              style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}}
            />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/** One scene's picture: motion scene, AI clips, or the still image with a camera move. */
const SceneVisual: React.FC<{scene: any; duration: number}> = ({scene, duration}) => {
  const frame = useCurrentFrame();
  const fadeIn = scene.transition?.fade_in ? clampInterp(frame, [0, TRANSITION_FRAMES], [0, 1]) : 1;
  const fadeOut = scene.transition?.fade_out
    ? clampInterp(frame, [Math.max(0, duration - TRANSITION_FRAMES), duration], [1, 0])
    : 1;

  let content: React.ReactNode;
  if (scene.motion_scene) content = <MotionScriptScene scene={scene.motion_scene} durationInFrames={duration} />;
  else if (Array.isArray(scene.video_clips) && scene.video_clips.length) content = <AIClips scene={scene} duration={duration} />;
  else content = <CameraImage scene={scene} duration={duration} />;

  return <AbsoluteFill style={{opacity: Math.min(fadeIn, fadeOut)}}>{content}</AbsoluteFill>;
};

// ------------------------------------------------------------- text layers --

/** Text box styles. Motion scenes use a dark technical look; image scenes a paper look. */
const textBoxStyle = (style: string, dark: boolean, fontSize?: number | null): React.CSSProperties => {
  if (style === 'label') {
    return {
      color: dark ? '#d8fbff' : '#2f2a24', fontFamily: 'Arial, sans-serif', fontSize: fontSize ?? 14,
      fontWeight: 600, letterSpacing: 0.4, textAlign: 'center',
      textShadow: dark ? '0 0 8px rgba(57,246,255,.2)' : 'none',
    };
  }
  return dark
    ? {
        padding: '7px 14px 8px', background: 'rgba(5,15,27,.82)', border: '1px solid rgba(57,246,255,.48)',
        borderRadius: 8, boxShadow: '0 0 14px rgba(57,246,255,.12), inset 0 0 18px rgba(57,246,255,.035)',
        fontFamily: 'Arial, sans-serif', fontSize: fontSize ?? 20, fontWeight: 500, lineHeight: 1.28,
        letterSpacing: 0.1, color: '#d8fbff', textAlign: 'center', textShadow: '0 0 8px rgba(57,246,255,.18)',
      }
    : {
        padding: '14px 18px', background: 'rgba(247,238,218,.94)', border: '1px solid rgba(80,60,40,.52)',
        boxShadow: '0 5px 15px rgba(50,35,20,.14)', fontFamily: 'Courier New, monospace', fontSize: fontSize ?? 18,
        lineHeight: 1.3, color: '#2f2a24', textAlign: 'center',
      };
};

/**
 * QUOTE segments appear exactly while they are spoken (no transition, so the
 * text never lags the voice). Position comes from the scene's QUOTE PLACEMENT.
 */
const QuoteSegments: React.FC<{scene: any; duration: number}> = ({scene, duration}) => {
  const dark = Boolean(scene.motion_scene);
  const quotes = (TIMINGS[scene.scene_id]?.segments ?? []).filter((s) => s.kind === 'quote');
  const placement = scene.quote_placement ?? {};
  const position: React.CSSProperties = {
    left: placement.left ?? (dark ? '23%' : 58),
    right: placement.right ?? (dark ? '23%' : 58),
    top: placement.top ?? (dark ? 18 : 'auto'),
    bottom: placement.bottom ?? (dark ? 'auto' : 54),
  };
  return (
    <>
      {quotes.map((quote, index) => {
        const start = Math.round(quote.startSeconds * FPS);
        if (start >= duration) return null;
        const length = Math.min(Math.max(1, Math.round(quote.durationSeconds * FPS)), duration - start);
        return (
          <Sequence key={`${quote.id}-${index}`} from={start} durationInFrames={length}>
            <div style={{position: 'absolute', zIndex: 1000, ...position, ...textBoxStyle('quote', dark)}}>{quote.text}</div>
          </Sequence>
        );
      })}
    </>
  );
};

/** ON SCREEN TEXT items from the script, each in its own box and time window. */
const OnScreenTexts: React.FC<{scene: any; duration: number}> = ({scene, duration}) => {
  const items: OnScreenText[] = Array.isArray(scene.on_screen_text) ? scene.on_screen_text : [];
  const dark = Boolean(scene.motion_scene);
  return (
    <>
      {items.map((item, index) => {
        const start = Math.round(item.start_seconds * FPS);
        const end = item.end_seconds == null ? duration : Math.min(duration, Math.round(item.end_seconds * FPS));
        if (start >= end) return null;
        return (
          <Sequence key={index} from={start} durationInFrames={end - start}>
            <div style={{
              position: 'absolute', zIndex: 1000,
              left: `${item.left_percent}%`, top: `${item.top_percent}%`, width: `${item.width_percent}%`,
              boxSizing: 'border-box', ...textBoxStyle(item.style, dark, item.font_size),
            }}>
              {item.text}
            </div>
          </Sequence>
        );
      })}
    </>
  );
};

// ------------------------------------------------------------------- cards --

const TitleBlock: React.FC<{card: CardConfig}> = ({card}) => (
  <div style={{width: '78%', textAlign: 'center', color: '#f2eadb'}}>
    <div style={{fontFamily: 'Arial, sans-serif', fontSize: 30, fontWeight: 700, letterSpacing: 1.2, lineHeight: 1.18}}>
      {String(card.title ?? '')}
    </div>
    {card.subtitle ? (
      <div style={{marginTop: 18, fontFamily: 'Arial, sans-serif', fontSize: 17, opacity: 0.78, letterSpacing: 0.5}}>
        {String(card.subtitle)}
      </div>
    ) : null}
  </div>
);

/** Background for the intro: an explicit image, else the first scene's still (image scenes only), else dark. */
const introBackground = (): string | null => {
  if (intro.background) return String(intro.background).replace(/^public\//, '');
  const first = scenes[0];
  return first && !first.motion_scene ? `assets/generated/scene_${first.scene_id}.png` : null;
};

const IntroCard: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeOutStart = introFadeIn + introHold;
  const opacity = Math.min(
    clampInterp(frame, [0, introFadeIn], [0, 1]),
    clampInterp(frame, [fadeOutStart, INTRO_FRAMES], [1, 0]),
  );
  const background = introBackground();
  return (
    <AbsoluteFill style={{overflow: 'hidden', background: '#101010'}}>
      {background && (
        <img src={staticFile(background)} style={{position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover'}} />
      )}
      <AbsoluteFill style={{background: 'rgba(16,16,16,.28)', alignItems: 'center', justifyContent: 'center', opacity}}>
        <TitleBlock card={intro} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const EndingCard: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = toFrames(ending.fade_in_seconds, 1.5);
  const fadeOut = toFrames(ending.fade_out_seconds, 2.5);
  const fadeOutStart = Math.max(fadeIn + 1, ENDING_FRAMES - fadeOut);
  const opacity = Math.min(
    clampInterp(frame, [0, fadeIn], [0, 1]),
    clampInterp(frame, [fadeOutStart, ENDING_FRAMES], [1, 0]),
  );
  return (
    <AbsoluteFill style={{background: '#101010', alignItems: 'center', justifyContent: 'center', opacity}}>
      <TitleBlock card={ending} />
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------- music --

/**
 * Looped background music: fades in at the start, fades out at the end, and
 * (when `ducking: true`) drops to `ducking_volume` while narration plays.
 */
const BackgroundMusic: React.FC = () => {
  const frame = useCurrentFrame();
  if (!isTrue(music.enabled)) return null;

  const fullVolume = Math.max(0, Math.min(1, seconds(music.volume, 0.1)));
  const duckedVolume = Math.max(0, Math.min(fullVolume, seconds(music.ducking_volume, 0.045)));
  const duckRamp = Math.round(0.5 * FPS);
  const target = isTrue(music.ducking, true)
    ? interpolate(
        frame,
        [INTRO_FRAMES - duckRamp, INTRO_FRAMES, INTRO_FRAMES + SCENE_TOTAL_FRAMES, INTRO_FRAMES + SCENE_TOTAL_FRAMES + duckRamp],
        [fullVolume, duckedVolume, duckedVolume, fullVolume],
        {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
      )
    : fullVolume;

  const fadeIn = clampInterp(frame, [0, toFrames(music.fade_in_seconds, 2)], [0, 1]);
  const fadeOutFrames = Math.max(toFrames(music.fade_out_seconds, 4), toFrames(ending.music_fade_out_seconds, 4));
  const fadeOut = clampInterp(frame, [TOTAL_DURATION_FRAMES - fadeOutFrames, TOTAL_DURATION_FRAMES], [1, 0]);
  const file = String(music.file ?? 'audio/background_music.mp3').replace(/^public\//, '').replace(/^\//, '');

  return <Audio src={staticFile(file)} loop volume={target * fadeIn * fadeOut} />;
};

// -------------------------------------------------------------- main video --

export const MainVideo: React.FC = () => (
  <AbsoluteFill style={{background: '#000'}}>
    {introEnabled && (
      <Sequence from={0} durationInFrames={INTRO_FRAMES}>
        <IntroCard />
      </Sequence>
    )}

    {scenes.map((scene, index) => {
      const timing = TIMINGS[scene.scene_id];
      return (
        <Sequence key={scene.scene_id} from={sceneStarts[index]} durationInFrames={sceneFrames[index]}>
          <SceneVisual scene={scene} duration={sceneFrames[index]} />
          {timing && <Audio src={staticFile(timing.audioFile)} />}
          <QuoteSegments scene={scene} duration={sceneFrames[index]} />
          <OnScreenTexts scene={scene} duration={sceneFrames[index]} />
        </Sequence>
      );
    })}

    {endingEnabled && (
      <Sequence from={INTRO_FRAMES + SCENE_TOTAL_FRAMES} durationInFrames={ENDING_FRAMES}>
        <EndingCard />
      </Sequence>
    )}

    <BackgroundMusic />
  </AbsoluteFill>
);

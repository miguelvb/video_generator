import React from 'react';
import {AbsoluteFill, Sequence, Audio, Video, staticFile, useCurrentFrame, interpolate, getInputProps} from 'remotion';
import {VIDEO_CONTENT} from '../generated/videoContent';
import {AUDIO_TIMINGS} from '../generated/audioTimings';
import {VIDEO_CONFIG} from '../generated/videoConfig';

const FPS = Number(VIDEO_CONFIG.fps);
const inputProps = getInputProps() as any;
const inputSceneIds = Array.isArray(inputProps?.sceneIds)
  ? new Set(inputProps.sceneIds.map((s:any) => String(s).trim()).filter(Boolean))
  : null;
const scenes = inputSceneIds
  ? VIDEO_CONTENT.scenes.filter((scene:any) => inputSceneIds.has(String(scene.scene_id)))
  : VIDEO_CONTENT.scenes;
const TIMINGS = AUDIO_TIMINGS as Record<string, any>;
const timingKey = (scene:any): string => {
  const raw = String(scene.scene_id ?? '').trim();
  if (TIMINGS[raw]) return raw;
  const padded = raw.replace(/^0+/, '').padStart(3, '0');
  if (TIMINGS[padded]) return padded;
  const numeric = String(Number(raw));
  if (TIMINGS[numeric]) return numeric;
  return raw;
};
const sceneFrames = scenes.map((scene) => {
  const timing = TIMINGS[timingKey(scene)];
  if (!timing) throw new Error(`Missing audio timing for scene ${scene.scene_id}`);
  return Math.max(1, Math.ceil(Number(timing.durationSeconds ?? timing.duration_seconds ?? 1) * FPS));
});
const SCENE_TOTAL_FRAMES = sceneFrames.reduce((a, b) => a + b, 0);

const runtimeMusic = inputProps?.music ?? null;
const runtimeEnding = inputProps?.ending ?? null;
const music = runtimeMusic ?? (VIDEO_CONFIG as any).music ?? {};
const ending = runtimeEnding ?? (VIDEO_CONFIG as any).ending ?? {};
const musicEnabled = String(music.enabled ?? 'false').toLowerCase() === 'true';
const endingEnabled = String(ending.enabled ?? 'true').toLowerCase() === 'true';

// TEMPORARY VISIBLE MUSIC DEBUG:
// This deliberately puts the music state and exact file path on the rendered video.
// Set to false once music playback has been verified.
const SHOW_MUSIC_DEBUG = true;

const endingFrames = endingEnabled
  ? Math.max(1, Math.round(Number(ending.hold_seconds ?? 4) * FPS))
  : 0;

export const TOTAL_DURATION_FRAMES = SCENE_TOTAL_FRAMES + endingFrames;

const CameraImage: React.FC<{scene:any}> = ({scene}) => {
  const frame = useCurrentFrame();
  const duration = Math.max(1, scene.__durationFrames ?? 1);
  const progress = duration <= 1 ? 1 : frame / (duration - 1);
  const mode = String(scene.remotion_camera ?? 'static').trim().toLowerCase();

  let x = 0;
  let y = 0;
  let scale = 1.045;
  switch (mode) {
    case 'push_in':
      scale = interpolate(progress, [0, 1], [1.045, 1.13], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
      break;
    case 'pull_out':
      scale = interpolate(progress, [0, 1], [1.13, 1.045], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
      break;
    case 'pan_right':
      x = interpolate(progress, [0, 1], [-18, 18], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
      break;
    case 'pan_left':
      x = interpolate(progress, [0, 1], [18, -18], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
      break;
    case 'pan_down':
      y = interpolate(progress, [0, 1], [-14, 14], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
      break;
    case 'diagonal_drift':
      x = interpolate(progress, [0, 1], [-12, 12], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
      y = interpolate(progress, [0, 1], [8, -8], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
      scale = 1.065;
      break;
    case 'static':
    default:
      scale = 1.035;
      break;
  }

  return <img
    src={staticFile(`assets/generated/scene_${scene.scene_id}.png`)}
    style={{
      position:'absolute', inset:-36, width:'calc(100% + 72px)', height:'calc(100% + 72px)',
      objectFit:'cover', transform:`translate3d(${x}px,${y}px,0) scale(${scale})`
    }}
  />;
};

const AnimatedAIClip: React.FC<{scene:any; duration:number}> = ({scene, duration}) => {
  const clips = Array.isArray(scene.video_clips) ? scene.video_clips : [];
  if (!clips.length) return <CameraImage scene={{...scene, __durationFrames: duration}} />;
  let offset = 0;
  return <AbsoluteFill>
    {clips.map((clip:any, index:number) => {
      if (offset >= duration) return null;
      const clipFrames = Math.max(1, Math.min(duration - offset, Math.round(Number(clip.duration_seconds) * FPS)));
      const currentOffset = offset;
      offset += clipFrames;
      return <Sequence key={`${scene.scene_id}-${clip.clip_index ?? index}`} from={currentOffset} durationInFrames={clipFrames}>
        <Video
          src={staticFile(clip.file.replace(/^public\//, ''))}
          muted
          style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}}
        />
      </Sequence>;
    })}
  </AbsoluteFill>;
};

const QuoteOverlay: React.FC<{text:string; duration:number}> = ({text, duration}) => {
  const frame=useCurrentFrame();
  const fadeIn=12;
  const fadeOutStart=Math.max(fadeIn+1, duration-18);
  const opacityIn=interpolate(frame,[0,fadeIn],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const opacityOut=interpolate(frame,[fadeOutStart,duration],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const opacity=Math.min(opacityIn,opacityOut);
  return <div style={{
    position:'absolute',left:58,right:58,bottom:54,padding:'14px 18px',
    background:'rgba(247,238,218,.94)',border:'1px solid rgba(80,60,40,.52)',
    boxShadow:'0 5px 15px rgba(50,35,20,.14)',fontFamily:'Courier New, monospace',
    fontSize:18,lineHeight:1.3,color:'#2f2a24',textAlign:'center',opacity
  }}>{`“${text}”`}</div>;
};

const QuoteSegments: React.FC<{scene:any; duration:number}> = ({scene,duration}) => {
  const timings=TIMINGS[scene.scene_id]?.segments ?? [];
  return <>{timings.filter((t:any)=>t.kind==='quote').map((timing:any,index:number)=>{
    const start=Math.round(Number(timing.startSeconds ?? timing.start_seconds ?? 0)*FPS);
    const segDuration=Math.max(1,Math.round(Number(timing.durationSeconds ?? timing.duration_seconds ?? 1)*FPS));
    if (start >= duration) return null;
    return <Sequence key={`${timing.id}-${index}`} from={start} durationInFrames={Math.min(segDuration,duration-start)}>
      <QuoteOverlay text={timing.text} duration={Math.min(segDuration,duration-start)} />
    </Sequence>;
  })}</>;
};

const TRANSITION_FRAMES = Math.max(1, Math.round(0.7 * FPS));

const SceneVisual: React.FC<{scene:any; duration:number; fadeIn:boolean; fadeOut:boolean}> = ({scene,duration,fadeIn,fadeOut}) => {
  const frame = useCurrentFrame();
  const fadeInOpacity = fadeIn
    ? interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
    : 1;
  const fadeOutStart = Math.max(0, duration - TRANSITION_FRAMES);
  const fadeOutOpacity = fadeOut
    ? interpolate(frame, [fadeOutStart, duration], [1, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
    : 1;
  return <AbsoluteFill style={{opacity: Math.min(fadeInOpacity, fadeOutOpacity)}}>
    <AnimatedAIClip scene={{...scene, __durationFrames: duration}} duration={duration}/>
  </AbsoluteFill>;
};

const Scene: React.FC<{scene:any; sceneIndex:number; duration:number; visualDuration:number; contentOffset:number}> = ({scene,sceneIndex,duration,visualDuration,contentOffset}) => {
  const timing = TIMINGS[timingKey(scene)];
  if (!timing?.audioFile) throw new Error(`Missing audio file timing for scene ${scene.scene_id}`);
  return <AbsoluteFill style={{background:'transparent', overflow:'hidden'}}>
    <SceneVisual scene={scene} duration={visualDuration} fadeIn={sceneIndex > 0} fadeOut={sceneIndex < scenes.length - 1} />
    <Sequence from={contentOffset} durationInFrames={duration}>
      <Audio src={staticFile(timing.audioFile)} />
    </Sequence>
    <Sequence from={contentOffset} durationInFrames={duration}>
      <QuoteSegments scene={scene} duration={duration}/>
    </Sequence>
  </AbsoluteFill>;
};

const BackgroundMusic: React.FC = () => {
  const frame = useCurrentFrame();
  const props = getInputProps() as any;
  // Read runtime props inside the component so the Remotion render always uses
  // the configuration passed by orchestrator from project/script.md.
  const music = props?.music ?? (VIDEO_CONFIG as any).music ?? {};
  const ending = props?.ending ?? (VIDEO_CONFIG as any).ending ?? {};
  const enabled = String(music.enabled ?? 'false').toLowerCase() === 'true';
  if (!enabled) return null;

  const maxVolume = Math.max(0, Math.min(1, Number(music.volume ?? 0.10)));
  const duckedVolume = Math.max(0, Math.min(maxVolume, Number(music.ducking_volume ?? 0.045)));
  const fadeInFrames = Math.max(1, Math.round(Number(music.fade_in_seconds ?? 2) * FPS));
  const musicAtFadeIn = interpolate(frame, [0, fadeInFrames], [0, maxVolume], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp'
  });

  const sceneEnd = SCENE_TOTAL_FRAMES;
  const totalFadeFrames = Math.max(
    1,
    Math.round(Math.max(Number(music.fade_out_seconds ?? 4), Number(ending.music_fade_out_seconds ?? 4)) * FPS)
  );
  const totalFadeStart = Math.max(0, TOTAL_DURATION_FRAMES - totalFadeFrames);
  const endingFade = interpolate(frame, [totalFadeStart, TOTAL_DURATION_FRAMES], [1, 0], {
    extrapolateLeft:'clamp', extrapolateRight:'clamp'
  });

  const ducking = String(music.ducking ?? 'true').toLowerCase() === 'true';
  const targetVolume = ducking && frame < sceneEnd ? duckedVolume : maxVolume;
  const volume = Math.max(0, Math.min(musicAtFadeIn, targetVolume) * endingFade);
  const file = String(music.file ?? 'audio/background_music.mp3').replace(/^public\//, '').replace(/^\//, '');

  return <>
    <Audio
      src={staticFile(file)}
      loop
      volume={volume}
    />
    {SHOW_MUSIC_DEBUG && (
      <div style={{
        position:'absolute',
        top:18,
        left:18,
        zIndex:9999,
        padding:'10px 14px',
        background:'rgba(0,0,0,.82)',
        color:'#fff',
        border:'2px solid #fff',
        borderRadius:6,
        fontFamily:'Arial, sans-serif',
        fontSize:16,
        fontWeight:700,
        lineHeight:1.35
      }}>
        ♫ MUSIC: ON<br/>
        FILE: {file}<br/>
        VOLUME: {volume.toFixed(3)}{ducking && frame < sceneEnd ? ' (DUCKED)' : ''}
      </div>
    )}
  </>;
};
};

const EndingCard: React.FC = () => {
  if (!endingEnabled) return null;
  const frame = useCurrentFrame();
  const fadeInFrames = Math.max(1, Math.round(Number(ending.fade_in_seconds ?? 1.5) * FPS));
  const fadeOutFrames = Math.max(1, Math.round(Number(ending.fade_out_seconds ?? 2.5) * FPS));
  const title = String(ending.title ?? '');
  const subtitle = String(ending.subtitle ?? '');

  const opacityIn = interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const fadeOutStart = Math.max(fadeInFrames + 1, endingFrames - fadeOutFrames);
  const opacityOut = interpolate(frame, [fadeOutStart, endingFrames], [1, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const opacity = Math.min(opacityIn, opacityOut);

  return <AbsoluteFill style={{background:'#101010', alignItems:'center', justifyContent:'center', opacity}}>
    <div style={{width:'78%', textAlign:'center', color:'#f2eadb'}}>
      <div style={{fontFamily:'Arial, sans-serif', fontSize:30, fontWeight:700, letterSpacing:1.2, lineHeight:1.18}}>{title}</div>
      {subtitle && <div style={{marginTop:18, fontFamily:'Arial, sans-serif', fontSize:17, opacity:0.78, letterSpacing:0.5}}>{subtitle}</div>}
    </div>
  </AbsoluteFill>;
};

export const MainVideo: React.FC = () => {
  let offset=0;
  return <AbsoluteFill>
    {scenes.map((scene:any,index:number)=>{
      const duration=sceneFrames[index];
      const currentOffset=offset;
      offset+=duration;
      const overlap = index > 0 ? TRANSITION_FRAMES : 0;
      const visualStart = Math.max(0, currentOffset - overlap);
      const visualDuration = duration + overlap;
      return <Sequence key={scene.scene_id} from={visualStart} durationInFrames={visualDuration}>
        <Scene scene={scene} sceneIndex={index} duration={duration} visualDuration={visualDuration} contentOffset={overlap}/>
      </Sequence>;
    })}
    {endingEnabled && <Sequence from={SCENE_TOTAL_FRAMES} durationInFrames={endingFrames}>
      <EndingCard />
    </Sequence>}
    <BackgroundMusic />
  </AbsoluteFill>;
};

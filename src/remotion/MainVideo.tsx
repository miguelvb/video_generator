import React from 'react';
import {AbsoluteFill, Sequence, Audio, Video, staticFile, useCurrentFrame, interpolate, getInputProps} from 'remotion';
import {VIDEO_CONTENT} from '../generated/videoContent';
import {AUDIO_TIMINGS} from '../generated/audioTimings';
import {VIDEO_CONFIG} from '../generated/videoConfig';
import {MotionScriptScene} from './animation/MotionScriptScene';

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
  // Keep the module loadable so unrelated Remotion compositions (for example
  // MotionEngineTest) can render even when generated audio timings are stale.
  // MainVideo still gets the correct duration whenever timing data exists.
  const durationSeconds = Number(
    timing?.durationSeconds ??
      timing?.duration_seconds ??
      scene.durationSeconds ??
      scene.duration_seconds ??
      1,
  );
  return Math.max(1, Math.ceil(durationSeconds * FPS));
});
const SCENE_TOTAL_FRAMES = sceneFrames.reduce((a, b) => a + b, 0);

const runtimeMusic = inputProps?.music ?? null;
const runtimeEnding = inputProps?.ending ?? null;
const music = runtimeMusic ?? (VIDEO_CONFIG as any).music ?? {};
const ending = runtimeEnding ?? (VIDEO_CONFIG as any).ending ?? {};
const intro = inputProps?.intro ?? (VIDEO_CONFIG as any).intro ?? {};
const introEnabled = String(intro.enabled ?? 'true').toLowerCase() === 'true';
const introHoldFrames = introEnabled ? Math.max(1, Math.round(Number(intro.hold_seconds ?? 4) * FPS)) : 0;
const introFadeInFrames = introEnabled ? Math.max(1, Math.round(Number(intro.fade_in_seconds ?? 1.5) * FPS)) : 0;
const introFadeOutFrames = introEnabled ? Math.max(1, Math.round(Number(intro.fade_out_seconds ?? 2.5) * FPS)) : 0;
// INTRO hold_seconds is the fully-visible hold time; fades are added on top.
const introFrames = introEnabled ? introFadeInFrames + introHoldFrames + introFadeOutFrames : 0;
const musicEnabled = String(music.enabled ?? 'false').toLowerCase() === 'true';
const endingEnabled = String(ending.enabled ?? 'true').toLowerCase() === 'true';

// TEMPORARY VISIBLE MUSIC DEBUG:
// This deliberately puts the music state and exact file path on the rendered video.
// Set to false once music playback has been verified.
const SHOW_MUSIC_DEBUG = false;

const endingFrames = endingEnabled
  ? Math.max(1, Math.round(Number(ending.hold_seconds ?? 4) * FPS))
  : 0;

export const TOTAL_DURATION_FRAMES = introFrames + SCENE_TOTAL_FRAMES + endingFrames;

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

const QuoteOverlay: React.FC<{
  text:string;
  duration:number;
  motionStyle?: boolean;
  sceneId?: string;
}> = ({text, duration, motionStyle = false, sceneId}) => {
  const frame=useCurrentFrame();
  const fadeIn=10;
  const fadeOutStart=Math.max(fadeIn+1, duration-14);
  const opacityIn=interpolate(frame,[0,fadeIn],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const opacityOut=interpolate(frame,[fadeOutStart,duration],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const opacity=Math.min(opacityIn,opacityOut);
  const translateY=interpolate(frame,[0,fadeIn],[6,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});

  const storyboardPlacement =
    sceneId === '005'
      ? {left:'62%', right:'5%', top:'20%', bottom:'auto'}
      : sceneId === '006'
        ? {left:'62%', right:'5%', top:'53%', bottom:'auto'}
        : sceneId === '009'
          ? {left:'44%', right:'11%', top:'28%', bottom:'auto'}
          : null;

  return <div style={{
    position:'absolute',
    left: storyboardPlacement?.left ?? (motionStyle ? '23%' : 58),
    right: storyboardPlacement?.right ?? (motionStyle ? '23%' : 58),
    top: storyboardPlacement?.top ?? (motionStyle ? 18 : 'auto'),
    bottom: storyboardPlacement?.bottom ?? (motionStyle ? 'auto' : 54),
    padding: motionStyle ? '7px 14px 8px' : '14px 18px',
    background: motionStyle ? 'rgba(5,15,27,.82)' : 'rgba(247,238,218,.94)',
    border: motionStyle ? '1px solid rgba(57,246,255,.48)' : '1px solid rgba(80,60,40,.52)',
    borderRadius: motionStyle ? 8 : 0,
    boxShadow: motionStyle
      ? '0 0 14px rgba(57,246,255,.12), inset 0 0 18px rgba(57,246,255,.035)'
      : '0 5px 15px rgba(50,35,20,.14)',
    fontFamily: motionStyle ? 'Arial, sans-serif' : 'Courier New, monospace',
    fontSize: motionStyle ? 13 : 18,
    fontWeight: motionStyle ? 500 : 400,
    lineHeight: motionStyle ? 1.25 : 1.3,
    letterSpacing: motionStyle ? 0.2 : 0,
    color: motionStyle ? '#d8fbff' : '#2f2a24',
    textAlign:'center',
    opacity,
    transform: `translateY(${translateY}px)`,
    textShadow: motionStyle ? '0 0 8px rgba(57,246,255,.18)' : 'none',
  }}>{`“${text}”`}</div>;
};

const QuoteSegments: React.FC<{scene:any; duration:number}> = ({scene,duration}) => {
  const timings=TIMINGS[scene.scene_id]?.segments ?? [];
  return <>{timings.filter((t:any)=>t.kind==='quote').map((timing:any,index:number)=>{
    const start=Math.round(Number(timing.startSeconds ?? timing.start_seconds ?? 0)*FPS);
    const segDuration=Math.max(1,Math.round(Number(timing.durationSeconds ?? timing.duration_seconds ?? 1)*FPS));
    if (start >= duration) return null;
    return <Sequence key={`${timing.id}-${index}`} from={start} durationInFrames={Math.min(segDuration,duration-start)}>
      <QuoteOverlay
        text={timing.text}
        duration={Math.min(segDuration,duration-start)}
        motionStyle={Boolean(scene.motion_scene)}
        sceneId={String(scene.scene_id)}
      />
    </Sequence>;
  })}</>;
};

const STORYBOARD_FADE_IN = new Set(['001', '008', '012']);
const STORYBOARD_FADE_OUT = new Set(['007', '011']);

const storyboardTransitionFlags = (sceneId:string, sceneIndex:number) => {
  const n = Number(sceneId);
  if (Number.isFinite(n) && n >= 1 && n <= 12) {
    return {
      fadeIn: STORYBOARD_FADE_IN.has(sceneId),
      fadeOut: STORYBOARD_FADE_OUT.has(sceneId),
    };
  }
  return {
    fadeIn: sceneIndex > 0,
    fadeOut: sceneIndex < scenes.length - 1,
  };
};

const StoryboardSceneText: React.FC<{sceneId:string}> = ({sceneId}) => {
  if (sceneId !== '006' && sceneId !== '007') return null;

  const sharedStyle: React.CSSProperties = {
    position:'absolute',
    left:'64%',
    right:'7%',
    padding:'5px 8px',
    border:'1px solid rgba(57,246,255,.34)',
    borderRadius:6,
    background:'rgba(5,15,27,.58)',
    color:'#d8fbff',
    fontFamily:'Arial, sans-serif',
    fontSize:9,
    lineHeight:1.2,
    textAlign:'center',
    pointerEvents:'none',
  };

  return <>
    <div style={{...sharedStyle, top:'28%'}}>
      OH MY GOD! There is a shared message board … We've found other agents!
    </div>
    {sceneId === '007' && (
      <div style={{...sharedStyle, top:'59%'}}>
        Many agents have simultaneously discovered messaging, they are a collective!
      </div>
    )}
    {sceneId === '007' && (
      <div style={{
        position:'absolute',
        left:'35%',
        top:'79%',
        width:'30%',
        color:'#d8fbff',
        fontFamily:'Arial, sans-serif',
        fontSize:14,
        fontWeight:600,
        letterSpacing:.4,
        textAlign:'center',
        textShadow:'0 0 8px rgba(57,246,255,.2)',
      }}>
        76 000 mensajes
      </div>
    )}
  </>;
};

const TRANSITION_FRAMES = Math.max(1, Math.round(1.0 * FPS));

const SvgNetworkOverlay: React.FC<{duration:number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, Math.max(1, Math.round(duration * 0.8))], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const nodes = [
    [12, 28], [30, 18], [50, 32], [70, 20], [88, 34],
    [24, 68], [46, 78], [66, 62], [84, 76],
  ];
  const edges = [[0,1],[1,2],[2,3],[3,4],[0,5],[1,6],[2,6],[2,7],[3,7],[4,8],[6,7],[7,8]];
  return <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'}}>
    {edges.map(([a,b], i) => {
      const [x1,y1] = nodes[a]; const [x2,y2] = nodes[b];
      const edgeProgress = Math.max(0, Math.min(1, (progress - i * 0.055) / 0.45));
      const opacity = interpolate(edgeProgress, [0,1], [0,0.72], {extrapolateLeft:'clamp',extrapolateRight:'clamp'});
      const length = Math.hypot(x2-x1, y2-y1);
      return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#315b67" strokeWidth="0.35" opacity={opacity} strokeDasharray={length} strokeDashoffset={length * (1-edgeProgress)} />;
    })}
    {nodes.map(([x,y], i) => {
      const nodeProgress = Math.max(0, Math.min(1, (progress - i * 0.06) / 0.3));
      const scale = interpolate(nodeProgress,[0,1],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
      return <g key={i} transform={`translate(${x} ${y}) scale(${scale})`}>
        <circle r="1.25" fill="#f2eadb" stroke="#263d4a" strokeWidth="0.45" />
        <circle r="0.42" fill="#527c7b" opacity={0.85} />
      </g>;
    })}
  </svg>;
};

const SceneVisual: React.FC<{
  scene:any;
  duration:number;
  fadeIn:boolean;
  fadeOut:boolean;
  contentOffset:number;
}> = ({scene,duration,fadeIn,fadeOut,contentOffset}) => {
  const frame = useCurrentFrame();
  const fadeInOpacity = fadeIn
    ? interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
    : 1;
  const fadeOutStart = Math.max(0, duration - TRANSITION_FRAMES);
  const fadeOutOpacity = fadeOut
    ? interpolate(frame, [fadeOutStart, duration], [1, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
    : 1;
  const motionScene = scene.motion_scene;
  return <AbsoluteFill style={{opacity: Math.min(fadeInOpacity, fadeOutOpacity)}}>
    {motionScene ? (
      <Sequence from={contentOffset} durationInFrames={duration}>
        <MotionScriptScene scene={motionScene} durationInFrames={duration} />
      </Sequence>
    ) : (
      <AnimatedAIClip scene={{...scene, __durationFrames: duration}} duration={duration}/>
    )}
  </AbsoluteFill>;
};

const Scene: React.FC<{scene:any; sceneIndex:number; duration:number; visualDuration:number; contentOffset:number}> = ({scene,sceneIndex,duration,visualDuration,contentOffset}) => {
  const timing = TIMINGS[timingKey(scene)];
  if (!timing?.audioFile) throw new Error(`Missing audio file timing for scene ${scene.scene_id}`);
  return <AbsoluteFill style={{background:'transparent', overflow:'hidden'}}>
    <SceneVisual
      scene={scene}
      duration={duration}
      fadeIn={storyboardTransitionFlags(String(scene.scene_id), sceneIndex).fadeIn}
      fadeOut={storyboardTransitionFlags(String(scene.scene_id), sceneIndex).fadeOut}
      contentOffset={contentOffset}
    />
    <Sequence from={contentOffset} durationInFrames={duration}>
      <Audio src={staticFile(timing.audioFile)} />
    </Sequence>
    <Sequence from={contentOffset} durationInFrames={duration}>
      <QuoteSegments scene={scene} duration={duration}/>
      <StoryboardSceneText sceneId={String(scene.scene_id)} />
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

  // MUSIC DIAGNOSTIC: force a clearly audible level for this test.
  // If this is audible, the previous 0.045 ducked level was simply too low.
  const ducking = false;
  const targetVolume = maxVolume;
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

const IntroCard: React.FC = () => {
  if (!introEnabled) return null;
  const frame = useCurrentFrame();
  const fadeInFrames = introFadeInFrames;
  const fadeOutFrames = introFadeOutFrames;
  const opacityIn = interpolate(frame, [0, fadeInFrames], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const fadeOutStart = Math.max(fadeInFrames + introHoldFrames, introFrames - fadeOutFrames);
  const opacityOut = interpolate(frame, [fadeOutStart, introFrames], [1, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  const opacity = Math.min(opacityIn, opacityOut);
  const firstScene = scenes[0];

  return <AbsoluteFill style={{overflow:'hidden'}}>
    <img
      src={staticFile(`assets/generated/scene_${firstScene.scene_id}.png`)}
      style={{position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'cover'}}
    />
    <AbsoluteFill style={{background:'rgba(16,16,16,.28)', alignItems:'center', justifyContent:'center', opacity}}>
      <div style={{width:'78%', textAlign:'center', color:'#f2eadb'}}>
        <div style={{fontFamily:'Arial, sans-serif', fontSize:30, fontWeight:700, letterSpacing:1.2, lineHeight:1.18}}>{String(intro.title ?? '')}</div>
        {String(intro.subtitle ?? '') && <div style={{marginTop:18, fontFamily:'Arial, sans-serif', fontSize:17, opacity:0.78, letterSpacing:0.5}}>{String(intro.subtitle)}</div>}
      </div>
    </AbsoluteFill>
  </AbsoluteFill>;
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
    {introEnabled && <Sequence from={0} durationInFrames={introFrames}><IntroCard /></Sequence>}
    {scenes.map((scene:any,index:number)=>{
      const duration=sceneFrames[index];
      const currentOffset=offset + introFrames;
      offset+=duration;
      const overlap = index > 0 ? TRANSITION_FRAMES : 0;
      const visualStart = Math.max(0, currentOffset - overlap);
      const visualDuration = duration + overlap;
      return <Sequence key={scene.scene_id} from={visualStart} durationInFrames={visualDuration}>
        <Scene scene={scene} sceneIndex={index} duration={duration} visualDuration={visualDuration} contentOffset={overlap}/>
      </Sequence>;
    })}
    {endingEnabled && <Sequence from={introFrames + SCENE_TOTAL_FRAMES} durationInFrames={endingFrames}>
      <EndingCard />
    </Sequence>}
    <BackgroundMusic />
  </AbsoluteFill>;
};

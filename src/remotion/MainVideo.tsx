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

const Scene006Network: React.FC<{duration:number}> = ({duration}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(
    frame,
    [0, Math.max(1, Math.round(duration * 0.9))],
    [0, 1],
    {extrapolateLeft:'clamp', extrapolateRight:'clamp'}
  );

  const nodes = [
    {x:14,y:27,r:1.15}, {x:27,y:15,r:1.0}, {x:42,y:22,r:1.05},
    {x:57,y:14,r:1.0}, {x:74,y:25,r:1.15}, {x:88,y:18,r:0.95},
    {x:19,y:53,r:1.0}, {x:34,y:44,r:1.1}, {x:49,y:51,r:1.0},
    {x:66,y:44,r:1.1}, {x:82,y:55,r:1.0}, {x:91,y:45,r:0.95},
    {x:28,y:78,r:1.0}, {x:45,y:69,r:1.05}, {x:62,y:77,r:1.0},
    {x:77,y:72,r:1.05}
  ];
  const center = {x:50,y:50};
  const edges = [
    [0,1],[1,2],[2,3],[3,4],[4,5],
    [0,6],[1,7],[2,7],[2,8],[3,8],[3,9],[4,9],[4,10],[5,11],
    [6,7],[7,8],[8,9],[9,10],[10,11],
    [6,12],[7,12],[7,13],[8,13],[8,14],[9,14],[9,15],[10,15],
    [12,13],[13,14],[14,15]
  ];

  const connectionProgress = (i:number) =>
    Math.max(0, Math.min(1, (progress - i * 0.025) / 0.34));

  const nodeProgress = (i:number) =>
    Math.max(0, Math.min(1, (progress - i * 0.032) / 0.24));

  const centerProgress = Math.max(0, Math.min(1, (progress - 0.08) / 0.25));

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      style={{
        position:'absolute', inset:0, width:'100%', height:'100%',
        pointerEvents:'none'
      }}
    >
      <g opacity={interpolate(centerProgress,[0,1],[0,0.96],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})}>
        <circle cx={center.x} cy={center.y} r="5.2" fill="#f2eadb" stroke="#263d4a" strokeWidth="0.5" />
        <circle cx={center.x} cy={center.y} r="3.3" fill="none" stroke="#527c7b" strokeWidth="0.7" />
        <circle cx={center.x} cy={center.y} r="1.05" fill="#315b67" />
      </g>

      {edges.map(([a,b], i) => {
        const p = connectionProgress(i);
        const [x1,y1] = [nodes[a].x,nodes[a].y];
        const [x2,y2] = [nodes[b].x,nodes[b].y];
        const length = Math.hypot(x2-x1,y2-y1);
        const opacity = interpolate(p,[0,1],[0,0.55],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
        return (
          <line
            key={`e-${i}`}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#315b67"
            strokeWidth="0.32"
            opacity={opacity}
            strokeDasharray={length}
            strokeDashoffset={length * (1-p)}
          />
        );
      })}

      {nodes.map((node,i) => {
        const p = nodeProgress(i);
        const scale = interpolate(p,[0,1],[0.2,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
        const pulse = 1 + 0.12 * Math.sin((frame + i * 11) / 7);
        return (
          <g key={`n-${i}`} transform={`translate(${node.x} ${node.y}) scale(${scale * pulse})`}>
            <circle r={node.r + 0.75} fill="#f2eadb" opacity="0.82" />
            <circle r={node.r} fill="none" stroke="#263d4a" strokeWidth="0.42" />
            <circle r={node.r * 0.34} fill="#527c7b" opacity="0.9" />
          </g>
        );
      })}

      {nodes.slice(0, 8).map((node,i) => {
        const pulseStart = Math.max(0, progress - 0.25 - i * 0.045);
        const pulse = Math.max(0, Math.min(1, pulseStart / 0.22));
        const x = node.x + (center.x-node.x) * pulse;
        const y = node.y + (center.y-node.y) * pulse;
        return pulse > 0 && pulse < 1 ? (
          <circle
            key={`p-${i}`}
            cx={x} cy={y} r="0.8"
            fill="#527c7b" opacity={0.75}
          />
        ) : null;
      })}
    </svg>
  );
};

const SceneVisual: React.FC<{scene:any; duration:number; fadeIn:boolean; fadeOut:boolean}> = ({scene,duration,fadeIn,fadeOut}) => {
  const frame = useCurrentFrame();
  const fadeInOpacity = fadeIn
    ? interpolate(frame, [0, TRANSITION_FRAMES], [0, 1], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
    : 1;
  const fadeOutStart = Math.max(0, duration - TRANSITION_FRAMES);
  const fadeOutOpacity = fadeOut
    ? interpolate(frame, [fadeOutStart, duration], [1, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'})
    : 1;
  const svgOverlay = String(scene.scene_id) === '006' && String(scene.animation?.engine ?? '').toLowerCase() === 'svg'
    ? <Scene006Network duration={duration}/>
    : null;
  return <AbsoluteFill style={{opacity: Math.min(fadeInOpacity, fadeOutOpacity)}}>
    <AnimatedAIClip scene={{...scene, __durationFrames: duration}} duration={duration}/>
    {svgOverlay}
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

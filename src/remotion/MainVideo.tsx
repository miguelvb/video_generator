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
  // Quotes are narration-synchronised overlays. They must appear exactly when
  // their audio segment starts; do not add a visual transition that shifts
  // the apparent timing of the spoken quote.
  const opacity=1;
  const translateY=0;

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
    zIndex: 30,
    transform: `translateY(${translateY}px)`,
    textShadow: motionStyle ? '0 0 8px rgba(57,246,255,.18)' : 'none',
  }}>{`“${text}”`}</div>;
};

const QuoteSegments: React.FC<{scene:any; duration:number}> = ({scene,duration}) => {
  const timings=TIMINGS[timingKey(scene)]?.segments ?? [];
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
  // Spoken English messages are rendered exclusively by QuoteSegments from
  // the exact audio timing data. This avoids duplicated or late hardcoded text.
  if (sceneId !== '007') return null;

  return <div style={{
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
  </div>;
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

const VisualMotionGroup: React.FC<{scene:any; duration:number; fadeIn:boolean; fadeOut:boolean}> = ({scene,duration,fadeIn,fadeOut}) => {
  const frame=useCurrentFrame();
  const fadeFrames=Math.max(1,Math.round(1.0*FPS));
  const fadeOutStart=Math.max(0,duration-fadeFrames);
  const fadeInOpacity=fadeIn
    ? interpolate(frame,[0,fadeFrames],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})
    : 1;
  const fadeOutOpacity=fadeOut
    ? interpolate(frame,[fadeOutStart,duration],[1,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})
    : 1;
  return <AbsoluteFill style={{opacity:Math.min(fadeInOpacity,fadeOutOpacity)}}>
    <MotionScriptScene scene={scene} durationInFrames={duration}/>
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

type VisualGroup = {
  startIndex:number;
  endIndex:number;
  startFrame:number;
  duration:number;
  fadeIn:boolean;
  fadeOut:boolean;
  motionScene:any;
};

const sameVisualStructure = (a:any,b:any) => {
  if (!a?.motion_scene || !b?.motion_scene) return false;
  const keys = ['nodes','connections','groups','cameraFocus','color','background'];
  return keys.every((key) => JSON.stringify(a.motion_scene?.[key] ?? null) === JSON.stringify(b.motion_scene?.[key] ?? null));
};

const hasStoryboardBoundaryTransition = (prevScene:any, prevIndex:number, nextScene:any, nextIndex:number) => {
  const prevFlags=storyboardTransitionFlags(String(prevScene.scene_id),prevIndex);
  const nextFlags=storyboardTransitionFlags(String(nextScene.scene_id),nextIndex);
  return prevFlags.fadeOut || nextFlags.fadeIn || nextFlags.fadeOut ||
    String(prevScene.continuity ?? '').toLowerCase() === 'transition' ||
    String(nextScene.continuity ?? '').toLowerCase() === 'transition';
};

const scaleMergedAction = (action:any, source:any, actualDuration:number, offset:number) => {
  const authored=Math.max(1,Number(source.motion_scene.durationInFrames ?? actualDuration));
  const scale=actualDuration/authored;
  const at=offset + Math.max(0,Math.round(Number(action.at ?? 0)*scale));
  if (action.type === 'appear' || action.type === 'connect' || action.type === 'activate' ||
      action.type === 'succeed' || action.type === 'error') {
    return {...action,at};
  }
  return {...action,at,duration:Math.max(1,Math.round(Number(action.duration ?? 1)*scale))};
};

const buildVisualGroups = ():VisualGroup[] => {
  const groups:VisualGroup[]=[];
  let i=0;
  let absoluteFrame=0;
  while (i<scenes.length) {
    const startIndex=i;
    let endIndex=i;
    let duration=sceneFrames[i];
    const actions:any[]=[];
    for (const action of (scenes[i].motion_scene?.actions ?? [])) {
      actions.push(scaleMergedAction(action,scenes[i],sceneFrames[i],0));
    }

    while (endIndex+1<scenes.length) {
      const nextIndex=endIndex+1;
      const current=scenes[endIndex];
      const next=scenes[nextIndex];
      if (!sameVisualStructure(current,next) ||
          hasStoryboardBoundaryTransition(current,endIndex,next,nextIndex)) {
        break;
      }
      const nextOffset=duration;
      for (const action of (next.motion_scene?.actions ?? [])) {
        actions.push(scaleMergedAction(action,next,nextDuration(nextIndex),nextOffset));
      }
      duration += nextDuration(nextIndex);
      endIndex=nextIndex;
    }

    const base=scenes[startIndex].motion_scene;
    const mergedMotionScene=base ? {
      ...base,
      durationInFrames:duration,
      actions,
    } : null;
    groups.push({
      startIndex,
      endIndex,
      startFrame:absoluteFrame,
      duration,
      fadeIn:storyboardTransitionFlags(String(scenes[startIndex].scene_id),startIndex).fadeIn,
      fadeOut:storyboardTransitionFlags(String(scenes[endIndex].scene_id),endIndex).fadeOut,
      motionScene:mergedMotionScene,
    });
    absoluteFrame+=duration;
    i=endIndex+1;
  }
  return groups;
};

const nextDuration=(index:number)=>sceneFrames[index];

export const MainVideo: React.FC = () => {
  const visualGroups=buildVisualGroups();
  let offset=0;
  return <AbsoluteFill>
    {introEnabled && <Sequence from={0} durationInFrames={introFrames}><IntroCard /></Sequence>}
    {visualGroups.map((group:any)=>{
      const currentOffset=offset + introFrames;
      offset+=group.duration;
      if (!group.motionScene) {
        return <Sequence key={`visual-${group.startIndex}`} from={currentOffset} durationInFrames={group.duration}>
          {scenes.slice(group.startIndex,group.endIndex+1).map((scene:any,localIndex:number)=>{
            const index=group.startIndex+localIndex;
            return <SceneVisual
              key={scene.scene_id}
              scene={scene}
              duration={sceneFrames[index]}
              fadeIn={storyboardTransitionFlags(String(scene.scene_id),index).fadeIn}
              fadeOut={storyboardTransitionFlags(String(scene.scene_id),index).fadeOut}
              contentOffset={offset - group.duration}
            />;
          })}
        </Sequence>;
      }

      return <Sequence key={`visual-${group.startIndex}`} from={currentOffset} durationInFrames={group.duration}>
        <VisualMotionGroup
          scene={group.motionScene}
          duration={group.duration}
          fadeIn={group.fadeIn}
          fadeOut={group.fadeOut}
        />
      </Sequence>;
    })}
    {scenes.map((scene:any,index:number)=>{
      const sceneStart=scenes.slice(0,index).reduce((sum,_s,i)=>sum+sceneFrames[i],0) + introFrames;
      const duration=sceneFrames[index];
      return <Sequence key={`audio-${scene.scene_id}`} from={sceneStart} durationInFrames={duration}>
        <Sequence from={0} durationInFrames={duration}>
          <Audio src={staticFile(TIMINGS[timingKey(scene)].audioFile)} />
        </Sequence>
        <QuoteSegments scene={scene} duration={duration}/>
        <StoryboardSceneText sceneId={String(scene.scene_id)} />
      </Sequence>;
    })}
    {endingEnabled && <Sequence from={introFrames + SCENE_TOTAL_FRAMES} durationInFrames={endingFrames}>
      <EndingCard />
    </Sequence>}
    <BackgroundMusic />
  </AbsoluteFill>;
};

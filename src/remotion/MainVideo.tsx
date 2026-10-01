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
import {VIDEO_CONTENT} from '../generated/videoContent';
import {VIDEO_CONFIG} from '../generated/videoConfig';

const FPS = Number(VIDEO_CONFIG.fps);
const paper = '#e8dcc5';
const ink = '#34291f';

const scenes = VIDEO_CONTENT.scenes;
const TIMINGS = AUDIO_TIMINGS as Record<string, any>;
const sceneFrames = scenes.map((scene) => Math.max(1, Math.ceil((TIMINGS[scene.scene_id]?.durationSeconds ?? 1) * FPS)));
export const TOTAL_DURATION_FRAMES = sceneFrames.reduce((sum, frames) => sum + frames, 0);

const Paper: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{backgroundColor: paper, color: ink, overflow: 'hidden', fontFamily: 'Georgia, serif'}}>{children}</AbsoluteFill>
);

const fadeForDuration = (frame: number, duration: number, fade = 18) => interpolate(
  frame,
  [0, fade, Math.max(fade, duration - fade), duration],
  [0, 1, 1, 0],
  {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'},
);

const AnimatedImage: React.FC<{scene: any; duration: number; index: number}> = ({scene, duration, index}) => {
  const frame = useCurrentFrame();
  const progress = duration <= 1 ? 1 : frame / (duration - 1);
  const cameraText = String(scene.camera ?? '');
  const zoomMatch = cameraText.match(/zoom[^0-9]*([0-9]+(?:\.[0-9]+)?)[^0-9]+(?:to|_to)[^0-9]*([0-9]+(?:\.[0-9]+)?)/i);
  const zoom = zoomMatch ? [Number(zoomMatch[1]), Number(zoomMatch[2])] : (index % 2 === 0 ? [1.04, 1.15] : [1.02, 1.13]);
  const scale = interpolate(progress, [0, 1], zoom, {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const x = interpolate(progress, [0, 1], index % 2 === 0 ? [4, -90] : [-35, 35], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const y = interpolate(progress, [0, 1], index % 2 === 0 ? [18, -18] : [20, -22], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return <Img src={staticFile(`assets/generated/scene_${scene.scene_id}.png`)} style={{position:'absolute', inset:-60, width:'calc(100% + 120px)', height:'calc(100% + 120px)', objectFit:'cover', transform:`translate3d(${x}px,${y}px,0) scale(${scale})`, transformOrigin:index % 2 === 0 ? '45% 52%' : '52% 48%', opacity:fadeForDuration(frame,duration)}} />;
};

const WatercolorMotion: React.FC<{index:number; duration:number}> = ({index,duration}) => {
  const frame = useCurrentFrame();
  const pulse = interpolate(frame, [0, duration / 2, duration], [0, 1, 0], {extrapolateLeft:'clamp', extrapolateRight:'clamp'});
  return <AbsoluteFill style={{pointerEvents:'none'}}>
    <div style={{position:'absolute',inset:0,background:index % 2 === 0 ? 'radial-gradient(circle at 45% 50%, rgba(42,65,125,.12), transparent 42%)' : 'radial-gradient(circle at 55% 48%, rgba(37,112,91,.14), transparent 42%)',opacity:.45+pulse*.25,mixBlendMode:'multiply'}} />
    <div style={{position:'absolute',inset:0,border:'1px solid rgba(52,41,31,.14)',boxShadow:'inset 0 0 90px rgba(52,41,31,.12)'}} />
  </AbsoluteFill>;
};

const Caption: React.FC<{text:string; quote?:boolean}> = ({text,quote=false}) => {
  const frame=useCurrentFrame();
  const opacity=interpolate(frame,[0,12],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const y=interpolate(frame,[0,12],[18,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  return <div style={{position:'absolute',left:quote?150:110,right:quote?150:110,bottom:quote?155:55,padding:quote?'24px 30px':'16px 24px',background:quote?'rgba(247,238,218,.96)':'rgba(247,238,218,.90)',border:quote?'2px solid rgba(80,60,40,.52)':'1px solid rgba(80,60,40,.35)',boxShadow:'0 8px 25px rgba(50,35,20,.14)',fontFamily:quote?'Courier New, monospace':'Georgia, serif',fontSize:quote?34:27,lineHeight:1.28,color:ink,textAlign:quote?'center':'left',transform:`translateY(${y}px)`,opacity}}>{quote?`“${text}”`:text}</div>;
};

const SegmentOverlay: React.FC<{segment:any; duration:number}> = ({segment,duration}) => {
  const chunks = segment.kind === 'quote' ? [segment.text] : segment.text.match(/.{1,150}(?:\s|$)/g)?.map((x:string)=>x.trim()).filter(Boolean) ?? [segment.text];
  const chunkFrames = Math.max(1, Math.floor(duration/chunks.length));
  return <>{chunks.map((chunk:string,index:number)=><Sequence key={`${segment.id}-${index}`} from={index*chunkFrames} durationInFrames={index===chunks.length-1 ? duration-index*chunkFrames : chunkFrames+2}><Caption text={chunk} quote={segment.kind==='quote'} /></Sequence>)}</>;
};

const Scene: React.FC<{scene:any; sceneIndex:number; duration:number; offset:number}> = ({scene,sceneIndex,duration}) => {
  const timings=TIMINGS[scene.scene_id]?.segments ?? [];
  return <Paper>
    <AnimatedImage scene={scene} duration={duration} index={sceneIndex}/>
    <WatercolorMotion index={sceneIndex} duration={duration}/>
    <Audio src={staticFile(TIMINGS[scene.scene_id].audioFile)} />
    {timings.map((timing:any)=><Sequence key={timing.id} from={Math.round(timing.startSeconds*FPS)} durationInFrames={Math.max(1,Math.round(timing.durationSeconds*FPS))}><SegmentOverlay segment={timing} duration={Math.max(1,Math.round(timing.durationSeconds*FPS))}/></Sequence>)}
  </Paper>;
};

export const MainVideo: React.FC = () => {
  let offset=0;
  return <AbsoluteFill>{scenes.map((scene:any,index:number)=>{const duration=sceneFrames[index];const currentOffset=offset;offset+=duration;return <Sequence key={scene.scene_id} from={currentOffset} durationInFrames={duration}><Scene scene={scene} sceneIndex={index} duration={duration} offset={currentOffset}/></Sequence>;})}</AbsoluteFill>;
};

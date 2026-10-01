import React from 'react';
import {AbsoluteFill, Sequence, Audio, Video, staticFile, useCurrentFrame, interpolate} from 'remotion';
import {VIDEO_CONTENT} from '../generated/videoContent';
import {AUDIO_TIMINGS} from '../generated/audioTimings';
import {VIDEO_CONFIG} from '../generated/videoConfig';

const FPS = Number(VIDEO_CONFIG.fps);
const scenes = VIDEO_CONTENT.scenes;
const TIMINGS = AUDIO_TIMINGS as Record<string, any>;
const sceneFrames = scenes.map((scene) => Math.max(1, Math.ceil((TIMINGS[scene.scene_id]?.durationSeconds ?? 1) * FPS)));
export const TOTAL_DURATION_FRAMES = sceneFrames.reduce((a, b) => a + b, 0);
const ink = '#2f2a24';

const Paper: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background:'#efe5d0', overflow:'hidden'}}>{children}</AbsoluteFill>
);

const AnimatedAIClip: React.FC<{scene:any; duration:number}> = ({scene, duration}) => {
  const clips = Array.isArray(scene.video_clips) ? scene.video_clips : [];
  if (!clips.length) {
    const frame = useCurrentFrame();
    const progress = duration <= 1 ? 0 : frame / duration;
    const x = interpolate(progress, [0,1], [-12, 12]);
    const scale = interpolate(progress, [0,1], [1.02, 1.08]);
    return <img src={staticFile(`assets/generated/scene_${scene.scene_id}.png`)} style={{position:'absolute',inset:-30,width:'calc(100% + 60px)',height:'calc(100% + 60px)',objectFit:'cover',transform:`translate3d(${x}px,0,0) scale(${scale})`}} />;
  }
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

const Caption: React.FC<{text:string; quote?:boolean}> = ({text,quote=false}) => {
  const frame=useCurrentFrame();
  const opacity=interpolate(frame,[0,12],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  const y=interpolate(frame,[0,12],[18,0],{extrapolateLeft:'clamp',extrapolateRight:'clamp'});
  return <div style={{position:'absolute',left:quote?60:45,right:quote?60:45,bottom:quote?65:25,padding:quote?'12px 16px':'8px 12px',background:quote?'rgba(247,238,218,.96)':'rgba(247,238,218,.90)',border:quote?'1px solid rgba(80,60,40,.52)':'1px solid rgba(80,60,40,.35)',boxShadow:'0 5px 15px rgba(50,35,20,.14)',fontFamily:quote?'Courier New, monospace':'Georgia, serif',fontSize:quote?17:14,lineHeight:1.28,color:ink,textAlign:quote?'center':'left',transform:`translateY(${y}px)`,opacity}}>{quote?`“${text}”`:text}</div>;
};

const SegmentOverlay: React.FC<{segment:any; duration:number}> = ({segment,duration}) => {
  if (segment.kind !== 'quote') return null;
  return <Caption text={segment.text} quote />;
};

const Scene: React.FC<{scene:any; sceneIndex:number; duration:number}> = ({scene,sceneIndex,duration}) => {
  const timings=TIMINGS[scene.scene_id]?.segments ?? [];
  return <Paper>
    <AnimatedAIClip scene={scene} duration={duration}/>
    <Sequence from={0} durationInFrames={duration}>
      <Audio src={staticFile(TIMINGS[scene.scene_id].audioFile)} />
    </Sequence>
    {timings.map((timing:any)=><Sequence key={timing.id} from={Math.round(Number(timing.startSeconds ?? timing.start_seconds ?? 0)*FPS)} durationInFrames={Math.max(1,Math.round(Number(timing.durationSeconds ?? timing.duration_seconds ?? 1)*FPS))}><SegmentOverlay segment={timing} duration={Math.max(1,Math.round(Number(timing.durationSeconds ?? timing.duration_seconds ?? 1)*FPS))}/></Sequence>)}
  </Paper>;
};

export const MainVideo: React.FC = () => {
  let offset=0;
  return <AbsoluteFill>{scenes.map((scene:any,index:number)=>{const duration=sceneFrames[index];const currentOffset=offset;offset+=duration;return <Sequence key={scene.scene_id} from={currentOffset} durationInFrames={duration}><Scene scene={scene} sceneIndex={index} duration={duration}/></Sequence>;})}</AbsoluteFill>;
};

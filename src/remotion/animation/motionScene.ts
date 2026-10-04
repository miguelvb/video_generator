import type {MotionAction, MotionAssetType, MotionEdge, MotionNode, TwoDMotionEngineProps} from './motionTypes';

export type MotionSceneNode = {id:string; asset?:MotionAssetType; label?:string; shape?:'boundary'; x:number; y:number; size?:number};
export type MotionSceneConnection = {id:string; from:string; to:string; curvature?:number};
type MotionSceneActionDependency = {after?: string[]};
export type MotionSceneAction =
  | ({type:'appear';target:string;at:number;duration?:number} & MotionSceneActionDependency)
  | ({type:'move';target:string;at:number;duration:number;x:number;y:number} & MotionSceneActionDependency)
  | ({type:'pulse';target:string;at:number;duration:number} & MotionSceneActionDependency)
  | ({type:'fade';target:string;at:number;duration:number;to:number} & MotionSceneActionDependency)
  | ({type:'connect';target:string;at:number} & MotionSceneActionDependency)
  | ({type:'send';target:string;at:number;duration:number} & MotionSceneActionDependency)
  | ({type:'activate';target:string;at:number} & MotionSceneActionDependency)
  | ({type:'succeed';target:string;at:number} & MotionSceneActionDependency)
  | ({type:'error';target:string;at:number} & MotionSceneActionDependency);

export type MotionSceneDefinition = {
  readonly nodes: readonly MotionSceneNode[];
  readonly connections: readonly MotionSceneConnection[];
  readonly actions: readonly MotionSceneAction[];
  readonly groups?: readonly {id:string;nodeIds:string[]}[];
  readonly cameraFocus?: {groupId:string;zoom:number|'fit';startFrame?:number;durationInFrames?:number};
  readonly durationInFrames:number;
  readonly color?:string;
  readonly background?:string;
};

const compileAction=(action:MotionSceneAction):MotionAction=>{
 const afterTargetIds=action.after?.filter(Boolean);
 switch(action.type){
  case'appear':return{type:'appear',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,afterTargetIds};
  case'move':return{type:'move',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,x:action.x,y:action.y,afterTargetIds};
  case'pulse':return{type:'pulse',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,afterTargetIds};
  case'fade':return{type:'fade',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,to:action.to,afterTargetIds};
  case'connect':return{type:'connect',targetId:action.target,startFrame:action.at,afterTargetIds};
  case'send':return{type:'send',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,afterTargetIds};
  case'activate':return{type:'set-edge-state',targetId:action.target,frame:action.at,state:'active',afterTargetIds};
  case'succeed':return{type:'set-node-state',targetId:action.target,frame:action.at,state:'success',afterTargetIds};
  case'error':return{type:'set-node-state',targetId:action.target,frame:action.at,state:'error',afterTargetIds};
 }
};
const scaleFrame=(frame:number,scale:number)=>Math.max(0,Math.round(frame*scale));
const scaleMotionAction=(action:MotionSceneAction,scale:number):MotionSceneAction=>{
 if(action.type==='appear'||action.type==='connect'||action.type==='activate'||action.type==='succeed'||action.type==='error')return{...action,at:scaleFrame(action.at,scale)};
 return{...action,at:scaleFrame(action.at,scale),duration:Math.max(1,scaleFrame(action.duration,scale))};
};
export const compileMotionScene=(scene:MotionSceneDefinition,durationOverride?:number):TwoDMotionEngineProps=>{
 const authoredDuration=Math.max(1,scene.durationInFrames);
 const durationInFrames=Math.max(1,Math.round(durationOverride??authoredDuration));
 const scale=durationInFrames/authoredDuration;
 const nodes:MotionNode[]=scene.nodes.map(node=>({id:node.id,x:node.x,y:node.y,size:node.size,asset:node.asset,label:node.label,shape:node.shape}));
 const edges:MotionEdge[]=scene.connections.map(c=>({id:c.id,from:c.from,to:c.to,curvature:c.curvature}));
 return{
  nodes,edges,
  groups:scene.groups?scene.groups.map(g=>({...g})):undefined,
  cameraFocus:scene.cameraFocus?{...scene.cameraFocus,startFrame:scene.cameraFocus.startFrame===undefined?undefined:scaleFrame(scene.cameraFocus.startFrame,scale),durationInFrames:scene.cameraFocus.durationInFrames===undefined?undefined:Math.max(1,scaleFrame(scene.cameraFocus.durationInFrames,scale))}:undefined,
  actions:scene.actions.map(a=>compileAction(scaleMotionAction(a,scale))),
  durationInFrames,color:scene.color,backgroundAsset:scene.background
 };
};

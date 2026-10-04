import type {MotionAction, MotionAssetType, MotionEdge, MotionNode, TwoDMotionEngineProps} from './motionTypes';

export type MotionSceneNode = {
  id:string;
  asset?:MotionAssetType;
  label?:string;
  shape?:'boundary';
  x:number;
  y:number;
  size?:number;
};

export type MotionSceneConnection = {
  id:string;
  from:string;
  to:string;
  curvature?:number;
};

export type MotionSceneAction =
  | {type:'appear';target:string;at:number;duration?:number}
  | {type:'move';target:string;at:number;duration:number;x:number;y:number}
  | {type:'pulse';target:string;at:number;duration:number}
  | {type:'fade';target:string;at:number;duration:number;to:number}
  | {type:'connect';target:string;at:number}
  | {type:'send';target:string;at:number;duration:number}
  | {type:'activate';target:string;at:number}
  | {type:'succeed';target:string;at:number}
  | {type:'error';target:string;at:number};

export type MotionSceneDefinition = {
  readonly nodes:readonly MotionSceneNode[];
  readonly connections:readonly MotionSceneConnection[];
  readonly actions:readonly MotionSceneAction[];
  readonly groups?:readonly {id:string;nodeIds:string[]}[];
  readonly cameraFocus?:{
    groupId:string;
    zoom:number|'fit';
    startFrame?:number;
    durationInFrames?:number;
  };
  readonly durationInFrames:number;
  readonly color?:string;
  readonly background?:string;
};

const compileAction=(action:MotionSceneAction):MotionAction=>{
  switch(action.type){
    case'appear':
      return {type:'appear',targetId:action.target,startFrame:action.at,durationInFrames:action.duration};
    case'move':
      return {type:'move',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,x:action.x,y:action.y};
    case'pulse':
      return {type:'pulse',targetId:action.target,startFrame:action.at,durationInFrames:action.duration};
    case'fade':
      return {type:'fade',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,to:action.to};
    case'connect':
      return {type:'connect',targetId:action.target,startFrame:action.at};
    case'send':
      return {type:'send',targetId:action.target,startFrame:action.at,durationInFrames:action.duration};
    case'activate':
      return {type:'set-edge-state',targetId:action.target,frame:action.at,state:'active'};
    case'succeed':
      return {type:'set-node-state',targetId:action.target,frame:action.at,state:'success'};
    case'error':
      return {type:'set-node-state',targetId:action.target,frame:action.at,state:'error'};
  }
};

export const compileMotionScene=(
  scene:MotionSceneDefinition,
  durationOverride?:number,
):TwoDMotionEngineProps=>{
  const durationInFrames=Math.max(
    1,
    Math.round(durationOverride ?? scene.durationInFrames),
  );

  const nodes:MotionNode[]=scene.nodes.map(node=>({
    id:node.id,
    x:node.x,
    y:node.y,
    size:node.size,
    asset:node.asset,
    label:node.label,
    shape:node.shape,
  }));

  const edges:MotionEdge[]=scene.connections.map(connection=>({
    id:connection.id,
    from:connection.from,
    to:connection.to,
    curvature:connection.curvature,
  }));

  return {
    nodes,
    edges,
    groups:scene.groups?.map(group=>({...group})),
    cameraFocus:scene.cameraFocus?{...scene.cameraFocus}:undefined,
    actions:scene.actions.map(compileAction),
    durationInFrames,
    color:scene.color,
    backgroundAsset:scene.background,
  };
};

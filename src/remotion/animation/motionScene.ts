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

const fail=(message:string):never=>{
  throw new Error(`Motion scene: ${message}`);
};

const compileAction=(
  action:MotionSceneAction,
  nodeIds:Set<string>,
  edgeIds:Set<string>,
):MotionAction=>{
  const isNode=nodeIds.has(action.target);
  const isEdge=edgeIds.has(action.target);
  if(!isNode&&!isEdge) fail(`"${action.type}" targets unknown id "${action.target}"`);
  const needNode=()=>{if(!isNode) fail(`"${action.type}" needs a node, but "${action.target}" is a connection`);};
  const needEdge=()=>{if(!isEdge) fail(`"${action.type}" needs a connection, but "${action.target}" is a node`);};
  if(!Number.isFinite(action.at)) fail(`"${action.type}" on "${action.target}" has no frame number in "at"`);
  if('duration' in action&&action.duration!==undefined&&!(action.duration>0)) fail(`"${action.type}" on "${action.target}" needs a positive "duration"`);
  if(['move','pulse','fade','send'].includes(action.type)&&!('duration' in action&&action.duration!==undefined)){
    fail(`"${action.type}" on "${action.target}" needs a "duration" in frames`);
  }

  switch(action.type){
    case'appear':
      needNode();
      return {type:'appear',targetId:action.target,startFrame:action.at,durationInFrames:action.duration};
    case'move':
      needNode();
      return {type:'move',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,x:action.x,y:action.y};
    case'pulse':
      needNode();
      return {type:'pulse',targetId:action.target,startFrame:action.at,durationInFrames:action.duration};
    case'fade':
      needNode();
      return {type:'fade',targetId:action.target,startFrame:action.at,durationInFrames:action.duration,to:action.to};
    case'connect':
      needEdge();
      return {type:'connect',targetId:action.target,startFrame:action.at};
    case'send':
      needEdge();
      return {type:'send',targetId:action.target,startFrame:action.at,durationInFrames:action.duration};
    case'activate':
    case'succeed':
    case'error':{
      // State actions work on both nodes and connections.
      const state=action.type==='activate'?'active':action.type==='succeed'?'success':'error';
      return isNode
        ? {type:'set-node-state',targetId:action.target,frame:action.at,state}
        : {type:'set-edge-state',targetId:action.target,frame:action.at,state};
    }
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
  const nodeIds=new Set(nodes.map(node=>node.id));

  const edges:MotionEdge[]=scene.connections.map(connection=>{
    if(!nodeIds.has(connection.from)||!nodeIds.has(connection.to)){
      fail(`connection "${connection.id}" joins unknown node(s) "${connection.from}" → "${connection.to}"`);
    }
    return {
      id:connection.id,
      from:connection.from,
      to:connection.to,
      curvature:connection.curvature,
    };
  });
  const edgeIds=new Set(edges.map(edge=>edge.id));

  return {
    nodes,
    edges,
    groups:scene.groups?.map(group=>({id:group.id,nodeIds:[...group.nodeIds]})),
    cameraFocus:scene.cameraFocus?{...scene.cameraFocus}:undefined,
    actions:scene.actions.map(action=>compileAction(action,nodeIds,edgeIds)),
    durationInFrames,
    color:scene.color,
    backgroundAsset:scene.background,
  };
};

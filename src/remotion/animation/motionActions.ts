import {moveProgress} from './motionGeometry';
import type {MotionAction,MotionEdge,MotionNode,MotionNodeState,MotionEdgeState} from './motionTypes';
const stateAt=<T extends string>(base:T,changes:{frame:number;state:T}[]|undefined,frame:number):T=>{
 let state=base; for(const c of changes??[])if(frame>=c.frame)state=c.state; return state;
};
export const resolveMotionActions=(nodes:MotionNode[],edges:MotionEdge[],actions:MotionAction[]|undefined,frame:number)=>{
 if(!actions||actions.length===0)return{nodes,edges};
 const moveActions=actions.filter(a=>a.type==='move'),sendActions=actions.filter(a=>a.type==='send'),connectActions=actions.filter(a=>a.type==='connect'),activateActions=actions.filter(a=>a.type==='activate'),appearActions=actions.filter(a=>a.type==='appear'),pulseActions=actions.filter(a=>a.type==='pulse'),fadeActions=actions.filter(a=>a.type==='fade');
 const resolvedNodes=nodes.map(node=>{
  const moves=moveActions.filter(a=>a.targetId===node.id),appears=appearActions.filter(a=>a.targetId===node.id),fades=fadeActions.filter(a=>a.targetId===node.id);
  let x=node.x,y=node.y;
  for(const move of moves){const p=moveProgress(frame,move.startFrame,move.durationInFrames);x=x+(move.x-x)*p;y=y+(move.y-y)*p;if(frame>=move.startFrame+move.durationInFrames){x=move.x;y=move.y;}}
  let opacity=1;
  if(appears.length){opacity=0;for(const a of appears){const d=a.durationInFrames??24;opacity=Math.max(opacity,Math.max(0,Math.min(1,(frame-a.startFrame)/Math.max(1,d))));}}
  for(const f of fades){const p=moveProgress(frame,f.startFrame,f.durationInFrames);opacity*=1+(f.to-1)*p;}
  const stateChanges=actions.filter(a=>a.type==='set-node-state'&&a.targetId===node.id).map(a=>({frame:a.frame,state:a.state as MotionNodeState}));
  const nodePulses=pulseActions.filter(a=>a.targetId===node.id).flatMap(a=>[{frame:a.startFrame,state:'active' as MotionNodeState},{frame:a.startFrame+a.durationInFrames,state:'normal' as MotionNodeState}]);
  return{...node,x,y,opacity,state:stateAt(node.state??'normal',[...stateChanges,...nodePulses].sort((a,b)=>a.frame-b.frame),frame)};
 });
 const resolvedEdges=edges.map(edge=>{
  const send=sendActions.find(a=>a.targetId===edge.id),connect=connectActions.find(a=>a.targetId===edge.id),activate=activateActions.find(a=>a.targetId===edge.id);
  const stateChanges=actions.filter(a=>a.type==='set-edge-state'&&a.targetId===edge.id).map(a=>({frame:a.frame,state:a.state as MotionEdgeState}));
  const activateChange=activate?{frame:activate.frame,state:'active' as MotionEdgeState}:undefined;
  return{...edge,sendAction:send?{startFrame:send.startFrame,durationInFrames:send.durationInFrames}:edge.sendAction,delay:connect?connect.startFrame:edge.delay,state:stateAt(edge.state??'normal',[...stateChanges,...(activateChange?[activateChange]:[])].sort((a,b)=>a.frame-b.frame),frame)};
 });
 return{nodes:resolvedNodes,edges:resolvedEdges};
};
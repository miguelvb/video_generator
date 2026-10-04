import {moveProgress} from './motionGeometry';
import type {MotionAction,MotionEdge,MotionNode,MotionNodeState,MotionEdgeState} from './motionTypes';

const stateAt=<T extends string>(base:T,changes:{frame:number;state:T}[]|undefined,frame:number):T=>{
 let state=base; for(const c of changes??[])if(frame>=c.frame)state=c.state; return state;
};

const authoredStart=(action:MotionAction):number=>{
 if(action.type==='activate'||action.type==='succeed'||action.type==='error'||action.type==='set-node-state'||action.type==='set-edge-state') return action.frame;
 return action.startFrame;
};

const actionDuration=(action:MotionAction):number=>{
 if(action.type==='appear') return action.durationInFrames??24;
 if(action.type==='move'||action.type==='pulse'||action.type==='fade'||action.type==='send'||action.type==='focus') return action.durationInFrames;
 return 0;
};

const resolveTemporalSchedule=(nodes:MotionNode[],edges:MotionEdge[],actions:MotionAction[])=>{
 const nodeIds=new Set(nodes.map(n=>n.id));
 const edgeById=new Map(edges.map(e=>[e.id,e]));
 const startFrames=new Map<MotionAction,number>();
 for(const action of actions) startFrames.set(action,Math.max(0,authoredStart(action)));

 const nodeReady=()=> {
  const ready=new Map<string,number>();
  for(const node of nodes) ready.set(node.id,0);
  for(const action of actions) if(action.type==='appear'&&nodeIds.has(action.targetId)){
    const end=(startFrames.get(action)??0)+actionDuration(action);
    ready.set(action.targetId,Math.max(ready.get(action.targetId)??0,end));
  }
  return ready;
 };

 const edgeReady=()=>{
  const nodeTimes=nodeReady();
  const ready=new Map<string,number>();
  for(const edge of edges){
    const explicit=actions.find(a=>a.type==='connect'&&a.targetId===edge.id);
    let at=explicit?startFrames.get(explicit)??0:edge.delay??0;
    at=Math.max(at,nodeTimes.get(edge.from)??0,nodeTimes.get(edge.to)??0);
    ready.set(edge.id,at);
  }
  return ready;
 };

 const dependencyReady=(ids:string[]|undefined,nodeTimes:Map<string,number>,edgeTimes:Map<string,number>)=>{
  let ready=0;
  for(const id of ids??[]){
    if(nodeIds.has(id)) ready=Math.max(ready,nodeTimes.get(id)??0);
    else if(edgeById.has(id)) ready=Math.max(ready,edgeTimes.get(id)??0);
  }
  return ready;
 };

 // Fixed-point scheduling makes the causal rules independent of authored frame
 // order. A late dependency can only push a downstream action later.
 for(let pass=0;pass<Math.max(4,actions.length+2);pass++){
  let changed=false;
  const nodeTimes=nodeReady();
  const edgeTimes=edgeReady();
  for(const action of actions){
    let at=Math.max(0,authoredStart(action));
    at=Math.max(at,dependencyReady(action.afterTargetIds,nodeTimes,edgeTimes));
    if(action.type==='connect'){
      const edge=edgeById.get(action.targetId);
      if(edge) at=Math.max(at,nodeTimes.get(edge.from)??0,nodeTimes.get(edge.to)??0);
    } else if(action.type==='send'||action.type==='activate'||action.type==='set-edge-state'){
      const edge=edgeById.get(action.targetId);
      if(edge){
        at=Math.max(at,(edgeTimes.get(edge.id)??0)+1,nodeTimes.get(edge.from)??0,nodeTimes.get(edge.to)??0);
      }
    } else if(action.type==='succeed'||action.type==='error'||action.type==='set-node-state'){
      at=Math.max(at,nodeTimes.get(action.targetId)??0);
    }
    const previous=startFrames.get(action)??0;
    if(at!==previous){startFrames.set(action,at);changed=true;}
  }
  if(!changed) break;
 }

 return {startFrames,nodeReady:nodeReady(),edgeReady:edgeReady()};
};

export const resolveMotionActions=(nodes:MotionNode[],edges:MotionEdge[],actions:MotionAction[]|undefined,frame:number)=>{
 if(!actions||actions.length===0)return{nodes,edges};

 // Temporal safety layer:
 // 1) every connection waits until both endpoint nodes have fully appeared;
 // 2) every packet waits until its connection exists;
 // 3) edge/node state changes wait for their target to exist;
 // 4) explicit afterTargetIds create additional causal barriers.
 // Authored timestamps are therefore lower bounds, never permissions to violate
 // causality.
 const schedule=resolveTemporalSchedule(nodes,edges,actions);
 const startOf=(action:MotionAction)=>schedule.startFrames.get(action)??authoredStart(action);

 const moveActions=actions.filter(a=>a.type==='move'),sendActions=actions.filter(a=>a.type==='send'),connectActions=actions.filter(a=>a.type==='connect'),activateActions=actions.filter(a=>a.type==='activate'),appearActions=actions.filter(a=>a.type==='appear'),pulseActions=actions.filter(a=>a.type==='pulse'),fadeActions=actions.filter(a=>a.type==='fade');

 const resolvedNodes=nodes.map(node=>{
  const moves=moveActions.filter(a=>a.targetId===node.id),appears=appearActions.filter(a=>a.targetId===node.id),fades=fadeActions.filter(a=>a.targetId===node.id);
  let x=node.x,y=node.y;
  for(const move of moves){
    const p=moveProgress(frame,startOf(move),move.durationInFrames);
    x=x+(move.x-x)*p;y=y+(move.y-y)*p;
    if(frame>=startOf(move)+move.durationInFrames){x=move.x;y=move.y;}
  }
  let opacity=1;
  if(appears.length){
    opacity=0;
    for(const a of appears){
      const d=a.durationInFrames??24;
      opacity=Math.max(opacity,Math.max(0,Math.min(1,(frame-startOf(a))/Math.max(1,d))));
    }
  }
  for(const f of fades){
    const p=moveProgress(frame,startOf(f),f.durationInFrames);
    opacity*=1+(f.to-1)*p;
  }
  const stateChanges=actions
    .filter(a=>a.type==='set-node-state'&&a.targetId===node.id)
    .map(a=>({frame:startOf(a),state:a.state as MotionNodeState}));
  const nodePulses=pulseActions
    .filter(a=>a.targetId===node.id)
    .flatMap(a=>[{frame:startOf(a),state:'active' as MotionNodeState},{frame:startOf(a)+a.durationInFrames,state:'normal' as MotionNodeState}]);
  return{...node,x,y,opacity,state:stateAt(node.state??'normal',[...stateChanges,...nodePulses].sort((a,b)=>a.frame-b.frame),frame)};
 });

 const resolvedEdges=edges.map(edge=>{
  const send=sendActions.find(a=>a.targetId===edge.id),connect=connectActions.find(a=>a.targetId===edge.id),activate=activateActions.find(a=>a.targetId===edge.id);
  const gatedDelay=schedule.edgeReady.get(edge.id)??edge.delay??0;
  const stateChanges=actions.filter(a=>a.type==='set-edge-state'&&a.targetId===edge.id).map(a=>({frame:startOf(a),state:a.state as MotionEdgeState}));
  const activateChange=activate?{frame:startOf(activate),state:'active' as MotionEdgeState}:undefined;
  const gatedSend=send
    ? {startFrame:Math.max(startOf(send),(gatedDelay??0)+1),durationInFrames:send.durationInFrames}
    : edge.sendAction
      ? {startFrame:Math.max(edge.sendAction.startFrame,(gatedDelay??0)+1),durationInFrames:edge.sendAction.durationInFrames}
      : undefined;
  return{...edge,sendAction:gatedSend,delay:gatedDelay,state:stateAt(edge.state??'normal',[...stateChanges,...(activateChange?[activateChange]:[])].sort((a,b)=>a.frame-b.frame),frame)};
 });
 return{nodes:resolvedNodes,edges:resolvedEdges};
};

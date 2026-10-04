import {moveProgress} from './motionGeometry';
import type {MotionAction,MotionEdge,MotionNode,MotionNodeState,MotionEdgeState} from './motionTypes';

const stateAt=<T extends string>(
  base:T,
  changes:{frame:number;state:T}[],
  frame:number,
):T=>{
  let state=base;
  for(const change of changes){
    if(frame>=change.frame) state=change.state;
  }
  return state;
};

const actionStart=(action:MotionAction):number=>{
  if(
    action.type==='activate' ||
    action.type==='succeed' ||
    action.type==='error' ||
    action.type==='set-node-state' ||
    action.type==='set-edge-state'
  ){
    return action.frame;
  }
  return action.startFrame;
};

/**
 * Deterministic local action renderer.
 *
 * The storyboard is authoritative: an action starts at the frame authored for
 * the current scene. There is deliberately no global scheduler, dependency
 * solver, scene merge, or automatic retiming here.
 */
export const resolveMotionActions=(
  nodes:MotionNode[],
  edges:MotionEdge[],
  actions:MotionAction[]|undefined,
  frame:number,
)=>{
  if(!actions?.length) return {nodes,edges};

  const moveActions=actions.filter(a=>a.type==='move');
  const appearActions=actions.filter(a=>a.type==='appear');
  const fadeActions=actions.filter(a=>a.type==='fade');
  const pulseActions=actions.filter(a=>a.type==='pulse');

  const resolvedNodes=nodes.map(node=>{
    const moves=moveActions.filter(a=>a.targetId===node.id);
    const appears=appearActions.filter(a=>a.targetId===node.id);
    const fades=fadeActions.filter(a=>a.targetId===node.id);

    let x=node.x;
    let y=node.y;

    for(const move of moves){
      const start=actionStart(move);
      const progress=moveProgress(frame,start,move.durationInFrames);
      const previousX=x;
      const previousY=y;
      x=previousX+(move.x-previousX)*progress;
      y=previousY+(move.y-previousY)*progress;
      if(frame>=start+move.durationInFrames){
        x=move.x;
        y=move.y;
      }
    }

    let opacity=node.opacity ?? 1;
    if(appears.length){
      opacity=0;
      for(const appear of appears){
        const start=actionStart(appear);
        const duration=appear.durationInFrames ?? 24;
        const progress=duration<=1
          ? (frame>=start ? 1 : 0)
          : Math.max(0,Math.min(1,(frame-start)/duration));
        opacity=Math.max(opacity,progress);
      }
    }

    for(const fade of fades){
      const progress=moveProgress(frame,actionStart(fade),fade.durationInFrames);
      opacity*=1+(fade.to-1)*progress;
    }

    const stateChanges=actions
      .filter(a=>a.type==='set-node-state'&&a.targetId===node.id)
      .map(a=>({frame:actionStart(a),state:a.state as MotionNodeState}));

    const nodePulses=pulseActions
      .filter(a=>a.targetId===node.id)
      .flatMap(a=>[
        {frame:actionStart(a),state:'active' as MotionNodeState},
        {frame:actionStart(a)+a.durationInFrames,state:'normal' as MotionNodeState},
      ]);

    return {
      ...node,
      x,
      y,
      opacity,
      state:stateAt(
        node.state??'normal',
        [...stateChanges,...nodePulses].sort((a,b)=>a.frame-b.frame),
        frame,
      ),
    };
  });

  const resolvedEdges=edges.map(edge=>{
    const connect=actions.find(a=>a.type==='connect'&&a.targetId===edge.id);
    const send=actions.find(a=>a.type==='send'&&a.targetId===edge.id);
    const activate=actions.find(a=>a.type==='activate'&&a.targetId===edge.id);

    const connectStart=connect ? actionStart(connect) : (edge.delay ?? 0);
    const delay=Math.max(0,connectStart);

    const stateChanges=actions
      .filter(a=>a.type==='set-edge-state'&&a.targetId===edge.id)
      .map(a=>({frame:actionStart(a),state:a.state as MotionEdgeState}));

    const activateChange=activate
      ? {frame:actionStart(activate),state:'active' as MotionEdgeState}
      : undefined;

    const sendAction=send
      ? {
          startFrame:Math.max(actionStart(send),delay+1),
          durationInFrames:send.durationInFrames,
        }
      : edge.sendAction
        ? {
            startFrame:Math.max(edge.sendAction.startFrame,delay+1),
            durationInFrames:edge.sendAction.durationInFrames,
          }
        : undefined;

    return {
      ...edge,
      delay,
      sendAction,
      state:stateAt(
        edge.state??'normal',
        [...stateChanges,...(activateChange?[activateChange]:[])].sort((a,b)=>a.frame-b.frame),
        frame,
      ),
    };
  });

  return {nodes:resolvedNodes,edges:resolvedEdges};
};

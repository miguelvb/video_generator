import type {MotionNode} from './motionTypes';

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const nodeProgress = (frame: number, delay: number) =>
  clamp01((frame - delay) / 18);

export const edgeProgress = (frame: number, delay: number) =>
  clamp01((frame - delay) / 24);

export const getQuadraticControlPoint = (
  from: MotionNode,
  to: MotionNode,
  curvature: number,
) => {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.sqrt(dx * dx + dy * dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const midpointX = (from.x + to.x) / 2;
  const midpointY = (from.y + to.y) / 2;

  return {
    x: midpointX + nx * curvature,
    y: midpointY + ny * curvature,
  };
};

export const getQuadraticPoint = (
  from: MotionNode,
  control: {x: number; y: number},
  to: MotionNode,
  progress: number,
) => {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * from.x +
      2 * inverse * progress * control.x +
      progress * progress * to.x,
    y:
      inverse * inverse * from.y +
      2 * inverse * progress * control.y +
      progress * progress * to.y,
  };
};

import type {MotionNode} from './motionTypes';

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const easeInOutCubic = (value: number) => {
  const t = clamp01(value);
  return t < 0.5
    ? 4 * t * t * t
    : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

export const smoothProgress = (frame: number, start: number, duration: number) =>
  easeInOutCubic(
    clamp01((frame - start) / Math.max(1, duration)),
  );

export const moveProgress = (frame: number, start: number, duration: number) => {
  const t = clamp01((frame - start) / Math.max(1, duration));
  // Quintic smoothstep makes the acceleration/deceleration more visible
  // than the softer cubic used by connection drawing and packets.
  return 6 * t ** 5 - 15 * t ** 4 + 10 * t ** 3;
};

export const nodeProgress = (frame: number, delay: number) =>
  smoothProgress(frame, delay, 18);

export const edgeProgress = (frame: number, delay: number) =>
  smoothProgress(frame, delay, 24);

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

import type {MotionStateChange} from './motionTypes';

export const resolveMotionState = <T extends string>(
  baseState: T,
  changes: MotionStateChange<T>[] | undefined,
  frame: number,
): T => {
  if (!changes || changes.length === 0) return baseState;

  let resolved = baseState;

  for (const change of changes) {
    if (frame >= change.frame) {
      resolved = change.state;
    }
  }

  return resolved;
};

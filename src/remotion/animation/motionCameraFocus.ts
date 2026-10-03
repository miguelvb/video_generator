import type {MotionGroup, MotionNode, MotionCameraFocus} from './motionTypes';

export const getGroupBounds = (
  group: MotionGroup,
  nodes: MotionNode[],
) => {
  const members = nodes.filter((node) => group.nodeIds.includes(node.id));

  if (members.length === 0) {
    return {
      minX: 50,
      maxX: 50,
      minY: 50,
      maxY: 50,
      width: 0,
      height: 0,
      centerX: 50,
      centerY: 50,
    };
  }

  const minX = Math.min(...members.map((node) => node.x));
  const maxX = Math.max(...members.map((node) => node.x));
  const minY = Math.min(...members.map((node) => node.y));
  const maxY = Math.max(...members.map((node) => node.y));

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
  };
};

export const getGroupCenter = (
  group: MotionGroup,
  nodes: MotionNode[],
) => {
  const bounds = getGroupBounds(group, nodes);
  return {
    x: bounds.centerX,
    y: bounds.centerY,
  };
};

export const resolveCameraFocus = (
  focus: MotionCameraFocus | undefined,
  groups: MotionGroup[],
  nodes: MotionNode[],
) => {
  if (!focus) return undefined;

  const group = groups.find((candidate) => candidate.id === focus.groupId);
  if (!group) return undefined;

  const bounds = getGroupBounds(group, nodes);

  let scale: number;
  if (focus.zoom === 'fit') {
    const padding = 10;
    const availableWidth = 100 - padding * 2;
    const availableHeight = 100 - padding * 2;
    const requiredWidth = Math.max(bounds.width, 1);
    const requiredHeight = Math.max(bounds.height, 1);

    scale = Math.min(
      availableWidth / requiredWidth,
      availableHeight / requiredHeight,
    );

    scale = Math.min(Math.max(scale, 1), 3);
  } else {
    scale = focus.zoom;
  }

  return {
    x: bounds.centerX,
    y: bounds.centerY,
    scale,
  };
};

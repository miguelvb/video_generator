import type {MotionGroup, MotionNode} from './motionTypes';

export const getGroupCenter = (
  group: MotionGroup,
  nodes: MotionNode[],
) => {
  const members = nodes.filter((node) =>
    group.nodeIds.includes(node.id),
  );

  if (members.length === 0) {
    return {x: 50, y: 50};
  }

  return {
    x: members.reduce((sum, node) => sum + node.x, 0) / members.length,
    y: members.reduce((sum, node) => sum + node.y, 0) / members.length,
  };
};

export const resolveCameraFocus = (
  focus: {groupId: string; zoom: number} | undefined,
  groups: MotionGroup[],
  nodes: MotionNode[],
) => {
  if (!focus) return undefined;

  const group = groups.find((candidate) => candidate.id === focus.groupId);
  if (!group) return undefined;

  const center = getGroupCenter(group, nodes);

  return {
    x: center.x,
    y: center.y,
    scale: focus.zoom,
  };
};

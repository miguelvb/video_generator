// AUTO-GENERATED from project/demo_collective/script.md. Do not edit manually.
export const DEMO_COLLECTIVE_MOTION_SCENE = {
  "durationInFrames": 780,
  "color": "#39f6ff",
  "background": "assets/motion/demo-background.svg",
  "nodes": [
    {"id": "board", "asset": "message-board-ui", "x": 50, "y": 50, "size": 175},
    {"id": "agent-a", "asset": "agent-ui", "x": 12, "y": 18, "size": 100},
    {"id": "agent-b", "asset": "agent-ui", "x": 88, "y": 18, "size": 100},
    {"id": "agent-c", "asset": "agent-ui", "x": 12, "y": 82, "size": 100},
    {"id": "agent-d", "asset": "agent-ui", "x": 88, "y": 82, "size": 100}
  ],
  "connections": [
    {"id": "a-board", "from": "agent-a", "to": "board", "curvature": -4},
    {"id": "b-board", "from": "agent-b", "to": "board", "curvature": 4},
    {"id": "c-board", "from": "agent-c", "to": "board", "curvature": 4},
    {"id": "d-board", "from": "agent-d", "to": "board", "curvature": -4}
  ],
  "actions": [
    {"type": "appear", "target": "board", "at": 0, "duration": 24},
    {"type": "appear", "target": "agent-a", "at": 36, "duration": 20},
    {"type": "move", "target": "agent-a", "at": 66, "duration": 54, "x": 26, "y": 28},
    {"type": "connect", "target": "a-board", "at": 126},
    {"type": "send", "target": "a-board", "at": 144, "duration": 48},
    {"type": "activate", "target": "a-board", "at": 144},
    {"type": "appear", "target": "agent-b", "at": 234, "duration": 20},
    {"type": "move", "target": "agent-b", "at": 264, "duration": 54, "x": 74, "y": 28},
    {"type": "connect", "target": "b-board", "at": 324},
    {"type": "send", "target": "b-board", "at": 342, "duration": 48},
    {"type": "activate", "target": "b-board", "at": 342},
    {"type": "appear", "target": "agent-c", "at": 432, "duration": 20},
    {"type": "move", "target": "agent-c", "at": 462, "duration": 54, "x": 26, "y": 72},
    {"type": "connect", "target": "c-board", "at": 522},
    {"type": "send", "target": "c-board", "at": 540, "duration": 48},
    {"type": "activate", "target": "c-board", "at": 540},
    {"type": "appear", "target": "agent-d", "at": 630, "duration": 20},
    {"type": "move", "target": "agent-d", "at": 660, "duration": 54, "x": 74, "y": 72},
    {"type": "connect", "target": "d-board", "at": 720},
    {"type": "send", "target": "d-board", "at": 738, "duration": 42},
    {"type": "activate", "target": "d-board", "at": 738}
  ]
} as const;

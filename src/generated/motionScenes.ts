// AUTO-GENERATED from Markdown MOTION SCENE blocks. Do not edit manually.
export const MOTION_SCENES = {
  "001": {
    "durationInFrames": 330,
    "color": "#39f6ff",
    "background": "assets/motion/experiment-background.svg",
    "nodes": [
      {
        "id": "server",
        "asset": "server-ui",
        "x": 50,
        "y": 50,
        "size": 125
      },
      {
        "id": "agent-a",
        "asset": "agent-ui",
        "x": 24,
        "y": 24,
        "size": 62
      },
      {
        "id": "agent-b",
        "asset": "agent-ui",
        "x": 76,
        "y": 24,
        "size": 62
      },
      {
        "id": "agent-c",
        "asset": "agent-ui",
        "x": 20,
        "y": 76,
        "size": 62
      },
      {
        "id": "agent-d",
        "asset": "agent-ui",
        "x": 80,
        "y": 76,
        "size": 62
      },
      {
        "id": "agent-e",
        "asset": "agent-ui",
        "x": 50,
        "y": 18,
        "size": 58
      },
      {
        "id": "agent-f",
        "asset": "agent-ui",
        "x": 50,
        "y": 82,
        "size": 58
      }
    ],
    "connections": [
      {
        "id": "a-server",
        "from": "agent-a",
        "to": "server",
        "curvature": -5
      },
      {
        "id": "b-server",
        "from": "agent-b",
        "to": "server",
        "curvature": 5
      },
      {
        "id": "c-server",
        "from": "agent-c",
        "to": "server",
        "curvature": 5
      },
      {
        "id": "d-server",
        "from": "agent-d",
        "to": "server",
        "curvature": -5
      },
      {
        "id": "e-server",
        "from": "agent-e",
        "to": "server",
        "curvature": -3
      },
      {
        "id": "f-server",
        "from": "agent-f",
        "to": "server",
        "curvature": 3
      }
    ],
    "actions": [
      {
        "type": "appear",
        "target": "server",
        "at": 0,
        "duration": 24
      },
      {
        "type": "appear",
        "target": "agent-a",
        "at": 36,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "agent-b",
        "at": 54,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "agent-c",
        "at": 72,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "agent-d",
        "at": 90,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "agent-e",
        "at": 108,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "agent-f",
        "at": 126,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "a-server",
        "at": 148
      },
      {
        "type": "send",
        "target": "a-server",
        "at": 160,
        "duration": 22
      },
      {
        "type": "activate",
        "target": "a-server",
        "at": 160
      },
      {
        "type": "connect",
        "target": "b-server",
        "at": 176
      },
      {
        "type": "send",
        "target": "b-server",
        "at": 188,
        "duration": 22
      },
      {
        "type": "activate",
        "target": "b-server",
        "at": 188
      },
      {
        "type": "connect",
        "target": "c-server",
        "at": 204
      },
      {
        "type": "send",
        "target": "c-server",
        "at": 216,
        "duration": 22
      },
      {
        "type": "activate",
        "target": "c-server",
        "at": 216
      },
      {
        "type": "connect",
        "target": "d-server",
        "at": 232
      },
      {
        "type": "send",
        "target": "d-server",
        "at": 244,
        "duration": 22
      },
      {
        "type": "activate",
        "target": "d-server",
        "at": 244
      },
      {
        "type": "connect",
        "target": "e-server",
        "at": 260
      },
      {
        "type": "send",
        "target": "e-server",
        "at": 270,
        "duration": 20
      },
      {
        "type": "activate",
        "target": "e-server",
        "at": 270
      },
      {
        "type": "connect",
        "target": "f-server",
        "at": 282
      },
      {
        "type": "send",
        "target": "f-server",
        "at": 292,
        "duration": 20
      },
      {
        "type": "activate",
        "target": "f-server",
        "at": 292
      }
    ]
  },
  "002": {
    "durationInFrames": 360,
    "color": "#39f6ff",
    "background": "assets/motion/swarm-background.svg",
    "nodes": [
      {
        "id": "server",
        "asset": "server-ui",
        "x": 50,
        "y": 18,
        "size": 92
      },
      {
        "id": "task-a",
        "asset": "task-module-ui",
        "x": 25,
        "y": 48,
        "size": 88
      },
      {
        "id": "task-b",
        "asset": "task-module-ui",
        "x": 50,
        "y": 76,
        "size": 88
      },
      {
        "id": "task-c",
        "asset": "task-module-ui",
        "x": 75,
        "y": 48,
        "size": 88
      },
      {
        "id": "agent-a",
        "asset": "agent-ui",
        "x": 12,
        "y": 28,
        "size": 52
      },
      {
        "id": "agent-b",
        "asset": "agent-ui",
        "x": 18,
        "y": 68,
        "size": 52
      },
      {
        "id": "agent-c",
        "asset": "agent-ui",
        "x": 36,
        "y": 34,
        "size": 52
      },
      {
        "id": "agent-d",
        "asset": "agent-ui",
        "x": 40,
        "y": 86,
        "size": 52
      },
      {
        "id": "agent-e",
        "asset": "agent-ui",
        "x": 62,
        "y": 86,
        "size": 52
      },
      {
        "id": "agent-f",
        "asset": "agent-ui",
        "x": 64,
        "y": 34,
        "size": 52
      },
      {
        "id": "agent-g",
        "asset": "agent-ui",
        "x": 82,
        "y": 68,
        "size": 52
      },
      {
        "id": "agent-h",
        "asset": "agent-ui",
        "x": 88,
        "y": 28,
        "size": 52
      },
      {
        "id": "agent-i",
        "asset": "agent-ui",
        "x": 50,
        "y": 46,
        "size": 48
      }
    ],
    "connections": [
      {
        "id": "a-task",
        "from": "agent-a",
        "to": "task-a",
        "curvature": -4
      },
      {
        "id": "b-task",
        "from": "agent-b",
        "to": "task-a",
        "curvature": 4
      },
      {
        "id": "c-task",
        "from": "agent-c",
        "to": "task-a",
        "curvature": -3
      },
      {
        "id": "d-task",
        "from": "agent-d",
        "to": "task-b",
        "curvature": 4
      },
      {
        "id": "e-task",
        "from": "agent-e",
        "to": "task-b",
        "curvature": -4
      },
      {
        "id": "f-task",
        "from": "agent-f",
        "to": "task-c",
        "curvature": 3
      },
      {
        "id": "g-task",
        "from": "agent-g",
        "to": "task-c",
        "curvature": -4
      },
      {
        "id": "h-task",
        "from": "agent-h",
        "to": "task-c",
        "curvature": 4
      },
      {
        "id": "i-server",
        "from": "agent-i",
        "to": "server",
        "curvature": 0
      },
      {
        "id": "server-task",
        "from": "server",
        "to": "task-b",
        "curvature": 0
      }
    ],
    "actions": [
      {
        "type": "appear",
        "target": "server",
        "at": 0,
        "duration": 20
      },
      {
        "type": "appear",
        "target": "task-a",
        "at": 24,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "task-b",
        "at": 42,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "task-c",
        "at": 60,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "agent-a",
        "at": 78,
        "duration": 14
      },
      {
        "type": "appear",
        "target": "agent-b",
        "at": 90,
        "duration": 14
      },
      {
        "type": "appear",
        "target": "agent-c",
        "at": 102,
        "duration": 14
      },
      {
        "type": "appear",
        "target": "agent-d",
        "at": 114,
        "duration": 14
      },
      {
        "type": "appear",
        "target": "agent-e",
        "at": 126,
        "duration": 14
      },
      {
        "type": "appear",
        "target": "agent-f",
        "at": 138,
        "duration": 14
      },
      {
        "type": "appear",
        "target": "agent-g",
        "at": 150,
        "duration": 14
      },
      {
        "type": "appear",
        "target": "agent-h",
        "at": 162,
        "duration": 14
      },
      {
        "type": "appear",
        "target": "agent-i",
        "at": 174,
        "duration": 14
      },
      {
        "type": "connect",
        "target": "a-task",
        "at": 198
      },
      {
        "type": "send",
        "target": "a-task",
        "at": 208,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "b-task",
        "at": 214
      },
      {
        "type": "send",
        "target": "b-task",
        "at": 224,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "c-task",
        "at": 230
      },
      {
        "type": "send",
        "target": "c-task",
        "at": 240,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "d-task",
        "at": 246
      },
      {
        "type": "send",
        "target": "d-task",
        "at": 256,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "e-task",
        "at": 262
      },
      {
        "type": "send",
        "target": "e-task",
        "at": 272,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "f-task",
        "at": 278
      },
      {
        "type": "send",
        "target": "f-task",
        "at": 288,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "g-task",
        "at": 294
      },
      {
        "type": "send",
        "target": "g-task",
        "at": 304,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "h-task",
        "at": 310
      },
      {
        "type": "send",
        "target": "h-task",
        "at": 320,
        "duration": 18
      },
      {
        "type": "connect",
        "target": "i-server",
        "at": 326
      },
      {
        "type": "send",
        "target": "i-server",
        "at": 336,
        "duration": 14
      },
      {
        "type": "activate",
        "target": "server-task",
        "at": 342
      }
    ]
  },
  "003": {
    "durationInFrames": 300,
    "color": "#39f6ff",
    "background": "assets/motion/demo-background.svg",
    "nodes": [
      {
        "id": "board",
        "asset": "message-board-ui",
        "x": 50,
        "y": 50,
        "size": 175
      },
      {
        "id": "agent-a",
        "asset": "agent-ui",
        "x": 12,
        "y": 18,
        "size": 100
      },
      {
        "id": "agent-b",
        "asset": "agent-ui",
        "x": 88,
        "y": 18,
        "size": 100
      },
      {
        "id": "agent-c",
        "asset": "agent-ui",
        "x": 12,
        "y": 82,
        "size": 100
      },
      {
        "id": "agent-d",
        "asset": "agent-ui",
        "x": 88,
        "y": 82,
        "size": 100
      }
    ],
    "connections": [
      {
        "id": "a-board",
        "from": "agent-a",
        "to": "board",
        "curvature": -4
      },
      {
        "id": "b-board",
        "from": "agent-b",
        "to": "board",
        "curvature": 4
      },
      {
        "id": "c-board",
        "from": "agent-c",
        "to": "board",
        "curvature": 4
      },
      {
        "id": "d-board",
        "from": "agent-d",
        "to": "board",
        "curvature": -4
      }
    ],
    "actions": [
      {
        "type": "appear",
        "target": "board",
        "at": 0,
        "duration": 18
      },
      {
        "type": "appear",
        "target": "agent-a",
        "at": 12,
        "duration": 18
      },
      {
        "type": "move",
        "target": "agent-a",
        "at": 34,
        "duration": 34,
        "x": 26,
        "y": 28
      },
      {
        "type": "connect",
        "target": "a-board",
        "at": 72
      },
      {
        "type": "send",
        "target": "a-board",
        "at": 84,
        "duration": 28
      },
      {
        "type": "activate",
        "target": "a-board",
        "at": 84
      },
      {
        "type": "appear",
        "target": "agent-b",
        "at": 78,
        "duration": 18
      },
      {
        "type": "move",
        "target": "agent-b",
        "at": 100,
        "duration": 34,
        "x": 74,
        "y": 28
      },
      {
        "type": "connect",
        "target": "b-board",
        "at": 138
      },
      {
        "type": "send",
        "target": "b-board",
        "at": 150,
        "duration": 28
      },
      {
        "type": "activate",
        "target": "b-board",
        "at": 150
      },
      {
        "type": "appear",
        "target": "agent-c",
        "at": 144,
        "duration": 18
      },
      {
        "type": "move",
        "target": "agent-c",
        "at": 166,
        "duration": 34,
        "x": 26,
        "y": 72
      },
      {
        "type": "connect",
        "target": "c-board",
        "at": 204
      },
      {
        "type": "send",
        "target": "c-board",
        "at": 216,
        "duration": 28
      },
      {
        "type": "activate",
        "target": "c-board",
        "at": 216
      },
      {
        "type": "appear",
        "target": "agent-d",
        "at": 210,
        "duration": 18
      },
      {
        "type": "move",
        "target": "agent-d",
        "at": 232,
        "duration": 34,
        "x": 74,
        "y": 72
      },
      {
        "type": "connect",
        "target": "d-board",
        "at": 270
      },
      {
        "type": "send",
        "target": "d-board",
        "at": 282,
        "duration": 18
      },
      {
        "type": "activate",
        "target": "d-board",
        "at": 282
      }
    ]
  }
} as const;

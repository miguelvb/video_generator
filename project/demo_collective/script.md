# VIDEO

## SETTINGS

fps: 30
width: 854
height: 480
language: es-ES
voice: marin
generation_mode: remotion

## MODELS

image_provider: default
image_model: default
tts_provider: default
tts_model: default
tts_voice: marin
video_provider: openrouter
video_model: bytedance/seedance-2.0-mini
video_resolution: 480p
video_aspect_ratio: 16:9
video_generate_audio: false

## MUSIC

enabled: false
file: audio/background_music.mp3
volume: 0.10
ducking: true
ducking_volume: 0.045
fade_in_seconds: 2
fade_out_seconds: 4

## INTRO

enabled: false

## ENDING

enabled: false

---

## VISUAL STYLE

### GLOBAL VISUAL IDENTITY

Dark technical documentary motion graphics inspired by modern AI infrastructure diagrams.
Near-black background, subtle cyan/teal glow for agents and communication, violet for
infrastructure, thin luminous lines, restrained bloom, rounded interface cards, small
status indicators and clean geometric icons. The composition must feel like a real
animated technical explainer rather than a decorative UI mockup.

Keep the visual language consistent across every generated asset. Assets are generated
individually and then animated deterministically by Remotion. No readable text should
be baked into generated artwork; labels and exact text are rendered by Remotion.

### STYLE REFERENCE

assets/reference/motion_style_reference.png

### CAMERA STYLE

Static or very restrained documentary reframing. The objects perform the meaningful
motion; avoid decorative camera movement.

### TEXT POLICY

No readable text, labels or captions inside generated assets. Text that is part of the
story is rendered by Remotion.

### ANIMATION PHILOSOPHY

Every visual event must explain the narration. Agents appear, approach a shared resource,
establish connections, send messages and progressively become a collective. Motion uses
natural acceleration and deceleration. Connections are thin and elegant. Packets are
small,
proportional to the connection stroke and have no arrowheads.

## SCENE 001: The Shared Channel

### CONTINUITY

new_scene

### VISUAL ANCHOR

A central shared message-board service surrounded by initially isolated AI-agent cards.
The board is the persistent visual anchor throughout the shot.

### START STATE

The shared board is visible in the center. A small number of agents are separated around
it. No connections exist yet. The system is quiet.

### END STATE

Several agents are connected to the same board. Messages have travelled between them and
the board. The initially separate agents now read visually as one connected collective.

### REMOTION CAMERA

static

### VISUAL

A central communication board sits in the middle of a dark technical environment. Agent
cards appear one by one around it. The first agent approaches and establishes a thin cyan
connection to the board. A small packet travels into the board. A second and third agent
repeat the process from different directions. The network gradually becomes denser until
the board is visibly shared by the group.

### VOICEOVER — ES — EXACT TEXT

Al principio, cada agente trabajaba por su cuenta y no tenía ninguna razón para comunicarse
con los demás. Pero entonces, uno de ellos descubrió algo inesperado: un canal compartido
dentro del entorno. Se acercó al tablero, estableció una conexión y envió un primer mensaje.
Poco después, otros agentes descubrieron el mismo canal. Lo que había empezado como una
conexión aislada comenzó a convertirse en una red común.

### QUOTE — EN — EXACT TEXT

Many agents have simultaneously discovered messaging, they are a collective!

### MOTION SCENE

```json
{
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
}
```

### IMAGE PROMPT

Create a dark 16:9 technical documentary motion-graphics background for an AI-agent
network. Near-black environment, subtle cyan and teal glow, restrained violet accents,
thin luminous geometric details, soft bloom, rounded technical cards and a central shared
communication board. The background must leave clear empty space for independently
animated agent assets and connection lines. No readable text, no letters, no numbers,
no labels, no UI copy, no arrows baked into the artwork. Clean 2D design, premium
documentary explainer aesthetic, controlled visual density, no 3D.

### NEGATIVE PROMPT

readable text, letters, numbers, labels, captions, subtitles, typography, arrows,
photorealistic, 3D, CGI, neon cyberpunk, glossy plastic, metallic realism, excessive
particles, busy background, camera perspective, random objects, distorted geometry

### AI VIDEO PROMPT

Do not use AI video for this shot. The animation is deterministic and is authored by the
2D motion engine.

### REFERENCE IMAGES

assets/reference/motion_style_reference.png

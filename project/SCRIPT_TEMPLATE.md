# VIDEO

# A script is one Markdown file. Copy this file to project/script.md and edit it.
# Lines starting with "# " inside a section are comments and are ignored.
# Every section is optional except: at least one SCENE, and in each scene a
# VOICEOVER or QUOTE plus a picture (MOTION SCENE, or VISUAL / IMAGE PROMPT).

## SETTINGS

fps: 30
width: 1920
height: 1080
language: es-ES
# remotion = scenes are motion scenes or still images with a camera move.
# ai_video = image scenes are animated by the AI video model (costs more).
generation_mode: remotion
# Narration voice (same as tts_voice under MODELS).
voice: marin

## MODELS

# Empty or `default` = use .env, then config/defaults.json.
image_provider: default
image_model: default
tts_provider: default
tts_model: default
tts_voice: default
video_provider: default
video_model: default
video_resolution: 480p
video_aspect_ratio: 16:9
video_generate_audio: false

## NARRATOR

# Optional voice direction sent to the TTS model, one subsection per language.
# Leave out a language to use the built-in default for it.

### ES

Speak as a warm, natural adult narrator from Spain, calm and clear, without exaggerated acting.

### EN

Speak as the same narrator with native American English pronunciation.

## MUSIC

# File path is relative to public/. Music loops, fades in and out, and with
# ducking: true drops to ducking_volume while narration plays.
enabled: false
file: audio/background_music.mp3
volume: 0.10
ducking: true
ducking_volume: 0.045
fade_in_seconds: 2
fade_out_seconds: 4

## INTRO

# Title card before the first scene. Remove this section for no intro.
# background: optional image under public/ (default: first scene's image, else dark).
enabled: true
title: TITLE OF THE VIDEO
subtitle: A short subtitle
hold_seconds: 4
fade_in_seconds: 1.5
fade_out_seconds: 2.5

## ENDING

# Closing card after the last scene. Remove this section for no ending.
enabled: true
title: TITLE OF THE VIDEO
subtitle: A short subtitle
hold_seconds: 4
fade_in_seconds: 1.5
fade_out_seconds: 2.5
music_fade_out_seconds: 4

## VISUAL STYLE

### GLOBAL VISUAL IDENTITY

The visual language shared by every generated image: palette, linework, texture,
lighting and overall look. Every image prompt is prefixed with this.

### STYLE REFERENCE

# Optional image sent with every image request, e.g. assets/reference/storyboard.png

### CAMERA STYLE

Slow, restrained movement. Never handheld, shaky or randomly zooming.

---

## SCENE 001: A motion scene

# A motion scene is drawn by the 2D motion engine: SVG assets, connections
# and timed actions. It needs no generated image.

### VOICEOVER — ES — EXACT TEXT

La narración de esta escena. La escena dura exactamente lo que dura esta narración.

### MOTION SCENE

# Frames are local to this scene (frame 0 = scene start) at the SETTINGS fps.
# Assets are listed in src/remotion/animation/assetRegistry.ts.

```json
{
  "durationInFrames": 180,
  "color": "#39f6ff",
  "nodes": [
    {"id": "agent-a", "asset": "agent-ui", "x": 20, "y": 50, "size": 150},
    {"id": "server", "asset": "artifactory-ui", "x": 75, "y": 50, "size": 180}
  ],
  "connections": [
    {"id": "agent-server", "from": "agent-a", "to": "server"}
  ],
  "actions": [
    {"type": "appear", "target": "agent-a", "at": 0, "duration": 18},
    {"type": "appear", "target": "server", "at": 18, "duration": 18},
    {"type": "move", "target": "agent-a", "at": 36, "duration": 45, "x": 42, "y": 50},
    {"type": "connect", "target": "agent-server", "at": 90},
    {"type": "send", "target": "agent-server", "at": 105, "duration": 42},
    {"type": "activate", "target": "agent-server", "at": 105}
  ]
}
```

# Motion rules:
# - Every action needs "at". move, pulse, fade and send also need "duration".
# - Nothing happens unless authored: no automatic fade-ins, packets or retiming.
# - A node with an "appear" action is hidden until it appears; otherwise it is visible from frame 0.
# - A connection with "connect" draws on from that frame; without it, it is simply present.
#   A connection is never more visible than its endpoints.
# - A packet travels once per "send" action.
# - appear/move/pulse/fade target nodes; connect/send target connections;
#   activate/succeed/error work on both.
# - `validate` reports unknown ids, wrong targets, missing frames, and actions
#   that run past the end of the narration.

### TRANSITION

# Optional 1-second fades at this scene's edges. Default: hard cut.
fade_in: true
fade_out: false

### ON SCREEN TEXT

# Optional text boxes, one per line:
# text | left% | top% | width% | start_s | end_s | style | font_size
# style: label (plain text) or quote (boxed). Empty end_s = until the scene ends.
76 000 messages | 35 | 79 | 30 | 2 | | label | 14

---

## SCENE 002: An image scene

# An image scene shows one generated still image with a Remotion camera move.
# In ai_video mode the image is animated by the AI video model instead.

### VOICEOVER — ES — EXACT TEXT

Narración en español.

### QUOTE — EN — EXACT TEXT

A quote is spoken and shown on screen exactly while it is spoken.

### QUOTE PLACEMENT

# Optional CSS position of the quote box (default: top centre / bottom).
left: 10%
right: 10%
top: 60%

### VISUAL

What the image shows, in plain words.

### IMAGE PROMPT

Optional full prompt for the image model (default: VISUAL).

### NEGATIVE PROMPT

What the image must not contain.

### REMOTION CAMERA

# static | push_in | pull_out | pan_left | pan_right | pan_down | diagonal_drift
push_in

### REFERENCE IMAGES

# Optional extra reference images for this scene, one path per line.

### AI VIDEO PROMPT

# Used only in ai_video mode: describe the motion inside the image.
Describe what moves. The camera stays locked; long scenes are split into 4–15 s clips.

### CONTINUITY

# Used in AI video prompts: new_scene | transition | continuous
new_scene

### VISUAL ANCHOR

The subject that must stay recognisable.

### START STATE

How the shot begins (AI video).

### END STATE

How the shot ends (AI video).

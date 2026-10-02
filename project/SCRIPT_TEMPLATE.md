# VIDEO

## SETTINGS

fps: 30
width: 1920
height: 1080
language: es-ES
voice: shimmer
generation_mode: remotion

## MODELS

# Leave a value empty or set it to `default` to use .env defaults.
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

## MUSIC

enabled: false
file: audio/background_music.mp3
volume: 0.10
ducking: true
ducking_volume: 0.045
fade_in_seconds: 2
fade_out_seconds: 4

## ENDING

enabled: true
title: THE FIRST AUTOMATED AGENT COLLECTIVE ATTACK
subtitle: An investigation into autonomous AI agents
hold_seconds: 4
fade_in_seconds: 1.5
fade_out_seconds: 2.5
music_fade_out_seconds: 4

## VISUAL STYLE

### GLOBAL VISUAL IDENTITY

Define the visual language shared by every scene: palette, lighting, linework,
typography, iconography, depth, texture and overall documentary/explainer aesthetic.
All scenes must look like parts of the same film.

### STYLE REFERENCE

# Optional path to a reference image used for every scene.
# style_reference: assets/reference/storyboard.png

### CAMERA STYLE

Slow restrained cinematic movement; subtle push-ins and pans; locked camera when
appropriate. Never handheld, shaky, spinning or randomly zooming.

---

## SCENE 001: Título de la escena

### VOICEOVER — ES — EXACT TEXT

Escribe aquí la narración en español.

### QUOTE — EN — EXACT TEXT

Escribe aquí una cita en inglés si la escena la necesita.

### ON SCREEN TEXT

# Optional. One line per overlay:
# text | x_percent | y_percent | font_size | start_seconds | style
# /message_board | 40 | 30 | 16 | 8 | accent

### ATMOSPHERE / SFX

Soft paper rustle; subtle chime.

### CONTINUITY

# new_scene | transition | continuous | locked
new_scene

### VISUAL ANCHOR

The main visual subject or motif that should remain identifiable.

### START STATE

Optional description of how the scene/shot begins.

### END STATE

Optional description of how the scene/shot ends.

### VISUAL

Describe qué debe verse y el estilo general.

### IMAGE PROMPT

Prompt completo para generar la imagen de la escena.

### NEGATIVE PROMPT

Elementos que el generador debe evitar.

### AI VIDEO PROMPT

Describe the visual motion. The engine automatically splits long scenes into non-looped 4–15 second clips and adds narration context. Keep geometry stable and never rely on generated text.

### CAMERA

slow_zoom: towards_center; zoom: 1.02_to_1.13

### REFERENCE IMAGES

assets/reference/storyboard.png

---

## SCENE 002: Otra escena

### VOICEOVER — ES — EXACT TEXT

Narración en español.

### QUOTE — EN — EXACT TEXT

Cita en inglés.

### VOICEOVER — ES — EXACT TEXT

Otra narración.

### QUOTE — EN — EXACT TEXT

Otra cita.

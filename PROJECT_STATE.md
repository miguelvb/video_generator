# Project State — AI Video Engine

This file is the persistent project memory for the AI Video Engine. GitHub is the authoritative source of truth for the current implementation and architectural decisions.

## Repository and workflow

- Repository: `miguelvb/video_generator`
- Main branch: `main`
- Experimental Manim branch: `feature/manim-animation-engine`
- Documentation/history branch retained: `docs/update-readme-project-state`
- Do not use ZIP-based updates as the normal workflow. Changes should be made in GitHub with branches, commits, validation, and then merged to `main` when ready.
- Before modifying code, inspect the current files on the target branch. Never reconstruct `project/script.md` from memory or partial snippets.

## Core architecture

The project is content-first:

```
project/script.md
        ↓
Markdown parser
        ↓
Image generation (OpenRouter)
TTS (OpenAI)
        ↓
Optional AI video generation (OpenRouter)
        ↓
Deterministic Remotion composition
        ↓
FFmpeg/Remotion final MP4
```

### Source of truth

`project/script.md` is the source of truth for the video content and configuration. Generated JSON, TypeScript and media files are artifacts and should not normally be edited manually.

The project originally uses 30 scenes. Preserve the complete script; never replace it with a reconstructed or shortened version.

## Current main architecture

`main` contains:

- Remotion deterministic rendering.
- SVG animation support.
- Optional AI-generated video clips.
- Generic parser support for per-scene `### ANIMATION`.
- Music, intro and ending configuration.
- Spanish TTS configuration using OpenAI voice `marin`.
- No Manim dependency or implementation.

Current animation manifest on main:

```json
"animation": ["Remotion", "SVG"]
```

There is no Manim entry in main's optional dependencies.

## Scene animation configuration

The parser recognizes:

```markdown
### ANIMATION
engine: svg
type: network
```

Aliases supported by the parser include:

- `animation`
- `ai_video_prompt`
- `ai_video`
- `animation_engine`
- `animation_mode`

Each parsed scene receives an `animation` object.

The SVG implementation currently lives in `src/remotion/MainVideo.tsx` as a deterministic network overlay used by scenes with `animation.engine == "svg"`.

Current example in `project/script.md`:

```markdown
## SCENE 006: ...
### ANIMATION
engine: svg
type: network
```

The current SVG is intentionally generic. Future work can make it scene-specific and better aligned with the documentary watercolor/ink visual language.

## Manim isolation

Manim was deliberately separated from main.

Branch:

`feature/manim-animation-engine`

This branch contains the experimental Manim implementation:

- `scripts/animation_engine.py`
- `scripts/manim_scene.py`
- `requirements-manim.txt`
- Manim support in the orchestrator.
- Manim layer in Remotion.
- Manim example configuration in scene 008.
- Manim documentation/manifest entries.

The experimental scene 008 configuration is:

```markdown
### ANIMATION
engine: manim
type: graph
duration_seconds: 8
```

The Manim branch must be tested before any merge into main. Do not claim Manim rendering has been tested unless it has actually been executed successfully in the target environment.

## Parser

File: `scripts/script_parser.py`

Scene headings are parsed with the `## SCENE NNN:` format (optionally with a chapter prefix), not `### SCENE`.

Animation parsing is a dedicated `### ANIMATION` section and is stored as scene configuration.

Intro and ending defaults are translated to Spanish.

## Intro

Current `project/script.md` intro configuration:

```markdown
## INTRO

enabled: true
title: EL PRIMER ATAQUE COLECTIVO AUTOMATIZADO DE AGENTES - JULIO DE 2026
subtitle: Una investigación sobre agentes de IA autónomos
hold_seconds: 4
fade_in_seconds: 1.5
fade_out_seconds: 2.5
```

Implementation:

- Uses the first scene image statically.
- Applies a dark overlay.
- Shows the configured title and subtitle.
- Intro duration is included before scene playback.

## Ending

Current configuration:

```markdown
## ENDING

enabled: true
title: EL PRIMER ATAQUE COLECTIVO AUTOMATIZADO DE AGENTES - JULIO DE 2026
subtitle: Una investigación sobre agentes de IA autónomos
hold_seconds: 4
fade_in_seconds: 1.5
fade_out_seconds: 2.5
music_fade_out_seconds: 4
```

The ending is sequenced after all scenes.

## Music

Music is working and must be preserved unless explicitly changed.

Current configuration:

```markdown
## MUSIC

enabled: true
file: audio/m1_dubtechno_2b.mp3
volume: 1.0
ducking: true
ducking_volume: 0.045
fade_in_seconds: 2
fade_out_seconds: 4
```

Important behavior:

- Volume is 1.0 (100%).
- Fade-in is 2 seconds.
- Fade-out is 4 seconds.
- The Remotion background music component reads runtime music props.
- For the current audible playback test, Remotion forces ducking to false. Do not re-enable the debug panel unless explicitly requested.
- `SHOW_MUSIC_DEBUG` is false.

## Voice

Current voice:

```
voice: marin
tts_voice: marin
```

Spanish TTS instructions request:

- Native Spanish from Spain / Castilian accent.
- Warm, empathetic and professional female narration.
- Calm, patient, supportive delivery.
- Natural pauses and documentary/explainer phrasing.
- Clear, concise wording.
- No exaggerated acting.

Do not change voice settings unless explicitly requested.

## Remotion

Main implementation file:

`src/remotion/MainVideo.tsx`

It currently handles:

- `VIDEO_CONTENT`
- `AUDIO_TIMINGS`
- `VIDEO_CONFIG`
- Runtime `sceneIds`
- Runtime music
- Runtime intro/ending
- Intro frames
- Scene frames
- Ending frames
- Camera image modes
- Optional AI video clips
- Quote overlays
- Scene transitions
- SVG scene animation overlay
- Background music
- Intro card
- Ending card

Background music reads runtime props first and falls back to `VIDEO_CONFIG`.

## Orchestrator

File: `scripts/orchestrator.py`

Render props include:

```python
{
    "sceneIds": [s["scene_id"] for s in scenes],
    "music": project.get("music") or {},
    "ending": project.get("ending") or {},
    "intro": project.get("intro") or {},
}
```

Main does not prepare or render Manim.

## Dependencies

Python:

```text
requests>=2.31.0
python-dotenv>=1.0.0
openai>=1.0.0
```

Node:

- React 19.3.0
- React DOM 19.3.0
- Remotion 4.0.532
- @remotion/cli 4.0.532
- TypeScript 5.9.3

Main does not include Manim in its dependencies.

## Project structure

```
.env.example
.gitignore
PROJECT_MANIFEST.json
PROJECT_STATE.md
README.md
assets/
  reference/
    scene_01_reference.png
    scene_02_reference.png
    storyboard.png
  shared/
    agent.svg
    folder.svg
    message_board.svg
    server.svg
build/
  .gitkeep
  scenes/
project/
  SCRIPT_TEMPLATE.md
  script.md
public/
  assets/generated/
  audio/
  video/
requirements.txt
scripts/
  cost_tracker.py
  orchestrator.py
  script_parser.py
  validate_project.py
src/
  Root.tsx
  generated/
    audioTimings.ts
    videoConfig.ts
    videoContent.ts
  index.ts
  remotion/
    MainVideo.tsx
config/
  defaults.json
```

## Operational rules

1. Treat GitHub as the persistent memory of the project.
2. Inspect the current branch/file before editing it.
3. Preserve the full `project/script.md`; do not reconstruct it from memory.
4. Make focused commits with descriptive messages.
5. Validate changes before merging to main.
6. Keep experimental engines isolated until tested.
7. Preserve working music settings.
8. Do not make unrelated changes while implementing a requested feature.
9. Prefer deterministic Remotion/SVG for the main pipeline.
10. Keep Manim experimental until explicitly promoted.

## Historical correction worth preserving

A previous change accidentally replaced the full `project/script.md` with a shortened version while attempting voice changes. The script was restored. This is why future changes must always fetch and inspect the complete current script before editing it.

## Current status

- Main: Remotion + SVG + optional AI video.
- Manim: isolated on `feature/manim-animation-engine`.
- Music: working at 100% volume with 2s fade-in and 4s fade-out.
- Intro and ending: enabled and configured in Spanish.
- Voice: Marin with Spanish-from-Spain empathetic narration instructions.
- SVG: deterministic generic network overlay is available; scene-specific visual refinement remains future work.
- Manim: implementation exists on its feature branch and requires real environment testing before merge.

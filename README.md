# Video generator

Turns one Markdown script into a narrated explainer video.

```
project/script.md
      │  parse (scripts/script_parser.py)
      ▼
  build ──────────► src/generated/videoContent.ts, videoConfig.ts      (no API calls)
      │
      ├─ images ───► public/assets/generated/scene_NNN.png             (image scenes only)
      ├─ audio ────► public/audio/scene_NNN.wav + audioTimings.ts      (one narration track per scene)
      ├─ video ────► public/video/scene_NNN_KK.mp4                     (ai_video mode only)
      ▼
  render (Remotion, src/remotion/MainVideo.tsx) ──► output/video.mp4
```

## Design

- **The script is the only source of truth.** Everything in `build/`, `src/generated/`,
  `public/assets/generated/`, `public/audio/`, `public/video/` and `output/` is generated
  and git-ignored. Delete it and rebuild at any time.
- **A scene lasts exactly as long as its narration.** The audio step measures each scene's
  WAV; the renderer lays scenes end to end using those lengths.
- **Each scene is independent.** Motion-scene frames are local to the scene (frame 0 = scene
  start). Nothing is carried over, merged or retimed between scenes. A transition is just
  an optional fade at a scene's edge.
- **Nothing happens unless the script says so.** The renderer has no scene-specific code:
  quotes, on-screen text, fades and placements all come from the script.
- **Paid steps are cached.** Images, audio and AI video clips are reused while the inputs
  that produced them (text, prompt, model, voice) are unchanged. Costs per run are written
  to `build/runs/<run_id>/cost.json`.
- **Problems surface before money is spent.** `validate` checks the script without API
  calls; `images`, `all` and `render` refuse to run on an invalid script.

### Three kinds of scene

| Scene has | Picture | Needs |
|---|---|---|
| `### MOTION SCENE` (JSON) | 2D motion engine: SVG assets, connections, packets, timed actions | nothing generated |
| `### VISUAL` / `### IMAGE PROMPT` | generated still image with a Remotion camera move | `images` |
| same, with `generation_mode: ai_video` | AI-animated clips of that image (split into 4–15 s clips) | `images`, `video` |

Every scene also needs narration: one or more `### VOICEOVER — <LANG>` or
`### QUOTE — <LANG>` blocks. A quote is spoken and shown on screen while it is spoken.

The full script format, with every section explained, is in
[`project/SCRIPT_TEMPLATE.md`](project/SCRIPT_TEMPLATE.md).

## Setup

```bash
npm install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # add OPENAI_API_KEY and OPENROUTER_API_KEY
python scripts/orchestrator.py check
```

Requires Node, Python 3.10+ and ffmpeg/ffprobe on PATH.

## Commands

All commands take an optional script path (default `project/script.md`) and
`--scenes 001,002` (or `--test` for the first two scenes).

| Command | Does | Costs money |
|---|---|---|
| `check` | tools, packages and API keys present | no |
| `validate` | script problems: missing files, bad motion scenes, actions past the narration | no |
| `build` | parse the script, write `src/generated/` | no |
| `images` | still images for image scenes | yes |
| `audio` | narration per scene, measured timings | yes |
| `audio-timings` | rebuild timings from existing audio | no |
| `video` | AI video clips (`generation_mode: ai_video` only) | yes |
| `render` | render the MP4 | no |
| `all` | images → audio → video → render | yes |

```bash
python scripts/orchestrator.py validate
python scripts/orchestrator.py all --scenes 001,002   # → output/test_001_002.mp4 (no intro/ending)
python scripts/orchestrator.py all                    # → output/video.mp4
npm start                                             # Remotion Studio preview
```

A run on some scenes never discards the audio or timings of the others.

## Configuration

Model settings resolve in this order (first wins):

1. the script's `## MODELS` section (and `voice` under `## SETTINGS` for the narration voice)
2. `.env` (`DEFAULT_*` variables)
3. `config/defaults.json`

API keys live only in `.env`. Pipeline switches (`TTS_SEGMENT_GAP_SECONDS`,
`ENABLE_WORD_TIMINGS`, video polling) are documented in `.env.example`.

## Project layout

```
project/script.md                 the video
project/SCRIPT_TEMPLATE.md        script format reference
config/defaults.json              model defaults
scripts/orchestrator.py           pipeline commands
scripts/script_parser.py          Markdown → structured project
scripts/validation.py             script and environment checks
scripts/cost_tracker.py           per-run API cost log
src/remotion/MainVideo.tsx        renders the whole video from generated data
src/remotion/animation/           2D motion engine
public/assets/motion/             SVG assets for motion scenes
assets/reference/                 style reference images for image generation
```

### Adding a motion asset

Put the SVG in `public/assets/motion/`, add its name to `MotionAssetType` in
`src/remotion/animation/motionTypes.ts`, and add an entry to
`src/remotion/animation/assetRegistry.ts`. `validate` reads the registry, so the new
name is accepted in scripts straight away.

The `MotionSceneExample` composition in Remotion Studio is a small standalone motion
scene for trying the engine.

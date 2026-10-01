# AI Video Engine — Content-First

This project is now split into a reusable **video engine** and a content-first **Markdown project script**.

## Source of truth

For a new video, normally edit only:

```text
project/script.md
```

The parser turns that Markdown into generated scene JSON and TypeScript content/timing modules. Do **not** edit those generated files manually.

## Markdown format

Each scene can contain these blocks:

```markdown
## SCENE 001: Scene title

### VOICEOVER — ES — EXACT TEXT

Spanish narration here.

### QUOTE — EN — EXACT TEXT

English quotation here.

### ATMOSPHERE / SFX

Soft paper rustle; subtle chime.

### VISUAL

Describe the visual language and composition.

### IMAGE PROMPT

Full prompt sent to the image model.

### NEGATIVE PROMPT

Things the image model must avoid.

### CAMERA

slow_zoom: towards_center; zoom: 1.02_to_1.13

### REFERENCE IMAGES

assets/reference/storyboard.png
```

`VOICEOVER` and `QUOTE` blocks are read **in order**. That order becomes the audio/timeline order. This is how a scene can alternate Spanish narration and English quotations without hard-coded timings.

## Commands

Validate the Markdown:

```bash
python scripts/orchestrator.py validate project/script.md
```

Build generated project data only:

```bash
python scripts/orchestrator.py build project/script.md
```

Generate images:

```bash
python scripts/orchestrator.py images project/script.md
```

Generate audio and actual timings:

```bash
python scripts/orchestrator.py audio project/script.md
```

Render an existing project:

```bash
python scripts/orchestrator.py render project/script.md
```

Run the complete pipeline:

```bash
python scripts/orchestrator.py all project/script.md
```

The old flags `--images`, `--audio`, `--render` and `--all` remain supported for compatibility.


## Automatic run-cost tracking

Generation commands now create a cost report under:

```text
build/runs/<run_id>/cost.json
```

For providers that return a per-request cost, the engine records the provider-reported USD charge. OpenRouter image generation is requested with usage reporting enabled, so its `usage.cost` is recorded when present. OpenAI's Speech API currently returns the generated audio rather than a documented per-request cost field, so TTS calls are recorded as unpriced instead of inventing an exact amount. OpenAI publishes the applicable TTS pricing separately.

At the end of `images`, `audio`, and `all`, the terminal prints the known provider-reported total and any calls whose exact cost was not returned.

Example:

```text
==========================================================
AI VIDEO RUN COST
==========================================================
Run: 2026-10-01_20-14-32_a1b2c3
Known provider-reported cost: $0.0800
  openrouter         $0.0800
Unpriced API calls:          6
  (The provider did not return a per-request cost.)
Report: build/runs/2026-10-01_20-14-32_a1b2c3/cost.json
==========================================================
```

This is deliberately split into **known** and **unpriced** amounts so the engine never presents an estimate as an actual provider charge.

## Asset layout

Generated runtime assets have one canonical location:

```text
public/
├── assets/generated/
│   ├── scene_001.png
│   └── scene_002.png
└── audio/
    ├── scene_001.wav
    └── scene_002.wav
```

Remotion reads directly from `public/`. No manual copying is required.

## New project workflow

1. Copy the engine/project directory.
2. Replace `project/script.md` with the new script.
3. Add reference images under `assets/reference/` if needed.
4. Put API keys in `.env` (never in the Markdown or ZIP).
5. Run `validate`.
6. Run `all`.
7. The final video is written to `output/prototype.mp4`.

The engine files under `scripts/` and `src/` should normally remain unchanged between videos.

## Configuration and asset reuse

`project/script.md` is the source of truth for the video, including model selection. `config/defaults.json` supplies non-secret project defaults, `.env` supplies secrets and optional environment-specific default overrides. Values in the `## MODELS` section of `script.md` override `.env` defaults.

Example:

```markdown
## MODELS

image_provider: default
image_model: default
tts_provider: default
tts_model: gpt-4o-mini-tts
tts_voice: shimmer
video_provider: default
video_model: default
```

Generated images and audio are reused only when their content/configuration hash matches the current script. Changing narration text, image prompt, reference images, model, voice, or related generation settings invalidates the relevant asset. Scene numbers alone never determine reuse.

Useful commands:

```bash
python scripts/orchestrator.py all project/script.md
python scripts/orchestrator.py audio-timings project/script.md
python scripts/orchestrator.py render project/script.md
```

`audio-timings` rebuilds timing metadata from already validated audio without calling TTS. `render` validates that the existing audio matches the current script before rendering.

Each generation run records provider/model information and known provider-reported costs in `build/runs/<run_id>/cost.json`.

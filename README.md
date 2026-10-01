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

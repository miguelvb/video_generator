# AI Video Engine

Content-first AI video generation engine. The source of truth is `project/script.md`; generated JSON/TS/media are build artifacts.

## Pipeline

`script.md → images → TTS → optional AI video → Remotion → MP4`

- **Remotion mode** is the default and does not call the AI-video API.
- **AI-video mode** uses OpenRouter / Seedance and keeps Remotion as the final compositor.
- AI-video prompts enforce a **locked static camera**: no pan, zoom, dolly, orbit, rotation, shake or camera parallax. Motion happens inside the illustrated scene.
- Normal subtitles, scene titles and informational overlays are not rendered. Exact `QUOTE` segments are rendered by Remotion.

## Current configuration

Configured in `project/script.md`:

- Image: OpenRouter / `google/gemini-3.1-flash-image`
- TTS: OpenAI / `gpt-4o-mini-tts` / `shimmer`
- AI video: OpenRouter / `bytedance/seedance-2.0-mini`
- AI video: 480p, 16:9, generated audio disabled
- Current project uses `generation_mode: remotion` for safe testing

Configuration precedence:

1. `.env` — secrets/machine settings
2. `config/defaults.json` — engine defaults
3. `project/script.md` — project-specific authority

Never commit `.env` or API keys.

## Background music

Music is configured in `script.md`:

```markdown
## MUSIC

enabled: true
file: audio/m1_dubtechno_2.mp3
volume: 0.10
ducking: true
ducking_volume: 0.045
fade_in_seconds: 2
fade_out_seconds: 4
```

The actual file is:

```
public/audio/m1_dubtechno_2.mp3
```

The path in the script is relative to `public/`. Remotion loops the track, fades it in/out, and ducks it under narration. Rendering fails clearly if music is enabled but the file is missing.

## Ending

The ending card is also configured in `script.md`. It supports title, subtitle, hold duration, fade-in/out and a separate music fade-out.

## Testing and scene selection

Test the first two scenes with one command:

```bash
python scripts/orchestrator.py test project/script.md
```

This runs images → audio → video (skipped in Remotion mode) → render for scenes 001 and 002.

Specific scenes:

```bash
python scripts/orchestrator.py all project/script.md --scenes 003,004
```

Individual stages also accept `--scenes`.

Full project:

```bash
python scripts/orchestrator.py all project/script.md
```

Validation:

```bash
python scripts/orchestrator.py validate project/script.md
```

The test renderer now scopes audio-timing validation to the selected scenes, so a two-scene test does not fail because unrelated later scenes have stale audio metadata.

## Asset reuse and cost

Generated assets are identified by relevant script/model/configuration hashes, so unchanged assets can be reused. Generation costs are recorded under:

```
build/runs/<run_id>/cost.json
```

## Project structure

```
project/script.md
project/SCRIPT_TEMPLATE.md
config/defaults.json
scripts/orchestrator.py
scripts/script_parser.py
scripts/validate_project.py
scripts/cost_tracker.py
src/remotion/MainVideo.tsx
src/generated/              # generated artifacts
public/assets/generated/    # generated images
public/audio/               # narration + music
public/video/               # AI-video clips
```

## Git workflow

Repository: https://github.com/miguelvb/video_generator

Use feature branches for project changes, review the diff, then merge to `main`. Local updates are normally:

```bash
cd ~/ai-video/video_generator
git pull
```

Recommended development cycle:

`change → validate → test 2 scenes → review → merge → git pull`

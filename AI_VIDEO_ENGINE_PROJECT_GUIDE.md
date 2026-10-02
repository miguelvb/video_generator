# AI Video Engine --- Project & User Guide

## 1. What this project is

This project is a **content-first AI video engine**.

The main idea is:

> A new video should be created by editing `project/script.md`, not by
> manually editing scene JSON, generated TypeScript, or Remotion code.

The engine can combine:

-   AI-generated scene images
-   OpenAI TTS narration
-   OpenRouter video generation
-   Remotion for deterministic composition
-   FFmpeg/Remotion for final rendering
-   content-based asset reuse
-   run/cost reporting

The current experimental AI-video configuration uses:

-   **OpenRouter** for image generation
-   **OpenAI** for TTS
-   **OpenRouter + ByteDance Seedance 2.0 Mini** for AI video
-   **480p / 16:9** AI video
-   **Remotion** for the final composition and all exact text/overlay
    elements

------------------------------------------------------------------------

# 2. Core architecture

There are two rendering strategies.

## Remotion-only

``` text
script.md
    ↓
multiple visual shots / scene images
    ↓
Remotion animation
    ├── controlled pan / zoom / drift
    ├── quotes only
    └── composition
    ↓
final MP4
```

The visual design can use multiple shots per chapter so image changes
follow the narration and feel closer to a YouTube explainer/investigative
video. Remotion camera movement is allowed and is independent from the
AI-video camera rules.

No AI video generation is required.

## AI video

``` text
script.md
    ↓
multiple visual shots / scene images
    ↓
Seedance
    ↓
meaningful animation of the subjects
    ↓
Remotion
    ├── AI video
    ├── quotes only
    └── final composition
    ↓
final MP4
```

For AI video, the camera is intentionally **locked/static**. The model
should animate what the narration describes instead: agents, network
connections, data packets, servers, signals, attacks, alerts, resets,
and other meaningful elements. Do not ask Seedance to pan, zoom, dolly,
or shake the camera.

The important design rule is:

**AI video creates the motion of the visual world. Remotion remains
authoritative for information and text.**

AI video should not be trusted to render exact readable text. Normal
scene text and subtitles are not rendered automatically. **Quotes are
the intentional text overlay and remain exact.**

------------------------------------------------------------------------

# 3. Source of truth

The source of truth is:

``` text
project/script.md
```

Generated files are artifacts and should not normally be edited
manually.

Important generated artifacts include:

``` text
build/
src/generated/videoContent.ts
src/generated/videoConfig.ts
src/generated/audioTimings.ts
public/assets/generated/
public/audio/
public/video/
```

If the script changes, regenerate the affected assets rather than
manually editing generated files.

------------------------------------------------------------------------

# 4. Configuration hierarchy

The project supports defaults plus project-specific overrides.

## `.env`

Use `.env` for secrets and machine-specific values.

Example:

``` env
OPENROUTER_API_KEY=...
OPENAI_API_KEY=...
```

It must never be committed to Git.

## `config/defaults.json`

This contains non-secret default provider/model settings.

Current defaults are conceptually:

``` json
{
  "image": {
    "provider": "openrouter",
    "model": "google/gemini-3.1-flash-image"
  },
  "tts": {
    "provider": "openai",
    "model": "gpt-4o-mini-tts",
    "voice": "shimmer"
  },
  "video": {
    "provider": "openrouter",
    "model": "bytedance/seedance-2.0-mini",
    "resolution": "480p",
    "aspect_ratio": "16:9",
    "generate_audio": false
  }
}
```

## `project/script.md`

A project can override the defaults.

For example:

``` markdown
## MODELS

image_provider: default
image_model: default

tts_provider: default
tts_model: default
tts_voice: default

video_provider: openrouter
video_model: bytedance/seedance-2.0-mini
video_resolution: 480p
video_aspect_ratio: 16:9
video_generate_audio: false
```

The effective configuration is resolved before generation.

------------------------------------------------------------------------

# 5. Creating a new video project

## Step 1 --- copy the project

Make a copy of the engine for the new video.

Keep the engine code unchanged unless you are modifying the engine
itself.

The main file you should work on is:

``` text
project/script.md
```

A reusable template is provided at:

``` text
project/SCRIPT_TEMPLATE.md
```

Copy the template into `project/script.md` when starting a new video.

------------------------------------------------------------------------

# 6. Define global settings

At the top of `script.md`:

``` markdown
# VIDEO

## SETTINGS

fps: 30
width: 854
height: 480
language: es-ES
voice: shimmer
```

For the current experimental AI-video workflow, `854 × 480` is the
intended final resolution.

For a future 1080p project:

``` text
width: 1920
height: 1080
```

------------------------------------------------------------------------

# 7. Choose rendering mode

The project supports the concept of a global generation mode.

## Remotion-only

``` markdown
generation_mode: remotion
```

This is the safe/default mode and does not require AI video generation.

## AI video

``` markdown
generation_mode: ai_video
```

This generates an AI animated visual for each scene and then sends it
through Remotion for final composition.

The intended default should remain:

``` markdown
generation_mode: remotion
```

so an accidental run cannot unexpectedly spend money on AI video
generation.

------------------------------------------------------------------------

# 8. Configure models

Example:

``` markdown
## MODELS

image_provider: default
image_model: default

tts_provider: default
tts_model: default
tts_voice: default

video_provider: openrouter
video_model: bytedance/seedance-2.0-mini
video_resolution: 480p
video_aspect_ratio: 16:9
video_generate_audio: false
```

`default` means: use the value from the project/environment defaults.

The video model is intentionally the same for every scene. A scene
should normally override the **prompt**, not the model.

------------------------------------------------------------------------

# 9. Define a scene

A scene normally contains:

``` markdown
## SCENE 001: Scene title

### VOICEOVER — ES — EXACT TEXT

The narration goes here.

### QUOTE — EN — EXACT TEXT

An exact quotation goes here.

### ATMOSPHERE / SFX

Soft paper rustle; subtle ambient sound.

### VISUAL

Describe the visual composition and artistic style.

### IMAGE PROMPT

Detailed prompt used to generate the scene image.

### NEGATIVE PROMPT

Things the image generator should avoid.

### AI VIDEO PROMPT

Describe how the scene image should move.

### CAMERA

slow_pan: left_to_right; zoom: 1.04_to_1.15

### REFERENCE IMAGES

assets/reference/storyboard.png
```

Not every block is mandatory for every scene, but scenes need enough
information to generate a valid visual and narration.

## Visual shots

A long chapter should normally be divided into several visual shots.
A shot is a visual beat, not necessarily a new narration segment. The
purpose is to change the visual when the meaning of the narration changes.

For example:

``` text
Narration: agents discover the channel
    ↓
Shot 1: first agent finds the channel
    ↓
Shot 2: other agents connect
    ↓
Shot 3: messages propagate through the network
```

This shot-based structure is used by both rendering modes so that the
Remotion-only and AI-video versions can be compared using the same
visual source material.

------------------------------------------------------------------------

# 10. Voiceover and quotations

Voiceover and quote blocks are read **in order**.

For example:

``` markdown
### VOICEOVER — ES — EXACT TEXT

Spanish narration.

### QUOTE — EN — EXACT TEXT

English quotation.

### VOICEOVER — ES — EXACT TEXT

More Spanish narration.

### QUOTE — EN — EXACT TEXT

Another English quotation.
```

The resulting audio sequence is:

``` text
ES → EN → ES → EN
```

Actual WAV durations determine the timing.

This means you do not manually calculate timings in `script.md`.

------------------------------------------------------------------------

# 11. AI video prompts

The current engine accepts an explicit:

``` markdown
### AI VIDEO PROMPT
```

The prompt should describe **meaningful subject motion**, not redesign
the scene. It should be derived from what the narration is saying.

Good:

``` text
Locked static camera. Several agents activate one after another.
Thin network connections appear between them and data packets travel
along the links. Keep the watercolor illustration, framing, geometry
and paper texture stable.
```

Avoid asking the video model to:

-   pan
-   zoom
-   dolly
-   orbit
-   rotate
-   shake the camera
-   morph the composition
-   generate subtitles
-   generate exact quotations
-   generate normal labels or UI text
-   generate readable diagrams
-   generate logos

The AI-video camera must remain locked. Motion should come from the
things that matter to the story. Examples include:

-   agents appearing, activating or communicating
-   network links connecting
-   packets travelling between nodes
-   servers becoming overloaded or resetting
-   firewall boundaries being breached
-   external connections branching outward
-   alerts activating
-   processes stopping

This is intentionally different from Remotion camera animation.
Remotion may still use controlled pans, zooms and other camera movement
when rendering the non-AI-video version.

Those belong in Remotion.

## Planned improvement: AI-generated video prompts

A future improvement discussed for the engine is an LLM "animation
director" that automatically creates the AI video prompt from:

-   scene description
-   image prompt
-   narration
-   camera instructions
-   reference image

That feature is **not yet part of the current implementation**. For now,
`AI VIDEO PROMPT` is supplied in `script.md`.

------------------------------------------------------------------------

# 12. Reference images

Reference images can be placed under:

``` text
assets/reference/
```

For example:

``` text
assets/reference/storyboard.png
assets/reference/scene_01_reference.png
assets/reference/scene_02_reference.png
```

Then reference them from the scene:

``` markdown
### REFERENCE IMAGES

assets/reference/storyboard.png
```

The image generation step can use these references to maintain visual
consistency.

------------------------------------------------------------------------

# 13. Content-based asset reuse

This is an important part of the engine.

Assets are **not reused merely because the filename matches the scene
number**.

For example, this is unsafe:

``` text
scene_002.wav exists
→ therefore reuse it
```

Instead, generated assets are associated with the content/configuration
that created them.

Conceptually:

``` text
current scene content
        ↓
content hash
        ↓
existing asset metadata
        ↓
same hash?
   ├── yes → reuse
   └── no  → regenerate
```

This prevents an old `scene_002.wav` from being used after the narration
of Scene 002 has changed.

The same principle is intended for:

-   images
-   audio
-   AI video

This makes large projects incremental.

If only Scene 17 changes:

``` text
Scenes 001–016 → reuse
Scene 017      → regenerate
Scenes 018–020 → reuse
```

This saves both time and API cost.

------------------------------------------------------------------------

# 14. Audio timing

Audio timing is generated from the actual WAV files.

The timing file is:

``` text
src/generated/audioTimings.ts
```

Example segment data:

``` ts
{
  "id": "002_en_02",
  "start_seconds": 23.32,
  "duration_seconds": 5.35
}
```

Remotion uses these values to place narration and quotations precisely.

If audio files already exist and you only need to rebuild timing
metadata, use:

``` bash
python scripts/orchestrator.py audio-timings project/script.md
```

This should not call the TTS API.

------------------------------------------------------------------------

# 15. Running a project

## Install dependencies

First time only:

``` bash
npm install
```

Python environment:

``` bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
```

Make sure FFmpeg/ffprobe are available on the system.

------------------------------------------------------------------------

# 16. Validate before generating

Run:

``` bash
python scripts/orchestrator.py validate project/script.md
```

or:

``` bash
npm run validate
```

The project should report:

``` text
VALIDATION OK
```

Fix validation errors before spending API credits.

------------------------------------------------------------------------

# 17. Build content without generating assets

``` bash
python scripts/orchestrator.py build project/script.md
```

This parses the Markdown and generates the content/configuration
artifacts.

Useful for checking that the Markdown is being interpreted correctly.

------------------------------------------------------------------------

# 18. Generate images only

``` bash
python scripts/orchestrator.py images project/script.md
```

This generates or reuses scene images.

------------------------------------------------------------------------

# 19. Generate audio only

``` bash
python scripts/orchestrator.py audio project/script.md
```

This generates or reuses TTS audio and updates the timing data.

------------------------------------------------------------------------

# 20. Generate AI videos only

For:

``` markdown
generation_mode: ai_video
```

run:

``` bash
python scripts/orchestrator.py video project/script.md
```

or:

``` bash
npm run videos
```

The current video pipeline uses:

``` text
OpenRouter
    ↓
ByteDance Seedance 2.0 Mini
    ↓
480p / 16:9
```

The AI video model receives the generated scene image plus the scene's
AI video prompt.

AI-generated video does not provide the authoritative narration/audio
track. The project keeps OpenAI TTS as the audio source.

------------------------------------------------------------------------

# 21. Render without regenerating AI assets

Once the assets already exist:

``` bash
python scripts/orchestrator.py render project/script.md
```

This runs the Remotion composition.

Use this when you have already paid for/generated:

-   images
-   TTS
-   AI videos

and only want to rebuild the final MP4.

This is important when fixing a Remotion/compositing issue: **do not run
the full generation again unnecessarily.**

------------------------------------------------------------------------

# 22. Test rendering selected scenes

Because AI video is the expensive part of the workflow, the engine
supports partial/test runs. This should be used whenever comparing
models, prompts, image styles or animation behavior.

### Test the first two scenes

``` bash
python scripts/orchestrator.py images project/script.md --test
python scripts/orchestrator.py audio project/script.md --test
python scripts/orchestrator.py video project/script.md --test
python scripts/orchestrator.py render project/script.md --test
```

`--test` selects the first two scenes only. The resulting test render
is written separately from the normal full-project output.

### Test specific scenes

For example, to test scenes 003 and 004:

``` bash
python scripts/orchestrator.py images project/script.md --scenes 003,004
python scripts/orchestrator.py audio project/script.md --scenes 003,004
python scripts/orchestrator.py video project/script.md --scenes 003,004
python scripts/orchestrator.py render project/script.md --scenes 003,004
```

A single scene can also be selected:

``` bash
python scripts/orchestrator.py video project/script.md --scenes 007
```

Without `--test` or `--scenes`, the command processes the complete
project. This makes it possible to compare multiple video models using
exactly the same one or two visual shots without generating the whole
film.

For an inexpensive Remotion composition test, use `generation_mode:
remotion` and render only the selected scenes. For an AI-video model
test, use `generation_mode: ai_video` and select one or two scenes.

------------------------------------------------------------------------

# 32. Full generation

For a complete run:

``` bash
python scripts/orchestrator.py all project/script.md
```

or:

``` bash
npm run all
```

The full process is conceptually:

``` text
validate / parse
    ↓
images
    ↓
audio
    ↓
AI videos (only when ai_video mode is selected)
    ↓
audio timings
    ↓
Remotion render
    ↓
final MP4
```

The project also has:

``` bash
npm run video
```

which is an alias for the full workflow.

------------------------------------------------------------------------

# 32. Cost tracking

Each run gets a report under:

``` text
build/runs/<run_id>/
```

including:

``` text
cost.json
```

The tracker records:

-   provider
-   operation
-   model
-   scene
-   segment where applicable
-   provider-reported cost when available
-   request/job ID
-   usage information
-   whether cost was provider-reported or unavailable

Example:

``` text
AI VIDEO RUN COST
==================================================
Known provider-reported cost: $1.0575
  openrouter         $1.0575

Report:
build/runs/<run_id>/cost.json
==================================================
```

The engine deliberately does **not** invent an exact per-request cost
when the provider does not return one.

------------------------------------------------------------------------

# 32. Understanding API cost during development

AI video is the expensive part of the current workflow.

For this reason:

1.  Test with short scenes.
2.  Use 480p while developing.
3.  Use `generation_mode: remotion` when testing only composition.
4.  Use content-based reuse.
5.  Use `render` instead of `all` when assets already exist.
6.  Check `cost.json` after generation.

Never rerun the full workflow just to test a Remotion change if the
generated assets are already correct.

------------------------------------------------------------------------

# 32. The recommended development workflow

For a new video:

``` text
1. Copy project
       ↓
2. Edit project/script.md
       ↓
3. Set generation_mode
       ↓
4. Define models/defaults
       ↓
5. Write scenes
       ↓
6. Validate
       ↓
7. Generate images
       ↓
8. Generate TTS
       ↓
9. Generate AI video if desired
       ↓
10. Render
       ↓
11. Inspect output
       ↓
12. Change only what is necessary
       ↓
13. Reuse unchanged assets
```

------------------------------------------------------------------------

# 32. If something goes wrong

## Video generation failed

Do not immediately run `all` again.

Check:

``` text
public/video/
build/runs/
```

and rerun only the failed generation step.

## Remotion failed

If images/audio/video already exist:

``` bash
python scripts/orchestrator.py render project/script.md
```

Do not regenerate AI video.

## Audio is missing

Check:

``` text
public/audio/
src/generated/audioTimings.ts
```

If the WAV files already exist:

``` bash
python scripts/orchestrator.py audio-timings project/script.md
```

If the narration changed, generate audio again:

``` bash
python scripts/orchestrator.py audio project/script.md
```

The content-hash system should prevent unrelated audio from being
reused.

## A scene was changed

Only the changed asset should need regeneration.

The scene number itself is not enough to decide whether an asset is
reusable.

------------------------------------------------------------------------

# 32. File structure

The important structure is:

``` text
project/
    script.md
    SCRIPT_TEMPLATE.md

config/
    defaults.json

assets/
    reference/
    shared/

scripts/
    script_parser.py
    orchestrator.py
    cost_tracker.py
    validate_project.py

src/
    Root.tsx
    index.ts
    remotion/
        MainVideo.tsx
    generated/
        videoContent.ts
        videoConfig.ts
        audioTimings.ts

public/
    assets/generated/
    audio/
    video/

build/
    scenes/
    runs/

output/
    final MP4 files
```

------------------------------------------------------------------------

# 32. What a normal user should edit

Normally edit only:

``` text
project/script.md
```

Optionally add/change:

``` text
assets/reference/
```

and, for project-wide non-secret defaults:

``` text
config/defaults.json
```

Do not manually edit:

``` text
src/generated/
build/
```

unless debugging the engine.

Do not put API keys in:

``` text
project/script.md
config/defaults.json
```

Keep secrets in `.env`.

------------------------------------------------------------------------

# 32. Minimal example of a new project

``` markdown
# VIDEO

## SETTINGS

fps: 30
width: 854
height: 480
language: es-ES
generation_mode: ai_video

## MODELS

image_provider: default
image_model: default

tts_provider: default
tts_model: default
tts_voice: default

video_provider: openrouter
video_model: bytedance/seedance-2.0-mini
video_resolution: 480p
video_aspect_ratio: 16:9
video_generate_audio: false

---

## SCENE 001: My First Scene

### VOICEOVER — ES — EXACT TEXT

Esta es la narración de mi primera escena.

### VISUAL

Watercolor technical illustration on aged paper.

### IMAGE PROMPT

Create a 16:9 watercolor and ink illustration...

### NEGATIVE PROMPT

Photorealistic, 3D, neon, modern UI...

### AI VIDEO PROMPT

Slowly move the camera across the illustration.
Preserve the composition and watercolor texture.
Animate only subtle ink and pigment movement.

### CAMERA

slow_pan: left_to_right; zoom: 1.02_to_1.10
```

Then:

``` bash
python scripts/orchestrator.py validate project/script.md
python scripts/orchestrator.py all project/script.md
```

------------------------------------------------------------------------

# 32. Current design principles

The engine is intentionally built around these principles:

1.  **Markdown is the creative source of truth.**
2.  **Secrets stay in `.env`.**
3.  **Non-secret defaults live in `config/defaults.json`.**
4.  **`script.md` can override defaults.**
5.  **The same video model is normally used for all scenes.**
6.  **AI video handles visual motion.**
7.  **Remotion handles exact information, text and composition.**
8.  **Remotion-only remains available.**
9.  **Generated assets are reused based on content/configuration
    identity, not filenames alone.**
10. **Actual provider-reported costs are recorded when available.**
11. **Do not regenerate expensive assets just to change the final
    composition.**
12. **Short AI-video clips are composed into the final video by
    Remotion.**
13. **480p is currently the development/first-production target; 720p
    can be adopted later.**
14. **AI-generated video audio is disabled because OpenAI TTS is the
    authoritative narration/audio pipeline.**
15. **Long story chapters are divided into multiple meaningful visual
    shots so the image changes follow the narration.**
16. **Remotion camera movement is allowed in Remotion-only mode.**
17. **AI-video camera movement is locked; animation comes from meaningful
    subject/object motion.**
18. **Normal scene text and subtitles are disabled; exact QUOTE overlays
    are retained.**
19. **Selected-scene test runs are supported so expensive models can be
    compared using only one or two scenes.**

------------------------------------------------------------------------

# 32. Future direction

The next major improvement discussed for the engine is an **AI
animation-director step**.

Instead of manually writing:

``` markdown
### AI VIDEO PROMPT
```

an LLM could generate the motion prompt from the scene's:

-   visual description
-   image prompt
-   narration
-   camera instructions
-   reference image

The generated prompt would then be passed to Seedance.

This is a planned enhancement, not a requirement for the current
workflow.

#!/usr/bin/env python3
"""Script-to-video pipeline.

    script.md ──parse──► build ──► images ──► audio ──► (AI video) ──► render ──► MP4

The Markdown script is the only source of truth. Everything under build/,
src/generated/, public/assets/generated/, public/audio/ and public/video/ is
generated and can be deleted and rebuilt. Paid steps (images, audio, video)
reuse earlier results whenever the inputs that produced them are unchanged.

Examples:
  python scripts/orchestrator.py check                 # tools, packages, API keys
  python scripts/orchestrator.py validate              # script problems, no API calls
  python scripts/orchestrator.py all --scenes 001,002  # generate + render two scenes
  python scripts/orchestrator.py render                # render the full video
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import subprocess
import sys
import wave
import hashlib
import time
import math
import re
from urllib.parse import urljoin
from pathlib import Path

import requests
from dotenv import load_dotenv

from script_parser import parse_script
from cost_tracker import CostTracker
from validation import check_environment, validate_project
from cues import resolve_cues, uses_word_cues

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCRIPT = ROOT / "project" / "script.md"
BUILD_DIR = ROOT / "build"
GENERATED_DIR = ROOT / "public" / "assets" / "generated"
SRC_GENERATED_DIR = ROOT / "src" / "generated"
PUBLIC_AUDIO_DIR = ROOT / "public" / "audio"
TIMINGS_TS = ROOT / "src" / "generated" / "audioTimings.ts"
GENERATED_MANIFEST = BUILD_DIR / "audio_manifest.json"
ASSET_META_DIR = BUILD_DIR / "asset_metadata"
GENERATED_VIDEO_DIR = ROOT / "public" / "video"
VIDEO_JOBS_DIR = BUILD_DIR / "video_jobs"

load_dotenv(ROOT / ".env")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"
OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions"
AUDIO_FORMAT = "wav"
# Word-level timestamps (Whisper) are an optional authoring aid: they land in
# audioTimings.ts so you can see on which frame a word is spoken. Off by default
# because nothing in the render depends on them and each call costs money.
ENABLE_WORD_TIMINGS = os.environ.get("ENABLE_WORD_TIMINGS", "false").lower() in {"1", "true", "yes", "on"}
SEGMENT_GAP_SECONDS = float(os.environ.get("TTS_SEGMENT_GAP_SECONDS", "0.12"))


def resolve_models(project: dict) -> dict:
    models = dict(project.get("models") or {})
    config_defaults = {}
    defaults_path = ROOT / "config" / "defaults.json"
    if defaults_path.exists():
        try:
            raw = json.loads(defaults_path.read_text(encoding="utf-8"))
            config_defaults = {
                "image_provider": raw.get("image", {}).get("provider", ""),
                "image_model": raw.get("image", {}).get("model", ""),
                "tts_provider": raw.get("tts", {}).get("provider", ""),
                "tts_model": raw.get("tts", {}).get("model", ""),
                "tts_voice": raw.get("tts", {}).get("voice", ""),
                "video_provider": raw.get("video", {}).get("provider", ""),
                "video_model": raw.get("video", {}).get("model", ""),
                "video_resolution": raw.get("video", {}).get("resolution", "480p"),
                "video_aspect_ratio": raw.get("video", {}).get("aspect_ratio", "16:9"),
                "video_generate_audio": raw.get("video", {}).get("generate_audio", False),
            }
        except Exception as exc:
            raise RuntimeError(f"Invalid {defaults_path}: {exc}") from exc
    defaults = {
        "image_provider": os.environ.get("DEFAULT_IMAGE_PROVIDER", config_defaults.get("image_provider", "openrouter")),
        "image_model": os.environ.get("DEFAULT_IMAGE_MODEL", config_defaults.get("image_model", "google/gemini-3.1-flash-image")),
        "tts_provider": os.environ.get("DEFAULT_TTS_PROVIDER", config_defaults.get("tts_provider", "openai")),
        "tts_model": os.environ.get("DEFAULT_TTS_MODEL", config_defaults.get("tts_model", "gpt-4o-mini-tts")),
        "tts_voice": os.environ.get("DEFAULT_TTS_VOICE", config_defaults.get("tts_voice", "shimmer")),
        "video_provider": os.environ.get("DEFAULT_VIDEO_PROVIDER", config_defaults.get("video_provider", "")),
        "video_model": os.environ.get("DEFAULT_VIDEO_MODEL", config_defaults.get("video_model", "")),
        "video_resolution": os.environ.get("DEFAULT_VIDEO_RESOLUTION", config_defaults.get("video_resolution", "480p")),
        "video_aspect_ratio": os.environ.get("DEFAULT_VIDEO_ASPECT_RATIO", config_defaults.get("video_aspect_ratio", "16:9")),
        "video_generate_audio": str(os.environ.get("DEFAULT_VIDEO_GENERATE_AUDIO", str(config_defaults.get("video_generate_audio", False)))).lower() in {"1", "true", "yes"},
    }
    # script.md is the final authority: explicit values override both .env and defaults.json.
    # `voice` in SETTINGS is the script's shorthand for MODELS tts_voice.
    script_voice = str(project.get("settings", {}).get("voice", "")).strip()
    if script_voice and (not models.get("tts_voice") or str(models["tts_voice"]).lower() == "default"):
        models["tts_voice"] = script_voice
    for key, value in defaults.items():
        if not models.get(key) or str(models[key]).lower() == "default":
            models[key] = value
    models["video_generate_audio"] = str(models.get("video_generate_audio", False)).lower() in {"1", "true", "yes", "on"}
    return models


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def asset_meta_path(kind: str, scene_id: str, suffix: str = "json") -> Path:
    return ASSET_META_DIR / kind / f"scene_{scene_id}.{suffix}"


def load_meta(path: Path) -> dict | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def save_meta(path: Path, data: dict) -> None:
    save_json(path, data)


def scene_image_identity(scene: dict, models: dict, visual_style: dict | None = None) -> str:
    visual_style = visual_style or {}
    payload = {
        "image_model": models["image_model"],
        "image_provider": models["image_provider"],
        "image_prompt": scene.get("image_prompt"),
        "visual": scene.get("visual"),
        "negative_prompt": scene.get("negative_prompt"),
        "reference_images": scene.get("reference_images"),
        "global_visual_identity": visual_style.get("global_visual_identity", ""),
        "style_reference": visual_style.get("style_reference", ""),
    }
    return sha256_text(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def _style_reference_paths(project: dict, scene: dict) -> list[Path]:
    refs: list[str] = []
    global_ref = str((project.get("visual_style") or {}).get("style_reference", "")).strip()
    if global_ref:
        refs.append(global_ref)
    refs.extend([r.strip().lstrip("- ") for r in str(scene.get("reference_images", "")).splitlines() if r.strip()])
    paths: list[Path] = []
    seen: set[str] = set()
    for ref in refs:
        path = ROOT / ref
        key = str(path.resolve())
        if key not in seen:
            paths.append(path)
            seen.add(key)
    return paths


def _global_style_prompt(project: dict) -> str:
    style = project.get("visual_style") or {}
    parts = []
    if style.get("global_visual_identity"):
        parts.append("GLOBAL VISUAL IDENTITY:\n" + str(style["global_visual_identity"]).strip())
    if style.get("camera_style"):
        parts.append("GLOBAL CAMERA STYLE:\n" + str(style["camera_style"]).strip())
    return "\n\n".join(parts)


def scene_audio_identity(scene: dict, models: dict) -> str:
    # TTS prosody depends on the surrounding narration context. Keep a versioned
    # continuity marker here so old scene audio is regenerated after prosody changes.
    payload = {
        "tts_continuity_version": "2.0.0",
        "tts_provider": models["tts_provider"],
        "tts_model": models["tts_model"],
        "tts_voice": models["tts_voice"],
        "segment_gap": SEGMENT_GAP_SECONDS,
        "segments": [{"kind": s["kind"], "language": s["language"], "text": s["text"]} for s in scene["segments"]],
    }
    return sha256_text(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def generation_mode(project: dict) -> str:
    value = str(project.get("settings", {}).get("generation_mode", "remotion")).strip().lower()
    if value not in {"remotion", "ai_video"}:
        raise ValueError(f"Invalid generation_mode: {value}. Use remotion or ai_video.")
    return value


def scene_video_identity(scene: dict, models: dict, image_identity: str, duration: int, clip_index: int = 1, prompt: str = "") -> str:
    payload = {
        "video_provider": models["video_provider"],
        "video_model": models["video_model"],
        "video_resolution": models["video_resolution"],
        "video_aspect_ratio": models["video_aspect_ratio"],
        "video_generate_audio": models["video_generate_audio"],
        "duration": duration,
        "clip_index": clip_index,
        "image_identity": image_identity,
        "animation_prompt": prompt or scene.get("ai_video_prompt") or scene.get("visual", ""),
        "negative_prompt": scene.get("negative_prompt", ""),
        "continuity": scene.get("continuity", ""),
        "visual_anchor": scene.get("visual_anchor", ""),
        "start_state": scene.get("start_state", ""),
        "end_state": scene.get("end_state", ""),
    }
    return sha256_text(json.dumps(payload, ensure_ascii=False, sort_keys=True))


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def require_command(command: str) -> str:
    resolved = shutil.which(command)
    if not resolved:
        raise RuntimeError(f"Required command not found: {command}. Install it before running this step.")
    return resolved


def probe_duration(path: Path) -> float:
    ffprobe = require_command("ffprobe")
    result = subprocess.run(
        [ffprobe, "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(result.stdout.strip())


def image_data_url(path: Path) -> str:
    mime = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}.get(path.suffix.lower())
    if not mime:
        raise ValueError(f"Unsupported reference image type: {path}")
    return f"data:{mime};base64,{base64.b64encode(path.read_bytes()).decode('utf-8')}"


def write_ts_module(name: str, export: str, data: object, note: str) -> None:
    SRC_GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    (SRC_GENERATED_DIR / name).write_text(
        f"// AUTO-GENERATED {note}. Do not edit manually.\n"
        f"export const {export} = {json.dumps(data, ensure_ascii=False, indent=2)} as const;\n",
        encoding="utf-8",
    )


def write_generated_content(project: dict) -> None:
    """Write the TypeScript modules Remotion reads: content, config, and (if absent) timings."""
    write_ts_module("videoContent.ts", "VIDEO_CONTENT", {"scenes": project["scenes"]}, f"from {project_source(project)}")
    write_ts_module(
        "videoConfig.ts", "VIDEO_CONFIG",
        {**project["settings"], "models": project.get("models", {}), "music": project.get("music", {}),
         "intro": project.get("intro", {}), "ending": project.get("ending", {})},
        f"from {project_source(project)}",
    )
    if not TIMINGS_TS.exists():
        write_timings({})


def project_source(project: dict) -> str:
    source = Path(project.get("source", ""))
    try:
        return source.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return source.as_posix()


def build(script_path: Path) -> dict:
    """Parse the script, resolve models, and write the generated modules. No API calls."""
    project = parse_script(script_path)
    project["models"] = resolve_models(project)
    for scene in project["scenes"]:
        video_meta = load_meta(asset_meta_path("videos", scene["scene_id"]))
        if generation_mode(project) == "ai_video" and not scene.get("motion_scene") and video_meta and video_meta.get("clips"):
            scene["video_clips"] = video_meta["clips"]
    # Measured narration (if any) times the scenes and turns word cues into frames.
    tracks = current_tracks(project)
    fps = int(project["settings"]["fps"])
    for scene in project["scenes"]:
        resolve_cues(scene, tracks.get(scene["scene_id"]), fps)
    save_json(BUILD_DIR / "parsed_script.json", project)
    write_generated_content(project)
    write_timings(tracks)
    print(f"Parsed {len(project['scenes'])} scene(s) from {project_source(project)}")
    return project


def current_tracks(project: dict) -> dict:
    """Narration tracks whose audio is on disk and still matches the script."""
    if not shutil.which("ffprobe"):
        return {}
    manifest = load_meta(GENERATED_MANIFEST) or {}
    tracks = {}
    for scene in project["scenes"]:
        track, _ = valid_audio_track(project, scene, manifest)
        if track:
            tracks[scene["scene_id"]] = track
    return tracks


def needs_image(scene: dict) -> bool:
    """Motion scenes are drawn by the motion engine; every other scene needs a still image."""
    return not scene.get("motion_scene")


def generate_image(project: dict, scene: dict, tracker: CostTracker | None = None) -> None:
    models = project["models"]
    output = GENERATED_DIR / f"scene_{scene['scene_id']}.png"
    meta_path = asset_meta_path("images", scene["scene_id"])
    identity = scene_image_identity(scene, models, project.get("visual_style"))
    existing = load_meta(meta_path)
    if output.exists() and existing and existing.get("content_hash") == identity:
        print(f"Reusing image: {output}")
        return

    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set. Put it in .env or export it in the shell.")
    prompt = scene.get("image_prompt") or scene.get("visual", "")
    style_prompt = _global_style_prompt(project)
    if style_prompt:
        prompt = style_prompt + "\n\nSCENE-SPECIFIC VISUAL DIRECTION:\n" + prompt
    continuity = str(scene.get("continuity", "")).strip()
    anchor = str(scene.get("visual_anchor", "")).strip()
    if continuity:
        prompt += f"\n\nCONTINUITY MODE: {continuity}. Preserve the established visual language and composition appropriate to this mode."
    if anchor:
        prompt += f"\nVISUAL ANCHOR: {anchor}"
    negative = scene.get("negative_prompt")
    if negative:
        prompt += "\n\nAvoid the following:\n" + negative
    payload = {"model": models["image_model"], "prompt": prompt, "aspect_ratio": "16:9", "resolution": "2K", "usage": {"include": True}}
    references = []
    for reference_path in _style_reference_paths(project, scene):
        if not reference_path.exists(): raise FileNotFoundError(f"Reference image not found: {reference_path}")
        references.append({"type": "image_url", "image_url": {"url": image_data_url(reference_path)}})
    if references: payload["input_references"] = references
    response = requests.post(f"{OPENROUTER_BASE_URL}/images", headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=180)
    if not response.ok: raise RuntimeError(f"OpenRouter image generation failed ({response.status_code}):\n{response.text}")
    result = response.json(); data = (result.get("data") or [])
    if not data or not data[0].get("b64_json"): raise RuntimeError("OpenRouter response contains no data[0].b64_json.")
    if tracker is not None:
        usage = result.get("usage") or {}; reported_cost = usage.get("cost")
        tracker.record(provider=models["image_provider"], operation="image_generation", model=models["image_model"], scene_id=scene["scene_id"], cost_usd=float(reported_cost) if reported_cost is not None else None, cost_status="provider_reported" if reported_cost is not None else "not_returned", usage=usage, request_id=response.headers.get("x-request-id"), note=None if reported_cost is not None else "Provider did not include usage.cost in this response.")
    output.parent.mkdir(parents=True, exist_ok=True); output.write_bytes(base64.b64decode(data[0]["b64_json"]))
    save_meta(meta_path, {"version":"1.0.0","kind":"image","scene_id":scene["scene_id"],"content_hash":identity,"provider":models["image_provider"],"model":models["image_model"],"file":str(output.relative_to(ROOT)).replace("\\","/")})
    print(f"Generated image: {output}")

def parse_scene_selection(value: str | None, project: dict) -> list[str]:
    """Return selected scene IDs, preserving script order. Empty selection means all scenes."""
    if not value:
        return [str(s["scene_id"]) for s in project["scenes"]]
    requested = {part.strip() for part in value.split(",") if part.strip()}
    available = [str(s["scene_id"]) for s in project["scenes"]]
    unknown = sorted(requested - set(available))
    if unknown:
        raise ValueError(f"Unknown scene ID(s): {', '.join(unknown)}. Available: {', '.join(available)}")
    return [sid for sid in available if sid in requested]


def selected_scenes(project: dict, scene_selection: str | None) -> list[dict]:
    ids = set(parse_scene_selection(scene_selection, project))
    return [scene for scene in project["scenes"] if str(scene["scene_id"]) in ids]


def generate_images(project: dict, tracker: CostTracker | None = None, scene_selection: str | None = None) -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    scenes = [s for s in selected_scenes(project, scene_selection) if needs_image(s)]
    if not scenes:
        print("No image scenes selected (motion scenes need no image).")
    for scene in scenes:
        generate_image(project, scene, tracker)


DEFAULT_NARRATOR = {
    "es": (
        "Speak as a warm, natural adult female narrator from Spain. "
        "Use a clearly native Spanish from Spain (Castilian) accent. "
        "Voice: warm, empathetic, and professional, reassuring the listener that the subject is understood. "
        "Punctuation: well-structured with natural pauses, allowing for clarity and a steady, calming flow. "
        "Delivery: calm and patient, with a supportive and understanding tone. "
        "Phrasing: clear and concise, natural for a documentary/explainer narration, avoiding unnecessary jargon. "
        "Tone: empathetic and solution-focused, with warmth and reassurance, without exaggerated acting."
    ),
    "en": (
        "Speak as the same adult female narrator, using fully native American English pronunciation. "
        "Keep the delivery natural and idiomatic. For a quotation, sound like a factual documentary quote, "
        "with appropriate emphasis but no exaggerated acting."
    ),
}


def instructions_for(language: str, kind: str, previous_text: str = "", next_text: str = "", narrator: dict | None = None) -> str:
    """TTS voice direction: the script's NARRATOR section for this language, else the defaults above."""
    continuity = (
        "This is one continuous documentary narration. The audio before and after this segment "
        "belongs to the same uninterrupted narration. Preserve the same speaking energy, pitch, "
        "rhythm, pacing and emotional register across the boundary. Do not reset the voice at the "
        "start of this segment. Do not add an artificial opening cadence. If the text continues the "
        "previous thought, begin naturally as a continuation. If the segment ends mid-thought, do "
        "not add a concluding cadence. Let punctuation and meaning, not the scene boundary, control "
        "intonation."
    )
    if previous_text:
        continuity += f" Previous narration context (do not speak it): {previous_text.strip()}"
    if next_text:
        continuity += f" Following narration context (do not speak it): {next_text.strip()}"
    lang = language.lower().split("-")[0]
    direction = (narrator or {}).get(lang) or DEFAULT_NARRATOR.get(lang) or DEFAULT_NARRATOR["en"]
    return direction.strip() + " " + continuity


def build_voice_manifest(project: dict) -> dict:
    models = project["models"]
    tracks = {}

    # Build one ordered narration stream so every TTS request knows what was
    # spoken immediately before and after it, including across scene boundaries.
    ordered = []
    for scene in project["scenes"]:
        for item in scene["segments"]:
            ordered.append((scene["scene_id"], item))

    neighbors = {}
    for index, (scene_id, item) in enumerate(ordered):
        previous_text = ordered[index - 1][1]["text"] if index > 0 else ""
        next_text = ordered[index + 1][1]["text"] if index + 1 < len(ordered) else ""
        neighbors[item["id"]] = (previous_text, next_text)

    for scene in project["scenes"]:
        segments = []
        for item in scene["segments"]:
            language = item["language"]
            previous_text, next_text = neighbors.get(item["id"], ("", ""))
            segments.append({
                "id": item["id"],
                "kind": item["kind"],
                "language": language,
                "voice": models["tts_voice"],
                "speed": 1.0,
                "instructions": instructions_for(language, item["kind"], previous_text, next_text, project.get("narrator")),
                "text": item["text"],
            })
        tracks[scene["scene_id"]] = segments
    return {"version":"3.2.0","source_of_truth":"project/script.md","provider":models["tts_provider"],"model":models["tts_model"],"voice":models["tts_voice"],"voice_profile":"female_sounding","tracks":tracks}

def tts_request(segment: dict, output_path: Path, tracker: CostTracker | None = None, scene_id: str | None = None, models: dict | None = None) -> None:
    models = models or {"tts_provider":"openai", "tts_model":os.environ.get("DEFAULT_TTS_MODEL", "gpt-4o-mini-tts")}
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key: raise RuntimeError("OPENAI_API_KEY is not set. Put it in .env or export it in the shell.")
    payload = {"model": models["tts_model"], "voice": segment["voice"], "input": segment["text"], "instructions": segment["instructions"], "response_format": AUDIO_FORMAT, "speed": segment.get("speed", 1.0)}
    response = requests.post(OPENAI_TTS_URL, headers={"Authorization":f"Bearer {api_key}","Content-Type":"application/json"}, json=payload, timeout=180)
    if not response.ok: raise RuntimeError(f"OpenAI TTS failed ({response.status_code}) for {segment['id']}:\n{response.text}")
    output_path.parent.mkdir(parents=True, exist_ok=True); output_path.write_bytes(response.content)
    if tracker is not None:
        tracker.record(provider=models["tts_provider"], operation="text_to_speech", model=models["tts_model"], scene_id=scene_id, segment_id=segment["id"], cost_usd=None, cost_status="not_returned_by_endpoint", usage={"input_characters":len(segment["text"])}, request_id=response.headers.get("x-request-id"), note="OpenAI Speech API does not document a per-request cost field.")
    print(f"Generated TTS: {output_path}")

def _normalise_word(value: str) -> str:
    return "".join(ch.lower() for ch in value if ch.isalnum())


def transcribe_word_timings(path: Path, tracker: CostTracker | None = None, scene_id: str | None = None, segment_id: str | None = None) -> list[dict]:
    """Return word-level timestamps for a generated TTS segment.

    Whisper-1 is used only for alignment; the narration text in script.md
    remains authoritative. The returned timestamps are relative to this
    segment's WAV file.
    """
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Put it in .env or export it in the shell.")
    with path.open("rb") as audio_file:
        response = requests.post(
            OPENAI_TRANSCRIPTIONS_URL,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"file": (path.name, audio_file, "audio/wav")},
            data={
                "model": "whisper-1",
                "response_format": "verbose_json",
                "timestamp_granularities[]": "word",
            },
            timeout=180,
        )
    if not response.ok:
        raise RuntimeError(f"OpenAI transcription failed ({response.status_code}) for {path.name}:\n{response.text}")
    payload = response.json()
    words = []
    for item in payload.get("words", []) or []:
        word = str(item.get("word", "")).strip()
        if not word:
            continue
        words.append({
            "word": word,
            "start_seconds": round(float(item.get("start", 0.0)), 3),
            "end_seconds": round(float(item.get("end", 0.0)), 3),
        })
    if tracker is not None:
        tracker.record(
            provider="openai",
            operation="audio_transcription_alignment",
            model="whisper-1",
            scene_id=scene_id,
            segment_id=segment_id,
            cost_usd=None,
            cost_status="not_returned_by_endpoint",
            usage={"audio_seconds": round(float(payload.get("duration", 0.0) or 0.0), 3)},
            note="Used only to obtain word-level timestamps for narration/animation alignment.",
        )
    return words


def build_phrase_timings(text: str, words: list[dict], segment_id: str) -> list[dict]:
    """Map punctuation-delimited phrases in the source text onto aligned words."""
    raw_phrases = [p.strip() for p in re.split(r"(?<=[.!?;:])\s+", text.strip()) if p.strip()]
    if not raw_phrases or not words:
        return []
    token_counts = [len(re.findall(r"\S+", phrase)) for phrase in raw_phrases]
    if sum(token_counts) != len(words):
        # Whisper may merge/split punctuation differently. Fall back to a
        # proportional partition while keeping the source text authoritative.
        total_chars = max(1, sum(len(p) for p in raw_phrases))
        cursor = 0
        phrase_timings = []
        for index, phrase in enumerate(raw_phrases):
            if index == len(raw_phrases) - 1:
                end = len(words)
            else:
                target = len(words) * len(phrase) / total_chars
                end = max(cursor + 1, min(len(words) - (len(raw_phrases) - index - 1), round(cursor + target)))
            chunk = words[cursor:end]
            cursor = end
            if not chunk:
                continue
            phrase_timings.append({
                "id": f"{segment_id}_p{index + 1:02d}",
                "text": phrase,
                "start_seconds": chunk[0]["start_seconds"],
                "end_seconds": chunk[-1]["end_seconds"],
                "duration_seconds": round(chunk[-1]["end_seconds"] - chunk[0]["start_seconds"], 3),
            })
        return phrase_timings
    phrase_timings = []
    cursor = 0
    for index, count in enumerate(token_counts):
        chunk = words[cursor:cursor + count]
        cursor += count
        if not chunk:
            continue
        phrase_timings.append({
            "id": f"{segment_id}_p{index + 1:02d}",
            "text": raw_phrases[index],
            "start_seconds": chunk[0]["start_seconds"],
            "end_seconds": chunk[-1]["end_seconds"],
            "duration_seconds": round(chunk[-1]["end_seconds"] - chunk[0]["start_seconds"], 3),
        })
    return phrase_timings


def make_silent_wav(path: Path, seconds: float, sample_rate: int = 44100) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(sample_rate)
        wav.writeframes(b"\x00\x00" * int(seconds * sample_rate))


def concat_audio(segment_paths: list[Path], output_path: Path) -> None:
    ffmpeg = require_command("ffmpeg")
    gap_file = output_path.parent / "_tts_gap.wav"
    list_file = output_path.parent / f"{output_path.stem}.concat.txt"
    make_silent_wav(gap_file, SEGMENT_GAP_SECONDS)
    entries: list[Path] = []
    for index, path in enumerate(segment_paths):
        entries.append(path)
        if index < len(segment_paths) - 1:
            entries.append(gap_file)
    list_file.write_text("".join(f"file '{p.resolve().as_posix()}'\n" for p in entries), encoding="utf-8")
    try:
        subprocess.run([ffmpeg, "-y", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", str(output_path)], check=True, capture_output=True, text=True)
    finally:
        list_file.unlink(missing_ok=True); gap_file.unlink(missing_ok=True)


def align_words(track: dict, scene: dict, tracker: CostTracker | None) -> dict:
    """Add Whisper word timings to segments that lack them.

    Done automatically for scenes whose motion is timed to spoken words, and for
    every scene when ENABLE_WORD_TIMINGS is on.
    """
    scene_id = scene["scene_id"]
    if not (ENABLE_WORD_TIMINGS or uses_word_cues(scene)):
        return track
    segments = []
    for seg in track.get("segments", []):
        seg = dict(seg)
        path = BUILD_DIR / seg.get("file", "")
        if not seg.get("words") and path.is_file():
            seg["words"] = transcribe_word_timings(path, tracker, scene_id, seg.get("id"))
            seg["phrases"] = build_phrase_timings(seg.get("text", ""), seg["words"], seg.get("id", "segment"))
        segments.append(seg)
    return {**track, "segments": segments}


def write_timings(tracks: dict) -> None:
    """audioTimings.ts: measured scene and segment timings, in the camelCase shape MainVideo reads."""
    timings = {
        sid: {
            "durationSeconds": t["duration_seconds"],
            "audioFile": t["file"],
            "segments": [
                {
                    "id": s["id"], "kind": s["kind"], "language": s["language"],
                    "startSeconds": s["start_seconds"], "durationSeconds": s["duration_seconds"], "text": s["text"],
                    **({"words": s["words"], "phrases": s.get("phrases", [])} if s.get("words") else {}),
                }
                for s in t["segments"]
            ],
        }
        for sid, t in sorted(tracks.items())
    }
    write_ts_module("audioTimings.ts", "AUDIO_TIMINGS", timings, "from measured narration audio")


def valid_audio_track(project: dict, scene: dict, manifest: dict) -> tuple[dict | None, str]:
    """The manifest track for a scene if its audio file exists and matches the current script, else a reason."""
    sid = scene["scene_id"]
    public_path = PUBLIC_AUDIO_DIR / f"scene_{sid}.wav"
    meta = load_meta(asset_meta_path("audio", sid))
    track = manifest.get("tracks", {}).get(sid)
    if not public_path.exists():
        return None, f"missing {public_path.relative_to(ROOT)}"
    if not meta or meta.get("content_hash") != scene_audio_identity(scene, project["models"]):
        return None, "narration text, voice or TTS model changed since the audio was made"
    if not track:
        return None, "no timing record (run the audio step)"
    duration = probe_duration(public_path)
    if abs(duration - float(track.get("duration_seconds", -1))) > 0.02:
        return None, "audio file length differs from its timing record"
    return {**track, "duration_seconds": round(duration, 3)}, ""


def generate_audio(project: dict, tracker: CostTracker | None = None, scene_selection: str | None = None) -> None:
    require_command("ffmpeg"); require_command("ffprobe")
    models = project["models"]
    config = build_voice_manifest(project)
    # Start from the existing manifest so a partial run never drops other scenes.
    manifest = load_meta(GENERATED_MANIFEST) or {}
    tracks = dict(manifest.get("tracks", {}))
    selected_ids = set(parse_scene_selection(scene_selection, project))

    for scene in project["scenes"]:
        scene_id = scene["scene_id"]
        if scene_id not in selected_ids:
            continue
        existing, _ = valid_audio_track(project, scene, manifest)
        if existing:
            print(f"Reusing audio: scene {scene_id}")
            tracks[scene_id] = align_words(existing, scene, tracker)
            continue

        scene_dir = BUILD_DIR / "audio" / scene_id
        scene_dir.mkdir(parents=True, exist_ok=True)
        final_path = BUILD_DIR / "audio" / f"scene_{scene_id}.wav"
        public_path = PUBLIC_AUDIO_DIR / final_path.name
        segment_paths = []; generated = []; cursor = 0.0
        segments = config["tracks"][scene_id]
        for index, segment in enumerate(segments):
            path = scene_dir / f"{segment['id']}.wav"
            tts_request(segment, path, tracker, scene_id, models)
            duration = probe_duration(path)
            generated.append({
                **segment,
                "file": str(path.relative_to(BUILD_DIR)).replace("\\", "/"),
                "start_seconds": round(cursor, 3),
                "duration_seconds": round(duration, 3),
            })
            segment_paths.append(path)
            cursor += duration + (SEGMENT_GAP_SECONDS if index < len(segments) - 1 else 0)
        concat_audio(segment_paths, final_path)
        final_duration = probe_duration(final_path)
        public_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(final_path, public_path)
        tracks[scene_id] = align_words(
            {"file": f"audio/{final_path.name}", "duration_seconds": round(final_duration, 3), "segments": generated},
            scene, tracker,
        )
        save_meta(asset_meta_path("audio", scene_id), {
            "version": "1.0.0", "kind": "audio", "scene_id": scene_id,
            "content_hash": scene_audio_identity(scene, models),
            "provider": models["tts_provider"], "model": models["tts_model"], "voice": models["tts_voice"],
            "file": str(public_path.relative_to(ROOT)).replace("\\", "/"),
        })
        print(f"Scene {scene_id}: {final_duration:.2f}s -> {public_path}")

    save_json(GENERATED_MANIFEST, {**config, "generated": True, "segment_gap_seconds": SEGMENT_GAP_SECONDS, "tracks": tracks})
    write_timings(tracks)
    print(f"Generated timings: {TIMINGS_TS}")


def rebuild_audio_timings(project: dict, scene_selection: str | None = None) -> dict:
    """Rewrite audioTimings.ts from existing audio only (never calls TTS).

    Selected scenes must have valid audio (or this raises). Other scenes are
    included when their audio is still valid, so Studio previews stay complete.
    Returns the valid tracks.
    """
    require_command("ffprobe")
    manifest = load_meta(GENERATED_MANIFEST) or {}
    selected_ids = set(parse_scene_selection(scene_selection, project))
    tracks: dict = {}
    problems = []
    for scene in project["scenes"]:
        track, reason = valid_audio_track(project, scene, manifest)
        if track:
            tracks[scene["scene_id"]] = track
        elif scene["scene_id"] in selected_ids:
            problems.append(f"scene {scene['scene_id']}: {reason}")
    if problems:
        raise RuntimeError("Narration audio is missing or out of date. Run the audio step first.\n  " + "\n  ".join(problems))
    write_timings(tracks)
    return tracks


MAX_VIDEO_CLIP_SECONDS = 15
MIN_VIDEO_CLIP_SECONDS = 4


def _scene_duration_from_audio(scene: dict) -> float:
    audio_path = PUBLIC_AUDIO_DIR / f"scene_{scene['scene_id']}.wav"
    if not audio_path.exists():
        raise RuntimeError(f"Missing audio for scene {scene['scene_id']}: {audio_path}")
    return probe_duration(audio_path)


def build_video_clip_plan(scene: dict, scene_duration: float) -> list[dict]:
    """Split a scene into non-looped Seedance clips and attach the narration context.

    The plan is deterministic and content-based. Long scenes are split into <=15s clips;
    each clip receives the segment text that overlaps its time window so the motion prompt
    follows the narration instead of repeating the same animation.
    """
    clips: list[dict] = []
    start = 0.0
    index = 1
    segments = scene.get("segments", [])
    # Timing is rebuilt from the actual concatenated TTS track. Use the manifest when available.
    manifest = load_meta(GENERATED_MANIFEST) or {}
    track = manifest.get("tracks", {}).get(scene["scene_id"], {})
    timed_segments = track.get("segments", [])
    if not timed_segments:
        timed_segments = [{"id": s["id"], "text": s["text"], "kind": s["kind"], "language": s["language"], "start_seconds": 0.0, "duration_seconds": scene_duration} for s in segments[:1]]

    while start < scene_duration - 0.001:
        remaining = scene_duration - start
        duration = min(float(MAX_VIDEO_CLIP_SECONDS), remaining)
        if remaining > MAX_VIDEO_CLIP_SECONDS and remaining - MAX_VIDEO_CLIP_SECONDS < MIN_VIDEO_CLIP_SECONDS:
            duration = remaining / 2.0
        end = min(scene_duration, start + duration)
        active = []
        for seg in timed_segments:
            seg_start = float(seg.get("start_seconds", 0.0))
            seg_end = seg_start + float(seg.get("duration_seconds", 0.0))
            if seg_end > start and seg_start < end:
                active.append(seg)
        clips.append({"clip_index": index, "start_seconds": round(start, 3), "duration_seconds": round(end - start, 3), "end_seconds": round(end, 3), "segments": active})
        start = end
        index += 1
    return clips


def build_motion_prompt(scene: dict, clip: dict, clip_count: int, project: dict | None = None) -> str:
    project = project or {}
    base = scene.get("ai_video_prompt") or scene.get("visual", "")
    global_style = _global_style_prompt(project)
    phase = []
    for seg in clip.get("segments", []):
        text = str(seg.get("text", "")).strip()
        if len(text) > 260:
            text = text[:257].rsplit(" ", 1)[0] + "..."
        if text:
            phase.append(f"{seg.get('kind','voiceover').upper()} ({seg.get('language','')}) idea: {text}")
    phase_text = "\n".join(phase) if phase else "Follow the visual progression of this scene."
    continuity = str(scene.get("continuity", "new_scene")).strip().lower() or "new_scene"
    anchor = str(scene.get("visual_anchor", "")).strip()
    start_state = str(scene.get("start_state", "")).strip()
    end_state = str(scene.get("end_state", "")).strip()
    camera = str(scene.get("camera", "")).strip()
    camera_style = str((project.get("visual_style") or {}).get("camera_style", "")).strip()

    if clip["clip_index"] == 1:
        motion = "Begin with a calm establishing movement that introduces the main visual subject."
        if start_state:
            motion += f" Start from this state: {start_state}"
    elif clip["clip_index"] == clip_count:
        motion = "Conclude with a restrained movement toward the visual idea being discussed at the end of the scene."
        if end_state:
            motion += f" End in this state: {end_state}"
    else:
        motion = "Continue the same visual shot and motion language. Introduce only the minimum new movement needed to support the narration; do not reset the composition."

    if continuity in {"continuous", "same_shot", "locked"}:
        continuity_rule = (
            "CONTINUITY IS CRITICAL: Treat all clips in this scene as one continuous shot. "
            "Preserve the same framing, camera position, perspective, subject scale, lighting, palette, "
            "and object layout. Do not create a new composition between clips. Only continue the existing motion."
        )
    elif continuity in {"transition", "linked"}:
        continuity_rule = (
            "CONTINUITY: Connect naturally to the previous visual idea. Preserve shared visual motifs, "
            "palette, lighting and camera language while allowing the scene to evolve toward its new anchor."
        )
    else:
        continuity_rule = (
            "SCENE INTRODUCTION: Establish the same global visual language as the rest of the film. "
            "Introduce this scene cleanly without changing the overall style."
        )

    return f"""Animate this supplied visual illustration as a stable documentary motion-graphics shot.

{global_style}

SCENE-SPECIFIC VISUAL DIRECTION:
{base}

{continuity_rule}
VISUAL ANCHOR: {anchor or 'Keep the main subject visually consistent throughout the scene.'}
AI VIDEO CAMERA: LOCKED STATIC. Ignore any Remotion camera direction in the script. Never pan, zoom, dolly, orbit, rotate or shake the camera.

This is clip {clip['clip_index']} of {clip_count}, covering approximately {clip['start_seconds']:.1f}s to {clip['end_seconds']:.1f}s of the scene. {motion}
Narration context for this time window:
{phase_text}

Preserve the original illustration's composition, colors, linework, object identity and geometry. Do not redraw, morph, deform or reinterpret the artwork. Do not generate readable text, letters, numbers, labels, UI or captions. Use meaningful, clearly visible animation of already-existing visual elements. Every motion should directly illustrate the narration: agents activate, packets travel, boundaries are crossed, systems saturate, nodes connect, alarms escalate, or processes shut down. No camera shake, no handheld motion, no flicker, no warping, no morphing, no object deformation, no random zoom, no spinning camera, no new objects, no photorealism, no typography animation. Maintain the same visual style across the entire film."""


def _video_data_url(path: Path) -> str:
    return image_data_url(path)


def _poll_video_job(api_key: str, polling_url: str, job_id: str) -> dict:
    deadline = time.monotonic() + float(os.environ.get("VIDEO_POLL_TIMEOUT_SECONDS", "3600"))
    interval = float(os.environ.get("VIDEO_POLL_INTERVAL_SECONDS", "30"))
    url = urljoin("https://openrouter.ai", polling_url)
    while True:
        response = requests.get(url, headers={"Authorization": f"Bearer {api_key}"}, timeout=60)
        if not response.ok:
            raise RuntimeError(f"OpenRouter video polling failed ({response.status_code}) for {job_id}:\n{response.text}")
        job = response.json()
        status = job.get("status")
        print(f"Video job {job_id}: {status}")
        if status == "completed":
            return job
        if status in {"failed", "cancelled", "expired"}:
            raise RuntimeError(f"OpenRouter video job {job_id} ended with status {status}: {job.get('error', 'Unknown error')}")
        if status not in {"pending", "in_progress"}:
            raise RuntimeError(f"OpenRouter video job {job_id} returned unexpected status: {status}")
        if time.monotonic() >= deadline:
            raise TimeoutError(f"OpenRouter video job {job_id} did not complete within the configured timeout.")
        time.sleep(interval)


def _download_video(api_key: str, job: dict, output_path: Path) -> None:
    urls = job.get("unsigned_urls") or []
    url = urls[0] if urls else f"{OPENROUTER_BASE_URL}/videos/{job['id']}/content?index=0"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, headers={"Authorization": f"Bearer {api_key}"}, stream=True, timeout=300) as response:
        if not response.ok:
            raise RuntimeError(f"OpenRouter video download failed ({response.status_code}):\n{response.text}")
        with output_path.open("wb") as handle:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    handle.write(chunk)


def generate_video_for_scene(project: dict, scene: dict, tracker: CostTracker | None = None) -> None:
    models = project["models"]
    if not models.get("video_provider") or models.get("video_provider") == "default" or not models.get("video_model"):
        raise RuntimeError("Video generation is enabled but no video provider/model is configured. Set video_provider/video_model in project/script.md or defaults/.env.")
    if models["video_provider"].lower() != "openrouter":
        raise RuntimeError(f"Unsupported video provider: {models['video_provider']}. The current video adapter supports openrouter.")
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set. Put it in .env or export it in the shell.")
    image_path = GENERATED_DIR / f"scene_{scene['scene_id']}.png"
    if not image_path.exists():
        raise RuntimeError(f"Missing generated image for video scene {scene['scene_id']}: {image_path}. Run the images step first.")

    audio_meta = load_meta(asset_meta_path("audio", scene["scene_id"]))
    audio_path = PUBLIC_AUDIO_DIR / f"scene_{scene['scene_id']}.wav"
    if not audio_path.exists() or not audio_meta:
        raise RuntimeError(f"Missing validated audio for scene {scene['scene_id']}. Run the audio step first.")
    expected_audio_identity = scene_audio_identity(scene, models)
    if audio_meta.get("content_hash") != expected_audio_identity:
        raise RuntimeError(f"Audio for scene {scene['scene_id']} does not match the current script/TTS configuration. Run: python scripts/orchestrator.py audio project/script.md")

    scene_duration = _scene_duration_from_audio(scene)
    plan = build_video_clip_plan(scene, scene_duration)
    image_identity = sha256_file(image_path)
    meta_path = asset_meta_path("videos", scene["scene_id"])
    existing = load_meta(meta_path) or {}
    existing_clips = existing.get("clips", [])
    clip_records = []

    for clip in plan:
        clip_index = int(clip["clip_index"])
        requested_duration = int(max(MIN_VIDEO_CLIP_SECONDS, min(MAX_VIDEO_CLIP_SECONDS, math.ceil(float(clip["duration_seconds"])))) )
        prompt = build_motion_prompt(scene, clip, len(plan), project)
        identity = scene_video_identity(scene, models, image_identity, round(requested_duration, 3), clip_index, prompt)
        output = GENERATED_VIDEO_DIR / f"scene_{scene['scene_id']}_{clip_index:02d}.mp4"
        old = next((c for c in existing_clips if int(c.get("clip_index", -1)) == clip_index), None)
        if output.exists() and old and old.get("content_hash") == identity:
            print(f"Reusing video clip: {output}")
            clip_records.append({"clip_index": clip_index, "start_seconds": clip["start_seconds"], "duration_seconds": clip["duration_seconds"], "file": str(output.relative_to(ROOT)).replace("\\", "/"), "content_hash": identity})
            continue

        payload = {
            "model": models["video_model"],
            "prompt": prompt,
            "duration": round(requested_duration, 3),
            "resolution": models["video_resolution"],
            "aspect_ratio": models["video_aspect_ratio"],
            "generate_audio": bool(models["video_generate_audio"]),
            "frame_images": [{"type": "image_url", "image_url": {"url": _video_data_url(image_path)}, "frame_type": "first_frame"}],
        }
        print(f"Generating AI video clip {scene['scene_id']}.{clip_index:02d} ({requested_duration:.1f}s, {models['video_resolution']})...")
        response = requests.post(f"{OPENROUTER_BASE_URL}/videos", headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, json=payload, timeout=60)
        if not response.ok:
            raise RuntimeError(f"OpenRouter video generation failed ({response.status_code}):\n{response.text}")
        submitted = response.json()
        job_id = submitted.get("id")
        polling_url = submitted.get("polling_url")
        if not job_id or not polling_url:
            raise RuntimeError(f"OpenRouter video response did not contain id/polling_url: {submitted}")
        job_record = {"scene_id": scene["scene_id"], "clip_index": clip_index, "job_id": job_id, "polling_url": polling_url, "model": models["video_model"], "status": submitted.get("status", "pending"), "submitted_at": time.time()}
        save_json(VIDEO_JOBS_DIR / f"scene_{scene['scene_id']}_{clip_index:02d}.json", job_record)
        completed = _poll_video_job(api_key, polling_url, job_id)
        _download_video(api_key, completed, output)
        # Normalize the downloaded clip to the exact narration window so clip boundaries
        # remain deterministic even when the provider returns a slightly different duration.
        target_seconds = float(clip["duration_seconds"])
        normalized = output.with_suffix(".normalized.mp4")
        ffmpeg = require_command("ffmpeg")
        subprocess.run([ffmpeg, "-y", "-i", str(output), "-t", f"{target_seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", "-pix_fmt", "yuv420p", str(normalized)], check=True, capture_output=True, text=True)
        normalized.replace(output)
        usage = completed.get("usage") or {}
        reported_cost = usage.get("cost")
        if tracker is not None:
            tracker.record(provider=models["video_provider"], operation="video_generation", model=models["video_model"], scene_id=scene["scene_id"], cost_usd=float(reported_cost) if reported_cost is not None else None, cost_status="provider_reported" if reported_cost is not None else "not_returned", usage=usage, request_id=job_id, note=f"OpenRouter asynchronous video generation, clip {clip_index}")
        clip_records.append({"clip_index": clip_index, "start_seconds": clip["start_seconds"], "duration_seconds": clip["duration_seconds"], "file": str(output.relative_to(ROOT)).replace("\\", "/"), "content_hash": identity, "openrouter_job_id": job_id})
        print(f"Generated video clip: {output}")

    meta = {"version":"2.0.0", "kind":"video", "scene_id":scene["scene_id"], "provider":models["video_provider"], "model":models["video_model"], "resolution":models["video_resolution"], "aspect_ratio":models["video_aspect_ratio"], "scene_duration_seconds":round(scene_duration,3), "clips":clip_records}
    save_meta(meta_path, meta)
    scene["video_clips"] = clip_records


def generate_videos(project: dict, tracker: CostTracker | None = None, scene_selection: str | None = None) -> None:
    if generation_mode(project) != "ai_video":
        print("generation_mode=remotion; skipping AI video generation.")
        return
    require_command("ffprobe")
    models = project["models"]
    if models.get("video_provider") in {"", "default"} or models.get("video_model") in {"", "default"}:
        raise RuntimeError("No video model configured. Set video_provider and video_model in the script's MODELS section.")
    for scene in selected_scenes(project, scene_selection):
        if needs_image(scene):  # motion scenes are not sent to the video model
            generate_video_for_scene(project, scene, tracker)
    write_generated_content(project)


def render(project: dict, scene_selection: str | None = None) -> Path:
    problems = [p for p in check_environment(project) if "API_KEY" not in p]
    if problems:
        raise RuntimeError("Cannot render:\n  " + "\n  ".join(problems))
    scenes = selected_scenes(project, scene_selection)
    print("Rendering scenes: " + ", ".join(s["scene_id"] for s in scenes))

    tracks = rebuild_audio_timings(project, scene_selection)
    fps = int(project["settings"]["fps"])
    for scene in project["scenes"]:  # time word cues with the audio being rendered
        resolve_cues(scene, tracks.get(scene["scene_id"]), fps)
    write_generated_content(project)
    frames = {sid: math.ceil(t["duration_seconds"] * int(project["settings"]["fps"])) for sid, t in tracks.items()}
    errors, warnings = validate_project(project, frames)
    for warning in warnings:
        print(f"warning: {warning}")
    missing = [f"public/assets/generated/scene_{s['scene_id']}.png" for s in scenes
               if needs_image(s) and not (GENERATED_DIR / f"scene_{s['scene_id']}.png").exists()]
    if missing:
        errors.append("Missing image(s), run the images step: " + ", ".join(missing))
    if generation_mode(project) == "ai_video":
        for s in scenes:
            for clip in (load_meta(asset_meta_path("videos", s["scene_id"])) or {}).get("clips", []):
                if not (ROOT / clip["file"]).exists():
                    errors.append(f"Missing AI video clip, run the video step: {clip['file']}")
    if errors:
        raise RuntimeError("Cannot render:\n  " + "\n  ".join(errors))

    output = ROOT / "output" / (f"test_{'_'.join(s['scene_id'] for s in scenes)}.mp4" if scene_selection else "video.mp4")
    output.parent.mkdir(parents=True, exist_ok=True)
    # A scene subset renders just those scenes, without intro/ending cards.
    subset = scene_selection is not None
    render_props = {
        "sceneIds": [s["scene_id"] for s in scenes],
        "music": project.get("music") or {},
        "intro": {"enabled": "false"} if subset else (project.get("intro") or {}),
        "ending": {"enabled": "false"} if subset else (project.get("ending") or {}),
    }
    remotion_bin = ROOT / "node_modules" / ".bin" / ("remotion.cmd" if os.name == "nt" else "remotion")
    subprocess.run(
        [str(remotion_bin), "render", "src/index.ts", "MainVideo", str(output), "--concurrency=50%", "--props", json.dumps(render_props)],
        cwd=ROOT, check=True,
    )
    print(f"Rendered: {output.relative_to(ROOT)}")
    return output


def validate(project: dict) -> bool:
    """Report script problems without calling any API. Uses measured audio lengths when available."""
    manifest = load_meta(GENERATED_MANIFEST) or {}
    fps = int(project["settings"]["fps"])
    frames = {sid: math.ceil(float(t["duration_seconds"]) * fps) for sid, t in manifest.get("tracks", {}).items()}
    errors, warnings = validate_project(project, frames)
    image_scenes = sum(needs_image(s) for s in project["scenes"])
    for warning in warnings:
        print(f"warning: {warning}")
    if errors:
        print(f"VALIDATION FAILED — {len(errors)} problem(s):")
        print("\n".join(f"  - {e}" for e in errors))
        return False
    print(f"VALIDATION OK — {len(project['scenes'])} scenes "
          f"({len(project['scenes']) - image_scenes} motion, {image_scenes} image), mode={generation_mode(project)}")
    return True


def check(project: dict | None) -> bool:
    problems = check_environment(project)
    if problems:
        print("ENVIRONMENT PROBLEMS:")
        print("\n".join(f"  - {p}" for p in problems))
        return False
    print("ENVIRONMENT OK — ffmpeg, node, Remotion and API keys are available.")
    return True


COMMANDS = {
    "check": "check tools, packages and API keys",
    "validate": "check the script for problems (no API calls)",
    "build": "parse the script and write src/generated/ (no API calls)",
    "images": "generate still images for image scenes",
    "audio": "generate narration audio and timings",
    "audio-timings": "rebuild timings from existing audio",
    "video": "generate AI video clips (generation_mode: ai_video only)",
    "render": "render the MP4 with Remotion",
    "all": "images + audio + video + render",
}


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Script-to-video pipeline.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="commands:\n" + "\n".join(f"  {name:<14}{text}" for name, text in COMMANDS.items()),
    )
    parser.add_argument("command", choices=list(COMMANDS), metavar="command")
    parser.add_argument("script", nargs="?", type=Path, default=DEFAULT_SCRIPT, help="script path (default: project/script.md)")
    parser.add_argument("--scenes", help="comma-separated scene numbers, e.g. 001,002")
    parser.add_argument("--test", action="store_true", help="only the first two scenes")
    args = parser.parse_args()

    script = args.script if args.script.is_absolute() else (Path.cwd() / args.script)
    if not script.exists():
        script = ROOT / args.script
    if not script.exists():
        raise SystemExit(f"Script not found: {args.script}")

    project = build(script)
    scene_selection = args.scenes
    if args.test and not scene_selection:
        scene_selection = ",".join(s["scene_id"] for s in project["scenes"][:2])

    if args.command == "check":
        sys.exit(0 if check(project) else 1)
    if args.command == "validate":
        sys.exit(0 if validate(project) else 1)
    if args.command == "build":
        return
    if args.command == "audio-timings":
        rebuild_audio_timings(project, scene_selection)
        print(f"Rebuilt timings: {TIMINGS_TS.relative_to(ROOT)}")
        return
    if args.command in {"images", "all"} and not validate(project):
        sys.exit(1)

    tracker = CostTracker(ROOT, args.command, script)
    try:
        if args.command in {"images", "all"}:
            generate_images(project, tracker, scene_selection)
        if args.command in {"audio", "all"}:
            generate_audio(project, tracker, scene_selection)
            project = build(script)  # re-time word cues with the new narration
        if args.command in {"video", "all"}:
            generate_videos(project, tracker, scene_selection)
        if args.command in {"render", "all"}:
            render(project, scene_selection)
    except RuntimeError as exc:
        sys.exit(f"\nERROR: {exc}")
    finally:
        tracker.print_summary(tracker.finish())


if __name__ == "__main__":
    main()

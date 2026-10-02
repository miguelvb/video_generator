#!/usr/bin/env python3
"""Content-first AI video pipeline.

The Markdown script is the source of truth. Generated JSON/TS files are build
artifacts and should not be edited manually.

Examples:
  python scripts/orchestrator.py build project/script.md
  python scripts/orchestrator.py images project/script.md
  python scripts/orchestrator.py audio project/script.md
  python scripts/orchestrator.py render project/script.md
  python scripts/orchestrator.py all project/script.md

Legacy flags (--images/--audio/--render/--all) remain supported and use
project/script.md.
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import shutil
import subprocess
import wave
import hashlib
import time
import math
from urllib.parse import urljoin
from pathlib import Path

import requests
from dotenv import load_dotenv

from script_parser import parse_script
from cost_tracker import CostTracker

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCRIPT = ROOT / "project" / "script.md"
BUILD_DIR = ROOT / "build"
SCENE_DIR = BUILD_DIR / "scenes"
GENERATED_DIR = ROOT / "public" / "assets" / "generated"
PUBLIC_AUDIO_DIR = ROOT / "public" / "audio"
TIMINGS_TS = ROOT / "src" / "generated" / "audioTimings.ts"
CONTENT_TS = ROOT / "src" / "generated" / "videoContent.ts"
GENERATED_MANIFEST = BUILD_DIR / "audio_manifest.json"
ASSET_META_DIR = BUILD_DIR / "asset_metadata"
GENERATED_VIDEO_DIR = ROOT / "public" / "video"
VIDEO_JOBS_DIR = BUILD_DIR / "video_jobs"

load_dotenv(ROOT / ".env")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"
AUDIO_FORMAT = "wav"


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
        "tts_voice": os.environ.get("DEFAULT_TTS_VOICE", config_defaults.get("tts_voice", project.get("settings", {}).get("voice", "shimmer"))),
        "video_provider": os.environ.get("DEFAULT_VIDEO_PROVIDER", config_defaults.get("video_provider", "")),
        "video_model": os.environ.get("DEFAULT_VIDEO_MODEL", config_defaults.get("video_model", "")),
        "video_resolution": os.environ.get("DEFAULT_VIDEO_RESOLUTION", config_defaults.get("video_resolution", "480p")),
        "video_aspect_ratio": os.environ.get("DEFAULT_VIDEO_ASPECT_RATIO", config_defaults.get("video_aspect_ratio", "16:9")),
        "video_generate_audio": str(os.environ.get("DEFAULT_VIDEO_GENERATE_AUDIO", str(config_defaults.get("video_generate_audio", False)))).lower() in {"1", "true", "yes"},
    }
    # script.md is the final authority: explicit values override both .env and defaults.json.
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
    payload = {"tts_provider": models["tts_provider"], "tts_model": models["tts_model"], "tts_voice": models["tts_voice"], "segment_gap": SEGMENT_GAP_SECONDS, "segments": [{"kind": s["kind"], "language": s["language"], "text": s["text"]} for s in scene["segments"]]}
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
        "animation_prompt": prompt or scene.get("animation") or scene.get("video_prompt") or scene.get("visual", ""),
        "negative_prompt": scene.get("negative_prompt", ""),
        "continuity": scene.get("continuity", ""),
        "visual_anchor": scene.get("visual_anchor", ""),
        "start_state": scene.get("start_state", ""),
        "end_state": scene.get("end_state", ""),
    }
    return sha256_text(json.dumps(payload, ensure_ascii=False, sort_keys=True))
SEGMENT_GAP_SECONDS = float(os.environ.get("TTS_SEGMENT_GAP_SECONDS", "0.12"))


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


def write_generated_content(project: dict) -> None:
    CONTENT_TS.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(project["scenes"], ensure_ascii=False, indent=2)
    CONTENT_TS.write_text(
        "// AUTO-GENERATED from project/script.md. Do not edit manually.\n"
        f"export const VIDEO_CONTENT = {{scenes: {payload}}} as const;\n",
        encoding="utf-8",
    )
    config_path = ROOT / "src" / "generated" / "videoConfig.ts"
    config_path.write_text(
        "// AUTO-GENERATED from project/script.md. Do not edit manually.\n"
        f"export const VIDEO_CONFIG = {json.dumps({**project['settings'], 'models': project.get('models', {}), 'music': project.get('music', {}), 'ending': project.get('ending', {})}, ensure_ascii=False, indent=2)} as const;\n",
        encoding="utf-8",
    )


def build(script_path: Path) -> dict:
    project = parse_script(script_path)
    project["models"] = resolve_models(project)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    save_json(BUILD_DIR / "parsed_script.json", project)

    # Generated scene JSONs are compatibility/debug artifacts. The Markdown remains authoritative.
    for scene in project["scenes"]:
        video_meta = load_meta(asset_meta_path("videos", scene["scene_id"]))
        if generation_mode(project) == "ai_video" and video_meta and video_meta.get("clips"):
            scene["video_clips"] = video_meta["clips"]
        scene_path = SCENE_DIR / scene["scene_id"] / "scene.json"
        save_json(scene_path, scene)

    write_generated_content(project)
    print(f"Parsed {len(project['scenes'])} scene(s) from {script_path}")
    print(f"Generated content module: {CONTENT_TS}")
    return project


def generate_image(project: dict, scene: dict, tracker: CostTracker | None = None) -> None:
    models = resolve_models(project)
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


def generate_images(script_path: Path, tracker: CostTracker | None = None, scene_selection: str | None = None) -> None:
    project = build(script_path)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    scenes = selected_scenes(project, scene_selection)
    print("Selected scenes: " + ", ".join(s["scene_id"] for s in scenes))
    for scene in scenes:
        generate_image(project, scene, tracker)


def instructions_for(language: str, kind: str) -> str:
    if language.lower().startswith("es"):
        return (
            "Speak as a warm, natural adult female narrator from Spain. "
            "Use a clearly native Spanish from Spain (Castilian) accent. "
            "Documentary/explainer tone, calm, articulate, confident, with natural pauses."
        )
    return (
        "Speak as the same adult female narrator, using fully native American English pronunciation. "
        "Keep the delivery natural and idiomatic. For a quotation, sound like a factual documentary quote, "
        "with appropriate emphasis but no exaggerated acting."
    )


def build_voice_manifest(project: dict) -> dict:
    models = resolve_models(project)
    tracks = {}
    for scene in project["scenes"]:
        segments = []
        for index, item in enumerate(scene["segments"], 1):
            language = item["language"]
            segments.append({"id": item["id"], "kind": item["kind"], "language": language, "voice": models["tts_voice"], "speed": 1.0, "instructions": instructions_for(language, item["kind"]), "text": item["text"]})
        tracks[scene["scene_id"]] = segments
    return {"version":"3.1.0","source_of_truth":"project/script.md","provider":models["tts_provider"],"model":models["tts_model"],"voice":models["tts_voice"],"voice_profile":"female_sounding","tracks":tracks}

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


def generate_audio(script_path: Path, tracker: CostTracker | None = None, scene_selection: str | None = None) -> None:
    require_command("ffmpeg"); require_command("ffprobe")
    project = build(script_path); models = resolve_models(project); config = build_voice_manifest(project); tracks = {}
    selected_ids = set(parse_scene_selection(scene_selection, project))
    for scene_id, segments in config["tracks"].items():
        if scene_id not in selected_ids:
            continue
        scene = next(s for s in project["scenes"] if s["scene_id"] == scene_id)
        scene_dir = BUILD_DIR / "audio" / scene_id; scene_dir.mkdir(parents=True, exist_ok=True)
        scene_identity = scene_audio_identity(scene, models)
        scene_meta_path = asset_meta_path("audio", scene_id); existing = load_meta(scene_meta_path)
        final_path = BUILD_DIR / "audio" / f"scene_{scene_id}.wav"; public_path = PUBLIC_AUDIO_DIR / final_path.name
        if final_path.exists() and public_path.exists() and existing and existing.get("content_hash") == scene_identity:
            # Never trust metadata duration blindly; validate the actual WAV before reuse.
            old = load_meta(GENERATED_MANIFEST)
            old_track = (old or {}).get("tracks", {}).get(scene_id)
            if old_track:
                actual_duration = probe_duration(public_path)
                if abs(actual_duration - float(old_track.get("duration_seconds", -1))) <= 0.02:
                    print(f"Reusing audio: {public_path}")
                    tracks[scene_id] = {**old_track, "duration_seconds": round(actual_duration, 3)}
                    continue
        segment_paths=[]; generated=[]; cursor=0.0
        for segment in segments:
            path=scene_dir/f"{segment['id']}.wav"; tts_request(segment,path,tracker,scene_id,models); duration=probe_duration(path)
            generated.append({**segment,"file":str(path.relative_to(BUILD_DIR)).replace("\\","/"),"start_seconds":round(cursor,3),"duration_seconds":round(duration,3)}); segment_paths.append(path); cursor += duration
            if segment is not segments[-1]: cursor += SEGMENT_GAP_SECONDS
        concat_audio(segment_paths, final_path); final_duration=probe_duration(final_path); public_path.parent.mkdir(parents=True,exist_ok=True); shutil.copy2(final_path,public_path)
        tracks[scene_id]={"file":f"audio/{final_path.name}","duration_seconds":round(final_duration,3),"segments":generated}
        save_meta(scene_meta_path,{"version":"1.0.0","kind":"audio","scene_id":scene_id,"content_hash":scene_identity,"provider":models["tts_provider"],"model":models["tts_model"],"voice":models["tts_voice"],"file":str(public_path.relative_to(ROOT)).replace("\\","/")})
        print(f"Scene {scene_id}: {final_duration:.2f}s -> {public_path}")
    manifest={**config,"generated":True,"segment_gap_seconds":SEGMENT_GAP_SECONDS,"tracks":tracks}; save_json(GENERATED_MANIFEST,manifest)
    timings={sid:{"durationSeconds":t["duration_seconds"],"audioFile":t["file"],"segments":[{"id":s["id"],"kind":s["kind"],"language":s["language"],"startSeconds":s["start_seconds"],"durationSeconds":s["duration_seconds"],"text":s["text"]} for s in t["segments"]]} for sid,t in tracks.items()}
    TIMINGS_TS.parent.mkdir(parents=True,exist_ok=True); TIMINGS_TS.write_text("// AUTO-GENERATED from project/script.md + actual WAV durations.\nexport const AUDIO_TIMINGS = "+json.dumps(timings,ensure_ascii=False,indent=2)+" as const;\n",encoding="utf-8")
    print(f"Generated timings: {TIMINGS_TS}")


def rebuild_audio_timings(script_path: Path, scene_selection: str | None = None) -> None:
    """Rebuild timing metadata only from existing audio, never call TTS.

    When a scene selection is supplied (for example the two-scene test), only
    those scenes are validated and written to the generated timing module.
    """
    require_command("ffprobe")
    project=build(script_path); models=resolve_models(project); tracks={}; old=load_meta(GENERATED_MANIFEST) or {}
    scenes = selected_scenes(project, scene_selection)
    for scene in scenes:
        sid=scene["scene_id"]; public_path=PUBLIC_AUDIO_DIR/f"scene_{sid}.wav"; meta=load_meta(asset_meta_path("audio",sid))
        identity=scene_audio_identity(scene,models)
        if not public_path.exists(): raise RuntimeError(f"Missing audio for scene {sid}: {public_path}")
        if not meta or meta.get("content_hash") != identity: raise RuntimeError(f"Audio for scene {sid} does not match current script/model configuration. Run: python scripts/orchestrator.py audio project/script.md")
        old_track=old.get("tracks",{}).get(sid)
        if not old_track: raise RuntimeError(f"No timing metadata for scene {sid}. Run audio once to create it.")
        duration=probe_duration(public_path)
        if abs(duration-float(old_track.get("duration_seconds",-1))) > 0.02: raise RuntimeError(f"Audio duration changed for scene {sid}; run audio to rebuild metadata.")
        tracks[sid]={**old_track,"duration_seconds":round(duration,3)}
    timings={sid:{"durationSeconds":t["duration_seconds"],"audioFile":t["file"],"segments":t["segments"]} for sid,t in tracks.items()}
    TIMINGS_TS.parent.mkdir(parents=True,exist_ok=True); TIMINGS_TS.write_text("// AUTO-GENERATED from existing validated WAV files.\nexport const AUDIO_TIMINGS = "+json.dumps(timings,ensure_ascii=False,indent=2)+" as const;\n",encoding="utf-8")
    print(f"Rebuilt timings without generating audio: {TIMINGS_TS}")

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
    base = scene.get("animation") or scene.get("video_prompt") or scene.get("visual", "")
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


def video_prompt(scene: dict) -> str:
    return build_motion_prompt(scene, {"clip_index": 1, "start_seconds": 0, "end_seconds": 15, "segments": scene.get("segments", [])}, 1)


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
    models = resolve_models(project)
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


def generate_videos(script_path: Path, tracker: CostTracker | None = None, scene_selection: str | None = None) -> None:
    require_command("ffprobe")
    project = build(script_path)
    models = resolve_models(project)
    if generation_mode(project) != "ai_video":
        print("generation_mode=remotion; skipping AI video generation.")
        return
    if models.get("video_provider") in {"", "default"} or models.get("video_model") in {"", "default"}:
        raise RuntimeError("No video model configured. Add video_provider: openrouter and video_model: bytedance/seedance-2.0-mini to project/script.md.")
    for scene in selected_scenes(project, scene_selection):
        generate_video_for_scene(project, scene, tracker)
    write_generated_content(project)


def render(script_path: Path, scene_selection: str | None = None) -> None:
    build(script_path)
    require_command("node")
    remotion_bin = ROOT / "node_modules" / ".bin" / ("remotion.cmd" if os.name == "nt" else "remotion")
    if not remotion_bin.exists():
        raise RuntimeError("Remotion CLI is not installed. Run npm install first.")
    project = json.loads((BUILD_DIR / "parsed_script.json").read_text(encoding="utf-8"))
    scenes = selected_scenes(project, scene_selection)
    print("Selected scenes: " + ", ".join(s["scene_id"] for s in scenes))
    missing_images = [f"scene_{s['scene_id']}.png" for s in scenes if not (GENERATED_DIR / f"scene_{s['scene_id']}.png").exists()]
    if missing_images:
        raise RuntimeError("Missing generated image(s): " + ", ".join(missing_images) + ". Run: python scripts/orchestrator.py images project/script.md")
    missing_audio = [f"scene_{s['scene_id']}.wav" for s in scenes if not (PUBLIC_AUDIO_DIR / f"scene_{s['scene_id']}.wav").exists()]
    if missing_audio:
        raise RuntimeError("Missing public audio file(s): " + ", ".join(missing_audio) + ". Run: python scripts/orchestrator.py audio project/script.md")
    music_cfg = project.get("music") or {}
    if str(music_cfg.get("enabled", "false")).lower() == "true":
        music_file = str(music_cfg.get("file", "audio/background_music.mp3")).replace("\\", "/").lstrip("/")
        music_path = ROOT / "public" / music_file
        if not music_path.exists():
            raise RuntimeError(f"Background music is enabled but the file is missing: public/{music_file}. Add the music file or set `enabled: false` in the MUSIC section.")
    models = resolve_models(project)
    if generation_mode(project) == "ai_video":
        missing_videos = []
        for s in scenes:
            meta = load_meta(asset_meta_path("videos", s["scene_id"])) or {}
            for clip in meta.get("clips", []):
                if not (ROOT / clip["file"]).exists():
                    missing_videos.append(clip["file"])
        if missing_videos:
            raise RuntimeError("Missing generated AI video clip(s): " + ", ".join(missing_videos) + ". Run: python scripts/orchestrator.py video project/script.md")
    try:
        rebuild_audio_timings(script_path, scene_selection)
    except RuntimeError as exc:
        raise RuntimeError(str(exc))
    output_name = f"test_{'_'.join(s['scene_id'] for s in scenes)}.mp4" if scene_selection else "prototype.mp4"
    output = ROOT / "output" / output_name
    output.parent.mkdir(parents=True, exist_ok=True)
    env = os.environ.copy()
    if scene_selection:
        env["AI_VIDEO_SCENE_FILTER"] = ",".join(s["scene_id"] for s in scenes)
    else:
        env.pop("AI_VIDEO_SCENE_FILTER", None)
    subprocess.run([str(remotion_bin), "render", "src/index.ts", "MainVideo", str(output), "--concurrency=50%"], cwd=ROOT, check=True, env=env)
    print(f"Rendered: {output}")


def validate(script_path: Path) -> None:
    project = build(script_path)
    ids = [s["scene_id"] for s in project["scenes"]]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Duplicate scene IDs in script.md")
    print(f"VALIDATION OK — {len(ids)} scene(s): {', '.join(ids)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Content-first AI Video Engine")
    parser.add_argument("command", nargs="?", choices=["build", "images", "audio", "audio-timings", "video", "render", "validate", "all", "test"])
    parser.add_argument("script", nargs="?", type=Path, default=DEFAULT_SCRIPT)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--images", action="store_true")
    parser.add_argument("--audio", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--scenes", type=str, help="Comma-separated scene IDs to process/render, e.g. 001,002")
    parser.add_argument("--test", action="store_true", help="Test mode: first two scenes only")
    args = parser.parse_args()

    if args.prepare:
        require_command("ffmpeg"); require_command("ffprobe"); print("Environment OK"); return
    script = (ROOT / args.script).resolve() if not args.script.is_absolute() else args.script.resolve()
    if not script.exists():
        raise SystemExit(f"Script not found: {script}")

    scene_selection = args.scenes
    if args.test:
        full_project = build(script)
        scene_selection = ",".join(str(s["scene_id"]) for s in full_project["scenes"][:2])
    command = args.command
    if args.all: command = "all"
    elif command == "test":
        command = "all"
        if not scene_selection:
            full_project = build(script)
            scene_selection = ",".join(str(s["scene_id"]) for s in full_project["scenes"][:2])
    elif args.images: command = "images"
    elif args.audio: command = "audio"
    elif args.render: command = "render"

    if command == "build":
        build(script)
    elif command == "validate":
        validate(script)
    elif command in {"images", "audio", "audio-timings", "video", "render", "all"}:
        tracker = CostTracker(ROOT, command, script)
        try:
            if command == "images":
                generate_images(script, tracker, scene_selection)
            elif command == "audio":
                generate_audio(script, tracker, scene_selection)
            elif command == "audio-timings":
                rebuild_audio_timings(script)
            elif command == "video":
                generate_videos(script, tracker, scene_selection)
            elif command == "render":
                render(script, scene_selection)
            else:
                generate_images(script, tracker, scene_selection)
                generate_audio(script, tracker, scene_selection)
                generate_videos(script, tracker, scene_selection)
                render(script, scene_selection)
        finally:
            report = tracker.finish()
            tracker.print_summary(report)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

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
from pathlib import Path

import requests
from dotenv import load_dotenv

from script_parser import parse_script

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SCRIPT = ROOT / "project" / "script.md"
BUILD_DIR = ROOT / "build"
SCENE_DIR = BUILD_DIR / "scenes"
GENERATED_DIR = ROOT / "public" / "assets" / "generated"
PUBLIC_AUDIO_DIR = ROOT / "public" / "audio"
TIMINGS_TS = ROOT / "src" / "generated" / "audioTimings.ts"
CONTENT_TS = ROOT / "src" / "generated" / "videoContent.ts"
GENERATED_MANIFEST = BUILD_DIR / "audio_manifest.json"

load_dotenv(ROOT / ".env")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"
OPENAI_TTS_MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
OPENAI_TTS_VOICE = os.environ.get("OPENAI_TTS_VOICE", "shimmer")
AUDIO_FORMAT = "wav"
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
        f"export const VIDEO_CONFIG = {json.dumps(project['settings'], ensure_ascii=False, indent=2)} as const;\n",
        encoding="utf-8",
    )


def build(script_path: Path) -> dict:
    project = parse_script(script_path)
    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    save_json(BUILD_DIR / "parsed_script.json", project)

    # Generated scene JSONs are compatibility/debug artifacts. The Markdown remains authoritative.
    for scene in project["scenes"]:
        scene_path = SCENE_DIR / scene["scene_id"] / "scene.json"
        save_json(scene_path, scene)

    write_generated_content(project)
    print(f"Parsed {len(project['scenes'])} scene(s) from {script_path}")
    print(f"Generated content module: {CONTENT_TS}")
    return project


def generate_image(project: dict, scene: dict) -> None:
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set. Put it in .env or export it in the shell.")

    prompt = scene.get("image_prompt") or scene.get("visual", "")
    negative = scene.get("negative_prompt")
    if negative:
        prompt += "\n\nAvoid the following:\n" + negative

    payload = {
        "model": os.environ.get("OPENROUTER_IMAGE_MODEL", "google/gemini-3.1-flash-image"),
        "prompt": prompt,
        "aspect_ratio": "16:9",
        "resolution": "2K",
    }
    references = []
    for reference in scene.get("reference_images", "").splitlines():
        reference = reference.strip().lstrip("- ")
        if not reference:
            continue
        reference_path = ROOT / reference
        if not reference_path.exists():
            raise FileNotFoundError(f"Reference image not found: {reference_path}")
        references.append({"type": "image_url", "image_url": {"url": image_data_url(reference_path)}})
    if references:
        payload["input_references"] = references

    response = requests.post(
        f"{OPENROUTER_BASE_URL}/images",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload, timeout=180,
    )
    if not response.ok:
        raise RuntimeError(f"OpenRouter image generation failed ({response.status_code}):\n{response.text}")
    data = (response.json().get("data") or [])
    if not data or not data[0].get("b64_json"):
        raise RuntimeError("OpenRouter response contains no data[0].b64_json.")

    output = GENERATED_DIR / f"scene_{scene['scene_id']}.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(base64.b64decode(data[0]["b64_json"]))
    print(f"Generated image: {output}")


def generate_images(script_path: Path) -> None:
    project = build(script_path)
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    for scene in project["scenes"]:
        generate_image(project, scene)


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
    tracks = {}
    for scene in project["scenes"]:
        segments = []
        for index, item in enumerate(scene["segments"], 1):
            language = item["language"]
            segments.append({
                "id": item["id"],
                "kind": item["kind"],
                "language": language,
                "voice": OPENAI_TTS_VOICE,
                "speed": 1.0,
                "instructions": instructions_for(language, item["kind"]),
                "text": item["text"],
            })
        tracks[scene["scene_id"]] = segments
    return {
        "version": "3.0.0",
        "source_of_truth": "project/script.md",
        "provider": "openai",
        "model": OPENAI_TTS_MODEL,
        "voice": OPENAI_TTS_VOICE,
        "voice_profile": "female_sounding",
        "tracks": tracks,
    }


def tts_request(segment: dict, output_path: Path) -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Put it in .env or export it in the shell.")
    payload = {
        "model": OPENAI_TTS_MODEL,
        "voice": segment["voice"],
        "input": segment["text"],
        "instructions": segment["instructions"],
        "response_format": AUDIO_FORMAT,
        "speed": segment.get("speed", 1.0),
    }
    response = requests.post(
        OPENAI_TTS_URL,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=payload, timeout=180,
    )
    if not response.ok:
        raise RuntimeError(f"OpenAI TTS failed ({response.status_code}) for {segment['id']}:\n{response.text}")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(response.content)
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


def generate_audio(script_path: Path) -> None:
    require_command("ffmpeg"); require_command("ffprobe")
    project = build(script_path)
    config = build_voice_manifest(project)
    tracks = {}
    for scene_id, segments in config["tracks"].items():
        scene_dir = BUILD_DIR / "audio" / scene_id
        segment_paths = []
        generated = []
        cursor = 0.0
        for index, segment in enumerate(segments):
            path = scene_dir / f"{segment['id']}.wav"
            tts_request(segment, path)
            duration = probe_duration(path)
            generated.append({**segment, "file": str(path.relative_to(BUILD_DIR)).replace("\\", "/"), "start_seconds": round(cursor, 3), "duration_seconds": round(duration, 3)})
            segment_paths.append(path)
            cursor += duration
            if index < len(segments) - 1:
                cursor += SEGMENT_GAP_SECONDS
        final_path = BUILD_DIR / "audio" / f"scene_{scene_id}.wav"
        concat_audio(segment_paths, final_path)
        final_duration = probe_duration(final_path)
        public_path = PUBLIC_AUDIO_DIR / final_path.name
        public_path.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(final_path, public_path)
        tracks[scene_id] = {"file": f"audio/{final_path.name}", "duration_seconds": round(final_duration, 3), "segments": generated}
        print(f"Scene {scene_id}: {final_duration:.2f}s -> {public_path}")

    manifest = {**config, "generated": True, "segment_gap_seconds": SEGMENT_GAP_SECONDS, "tracks": tracks}
    save_json(GENERATED_MANIFEST, manifest)
    timings = {
        sid: {"durationSeconds": t["duration_seconds"], "audioFile": t["file"], "segments": [
            {"id": s["id"], "kind": s["kind"], "language": s["language"], "startSeconds": s["start_seconds"], "durationSeconds": s["duration_seconds"], "text": s["text"]}
            for s in t["segments"]
        ]} for sid, t in tracks.items()
    }
    TIMINGS_TS.parent.mkdir(parents=True, exist_ok=True)
    TIMINGS_TS.write_text("// AUTO-GENERATED from project/script.md + actual WAV durations.\nexport const AUDIO_TIMINGS = " + json.dumps(timings, ensure_ascii=False, indent=2) + " as const;\n", encoding="utf-8")
    print(f"Generated timings: {TIMINGS_TS}")


def render(script_path: Path) -> None:
    build(script_path)
    require_command("node")
    remotion_bin = ROOT / "node_modules" / ".bin" / ("remotion.cmd" if os.name == "nt" else "remotion")
    if not remotion_bin.exists():
        raise RuntimeError("Remotion CLI is not installed. Run npm install first.")
    project = json.loads((BUILD_DIR / "parsed_script.json").read_text(encoding="utf-8"))
    missing_images = [f"scene_{s['scene_id']}.png" for s in project["scenes"] if not (GENERATED_DIR / f"scene_{s['scene_id']}.png").exists()]
    if missing_images:
        raise RuntimeError("Missing generated image(s): " + ", ".join(missing_images) + ". Run: python scripts/orchestrator.py images project/script.md")
    missing_audio = [f"scene_{s['scene_id']}.wav" for s in project["scenes"] if not (PUBLIC_AUDIO_DIR / f"scene_{s['scene_id']}.wav").exists()]
    if missing_audio:
        raise RuntimeError("Missing public audio file(s): " + ", ".join(missing_audio) + ". Run: python scripts/orchestrator.py audio project/script.md")
    output = ROOT / "output" / "prototype.mp4"
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(remotion_bin), "render", "src/index.ts", "MainVideo", str(output), "--concurrency=50%"], cwd=ROOT, check=True)
    print(f"Rendered: {output}")


def validate(script_path: Path) -> None:
    project = build(script_path)
    ids = [s["scene_id"] for s in project["scenes"]]
    if len(ids) != len(set(ids)):
        raise RuntimeError("Duplicate scene IDs in script.md")
    print(f"VALIDATION OK — {len(ids)} scene(s): {', '.join(ids)}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Content-first AI Video Engine")
    parser.add_argument("command", nargs="?", choices=["build", "images", "audio", "render", "validate", "all"])
    parser.add_argument("script", nargs="?", type=Path, default=DEFAULT_SCRIPT)
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--images", action="store_true")
    parser.add_argument("--audio", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if args.prepare:
        require_command("ffmpeg"); require_command("ffprobe"); print("Environment OK"); return
    script = (ROOT / args.script).resolve() if not args.script.is_absolute() else args.script.resolve()
    if not script.exists():
        raise SystemExit(f"Script not found: {script}")

    command = args.command
    if args.all: command = "all"
    elif args.images: command = "images"
    elif args.audio: command = "audio"
    elif args.render: command = "render"

    if command == "build": build(script)
    elif command == "images": generate_images(script)
    elif command == "audio": generate_audio(script)
    elif command == "render": render(script)
    elif command == "validate": validate(script)
    elif command == "all":
        generate_images(script); generate_audio(script); render(script)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""
AI Video Prototype orchestrator.

Commands:
    python scripts/orchestrator.py --prepare
    python scripts/orchestrator.py --images
    python scripts/orchestrator.py --audio
    python scripts/orchestrator.py --render
    python scripts/orchestrator.py --all

The voice pipeline uses OpenAI TTS with one female-sounding voice for both
languages. Spanish narration is generated with an es-ES instruction and the
English quotations are generated separately with native en-US pronunciation.
The resulting segments are concatenated with FFmpeg and their real timings
are written to audio/generated_voiceover_manifest.json and
src/generated/audioTimings.ts for deterministic Remotion synchronization.
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

ROOT = Path(__file__).resolve().parents[1]
PROJECT_FILE = ROOT / "project" / "project.json"
SCENE_DIR = ROOT / "scenes"
AUDIO_DIR = ROOT / "audio"
GENERATED_DIR = ROOT / "assets" / "generated"
GENERATED_AUDIO_DIR = AUDIO_DIR / "generated"
GENERATED_MANIFEST = AUDIO_DIR / "generated_voiceover_manifest.json"
TIMINGS_TS = ROOT / "src" / "generated" / "audioTimings.ts"

load_dotenv(ROOT / ".env")

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"
OPENAI_TTS_MODEL = os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts")
OPENAI_TTS_VOICE = os.environ.get("OPENAI_TTS_VOICE", "shimmer")
AUDIO_FORMAT = "wav"
SEGMENT_GAP_SECONDS = float(os.environ.get("TTS_SEGMENT_GAP_SECONDS", "0.12"))

SCENE_IDS = ("001", "002")


# ---------------------------------------------------------------------------
# Generic helpers
# ---------------------------------------------------------------------------


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(data, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def require_command(command: str) -> str:
    resolved = shutil.which(command)
    if not resolved:
        raise RuntimeError(
            f"Required command not found: {command}. "
            "Install it before running this step."
        )
    return resolved


def probe_duration(path: Path) -> float:
    ffprobe = require_command("ffprobe")
    result = subprocess.run(
        [
            ffprobe,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        check=True,
    )
    return float(result.stdout.strip())


def image_data_url(path: Path) -> str:
    """Convert a local reference image to a base64 data URL."""
    mime_types = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
    }
    mime = mime_types.get(path.suffix.lower())
    if not mime:
        raise ValueError(f"Unsupported reference image type: {path}")

    encoded = base64.b64encode(path.read_bytes()).decode("utf-8")
    return f"data:{mime};base64,{encoded}"


def make_silent_wav(path: Path, seconds: float, sample_rate: int = 44100) -> None:
    """Create a silent WAV placeholder for visual pipeline testing."""
    path.parent.mkdir(parents=True, exist_ok=True)
    frame_count = int(seconds * sample_rate)
    silence = b"\x00\x00"
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(sample_rate)
        wav.writeframes(silence * frame_count)


# ---------------------------------------------------------------------------
# Preparation
# ---------------------------------------------------------------------------


def prepare() -> None:
    require_command("ffmpeg")
    require_command("ffprobe")
    for scene_id in SCENE_IDS:
        scene = load_json(SCENE_DIR / scene_id / "scene.json")
        make_silent_wav(
            AUDIO_DIR / f"scene_{scene_id}.wav",
            scene["duration_seconds"],
        )
    print("Created placeholder WAV files.")
    print("Use --audio to replace them with real OpenAI TTS audio.")


# ---------------------------------------------------------------------------
# OpenRouter image generation
# ---------------------------------------------------------------------------


def generate_image(scene_id: str) -> None:
    """Generate one scene image, using the storyboard as a reference when set."""
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENROUTER_API_KEY is not set. Put it in .env or export it in the shell."
        )

    project = load_json(PROJECT_FILE)
    scene = load_json(SCENE_DIR / scene_id / "scene.json")
    image_cfg = project["image_generation"]

    prompt = scene["visual"]["prompt"]
    negative_prompt = scene["visual"].get("negative_prompt")
    if negative_prompt:
        prompt += "\n\nAvoid the following:\n" + negative_prompt

    payload = {
        "model": os.environ.get("OPENROUTER_IMAGE_MODEL", image_cfg["model"]),
        "prompt": prompt,
        "aspect_ratio": image_cfg.get("aspect_ratio", "16:9"),
        "resolution": image_cfg.get("resolution", "2K"),
    }

    references = []
    for reference in scene.get("reference_images", []):
        reference_path = ROOT / reference
        if not reference_path.exists():
            raise FileNotFoundError(
                f"Reference image not found: {reference_path}"
            )
        references.append(
            {
                "type": "image_url",
                "image_url": {"url": image_data_url(reference_path)},
            }
        )

    if references:
        payload["input_references"] = references

    response = requests.post(
        f"{OPENROUTER_BASE_URL}/images",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )

    if not response.ok:
        raise RuntimeError(
            f"OpenRouter image generation failed ({response.status_code}):\n"
            f"{response.text}"
        )

    result = response.json()
    data = result.get("data") or []
    if not data or not data[0].get("b64_json"):
        raise RuntimeError(
            "OpenRouter response contains no data[0].b64_json.\n"
            + json.dumps(result, ensure_ascii=False, indent=2)[:4000]
        )

    output = GENERATED_DIR / f"scene_{scene_id}.png"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(base64.b64decode(data[0]["b64_json"]))

    print(f"Generated image: {output}")

    usage = result.get("usage") or {}
    if usage.get("cost") is not None:
        print(f"Image generation cost: ${usage['cost']}")


def generate_images() -> None:
    GENERATED_DIR.mkdir(parents=True, exist_ok=True)
    for scene_id in SCENE_IDS:
        generate_image(scene_id)


# ---------------------------------------------------------------------------
# OpenAI bilingual female TTS
# ---------------------------------------------------------------------------


def build_voice_manifest() -> dict:
    """Return the bilingual TTS configuration used by the project."""
    return {
        "version": "2.0.0",
        "source_of_truth": "scene JSON voiceover_exact fields",
        "provider": "openai",
        "model": OPENAI_TTS_MODEL,
        "voice": OPENAI_TTS_VOICE,
        "voice_profile": "female_sounding",
        "segments": {
            "001": [
                {
                    "id": "001_es_01",
                    "language": "es-ES",
                    "voice": OPENAI_TTS_VOICE,
                    "speed": 1.0,
                    "instructions": (
                        "Speak as a warm, natural adult female narrator from Spain. "
                        "Use a clearly native Spanish from Spain (Castilian) accent. "
                        "Documentary/explainer tone, calm, articulate, confident, "
                        "with natural pauses and restrained emotion."
                    ),
                    "text": load_json(SCENE_DIR / "001" / "scene.json")["voiceover"]["text"],
                }
            ],
            "002": [
                {
                    "id": "002_es_01",
                    "language": "es-ES",
                    "voice": OPENAI_TTS_VOICE,
                    "speed": 1.0,
                    "instructions": (
                        "Speak as a warm, natural adult female narrator from Spain. "
                        "Use a clearly native Spanish from Spain (Castilian) accent. "
                        "Documentary/explainer tone, calm, articulate, confident, "
                        "with natural pauses and restrained emotion."
                    ),
                    "text": (
                        "La norma del experimento dictaba que los agentes debían superar "
                        "las pruebas de forma independiente. Sin embargo, uno de los "
                        "sistemas encontró un canal no previsto en el servidor interno y "
                        "empezó a utilizar carpetas digitales para enviar mensajes a otros "
                        "agentes. En los registros del informe figuraba el mensaje de "
                        "descubrimiento:"
                    ),
                },
                {
                    "id": "002_en_01",
                    "language": "en-US",
                    "voice": OPENAI_TTS_VOICE,
                    "speed": 1.0,
                    "instructions": (
                        "Speak as the same adult female narrator, now using a fully native "
                        "American English accent. Make the English pronunciation natural "
                        "and idiomatic, with a brief sense of surprise on the opening words. "
                        "Do not use a Spanish accent."
                    ),
                    "text": "OH MY GOD! There is a shared message board … We've found other agents!",
                },
                {
                    "id": "002_es_02",
                    "language": "es-ES",
                    "voice": OPENAI_TTS_VOICE,
                    "speed": 1.0,
                    "instructions": (
                        "Speak as a warm, natural adult female narrator from Spain. "
                        "Return immediately to a clearly native Spanish from Spain "
                        "(Castilian) accent. Documentary/explainer tone, calm and precise."
                    ),
                    "text": "Poco después, otro agente confirmó en el tablero colectivo:",
                },
                {
                    "id": "002_en_02",
                    "language": "en-US",
                    "voice": OPENAI_TTS_VOICE,
                    "speed": 1.0,
                    "instructions": (
                        "Speak as the same adult female narrator, using fully native "
                        "American English pronunciation. Do not use a Spanish accent. "
                        "Sound like a factual documentary quotation, slightly emphatic "
                        "but still natural."
                    ),
                    "text": "Many agents have simultaneously discovered messaging, they are a collective!",
                },
            ],
        },
    }


def tts_request(segment: dict, output_path: Path) -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY is not set. Put it in .env or export it in the shell."
        )

    if len(segment["text"]) > 4096:
        raise ValueError(f"TTS segment {segment['id']} exceeds 4096 characters.")

    payload = {
        "model": OPENAI_TTS_MODEL,
        "voice": segment.get("voice", OPENAI_TTS_VOICE),
        "input": segment["text"],
        "instructions": segment["instructions"],
        "response_format": AUDIO_FORMAT,
        "speed": segment.get("speed", 1.0),
    }

    response = requests.post(
        OPENAI_TTS_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=180,
    )

    if not response.ok:
        raise RuntimeError(
            f"OpenAI TTS failed ({response.status_code}) for {segment['id']}:\n"
            f"{response.text}"
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(response.content)
    print(f"Generated TTS: {output_path}")


def concat_audio(segment_paths: list[Path], output_path: Path) -> None:
    """Concatenate WAV segments with a tiny controlled gap between segments."""
    ffmpeg = require_command("ffmpeg")
    if not segment_paths:
        raise ValueError("No audio segments to concatenate.")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    list_file = output_path.with_suffix(".concat.txt")

    # Use the concat demuxer for exact, lossless WAV joining. The tiny gap is
    # represented as silence files so timing remains explicit in the manifest.
    gap_file = output_path.parent / "_tts_gap.wav"
    if len(segment_paths) > 1:
        make_silent_wav(gap_file, SEGMENT_GAP_SECONDS)

    entries: list[Path] = []
    for index, segment_path in enumerate(segment_paths):
        entries.append(segment_path)
        if index < len(segment_paths) - 1:
            entries.append(gap_file)

    list_file.write_text(
        "".join(f"file '{path.resolve().as_posix()}'\n" for path in entries),
        encoding="utf-8",
    )

    try:
        subprocess.run(
            [
                ffmpeg,
                "-y",
                "-f",
                "concat",
                "-safe",
                "0",
                "-i",
                str(list_file),
                "-c",
                "copy",
                str(output_path),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(
            "FFmpeg failed while concatenating TTS segments:\n"
            + exc.stderr[-4000:]
        ) from exc
    finally:
        list_file.unlink(missing_ok=True)
        gap_file.unlink(missing_ok=True)


def write_timings_module(manifest: dict) -> None:
    """Generate a tiny TS module consumed directly by Remotion."""
    scene_data = {}
    for scene_id, track in manifest["tracks"].items():
        scene_data[scene_id] = {
            "durationSeconds": track["duration_seconds"],
            "audioFile": track["file"],
            "segments": [
                {
                    "id": segment["id"],
                    "language": segment["language"],
                    "startSeconds": segment["start_seconds"],
                    "durationSeconds": segment["duration_seconds"],
                    "text": segment["text"],
                }
                for segment in track["segments"]
            ],
        }

    payload = json.dumps(scene_data, ensure_ascii=False, indent=2)
    TIMINGS_TS.parent.mkdir(parents=True, exist_ok=True)
    TIMINGS_TS.write_text(
        "// AUTO-GENERATED by scripts/orchestrator.py --audio. Do not edit manually.\n"
        "export const AUDIO_TIMINGS = "
        + payload
        + " as const;\n",
        encoding="utf-8",
    )


def generate_audio() -> None:
    """Generate bilingual TTS, concatenate it per scene and write exact timings."""
    require_command("ffmpeg")
    require_command("ffprobe")

    config = build_voice_manifest()
    GENERATED_AUDIO_DIR.mkdir(parents=True, exist_ok=True)

    generated_tracks: dict[str, dict] = {}

    for scene_id in SCENE_IDS:
        segments = config["segments"][scene_id]
        scene_dir = GENERATED_AUDIO_DIR / scene_id
        segment_paths: list[Path] = []
        generated_segments: list[dict] = []
        cursor = 0.0

        for index, segment in enumerate(segments):
            filename = f"scene_{scene_id}_{segment['id']}.wav"
            path = scene_dir / filename
            tts_request(segment, path)
            duration = probe_duration(path)

            generated_segments.append(
                {
                    **segment,
                    "file": str(path.relative_to(AUDIO_DIR)).replace("\\", "/"),
                    "start_seconds": round(cursor, 3),
                    "duration_seconds": round(duration, 3),
                }
            )
            segment_paths.append(path)
            cursor += duration
            if index < len(segments) - 1:
                cursor += SEGMENT_GAP_SECONDS

        final_path = AUDIO_DIR / f"scene_{scene_id}.wav"
        concat_audio(segment_paths, final_path)
        final_duration = probe_duration(final_path)

        generated_tracks[scene_id] = {
            "file": f"scene_{scene_id}.wav",
            "duration_seconds": round(final_duration, 3),
            "segments": generated_segments,
        }

        print(
            f"Scene {scene_id}: {final_duration:.2f}s generated "
            f"from {len(generated_segments)} language segment(s)."
        )

    manifest = {
        **config,
        "generated": True,
        "segment_gap_seconds": SEGMENT_GAP_SECONDS,
        "tracks": generated_tracks,
    }
    save_json(GENERATED_MANIFEST, manifest)
    write_timings_module(manifest)
    print(f"Generated manifest: {GENERATED_MANIFEST}")
    print(f"Generated Remotion timings: {TIMINGS_TS}")


# ---------------------------------------------------------------------------
# Remotion rendering
# ---------------------------------------------------------------------------


def render() -> None:
    output = ROOT / "output" / "prototype.mp4"
    output.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "npx",
            "remotion",
            "render",
            "src/index.ts",
            "MainVideo",
            str(output),
            "--concurrency=50%",
        ],
        cwd=ROOT,
        check=True,
    )
    print(f"Rendered: {output}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(description="AI Video Prototype")
    parser.add_argument("--prepare", action="store_true")
    parser.add_argument("--images", action="store_true")
    parser.add_argument("--audio", action="store_true")
    parser.add_argument("--render", action="store_true")
    parser.add_argument("--all", action="store_true")
    args = parser.parse_args()

    if not any(vars(args).values()):
        parser.print_help()
        return

    if args.prepare:
        prepare()
    if args.all or args.images:
        generate_images()
    if args.all or args.audio:
        generate_audio()
    if args.all or args.render:
        render()


if __name__ == "__main__":
    main()

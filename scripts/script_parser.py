#!/usr/bin/env python3
"""Parse the content-first Markdown script into structured project/scene data."""
from __future__ import annotations

import json
import re
from pathlib import Path


def _clean(value: str) -> str:
    return value.strip().strip('`').strip()


def _parse_lang_heading(heading: str) -> tuple[str, str] | None:
    m = re.match(r"^(VOICEOVER|QUOTE)\s*[—-]\s*([A-Za-z-]+)", heading.strip(), re.I)
    if not m:
        return None
    return m.group(1).lower(), m.group(2)


def _parse_key_value_block(lines: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for line in lines:
        if ":" in line and line.strip() and not line.strip().startswith("#"):
            key, value = line.split(":", 1)
            result[key.strip()] = _clean(value)
    return result


def parse_script(path: Path) -> dict:
    lines = path.read_text(encoding="utf-8").splitlines()
    scenes: list[dict] = []
    settings: dict[str, str] = {}
    models: dict[str, str] = {}
    visual_style: dict[str, str] = {}
    music: dict[str, str] = {}
    ending: dict[str, str] = {}
    intro: dict[str, str] = {}
    current: dict | None = None
    current_section: str | None = None
    buffer: list[str] = []
    project_block: str | None = None

    def flush() -> None:
        nonlocal buffer, current_section
        if current_section == "on_screen_text":
            items = []
            for line in buffer:
                raw = line.strip().lstrip("- ")
                if not raw:
                    continue
                parts = [part.strip() for part in raw.split("|")]
                item = {
                    "text": parts[0],
                    "x_percent": float(parts[1]) if len(parts) > 1 and parts[1] else 8,
                    "y_percent": float(parts[2]) if len(parts) > 2 and parts[2] else 12,
                    "font_size": float(parts[3]) if len(parts) > 3 and parts[3] else 15,
                    "start_seconds": float(parts[4]) if len(parts) > 4 and parts[4] else 0,
                    "style": parts[5] if len(parts) > 5 and parts[5] else "default",
                }
                items.append(item)
            if current is not None:
                current["on_screen_text"] = items
            buffer = []
            return
        if current_section and current_section.startswith("visual_style:"):
            key = current_section.split(":", 1)[1]
            visual_style[key] = "\n".join(buffer).strip()
            buffer = []
            return
        if current_section == "animation" and current is not None:
            current["animation"] = _parse_key_value_block(buffer)
            buffer = []
            return
        if current_section == "motion_scene" and current is not None:
            raw_motion = "\n".join(buffer).strip()
            if raw_motion.startswith("```"):
                raw_motion = re.sub(r"^```(?:json)?\s*", "", raw_motion)
                raw_motion = re.sub(r"\s*```$", "", raw_motion)
            if raw_motion:
                try:
                    current["motion_scene"] = json.loads(raw_motion)
                except json.JSONDecodeError as exc:
                    raise ValueError(
                        f"Scene {current['scene_id']} has invalid MOTION SCENE JSON: {exc}"
                    ) from exc
            buffer = []
            return
        if current_section in {"settings", "models", "music", "ending", "intro"}:
            target = {
                "settings": settings,
                "models": models,
                "music": music,
                "ending": ending,
                "intro": intro,
            }[current_section]
            target.update(_parse_key_value_block(buffer))
            buffer = []
            return
        if current_section == "visual_style":
            visual_style.update(_parse_key_value_block(buffer))
            buffer = []
            return
        if current is None or current_section is None:
            buffer = []
            return
        value = "\n".join(buffer).strip()
        if current_section and ":" in current_section and current_section.split(":", 1)[0] in {"voiceover", "quote"}:
            kind, language = current_section.split(":", 1)
            if value:
                current["segments"].append({"kind": kind, "language": language, "text": value})
        elif value:
            current[current_section] = value
        buffer = []

    for raw in lines:
        line = raw.rstrip()
        scene_match = re.match(r"^##\s+(?:CHAPTER\s+\d+\s*/\s*)?SCENE\s+(\d+)\s*:?\s*(.*)$", line, re.I)
        if scene_match:
            flush()
            project_block = None
            current = {
                "scene_id": scene_match.group(1).zfill(3),
                "title": _clean(scene_match.group(2)) or f"Scene {scene_match.group(1)}",
                "segments": [],
            }
            scenes.append(current)
            current_section = None
            continue

        project_heading = re.match(r"^##\s+(.+?)\s*$", line)
        if project_heading and current is None:
            flush()
            normalized_project = re.sub(r"[^a-z0-9]+", "_", project_heading.group(1).lower()).strip("_")
            if normalized_project in {"visual_style", "settings", "models", "music", "ending", "intro"}:
                project_block = normalized_project
                current_section = normalized_project
                continue

        if current is None and project_block is None:
            continue

        heading = re.match(r"^###\s+(.+)$", line)
        if heading:
            flush()
            raw_heading = heading.group(1).strip()
            if current is None:
                if project_block == "visual_style":
                    normalized_style = re.sub(r"[^a-z0-9]+", "_", raw_heading.lower()).strip("_")
                    current_section = "visual_style:" + normalized_style
                else:
                    current_section = project_block
                continue
            lang_heading = _parse_lang_heading(raw_heading)
            if lang_heading:
                kind, language = lang_heading
                current_section = f"{kind}:{language}"
                continue
            normalized = re.sub(r"[^a-z0-9]+", "_", raw_heading.lower()).strip("_")
            aliases = {
                "atmosphere_sfx": "atmosphere",
                "graphic_text_overlays": "overlays",
                "on_screen_text": "on_screen_text",
                "screen_text": "on_screen_text",
                "visual": "visual",
                "style": "style",
                "image_prompt": "image_prompt",
                "negative_prompt": "negative_prompt",
                "camera": "camera",
                "remotion_camera": "remotion_camera",
                "reference_images": "reference_images",
                "style_reference": "style_reference",
                "continuity": "continuity",
                "visual_anchor": "visual_anchor",
                "start_state": "start_state",
                "end_state": "end_state",
                "animation": "animation",
                "motion_scene": "motion_scene",
                "ai_video_prompt": "animation",
                "ai_video": "animation",
                "animation_engine": "animation",
                "animation_mode": "animation",
            }
            current_section = aliases.get(normalized, normalized)
            continue

        if line.strip() == "---":
            flush()
            project_block = None if current is None else project_block
            continue

        if current_section:
            buffer.append(line)

    flush()

    # Normalize visual-style aliases and multiline style blocks.
    aliases = {
        "global_visual_identity": "global_visual_identity",
        "style_reference": "style_reference",
        "camera_style": "camera_style",
        "text_policy": "text_policy",
        "animation_philosophy": "animation_philosophy",
    }
    visual_style = {aliases.get(k, k): v for k, v in visual_style.items()}

    if not scenes:
        raise ValueError(f"No scenes found in Markdown script: {path}")

    settings.setdefault("fps", "30")
    settings.setdefault("width", "1920")
    settings.setdefault("height", "1080")
    settings.setdefault("language", "es-ES")
    settings.setdefault("voice", "shimmer")
    settings.setdefault("generation_mode", "remotion")

    visual_style.setdefault("global_visual_identity", "")
    visual_style.setdefault("style_reference", "")
    visual_style.setdefault("camera_style", "")

    music.setdefault("enabled", "false")
    music.setdefault("file", "audio/background_music.mp3")
    music.setdefault("volume", "0.10")
    music.setdefault("ducking", "true")
    music.setdefault("ducking_volume", "0.045")
    music.setdefault("fade_in_seconds", "2")
    music.setdefault("fade_out_seconds", "4")

    ending.setdefault("enabled", "true")
    ending.setdefault("title", "EL PRIMER ATAQUE COLECTIVO AUTOMATIZADO DE AGENTES")
    ending.setdefault("subtitle", "Una investigación sobre agentes de IA autónomos")
    ending.setdefault("hold_seconds", "4")
    ending.setdefault("fade_in_seconds", "1.5")
    ending.setdefault("fade_out_seconds", "2.5")
    ending.setdefault("music_fade_out_seconds", "4")

    intro.setdefault("enabled", "true")
    intro.setdefault("title", "EL PRIMER ATAQUE COLECTIVO AUTOMATIZADO DE AGENTES - JULIO DE 2026")
    intro.setdefault("subtitle", "Una investigación sobre agentes de IA autónomos")
    intro.setdefault("hold_seconds", "4")
    intro.setdefault("fade_in_seconds", "1.5")
    intro.setdefault("fade_out_seconds", "2.5")

    models.setdefault("image_provider", "")
    models.setdefault("image_model", "")
    models.setdefault("tts_provider", "")
    models.setdefault("tts_model", "")
    models.setdefault("tts_voice", "")
    models.setdefault("video_provider", "")
    models.setdefault("video_model", "")

    for scene in scenes:
        if not scene["segments"]:
            raise ValueError(f"Scene {scene['scene_id']} has no VOICEOVER/QUOTE blocks.")
        scene["segments"] = [
            {**segment, "id": f"{scene['scene_id']}_{segment['language'].lower()}_{index+1:02d}"}
            for index, segment in enumerate(scene["segments"])
        ]
        scene.setdefault("animation", {})
        if "visual" not in scene and "image_prompt" not in scene:
            raise ValueError(f"Scene {scene['scene_id']} needs a VISUAL or IMAGE PROMPT section.")

    return {
        "version": "1.3.0",
        "source": str(path),
        "settings": settings,
        "models": models,
        "visual_style": visual_style,
        "music": music,
        "ending": ending,
        "intro": intro,
        "scenes": scenes,
    }

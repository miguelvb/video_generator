#!/usr/bin/env python3
"""Parse the content-first Markdown script into structured scene data."""
from __future__ import annotations

import re
from pathlib import Path


def _clean(value: str) -> str:
    return value.strip().strip('`').strip()


def _parse_lang_heading(heading: str) -> tuple[str, str] | None:
    m = re.match(r"^(VOICEOVER|QUOTE)\s*[—-]\s*([A-Za-z-]+)", heading.strip(), re.I)
    if not m:
        return None
    return m.group(1).lower(), m.group(2)


def parse_script(path: Path) -> dict:
    lines = path.read_text(encoding="utf-8").splitlines()
    scenes: list[dict] = []
    settings: dict[str, str] = {}
    models: dict[str, str] = {}
    visual_style: dict[str, str] = {}
    in_visual_style = False
    current: dict | None = None
    current_section: str | None = None
    buffer: list[str] = []
    in_settings = False
    in_models = False

    def flush() -> None:
        nonlocal buffer, current_section, current
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
        if current_section in {"settings", "models", "visual_style"}:
            for line in buffer:
                if ":" in line and line.strip() and not line.strip().startswith("#"):
                    key, value = line.split(":", 1)
                    target = models if current_section == "models" else (visual_style if current_section == "visual_style" else settings)
                    target[key.strip()] = _clean(value)
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
            in_settings = False
            in_models = False
            in_visual_style = False
            current = {"scene_id": scene_match.group(1).zfill(3), "title": _clean(scene_match.group(2)) or f"Scene {scene_match.group(1)}", "segments": []}
            scenes.append(current)
            current_section = None
            continue

        if re.match(r"^##\s+VISUAL STYLE\s*$", line, re.I):
            flush()
            current = None
            current_section = "visual_style"
            in_visual_style = True
            in_settings = False
            in_models = False
            continue

        if re.match(r"^##\s+SETTINGS\s*$", line, re.I):
            flush()
            current = None
            current_section = "settings"
            in_settings = True
            in_models = False
            in_visual_style = False
            continue

        if re.match(r"^##\s+MODELS\s*$", line, re.I):
            flush()
            current = None
            current_section = "models"
            in_settings = False
            in_models = True
            in_visual_style = False
            continue

        if current is None and not (in_settings or in_models or in_visual_style):
            continue

        heading = re.match(r"^###\s+(.+)$", line)
        if heading:
            flush()
            raw_heading = heading.group(1).strip()
            if in_visual_style:
                normalized_style = re.sub(r"[^a-z0-9]+", "_", raw_heading.lower()).strip("_")
                style_aliases = {
                    "global_visual_identity": "global_visual_identity",
                    "style_reference": "style_reference",
                    "camera_style": "camera_style",
                }
                current_section = "visual_style:" + style_aliases.get(normalized_style, normalized_style)
                continue
            lang_heading = _parse_lang_heading(raw_heading)
            if lang_heading:
                kind, language = lang_heading
                current_section = f"{kind}:{language}"
                continue
            normalized = re.sub(r"[^a-z0-9]+", "_", raw_heading.lower()).strip("_")
            aliases = {"atmosphere_sfx": "atmosphere", "graphic_text_overlays": "overlays", "on_screen_text": "on_screen_text", "screen_text": "on_screen_text", "visual": "visual", "style": "style", "image_prompt": "image_prompt", "negative_prompt": "negative_prompt", "camera": "camera", "reference_images": "reference_images", "style_reference": "style_reference", "continuity": "continuity", "visual_anchor": "visual_anchor", "start_state": "start_state", "end_state": "end_state", "animation": "animation", "ai_video_prompt": "animation", "ai_video": "animation"}
            current_section = aliases.get(normalized, normalized)
            in_settings = False
            in_models = False
            continue

        if line.strip() == "---":
            flush()
            continue

        if current_section:
            buffer.append(line)

    flush()

    # Parse the project-level visual style independently so multiline style sections
    # are robust even when other parser states are active.
    style_start = None
    for idx, raw in enumerate(lines):
        if re.match(r"^##\s+VISUAL STYLE\s*$", raw.rstrip(), re.I):
            style_start = idx + 1
            break
    if style_start is not None:
        style_end = len(lines)
        for idx in range(style_start, len(lines)):
            if re.match(r"^##\s+", lines[idx].rstrip(), re.I):
                style_end = idx
                break
        current_key = None
        current_lines = []
        for raw in lines[style_start:style_end]:
            heading = re.match(r"^###\s+(.+)$", raw.rstrip())
            if heading:
                if current_key is not None:
                    visual_style[current_key] = "\n".join(current_lines).strip()
                key = re.sub(r"[^a-z0-9]+", "_", heading.group(1).strip().lower()).strip("_")
                current_key = {
                    "global_visual_identity": "global_visual_identity",
                    "style_reference": "style_reference",
                    "camera_style": "camera_style",
                }.get(key, key)
                current_lines = []
            elif current_key is not None and raw.strip() != "---":
                current_lines.append(raw)
        if current_key is not None:
            visual_style[current_key] = "\n".join(current_lines).strip()

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
        scene["segments"] = [{**segment, "id": f"{scene['scene_id']}_{segment['language'].lower()}_{index+1:02d}"} for index, segment in enumerate(scene["segments"])]
        if "visual" not in scene and "image_prompt" not in scene:
            raise ValueError(f"Scene {scene['scene_id']} needs a VISUAL or IMAGE PROMPT section.")

    return {"version": "1.2.0", "source": str(path), "settings": settings, "models": models, "visual_style": visual_style, "scenes": scenes}

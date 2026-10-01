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
    current: dict | None = None
    current_section: str | None = None
    buffer: list[str] = []
    in_settings = False

    def flush() -> None:
        nonlocal buffer, current_section, current
        if current_section == "settings":
            for line in buffer:
                if ":" in line and line.strip() and not line.strip().startswith("#"):
                    key, value = line.split(":", 1)
                    settings[key.strip()] = _clean(value)
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
            current = {"scene_id": scene_match.group(1).zfill(3), "title": _clean(scene_match.group(2)) or f"Scene {scene_match.group(1)}", "segments": []}
            scenes.append(current)
            current_section = None
            continue

        if re.match(r"^##\s+SETTINGS\s*$", line, re.I):
            flush()
            current = None
            current_section = "settings"
            in_settings = True
            continue

        if current is None and not in_settings:
            continue

        heading = re.match(r"^###\s+(.+)$", line)
        if heading:
            flush()
            raw_heading = heading.group(1).strip()
            lang_heading = _parse_lang_heading(raw_heading)
            if lang_heading:
                kind, language = lang_heading
                current_section = f"{kind}:{language}"
                continue
            normalized = re.sub(r"[^a-z0-9]+", "_", raw_heading.lower()).strip("_")
            aliases = {"atmosphere_sfx": "atmosphere", "graphic_text_overlays": "overlays", "visual": "visual", "style": "style", "image_prompt": "image_prompt", "negative_prompt": "negative_prompt", "camera": "camera", "reference_images": "reference_images", "animation": "animation"}
            current_section = aliases.get(normalized, normalized)
            in_settings = False
            continue

        if line.strip() == "---":
            flush()
            continue

        if current_section:
            buffer.append(line)

    flush()

    if not scenes:
        raise ValueError(f"No scenes found in Markdown script: {path}")

    settings.setdefault("fps", "30")
    settings.setdefault("width", "1920")
    settings.setdefault("height", "1080")
    settings.setdefault("language", "es-ES")
    settings.setdefault("voice", "shimmer")

    for scene in scenes:
        if not scene["segments"]:
            raise ValueError(f"Scene {scene['scene_id']} has no VOICEOVER/QUOTE blocks.")
        scene["segments"] = [{**segment, "id": f"{scene['scene_id']}_{segment['language'].lower()}_{index+1:02d}"} for index, segment in enumerate(scene["segments"])]
        if "visual" not in scene and "image_prompt" not in scene:
            raise ValueError(f"Scene {scene['scene_id']} needs a VISUAL or IMAGE PROMPT section.")

    return {"version": "1.0.0", "source": str(path), "settings": settings, "scenes": scenes}

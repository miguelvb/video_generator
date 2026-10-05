#!/usr/bin/env python3
"""Checks run before spending money or render time.

`validate_project` checks the script itself (scenes, motion scenes, files it
points to). `check_environment` checks the machine (tools, packages, API keys).
Both return lists of human-readable problems; an empty list means OK.
"""
from __future__ import annotations

import os
import re

from cues import cue_errors
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
ASSET_REGISTRY = ROOT / "src" / "remotion" / "animation" / "assetRegistry.ts"

NODE_ACTIONS = {"appear", "move", "pulse", "fade"}
EDGE_ACTIONS = {"connect", "send"}
STATE_ACTIONS = {"activate", "succeed", "error"}
NEEDS_DURATION = {"move", "pulse", "fade", "send"}
CAMERA_MOVES = {"static", "push_in", "pull_out", "pan_right", "pan_left", "pan_down", "diagonal_drift"}
TEXT_STYLES = {"label", "quote"}


def motion_assets() -> dict[str, str]:
    """Asset name -> file under public/, read from the TypeScript registry."""
    text = ASSET_REGISTRY.read_text(encoding="utf-8")
    return {
        name: path
        for name, path in re.findall(r"'?([a-z][a-z0-9-]*)'?\s*:\s*\{[^}]*?path:\s*'([^']+)'", text, re.S)
    }


def _is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool)


def validate_motion_scene(scene_id: str, motion: dict, scene_frames: int | None = None,
                          warnings: list[str] | None = None) -> list[str]:
    """Same rules the renderer enforces (motionScene.ts), checked before rendering.

    Returns errors. Actions that run past the narration are cut off, not broken,
    so they are reported in `warnings` instead.
    """
    errors: list[str] = []
    warnings = warnings if warnings is not None else []
    where = f"Scene {scene_id} MOTION SCENE"
    assets = motion_assets()

    nodes = motion.get("nodes") or []
    connections = motion.get("connections") or []
    node_ids = [n.get("id") for n in nodes]
    edge_ids = [c.get("id") for c in connections]
    for dup in sorted({i for i in node_ids + edge_ids if (node_ids + edge_ids).count(i) > 1}):
        errors.append(f"{where}: id {dup!r} is used more than once")

    if not _is_number(motion.get("durationInFrames")):
        errors.append(f"{where}: needs a numeric durationInFrames")

    for node in nodes:
        if not _is_number(node.get("x")) or not _is_number(node.get("y")):
            errors.append(f"{where}: node {node.get('id')!r} needs numeric x and y")
        asset = node.get("asset")
        if asset is not None and asset not in assets:
            errors.append(f"{where}: node {node.get('id')!r} uses unknown asset {asset!r} (known: {', '.join(sorted(assets))})")
        if asset is None and node.get("shape") != "boundary":
            errors.append(f"{where}: node {node.get('id')!r} needs an asset or shape: boundary")

    for conn in connections:
        for end in ("from", "to"):
            if conn.get(end) not in node_ids:
                errors.append(f"{where}: connection {conn.get('id')!r} {end} unknown node {conn.get(end)!r}")

    for group in motion.get("groups") or []:
        for nid in group.get("nodeIds", []):
            if nid not in node_ids:
                errors.append(f"{where}: group {group.get('id')!r} lists unknown node {nid!r}")
    focus = motion.get("cameraFocus")
    if focus and focus.get("groupId") not in {g.get("id") for g in motion.get("groups") or []}:
        errors.append(f"{where}: cameraFocus uses unknown group {focus.get('groupId')!r}")

    background = motion.get("background")
    if background and not (PUBLIC / background).exists():
        errors.append(f"{where}: background file not found: public/{background}")

    for index, action in enumerate(motion.get("actions") or []):
        kind, target = action.get("type"), action.get("target")
        label = f"{where}: action #{index + 1} ({kind} {target!r})"
        if kind not in NODE_ACTIONS | EDGE_ACTIONS | STATE_ACTIONS:
            errors.append(f"{label}: unknown action type")
            continue
        is_node, is_edge = target in node_ids, target in edge_ids
        if not (is_node or is_edge):
            errors.append(f"{label}: unknown target")
        elif kind in NODE_ACTIONS and not is_node:
            errors.append(f"{label}: needs a node, but the target is a connection")
        elif kind in EDGE_ACTIONS and not is_edge:
            errors.append(f"{label}: needs a connection, but the target is a node")
        if not _is_number(action.get("at")):
            if "word" not in action:  # unresolved word cues are reported by cue_errors
                errors.append(f"{label}: needs 'at' (a frame) or 'word' (a spoken word)")
            continue
        if kind in NEEDS_DURATION and not _is_number(action.get("duration")):
            errors.append(f"{label}: needs a 'duration' in frames")
            continue
        if "duration" in action and not (_is_number(action["duration"]) and action["duration"] > 0):
            errors.append(f"{label}: 'duration' must be a positive number")
            continue
        if scene_frames is not None:
            end = action["at"] + (action.get("duration") or 0)
            if end > scene_frames:
                warnings.append(f"{label}: ends at frame {end}, after the scene's narration ends ({scene_frames} frames)")
    return errors


def validate_project(project: dict, scene_frames: dict[str, int] | None = None) -> tuple[list[str], list[str]]:
    """(errors, warnings) for the parsed script. `scene_frames` (measured narration) enables timing checks."""
    errors: list[str] = []
    warnings: list[str] = []
    scene_frames = scene_frames or {}

    mode = str(project["settings"].get("generation_mode", "remotion")).lower()
    if mode not in {"remotion", "ai_video"}:
        errors.append(f"SETTINGS generation_mode must be remotion or ai_video, not {mode!r}")

    music = project.get("music") or {}
    if str(music.get("enabled", "false")).lower() == "true":
        music_file = str(music.get("file", "")).lstrip("/").removeprefix("public/")
        if not (PUBLIC / music_file).exists():
            errors.append(f"MUSIC is enabled but public/{music_file} does not exist")
    intro_bg = (project.get("intro") or {}).get("background")
    if intro_bg and not (PUBLIC / str(intro_bg).removeprefix("public/")).exists():
        errors.append(f"INTRO background not found: public/{intro_bg}")

    style_ref = str((project.get("visual_style") or {}).get("style_reference", "")).strip()
    if style_ref and not (ROOT / style_ref).exists():
        errors.append(f"VISUAL STYLE style reference not found: {style_ref}")

    for scene in project["scenes"]:
        sid = scene["scene_id"]
        for ref in str(scene.get("reference_images", "")).splitlines():
            ref = ref.strip().lstrip("- ")
            if ref and not (ROOT / ref).exists():
                errors.append(f"Scene {sid}: reference image not found: {ref}")
        camera = str(scene.get("remotion_camera", "static")).strip().lower()
        if not scene.get("motion_scene") and camera not in CAMERA_MOVES:
            errors.append(f"Scene {sid}: REMOTION CAMERA {camera!r} is not one of {', '.join(sorted(CAMERA_MOVES))}")
        for item in scene.get("on_screen_text") or []:
            if item["style"] not in TEXT_STYLES:
                errors.append(f"Scene {sid}: ON SCREEN TEXT style {item['style']!r} is not one of {', '.join(sorted(TEXT_STYLES))}")
        if scene.get("motion_scene"):
            errors += cue_errors(scene)
            errors += validate_motion_scene(sid, scene["motion_scene"], scene_frames.get(sid), warnings)
    return errors, warnings


def check_environment(project: dict | None = None) -> list[str]:
    """Problems with the machine: missing tools, packages or API keys."""
    problems: list[str] = []
    for tool in ("ffmpeg", "ffprobe", "node"):
        if not shutil.which(tool):
            problems.append(f"'{tool}' is not installed or not on PATH")
    remotion_bin = ROOT / "node_modules" / ".bin" / ("remotion.cmd" if os.name == "nt" else "remotion")
    if not remotion_bin.exists():
        problems.append("Remotion is not installed: run `npm install`")
    if not os.environ.get("OPENAI_API_KEY"):
        problems.append("OPENAI_API_KEY is not set (needed for narration)")
    needs_openrouter = True
    if project is not None:
        has_image_scenes = any(not s.get("motion_scene") for s in project["scenes"])
        ai_video = str(project["settings"].get("generation_mode", "remotion")).lower() == "ai_video"
        needs_openrouter = has_image_scenes or ai_video
    if needs_openrouter and not os.environ.get("OPENROUTER_API_KEY"):
        problems.append("OPENROUTER_API_KEY is not set (needed for images and AI video)")
    return problems

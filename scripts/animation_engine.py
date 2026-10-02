#!/usr/bin/env python3
"""Low-cost deterministic animation asset preparation.

SVG animations are implemented directly by Remotion from scene metadata.
Manim scenes are rendered to transparent WebM clips when Manim is installed.
The Markdown scene block is the source of truth.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIM_SCRIPT = ROOT / "scripts" / "manim_scene.py"
MANIM_DIR = ROOT / "public" / "video" / "manim"


def animation_config(scene: dict) -> dict:
    value = scene.get("animation") or {}
    if isinstance(value, dict):
        return {str(k): str(v) for k, v in value.items()}
    return {}


def prepare_manim_scene(scene: dict, fps: int = 30) -> Path | None:
    cfg = animation_config(scene)
    if cfg.get("engine", "").lower() != "manim":
        return None

    manim = shutil.which("manim")
    if not manim:
        raise RuntimeError(
            f"Scene {scene['scene_id']} uses Manim, but 'manim' is not installed. "
            "Install it with: pip install manim"
        )

    scene_id = str(scene["scene_id"]).zfill(3)
    output = MANIM_DIR / f"scene_{scene_id}.webm"
    MANIM_DIR.mkdir(parents=True, exist_ok=True)

    duration = max(1.0, float(cfg.get("duration_seconds", "8")))
    anim_type = cfg.get("type", "network").lower()
    cmd = [
        manim, "-q", "m", "--format", "webm", "-t",
        "--media_dir", str(ROOT / "build" / "manim"),
        "--output_file", output.name,
        str(MANIM_SCRIPT), "GeneratedScene",
    ]
    env = os.environ.copy()
    env.update({
        "VIDEO_ANIMATION_SCENE_ID": scene_id,
        "VIDEO_ANIMATION_TYPE": anim_type,
        "VIDEO_ANIMATION_DURATION": str(duration),
        "VIDEO_ANIMATION_FPS": str(fps),
        "VIDEO_ANIMATION_OUTPUT": str(output),
    })
    subprocess.run(cmd, cwd=ROOT, check=True, env=env)

    # Manim writes under build/manim/videos/...; copy the generated file to the
    # stable public path consumed by Remotion.
    candidates = list((ROOT / "build" / "manim").rglob(output.name))
    if not candidates:
        candidates = list((ROOT / "build" / "manim").rglob(f"{output.stem}.webm"))
    if not candidates:
        raise RuntimeError(f"Manim completed but no WebM output was found for scene {scene_id}.")
    shutil.copy2(candidates[-1], output)
    return output


def prepare_animations(project: dict, scene_selection: list[str] | None = None) -> None:
    selected = set(scene_selection or [str(s["scene_id"]) for s in project["scenes"]])
    fps = int(float(project.get("settings", {}).get("fps", 30)))
    for scene in project["scenes"]:
        if str(scene["scene_id"]) not in selected:
            continue
        cfg = animation_config(scene)
        engine = cfg.get("engine", "").lower()
        if engine == "manim":
            output = prepare_manim_scene(scene, fps=fps)
            print(f"Prepared Manim animation: {output}")
        elif engine == "svg":
            print(f"Prepared SVG animation metadata for scene {scene['scene_id']} (rendered deterministically by Remotion).")

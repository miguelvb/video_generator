#!/usr/bin/env python3
"""Validate that project JSON files and required source files are present."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REQUIRED = [
    "project/project.json",
    "project/style_bible.json",
    "project/script.md",
    "scenes/001/scene.json",
    "scenes/002/scene.json",
    "scripts/orchestrator.py",
    "scripts/validate_project.py",
    "src/index.ts",
    "src/Root.tsx",
    "src/remotion/MainVideo.tsx",
    "package.json",
    "tsconfig.json",
]

errors: list[str] = []

for relative in REQUIRED:
    path = ROOT / relative
    if not path.exists():
        errors.append(f"Missing: {relative}")

for path in ROOT.rglob("*.json"):
    try:
        json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"Invalid JSON: {path.relative_to(ROOT)} — {exc}")

if errors:
    print("VALIDATION FAILED")
    for error in errors:
        print(" -", error)
    raise SystemExit(1)

print("VALIDATION OK")
print("All required files exist and all JSON files are valid.")

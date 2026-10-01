#!/usr/bin/env python3
"""Validate the content-first Markdown project and generated build artifacts."""
from __future__ import annotations
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from script_parser import parse_script

script = ROOT / 'project' / 'script.md'
errors=[]
try:
    project=parse_script(script)
except Exception as exc:
    errors.append(f'Markdown parse failed: {exc}')
    project=None

for rel in ['package.json','scripts/orchestrator.py','scripts/script_parser.py','src/index.ts','src/Root.tsx','src/remotion/MainVideo.tsx','project/script.md']:
    if not (ROOT/rel).exists(): errors.append(f'Missing: {rel}')

if project:
    ids=[s['scene_id'] for s in project['scenes']]
    if len(ids)!=len(set(ids)): errors.append('Duplicate scene IDs')
    for scene in project['scenes']:
        if not scene.get('segments'): errors.append(f"Scene {scene['scene_id']} has no voice segments")
        if not scene.get('image_prompt') and not scene.get('visual'): errors.append(f"Scene {scene['scene_id']} has no visual definition")

for path in ROOT.rglob('*.json'):
    try: json.loads(path.read_text(encoding='utf-8'))
    except Exception as exc: errors.append(f'Invalid JSON: {path.relative_to(ROOT)} — {exc}')

if errors:
    print('VALIDATION FAILED')
    print('\n'.join(f' - {e}' for e in errors))
    raise SystemExit(1)

print('VALIDATION OK')
print(f"Markdown source: {script.relative_to(ROOT)}")
print('Scenes:', ', '.join(s['scene_id'] for s in project['scenes']))
print('The generated JSON/TS files are build artifacts; edit project/script.md instead.')

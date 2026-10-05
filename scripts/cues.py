#!/usr/bin/env python3
"""Turn word cues in motion scenes into frame numbers.

A motion action can be timed to the narration instead of a fixed frame:

    {"type": "appear", "target": "a1", "word": "agentes"}
    {"type": "pulse",  "target": "a4", "word": "pruebas", "occurrence": 2, "offset": 0.3, "duration": 12}

`word` is a word from the scene's narration, `occurrence` picks the n-th time it
is spoken (default 1), `offset` shifts the action in seconds (may be negative).
At build time each cue becomes a plain `at` frame, so the renderer still only
sees authored frames.

Timing source, best first:
  1. Whisper word timestamps for the scene's audio (exact; made by the audio step)
  2. an estimate from the word's position in the text and the measured segment
     length (used until word timestamps exist)
  3. an estimate from the text alone at ~2.6 words/second (no audio yet)
"""
from __future__ import annotations

import re
import unicodedata

WORDS_PER_SECOND_GUESS = 2.6


def normalise(word: str) -> str:
    """Lower-case, accents kept, punctuation dropped: 'agentes,' -> 'agentes'."""
    word = unicodedata.normalize("NFC", str(word)).lower()
    return re.sub(r"[^\w]", "", word).replace("_", "")


def uses_word_cues(scene: dict) -> bool:
    return any("word" in a for a in (scene.get("motion_scene") or {}).get("actions", []))


def _text_words(text: str) -> list[tuple[str, int]]:
    """(normalised word, character offset) for each word in the text."""
    return [(normalise(m.group()), m.start()) for m in re.finditer(r"\S+", text) if normalise(m.group())]


def word_times(scene: dict, track: dict | None) -> list[tuple[str, float]]:
    """(normalised word, start second within the scene) for every spoken word, in order."""
    times: list[tuple[str, float]] = []
    if track:
        for seg in track.get("segments", []):
            seg_start = float(seg.get("start_seconds", 0.0))
            if seg.get("words"):
                times += [(normalise(w["word"]), seg_start + float(w["start_seconds"])) for w in seg["words"] if normalise(w["word"])]
            else:
                text = seg.get("text", "")
                length = max(1, len(text))
                duration = float(seg.get("duration_seconds", 0.0))
                times += [(w, seg_start + duration * offset / length) for w, offset in _text_words(text)]
        return times
    cursor = 0.0
    for seg in scene.get("segments", []):
        words = _text_words(seg["text"])
        times += [(w, cursor + i / WORDS_PER_SECOND_GUESS) for i, (w, _) in enumerate(words)]
        cursor += len(words) / WORDS_PER_SECOND_GUESS + 0.12
    return times


def find_cue(times: list[tuple[str, float]], action: dict) -> float | None:
    wanted = normalise(action["word"])
    hits = [t for w, t in times if w == wanted]
    occurrence = int(action.get("occurrence", 1))
    if len(hits) < occurrence:
        return None
    return hits[occurrence - 1] + float(action.get("offset", 0.0))


def cue_errors(scene: dict) -> list[str]:
    """Cues that name a word the narration does not contain (often enough)."""
    times = word_times(scene, None)
    errors = []
    for index, action in enumerate((scene.get("motion_scene") or {}).get("actions", [])):
        if "word" in action and find_cue(times, action) is None:
            occ = int(action.get("occurrence", 1))
            errors.append(
                f"Scene {scene['scene_id']} MOTION SCENE: action #{index + 1} ({action.get('type')} "
                f"{action.get('target')!r}): the narration does not say {action['word']!r}"
                + (f" {occ} times" if occ > 1 else "")
            )
    return errors


def resolve_cues(scene: dict, track: dict | None, fps: int) -> None:
    """Replace word cues with `at` frames in place. Unresolvable cues are left for validation to report."""
    motion = scene.get("motion_scene")
    if not motion:
        return
    times = word_times(scene, track)
    for action in motion.get("actions", []):
        if "word" not in action:
            continue
        seconds = find_cue(times, action)
        if seconds is not None:
            action["at"] = max(0, round(seconds * fps))
            # Leave only the resolved frame, so the generated scene is plain data.
            for key in ("word", "occurrence", "offset"):
                action.pop(key, None)

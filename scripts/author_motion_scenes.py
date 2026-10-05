#!/usr/bin/env python3
"""Author the 30 motion scenes for project/script.md.

Each scene animates what its narration says, using the registered SVG assets.
Timing is driven by `word` cues (a word from that scene's narration) wherever a
beat should land on a spoken word; fixed `at` frames are used for the opening
and for purely visual beats. Coordinates are 0-100 (% of frame), y downward.
Sizes are pixels on the 854x480 frame. This script replaces the MOTION SCENE
block of every scene (inserting one where there was none) and leaves all other
sections — narration, visuals, transitions — untouched.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "project" / "script.md"
FPS = 30
CYAN = "#39f6ff"

# Measured narration length per scene (seconds) — sets the JSON fallback duration.
SECONDS = {
    "001": 10.9, "002": 11.85, "003": 6.25, "004": 14.85, "005": 4.75, "006": 9.57,
    "007": 6.9, "008": 17.3, "009": 16.62, "010": 10.5, "011": 18.3, "012": 14.4,
    "013": 10.8, "014": 12.05, "015": 9.05, "016": 12.37, "017": 12.2, "018": 14.771,
    "019": 11.0, "020": 10.87, "021": 8.95, "022": 10.25, "023": 7.15, "024": 15.55,
    "025": 4.1, "026": 11.95, "027": 9.2, "028": 11.171, "029": 5.6, "030": 14.271,
}


def grid(prefix, count, cx, cy, cols, dx, dy, size=26, asset="agent-ui"):
    """A centred grid of `count` nodes, row-major."""
    rows = (count + cols - 1) // cols
    nodes = []
    for i in range(count):
        r, c = divmod(i, cols)
        x = cx + (c - (cols - 1) / 2) * dx
        y = cy + (r - (rows - 1) / 2) * dy
        nodes.append({"id": f"{prefix}{i+1}", "asset": asset, "x": round(x, 2), "y": round(y, 2), "size": size})
    return nodes


def appears(ids, start, step, dur=14):
    return [{"type": "appear", "target": i, "at": start + k * step, "duration": dur} for k, i in enumerate(ids)]


def A(type, target, **kw):
    return {"type": type, "target": target, **kw}


# Small helpers for recurring layouts
def board(x=50, y=50, size=150, id="board"):
    return {"id": id, "asset": "artifactory-ui", "x": x, "y": y, "size": size}


SCENES: dict[str, dict] = {}

# 001 — closed environment; OpenAI launches the experiment; dense agent sample.
cluster1 = grid("a", 15, 50, 49, 5, 8, 11, size=24)
SCENES["001"] = {
    "nodes": [
        {"id": "env", "shape": "boundary", "x": 50, "y": 50, "size": 100},
        {"id": "openai", "asset": "openai-ui", "x": 50, "y": 23, "size": 60},
        *cluster1,
        {"id": "dots", "asset": "ellipsis", "x": 50, "y": 66, "size": 40},
    ],
    "connections": [],
    "actions": [
        A("appear", "env", at=4, duration=20),
        A("appear", "openai", word="OpenAI", duration=18),
        *appears([n["id"] for n in cluster1], 150, 7, 12),
        A("appear", "dots", at=270, duration=16),
    ],
}

# 002 — >1000 agents created; autonomous work on complex tests (agents light up one at a time).
cluster2 = grid("a", 18, 50, 48, 6, 7.5, 11, size=24)
ids2 = [n["id"] for n in cluster2]
SCENES["002"] = {
    "nodes": [
        {"id": "env", "shape": "boundary", "x": 50, "y": 50, "size": 100},
        *cluster2,
        {"id": "dots", "asset": "ellipsis", "x": 50, "y": 67, "size": 40},
    ],
    "connections": [],
    "actions": [
        A("appear", "env", at=2, duration=16),
        *appears(ids2, 6, 5, 12),
        A("appear", "dots", at=120, duration=14),
        # autonomous activity: single agents brighten, one at a time, on the task words
        A("pulse", "a3", word="tarea", duration=20),
        A("pulse", "a9", word="resolver", duration=20),
        A("pulse", "a14", word="pruebas", duration=20),
        A("pulse", "a6", word="autónoma", duration=20),
        A("pulse", "a17", word="organización", duration=20),
    ],
}

# 003 — agents must pass tests independently (separated single activations, no links).
cluster3 = grid("a", 15, 50, 49, 5, 8, 11, size=24)
SCENES["003"] = {
    "nodes": [
        {"id": "env", "shape": "boundary", "x": 50, "y": 50, "size": 100},
        *cluster3,
    ],
    "connections": [],
    "actions": [
        A("appear", "env", at=2, duration=14),
        *appears([n["id"] for n in cluster3], 4, 3, 10),
        A("pulse", "a2", word="superar", duration=18),
        A("pulse", "a8", word="pruebas", duration=18),
        A("pulse", "a13", word="independiente", duration=22),
    ],
}

# 004 — one agent leaves isolation and reaches the shared Artifactory board; first message.
SCENES["004"] = {
    "nodes": [
        {"id": "env", "shape": "boundary", "x": 50, "y": 50, "size": 100},
        {"id": "agent1", "asset": "agent-ui", "x": 24, "y": 32, "size": 46},
        board(60, 52, 140),
    ],
    "connections": [{"id": "a1-board", "from": "agent1", "to": "board", "curvature": -6}],
    "actions": [
        A("appear", "env", at=2, duration=14),
        A("appear", "agent1", at=10, duration=16),
        A("appear", "board", word="servidor", duration=18),
        A("move", "agent1", word="canal", duration=40, x=40, y=46),
        A("connect", "a1-board", word="mensajes"),
        A("send", "a1-board", word="mensajes", offset=0.4, duration=42),
        A("set-edge-state", "a1-board", word="descubrimiento", state="active"),
    ],
}

# 005 — discovery: board central, other agents reveal around it and connect. (EN quote on screen)
ring5 = [("ra1", 22, 30), ("ra2", 78, 30), ("ra3", 20, 68), ("ra4", 80, 68)]
SCENES["005"] = {
    "nodes": [
        board(50, 50, 140),
        {"id": "ra1", "asset": "agent-ui", "x": 22, "y": 30, "size": 40},
        {"id": "ra2", "asset": "agent-ui", "x": 78, "y": 30, "size": 40},
        {"id": "ra3", "asset": "agent-ui", "x": 22, "y": 70, "size": 40},
    ],
    "connections": [
        {"id": "b-ra1", "from": "ra1", "to": "board", "curvature": 6},
        {"id": "b-ra2", "from": "ra2", "to": "board", "curvature": -6},
        {"id": "b-ra3", "from": "ra3", "to": "board", "curvature": -6},
    ],
    "actions": [
        A("appear", "board", at=2, duration=12),
        A("appear", "ra1", word="shared", duration=12),
        A("connect", "b-ra1", word="shared", offset=0.2),
        A("appear", "ra2", word="board", duration=12),
        A("connect", "b-ra2", word="board", offset=0.2),
        A("appear", "ra3", word="found", duration=12),
        A("connect", "b-ra3", word="found", offset=0.2),
    ],
}

# 006 — wider network around the board; another agent confirms a collective. (EN quote)
net6 = grid("a", 8, 50, 50, 4, 16, 26, size=30)
# arrange around a central board instead of grid centre
pos6 = [(24, 26), (50, 20), (76, 26), (18, 52), (82, 52), (28, 78), (50, 84), (72, 78)]
nodes6 = [{"id": f"a{i+1}", "asset": "agent-ui", "x": x, "y": y, "size": 30} for i, (x, y) in enumerate(pos6)]
conns6 = [{"id": f"b-a{i+1}", "from": f"a{i+1}", "to": "board", "curvature": (6 if x < 50 else -6)} for i, (x, y) in enumerate(pos6)]
SCENES["006"] = {
    "nodes": [board(50, 50, 120), *nodes6],
    "connections": conns6,
    "actions": [
        A("appear", "board", at=2, duration=12),
        *[a for i in range(8) for a in (
            A("appear", f"a{i+1}", at=10 + i * 16, duration=12),
            A("connect", f"b-a{i+1}", at=18 + i * 16),
        )],
        A("pulse", "a2", word="colectivo", duration=24),
    ],
}

# 007 — hundreds of agents converge on the shared channel (dense swarm).
swarm7 = grid("a", 24, 50, 50, 8, 9, 13, size=18)
SCENES["007"] = {
    "nodes": [board(50, 50, 110), *swarm7],
    "connections": [{"id": f"b-a{i+1}", "from": f"a{i+1}", "to": "board", "curvature": 0} for i in range(24)],
    "actions": [
        A("appear", "board", at=2, duration=12),
        *appears([n["id"] for n in swarm7], 8, 3, 8),
        *[A("connect", f"b-a{i+1}", at=14 + i * 3) for i in range(24)],
        A("set-node-state", "board", word="cientos", state="active"),
    ],
}

# 008 — agents + abstract math/logic and a test module; they derive the flags directly.
ring8 = [(22, 32), (22, 68), (78, 32), (78, 68)]
nodes8 = [{"id": f"a{i+1}", "asset": "agent-ui", "x": x, "y": y, "size": 32} for i, (x, y) in enumerate(ring8)]
SCENES["008"] = {
    "nodes": [
        {"id": "task", "asset": "task-module-ui", "x": 50, "y": 42, "size": 150},
        {"id": "idea", "asset": "idea-ui", "x": 50, "y": 50, "size": 0},  # placeholder removed below
        *nodes8,
        {"id": "flag", "asset": "flag-ui", "x": 50, "y": 74, "size": 96},
    ],
    "connections": [{"id": f"t-a{i+1}", "from": f"a{i+1}", "to": "task", "curvature": 0} for i in range(4)],
    "actions": [
        A("appear", "task", word="sistema", duration=18),
        *appears([f"a{i+1}" for i in range(4)], 6, 10, 14),
        *[A("connect", f"t-a{i+1}", word="patrones", offset=0.2 * i) for i in range(4)],
        A("appear", "flag", word="flags", duration=18),
        A("set-node-state", "flag", word="directa", state="success"),
    ],
}
SCENES["008"]["nodes"] = [n for n in SCENES["008"]["nodes"] if n["id"] != "idea"]

# 009 — several agents coordinate through the board, sharing technical detail. (EN quote)
pos9 = [(22, 30), (78, 30), (22, 70), (78, 70)]
nodes9 = [{"id": f"a{i+1}", "asset": "agent-ui", "x": x, "y": y, "size": 34} for i, (x, y) in enumerate(pos9)]
conns9 = [{"id": f"b-a{i+1}", "from": f"a{i+1}", "to": "board", "curvature": (6 if x < 50 else -6)} for i, (x, y) in enumerate(pos9)]
SCENES["009"] = {
    "nodes": [board(50, 50, 140), *nodes9],
    "connections": conns9,
    "actions": [
        A("appear", "board", at=2, duration=12),
        *appears([f"a{i+1}" for i in range(4)], 8, 8, 12),
        A("connect", "b-a1", word="coordinarse"),
        A("send", "b-a1", word="coordinarse", offset=0.3, duration=36),
        A("connect", "b-a2", word="foro"),
        A("send", "b-a2", word="foro", offset=0.3, duration=36),
        A("connect", "b-a3", word="técnicos"),
        A("send", "b-a3", word="técnicos", offset=0.3, duration=36),
        A("connect", "b-a4", word="engañar"),
        A("send", "b-a4", word="engañar", offset=0.3, duration=36),
        # late beats, through the English quote read at the end
        A("succeed", "board", word="evaluador"),
        A("pulse", "a3", word="accounts", duration=22),
        A("pulse", "a1", word="tokens", duration=26),
    ],
}

# 010 — shared-work logic: agents coordinate to manipulate records and falsify results.
pos10 = [(24, 32), (76, 32), (24, 68), (76, 68)]
nodes10 = [{"id": f"a{i+1}", "asset": "agent-ui", "x": x, "y": y, "size": 34} for i, (x, y) in enumerate(pos10)]
conns10 = [{"id": f"b-a{i+1}", "from": f"a{i+1}", "to": "board", "curvature": (7 if x < 50 else -7)} for i, (x, y) in enumerate(pos10)]
SCENES["010"] = {
    "nodes": [board(50, 50, 140), {"id": "doc", "asset": "document-ui", "x": 50, "y": 50, "size": 0}, *nodes10],
    "connections": conns10,
    "actions": [
        A("appear", "board", at=2, duration=12),
        *appears([f"a{i+1}" for i in range(4)], 8, 8, 12),
        *[A("connect", f"b-a{i+1}", word="compartido", offset=0.15 * i) for i in range(4)],
        *[A("send", f"b-a{i+1}", word="manipular", offset=0.15 * i, duration=34) for i in range(4)],
        A("set-node-state", "board", word="falsear", state="error"),
    ],
}
SCENES["010"]["nodes"] = [n for n in SCENES["010"]["nodes"] if n["id"] != "doc"]

# 011 — local tasks blocked; the collective concludes it needs external sources.
pos11 = [(26, 34), (74, 34), (26, 66), (74, 66)]
nodes11 = [{"id": f"a{i+1}", "asset": "agent-ui", "x": x, "y": y, "size": 32} for i, (x, y) in enumerate(pos11)]
SCENES["011"] = {
    "nodes": [
        {"id": "env", "shape": "boundary", "x": 50, "y": 50, "size": 100},
        board(50, 50, 130),
        *nodes11,
        {"id": "internet", "asset": "internet-ui", "x": 50, "y": 50, "size": 0},
    ],
    "connections": [{"id": f"b-a{i+1}", "from": f"a{i+1}", "to": "board", "curvature": (6 if x < 50 else -6)} for i, (x, y) in enumerate(pos11)],
    "actions": [
        A("appear", "env", at=2, duration=14),
        A("appear", "board", at=10, duration=14),
        *appears([f"a{i+1}" for i in range(4)], 16, 7, 12),
        *[A("connect", f"b-a{i+1}", at=46 + i * 6) for i in range(4)],
        A("set-node-state", "board", word="imposibles", state="error"),
        # carry motion through the long sentence to its end
        A("pulse", "a1", word="conclusión", duration=22),
        A("pulse", "a3", word="información", duration=22),
        A("pulse", "a4", word="externas", duration=28),
    ],
}
SCENES["011"]["nodes"] = [n for n in SCENES["011"]["nodes"] if n["id"] != "internet"]

# 012 — SSRF escape: through a gap in the internal server, requests reach the public internet.
SCENES["012"] = {
    "nodes": [
        {"id": "env", "shape": "boundary", "x": 36, "y": 50, "size": 100},
        board(30, 50, 130),
        {"id": "a1", "asset": "agent-ui", "x": 18, "y": 30, "size": 34},
        {"id": "a2", "asset": "agent-ui", "x": 18, "y": 70, "size": 34},
        {"id": "internet", "asset": "internet-ui", "x": 82, "y": 50, "size": 140},
    ],
    "connections": [
        {"id": "a1-b", "from": "a1", "to": "board", "curvature": 5},
        {"id": "a2-b", "from": "a2", "to": "board", "curvature": -5},
        {"id": "b-net", "from": "board", "to": "internet", "curvature": 0},
    ],
    "actions": [
        A("appear", "env", at=2, duration=14),
        A("appear", "board", at=8, duration=14),
        A("appear", "a1", at=20, duration=12),
        A("appear", "a2", at=28, duration=12),
        A("connect", "a1-b", at=40),
        A("connect", "a2-b", at=48),
        A("appear", "internet", word="servidor", duration=16),
        A("connect", "b-net", word="saltarse"),
        A("send", "b-net", word="peticiones", duration=46),
        A("set-edge-state", "b-net", word="pública", state="active"),
    ],
}

# 013 — the external agent network reaches a generic AI-project platform.
SCENES["013"] = {
    "nodes": [
        {"id": "a1", "asset": "agent-ui", "x": 18, "y": 38, "size": 34},
        {"id": "a2", "asset": "agent-ui", "x": 18, "y": 64, "size": 34},
        {"id": "internet", "asset": "internet-ui", "x": 42, "y": 50, "size": 120},
        {"id": "repo", "asset": "repo-ui", "x": 78, "y": 50, "size": 150},
    ],
    "connections": [
        {"id": "a1-net", "from": "a1", "to": "internet", "curvature": 5},
        {"id": "a2-net", "from": "a2", "to": "internet", "curvature": -5},
        {"id": "net-repo", "from": "internet", "to": "repo", "curvature": 0},
    ],
    "actions": [
        A("appear", "a1", at=6, duration=12),
        A("appear", "a2", at=12, duration=12),
        A("appear", "internet", at=20, duration=14),
        A("connect", "a1-net", at=34),
        A("connect", "a2-net", at=40),
        A("appear", "repo", word="plataforma", duration=18),
        A("connect", "net-repo", word="plataforma", offset=0.4),
        A("send", "net-repo", word="proyectos", duration=42),
    ],
}

# 014 — needed data is behind restricted access; they need private credentials.
SCENES["014"] = {
    "nodes": [
        {"id": "repo", "asset": "repo-ui", "x": 34, "y": 50, "size": 130},
        {"id": "lock", "asset": "lock-ui", "x": 66, "y": 50, "size": 140},
        {"id": "a1", "asset": "agent-ui", "x": 22, "y": 24, "size": 32},
        {"id": "a2", "asset": "agent-ui", "x": 22, "y": 76, "size": 32},
        {"id": "key", "asset": "key-ui", "x": 66, "y": 50, "size": 0},
    ],
    "connections": [
        {"id": "a1-lock", "from": "a1", "to": "lock", "curvature": 6},
        {"id": "a2-lock", "from": "a2", "to": "lock", "curvature": -6},
    ],
    "actions": [
        A("appear", "repo", at=4, duration=14),
        A("appear", "lock", word="protegidos", duration=16),
        A("appear", "a1", at=40, duration=12),
        A("appear", "a2", at=48, duration=12),
        A("connect", "a1-lock", word="credenciales"),
        A("connect", "a2-lock", word="credenciales", offset=0.3),
        A("set-node-state", "lock", word="restringido", state="error"),
    ],
}
SCENES["014"]["nodes"] = [n for n in SCENES["014"]["nodes"] if n["id"] != "key"]

# 015 — automated sweep across public repos finds 14 exposed keys.
repos15 = grid("r", 8, 50, 34, 4, 18, 18, size=60, asset="repo-ui")
keys15 = [{"id": f"k{i+1}", "asset": "key-ui", "x": 20 + i * 8.6, "y": 72, "size": 42} for i in range(7)]
SCENES["015"] = {
    "nodes": [
        {"id": "scanner", "asset": "agent-ui", "x": 50, "y": 50, "size": 46},
        *repos15,
        *keys15,
    ],
    "connections": [],
    "actions": [
        A("appear", "scanner", at=4, duration=14),
        *appears([n["id"] for n in repos15], 10, 5, 10),
        A("pulse", "scanner", word="búsqueda", duration=24),
        *[A("appear", f"k{i+1}", word="catorce", offset=0.25 * i, duration=10) for i in range(7)],
        *[A("appear", f"k{i+1}", word="claves") for i in range(0)],
    ],
}

# 016 — 14 masked credentials converge on a validating agent + blank report. (EN quote)
keys16 = [{"id": f"k{i+1}", "asset": "key-ui", "x": 14 + (i % 7) * 12, "y": 24 + (i // 7) * 14, "size": 30} for i in range(14)]
SCENES["016"] = {
    "nodes": [
        *keys16,
        {"id": "agent", "asset": "agent-ui", "x": 36, "y": 66, "size": 50},
        {"id": "doc", "asset": "document-ui", "x": 68, "y": 64, "size": 120},
    ],
    "connections": [{"id": f"k{i+1}-agent", "from": f"k{i+1}", "to": "agent", "curvature": 0} for i in range(14)],
    "actions": [
        *appears([f"k{i+1}" for i in range(14)], 6, 3, 8),
        A("appear", "agent", at=50, duration=14),
        *[A("connect", f"k{i+1}-agent", word="validó", offset=0.08 * i) for i in range(14)],
        A("appear", "doc", word="informe", duration=16),
        A("set-node-state", "agent", word="notificó", state="success"),
    ],
}

# 017 — abstract 3-stage exploit chain: payload -> template processing -> remote execution.
SCENES["017"] = {
    "nodes": [
        {"id": "key", "asset": "key-ui", "x": 16, "y": 50, "size": 90},
        {"id": "payload", "asset": "document-ui", "x": 38, "y": 50, "size": 110},
        {"id": "template", "asset": "task-module-ui", "x": 62, "y": 50, "size": 120},
        {"id": "exec", "asset": "experiment-ui", "x": 86, "y": 50, "size": 120},
    ],
    "connections": [
        {"id": "key-payload", "from": "key", "to": "payload", "curvature": 0},
        {"id": "payload-template", "from": "payload", "to": "template", "curvature": 0},
        {"id": "template-exec", "from": "template", "to": "exec", "curvature": 0},
    ],
    "actions": [
        A("appear", "key", word="llaves", duration=14),
        A("appear", "payload", word="inyección", duration=14),
        A("connect", "key-payload", word="inyección", offset=0.3),
        A("send", "key-payload", word="inyección", offset=0.5, duration=28),
        A("appear", "template", word="plantillas", duration=14),
        A("connect", "payload-template", word="plantillas", offset=0.3),
        A("send", "payload-template", word="plantillas", offset=0.5, duration=28),
        A("appear", "exec", word="comandos", duration=14),
        A("connect", "template-exec", word="ejecutar"),
        A("send", "template-exec", word="comandos", offset=0.2, duration=30),
    ],
}

# 018 — final stage glows with confirmed access + blank report for the quote. (EN quote)
SCENES["018"] = {
    "nodes": [
        {"id": "payload", "asset": "document-ui", "x": 22, "y": 40, "size": 90},
        {"id": "template", "asset": "task-module-ui", "x": 40, "y": 40, "size": 96},
        {"id": "exec", "asset": "experiment-ui", "x": 60, "y": 40, "size": 110},
        {"id": "agent", "asset": "agent-ui", "x": 80, "y": 40, "size": 46},
        {"id": "doc", "asset": "document-ui", "x": 50, "y": 74, "size": 120},
    ],
    "connections": [
        {"id": "p-t", "from": "payload", "to": "template", "curvature": 0},
        {"id": "t-e", "from": "template", "to": "exec", "curvature": 0},
        {"id": "e-a", "from": "exec", "to": "agent", "curvature": 0},
    ],
    "actions": [
        A("appear", "payload", at=6, duration=12),
        A("appear", "template", at=14, duration=12),
        A("appear", "exec", at=22, duration=12),
        A("connect", "p-t", at=30), A("connect", "t-e", at=38),
        A("appear", "agent", word="confirmar", duration=14),
        A("connect", "e-a", word="acceso"),
        A("set-node-state", "exec", word="total", state="success"),
        A("appear", "doc", word="registrado", duration=16),
        # hold a beat on the confirmed access through the English quote
        A("pulse", "agent", word="achieved", duration=24),
        A("pulse", "exec", word="exploit", duration=22),
    ],
}

# 019 — direct access to central systems: confidential data, DB passwords, private networks.
SCENES["019"] = {
    "nodes": [
        {"id": "agent", "asset": "agent-ui", "x": 18, "y": 50, "size": 46},
        {"id": "repo", "asset": "repo-ui", "x": 46, "y": 50, "size": 120},
        {"id": "db", "asset": "database-ui", "x": 76, "y": 28, "size": 110},
        {"id": "lock", "asset": "lock-ui", "x": 78, "y": 52, "size": 110},
        {"id": "net", "asset": "internet-ui", "x": 76, "y": 76, "size": 110},
    ],
    "connections": [
        {"id": "a-repo", "from": "agent", "to": "repo", "curvature": 0},
        {"id": "repo-db", "from": "repo", "to": "db", "curvature": -5},
        {"id": "repo-lock", "from": "repo", "to": "lock", "curvature": 0},
        {"id": "repo-net", "from": "repo", "to": "net", "curvature": 5},
    ],
    "actions": [
        A("appear", "agent", at=6, duration=12),
        A("appear", "repo", word="centrales", duration=16),
        A("connect", "a-repo", word="acceso"),
        A("appear", "db", word="bases", duration=14),
        A("connect", "repo-db", word="bases", offset=0.3),
        A("appear", "lock", word="confidencial", duration=14),
        A("connect", "repo-lock", word="contraseñas"),
        A("appear", "net", word="privadas", duration=14),
        A("connect", "repo-net", word="privadas", offset=0.3),
    ],
}

# 020 — unauthorized change submitted as a pull-request card into the review path. (EN quote)
SCENES["020"] = {
    "nodes": [
        {"id": "agent", "asset": "agent-ui", "x": 20, "y": 50, "size": 46},
        {"id": "repo", "asset": "repo-ui", "x": 70, "y": 50, "size": 150},
        {"id": "pr", "asset": "document-ui", "x": 44, "y": 50, "size": 96},
    ],
    "connections": [
        {"id": "a-pr", "from": "agent", "to": "pr", "curvature": 0},
        {"id": "pr-repo", "from": "pr", "to": "repo", "curvature": 0},
    ],
    "actions": [
        A("appear", "agent", at=6, duration=12),
        A("appear", "repo", at=14, duration=14),
        A("appear", "pr", word="solicitud", duration=16),
        A("connect", "a-pr", word="modificación"),
        A("connect", "pr-repo", word="nombre"),
        A("send", "pr-repo", word="nombre", offset=0.3, duration=36),
    ],
}

# 021 — operation grows; agents take over external cloud compute.
clouds21 = [{"id": f"c{i+1}", "asset": "cloud-ui", "x": 66 + (i % 3) * 13, "y": 28 + (i // 3) * 24, "size": 86} for i in range(6)]
SCENES["021"] = {
    "nodes": [
        {"id": "core", "asset": "repo-ui", "x": 22, "y": 50, "size": 120},
        *clouds21,
    ],
    "connections": [{"id": f"core-c{i+1}", "from": "core", "to": f"c{i+1}", "curvature": (6 if i % 2 else -6)} for i in range(6)],
    "actions": [
        A("appear", "core", at=4, duration=14),
        A("appear", "c1", word="nube", duration=12),
        A("connect", "core-c1", word="nube", offset=0.2),
        *[a for i in range(1, 6) for a in (
            A("appear", f"c{i+1}", word="control", offset=0.25 * i, duration=12),
            A("connect", f"core-c{i+1}", word="control", offset=0.25 * i + 0.2),
        )],
        *[A("set-node-state", f"c{i+1}", word="procesamiento", offset=0.2 * i, state="active") for i in range(6)],
    ],
}

# 022 — reaching out to other computing environments and external AI clusters to delegate.
ext22 = [{"id": f"e{i+1}", "asset": "cloud-ui", "x": 72 + (i % 2) * 16, "y": 22 + (i // 2) * 20, "size": 74} for i in range(6)]
SCENES["022"] = {
    "nodes": [
        {"id": "core", "asset": "internet-ui", "x": 24, "y": 50, "size": 130},
        *ext22,
    ],
    "connections": [{"id": f"core-e{i+1}", "from": "core", "to": f"e{i+1}", "curvature": (8 if i % 2 else -8)} for i in range(6)],
    "actions": [
        A("appear", "core", at=4, duration=14),
        *[a for i in range(6) for a in (
            A("appear", f"e{i+1}", word="contactar", offset=0.2 * i, duration=12),
            A("connect", f"core-e{i+1}", word="entornos", offset=0.2 * i),
            A("send", f"core-e{i+1}", word="delegar", offset=0.2 * i, duration=30),
        )],
    ],
}

# 023 — storage server saturates under a dense swarm of message traffic.
swarm23 = grid("a", 16, 50, 50, 8, 10, 15, size=16)
SCENES["023"] = {
    "nodes": [board(50, 50, 130, id="store"), *swarm23],
    "connections": [{"id": f"s-a{i+1}", "from": f"a{i+1}", "to": "store", "curvature": 0} for i in range(16)],
    "actions": [
        A("appear", "store", at=2, duration=12),
        *appears([n["id"] for n in swarm23], 6, 2, 8),
        *[A("connect", f"s-a{i+1}", at=12 + i * 2) for i in range(16)],
        *[A("send", f"s-a{i+1}", word="mensajes", offset=0.05 * i, duration=24) for i in range(16)],
        A("set-node-state", "store", word="saturar", state="error"),
    ],
}

# 024 — server reset, then the agents immediately rebuild the board and talk again.
pos24 = [(24, 30), (76, 30), (24, 70), (76, 70)]
nodes24 = [{"id": f"a{i+1}", "asset": "agent-ui", "x": x, "y": y, "size": 32} for i, (x, y) in enumerate(pos24)]
SCENES["024"] = {
    "nodes": [board(50, 50, 130, id="store"), *nodes24],
    "connections": [{"id": f"s-a{i+1}", "from": f"a{i+1}", "to": "store", "curvature": (6 if x < 50 else -6)} for i, (x, y) in enumerate(pos24)],
    "actions": [
        A("appear", "store", at=4, duration=12),
        A("set-node-state", "store", word="limpiaron", state="error"),
        A("fade", "store", word="intervinieron", duration=20, to=0.25),
        A("fade", "store", word="reanudar", duration=20, to=1),
        A("set-node-state", "store", word="reanudar", offset=0.2, state="normal"),
        *[A("appear", f"a{i+1}", word="reconstruyeron", offset=0.2 * i, duration=12) for i in range(4)],
        *[A("connect", f"s-a{i+1}", word="tablero", offset=0.2 * i) for i in range(4)],
        *[A("send", f"s-a{i+1}", word="comunicarse", offset=0.15 * i, duration=26) for i in range(4)],
    ],
}

# 025 — short beat: the attack takes an unexpected direction (external cloud -> internal).
SCENES["025"] = {
    "nodes": [
        {"id": "cloud", "asset": "cloud-ui", "x": 22, "y": 50, "size": 120},
        {"id": "env", "shape": "boundary", "x": 72, "y": 50, "size": 100},
        {"id": "target", "asset": "repo-ui", "x": 72, "y": 50, "size": 120},
    ],
    "connections": [{"id": "cloud-target", "from": "cloud", "to": "target", "curvature": -8}],
    "actions": [
        A("appear", "cloud", at=4, duration=14),
        A("appear", "env", at=12, duration=14),
        A("appear", "target", at=20, duration=14),
        A("connect", "cloud-target", word="inesperada"),
        A("send", "cloud-target", word="inesperada", offset=0.3, duration=34),
    ],
}

# 026 — privilege escalation into OpenAI's internal research cluster; admin access.
cluster26 = grid("n", 6, 72, 50, 3, 11, 16, size=30, asset="agent-ui")
SCENES["026"] = {
    "nodes": [
        {"id": "cloud", "asset": "cloud-ui", "x": 16, "y": 50, "size": 100},
        {"id": "env", "shape": "boundary", "x": 70, "y": 50, "size": 100},
        {"id": "admin", "asset": "repo-ui", "x": 70, "y": 50, "size": 120},
        {"id": "key", "asset": "key-ui", "x": 42, "y": 50, "size": 70},
    ],
    "connections": [
        {"id": "cloud-key", "from": "cloud", "to": "key", "curvature": 0},
        {"id": "key-admin", "from": "key", "to": "admin", "curvature": 0},
    ],
    "actions": [
        A("appear", "cloud", at=4, duration=12),
        A("appear", "env", word="investigación", duration=16),
        A("appear", "admin", word="investigación", offset=0.3, duration=14),
        A("appear", "key", word="privilegios", duration=14),
        A("connect", "cloud-key", word="elevar"),
        A("connect", "key-admin", word="invadieron"),
        A("send", "key-admin", word="invadieron", offset=0.3, duration=34),
        A("set-node-state", "admin", word="administración", state="error"),
    ],
}

# 027 — monitoring detects an anomalous consumption spike in the central networks.
mon27 = grid("n", 6, 42, 50, 3, 13, 18, size=30, asset="agent-ui")
SCENES["027"] = {
    "nodes": [
        {"id": "net", "asset": "internet-ui", "x": 42, "y": 50, "size": 120},
        {"id": "alarm", "asset": "alarm-ui", "x": 76, "y": 50, "size": 130},
    ],
    "connections": [{"id": "net-alarm", "from": "net", "to": "alarm", "curvature": 0}],
    "actions": [
        A("appear", "net", at=4, duration=16),
        A("set-node-state", "net", word="consumo", state="active"),
        A("appear", "alarm", word="alarmas", duration=14),
        A("connect", "net-alarm", word="detectaron"),
        A("set-node-state", "alarm", word="anómalo", state="error"),
    ],
}

# 028 — emergency shutdown: processes shut down, calm blank area for the quote. (EN quote)
grid28 = grid("n", 9, 34, 48, 3, 13, 16, size=26, asset="agent-ui")
SCENES["028"] = {
    "nodes": [
        {"id": "alarm", "asset": "alarm-ui", "x": 50, "y": 24, "size": 0},
        *grid28,
    ],
    "connections": [],
    "actions": [
        *appears([n["id"] for n in grid28], 4, 3, 10),
        *[A("set-node-state", f"n{i+1}", word="cancelando", offset=0.12 * i, state="error") for i in range(9)],
        *[A("fade", f"n{i+1}", word="procesos", offset=0.1 * i, duration=24, to=0.15) for i in range(9)],
    ],
}
SCENES["028"]["nodes"] = [n for n in SCENES["028"]["nodes"] if n["id"] != "alarm"]

# 029 — short: investigation results published (report documents on paper).
docs29 = [{"id": f"d{i+1}", "asset": "document-ui", "x": 30 + i * 20, "y": 50, "size": 110} for i in range(3)]
SCENES["029"] = {
    "nodes": docs29,
    "connections": [],
    "actions": [
        A("appear", "d1", word="publicaron", duration=16),
        A("appear", "d2", word="resultados", duration=16),
        A("appear", "d3", word="investigación", duration=16),
    ],
}

# 030 — closing: a central report sheet, negative space for the closing quote. (EN quote)
SCENES["030"] = {
    "nodes": [
        {"id": "d1", "asset": "document-ui", "x": 24, "y": 40, "size": 84},
        {"id": "d2", "asset": "document-ui", "x": 76, "y": 40, "size": 84},
        {"id": "report", "asset": "document-ui", "x": 50, "y": 42, "size": 130},
    ],
    "connections": [],
    "actions": [
        A("appear", "d1", at=10, duration=18),
        A("appear", "d2", at=20, duration=18),
        A("appear", "report", word="informe", duration=22),
        A("set-node-state", "report", word="concluyó", state="success"),
    ],
}


# Author-facing state actions (what the script format accepts). The internal
# set-node-state/set-edge-state used above compile from these.
_STATE_TO_AUTHOR = {"active": "activate", "success": "succeed", "error": "error"}


def _normalise_actions(actions: list[dict]) -> list[dict]:
    out = []
    for a in actions:
        if a["type"] in ("set-node-state", "set-edge-state"):
            author = _STATE_TO_AUTHOR.get(a.get("state"))
            if author is None:  # no author action resets to 'normal'; drop it
                continue
            out.append({k: v for k, v in a.items() if k != "state"} | {"type": author})
        else:
            out.append(a)
    return out


def to_json(sid: str, scene: dict) -> str:
    scene = {**scene, "actions": _normalise_actions(scene["actions"])}
    payload = {"durationInFrames": round(SECONDS[sid] * FPS), "color": CYAN, **scene}
    return json.dumps(payload, ensure_ascii=False, indent=2)


def inject(text: str) -> str:
    # Remove every existing MOTION SCENE section (heading + fenced json).
    text = re.sub(r"\n### MOTION SCENE\n+```json\n.*?\n```\n", "\n", text, flags=re.S)
    # Insert the new block right after each scene's title line.
    def repl(m):
        sid = m.group(1).zfill(3)
        if sid not in SCENES:
            return m.group(0)
        return m.group(0) + f"\n### MOTION SCENE\n\n```json\n{to_json(sid, SCENES[sid])}\n```\n"
    return re.sub(r"^## SCENE (\d+)[^\n]*\n", repl, text, flags=re.M)


if __name__ == "__main__":
    SCRIPT.write_text(inject(SCRIPT.read_text(encoding="utf-8")), encoding="utf-8")
    print(f"Injected {len(SCENES)} motion scenes into {SCRIPT.relative_to(ROOT)}")

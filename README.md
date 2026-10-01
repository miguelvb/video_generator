# AI Video Engine v5.2 — stable AI camera + quotes only

Apply these two files to the current v5.1/current project:

- `scripts/orchestrator.py`
- `src/remotion/MainVideo.tsx`

Changes:
- Seedance/AI-video prompts now force a locked static camera.
- No AI-video pan, zoom, dolly, orbit, rotation, handheld movement or camera shake.
- Motion is directed toward agents, nodes, data packets, communication lines, server indicators and other scene elements instead.
- Remotion no longer renders scene titles or `ON SCREEN TEXT` overlays.
- Remotion no longer renders voiceover text as subtitles/captions.
- `QUOTE` segments are preserved and still rendered as quote cards.
- Remotion's own fallback image motion is unchanged; the camera restriction is specifically for AI-video generation.

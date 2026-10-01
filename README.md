# AI Video Engine v5.1 — Visual Continuity Patch

This patch adds:

- Project-level VISUAL STYLE / GLOBAL VISUAL IDENTITY.
- Global STYLE REFERENCE automatically supplied to every generated scene image.
- Global CAMERA STYLE included in AI-video prompts.
- Scene CONTINUITY modes: new_scene, transition, continuous, locked.
- VISUAL ANCHOR, START STATE and END STATE fields.
- Continuous/locked scenes tell Seedance to preserve framing, perspective, subject scale, lighting, palette and object layout across clips instead of resetting the composition.
- Visual-style and continuity values participate in content hashes so changing them correctly invalidates affected assets.
- The `video` command is enabled in the CLI dispatch.

Install by extracting this ZIP over the existing v5 project. It only replaces the two Python scripts and the script template; it does not replace generated media, your .env, or your project/script.md.

After installing, add the VISUAL STYLE block from `project/VISUAL_STYLE_EXAMPLE.md` to your script.md before generating new scene images. Existing images are not automatically regenerated.

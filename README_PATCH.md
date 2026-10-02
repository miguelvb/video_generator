# Scene selection / test render patch

Adds selective execution so you can test one or two scenes without generating or rendering the whole project.

## First two scenes
```bash
python scripts/orchestrator.py images project/script.md --test
python scripts/orchestrator.py audio project/script.md --test
python scripts/orchestrator.py video project/script.md --test
python scripts/orchestrator.py render project/script.md --test
```

The render is written to `output/test_001_002.mp4`.

## Exact scenes
```bash
python scripts/orchestrator.py images project/script.md --scenes 003,004
python scripts/orchestrator.py audio project/script.md --scenes 003,004
python scripts/orchestrator.py video project/script.md --scenes 003,004
python scripts/orchestrator.py render project/script.md --scenes 003,004
```

The normal commands remain unchanged when `--scenes`/`--test` is omitted.

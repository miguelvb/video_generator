#!/usr/bin/env python3
"""Run-level cost tracking for provider-reported API charges."""
from __future__ import annotations

import json
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path


class CostTracker:
    def __init__(self, root: Path, command: str, script: Path):
        self.root = root
        self.command = command
        self.script = script
        self.started_at = datetime.now(timezone.utc)
        self.run_id = self.started_at.strftime("%Y-%m-%d_%H-%M-%S") + "_" + uuid.uuid4().hex[:6]
        self.records: list[dict] = []
        self.finished_at = None

    def record(self, *, provider: str, operation: str, model: str | None = None,
               scene_id: str | None = None, segment_id: str | None = None,
               cost_usd: float | None = None, cost_status: str = "unknown",
               usage: dict | None = None, request_id: str | None = None,
               note: str | None = None) -> None:
        self.records.append({
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "provider": provider,
            "operation": operation,
            "model": model,
            "scene_id": scene_id,
            "segment_id": segment_id,
            "cost_usd": cost_usd,
            "cost_status": cost_status,
            "usage": usage or {},
            "request_id": request_id,
            "note": note,
        })

    def finish(self) -> dict:
        self.finished_at = datetime.now(timezone.utc)
        known = sum(float(r["cost_usd"]) for r in self.records if r["cost_usd"] is not None)
        unknown = sum(1 for r in self.records if r["cost_usd"] is None)
        by_provider: dict[str, float] = {}
        for r in self.records:
            if r["cost_usd"] is not None:
                by_provider[r["provider"]] = by_provider.get(r["provider"], 0.0) + float(r["cost_usd"])

        resolved_configuration = {}
        parsed_path = self.root / "build" / "parsed_script.json"
        if parsed_path.exists():
            try:
                parsed = json.loads(parsed_path.read_text(encoding="utf-8"))
                resolved_configuration = {"settings": parsed.get("settings", {}), "models": parsed.get("models", {})}
            except Exception:
                resolved_configuration = {}

        report = {
            "version": "1.1.0",
            "run_id": self.run_id,
            "command": self.command,
            "script": str(self.script),
            "started_at": self.started_at.isoformat(),
            "finished_at": self.finished_at.isoformat(),
            "currency": "USD",
            "configuration": resolved_configuration,
            "costs": {
                "known_total_usd": round(known, 8),
                "unknown_count": unknown,
                "by_provider_usd": {k: round(v, 8) for k, v in by_provider.items()},
            },
            "records": self.records,
        }
        path = self.root / "build" / "runs" / self.run_id / "cost.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return report

    def print_summary(self, report: dict) -> None:
        costs = report["costs"]
        print("\n" + "=" * 58)
        print("AI VIDEO RUN COST")
        print("=" * 58)
        print(f"Run: {report['run_id']}")
        print(f"Known provider-reported cost: ${costs['known_total_usd']:.4f}")
        if costs["by_provider_usd"]:
            for provider, value in costs["by_provider_usd"].items():
                print(f"  {provider:<18} ${value:.4f}")
        if costs["unknown_count"]:
            print(f"Unpriced API calls:          {costs['unknown_count']}")
            print("  (The provider did not return a per-request cost.)")
        print(f"Report: build/runs/{report['run_id']}/cost.json")
        print("=" * 58 + "\n")

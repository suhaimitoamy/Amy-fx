from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from audit_core import (
    audit_snapshot,
    canonical_json,
    compare_snapshots,
    iter_jsonl,
    write_jsonl,
)
from data_store import ingest_archives, validate_database


def _is_historical_replay(snapshot: dict) -> bool:
    source_mode = str(snapshot.get("sourceMode") or snapshot.get("datasetSource") or "").strip().lower()
    return bool(snapshot.get("historicalReplay")) or source_mode in {
        "historical_replay",
        "historical-replay",
        "supplied-historical-archives",
        "historical-archive",
    }


def _audit_with_source_policy(snapshot: dict):
    issues = audit_snapshot(snapshot)
    if _is_historical_replay(snapshot):
        return issues
    return [issue for issue in issues if issue.code != "REJECTED_YEAR_DATA"]


def command_ingest(args: argparse.Namespace) -> int:
    result = ingest_archives(Path(args.data_dir), Path(args.db))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def command_validate_data(args: argparse.Namespace) -> int:
    report = validate_database(Path(args.db))
    output = Path(args.report)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if report["verdict"] == "PASS" else 2


def command_audit_snapshots(args: argparse.Namespace) -> int:
    rows = []
    scanned = 0
    for snapshot in iter_jsonl(Path(args.input)):
        scanned += 1
        issues = _audit_with_source_policy(snapshot)
        rows.extend(issue.to_dict() for issue in issues)
        if issues and args.stop_on_first:
            break
    write_jsonl(Path(args.output), rows)
    summary = {"snapshots_scanned": scanned, "issues": len(rows), "output": args.output}
    print(canonical_json(summary))
    return 2 if rows else 0


def _key(snapshot: dict) -> tuple[str, str]:
    tf = str(snapshot.get("timeframe") or snapshot.get("tf") or "").upper()
    stamp = str(snapshot.get("sourceCandleTime") or snapshot.get("timestamp") or "")
    return tf, stamp


def command_compare(args: argparse.Namespace) -> int:
    references = {_key(row): row for row in iter_jsonl(Path(args.reference))}
    rows = []
    compared = 0
    missing = 0
    for app_snapshot in iter_jsonl(Path(args.app)):
        key = _key(app_snapshot)
        reference = references.get(key)
        if reference is None:
            missing += 1
            rows.append({
                "code": "REFERENCE_SNAPSHOT_MISSING",
                "severity": "warning",
                "message": "No reference snapshot exists for the app candle.",
                "timestamp": key[1] or None,
                "timeframe": key[0] or None,
                "details": {"key": list(key)},
            })
            if args.stop_on_first:
                break
            continue
        compared += 1
        differences = compare_snapshots(app_snapshot, reference, price_tolerance=args.price_tolerance)
        rows.extend(issue.to_dict() for issue in differences)
        if differences and args.stop_on_first:
            break
    write_jsonl(Path(args.output), rows)
    summary = {"compared": compared, "missing_reference": missing, "differences": len(rows), "output": args.output}
    print(canonical_json(summary))
    return 2 if rows else 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Amy FX deterministic honesty-audit harness")
    sub = parser.add_subparsers(dest="command", required=True)

    ingest = sub.add_parser("ingest", help="Import 2020-2025 monthly candle ZIP archives into SQLite")
    ingest.add_argument("--data-dir", required=True)
    ingest.add_argument("--db", required=True)
    ingest.set_defaults(func=command_ingest)

    validate = sub.add_parser("validate-data", help="Validate the normalized candle database")
    validate.add_argument("--db", required=True)
    validate.add_argument("--report", required=True)
    validate.set_defaults(func=command_validate_data)

    audit = sub.add_parser("audit-snapshots", help="Run hard honesty invariants over app JSONL snapshots")
    audit.add_argument("--input", required=True)
    audit.add_argument("--output", required=True)
    audit.add_argument("--stop-on-first", action="store_true")
    audit.set_defaults(func=command_audit_snapshots)

    compare = sub.add_parser("compare", help="Compare app snapshots with reference snapshots")
    compare.add_argument("--app", required=True)
    compare.add_argument("--reference", required=True)
    compare.add_argument("--output", required=True)
    compare.add_argument("--price-tolerance", type=float, default=0.01)
    compare.add_argument("--stop-on-first", action="store_true")
    compare.set_defaults(func=command_compare)
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        return int(args.func(args))
    except (FileNotFoundError, ValueError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())

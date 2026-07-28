from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Iterator

_MONTHLY_ARCHIVE = re.compile(r"^XAUUSD_(\d{4})_(\d{2})_.*\.zip$", re.IGNORECASE)


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_hash(rows: list[tuple[str, str, str, str, str]]) -> str:
    digest = hashlib.sha256()
    for row in rows:
        digest.update(("|".join(row) + "\n").encode("utf-8"))
    return digest.hexdigest()


def load_official(path: Path) -> tuple[list[tuple[str, str, str, str, str]], bool]:
    with zipfile.ZipFile(path) as archive:
        csv_member = next((name for name in archive.namelist() if name.lower().endswith(".csv")), None)
        if csv_member is None:
            raise ValueError(f"Official archive contains no CSV: {path}")
        rows: list[tuple[str, str, str, str, str]] = []
        with io.TextIOWrapper(archive.open(csv_member), encoding="utf-8-sig", newline="") as handle:
            for line_number, line in enumerate(handle, start=1):
                stripped = line.strip()
                if not stripped:
                    continue
                fields = stripped.split(";")
                if len(fields) < 5:
                    raise ValueError(f"Invalid official row {path.name}:{line_number}")
                stamp = datetime.strptime(fields[0], "%Y%m%d %H%M%S").strftime("%Y-%m-%d %H:%M:%S")
                rows.append((stamp, fields[1], fields[2], fields[3], fields[4]))
        status_mentions_histdata = any(
            "HistData.com" in archive.read(name).decode("utf-8", errors="replace")
            for name in archive.namelist()
            if name.lower().endswith(".txt")
        )
    return rows, status_mentions_histdata


def iter_monthly_archives(data_dir: Path, year: int) -> Iterator[Path]:
    matches: list[tuple[int, Path]] = []
    for path in data_dir.glob("*.zip"):
        match = _MONTHLY_ARCHIVE.fullmatch(path.name)
        if match and int(match.group(1)) == year:
            matches.append((int(match.group(2)), path))
    for _, path in sorted(matches):
        yield path


def load_user_year(data_dir: Path, year: int) -> list[tuple[str, str, str, str, str]]:
    archives = list(iter_monthly_archives(data_dir, year))
    if len(archives) != 12:
        raise ValueError(f"Expected 12 monthly archives for {year}, found {len(archives)}")
    rows: list[tuple[str, str, str, str, str]] = []
    for path in archives:
        with zipfile.ZipFile(path) as archive:
            member = next(
                (name for name in archive.namelist() if "_M1_" in name.upper() and name.lower().endswith(".csv")),
                None,
            )
            if member is None:
                raise ValueError(f"M1 CSV not found in {path.name}")
            with io.TextIOWrapper(archive.open(member), encoding="utf-8-sig", newline="") as handle:
                reader = csv.DictReader(handle)
                expected = {"datetime", "open", "high", "low", "close"}
                if set(reader.fieldnames or []) != expected:
                    raise ValueError(f"Unexpected headers in {path.name}:{member}: {reader.fieldnames}")
                for row in reader:
                    rows.append((row["datetime"], row["open"], row["high"], row["low"], row["close"]))
    return rows


def compare_year(data_dir: Path, official_dir: Path, year: int) -> dict[str, object]:
    official_path = official_dir / f"DAT_ASCII_XAUUSD_M1_{year}.zip"
    if not official_path.exists():
        return {"year": year, "status": "OFFICIAL_ARCHIVE_MISSING"}
    official, status_mentions_histdata = load_official(official_path)
    supplied = load_user_year(data_dir, year)
    first_difference = next(
        (
            index
            for index, (expected, actual) in enumerate(zip(official, supplied))
            if expected != actual
        ),
        None,
    )
    exact = official == supplied
    return {
        "year": year,
        "status": "EXACT_MATCH" if exact else "MISMATCH",
        "sequence_exact": exact,
        "official_rows": len(official),
        "supplied_rows": len(supplied),
        "first_difference_index": first_difference,
        "official_raw_canonical_sha256": canonical_hash(official),
        "supplied_raw_canonical_sha256": canonical_hash(supplied),
        "official_archive_sha256": sha256_file(official_path),
        "status_report_mentions_histdata": status_mentions_histdata,
        "first_row": official[0] if official else None,
        "last_row": official[-1] if official else None,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Verify supplied Amy FX M1 archives against annual HistData archives")
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--official-dir", required=True)
    parser.add_argument("--years", nargs="+", type=int, required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    report = {
        "provider": "HistData.com",
        "instrument": "XAUUSD",
        "comparison": [
            compare_year(Path(args.data_dir), Path(args.official_dir), year)
            for year in args.years
        ],
    }
    report["all_available_exact"] = all(
        item["status"] in {"EXACT_MATCH", "OFFICIAL_ARCHIVE_MISSING"}
        for item in report["comparison"]
    )
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0 if all(item["status"] == "EXACT_MATCH" for item in report["comparison"]) else 2


if __name__ == "__main__":
    raise SystemExit(main())

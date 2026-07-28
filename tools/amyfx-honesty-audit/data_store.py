from __future__ import annotations

import csv
import io
import re
import sqlite3
import zipfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from audit_core import iter_candles_from_zip, parse_timestamp, sha256_file

_TIMEZONE_SUFFIX = re.compile(r"(?:Z|[+-]\d{2}:?\d{2})$", re.IGNORECASE)


def _archive_timestamp_quality(path: Path) -> dict[str, int]:
    source_rows = 0
    timezone_naive_rows = 0
    with zipfile.ZipFile(path) as archive:
        for member in archive.namelist():
            if not member.lower().endswith(".csv"):
                continue
            with archive.open(member) as raw_handle:
                reader = csv.DictReader(io.TextIOWrapper(raw_handle, encoding="utf-8-sig", newline=""))
                field_map = {
                    str(name).strip().lower().replace(" ", ""): str(name)
                    for name in (reader.fieldnames or [])
                }
                source_field = next(
                    (field_map[key] for key in ("datetime", "timestamp", "time", "date") if key in field_map),
                    None,
                )
                if source_field is None:
                    continue
                for row in reader:
                    source_rows += 1
                    raw_timestamp = str(row.get(source_field) or "").strip()
                    if not _TIMEZONE_SUFFIX.search(raw_timestamp):
                        timezone_naive_rows += 1
    return {
        "source_rows": source_rows,
        "timezone_naive_rows": timezone_naive_rows,
    }


def init_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        CREATE TABLE IF NOT EXISTS candles (
            timeframe TEXT NOT NULL,
            timestamp TEXT NOT NULL,
            open REAL NOT NULL,
            high REAL NOT NULL,
            low REAL NOT NULL,
            close REAL NOT NULL,
            source_archive TEXT NOT NULL,
            source_member TEXT NOT NULL,
            PRIMARY KEY (timeframe, timestamp)
        );
        CREATE TABLE IF NOT EXISTS archive_manifest (
            archive TEXT PRIMARY KEY,
            sha256 TEXT NOT NULL,
            bytes INTEGER NOT NULL,
            imported_rows INTEGER NOT NULL,
            rejected_rows INTEGER NOT NULL,
            exact_duplicate_rows INTEGER NOT NULL DEFAULT 0,
            conflicting_rows INTEGER NOT NULL DEFAULT 0,
            source_rows INTEGER NOT NULL DEFAULT 0,
            timezone_naive_rows INTEGER NOT NULL DEFAULT 0,
            non_monotonic_rows INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp);
        """
    )
    manifest_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(archive_manifest)")
    }
    migrations = {
        "exact_duplicate_rows": "INTEGER NOT NULL DEFAULT 0",
        "conflicting_rows": "INTEGER NOT NULL DEFAULT 0",
        "source_rows": "INTEGER NOT NULL DEFAULT 0",
        "timezone_naive_rows": "INTEGER NOT NULL DEFAULT 0",
        "non_monotonic_rows": "INTEGER NOT NULL DEFAULT 0",
    }
    for column, definition in migrations.items():
        if column not in manifest_columns:
            connection.execute(
                f"ALTER TABLE archive_manifest ADD COLUMN {column} {definition}"
            )


def ingest_archives(data_dir: Path, database: Path) -> dict[str, Any]:
    archives = sorted(data_dir.rglob("*.zip"))
    if not archives:
        raise FileNotFoundError(f"No ZIP archives found below {data_dir}")

    database.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database)
    init_database(connection)
    total_inserted = 0
    archive_results: list[dict[str, Any]] = []

    try:
        for path in archives:
            inserted = 0
            exact_duplicates = 0
            conflicts = 0
            non_monotonic_rows = 0
            previous_by_member: dict[str, str] = {}
            timestamp_quality = _archive_timestamp_quality(path)
            with connection:
                for candle in iter_candles_from_zip(path):
                    previous = previous_by_member.get(candle.source_member)
                    if previous is not None and candle.timestamp <= previous:
                        non_monotonic_rows += 1
                    previous_by_member[candle.source_member] = candle.timestamp

                    cursor = connection.execute(
                        """
                        INSERT OR IGNORE INTO candles(
                          timeframe,timestamp,open,high,low,close,
                          source_archive,source_member
                        ) VALUES(?,?,?,?,?,?,?,?)
                        """,
                        (
                            candle.timeframe,
                            candle.timestamp,
                            candle.open,
                            candle.high,
                            candle.low,
                            candle.close,
                            candle.source_archive,
                            candle.source_member,
                        ),
                    )
                    if cursor.rowcount == 1:
                        inserted += 1
                        continue

                    existing = connection.execute(
                        """
                        SELECT open,high,low,close FROM candles
                        WHERE timeframe=? AND timestamp=?
                        """,
                        (candle.timeframe, candle.timestamp),
                    ).fetchone()
                    expected = (candle.open, candle.high, candle.low, candle.close)
                    actual = tuple(existing) if existing is not None else None
                    if actual == expected:
                        exact_duplicates += 1
                    else:
                        conflicts += 1

                rejected = exact_duplicates + conflicts
                connection.execute(
                    """
                    INSERT INTO archive_manifest(
                      archive,sha256,bytes,imported_rows,rejected_rows,
                      exact_duplicate_rows,conflicting_rows,source_rows,
                      timezone_naive_rows,non_monotonic_rows
                    ) VALUES(?,?,?,?,?,?,?,?,?,?)
                    ON CONFLICT(archive) DO UPDATE SET
                      sha256=excluded.sha256,
                      bytes=excluded.bytes,
                      imported_rows=excluded.imported_rows,
                      rejected_rows=excluded.rejected_rows,
                      exact_duplicate_rows=excluded.exact_duplicate_rows,
                      conflicting_rows=excluded.conflicting_rows,
                      source_rows=excluded.source_rows,
                      timezone_naive_rows=excluded.timezone_naive_rows,
                      non_monotonic_rows=excluded.non_monotonic_rows
                    """,
                    (
                        str(path.relative_to(data_dir)),
                        sha256_file(path),
                        path.stat().st_size,
                        inserted,
                        rejected,
                        exact_duplicates,
                        conflicts,
                        timestamp_quality["source_rows"],
                        timestamp_quality["timezone_naive_rows"],
                        non_monotonic_rows,
                    ),
                )

            total_inserted += inserted
            archive_results.append(
                {
                    "archive": str(path),
                    "inserted": inserted,
                    "duplicates_or_conflicts": rejected,
                    "exact_duplicates": exact_duplicates,
                    "conflicts": conflicts,
                    "source_rows": timestamp_quality["source_rows"],
                    "timezone_naive_rows": timestamp_quality["timezone_naive_rows"],
                    "non_monotonic_rows": non_monotonic_rows,
                }
            )
    finally:
        connection.close()

    return {
        "archives": len(archives),
        "inserted": total_inserted,
        "database": str(database),
        "details": archive_results,
    }


def _utc_datetime(value: str) -> datetime:
    parsed = parse_timestamp(value)
    if parsed is None:
        raise ValueError(f"Invalid normalized timestamp in database: {value}")
    return parsed.astimezone(timezone.utc)


def _irregular_h1_holes(connection: sqlite3.Connection) -> dict[str, Any]:
    timestamps = [
        _utc_datetime(row[0])
        for row in connection.execute(
            "SELECT timestamp FROM candles WHERE timeframe='H1' ORDER BY timestamp"
        )
    ]
    signatures: Counter[tuple[int, int, int, int, int]] = Counter()
    years_by_signature: dict[tuple[int, int, int, int, int], set[int]] = defaultdict(set)
    gaps: list[tuple[datetime, datetime, tuple[int, int, int, int, int]]] = []
    for previous, current in zip(timestamps, timestamps[1:]):
        if int((current - previous).total_seconds()) != 7200:
            continue
        signature = (
            previous.weekday(),
            previous.hour,
            previous.minute,
            current.hour,
            current.minute,
        )
        signatures[signature] += 1
        years_by_signature[signature].add(previous.year)
        gaps.append((previous, current, signature))

    recurring_schedule = {
        signature
        for signature, years in years_by_signature.items()
        if len(years) >= 4
    }
    suspicious = [gap for gap in gaps if gap[2] not in recurring_schedule]
    by_month: Counter[str] = Counter(
        previous.strftime("%Y-%m") for previous, _, _ in suspicious
    )
    return {
        "count": len(suspicious),
        "by_month": dict(sorted(by_month.items())),
        "examples": [
            {
                "from": previous.isoformat().replace("+00:00", "Z"),
                "to": current.isoformat().replace("+00:00", "Z"),
            }
            for previous, current, _ in suspicious[:20]
        ],
        "recurring_schedule_signatures": [
            {
                "weekday": signature[0],
                "from": f"{signature[1]:02d}:{signature[2]:02d}",
                "to": f"{signature[3]:02d}:{signature[4]:02d}",
                "occurrences": signatures[signature],
                "years": sorted(years_by_signature[signature]),
            }
            for signature in sorted(recurring_schedule)
        ],
    }


def _m1_inside_m5(connection: sqlite3.Connection) -> dict[str, int]:
    row = connection.execute(
        """
        WITH m1 AS (
          SELECT CAST(strftime('%s', timestamp) AS INTEGER) / 300 AS bucket,
                 COUNT(*) AS rows_in_bucket
          FROM candles
          WHERE timeframe='M1'
          GROUP BY bucket
        ),
        m5 AS (
          SELECT CAST(strftime('%s', timestamp) AS INTEGER) / 300 AS bucket
          FROM candles
          WHERE timeframe='M5'
        )
        SELECT
          COALESCE(SUM(CASE WHEN m1.rows_in_bucket = 5 THEN 1 ELSE 0 END), 0) AS complete_buckets,
          COALESCE(SUM(CASE WHEN m1.rows_in_bucket < 5 THEN 1 ELSE 0 END), 0) AS incomplete_buckets,
          COALESCE(SUM(CASE WHEN m1.rows_in_bucket < 5 THEN 5 - m1.rows_in_bucket ELSE 0 END), 0) AS absent_slots
        FROM m5
        LEFT JOIN m1 ON m1.bucket = m5.bucket
        """
    ).fetchone()
    return {
        "complete_buckets": int(row[0]),
        "incomplete_buckets": int(row[1]),
        "absent_minute_slots": int(row[2]),
    }


def validate_database(database: Path) -> dict[str, Any]:
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    try:
        total = connection.execute("SELECT COUNT(*) AS n FROM candles").fetchone()["n"]
        by_tf = {
            row["timeframe"]: row["n"]
            for row in connection.execute(
                "SELECT timeframe, COUNT(*) AS n FROM candles GROUP BY timeframe ORDER BY timeframe"
            )
        }
        by_year = {
            row["year"]: row["n"]
            for row in connection.execute(
                "SELECT substr(timestamp,1,4) AS year, COUNT(*) AS n FROM candles GROUP BY year ORDER BY year"
            )
        }
        by_year_timeframe: dict[str, dict[str, int]] = defaultdict(dict)
        for row in connection.execute(
            """
            SELECT substr(timestamp,1,4) AS year,timeframe,COUNT(*) AS n
            FROM candles GROUP BY year,timeframe ORDER BY year,timeframe
            """
        ):
            by_year_timeframe[row["year"]][row["timeframe"]] = row["n"]

        bad_ohlc = connection.execute(
            """
            SELECT COUNT(*) AS n FROM candles
            WHERE high < low OR high < open OR high < close
               OR low > open OR low > close
            """
        ).fetchone()["n"]
        rejected_year_rows = connection.execute(
            "SELECT COUNT(*) AS n FROM candles WHERE substr(timestamp,1,4)='2026'"
        ).fetchone()["n"]

        table_info = list(connection.execute("PRAGMA table_info(candles)"))
        primary_key_columns = [
            row["name"]
            for row in sorted(table_info, key=lambda row: int(row["pk"] or 0))
            if int(row["pk"] or 0) > 0
        ]
        uniqueness_enforced = primary_key_columns == ["timeframe", "timestamp"]
        duplicate_count = 0 if uniqueness_enforced else connection.execute(
            """
            SELECT COUNT(*) AS n FROM (
              SELECT timeframe,timestamp,COUNT(*) AS c
              FROM candles GROUP BY timeframe,timestamp HAVING c > 1
            )
            """
        ).fetchone()["n"]

        archive_quality = connection.execute(
            """
            SELECT
              COALESCE(SUM(exact_duplicate_rows),0) AS exact_duplicates,
              COALESCE(SUM(conflicting_rows),0) AS conflicts,
              COALESCE(SUM(source_rows),0) AS source_rows,
              COALESCE(SUM(timezone_naive_rows),0) AS timezone_naive_rows,
              COALESCE(SUM(non_monotonic_rows),0) AS non_monotonic_rows,
              COUNT(*) AS archives
            FROM archive_manifest
            """
        ).fetchone()
        exact_archive_duplicates = int(archive_quality["exact_duplicates"])
        conflicting_archive_rows = int(archive_quality["conflicts"])
        source_rows = int(archive_quality["source_rows"])
        timezone_naive_rows = int(archive_quality["timezone_naive_rows"])
        non_monotonic_rows = int(archive_quality["non_monotonic_rows"])
        manifest_archives = int(archive_quality["archives"])

        h1_holes = _irregular_h1_holes(connection)
        m1_inside_m5 = _m1_inside_m5(connection)

        verdict = "PASS" if (
            total > 0
            and bad_ohlc == 0
            and rejected_year_rows == 0
            and duplicate_count == 0
            and uniqueness_enforced
            and conflicting_archive_rows == 0
            and timezone_naive_rows == 0
            and non_monotonic_rows == 0
            and h1_holes["count"] == 0
            and m1_inside_m5["incomplete_buckets"] == 0
        ) else "FAIL"

        return {
            "verdict": verdict,
            "database": str(database),
            "total_rows": total,
            "rows_by_timeframe": by_tf,
            "rows_by_year": by_year,
            "rows_by_year_timeframe": dict(by_year_timeframe),
            "bad_ohlc_rows": bad_ohlc,
            "rejected_2026_rows": rejected_year_rows,
            "duplicate_timeframe_timestamp_rows": duplicate_count,
            "uniqueness_enforced_by_primary_key": uniqueness_enforced,
            "primary_key_columns": primary_key_columns,
            "manifest_archives": manifest_archives,
            "source_rows": source_rows,
            "exact_duplicate_archive_rows": exact_archive_duplicates,
            "conflicting_archive_rows": conflicting_archive_rows,
            "timezone_naive_rows": timezone_naive_rows,
            "source_timezone_status": "VERIFIED" if source_rows > 0 and timezone_naive_rows == 0 else "UNVERIFIED",
            "non_monotonic_source_rows": non_monotonic_rows,
            "irregular_h1_holes": h1_holes,
            "m1_inside_m5": m1_inside_m5,
        }
    finally:
        connection.close()

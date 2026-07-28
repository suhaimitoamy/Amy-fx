from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any

from audit_core import iter_candles_from_zip, sha256_file


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
            conflicting_rows INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp);
        """
    )
    manifest_columns = {
        row[1] for row in connection.execute("PRAGMA table_info(archive_manifest)")
    }
    if "exact_duplicate_rows" not in manifest_columns:
        connection.execute(
            "ALTER TABLE archive_manifest ADD COLUMN exact_duplicate_rows INTEGER NOT NULL DEFAULT 0"
        )
    if "conflicting_rows" not in manifest_columns:
        connection.execute(
            "ALTER TABLE archive_manifest ADD COLUMN conflicting_rows INTEGER NOT NULL DEFAULT 0"
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
            with connection:
                for candle in iter_candles_from_zip(path):
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
                      exact_duplicate_rows,conflicting_rows
                    ) VALUES(?,?,?,?,?,?,?)
                    ON CONFLICT(archive) DO UPDATE SET
                      sha256=excluded.sha256,
                      bytes=excluded.bytes,
                      imported_rows=excluded.imported_rows,
                      rejected_rows=excluded.rejected_rows,
                      exact_duplicate_rows=excluded.exact_duplicate_rows,
                      conflicting_rows=excluded.conflicting_rows
                    """,
                    (
                        str(path.relative_to(data_dir)),
                        sha256_file(path),
                        path.stat().st_size,
                        inserted,
                        rejected,
                        exact_duplicates,
                        conflicts,
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
              COUNT(*) AS archives
            FROM archive_manifest
            """
        ).fetchone()
        exact_archive_duplicates = int(archive_quality["exact_duplicates"])
        conflicting_archive_rows = int(archive_quality["conflicts"])
        manifest_archives = int(archive_quality["archives"])

        verdict = "PASS" if (
            total > 0
            and bad_ohlc == 0
            and rejected_year_rows == 0
            and duplicate_count == 0
            and uniqueness_enforced
            and conflicting_archive_rows == 0
        ) else "FAIL"

        return {
            "verdict": verdict,
            "database": str(database),
            "total_rows": total,
            "rows_by_timeframe": by_tf,
            "rows_by_year": by_year,
            "bad_ohlc_rows": bad_ohlc,
            "rejected_2026_rows": rejected_year_rows,
            "duplicate_timeframe_timestamp_rows": duplicate_count,
            "uniqueness_enforced_by_primary_key": uniqueness_enforced,
            "primary_key_columns": primary_key_columns,
            "manifest_archives": manifest_archives,
            "exact_duplicate_archive_rows": exact_archive_duplicates,
            "conflicting_archive_rows": conflicting_archive_rows,
        }
    finally:
        connection.close()

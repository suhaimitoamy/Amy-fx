from __future__ import annotations

import json
import sqlite3
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_store import ingest_archives, validate_database


def write_archive(path: Path, rows: list[str], timeframe: str = "M1") -> None:
    csv_text = "datetime,open,high,low,close\n" + "\n".join(rows) + "\n"
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr(f"XAUUSD_{timeframe}_fixture.csv", csv_text)


def write_multiframe_archive(path: Path, members: dict[str, list[str]]) -> None:
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for timeframe, rows in members.items():
            csv_text = "datetime,open,high,low,close\n" + "\n".join(rows) + "\n"
            archive.writestr(f"XAUUSD_{timeframe}_fixture.csv", csv_text)


def write_manifest(
    path: Path,
    *,
    verified_years: list[int] | None = None,
    inferred_years: list[int] | None = None,
    allow_dedupe: bool = True,
) -> None:
    path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "provider": "HistData.com",
                "instrument": "XAUUSD",
                "format": "Generic ASCII M1 Bid OHLC",
                "quote_basis": "bid",
                "source_timezone": "UTC-05:00",
                "timezone_verified": True,
                "dst_policy": "fixed_offset_no_dst",
                "allow_exact_duplicate_dedupe": allow_dedupe,
                "provenance_status": "VERIFIED" if not inferred_years else "PARTIAL_VERIFIED",
                "verified_years": verified_years or [2020],
                "inferred_years": inferred_years or [],
            }
        ),
        encoding="utf-8",
    )


class DataStoreIntegrityTests(unittest.TestCase):
    def test_exact_duplicate_is_counted_without_duplicating_database_row(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            row = "2020-01-02T00:00:00Z,1500,1501,1499,1500.5"
            write_archive(data / "a.zip", [row])
            write_archive(data / "b.zip", [row])

            database = root / "candles.sqlite"
            result = ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, result["inserted"])
            self.assertEqual(1, sum(item["exact_duplicates"] for item in result["details"]))
            self.assertEqual(0, sum(item["conflicts"] for item in result["details"]))
            self.assertEqual(1, report["total_rows"])
            self.assertEqual("PASS", report["verdict"])

    def test_conflicting_ohlc_for_same_candle_fails_validation(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            write_archive(data / "a.zip", ["2020-01-02T00:00:00Z,1500,1501,1499,1500.5"])
            write_archive(data / "b.zip", ["2020-01-02T00:00:00Z,1500,1502,1499,1501.5"])

            database = root / "candles.sqlite"
            result = ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, sum(item["conflicts"] for item in result["details"]))
            self.assertEqual(1, report["conflicting_archive_rows"])
            self.assertEqual("FAIL", report["verdict"])

    def test_timezone_naive_source_without_manifest_fails_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            write_archive(data / "naive.zip", ["2020-01-02 00:00:00,1500,1501,1499,1500.5"])

            database = root / "candles.sqlite"
            ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, report["timezone_naive_rows"])
            self.assertEqual("UNVERIFIED", report["source_timezone_status"])
            self.assertEqual("FAIL", report["verdict"])

    def test_histdata_fixed_est_is_converted_to_utc(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            manifest = root / "source.json"
            write_manifest(manifest)
            write_archive(data / "histdata.zip", ["2020-01-01 18:00:00,1518,1520,1517,1519"])

            database = root / "candles.sqlite"
            ingest_archives(data, database, manifest)
            report = validate_database(database)
            with sqlite3.connect(database) as connection:
                stored = connection.execute("SELECT timestamp FROM candles").fetchone()[0]

            self.assertEqual("2020-01-01T23:00:00Z", stored)
            self.assertTrue(report["source_time_interpretation_verified"])
            self.assertEqual("UTC-05:00", report["source_metadata"]["source_timezone"])
            self.assertEqual("PASS", report["verdict"])

    def test_repeated_source_block_without_permission_fails_raw_order_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            write_archive(
                data / "repeated.zip",
                [
                    "2020-10-25T19:00:00Z,1500,1501,1499,1500.5",
                    "2020-10-25T19:01:00Z,1500.5,1501,1500,1500.8",
                    "2020-10-25T19:00:00Z,1500,1501,1499,1500.5",
                ],
            )

            database = root / "candles.sqlite"
            ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, report["non_monotonic_source_rows"])
            self.assertEqual("FAIL", report["raw_order_status"])
            self.assertEqual("FAIL", report["verdict"])

    def test_verified_exact_duplicate_policy_repairs_raw_order(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            manifest = root / "source.json"
            write_manifest(manifest, allow_dedupe=True)
            write_archive(
                data / "repeated.zip",
                [
                    "2020-10-25 19:00:00,1500,1501,1499,1500.5",
                    "2020-10-25 19:01:00,1500.5,1501,1500,1500.8",
                    "2020-10-25 19:00:00,1500,1501,1499,1500.5",
                ],
            )

            database = root / "candles.sqlite"
            ingest_archives(data, database, manifest)
            report = validate_database(database)

            self.assertEqual(1, report["non_monotonic_source_rows"])
            self.assertEqual(1, report["exact_duplicate_archive_rows"])
            self.assertEqual("REPAIRED_BY_EXACT_DEDUPE", report["raw_order_status"])
            self.assertEqual("PASS", report["verdict"])

    def test_unique_out_of_order_row_is_not_repaired_by_dedupe_policy(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            manifest = root / "source.json"
            write_manifest(manifest, allow_dedupe=True)
            write_archive(
                data / "out-of-order.zip",
                [
                    "2020-10-25 19:01:00,1500.5,1501,1500,1500.8",
                    "2020-10-25 19:00:00,1500,1501,1499,1500.5",
                ],
            )

            database = root / "candles.sqlite"
            ingest_archives(data, database, manifest)
            report = validate_database(database)

            self.assertEqual(1, report["unsafe_non_monotonic_source_rows"])
            self.assertEqual("FAIL", report["raw_order_status"])
            self.assertEqual("FAIL", report["verdict"])

    def test_irregular_missing_h1_block_fails_data_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            write_archive(
                data / "h1-hole.zip",
                [
                    "2023-02-20T04:00:00Z,1843.58,1845.66,1843.08,1843.71",
                    "2023-02-20T06:00:00Z,1843.37,1845.87,1843.17,1844.72",
                ],
                timeframe="H1",
            )

            database = root / "candles.sqlite"
            ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, report["irregular_h1_holes"]["count"])
            self.assertEqual("FAIL", report["verdict"])

    def test_incomplete_m1_bucket_fails_data_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            write_multiframe_archive(
                data / "incomplete.zip",
                {
                    "M1": [
                        "2020-01-02T00:00:00Z,1500,1501,1499,1500.1",
                        "2020-01-02T00:01:00Z,1500.1,1501,1500,1500.2",
                        "2020-01-02T00:03:00Z,1500.2,1501,1500,1500.3",
                        "2020-01-02T00:04:00Z,1500.3,1501,1500,1500.4",
                    ],
                    "M5": ["2020-01-02T00:00:00Z,1500,1501,1499,1500.4"],
                },
            )

            database = root / "candles.sqlite"
            ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, report["m1_inside_m5"]["incomplete_buckets"])
            self.assertEqual(1, report["m1_inside_m5"]["absent_minute_slots"])
            self.assertEqual("FAIL", report["verdict"])

    def test_partial_provenance_blocks_unverified_year(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            manifest = root / "source.json"
            write_manifest(manifest, verified_years=[2020], inferred_years=[2021])
            write_archive(data / "year-2021.zip", ["2021-01-03 18:00:00,1900,1901,1899,1900.5"])

            database = root / "candles.sqlite"
            ingest_archives(data, database, manifest)
            report = validate_database(database)

            self.assertFalse(report["provenance_complete"])
            self.assertEqual([2021], report["unverified_years_present"])
            self.assertEqual("FAIL", report["verdict"])

    def test_reingest_rebuilds_database_deterministically(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            write_archive(data / "a.zip", ["2020-01-02T00:00:00Z,1500,1501,1499,1500.5"])
            database = root / "candles.sqlite"

            first = ingest_archives(data, database)
            second = ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, first["inserted"])
            self.assertEqual(1, second["inserted"])
            self.assertEqual(1, report["total_rows"])
            self.assertEqual(0, report["exact_duplicate_archive_rows"])


if __name__ == "__main__":
    unittest.main()

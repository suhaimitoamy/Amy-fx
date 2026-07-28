from __future__ import annotations

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
            write_archive(
                data / "a.zip",
                ["2020-01-02T00:00:00Z,1500,1501,1499,1500.5"],
            )
            write_archive(
                data / "b.zip",
                ["2020-01-02T00:00:00Z,1500,1502,1499,1501.5"],
            )

            database = root / "candles.sqlite"
            result = ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, sum(item["conflicts"] for item in result["details"]))
            self.assertEqual(1, report["conflicting_archive_rows"])
            self.assertEqual("FAIL", report["verdict"])

    def test_timezone_naive_source_fails_historical_data_gate(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            write_archive(
                data / "naive.zip",
                ["2020-01-02 00:00:00,1500,1501,1499,1500.5"],
            )

            database = root / "candles.sqlite"
            ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, report["timezone_naive_rows"])
            self.assertEqual("UNVERIFIED", report["source_timezone_status"])
            self.assertEqual("FAIL", report["verdict"])

    def test_repeated_source_block_fails_raw_order_gate(self) -> None:
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
                    "M5": [
                        "2020-01-02T00:00:00Z,1500,1501,1499,1500.4",
                    ],
                },
            )

            database = root / "candles.sqlite"
            ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, report["m1_inside_m5"]["incomplete_buckets"])
            self.assertEqual(1, report["m1_inside_m5"]["absent_minute_slots"])
            self.assertEqual("FAIL", report["verdict"])


if __name__ == "__main__":
    unittest.main()

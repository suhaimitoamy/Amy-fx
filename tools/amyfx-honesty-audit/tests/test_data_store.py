from __future__ import annotations

import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from data_store import ingest_archives, validate_database


def write_archive(path: Path, rows: list[str]) -> None:
    csv_text = "datetime,open,high,low,close\n" + "\n".join(rows) + "\n"
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("XAUUSD_M1_fixture.csv", csv_text)


class DataStoreIntegrityTests(unittest.TestCase):
    def test_exact_duplicate_is_counted_without_duplicating_database_row(self) -> None:
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp)
            data = root / "data"
            data.mkdir()
            row = "2020-01-02 00:00:00,1500,1501,1499,1500.5"
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
                ["2020-01-02 00:00:00,1500,1501,1499,1500.5"],
            )
            write_archive(
                data / "b.zip",
                ["2020-01-02 00:00:00,1500,1502,1499,1501.5"],
            )

            database = root / "candles.sqlite"
            result = ingest_archives(data, database)
            report = validate_database(database)

            self.assertEqual(1, sum(item["conflicts"] for item in result["details"]))
            self.assertEqual(1, report["conflicting_archive_rows"])
            self.assertEqual("FAIL", report["verdict"])


if __name__ == "__main__":
    unittest.main()

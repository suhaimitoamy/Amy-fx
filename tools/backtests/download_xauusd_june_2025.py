#!/usr/bin/env python3
from __future__ import annotations

import csv
import hashlib
import json
import lzma
import struct
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from http.client import RemoteDisconnected
from pathlib import Path

SOURCE_ROOT = "https://datafeed.dukascopy.com/datafeed"
INSTRUMENT = "XAUUSD"
PRICE_SIDE = "BID"
START = date(2025, 5, 1)
END_EXCLUSIVE = date(2025, 7, 2)  # May warm-up, June signals, July 1 lifecycle completion.
OUT_DIR = Path("backtest_output/data")
CSV_PATH = OUT_DIR / "XAUUSD_M1_DUKASCOPY_BID_2025-05-01_2025-07-01.csv"
AUDIT_PATH = OUT_DIR / "DATA_AUDIT.json"
USER_AGENT = "AmyFX-Preview-Scalper-June-2025-Backtest/1.0"
RECORD = struct.Struct(">5if")
PRICE_DIVISOR = 1000.0

@dataclass(frozen=True)
class Candle:
    open_time: int
    close_time: int
    open: float
    high: float
    low: float
    close: float
    volume: float

def iter_dates(start: date, end: date):
    current = start
    while current < end:
        yield current
        current += timedelta(days=1)

def sha256_bytes(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest()

def fetch_payload(url: str, retries: int = 8) -> bytes:
    last_error: Exception | None = None
    for attempt in range(retries):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"})
        try:
            with urllib.request.urlopen(request, timeout=90) as response:
                if getattr(response, "status", 200) != 200:
                    raise RuntimeError(f"HTTP {getattr(response, 'status', 'unknown')}")
                return response.read()
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return b""
            last_error = exc
        except (urllib.error.URLError, TimeoutError, RemoteDisconnected, ConnectionResetError) as exc:
            last_error = exc
        if attempt + 1 < retries:
            time.sleep(min(12.0, 1.5 * (attempt + 1)))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")

def decode_day(day: date, payload: bytes) -> list[Candle]:
    if not payload:
        return []
    raw = lzma.decompress(payload)
    if len(raw) % RECORD.size:
        raise RuntimeError(f"Invalid BI5 record length on {day}: {len(raw)}")
    day_start = int(datetime(day.year, day.month, day.day, tzinfo=timezone.utc).timestamp())
    rows: list[Candle] = []
    for offset in range(0, len(raw), RECORD.size):
        seconds, open_i, close_i, low_i, high_i, volume = RECORD.unpack_from(raw, offset)
        if not 0 <= seconds < 86400:
            raise RuntimeError(f"Invalid second offset {seconds} on {day}")
        candle = Candle(
            open_time=day_start + seconds,
            close_time=day_start + seconds + 60,
            open=open_i / PRICE_DIVISOR,
            high=high_i / PRICE_DIVISOR,
            low=low_i / PRICE_DIVISOR,
            close=close_i / PRICE_DIVISOR,
            volume=float(volume),
        )
        if candle.high < max(candle.open, candle.close, candle.low):
            raise RuntimeError(f"Invalid high on {day} at {seconds}")
        if candle.low > min(candle.open, candle.close, candle.high):
            raise RuntimeError(f"Invalid low on {day} at {seconds}")
        rows.append(candle)
    return rows

def download_day(day: date):
    month_zero_based = day.month - 1
    url = f"{SOURCE_ROOT}/{INSTRUMENT}/{day.year}/{month_zero_based:02d}/{day.day:02d}/{PRICE_SIDE}_candles_min_1.bi5"
    payload = fetch_payload(url)
    return day, url, payload, decode_day(day, payload)

def main() -> int:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    days = list(iter_dates(START, END_EXCLUSIVE))
    daily: list[dict] = []
    all_rows: list[Candle] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {pool.submit(download_day, day): day for day in days}
        for future in as_completed(futures):
            day, url, payload, rows = future.result()
            daily.append({
                "date": day.isoformat(), "url": url, "payload_bytes": len(payload),
                "payload_sha256": sha256_bytes(payload), "rows": len(rows),
            })
            all_rows.extend(rows)
            print(f"{day.isoformat()} rows={len(rows)} bytes={len(payload)}", flush=True)
    daily.sort(key=lambda item: item["date"])
    all_rows.sort(key=lambda candle: candle.open_time)
    unique: dict[int, Candle] = {}
    exact_duplicates = 0
    conflicting_duplicates = 0
    for candle in all_rows:
        prior = unique.get(candle.open_time)
        if prior is None:
            unique[candle.open_time] = candle
        elif prior == candle:
            exact_duplicates += 1
        else:
            conflicting_duplicates += 1
    if conflicting_duplicates:
        raise RuntimeError(f"Conflicting duplicate timestamps: {conflicting_duplicates}")
    rows = [unique[key] for key in sorted(unique)]
    chronology_errors = sum(1 for left, right in zip(rows, rows[1:]) if right.open_time <= left.open_time)
    if chronology_errors:
        raise RuntimeError(f"Chronology errors: {chronology_errors}")
    with CSV_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["open_time", "close_time", "open", "high", "low", "close", "volume"])
        for candle in rows:
            writer.writerow([
                candle.open_time, candle.close_time, f"{candle.open:.5f}", f"{candle.high:.5f}",
                f"{candle.low:.5f}", f"{candle.close:.5f}", f"{candle.volume:.6f}",
            ])
    audit = {
        "provider": "Dukascopy Bank SA", "source": SOURCE_ROOT, "instrument": INSTRUMENT,
        "price_side": PRICE_SIDE, "source_timezone": "UTC",
        "coverage_start": datetime.fromtimestamp(rows[0].open_time, timezone.utc).isoformat() if rows else None,
        "coverage_end": datetime.fromtimestamp(rows[-1].close_time, timezone.utc).isoformat() if rows else None,
        "source_days": len(days), "source_rows_before_dedup": len(all_rows), "rows_after_dedup": len(rows),
        "exact_duplicates_removed": exact_duplicates, "conflicting_duplicates": conflicting_duplicates,
        "chronology_errors": chronology_errors, "ohlc_errors": 0,
        "candle_selection_policy": "ALL_PROVIDER_CANDLES_RETAINED",
        "interpolation": False, "forward_fill_by_repair": False, "synthetic_candles_added_by_repair": False,
        "csv_file": str(CSV_PATH), "csv_sha256": hashlib.sha256(CSV_PATH.read_bytes()).hexdigest(),
        "daily_sources": daily,
    }
    AUDIT_PATH.write_text(json.dumps(audit, indent=2), encoding="utf-8")
    print(json.dumps({key: audit[key] for key in ["rows_after_dedup", "coverage_start", "coverage_end", "csv_sha256"]}, indent=2))
    return 0

if __name__ == "__main__":
    raise SystemExit(main())

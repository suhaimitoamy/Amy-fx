#!/usr/bin/env python3
"""Download Dukascopy XAUUSD M1 candles and build monthly multi-timeframe ZIPs."""
from __future__ import annotations

import csv
import hashlib
import json
import lzma
import os
import struct
import time
import zipfile
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import pandas as pd
import requests

SYMBOL = "XAUUSD"
YEAR = 2026
START_DATE = date(2026, 1, 1)
# Use the last fully completed UTC day at the time of this export.
END_DATE = date(2026, 7, 28)
PRICE_SCALE = 1000.0
# Dukascopy candle record: millisecond offset from UTC midnight, OHLC integers, volume float.
RECORD = struct.Struct(">5If")
OUT_DIR = Path(os.environ.get("EXPORT_OUT_DIR", "artifacts/xauusd-2026"))
URL_TEMPLATE = (
    "https://datafeed.dukascopy.com/datafeed/"
    "{symbol}/{year}/{month0:02d}/{day:02d}/BID_candles_min_1.bi5"
)
TIMEFRAMES = {
    "M1": None,
    "M5": "5min",
    "M15": "15min",
    "H1": "1h",
    "H4": "4h",
    "D1": "1D",
}
MONTH_NAMES = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}
Candle = tuple[datetime, float, float, float, float, float]


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_day(session: requests.Session, day: date) -> list[Candle]:
    url = URL_TEMPLATE.format(
        symbol=SYMBOL,
        year=day.year,
        month0=day.month - 1,
        day=day.day,
    )
    response = None
    for attempt in range(4):
        try:
            response = session.get(url, timeout=45)
            if response.status_code == 404:
                return []
            response.raise_for_status()
            break
        except requests.RequestException:
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    assert response is not None
    if not response.content:
        return []
    try:
        payload = lzma.decompress(response.content)
    except lzma.LZMAError as exc:
        raise RuntimeError(f"Invalid Dukascopy LZMA payload for {day}: {url}") from exc
    if len(payload) % RECORD.size != 0:
        raise RuntimeError(f"Unexpected record size for {day}: {len(payload)} bytes")

    midnight = datetime(day.year, day.month, day.day, tzinfo=timezone.utc)
    rows: list[Candle] = []
    for offset in range(0, len(payload), RECORD.size):
        milliseconds, raw_open, raw_high, raw_low, raw_close, volume = RECORD.unpack_from(payload, offset)
        timestamp = midnight + timedelta(milliseconds=int(milliseconds))
        rows.append((
            timestamp.replace(tzinfo=None),
            raw_open / PRICE_SCALE,
            raw_high / PRICE_SCALE,
            raw_low / PRICE_SCALE,
            raw_close / PRICE_SCALE,
            float(volume),
        ))
    return rows


def clean_frame(rows: list[Candle]) -> pd.DataFrame:
    frame = pd.DataFrame(rows, columns=["datetime", "open", "high", "low", "close", "volume"])
    if frame.empty:
        return frame
    frame = frame.drop_duplicates(subset=["datetime"], keep="last").sort_values("datetime")
    valid = (
        frame[["open", "high", "low", "close", "volume"]].notna().all(axis=1)
        & (frame["volume"] > 0)
        & (frame["high"] >= frame[["open", "close", "low"]].max(axis=1))
        & (frame["low"] <= frame[["open", "close", "high"]].min(axis=1))
    )
    return frame.loc[valid].reset_index(drop=True)


def resample(frame: pd.DataFrame, rule: str) -> pd.DataFrame:
    indexed = frame.set_index("datetime")
    aggregated = indexed.resample(rule, label="left", closed="left", origin="start_day").agg(
        open=("open", "first"),
        high=("high", "max"),
        low=("low", "min"),
        close=("close", "last"),
        volume=("volume", "sum"),
    )
    return aggregated.dropna(subset=["open", "high", "low", "close"]).reset_index()


def write_csv(frame: pd.DataFrame, path: Path) -> None:
    frame[["datetime", "open", "high", "low", "close"]].to_csv(
        path,
        index=False,
        date_format="%Y-%m-%d %H:%M:%S",
        float_format="%.6f",
        quoting=csv.QUOTE_MINIMAL,
    )


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers.update({"User-Agent": "AmyFX-Backtest-Data-Exporter/1.1"})

    monthly_rows: dict[int, list[Candle]] = {month: [] for month in range(1, 8)}
    current = START_DATE
    downloaded_source_days = 0
    while current <= END_DATE:
        rows = fetch_day(session, current)
        active_rows = sum(1 for row in rows if row[5] > 0)
        if rows:
            monthly_rows[current.month].extend(rows)
            downloaded_source_days += 1
        print(
            f"{current.isoformat()}: {len(rows)} source rows, {active_rows} active M1 rows",
            flush=True,
        )
        current += timedelta(days=1)

    manifest: dict[str, object] = {
        "symbol": SYMBOL,
        "source": "Dukascopy BID native M1 candle data",
        "source_url_template": URL_TEMPLATE,
        "price_scale": PRICE_SCALE,
        "timestamp_unit": "milliseconds_from_utc_midnight",
        "zero_volume_rows_removed": True,
        "period_start_utc": START_DATE.isoformat(),
        "period_end_utc": END_DATE.isoformat(),
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "downloaded_source_days": downloaded_source_days,
        "timeframes": list(TIMEFRAMES),
        "months": {},
    }

    for month in range(1, 8):
        month_name = MONTH_NAMES[month]
        frame_m1 = clean_frame(monthly_rows[month])
        if frame_m1.empty:
            raise RuntimeError(f"No active M1 data for {YEAR}-{month:02d}")

        month_dir = OUT_DIR / f"{YEAR}_{month:02d}_{month_name}"
        month_dir.mkdir(parents=True, exist_ok=True)
        frames: dict[str, pd.DataFrame] = {"M1": frame_m1}
        for timeframe, rule in TIMEFRAMES.items():
            if timeframe == "M1":
                continue
            assert rule is not None
            frames[timeframe] = resample(frame_m1, rule)

        files: dict[str, dict[str, object]] = {}
        for timeframe, frame in frames.items():
            filename = f"{SYMBOL}_{timeframe}_{month_name}_{YEAR}.csv"
            csv_path = month_dir / filename
            write_csv(frame, csv_path)
            files[timeframe] = {
                "filename": filename,
                "rows": int(len(frame)),
                "start": frame["datetime"].iloc[0].strftime("%Y-%m-%d %H:%M:%S"),
                "end": frame["datetime"].iloc[-1].strftime("%Y-%m-%d %H:%M:%S"),
                "sha256": sha256(csv_path),
            }

        zip_path = OUT_DIR / f"{SYMBOL}_{YEAR}_{month:02d}_{month_name}.zip"
        with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for timeframe in TIMEFRAMES:
                csv_path = month_dir / str(files[timeframe]["filename"])
                archive.write(csv_path, arcname=csv_path.name)

        manifest["months"][f"{YEAR}-{month:02d}"] = {
            "zip_filename": zip_path.name,
            "zip_size_bytes": zip_path.stat().st_size,
            "zip_sha256": sha256(zip_path),
            "files": files,
        }
        print(f"Created {zip_path} ({zip_path.stat().st_size} bytes)", flush=True)

    manifest_path = OUT_DIR / "XAUUSD_2026_January_to_July_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Manifest: {manifest_path}", flush=True)


if __name__ == "__main__":
    main()

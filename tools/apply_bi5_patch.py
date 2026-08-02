from pathlib import Path

path = Path('/tmp/xauusd_2026_repair.py')
s = path.read_text(encoding='utf-8')
s = s.replace('Dukascopy Jetta API', 'Dukascopy native BI5 datafeed')
s = s.replace('import json\nimport math', 'import json\nimport lzma\nimport math')
s = s.replace('import os\nimport sys', 'import os\nimport struct\nimport sys')
s = s.replace('from collections import defaultdict', 'from collections import defaultdict\nfrom concurrent.futures import ThreadPoolExecutor, as_completed')
s = s.replace('API_ROOT = "https://jetta.dukascopy.com/v1"', 'API_ROOT = "https://datafeed.dukascopy.com/datafeed"')
s = s.replace('RAW_DIR = OUT_ROOT / "raw_daily_json"', 'RAW_DIR = OUT_ROOT / "raw_daily_bi5"')
insert_at = '\n\ndef finite_number(value: object, field: str) -> float:\n'
new_helpers = r'''

def fetch_bi5(url: str, retries: int = 5) -> tuple[bytes, int]:
    last_error: Exception | None = None
    for attempt in range(retries):
        request = urllib.request.Request(
            url,
            headers={"User-Agent": USER_AGENT, "Accept-Encoding": "identity"},
        )
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                status = getattr(response, "status", 200)
                payload = response.read()
            if status != 200:
                raise RuntimeError(f"HTTP {status}")
            return payload, status
        except urllib.error.HTTPError as exc:
            if exc.code == 404:
                return b"", 404
            last_error = exc
        except (urllib.error.URLError, TimeoutError) as exc:
            last_error = exc
        if attempt + 1 < retries:
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def decode_bi5_candles(payload: bytes, current: date) -> list[Candle]:
    if not payload:
        return []
    try:
        raw = lzma.decompress(payload)
    except lzma.LZMAError as exc:
        raise RuntimeError(f"LZMA decode failed for {current.isoformat()}: {exc}") from exc
    record_size = 24
    if len(raw) % record_size:
        raise RuntimeError(
            f"Invalid BI5 payload size for {current.isoformat()}: {len(raw)} is not divisible by 24"
        )
    day_start_ms = int(datetime(current.year, current.month, current.day, tzinfo=timezone.utc).timestamp() * 1000)
    price_divisor = 1000.0
    rows: list[Candle] = []
    for offset in range(0, len(raw), record_size):
        seconds, open_i, close_i, low_i, high_i, volume = struct.unpack_from('>5if', raw, offset)
        if seconds < 0 or seconds >= 86400:
            raise RuntimeError(f"Invalid BI5 second offset {seconds} for {current.isoformat()}")
        rows.append(Candle(
            timestamp_ms=day_start_ms + seconds * 1000,
            open=open_i / price_divisor,
            high=high_i / price_divisor,
            low=low_i / price_divisor,
            close=close_i / price_divisor,
            volume=float(volume),
        ))
    return rows
'''
if insert_at not in s:
    raise SystemExit('helper insertion anchor missing')
s = s.replace(insert_at, new_helpers + insert_at, 1)
old_loop = '''    for current in iter_dates(START_DATE, END_DATE_EXCLUSIVE):
        url = f"{API_ROOT}/candles/minute/{INSTRUMENT}/{PRICE_SIDE}/{current.year}/{current.month}/{current.day}"
        data, raw = fetch_json(url)
        raw_path = RAW_DIR / f"{current.isoformat()}.json"
        raw_path.write_bytes(raw)
        rows = decode_candle_response(data)
        all_source.extend(rows)
        daily_fetch.append({
            "date": current.isoformat(),
            "url": url,
            "http_payload_bytes": len(raw),
            "rows": len(rows),
            "sha256": sha256_file(raw_path),
        })
        print(f"{current.isoformat()} rows={len(rows)} bytes={len(raw)}", flush=True)
        time.sleep(0.05)
'''
new_loop = '''    dates = list(iter_dates(START_DATE, END_DATE_EXCLUSIVE))

    def download_day(current: date) -> tuple[date, str, bytes, int, list[Candle]]:
        zero_based_month = current.month - 1
        url = (
            f"{API_ROOT}/{INSTRUMENT}/{current.year}/{zero_based_month:02d}/"
            f"{current.day:02d}/{PRICE_SIDE}_candles_min_1.bi5"
        )
        raw, http_status = fetch_bi5(url)
        rows = decode_bi5_candles(raw, current)
        return current, url, raw, http_status, rows

    downloaded: dict[date, tuple[str, bytes, int, list[Candle]]] = {}
    with ThreadPoolExecutor(max_workers=6) as executor:
        futures = {executor.submit(download_day, current): current for current in dates}
        for future in as_completed(futures):
            current, url, raw, http_status, rows = future.result()
            downloaded[current] = (url, raw, http_status, rows)
            print(f"{current.isoformat()} status={http_status} rows={len(rows)} bytes={len(raw)}", flush=True)

    for current in dates:
        url, raw, http_status, rows = downloaded[current]
        raw_path = RAW_DIR / f"{current.isoformat()}.bi5"
        raw_path.write_bytes(raw)
        all_source.extend(rows)
        daily_fetch.append({
            "date": current.isoformat(),
            "url": url,
            "http_status": http_status,
            "http_payload_bytes": len(raw),
            "rows": len(rows),
            "sha256": sha256_file(raw_path),
        })
'''
if old_loop not in s:
    raise SystemExit('download loop anchor missing')
s = s.replace(old_loop, new_loop, 1)
s = s.replace('"source_api": "https://jetta.dukascopy.com/v1"', '"source_api": "https://datafeed.dukascopy.com/datafeed"')
s = s.replace('"api": "Jetta v1 candle API"', '"api": "Dukascopy native BI5 datafeed"')
s = s.replace('"API: Jetta v1 candle API"', '"API: Dukascopy native BI5 datafeed"')
path.write_text(s, encoding='utf-8')

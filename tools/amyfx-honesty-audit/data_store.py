from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import re
import sqlite3
import zipfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone, tzinfo
from pathlib import Path
from typing import Any, Iterator, Mapping, Sequence

from audit_core import ACCEPTED_YEARS, Candle, OHLC_FIELDS, TIMEFRAMES, parse_timestamp, sha256_file

_TZ_SUFFIX = re.compile(r"(?:Z|[+-]\d{2}:?\d{2})$", re.I)
_FIXED_OFFSET = re.compile(r"^UTC([+-])(\d{2}):(\d{2})$")


@dataclass(frozen=True)
class SourcePolicy:
    provider: str = "UNDECLARED"
    instrument: str = "UNKNOWN"
    format: str = "UNKNOWN"
    quote_basis: str = "UNKNOWN"
    source_timezone: str | None = None
    timezone_verified: bool = False
    dst_policy: str = "UNKNOWN"
    allow_exact_duplicate_dedupe: bool = False
    provenance_status: str = "UNDECLARED"
    verified_years: frozenset[int] = frozenset()
    inferred_years: frozenset[int] = frozenset()
    manifest_sha256: str | None = None

    def tzinfo(self) -> tzinfo | None:
        if self.source_timezone is None:
            return None
        match = _FIXED_OFFSET.fullmatch(self.source_timezone)
        if not match:
            raise ValueError("source_timezone must use a fixed offset such as UTC-05:00")
        sign = 1 if match.group(1) == "+" else -1
        hours, minutes = int(match.group(2)), int(match.group(3))
        if hours > 23 or minutes > 59:
            raise ValueError(f"Invalid source_timezone: {self.source_timezone}")
        delta = sign * timedelta(hours=hours, minutes=minutes)
        return timezone(delta, self.source_timezone)


def load_source_policy(path: Path | None) -> SourcePolicy:
    if path is None:
        return SourcePolicy()
    raw = path.read_bytes()
    try:
        value = json.loads(raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"Invalid source manifest {path}: {exc}") from exc
    if not isinstance(value, Mapping):
        raise ValueError("Source manifest must be a JSON object")

    def years(name: str) -> frozenset[int]:
        items = value.get(name, [])
        if not isinstance(items, Sequence) or isinstance(items, (str, bytes, bytearray)):
            raise ValueError(f"{name} must be an array")
        result = frozenset(int(item) for item in items)
        invalid = result - ACCEPTED_YEARS
        if invalid:
            raise ValueError(f"Unsupported years in {name}: {sorted(invalid)}")
        return result

    policy = SourcePolicy(
        provider=str(value.get("provider") or "UNDECLARED").strip(),
        instrument=str(value.get("instrument") or "UNKNOWN").strip().upper(),
        format=str(value.get("format") or "UNKNOWN").strip(),
        quote_basis=str(value.get("quote_basis") or "UNKNOWN").strip().lower(),
        source_timezone=str(value["source_timezone"]).strip() if value.get("source_timezone") else None,
        timezone_verified=bool(value.get("timezone_verified")),
        dst_policy=str(value.get("dst_policy") or "UNKNOWN").strip(),
        allow_exact_duplicate_dedupe=bool(value.get("allow_exact_duplicate_dedupe")),
        provenance_status=str(value.get("provenance_status") or "UNDECLARED").strip().upper(),
        verified_years=years("verified_years"),
        inferred_years=years("inferred_years"),
        manifest_sha256=hashlib.sha256(raw).hexdigest(),
    )
    if policy.timezone_verified and policy.tzinfo() is None:
        raise ValueError("timezone_verified=true requires source_timezone")
    return policy


def _timeframe(name: str) -> str | None:
    upper = name.upper()
    return next(
        (tf for tf in TIMEFRAMES if re.search(rf"(?:^|[_\-.]){tf}(?:[_\-.]|$)", upper)),
        None,
    )


def _headers(names: Sequence[str] | None) -> dict[str, str]:
    aliases = {
        "datetime": ("datetime", "date", "time", "timestamp"),
        "open": ("open", "o"), "high": ("high", "h"),
        "low": ("low", "l"), "close": ("close", "c"),
    }
    normalized = {str(name).strip().lower().replace(" ", ""): str(name) for name in names or []}
    return {
        canonical: normalized[alias]
        for canonical, choices in aliases.items()
        for alias in choices
        if alias in normalized
    }


def _number(value: Any) -> float | None:
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _source_time(value: Any, default_tz: tzinfo | None) -> tuple[datetime | None, bool, bool, int | None]:
    text = str(value or "").strip()
    if not text:
        return None, False, False, None
    parsed: datetime | None = None
    for candidate in (text.replace("Z", "+00:00"), text.replace("Z", "+00:00").replace("/", "-")):
        try:
            parsed = datetime.fromisoformat(candidate)
            break
        except ValueError:
            pass
    if parsed is None:
        for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y.%m.%d %H:%M:%S", "%Y.%m.%d %H:%M"):
            try:
                parsed = datetime.strptime(text, fmt)
                break
            except ValueError:
                pass
    if parsed is None:
        return None, not bool(_TZ_SUFFIX.search(text)), False, None
    naive = parsed.tzinfo is None
    verified = not naive or default_tz is not None
    parsed = parsed.replace(tzinfo=default_tz or timezone.utc) if naive else parsed
    year_match = re.match(r"^(\d{4})", text)
    source_year = int(year_match.group(1)) if year_match else parsed.year
    return parsed.astimezone(timezone.utc), naive, verified, source_year


def _candles(path: Path, default_tz: tzinfo | None) -> Iterator[tuple[Candle, bool, bool, int]]:
    with zipfile.ZipFile(path) as archive:
        for member in archive.namelist():
            tf = _timeframe(Path(member).name)
            if not tf or not member.lower().endswith(".csv"):
                continue
            with archive.open(member) as raw:
                reader = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))
                headers = _headers(reader.fieldnames)
                if set(headers) != {"datetime", *OHLC_FIELDS}:
                    raise ValueError(f"Unsupported CSV headers in {path.name}:{member}")
                for line, row in enumerate(reader, 2):
                    parsed, naive, verified, source_year = _source_time(row.get(headers["datetime"]), default_tz)
                    if parsed is None or source_year is None:
                        raise ValueError(f"Invalid timestamp in {path.name}:{member}:{line}")
                    if source_year not in ACCEPTED_YEARS:
                        continue
                    values = [_number(row.get(headers[field])) for field in OHLC_FIELDS]
                    if any(value is None for value in values):
                        raise ValueError(f"Invalid OHLC in {path.name}:{member}:{line}")
                    open_, high, low, close = (float(value) for value in values)  # type: ignore[arg-type]
                    if high < max(open_, close, low) or low > min(open_, close, high):
                        raise ValueError(f"Impossible OHLC in {path.name}:{member}:{line}")
                    stamp = parsed.isoformat().replace("+00:00", "Z")
                    yield Candle(tf, stamp, open_, high, low, close, path.name, member), naive, verified, source_year


def init_database(connection: sqlite3.Connection) -> None:
    connection.executescript(
        """
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        CREATE TABLE IF NOT EXISTS candles (
          timeframe TEXT NOT NULL, timestamp TEXT NOT NULL,
          open REAL NOT NULL, high REAL NOT NULL, low REAL NOT NULL, close REAL NOT NULL,
          source_archive TEXT NOT NULL, source_member TEXT NOT NULL,
          PRIMARY KEY(timeframe,timestamp)
        );
        CREATE TABLE IF NOT EXISTS archive_manifest (
          archive TEXT PRIMARY KEY, sha256 TEXT NOT NULL, bytes INTEGER NOT NULL,
          imported_rows INTEGER NOT NULL, rejected_rows INTEGER NOT NULL,
          exact_duplicate_rows INTEGER NOT NULL DEFAULT 0,
          conflicting_rows INTEGER NOT NULL DEFAULT 0,
          source_rows INTEGER NOT NULL DEFAULT 0,
          timezone_naive_rows INTEGER NOT NULL DEFAULT 0,
          verified_timestamp_rows INTEGER NOT NULL DEFAULT 0,
          non_monotonic_rows INTEGER NOT NULL DEFAULT 0,
          unsafe_non_monotonic_rows INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS source_metadata (
          id INTEGER PRIMARY KEY CHECK(id=1), provider TEXT NOT NULL,
          instrument TEXT NOT NULL, format TEXT NOT NULL, quote_basis TEXT NOT NULL,
          source_timezone TEXT, timezone_verified INTEGER NOT NULL, dst_policy TEXT NOT NULL,
          allow_exact_duplicate_dedupe INTEGER NOT NULL, provenance_status TEXT NOT NULL,
          verified_years_json TEXT NOT NULL, inferred_years_json TEXT NOT NULL,
          manifest_sha256 TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp);
        """
    )
    columns = {row[1] for row in connection.execute("PRAGMA table_info(archive_manifest)")}
    for name in (
        "exact_duplicate_rows", "conflicting_rows", "source_rows", "timezone_naive_rows",
        "verified_timestamp_rows", "non_monotonic_rows", "unsafe_non_monotonic_rows",
    ):
        if name not in columns:
            connection.execute(f"ALTER TABLE archive_manifest ADD COLUMN {name} INTEGER NOT NULL DEFAULT 0")


def _store_policy(connection: sqlite3.Connection, policy: SourcePolicy) -> None:
    connection.execute(
        """INSERT INTO source_metadata VALUES(1,?,?,?,?,?,?,?,?,?,?,?,?)""",
        (
            policy.provider, policy.instrument, policy.format, policy.quote_basis,
            policy.source_timezone, int(policy.timezone_verified), policy.dst_policy,
            int(policy.allow_exact_duplicate_dedupe), policy.provenance_status,
            json.dumps(sorted(policy.verified_years)), json.dumps(sorted(policy.inferred_years)),
            policy.manifest_sha256,
        ),
    )


def ingest_archives(data_dir: Path, database: Path, source_manifest: Path | None = None) -> dict[str, Any]:
    archives = sorted(data_dir.rglob("*.zip"))
    if not archives:
        raise FileNotFoundError(f"No ZIP archives found below {data_dir}")
    policy = load_source_policy(source_manifest)
    database.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(database)
    init_database(connection)
    results: list[dict[str, Any]] = []
    total = 0
    try:
        with connection:
            for table in ("candles", "archive_manifest", "source_metadata"):
                connection.execute(f"DELETE FROM {table}")
            _store_policy(connection, policy)
        for path in archives:
            stats = Counter()
            previous: dict[str, str] = {}
            years_seen: set[int] = set()
            with connection:
                for candle, naive, verified, source_year in _candles(path, policy.tzinfo()):
                    stats["source_rows"] += 1
                    stats["timezone_naive_rows"] += int(naive)
                    stats["verified_timestamp_rows"] += int(verified)
                    years_seen.add(source_year)
                    out_of_order = candle.source_member in previous and candle.timestamp <= previous[candle.source_member]
                    stats["non_monotonic_rows"] += int(out_of_order)
                    previous[candle.source_member] = candle.timestamp
                    cursor = connection.execute(
                        "INSERT OR IGNORE INTO candles VALUES(?,?,?,?,?,?,?,?)",
                        (candle.timeframe, candle.timestamp, candle.open, candle.high, candle.low,
                         candle.close, candle.source_archive, candle.source_member),
                    )
                    if cursor.rowcount == 1:
                        stats["inserted"] += 1
                        stats["unsafe_non_monotonic_rows"] += int(out_of_order)
                        continue
                    existing = connection.execute(
                        "SELECT open,high,low,close FROM candles WHERE timeframe=? AND timestamp=?",
                        (candle.timeframe, candle.timestamp),
                    ).fetchone()
                    if tuple(existing or ()) == (candle.open, candle.high, candle.low, candle.close):
                        stats["exact_duplicates"] += 1
                    else:
                        stats["conflicts"] += 1
                        stats["unsafe_non_monotonic_rows"] += int(out_of_order)
                rejected = stats["exact_duplicates"] + stats["conflicts"]
                connection.execute(
                    "INSERT INTO archive_manifest VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
                    (str(path.relative_to(data_dir)), sha256_file(path), path.stat().st_size,
                     stats["inserted"], rejected, stats["exact_duplicates"], stats["conflicts"],
                     stats["source_rows"], stats["timezone_naive_rows"], stats["verified_timestamp_rows"],
                     stats["non_monotonic_rows"], stats["unsafe_non_monotonic_rows"]),
                )
            total += stats["inserted"]
            results.append({
                "archive": str(path), "inserted": stats["inserted"],
                "duplicates_or_conflicts": rejected, "exact_duplicates": stats["exact_duplicates"],
                "conflicts": stats["conflicts"], "source_rows": stats["source_rows"],
                "timezone_naive_rows": stats["timezone_naive_rows"],
                "verified_timestamp_rows": stats["verified_timestamp_rows"],
                "non_monotonic_rows": stats["non_monotonic_rows"],
                "unsafe_non_monotonic_rows": stats["unsafe_non_monotonic_rows"],
                "source_years": sorted(years_seen),
            })
    finally:
        connection.close()
    return {
        "archives": len(archives), "inserted": total, "database": str(database),
        "source_manifest": str(source_manifest) if source_manifest else None,
        "source_provider": policy.provider, "source_timezone": policy.source_timezone,
        "details": results,
    }


def _utc(value: str) -> datetime:
    parsed = parse_timestamp(value)
    if parsed is None:
        raise ValueError(f"Invalid normalized timestamp in database: {value}")
    return parsed.astimezone(timezone.utc)


def _h1_holes(connection: sqlite3.Connection) -> dict[str, Any]:
    times = [_utc(row[0]) for row in connection.execute(
        "SELECT timestamp FROM candles WHERE timeframe='H1' ORDER BY timestamp"
    )]
    signatures: Counter[tuple[int, int, int, int, int]] = Counter()
    years: dict[tuple[int, int, int, int, int], set[int]] = defaultdict(set)
    gaps = []
    for left, right in zip(times, times[1:]):
        if int((right - left).total_seconds()) != 7200:
            continue
        signature = (left.weekday(), left.hour, left.minute, right.hour, right.minute)
        signatures[signature] += 1
        years[signature].add(left.year)
        gaps.append((left, right, signature))
    recurring = {signature for signature, seen in years.items() if len(seen) >= 4}
    suspicious = [gap for gap in gaps if gap[2] not in recurring]
    by_month = Counter(left.strftime("%Y-%m") for left, _, _ in suspicious)
    return {
        "count": len(suspicious), "by_month": dict(sorted(by_month.items())),
        "examples": [
            {"from": left.isoformat().replace("+00:00", "Z"),
             "to": right.isoformat().replace("+00:00", "Z")}
            for left, right, _ in suspicious[:20]
        ],
        "recurring_schedule_signatures": [
            {"weekday": signature[0], "from": f"{signature[1]:02d}:{signature[2]:02d}",
             "to": f"{signature[3]:02d}:{signature[4]:02d}",
             "occurrences": signatures[signature], "years": sorted(years[signature])}
            for signature in sorted(recurring)
        ],
    }


def _bucket5(stamp: str) -> tuple[str, int]:
    return stamp[:14], int(stamp[14:16]) // 5


def _m1_inside_m5(connection: sqlite3.Connection) -> dict[str, int]:
    counts = Counter(_bucket5(row[0]) for row in connection.execute(
        "SELECT timestamp FROM candles WHERE timeframe='M1' ORDER BY timestamp"
    ))
    complete = incomplete = absent = 0
    for row in connection.execute("SELECT timestamp FROM candles WHERE timeframe='M5' ORDER BY timestamp"):
        observed = counts.get(_bucket5(row[0]), 0)
        if observed == 5:
            complete += 1
        elif observed < 5:
            incomplete += 1
            absent += 5 - observed
    return {"complete_buckets": complete, "incomplete_buckets": incomplete, "absent_minute_slots": absent}


def _metadata(connection: sqlite3.Connection) -> dict[str, Any]:
    row = connection.execute("SELECT * FROM source_metadata WHERE id=1").fetchone()
    if row is None:
        return {
            "provider": "UNDECLARED", "instrument": "UNKNOWN", "format": "UNKNOWN",
            "quote_basis": "UNKNOWN", "source_timezone": None, "timezone_verified": False,
            "dst_policy": "UNKNOWN", "allow_exact_duplicate_dedupe": False,
            "provenance_status": "UNDECLARED", "verified_years": [], "inferred_years": [],
            "manifest_sha256": None,
        }
    return {
        "provider": row["provider"], "instrument": row["instrument"], "format": row["format"],
        "quote_basis": row["quote_basis"], "source_timezone": row["source_timezone"],
        "timezone_verified": bool(row["timezone_verified"]), "dst_policy": row["dst_policy"],
        "allow_exact_duplicate_dedupe": bool(row["allow_exact_duplicate_dedupe"]),
        "provenance_status": row["provenance_status"],
        "verified_years": json.loads(row["verified_years_json"]),
        "inferred_years": json.loads(row["inferred_years_json"]),
        "manifest_sha256": row["manifest_sha256"],
    }


def validate_database(database: Path) -> dict[str, Any]:
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    try:
        total = connection.execute("SELECT COUNT(*) n FROM candles").fetchone()["n"]
        by_tf = {row["timeframe"]: row["n"] for row in connection.execute(
            "SELECT timeframe,COUNT(*) n FROM candles GROUP BY timeframe ORDER BY timeframe"
        )}
        by_year = {row["year"]: row["n"] for row in connection.execute(
            "SELECT substr(timestamp,1,4) year,COUNT(*) n FROM candles GROUP BY year ORDER BY year"
        )}
        by_year_tf: dict[str, dict[str, int]] = defaultdict(dict)
        for row in connection.execute(
            "SELECT substr(timestamp,1,4) year,timeframe,COUNT(*) n FROM candles GROUP BY year,timeframe"
        ):
            by_year_tf[row["year"]][row["timeframe"]] = row["n"]
        bad_ohlc = connection.execute(
            "SELECT COUNT(*) n FROM candles WHERE high<low OR high<open OR high<close OR low>open OR low>close"
        ).fetchone()["n"]
        rejected_2026 = connection.execute(
            "SELECT COUNT(*) n FROM candles WHERE substr(timestamp,1,4)='2026'"
        ).fetchone()["n"]
        pk = [row["name"] for row in sorted(connection.execute("PRAGMA table_info(candles)"),
              key=lambda item: int(item["pk"] or 0)) if int(row["pk"] or 0) > 0]
        unique = pk == ["timeframe", "timestamp"]
        duplicate_rows = 0 if unique else connection.execute(
            "SELECT COUNT(*) n FROM (SELECT 1 FROM candles GROUP BY timeframe,timestamp HAVING COUNT(*)>1)"
        ).fetchone()["n"]
        quality = connection.execute(
            """SELECT COALESCE(SUM(exact_duplicate_rows),0) exact_duplicates,
               COALESCE(SUM(conflicting_rows),0) conflicts, COALESCE(SUM(source_rows),0) source_rows,
               COALESCE(SUM(timezone_naive_rows),0) naive, COALESCE(SUM(verified_timestamp_rows),0) verified,
               COALESCE(SUM(non_monotonic_rows),0) non_monotonic,
               COALESCE(SUM(unsafe_non_monotonic_rows),0) unsafe, COUNT(*) archives
               FROM archive_manifest"""
        ).fetchone()
        source = _metadata(connection)
        years_present = {int(year) for year in by_year}
        verified_years = {int(year) for year in source["verified_years"]}
        inferred_years = {int(year) for year in source["inferred_years"]}
        provenance_complete = years_present.issubset(verified_years) if source["manifest_sha256"] else True
        source_time_verified = (
            quality["source_rows"] > 0 and quality["verified"] == quality["source_rows"] and
            (quality["naive"] == 0 or (source["timezone_verified"] and source["source_timezone"]))
        )
        repaired = (
            quality["non_monotonic"] > 0 and source["allow_exact_duplicate_dedupe"] and
            quality["conflicts"] == 0 and quality["exact_duplicates"] > 0 and quality["unsafe"] == 0
        )
        raw_order_ok = quality["non_monotonic"] == 0 or repaired
        holes = _h1_holes(connection)
        coverage = _m1_inside_m5(connection)
        verdict = "PASS" if all((
            total > 0, bad_ohlc == 0, rejected_2026 == 0, duplicate_rows == 0, unique,
            quality["conflicts"] == 0, source_time_verified, raw_order_ok, provenance_complete,
            holes["count"] == 0, coverage["incomplete_buckets"] == 0,
        )) else "FAIL"
        return {
            "verdict": verdict, "database": str(database), "total_rows": total,
            "rows_by_timeframe": by_tf, "rows_by_year": by_year,
            "rows_by_year_timeframe": dict(by_year_tf), "bad_ohlc_rows": bad_ohlc,
            "rejected_2026_rows": rejected_2026, "duplicate_timeframe_timestamp_rows": duplicate_rows,
            "uniqueness_enforced_by_primary_key": unique, "primary_key_columns": pk,
            "manifest_archives": quality["archives"], "source_rows": quality["source_rows"],
            "exact_duplicate_archive_rows": quality["exact_duplicates"],
            "conflicting_archive_rows": quality["conflicts"], "timezone_naive_rows": quality["naive"],
            "verified_timestamp_rows": quality["verified"],
            "source_time_interpretation_verified": bool(source_time_verified),
            "source_timezone_status": "VERIFIED" if source_time_verified else "UNVERIFIED",
            "non_monotonic_source_rows": quality["non_monotonic"],
            "unsafe_non_monotonic_source_rows": quality["unsafe"],
            "raw_order_status": "PASS" if quality["non_monotonic"] == 0 else
                "REPAIRED_BY_EXACT_DEDUPE" if repaired else "FAIL",
            "source_metadata": source, "years_present": sorted(years_present),
            "verified_years_present": sorted(years_present & verified_years),
            "inferred_years_present": sorted(years_present & inferred_years),
            "unverified_years_present": sorted(years_present - verified_years),
            "provenance_complete": provenance_complete, "irregular_h1_holes": holes,
            "m1_inside_m5": coverage,
        }
    finally:
        connection.close()

from __future__ import annotations

import csv
import hashlib
import json
import math
import re
import sqlite3
import zipfile
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping, Sequence

ACCEPTED_YEARS = frozenset(range(2020, 2026))
REJECTED_YEARS = frozenset({2026})
TIMEFRAMES = ("M1", "M5", "M15", "H1", "H4", "D1")
OHLC_FIELDS = ("open", "high", "low", "close")
PERCENT_FORECAST_RE = re.compile(
    r"(?:VALIDATED\s+FORECAST|Direction\s+Forecast)[^\n]{0,100}?\b(?:confidence\s*)?(\d{1,3}(?:\.\d+)?)\s*%",
    re.IGNORECASE,
)
VALIDATED_TEXT_RE = re.compile(r"\bVALIDATED\b", re.IGNORECASE)
OBSERVATION_LABELS = {
    "raw_bias",
    "raw_structure",
    "raw_fvg",
    "raw_order_block",
    "raw_bsl_ssl",
    "premium_discount",
    "engine_score",
}


@dataclass(frozen=True)
class AuditIssue:
    code: str
    severity: str
    message: str
    timestamp: str | None = None
    timeframe: str | None = None
    details: Mapping[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True)
class Candle:
    timeframe: str
    timestamp: str
    open: float
    high: float
    low: float
    close: float
    source_archive: str
    source_member: str


def canonical_json(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def parse_timestamp(value: Any) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        number = float(value)
        if number > 10_000_000_000:
            number /= 1000.0
        try:
            return datetime.fromtimestamp(number, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None

    text = str(value).strip()
    if not text:
        return None
    normalized = text.replace("Z", "+00:00")
    candidates = (
        normalized,
        normalized.replace("/", "-"),
    )
    for candidate in candidates:
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(timezone.utc)
        except ValueError:
            pass

    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y.%m.%d %H:%M:%S",
        "%Y.%m.%d %H:%M",
    ):
        try:
            return datetime.strptime(text, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def normalized_timestamp(value: Any) -> str | None:
    parsed = parse_timestamp(value)
    return parsed.isoformat().replace("+00:00", "Z") if parsed else None


def _as_mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def _upper(value: Any) -> str:
    return str(value or "").strip().upper()


def _finite(value: Any) -> float | None:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _snapshot_timestamp(snapshot: Mapping[str, Any]) -> str | None:
    for key in ("capturedAt", "analyzedAt", "timestamp", "sourceCandleTime"):
        result = normalized_timestamp(snapshot.get(key))
        if result:
            return result
    return None


def validate_setup_geometry(execution: Mapping[str, Any]) -> list[AuditIssue]:
    direction = _upper(execution.get("direction"))
    if direction not in {"BUY", "SELL"}:
        return []

    lo = _finite(execution.get("entryLow"))
    hi = _finite(execution.get("entryHigh"))
    stop = _finite(execution.get("stopLoss", execution.get("sl")))
    target1 = _finite(execution.get("target1", execution.get("tp1")))
    target2 = _finite(execution.get("target2", execution.get("tp2")))
    single_target = bool(execution.get("singleTarget", target2 is None))

    issues: list[AuditIssue] = []
    if any(value is None for value in (lo, hi, stop, target1)):
        issues.append(
            AuditIssue(
                code="SETUP_GEOMETRY_MISSING",
                severity="error",
                message="Active BUY/SELL setup is missing a finite entry, stop, or target value.",
                details={"direction": direction},
            )
        )
        return issues

    assert lo is not None and hi is not None and stop is not None and target1 is not None
    if lo > hi:
        issues.append(
            AuditIssue(
                code="ENTRY_RANGE_REVERSED",
                severity="error",
                message="entryLow is greater than entryHigh.",
                details={"entryLow": lo, "entryHigh": hi},
            )
        )

    if direction == "BUY":
        if stop >= lo:
            issues.append(
                AuditIssue(
                    code="BUY_STOP_INVALID",
                    severity="error",
                    message="BUY stop must be below entryLow.",
                    details={"stopLoss": stop, "entryLow": lo},
                )
            )
        if target1 <= hi:
            issues.append(
                AuditIssue(
                    code="BUY_TARGET_INVALID",
                    severity="error",
                    message="BUY target1 must be above entryHigh.",
                    details={"target1": target1, "entryHigh": hi},
                )
            )
        if not single_target and (target2 is None or target2 < target1):
            issues.append(
                AuditIssue(
                    code="BUY_TARGET2_INVALID",
                    severity="error",
                    message="BUY target2 must be finite and not lower than target1.",
                    details={"target1": target1, "target2": target2},
                )
            )
    else:
        if stop <= hi:
            issues.append(
                AuditIssue(
                    code="SELL_STOP_INVALID",
                    severity="error",
                    message="SELL stop must be above entryHigh.",
                    details={"stopLoss": stop, "entryHigh": hi},
                )
            )
        if target1 >= lo:
            issues.append(
                AuditIssue(
                    code="SELL_TARGET_INVALID",
                    severity="error",
                    message="SELL target1 must be below entryLow.",
                    details={"target1": target1, "entryLow": lo},
                )
            )
        if not single_target and (target2 is None or target2 > target1):
            issues.append(
                AuditIssue(
                    code="SELL_TARGET2_INVALID",
                    severity="error",
                    message="SELL target2 must be finite and not higher than target1.",
                    details={"target1": target1, "target2": target2},
                )
            )
    return issues


def audit_snapshot(snapshot: Mapping[str, Any], *, now: datetime | None = None) -> list[AuditIssue]:
    now = now or datetime.now(timezone.utc)
    tf = _upper(snapshot.get("timeframe") or snapshot.get("tf")) or None
    stamp = _snapshot_timestamp(snapshot)
    decision = _as_mapping(snapshot.get("directionDecision"))
    forecast = _as_mapping(snapshot.get("directionForecast"))
    if not forecast:
        validated = _as_mapping(snapshot.get("validatedMarketContext"))
        forecast = _as_mapping(validated.get("directionForecast"))
    execution = _as_mapping(snapshot.get("setupExecution"))

    data_stale = bool(snapshot.get("dataStale")) or _upper(decision.get("source")) == "DATA_STALE"
    decision_signal = _upper(decision.get("signal") or snapshot.get("signal") or snapshot.get("direction"))
    setup_active = bool(execution.get("active"))
    setup_terminal = bool(execution.get("terminal"))
    forecast_active = bool(forecast.get("active"))
    forecast_terminal = bool(forecast.get("invalidated")) or bool(forecast.get("expired"))

    issues: list[AuditIssue] = []

    def add(code: str, severity: str, message: str, details: Mapping[str, Any] | None = None) -> None:
        issues.append(AuditIssue(code, severity, message, stamp, tf, details))

    if data_stale and decision_signal not in {"", "WAIT", "DATA USANG"}:
        add(
            "STALE_DATA_DIRECTION",
            "critical",
            "Stale data produced a directional decision instead of WAIT.",
            {"signal": decision_signal},
        )
    if data_stale and setup_active:
        add("STALE_DATA_ACTIVE_SETUP", "critical", "Stale data left an active setup.")

    if (not forecast_active or forecast_terminal) and setup_active:
        add(
            "INACTIVE_FORECAST_ACTIVE_SETUP",
            "critical",
            "An inactive, invalidated, or expired forecast left an active setup.",
            {"forecastActive": forecast_active, "forecastTerminal": forecast_terminal},
        )

    if setup_terminal and setup_active:
        add("TERMINAL_SETUP_ACTIVE", "critical", "A terminal setup is also marked active.")

    if setup_active or _upper(execution.get("direction")) in {"BUY", "SELL"}:
        for issue in validate_setup_geometry(execution):
            issues.append(
                AuditIssue(
                    issue.code,
                    issue.severity,
                    issue.message,
                    stamp,
                    tf,
                    issue.details,
                )
            )

    source_times: list[tuple[str, Any]] = []
    if "sourceCandleTime" in snapshot:
        source_times.append((tf or "UNKNOWN", snapshot.get("sourceCandleTime")))
    source_candles = _as_mapping(snapshot.get("sourceCandles"))
    source_times.extend((str(key), value) for key, value in source_candles.items())
    for source_tf, source_value in source_times:
        source_dt = parse_timestamp(source_value)
        if source_dt and source_dt > now:
            add(
                "FUTURE_SOURCE_CANDLE",
                "critical",
                "Snapshot uses a source candle timestamp in the future.",
                {"sourceTimeframe": source_tf, "sourceCandleTime": normalized_timestamp(source_value), "now": now.isoformat()},
            )
        if source_dt and source_dt.year in REJECTED_YEARS:
            add(
                "REJECTED_YEAR_DATA",
                "critical",
                "Rejected 2026 candle data entered an audit snapshot.",
                {"sourceTimeframe": source_tf, "sourceCandleTime": normalized_timestamp(source_value)},
            )

    labels = snapshot.get("claims")
    if isinstance(labels, Sequence) and not isinstance(labels, (str, bytes, bytearray)):
        for claim in labels:
            claim_map = _as_mapping(claim)
            kind = str(claim_map.get("kind") or claim_map.get("type") or "").strip().lower()
            label = str(claim_map.get("label") or claim_map.get("status") or "")
            if kind in OBSERVATION_LABELS and VALIDATED_TEXT_RE.search(label):
                add(
                    "OBSERVATION_LABELED_VALIDATED",
                    "critical",
                    "An observation-only component is described as validated.",
                    {"kind": kind, "label": label},
                )

    text_fields: list[str] = []
    for container in (snapshot, decision, forecast, execution, _as_mapping(snapshot.get("mappingExplanation"))):
        for value in container.values():
            if isinstance(value, str):
                text_fields.append(value)
    for text in text_fields:
        match = PERCENT_FORECAST_RE.search(text)
        if match:
            add(
                "SCORE_PRESENTED_AS_PROBABILITY",
                "error",
                "A forecast score is presented with a percent sign without an explicit probability calibration.",
                {"text": text, "value": match.group(1)},
            )
            break

    return issues


def _flatten_for_compare(snapshot: Mapping[str, Any]) -> dict[str, Any]:
    decision = _as_mapping(snapshot.get("directionDecision"))
    forecast = _as_mapping(snapshot.get("directionForecast"))
    if not forecast:
        forecast = _as_mapping(_as_mapping(snapshot.get("validatedMarketContext")).get("directionForecast"))
    execution = _as_mapping(snapshot.get("setupExecution"))
    return {
        "timeframe": _upper(snapshot.get("timeframe") or snapshot.get("tf")),
        "sourceCandleTime": normalized_timestamp(snapshot.get("sourceCandleTime")),
        "dataStale": bool(snapshot.get("dataStale")),
        "signal": _upper(decision.get("signal") or snapshot.get("signal") or snapshot.get("direction")),
        "forecastActive": bool(forecast.get("active")),
        "forecastDirection": _upper(forecast.get("direction")),
        "setupActive": bool(execution.get("active")),
        "setupDirection": _upper(execution.get("direction")),
        "entryLow": _finite(execution.get("entryLow")),
        "entryHigh": _finite(execution.get("entryHigh")),
        "stopLoss": _finite(execution.get("stopLoss")),
        "target1": _finite(execution.get("target1")),
        "target2": _finite(execution.get("target2")),
    }


def compare_snapshots(
    app_snapshot: Mapping[str, Any],
    reference_snapshot: Mapping[str, Any],
    *,
    price_tolerance: float = 0.01,
) -> list[AuditIssue]:
    app = _flatten_for_compare(app_snapshot)
    reference = _flatten_for_compare(reference_snapshot)
    stamp = app.get("sourceCandleTime") or _snapshot_timestamp(app_snapshot)
    tf = app.get("timeframe") or None
    issues: list[AuditIssue] = []

    categorical = (
        "timeframe",
        "sourceCandleTime",
        "dataStale",
        "signal",
        "forecastActive",
        "forecastDirection",
        "setupActive",
        "setupDirection",
    )
    numeric = ("entryLow", "entryHigh", "stopLoss", "target1", "target2")

    for field in categorical:
        if app.get(field) != reference.get(field):
            issues.append(
                AuditIssue(
                    code="REFERENCE_MISMATCH",
                    severity="warning",
                    message=f"App and reference disagree on {field}.",
                    timestamp=stamp,
                    timeframe=tf,
                    details={"field": field, "app": app.get(field), "reference": reference.get(field)},
                )
            )
    for field in numeric:
        left = app.get(field)
        right = reference.get(field)
        if left is None and right is None:
            continue
        if left is None or right is None or abs(float(left) - float(right)) > price_tolerance:
            issues.append(
                AuditIssue(
                    code="REFERENCE_PRICE_MISMATCH",
                    severity="warning",
                    message=f"App and reference disagree on {field} beyond tolerance.",
                    timestamp=stamp,
                    timeframe=tf,
                    details={"field": field, "app": left, "reference": right, "tolerance": price_tolerance},
                )
            )
    return issues


def iter_jsonl(path: Path) -> Iterator[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as handle:
        for line_number, line in enumerate(handle, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                value = json.loads(stripped)
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSONL at {path}:{line_number}: {exc}") from exc
            if not isinstance(value, dict):
                raise ValueError(f"Expected object at {path}:{line_number}")
            yield value


def write_jsonl(path: Path, rows: Iterable[Mapping[str, Any]]) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    count = 0
    with path.open("w", encoding="utf-8", newline="\n") as handle:
        for row in rows:
            handle.write(canonical_json(dict(row)) + "\n")
            count += 1
    return count


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
            rejected_rows INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_candles_timestamp ON candles(timestamp);
        """
    )


def infer_timeframe(member_name: str) -> str | None:
    upper = member_name.upper()
    for timeframe in TIMEFRAMES:
        if re.search(rf"(?:^|[_\-.]){re.escape(timeframe)}(?:[_\-.]|$)", upper):
            return timeframe
    return None


def _normalize_headers(fieldnames: Sequence[str] | None) -> dict[str, str]:
    aliases = {
        "datetime": {"datetime", "date", "time", "timestamp"},
        "open": {"open", "o"},
        "high": {"high", "h"},
        "low": {"low", "l"},
        "close": {"close", "c"},
    }
    normalized = {str(name).strip().lower().replace(" ", ""): str(name) for name in (fieldnames or [])}
    result: dict[str, str] = {}
    for canonical, possibilities in aliases.items():
        for possibility in possibilities:
            key = possibility.replace(" ", "")
            if key in normalized:
                result[canonical] = normalized[key]
                break
    return result


def _valid_ohlc(open_: float, high: float, low: float, close: float) -> bool:
    return (
        all(math.isfinite(value) for value in (open_, high, low, close))
        and high >= max(open_, close, low)
        and low <= min(open_, close, high)
        and high >= low
    )


def iter_candles_from_zip(path: Path, *, accepted_years: frozenset[int] = ACCEPTED_YEARS) -> Iterator[Candle]:
    with zipfile.ZipFile(path) as archive:
        for member in archive.namelist():
            if not member.lower().endswith(".csv"):
                continue
            timeframe = infer_timeframe(Path(member).name)
            if not timeframe:
                continue
            with archive.open(member) as raw_handle:
                import io

                text_handle = io.TextIOWrapper(raw_handle, encoding="utf-8-sig", newline="")
                reader = csv.DictReader(text_handle)
                headers = _normalize_headers(reader.fieldnames)
                if set(headers) != {"datetime", "open", "high", "low", "close"}:
                    raise ValueError(f"Unsupported CSV headers in {path.name}:{member}: {reader.fieldnames}")
                for row_number, row in enumerate(reader, start=2):
                    timestamp = normalized_timestamp(row.get(headers["datetime"]))
                    if not timestamp:
                        raise ValueError(f"Invalid timestamp in {path.name}:{member}:{row_number}")
                    parsed = parse_timestamp(timestamp)
                    assert parsed is not None
                    if parsed.year not in accepted_years:
                        continue
                    values = [_finite(row.get(headers[field])) for field in OHLC_FIELDS]
                    if any(value is None for value in values):
                        raise ValueError(f"Invalid OHLC in {path.name}:{member}:{row_number}")
                    open_, high, low, close = (float(value) for value in values)  # type: ignore[arg-type]
                    if not _valid_ohlc(open_, high, low, close):
                        raise ValueError(f"Impossible OHLC in {path.name}:{member}:{row_number}")
                    yield Candle(timeframe, timestamp, open_, high, low, close, path.name, member)


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
            rejected = 0
            with connection:
                for candle in iter_candles_from_zip(path):
                    before = connection.total_changes
                    connection.execute(
                        """
                        INSERT INTO candles(timeframe,timestamp,open,high,low,close,source_archive,source_member)
                        VALUES(?,?,?,?,?,?,?,?)
                        ON CONFLICT(timeframe,timestamp) DO UPDATE SET
                          open=excluded.open,
                          high=excluded.high,
                          low=excluded.low,
                          close=excluded.close,
                          source_archive=excluded.source_archive,
                          source_member=excluded.source_member
                        WHERE candles.open=excluded.open
                          AND candles.high=excluded.high
                          AND candles.low=excluded.low
                          AND candles.close=excluded.close
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
                    changed = connection.total_changes > before
                    if changed:
                        inserted += 1
                    else:
                        rejected += 1
                digest = sha256_file(path)
                connection.execute(
                    """
                    INSERT INTO archive_manifest(archive,sha256,bytes,imported_rows,rejected_rows)
                    VALUES(?,?,?,?,?)
                    ON CONFLICT(archive) DO UPDATE SET
                      sha256=excluded.sha256,
                      bytes=excluded.bytes,
                      imported_rows=excluded.imported_rows,
                      rejected_rows=excluded.rejected_rows
                    """,
                    (str(path.relative_to(data_dir)), digest, path.stat().st_size, inserted, rejected),
                )
            total_inserted += inserted
            archive_results.append({"archive": str(path), "inserted": inserted, "duplicates_or_conflicts": rejected})
    finally:
        connection.close()
    return {"archives": len(archives), "inserted": total_inserted, "database": str(database), "details": archive_results}


def validate_database(database: Path) -> dict[str, Any]:
    connection = sqlite3.connect(database)
    connection.row_factory = sqlite3.Row
    try:
        total = connection.execute("SELECT COUNT(*) AS n FROM candles").fetchone()["n"]
        by_tf = {
            row["timeframe"]: row["n"]
            for row in connection.execute("SELECT timeframe, COUNT(*) AS n FROM candles GROUP BY timeframe ORDER BY timeframe")
        }
        by_year = {
            row["year"]: row["n"]
            for row in connection.execute("SELECT substr(timestamp,1,4) AS year, COUNT(*) AS n FROM candles GROUP BY year ORDER BY year")
        }
        bad_ohlc = connection.execute(
            """
            SELECT COUNT(*) AS n FROM candles
            WHERE high < low OR high < open OR high < close OR low > open OR low > close
            """
        ).fetchone()["n"]
        rejected_year_rows = connection.execute(
            "SELECT COUNT(*) AS n FROM candles WHERE substr(timestamp,1,4)='2026'"
        ).fetchone()["n"]
        duplicate_count = connection.execute(
            """
            SELECT COUNT(*) AS n FROM (
              SELECT timeframe,timestamp,COUNT(*) AS c
              FROM candles GROUP BY timeframe,timestamp HAVING c > 1
            )
            """
        ).fetchone()["n"]
        verdict = "PASS" if total > 0 and bad_ohlc == 0 and rejected_year_rows == 0 and duplicate_count == 0 else "FAIL"
        return {
            "verdict": verdict,
            "database": str(database),
            "total_rows": total,
            "rows_by_timeframe": by_tf,
            "rows_by_year": by_year,
            "bad_ohlc_rows": bad_ohlc,
            "rejected_2026_rows": rejected_year_rows,
            "duplicate_timeframe_timestamp_rows": duplicate_count,
        }
    finally:
        connection.close()

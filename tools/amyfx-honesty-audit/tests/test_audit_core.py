from __future__ import annotations

import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from audit_core import audit_snapshot, compare_snapshots, validate_setup_geometry


class HonestyInvariantTests(unittest.TestCase):
    def test_stale_data_must_force_wait_and_no_setup(self) -> None:
        snapshot = {
            "timeframe": "M15",
            "sourceCandleTime": "2025-01-03T10:15:00Z",
            "dataStale": True,
            "directionDecision": {"source": "DATA_STALE", "signal": "BUY"},
            "directionForecast": {"active": False},
            "setupExecution": {
                "active": True,
                "terminal": False,
                "direction": "BUY",
                "entryLow": 2000,
                "entryHigh": 2001,
                "stopLoss": 1998,
                "target1": 2005,
                "singleTarget": True,
            },
        }
        codes = {issue.code for issue in audit_snapshot(snapshot, now=datetime(2025, 1, 3, 11, tzinfo=timezone.utc))}
        self.assertIn("STALE_DATA_DIRECTION", codes)
        self.assertIn("STALE_DATA_ACTIVE_SETUP", codes)
        self.assertIn("INACTIVE_FORECAST_ACTIVE_SETUP", codes)

    def test_terminal_setup_cannot_be_active(self) -> None:
        snapshot = {
            "timeframe": "M15",
            "sourceCandleTime": "2025-01-03T10:15:00Z",
            "directionForecast": {"active": True, "direction": "BULLISH"},
            "setupExecution": {
                "active": True,
                "terminal": True,
                "direction": "BUY",
                "entryLow": 2000,
                "entryHigh": 2001,
                "stopLoss": 1998,
                "target1": 2005,
                "singleTarget": True,
            },
        }
        codes = {issue.code for issue in audit_snapshot(snapshot, now=datetime(2025, 1, 3, 11, tzinfo=timezone.utc))}
        self.assertIn("TERMINAL_SETUP_ACTIVE", codes)

    def test_score_must_not_be_percentage(self) -> None:
        snapshot = {
            "timeframe": "M15",
            "sourceCandleTime": "2025-01-03T10:15:00Z",
            "directionDecision": {"signal": "WAIT", "status": "BULLISH · VALIDATED FORECAST (87%)"},
            "directionForecast": {"active": False},
            "setupExecution": {"active": False, "terminal": True},
        }
        codes = {issue.code for issue in audit_snapshot(snapshot, now=datetime(2025, 1, 3, 11, tzinfo=timezone.utc))}
        self.assertIn("SCORE_PRESENTED_AS_PROBABILITY", codes)

    def test_valid_snapshot_has_no_issue(self) -> None:
        snapshot = {
            "timeframe": "M15",
            "sourceCandleTime": "2025-01-03T10:15:00Z",
            "dataStale": False,
            "directionDecision": {"source": "VALIDATED_DIRECTION_FORECAST", "signal": "BUY", "status": "BULLISH · VALIDATED FORECAST · SCORE 87/100"},
            "directionForecast": {"active": True, "invalidated": False, "expired": False, "direction": "BULLISH", "confidenceScore": 87},
            "setupExecution": {
                "active": True,
                "terminal": False,
                "direction": "BUY",
                "entryLow": 2000,
                "entryHigh": 2001,
                "stopLoss": 1998,
                "target1": 2005,
                "singleTarget": True,
            },
            "claims": [{"kind": "raw_fvg", "label": "OBSERVATION ONLY"}],
        }
        issues = audit_snapshot(snapshot, now=datetime(2025, 1, 3, 11, tzinfo=timezone.utc))
        self.assertEqual([], issues)

    def test_sell_geometry(self) -> None:
        valid = {
            "direction": "SELL",
            "entryLow": 2000,
            "entryHigh": 2001,
            "stopLoss": 2003,
            "target1": 1995,
            "target2": 1990,
            "singleTarget": False,
        }
        self.assertEqual([], validate_setup_geometry(valid))

    def test_reference_difference_is_reported(self) -> None:
        app = {
            "timeframe": "M15",
            "sourceCandleTime": "2025-01-03T10:15:00Z",
            "directionDecision": {"signal": "BUY"},
            "directionForecast": {"active": True, "direction": "BULLISH"},
            "setupExecution": {"active": False, "direction": "WAIT"},
        }
        reference = {
            "timeframe": "M15",
            "sourceCandleTime": "2025-01-03T10:15:00Z",
            "directionDecision": {"signal": "SELL"},
            "directionForecast": {"active": True, "direction": "BEARISH"},
            "setupExecution": {"active": False, "direction": "WAIT"},
        }
        fields = {issue.details["field"] for issue in compare_snapshots(app, reference) if issue.details}
        self.assertIn("signal", fields)
        self.assertIn("forecastDirection", fields)


if __name__ == "__main__":
    unittest.main()

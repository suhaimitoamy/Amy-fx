# Mapping Signal Conflict Investigation - Debugging Notes

## Overview
Investigation into conflicting signals (Bullish vs Bearish) appearing simultaneously on the same screen. The issue is a failure of **Information Hierarchy**, not mathematical errors.

## Conflict Points & Root Causes

### 1. Header Bias vs. Execution Conclusion
- **Evidence**: `ui-render.js:228` & `market-data.js:124-127`
- **Issue**: Final Bias (HTF based) may show BEARISH, but Setup Execution (short-term bounce) shows BUY. Both appear in the "Penjelasan Mapping" card without clarifying their relationship.
- **Result**: User sees "Arah Utama: Bearish" but "Kesimpulan: FOKUS BUY".

### 2. Mapping Engine vs. Scalper Engine
- **Evidence**: `market-outlook.js:132-144` & `scalper-entry-watch-v1.js`
- **Issue**: Two independent engines run on one screen. Mapping reads current TF (e.g., M15), while Scalper scans IFVG aligned with H1.
- **Result**: A "FOKUS BUY" badge may appear at the top, while a red "SELL" card from the Scalper Engine appears below.

### 3. Historical Events vs. Live Execution
- **Evidence**: `ui-render.js:218`
- **Issue**: System displays the last structural break (e.g., "Qualified CHoCH: BEARISH") regardless of current signal.
- **Result**: A bold "BEARISH" label appears right under a "BUY" recommendation, creating the impression of inconsistency.

### 4. Multi-Timeframe Table Color Clash
- **Evidence**: `ui-render.js:220`
- **Issue**: M1, M5, M15, H1, H4 are rendered as raw Red/Green colors without explaining the fractal relationship (e.g., H4 is main trend, M15 is pullback).
- **Result**: Visual clutter of opposing colors without hierarchy.

### 5. Path vs. Destination Conflict
- **Evidence**: `market-outlook.js:283-291`
- **Issue**: "Arah Perjalanan" (Direction to Target) may be BUY, but "Zona Pantauan" (The Target itself) is a Bearish OB (SELL).
- **Result**: "BUY", "SELL", and "WAIT" appear in the same card, causing confusion.

## 💡 Proposed Architectural Solutions: "Single Unified Verdict"

1. **Unified Text**: Align "Penjelasan Mapping". If HTF is Bearish but local is Buy, label it as "Counter-Trend Retracement BUY" or force a "WAIT".
2. **Labeling**: Clearly label the Scalper engine as `[FAST TRADE: M1-M5]`.
3. **Contextual Labels**: Add `[HISTORICAL]` tags to CHoCH/BOS events to distinguish them from live signals.

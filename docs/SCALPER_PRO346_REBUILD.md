# Pro346: targeted scalper rebuild

## Observed baseline (2026-09-19)

Read-only aggregate of the connected amy-market-data database, global scope, all retained history. Device copies are excluded to avoid counting the same signal repeatedly. WR matches the app: TP_HIT and positive TIME_EXIT are wins; SL_HIT and negative TIME_EXIT are losses. BE, cancellation and invalidation are excluded. R is gross; costs are not available.

| Active driver | Wins | Losses | WR | Gross total R |
|---|---:|---:|---:|---:|
| Discipline Scalper | 2 | 15 | 11.76% | -13.492 |
| AMD | 2 | 4 | 33.33% | -2.366 |
| Range Expansion | 11 | 16 | 40.74% | -5.398 |
| Retest BOS | 3 | 4 | 42.86% | 0.158 |

IFVG_LEGACY (1/13 wins) and FVG_BUY_HIGH_QUALITY (0/1) are archived models absent from the active registry; they remain retired. The other active drivers are unchanged. Small samples do not establish future profitability. Retest BOS illustrates that WR below 50% is not equivalent to negative gross expectancy.

## Replacement rules: STRUCTURAL-2026-09-V1

- Retest BOS: confirmed two-sided swing available before the break; first displaced crossing; first retest within four contiguous source candles. A failed first touch or close through the broken level consumes the setup.
- Range Expansion: compression and displacement followed by a first confirmed retest. No breakout chasing. Broken range or failed retest cancels eligibility.
- AMD: shortest valid accumulation window, one-sided manipulation, subsequent displaced close beyond the manipulation candle and range midpoint, confirmed FVG. Dual-boundary sweeps and broken manipulation extremes are rejected.
- Discipline: completed H4 directional EMA/slope context, complete previous-day/Asia liquidity, sweep followed by a separate displacement confirmation, then liquidity retest limit. The EPSILON-based breakout stop is removed. Nearest opposing liquidity must offer at least 1.5R; no farther target is substituted to force acceptance.

Entry and lifecycle use a versioned adapter, preserving old setups. New entries begin no earlier than the first minute after detection. Next-open waits expire after 15 minutes; limit waits after four source candles capped at four hours. Gap drift beyond 0.25 signal ATR invalidates next-open entry. Structural stop must be on the correct side before the 0.18 ATR buffer. Risk is capped at 50 points; fixed 20-point targets must offer at least 1R. Discipline targets liquidity with at least 1.5R. Geometry is checked again at actual activation.

Intrabar limit fills cannot claim a TP that might precede entry. An ambiguous pre-fill structural breach cancels conservatively. SL precedes TP on subsequent ambiguous bars. Stop gaps are recorded at the worse available open. After a data gap crossing expiry, TIME_EXIT uses the first observed open, explicitly not an invented expiry price.

Existing trade records, old lifecycle policies, other driver versions, user preferences and notification ownership are retained. The live SMR boolean-anchor fix missing from GitHub is synchronized to prevent deployment regression.

## Validation and release

Deterministic tests cover BUY/SELL structure and retests, future/open candles, failed first touch, device kill switches, late entry, risk and gap rejection, conservative fill ordering, expiry and old lifecycle compatibility. These tests verify correctness; they are not a profitability backtest. No improved WR is claimed. New rules require held-out cost-aware replay and forward observation.

Pro346 source: 2.0.0-pro.346 / 950346. The existing signed APK workflow activates update.json only after build, identity, signer, release asset and checksum verification. Existing manifest remains published Pro345 until that gate succeeds.

Validation completed: all 133 JavaScript regression files pass locally, including the new structural cases; Edge entrypoint syntax passes. Supabase scalper-engine deployed as version13. Signed Android build/publication is handled by CI after source publication.

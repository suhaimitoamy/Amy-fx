# Mapping Accuracy V3 — Manual Validation

Date: 2026-07-28

Branch: `personal/amyfx-private`

Scope: Mapping only; no backtest or performance claim.

## Authority and reference hierarchy

Mapping V3 uses the attached trusted indicators by role instead of merging every rule into one score:

1. `AMY_ICT_NextGen` — market state, direction forecast parity, session model, liquidity sweep, structure, and Entry Map foundation.
2. `AMY_Market_Context_Final` / V4 honesty audit — selective FVG/OB formation and accepted-break lifecycle.
3. `AMY_Neo_Wave_Structure_Entry_Map` — swing quality context.
4. Pro S/D, SNR, and Fibonacci indicators — optional confluence only.
5. `ICT_Validated_SMC` — optional inducement/OB quality context.
6. `GCX Matrix` — presentation order: Context → Warning → Entry → Risk.

No UI/runtime helper may create, replace, or mutate a Mapping decision.

## Locked logic

### Closed-candle facts

- Candle facts, structure, liquidity, zones, forecast, and entry lifecycle use closed candles.
- Live price is a provisional overlay. It may update display price, but cannot rewrite a closed-candle fact or terminalize a causal setup.
- A stale asynchronous timeframe request cannot replace the result of a newer selected timeframe.

### Structure and liquidity

- Internal swing: 4 left / 4 right bars.
- Major swing: 6 left / 6 right bars.
- A close-cross is only a candidate until it also passes:
  - penetration at least 0.10 ATR;
  - body at least 0.30 ATR;
  - body/range ratio at least 0.45.
- Only a confirmed displaced break may change structure trend.
- A failed break is evaluated for 12 bars or until the next same-scope break.
- Liquidity tolerance is stored per level at 0.03 ATR.
- A sweep is consumed on its first interaction and cannot reactivate.
- States are distinct: `CLOSED_THROUGH`, `SWEPT_UNCONFIRMED`, and `CONFIRMED_REACTION`.
- A confirmed reaction needs reclaim depth of at least 0.05 ATR.
- PDH/PDL/PWH/PWL become available only after their source period has closed.

### FVG and Order Block

- FVG requires a same-direction third candle with body at least 1.20× the preceding 20-body mean.
- FVG width must be 0.15–0.75 ATR at formation.
- OB requires the immediate opposite candle before a confirmed displaced break.
- OB width must be 0.30–1.50 ATR and the break candle body at least 2.00× the preceding mean body.
- An inverse zone cannot be created from one wick or one close.
- Accepted break requires three consecutive closes outside plus 0.30 ATR continuation.
- IFVG/Breaker becomes active only after accepted break, retest, and inverse rejection.

### Causal Entry Map

Entry is supported on `M1`, `M5`, `M15`, `M30`, `H1`, `H4`, `D1`, and `W1`.

| Entry TF | Context TF | Session gate | Sweep memory | Expiry |
|---|---|---|---:|---:|
| M1 | M5 | London or New York | 36 bars | 48 bars |
| M5 | H4 | London or New York | 36 bars | 48 bars |
| M15 | H4 | London or New York | 12 bars | 36 bars |
| M30 | H4 | London or New York | 12 bars | 36 bars |
| H1 | H4 | New York only | 18 bars | 36 bars |
| H4 | D1 | None | 12 bars | 24 bars |
| D1 | W1 | None | 8 bars | 12 bars |
| W1 | Local weekly structure | None | 6 bars | 8 bars |

Required order:

1. active Direction Forecast;
2. aligned last-closed Context TF (`close` versus EMA20 plus EMA20 slope);
3. directional EMA21/EMA34/EMA90 stack on the trigger timeframe;
4. opposing liquidity sweep after the relevant forecast context;
5. later displaced MSS in the forecast direction;
6. session gate where applicable;
7. valid dealing and trigger-candle close location;
8. first still-available opposing structural liquidity target.

For H1, the confirmed trigger close must also remain within 2.00 ATR of EMA21. Context and EMA gates are evaluated at the trigger candle close; a later HTF candle cannot retroactively validate an earlier entry.

Execution:

- entry is the confirmed MSS candle close on the selected timeframe;
- SL is beyond the protected swing plus 0.50 ATR;
- TP1 is 1R and moves the runner SL to break-even;
- TP2 is the first structural obstacle and must be between 2R and 8R;
- the setup expires by timeframe bar count, not a universal wall-clock duration.

H1 bearish Direction Forecast remains deliberately suppressed because the trusted reference did not validate it. H1 bearish conditions must display `NO CLEAR DIRECTION`, never a forced SELL.

M1, M30, H4, D1, and W1 are explicitly labeled rule-based and require manual validation. They carry no win-probability claim.

## Manual chart checklist

Validate with current/forward closed candles and visual comparison to the trusted indicators. Do not calculate a backtest result from this checklist.

For each timeframe:

- [ ] The newest forming candle is absent from Mapping facts.
- [ ] Reloading the same closed-candle set produces identical structure, liquidity, zones, forecast, and entry.
- [ ] A weak close-cross stays `BREAK_CANDIDATE` and does not flip the trend.
- [ ] A valid BOS/MSS passes all three displacement thresholds.
- [ ] The first liquidity interaction remains consumed after price returns.
- [ ] Wick-only interaction is not labeled a confirmed reaction without the minimum reclaim.
- [ ] FVG/OB boundaries match their formation candle and local ATR.
- [ ] One close outside a zone does not create IFVG/Breaker.
- [ ] Previous-period levels do not appear before the source day/week closes.
- [ ] Entry appears only after sweep → displaced MSS, in that order.
- [ ] Entry-time HTF close/EMA20 slope and local EMA21/34/90 stack align with the entry direction.
- [ ] A context candle that closed after the trigger does not retroactively validate that trigger.
- [ ] H1 trigger is no farther than 2.00 ATR from EMA21.
- [ ] TP2 is the first structural obstacle and at least 2R.
- [ ] After TP1, SL shown by Mapping is break-even while the initial SL remains recorded.
- [ ] SL hit, TP2 hit, TP1/BE, and expiry return the Entry Watch action to `WAIT`.
- [ ] Switching timeframe rapidly never lets an older request overwrite the selected timeframe.

Additional checks:

- [ ] H1 bearish always returns `NO CLEAR DIRECTION`.
- [ ] W1 latest closed candle is anchored to Monday 00:00 UTC.
- [ ] Dashboard, Analyze, Entry Watch, scanner, and notification show the same setup ID and geometry.
- [ ] All user-facing Mapping clocks show WITA.

Record any mismatch with timeframe, candle open time, expected indicator event, actual Mapping event, and a screenshot. Change thresholds only from repeatable reference mismatch evidence, never from isolated trade outcome.

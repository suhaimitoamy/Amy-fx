"""Read-only history audit, NOT candle replay or profitability proof.
Usage: python scripts/audit-discipline-history.py snapshot.json
       python scripts/audit-discipline-history.py --self-check
"""
import collections
import json
import math
import statistics
import sys


def audit(payload):
    if payload.get('ok') is not True or not isinstance(payload.get('history'), list):
        raise ValueError('Expected successful scalper-setups history payload')
    unique = {}
    for row in payload['history']:
        if not isinstance(row, dict) or not row.get('id'):
            raise ValueError('History row missing ID')
        if row['id'] in unique and unique[row['id']] != row:
            raise ValueError('Conflicting duplicate ID')
        unique[row['id']] = row
    rows = [r for r in unique.values() if r.get('symbol') == 'XAU/USD']
    selected = [r for r in rows if r.get('driverId') == 'DISCIPLINE_SCALPER']
    groups = []
    for tf in sorted({r.get('timeframe', '?') for r in selected}):
        subset = [r for r in selected if r.get('timeframe', '?') == tf]
        counts = collections.Counter(r.get('status', '?') for r in subset)
        rr = []
        for r in subset:
            e, s, t = (r.get(k) for k in ('entry', 'initialStopLoss', 'target'))
            if any(isinstance(x, bool) or not isinstance(x, (int, float)) or not math.isfinite(x) for x in (e, s, t)):
                continue
            if r.get('direction') not in ('BUY', 'SELL'):
                continue
            sign = 1 if r['direction'] == 'BUY' else -1
            if (e - s) * sign > 0 and (t - e) * sign > 0:
                rr.append(abs(t - e) / abs(e - s))
        decided = counts['TP_HIT'] + counts['SL_HIT']
        groups.append(dict(timeframe=tf, counts=dict(counts), decided=decided,
                           wr=100 * counts['TP_HIT'] / decided if decided else None,
                           initial_rr_median=statistics.median(rr) if rr else None,
                           initial_rr_n=len(rr)))
    return dict(generated_at=payload.get('generatedAt'), scope=payload.get('deviceScope'),
                mode=payload.get('mode'), total=len(rows), statuses=dict(collections.Counter(r.get('status') for r in rows)),
                discipline_count=len(selected), groups=groups,
                repeated_sl_entry_prices=dict(collections.Counter(str(r['entry']) for r in selected if r.get('status') == 'SL_HIT' and r.get('entry') is not None)),
                at_history_limit=len(unique) >= payload.get('limits', {}).get('history', 2000),
                note='Global scope is not device history. Repeated price is not proof of duplicate market events. RR uses initial SL. No candle replay performed.')


def self_check():
    # Synthetic unit-test data only; never used as market evidence.
    row = dict(id='unit', symbol='XAU/USD', driverId='DISCIPLINE_SCALPER', timeframe='M5',
               status='TP_HIT', direction='BUY', entry=100, initialStopLoss=95, stopLoss=100, target=110)
    p = dict(ok=True, history=[row, row.copy()])
    result = audit(p)
    assert result['total'] == 1 and result['groups'][0]['initial_rr_median'] == 2
    p['history'] = [{**row, 'status': 'CANCELLED', 'initialStopLoss': None}]
    assert audit(p)['groups'][0]['wr'] is None
    p['history'] = [row, {**row, 'status': 'SL_HIT'}]
    try:
        audit(p)
    except ValueError:
        pass
    else:
        raise AssertionError('Conflicting duplicates must fail')
    print('PASS: dedupe, initial SL, no-decided denominator, conflicting duplicates')


if __name__ == '__main__':
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    if sys.argv[1] == '--self-check':
        self_check()
    else:
        with open(sys.argv[1], encoding='utf-8') as handle:
            print(json.dumps(audit(json.load(handle)), indent=2))

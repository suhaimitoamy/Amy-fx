import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  TRADE_SCENARIO_CONFIG,
  detectReactionZones,
  findNearestStrongLiquidity
} from '../app/src/main/assets/apps/mapping/js/outlook/trade-scenario-core.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
const DATA_DIR = process.env.AMYFX_2024_DATA || '/mnt/data/amyfx_2024';
const JSON_PATH = path.join(ROOT, 'docs/backtests/amy-fx-trade-scenarios-2024.json');
const REPORT_PATH = path.join(ROOT, 'docs/backtests/AMY_FX_TRADE_SCENARIOS_2024.md');
const M5_MS = 5 * 60 * 1000;

function parseCsv(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').trim().split(/\r?\n/);
  const header = lines.shift().split(',').map(value => value.trim().toLowerCase());
  const index = Object.fromEntries(header.map((name, position) => [name, position]));
  return lines.map(line => {
    const parts = line.split(',');
    const datetime = parts[index.datetime]?.trim();
    return {
      datetime,
      time: Date.parse(`${datetime.replace(' ', 'T')}Z`),
      open: Number(parts[index.open]),
      high: Number(parts[index.high]),
      low: Number(parts[index.low]),
      close: Number(parts[index.close])
    };
  }).filter(candle => Number.isFinite(candle.time)
    && Number.isFinite(candle.open)
    && Number.isFinite(candle.high)
    && Number.isFinite(candle.low)
    && Number.isFinite(candle.close));
}

function loadTf(tf) {
  const pattern = new RegExp(`^XAUUSD_${tf}_.*_2024\\.csv$`, 'i');
  const files = fs.readdirSync(DATA_DIR).filter(name => pattern.test(name));
  if (files.length !== 12) throw new Error(`Expected 12 ${tf} files, found ${files.length}.`);
  const byTime = new Map();
  for (const file of files) {
    for (const candle of parseCsv(path.join(DATA_DIR, file))) byTime.set(candle.time, candle);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function lowerBound(values, target) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (values[middle] < target) left = middle + 1;
    else right = middle;
  }
  return left;
}

function upperBound(values, target) {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const middle = (left + right) >> 1;
    if (values[middle] <= target) left = middle + 1;
    else right = middle;
  }
  return left;
}

function didSweep(candles, side, touchIndex, lookback) {
  if (touchIndex < lookback) return false;
  const previous = candles.slice(touchIndex - lookback, touchIndex);
  return side === 'BUY'
    ? candles[touchIndex].low < Math.min(...previous.map(item => item.low))
    : candles[touchIndex].high > Math.max(...previous.map(item => item.high));
}

function firstTouch(candles, atr, zone, endIndex, settings) {
  const lastIndex = Math.min(endIndex, zone.createdIndex + settings.zoneExpiryBars);
  for (let index = zone.createdIndex + 1; index <= lastIndex; index += 1) {
    const candle = candles[index];
    const atrValue = atr[index] || zone.originAtr;
    if (zone.side === 'BUY' && candle.close < zone.bottom - settings.invalidationAtr * atrValue) return null;
    if (zone.side === 'SELL' && candle.close > zone.top + settings.invalidationAtr * atrValue) return null;
    if (candle.low <= zone.top && candle.high >= zone.bottom) return index;
  }
  return null;
}

function confirmation(candles, atr, zone, touchIndex, endIndex, settings) {
  const lastIndex = Math.min(endIndex, touchIndex + settings.confirmationBars);
  for (let index = touchIndex; index <= lastIndex; index += 1) {
    const candle = candles[index];
    const atrValue = atr[index] || zone.originAtr;
    const body = candle.close - candle.open;
    const range = candle.high - candle.low;
    if (!(atrValue > 0) || !(range > 0)) continue;
    if (zone.side === 'BUY'
      && candle.close > zone.top
      && body > 0
      && body >= settings.confirmationBodyAtr * atrValue
      && body / range >= settings.confirmationBodyRatio) return index;
    if (zone.side === 'SELL'
      && candle.close < zone.bottom
      && body < 0
      && -body >= settings.confirmationBodyAtr * atrValue
      && -body / range >= settings.confirmationBodyRatio) return index;
  }
  return null;
}

function findM1Entry({ side, entry, stopLoss, startTime, endTime, m1, m1Times }) {
  const start = lowerBound(m1Times, startTime);
  const end = lowerBound(m1Times, endTime);
  for (let index = start; index < end; index += 1) {
    const candle = m1[index];
    const touched = candle.low <= entry && candle.high >= entry;
    if (touched) return index;
    const invalidated = side === 'BUY' ? candle.low <= stopLoss : candle.high >= stopLoss;
    if (invalidated) return null;
  }
  return null;
}

function evaluateEntry({ side, entry, stopLoss, takeProfit1, takeProfit2, entryIndex, endTime, m1, m1Times }) {
  const endIndex = lowerBound(m1Times, endTime);
  let tp1Reached = false;
  let mfe = 0;
  let mae = 0;
  let outcomeIndex = Math.max(entryIndex, endIndex - 1);

  for (let index = entryIndex; index < endIndex; index += 1) {
    const candle = m1[index];
    const stopTouched = side === 'BUY' ? candle.low <= stopLoss : candle.high >= stopLoss;
    const tp1Touched = side === 'BUY' ? candle.high >= takeProfit1 : candle.low <= takeProfit1;
    const tp2Touched = side === 'BUY' ? candle.high >= takeProfit2 : candle.low <= takeProfit2;
    mfe = Math.max(mfe, side === 'BUY' ? candle.high - entry : entry - candle.low);
    mae = Math.max(mae, side === 'BUY' ? entry - candle.low : candle.high - entry);

    if (stopTouched) {
      return {
        outcome: tp1Reached ? 'TP1_THEN_SL' : 'SL',
        tp1Reached,
        tp2Reached: false,
        immediateStop: index === entryIndex,
        outcomeIndex: index,
        mfe,
        mae
      };
    }
    if (tp1Touched) tp1Reached = true;
    if (tp2Touched) {
      return {
        outcome: 'TP2',
        tp1Reached: true,
        tp2Reached: true,
        immediateStop: false,
        outcomeIndex: index,
        mfe,
        mae
      };
    }
  }

  return {
    outcome: tp1Reached ? 'TP1_EXPIRY' : 'EXPIRY',
    tp1Reached,
    tp2Reached: false,
    immediateStop: false,
    outcomeIndex,
    mfe,
    mae
  };
}

function buildCandidates(m5, m1, settings) {
  const detected = detectReactionZones(m5, settings);
  const candles = detected.candles;
  const atr = detected.atr;
  const m5Times = candles.map(item => item.time);
  const m1Times = m1.map(item => item.time);
  const candidates = [];
  const flow = {
    qualifiedFreshFvg: detected.zones.length,
    firstTouch: 0,
    confirmedReaction: 0,
    riskEligible: 0,
    liquidityRoomEligible: 0,
    entryFilled: 0
  };

  for (const zone of detected.zones) {
    const setupEndIndex = Math.min(candles.length - 1, zone.createdIndex + settings.zoneExpiryBars);
    const touchIndex = firstTouch(candles, atr, zone, setupEndIndex, settings);
    if (touchIndex === null) continue;
    flow.firstTouch += 1;

    const confirmationIndex = confirmation(candles, atr, zone, touchIndex, setupEndIndex, settings);
    if (confirmationIndex === null) continue;
    flow.confirmedReaction += 1;

    const entry = zone.midpoint;
    const atrValue = atr[confirmationIndex] || zone.originAtr;
    const stopLoss = zone.side === 'BUY'
      ? zone.bottom - settings.stopBufferAtr * atrValue
      : zone.top + settings.stopBufferAtr * atrValue;
    const risk = Math.abs(entry - stopLoss);
    if (risk < settings.minimumRiskPoints || risk > settings.maximumRiskPoints) continue;
    flow.riskEligible += 1;

    const liquidity = findNearestStrongLiquidity({
      candles,
      side: zone.side,
      entry,
      risk,
      knownIndex: confirmationIndex,
      strength: settings.liquidityPivotStrength,
      lookback: settings.liquidityLookbackBars
    });
    if (!liquidity || liquidity.roomR < settings.minimumLiquidityRoomR) continue;
    flow.liquidityRoomEligible += 1;

    const entryWindowEndIndex = Math.min(setupEndIndex, confirmationIndex + settings.entryWaitBars);
    if (confirmationIndex + 1 > entryWindowEndIndex) continue;
    const entryMinuteIndex = findM1Entry({
      side: zone.side,
      entry,
      stopLoss,
      startTime: candles[confirmationIndex + 1].time,
      endTime: candles[entryWindowEndIndex].time + M5_MS,
      m1,
      m1Times
    });
    if (entryMinuteIndex === null) continue;
    flow.entryFilled += 1;

    const sign = zone.side === 'BUY' ? 1 : -1;
    const takeProfit1 = entry + sign * risk * settings.tp1R;
    const takeProfit2 = entry + sign * risk * settings.tp2R;
    const entryM5Index = Math.max(0, upperBound(m5Times, m1[entryMinuteIndex].time) - 1);
    const tradeEndIndex = Math.min(candles.length - 1, entryM5Index + settings.tradeValidityBars);
    const evaluation = evaluateEntry({
      side: zone.side,
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      entryIndex: entryMinuteIndex,
      endTime: candles[tradeEndIndex].time + M5_MS,
      m1,
      m1Times
    });

    const sweep = didSweep(candles, zone.side, touchIndex, settings.sweepLookbackBars);
    candidates.push({
      side: zone.side,
      setupType: sweep ? 'LIQUIDITY_SWEEP_FVG_REACTION' : 'FVG_FIRST_TOUCH_REACTION',
      quality: sweep ? 'A' : 'B',
      zoneCreatedIndex: zone.createdIndex,
      touchIndex,
      confirmationIndex,
      entryMinuteIndex,
      outcomeMinuteIndex: evaluation.outcomeIndex,
      entryTime: new Date(m1[entryMinuteIndex].time).toISOString(),
      outcomeTime: new Date(m1[evaluation.outcomeIndex].time).toISOString(),
      month: new Date(m1[entryMinuteIndex].time).toISOString().slice(0, 7),
      entry,
      stopLoss,
      takeProfit1,
      takeProfit2,
      risk,
      liquidityTarget: liquidity.level,
      liquidityRoomR: liquidity.roomR,
      outcome: evaluation.outcome,
      tp1Reached: evaluation.tp1Reached,
      tp2Reached: evaluation.tp2Reached,
      immediateStop: evaluation.immediateStop,
      mfeR: risk > 0 ? evaluation.mfe / risk : 0,
      maeR: risk > 0 ? evaluation.mae / risk : 0
    });
  }

  return { candidates, flow, candles };
}

function selectNonOverlapping(candidates, m5) {
  const times = m5.map(item => item.time);
  const sorted = [...candidates].sort((a, b) =>
    a.entryMinuteIndex - b.entryMinuteIndex
    || a.zoneCreatedIndex - b.zoneCreatedIndex
  );
  const selected = [];
  let lastOutcomeM5Index = -1;

  for (const candidate of sorted) {
    if (candidate.touchIndex <= lastOutcomeM5Index || candidate.confirmationIndex <= lastOutcomeM5Index) continue;
    selected.push(candidate);
    const outcomeTime = Date.parse(candidate.outcomeTime);
    lastOutcomeM5Index = Math.max(lastOutcomeM5Index, upperBound(times, outcomeTime) - 1);
  }
  return selected;
}

function pct(value, total) {
  return total ? Number((value / total * 100).toFixed(2)) : 0;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarize(records) {
  const total = records.length;
  const count = predicate => records.filter(predicate).length;
  const tp1Reached = count(item => item.tp1Reached);
  const tp2Reached = count(item => item.tp2Reached);
  const stoppedBeforeTp1 = count(item => item.outcome === 'SL');
  const tp1ThenStopped = count(item => item.outcome === 'TP1_THEN_SL');
  const risks = records.map(item => item.risk);
  return {
    entries: total,
    buyEntries: count(item => item.side === 'BUY'),
    sellEntries: count(item => item.side === 'SELL'),
    gradeAEntries: count(item => item.quality === 'A'),
    tp1Reached,
    tp1Rate: pct(tp1Reached, total),
    tp2Reached,
    tp2Rate: pct(tp2Reached, total),
    stoppedBeforeTp1,
    stoppedBeforeTp1Rate: pct(stoppedBeforeTp1, total),
    tp1ThenStopped,
    tp1ThenStoppedRate: pct(tp1ThenStopped, total),
    immediateStop: count(item => item.immediateStop),
    immediateStopRate: pct(count(item => item.immediateStop), total),
    expiry: count(item => item.outcome === 'EXPIRY' || item.outcome === 'TP1_EXPIRY'),
    averageRiskPoints: total ? Number((risks.reduce((sum, value) => sum + value, 0) / total).toFixed(3)) : 0,
    medianRiskPoints: Number(median(risks).toFixed(3)),
    expectancyAtTp1R: total
      ? Number(((tp1Reached * TRADE_SCENARIO_CONFIG.tp1R - stoppedBeforeTp1) / total).toFixed(3))
      : 0,
    expectancyAtTp2R: total
      ? Number(((tp2Reached * TRADE_SCENARIO_CONFIG.tp2R - stoppedBeforeTp1 - tp1ThenStopped) / total).toFixed(3))
      : 0,
    medianMfeR: Number(median(records.map(item => item.mfeR)).toFixed(3))
  };
}

function monthTable(monthly) {
  return Object.entries(monthly).map(([month, item]) =>
    `| ${month} | ${item.entries} | ${item.buyEntries} | ${item.sellEntries} | ${item.tp1Rate.toFixed(2)}% | ${item.tp2Rate.toFixed(2)}% | ${item.expectancyAtTp2R.toFixed(3)}R |`
  ).join('\n');
}

function sampleTable(records) {
  const indexes = Array.from({ length: 10 }, (_, index) => Math.round(index * (records.length - 1) / 9));
  return indexes.map((recordIndex, position) => {
    const item = records[recordIndex];
    return `| ${position + 1} | ${item.entryTime.slice(0, 16).replace('T', ' ')} UTC | ${item.side} | ${item.quality} | ${item.entry.toFixed(2)} | ${item.stopLoss.toFixed(2)} | ${item.takeProfit1.toFixed(2)} | ${item.takeProfit2.toFixed(2)} | ${item.outcome} |`;
  }).join('\n');
}

const m5 = loadTf('M5');
const m1 = loadTf('M1');
const built = buildCandidates(m5, m1, TRADE_SCENARIO_CONFIG);
const records = selectNonOverlapping(built.candidates, built.candles);
const overall = summarize(records);
const gradeA = summarize(records.filter(item => item.quality === 'A'));
const monthly = Object.fromEntries(
  [...new Set(records.map(item => item.month))].sort()
    .map(month => [month, summarize(records.filter(item => item.month === month))])
);
const development = summarize(records.filter(item => item.entryTime < '2024-09-01T00:00:00.000Z'));
const validation = summarize(records.filter(item => item.entryTime >= '2024-09-01T00:00:00.000Z'));
const costStress = Object.fromEntries([0.10, 0.15, 0.20, 0.25, 0.30].map(cost => {
  const averageCostR = records.length
    ? records.reduce((sum, item) => sum + cost / item.risk, 0) / records.length
    : 0;
  return [cost.toFixed(2), Number((overall.expectancyAtTp2R - averageCostR).toFixed(3))];
}));

const result = {
  status: 'FINAL_BACKTEST_M5_REACTION_FIRST_2024',
  generatedAt: new Date().toISOString(),
  methodology: {
    dataset: 'XAU/USD M5 signal logic with M1 execution resolution, January–December 2024',
    m5Candles: m5.length,
    m1Candles: m1.length,
    firstCandleUtc: new Date(m5[0].time).toISOString(),
    lastCandleUtc: new Date(m5.at(-1).time).toISOString(),
    noLookahead: true,
    signalTimeframe: 'M5 only',
    executionResolution: 'M1 is used only to order entry, SL, and TP touches.',
    costs: 'Spread, slippage, commission, news, and broker execution are not modeled in raw results.'
  },
  config: TRADE_SCENARIO_CONFIG,
  flow: built.flow,
  overall,
  gradeA,
  developmentJanAug: development,
  validationSepDec: validation,
  costStressTp2R: costStress,
  monthly,
  examples: records.length ? Array.from({ length: 10 }, (_, index) => records[Math.round(index * (records.length - 1) / 9)]) : [],
  audit: {
    rawRecordsSha256: crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex')
  }
};

const report = `# Amy FX — Backtest M5 Reaction First 2024

> **Status:** iterasi baru setelah logika breakout/retest dan stop-order dinyatakan gagal.  
> **Periode:** XAU/USD Januari–Desember 2024.  
> **Signal:** seluruh keputusan setup memakai M5. M1 hanya dipakai untuk menyelesaikan urutan entry, SL, dan TP.

## Logika yang diuji

1. Cari **fresh FVG M5** yang diciptakan displacement valid.
2. Gunakan **first touch** saja; zona yang invalid atau kedaluwarsa dibuang.
3. Tunggu candle M5 close rejection kembali keluar dari FVG.
4. Entry pada **50% FVG** maksimal 5 candle M5 setelah konfirmasi.
5. SL berada di luar FVG + buffer 0,12 ATR.
6. Setup hanya dipakai bila jarak risiko **0,60–4,00 poin**.
7. Nearest strong liquidity harus menyediakan ruang minimal **2R**.
8. TP1 = **1,5R**, TP2 = **2R**.
9. Jika first touch sekaligus menyapu liquidity 5 candle, setup diberi **Grade A**.
10. Tidak ada posisi tumpang tindih. Jika SL dan TP tersentuh pada menit yang sama, SL dihitung lebih dahulu.

## Arus deteksi

| Tahap | Jumlah |
|---|---:|
| Fresh FVG berkualitas | ${built.flow.qualifiedFreshFvg} |
| Mendapat first touch | ${built.flow.firstTouch} |
| Mendapat rejection M5 | ${built.flow.confirmedReaction} |
| Lolos batas risiko | ${built.flow.riskEligible} |
| Lolos ruang liquidity 2R | ${built.flow.liquidityRoomEligible} |
| Pending entry tersentuh | ${built.flow.entryFilled} |
| **Entry final non-overlap** | **${overall.entries}** |

## Hasil keseluruhan

| Metrik | Hasil |
|---|---:|
| Entry | ${overall.entries} |
| Buy / Sell | ${overall.buyEntries} / ${overall.sellEntries} |
| Grade A | ${overall.gradeAEntries} |
| **TP1 1,5R** | **${overall.tp1Reached}/${overall.entries} = ${overall.tp1Rate.toFixed(2)}%** |
| **TP2 2R** | **${overall.tp2Reached}/${overall.entries} = ${overall.tp2Rate.toFixed(2)}%** |
| SL sebelum TP1 | ${overall.stoppedBeforeTp1}/${overall.entries} = ${overall.stoppedBeforeTp1Rate.toFixed(2)}% |
| TP1 lalu kembali ke SL | ${overall.tp1ThenStopped}/${overall.entries} = ${overall.tp1ThenStoppedRate.toFixed(2)}% |
| SL langsung pada menit entry | ${overall.immediateStop}/${overall.entries} = ${overall.immediateStopRate.toFixed(2)}% |
| Rata-rata / median risiko | ${overall.averageRiskPoints.toFixed(3)} / ${overall.medianRiskPoints.toFixed(3)} poin |
| Ekspektasi TP1 sebelum biaya | **${overall.expectancyAtTp1R.toFixed(3)}R/entry** |
| Ekspektasi TP2 sebelum biaya | **${overall.expectancyAtTp2R.toFixed(3)}R/entry** |

## Grade A — FVG + sweep liquidity

| Metrik | Hasil |
|---|---:|
| Entry | ${gradeA.entries} |
| TP1 1,5R | ${gradeA.tp1Rate.toFixed(2)}% |
| TP2 2R | ${gradeA.tp2Rate.toFixed(2)}% |
| Ekspektasi TP2 | ${gradeA.expectancyAtTp2R.toFixed(3)}R/entry |

## Pemisahan pengembangan dan validasi

| Bagian | Entry | TP1 | TP2 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|
| Jan–Agu 2024 | ${development.entries} | ${development.tp1Rate.toFixed(2)}% | ${development.tp2Rate.toFixed(2)}% | ${development.expectancyAtTp2R.toFixed(3)}R |
| Sep–Des 2024 | ${validation.entries} | ${validation.tp1Rate.toFixed(2)}% | ${validation.tp2Rate.toFixed(2)}% | ${validation.expectancyAtTp2R.toFixed(3)}R |

## Stress biaya terhadap model TP2

| Biaya pulang-pergi | Ekspektasi setelah pengurang biaya |
|---|---:|
${Object.entries(costStress).map(([cost, expectancy]) => `| ${cost} poin | ${expectancy.toFixed(3)}R |`).join('\n')}

## Hasil bulanan

| Bulan | Entry | Buy | Sell | TP1 | TP2 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|---:|---:|
${monthTable(monthly)}

## Sepuluh contoh entry

| No. | Entry | Sisi | Grade | Harga entry | SL | TP1 | TP2 | Hasil |
|---:|---|---|---|---:|---:|---:|---:|---|
${sampleTable(records)}

## Kesimpulan

Logika M5 Reaction First menghasilkan lebih sedikit entry daripada stop-order massal, tetapi kualitasnya lebih baik. Hasil mentah tetap positif pada bagian validasi Sep–Des 2024. Namun edge menjadi sangat tipis pada asumsi biaya sekitar 0,25 poin dan negatif di atasnya. Karena itu hasil ini **belum menjadi bukti final untuk live trading** dan masih perlu pengujian tahun lain serta biaya broker nyata.

## Audit

- M5: **${m5.length.toLocaleString('id-ID')} candle**.
- M1: **${m1.length.toLocaleString('id-ID')} candle**.
- SHA-256 raw records: \`${result.audit.rawRecordsSha256}\`.
`;

fs.writeFileSync(JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(REPORT_PATH, report);
console.log(JSON.stringify(result, null, 2));

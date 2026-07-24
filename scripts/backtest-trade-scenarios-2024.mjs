import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  TRADE_SCENARIO_CONFIG,
  buildTradeScenarios
} from '../app/src/main/assets/apps/mapping/js/outlook/trade-scenario-core.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PATCH_ROOT = path.resolve(SCRIPT_DIR, '..');
const DATA_DIR = process.env.AMYFX_2024_DATA || '/mnt/data/amyfx_2024';
const JSON_PATH = path.join(PATCH_ROOT, 'docs/backtests/amy-fx-trade-scenarios-2024.json');
const REPORT_PATH = path.join(PATCH_ROOT, 'docs/backtests/AMY_FX_TRADE_SCENARIOS_2024.md');
const WARMUP_BARS = 299;

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

function loadM15() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(name => /^XAUUSD_M15_.*_2024\.csv$/i.test(name))
    .sort((a, b) => {
      const first = parseCsv(path.join(DATA_DIR, a))[0]?.time || 0;
      const second = parseCsv(path.join(DATA_DIR, b))[0]?.time || 0;
      return first - second;
    });
  if (files.length !== 12) throw new Error(`Expected 12 M15 files, found ${files.length}.`);
  const byTime = new Map();
  for (const file of files) {
    for (const candle of parseCsv(path.join(DATA_DIR, file))) byTime.set(candle.time, candle);
  }
  return [...byTime.values()].sort((a, b) => a.time - b.time);
}

function monthKey(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 7);
}

function iso(timestamp) {
  return new Date(timestamp).toISOString();
}

function selectBreakout(built, candles, startIndex, expiryIndex) {
  const buy = built.scenarios.find(item => item.side === 'BUY');
  const sell = built.scenarios.find(item => item.side === 'SELL');
  for (let index = startIndex; index <= expiryIndex; index += 1) {
    const candle = candles[index];
    if (candle.close > buy.entry) return { scenario: buy, index };
    if (candle.close < sell.entry) return { scenario: sell, index };
  }
  return null;
}

function findRetest(selection, candles, expiryIndex) {
  const scenario = selection.scenario;
  const lastIndex = Math.min(expiryIndex, selection.index + Number(scenario.retestBars || 0));
  for (let index = selection.index + 1; index <= lastIndex; index += 1) {
    const candle = candles[index];
    if (candle.low <= scenario.entry && candle.high >= scenario.entry) {
      return { scenario, index };
    }
  }
  return null;
}

function evaluateEntry(entry, candles, expiryIndex) {
  const scenario = entry.scenario;
  let tp1Reached = false;
  let tp2Reached = false;
  let stopReached = false;
  let outcomeIndex = expiryIndex;

  for (let index = entry.index; index <= expiryIndex; index += 1) {
    const candle = candles[index];
    const stopTouched = scenario.side === 'BUY'
      ? candle.low <= scenario.stopLoss
      : candle.high >= scenario.stopLoss;
    const tp1Touched = scenario.side === 'BUY'
      ? candle.high >= scenario.takeProfit1
      : candle.low <= scenario.takeProfit1;
    const tp2Touched = scenario.side === 'BUY'
      ? candle.high >= scenario.takeProfit2
      : candle.low <= scenario.takeProfit2;

    if (stopTouched) {
      stopReached = true;
      outcomeIndex = index;
      break;
    }
    if (tp1Touched) tp1Reached = true;
    if (tp2Touched) {
      tp1Reached = true;
      tp2Reached = true;
      outcomeIndex = index;
      break;
    }
  }

  return {
    tp1Reached,
    tp2Reached,
    stopReached,
    stoppedBeforeTp1: stopReached && !tp1Reached,
    tp1ThenStopped: stopReached && tp1Reached && !tp2Reached,
    tp1OnlyAtExpiry: tp1Reached && !tp2Reached && !stopReached,
    noTp1OrStop: !tp1Reached && !stopReached,
    outcomeIndex
  };
}

function pct(value, total) {
  return total ? Number((value / total * 100).toFixed(2)) : 0;
}

function wilson(successes, total, z = 1.959963984540054) {
  if (!total) return [0, 0];
  const p = successes / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const margin = z * Math.sqrt((p * (1 - p) + z * z / (4 * total)) / total) / denominator;
  return [
    Number(((center - margin) * 100).toFixed(2)),
    Number(((center + margin) * 100).toFixed(2))
  ];
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function summarize(records) {
  const total = records.length;
  const count = key => records.filter(item => item[key]).length;
  const tp1Reached = count('tp1Reached');
  const tp2Reached = count('tp2Reached');
  const stoppedBeforeTp1 = count('stoppedBeforeTp1');
  const tp1ThenStopped = count('tp1ThenStopped');
  const risks = records.map(item => item.risk);
  return {
    entries: total,
    buyEntries: records.filter(item => item.side === 'BUY').length,
    sellEntries: records.filter(item => item.side === 'SELL').length,
    tp1Reached,
    tp1Rate: pct(tp1Reached, total),
    tp1Ci95: wilson(tp1Reached, total),
    tp2Reached,
    tp2Rate: pct(tp2Reached, total),
    tp2Ci95: wilson(tp2Reached, total),
    stoppedBeforeTp1,
    stoppedBeforeTp1Rate: pct(stoppedBeforeTp1, total),
    tp1ThenStopped,
    tp1ThenStoppedRate: pct(tp1ThenStopped, total),
    tp1OnlyAtExpiry: count('tp1OnlyAtExpiry'),
    tp1OnlyAtExpiryRate: pct(count('tp1OnlyAtExpiry'), total),
    noTp1OrStop: count('noTp1OrStop'),
    noTp1OrStopRate: pct(count('noTp1OrStop'), total),
    averageRiskPoints: total ? Number((risks.reduce((sum, value) => sum + value, 0) / total).toFixed(2)) : 0,
    medianRiskPoints: Number(median(risks).toFixed(2)),
    expectancyAtTp1R: total
      ? Number(((tp1Reached * TRADE_SCENARIO_CONFIG.tp1R - stoppedBeforeTp1) / total).toFixed(3))
      : 0,
    expectancyAtTp2R: total
      ? Number(((tp2Reached * TRADE_SCENARIO_CONFIG.tp2R - stoppedBeforeTp1 - tp1ThenStopped) / total).toFixed(3))
      : 0
  };
}

function tableMonthly(monthly) {
  const rows = Object.entries(monthly).map(([month, item]) =>
    `| ${month} | ${item.entries} | ${item.buyEntries} | ${item.sellEntries} | ${item.tp1Rate.toFixed(2)}% | ${item.tp2Rate.toFixed(2)}% | ${item.expectancyAtTp1R.toFixed(3)}R | ${item.expectancyAtTp2R.toFixed(3)}R |`
  );
  return [
    '| Bulan | Entry | Buy | Sell | TP1 1,5R | TP2 2R | Ekspektasi TP1 | Ekspektasi TP2 |',
    '|---|---:|---:|---:|---:|---:|---:|---:|',
    ...rows
  ].join('\n');
}

function sampleTable(records) {
  const indexes = Array.from({ length: 10 }, (_, index) => Math.round(index * (records.length - 1) / 9));
  const rows = indexes.map((recordIndex, position) => {
    const item = records[recordIndex];
    const outcome = item.tp2Reached ? 'TP2'
      : item.tp1ThenStopped ? 'TP1 lalu SL'
        : item.tp1OnlyAtExpiry ? 'TP1 lalu expiry'
          : item.stoppedBeforeTp1 ? 'SL'
            : 'Expiry';
    return `| ${position + 1} | ${item.entryTime.slice(0, 16).replace('T', ' ')} UTC | ${item.side} | ${item.entry.toFixed(2)} | ${item.stopLoss.toFixed(2)} | ${item.takeProfit1.toFixed(2)} | ${item.takeProfit2.toFixed(2)} | ${outcome} |`;
  });
  return [
    '| No. | Entry | Sisi | Harga entry | Stop | TP1 | TP2 | Hasil |',
    '|---:|---|---|---:|---:|---:|---:|---|',
    ...rows
  ].join('\n');
}

const candles = loadM15();
const records = [];
let setupIndex = WARMUP_BARS;
let armedSetups = 0;
let breakouts = 0;
let noBreakout = 0;
let breakoutWithoutRetest = 0;

while (setupIndex < candles.length - TRADE_SCENARIO_CONFIG.validityBars - 2) {
  armedSetups += 1;
  const history = candles.slice(0, setupIndex + 1);
  const built = buildTradeScenarios({
    candles: history,
    price: candles[setupIndex].close,
    now: candles[setupIndex].time
  });
  if (built.status !== 'READY') {
    setupIndex += 1;
    continue;
  }

  const expiryIndex = Math.min(
    candles.length - 1,
    setupIndex + TRADE_SCENARIO_CONFIG.validityBars
  );
  const breakout = selectBreakout(built, candles, setupIndex + 1, expiryIndex);
  if (!breakout) {
    noBreakout += 1;
    setupIndex = expiryIndex + 1;
    continue;
  }
  breakouts += 1;

  const entry = findRetest(breakout, candles, expiryIndex);
  if (!entry) {
    breakoutWithoutRetest += 1;
    setupIndex = expiryIndex + 1;
    continue;
  }

  const evaluation = evaluateEntry(entry, candles, expiryIndex);
  const scenario = entry.scenario;
  records.push({
    setupTime: iso(candles[setupIndex].time),
    breakoutTime: iso(candles[breakout.index].time),
    entryTime: iso(candles[entry.index].time),
    outcomeTime: iso(candles[evaluation.outcomeIndex].time),
    month: monthKey(candles[entry.index].time),
    side: scenario.side,
    entry: scenario.entry,
    stopLoss: scenario.stopLoss,
    takeProfit1: scenario.takeProfit1,
    takeProfit2: scenario.takeProfit2,
    risk: scenario.risk,
    ...evaluation
  });
  setupIndex = evaluation.outcomeIndex + 1;
}

const overall = summarize(records);
const monthly = Object.fromEntries(
  [...new Set(records.map(item => item.month))]
    .sort()
    .map(month => [month, summarize(records.filter(item => item.month === month))])
);
const bySide = Object.fromEntries(
  ['BUY', 'SELL'].map(side => [side, summarize(records.filter(item => item.side === side))])
);
const rawHash = crypto.createHash('sha256')
  .update(JSON.stringify(records))
  .digest('hex');

const result = {
  status: 'FINAL_BACKTEST_DUAL_SCENARIO_RETEST_RR_2024',
  generatedAt: new Date().toISOString(),
  methodology: {
    dataset: 'XAU/USD M15 January–December 2024',
    candleCount: candles.length,
    firstCandleUtc: iso(candles[0].time),
    lastCandleUtc: iso(candles.at(-1).time),
    warmupBars: WARMUP_BARS,
    setupScheduling: 'Sequential non-overlapping: a new setup is armed after the prior trade resolves or its validity expires.',
    ocoActivation: 'First M15 close beyond Buy/Sell breakout level selects the side and cancels the opposite side.',
    retestEntry: 'Selected side must retest the planned entry during the next 8 M15 candles.',
    fill: 'Planned retest level.',
    evaluation: 'Entry candle through original 32-bar setup expiry.',
    intrabarConflict: 'Stop-first conservative ordering, including the retest entry candle.',
    spreadSlippageCommission: 'Not modeled.',
    news: 'Not modeled.'
  },
  config: TRADE_SCENARIO_CONFIG,
  setupFlow: {
    armedSetups,
    breakouts,
    noBreakout,
    breakoutWithoutRetest,
    entries: records.length,
    entryRateFromArmed: pct(records.length, armedSetups),
    entryRateFromBreakout: pct(records.length, breakouts)
  },
  overall,
  bySide,
  monthly,
  audit: { rawRecordsSha256: rawHash }
};

const report = `# Amy FX — Backtest Saran Level RR Sehat 2024

> **Status:** final untuk iterasi RR 1:1,5 dan 1:2.  
> **Periode:** XAU/USD Januari–Desember 2024.  
> **Versi aplikasi dan jalur rilis tidak diubah.**

## Perubahan aturan

- Dua skenario OCO tetap tersedia: Buy dan Sell.
- Resistance/support memakai ekstrem **32 candle M15 tertutup** terakhir.
- Sisi dipilih setelah close M15 melewati level breakout dengan buffer **0,05 ATR**.
- Entry tidak dikejar pada candle breakout. Harga wajib **retest level entry maksimal 8 candle M15**.
- Stop Loss berada **1 ATR** di balik resistance/support asal.
- TP1 = **1,5R**.
- TP2 = **2R**.
- Setup berlaku **32 candle M15 / 8 jam**.
- Setelah trade selesai atau setup kedaluwarsa, setup baru langsung dipersenjatai. Tidak ada trade yang tumpang tindih.
- Tidak ada look-ahead. Pada konflik intrabar, termasuk candle retest, **stop dihitung lebih dahulu**.

## Arus setup

| Metrik | Hasil |
|---|---:|
| Setup dipersenjatai | ${armedSetups} |
| Breakout/breakdown terjadi | ${breakouts} |
| Tidak ada breakout | ${noBreakout} |
| Breakout tanpa retest | ${breakoutWithoutRetest} |
| **Entry valid** | **${records.length}** |
| Entry dari seluruh setup | ${pct(records.length, armedSetups).toFixed(2)}% |
| Entry setelah breakout | ${pct(records.length, breakouts).toFixed(2)}% |

Dibanding iterasi lama yang menghasilkan 524 entry aktif, iterasi ini menghasilkan **${records.length} entry**, bertambah **${records.length - 524} entry atau ${pct(records.length - 524, 524).toFixed(2)}%** tanpa membuka dua posisi yang saling berlawanan secara bersamaan.

## Hasil keseluruhan

| Metrik | Hasil |
|---|---:|
| Entry | ${overall.entries} |
| Buy | ${overall.buyEntries} |
| Sell | ${overall.sellEntries} |
| **TP1 1,5R tercapai** | **${overall.tp1Reached}/${overall.entries} = ${overall.tp1Rate.toFixed(2)}%** |
| Wilson 95% CI TP1 | ${overall.tp1Ci95[0].toFixed(2)}–${overall.tp1Ci95[1].toFixed(2)}% |
| **TP2 2R tercapai** | **${overall.tp2Reached}/${overall.entries} = ${overall.tp2Rate.toFixed(2)}%** |
| Wilson 95% CI TP2 | ${overall.tp2Ci95[0].toFixed(2)}–${overall.tp2Ci95[1].toFixed(2)}% |
| Stop sebelum TP1 | ${overall.stoppedBeforeTp1}/${overall.entries} = ${overall.stoppedBeforeTp1Rate.toFixed(2)}% |
| TP1 lalu stop sebelum TP2 | ${overall.tp1ThenStopped}/${overall.entries} = ${overall.tp1ThenStoppedRate.toFixed(2)}% |
| TP1 lalu expiry tanpa TP2/SL | ${overall.tp1OnlyAtExpiry}/${overall.entries} = ${overall.tp1OnlyAtExpiryRate.toFixed(2)}% |
| Tidak menyentuh TP1 atau SL | ${overall.noTp1OrStop}/${overall.entries} = ${overall.noTp1OrStopRate.toFixed(2)}% |
| Rata-rata jarak risiko | ${overall.averageRiskPoints.toFixed(2)} poin |
| Median jarak risiko | ${overall.medianRiskPoints.toFixed(2)} poin |
| Ekspektasi target TP1 sebelum biaya | **${overall.expectancyAtTp1R.toFixed(3)}R/entry** |
| Ekspektasi target TP2 sebelum biaya | **${overall.expectancyAtTp2R.toFixed(3)}R/entry** |

## Hasil per sisi

| Sisi | Entry | TP1 1,5R | TP2 2R | Ekspektasi TP1 | Ekspektasi TP2 |
|---|---:|---:|---:|---:|---:|
| Buy | ${bySide.BUY.entries} | ${bySide.BUY.tp1Rate.toFixed(2)}% | ${bySide.BUY.tp2Rate.toFixed(2)}% | ${bySide.BUY.expectancyAtTp1R.toFixed(3)}R | ${bySide.BUY.expectancyAtTp2R.toFixed(3)}R |
| Sell | ${bySide.SELL.entries} | ${bySide.SELL.tp1Rate.toFixed(2)}% | ${bySide.SELL.tp2Rate.toFixed(2)}% | ${bySide.SELL.expectancyAtTp1R.toFixed(3)}R | ${bySide.SELL.expectancyAtTp2R.toFixed(3)}R |

## Konsistensi per bulan

${tableMonthly(monthly)}

Jumlah entry bulanan berada pada rentang **${Math.min(...Object.values(monthly).map(item => item.entries))}–${Math.max(...Object.values(monthly).map(item => item.entries))} entry**. Frekuensi entry relatif terjaga, tetapi hasil tidak merata: beberapa bulan masih negatif. Karena pengujian hanya memakai 2024, angka ini belum boleh dianggap edge final lintas rezim.

## Sepuluh contoh entry nyata

${sampleTable(records)}

## Kesimpulan

- Frekuensi entry tidak berkurang: **524 → ${records.length}**.
- RR sudah diperbaiki menjadi **TP1 1:1,5** dan **TP2 1:2**.
- Hit rate memang turun dibanding target lama yang terlalu dekat, tetapi ekspektasi matematis awal menjadi **positif ${overall.expectancyAtTp1R.toFixed(3)}R–${overall.expectancyAtTp2R.toFixed(3)}R per entry sebelum biaya**.
- Edge masih tipis dan tidak konsisten setiap bulan. Spread, slippage, komisi, news, serta eksekusi broker dapat menghapus keunggulan tersebut.

## Batasan

- Spread, slippage, komisi, dan perbedaan eksekusi broker belum dimodelkan.
- News historis tidak dimasukkan.
- Ini merupakan backtest in-sample pada 2024 dan belum divalidasi pada tahun lain.
- Ekspektasi TP1 menganggap posisi ditutup penuh di 1,5R. Ekspektasi TP2 menganggap posisi ditutup penuh di 2R; trade yang mencapai TP1 lalu kembali ke SL dihitung rugi untuk model TP2.

## Audit

- Jumlah candle M15: **${candles.length.toLocaleString('id-ID')}**.
- Rentang UTC: **${iso(candles[0].time)} — ${iso(candles.at(-1).time)}**.
- SHA-256 raw records: \`${rawHash}\`.
`;

fs.mkdirSync(path.dirname(JSON_PATH), { recursive: true });
fs.writeFileSync(JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(REPORT_PATH, report);
console.log(JSON.stringify(result, null, 2));

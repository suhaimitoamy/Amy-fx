import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  TRADE_SCENARIO_CONFIG,
  activateTradeScenario,
  buildTradeScenarios
} from '../app/src/main/assets/apps/mapping/js/outlook/trade-scenario-core.js';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PATCH_ROOT = path.resolve(SCRIPT_DIR, '..');
const DATA_DIR = process.env.AMYFX_2024_DATA || '/mnt/data/amyfx_2024';
const JSON_PATH = path.join(PATCH_ROOT, 'docs/backtests/amy-fx-trade-scenarios-2024.json');
const REPORT_PATH = path.join(PATCH_ROOT, 'docs/backtests/AMY_FX_TRADE_SCENARIOS_2024.md');
const WARMUP_BARS = 299;
const SNAPSHOT_STEP = TRADE_SCENARIO_CONFIG.validityBars;

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

function triggerScenario(built, future) {
  const buy = built.scenarios.find(item => item.side === 'BUY');
  const sell = built.scenarios.find(item => item.side === 'SELL');
  for (let offset = 0; offset < future.length; offset += 1) {
    const candle = future[offset];
    if (candle.close > buy.entry) {
      return { scenario: activateTradeScenario(buy, candle.close), triggerOffset: offset, triggerTime: candle.time };
    }
    if (candle.close < sell.entry) {
      return { scenario: activateTradeScenario(sell, candle.close), triggerOffset: offset, triggerTime: candle.time };
    }
  }
  return null;
}

function evaluateActivated(activation, future) {
  const scenario = activation.scenario;
  let tp1Reached = false;
  let tp2Reached = false;
  let stopReached = false;
  let stopBeforeTp1 = false;
  let tp1ThenStop = false;
  let outcomeTime = null;
  const afterTrigger = future.slice(activation.triggerOffset + 1);

  for (const candle of afterTrigger) {
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
      stopBeforeTp1 = !tp1Reached;
      tp1ThenStop = tp1Reached && !tp2Reached;
      outcomeTime = candle.time;
      break;
    }
    if (tp1Touched) tp1Reached = true;
    if (tp2Touched) {
      tp1Reached = true;
      tp2Reached = true;
      outcomeTime = candle.time;
      break;
    }
  }

  return {
    tp1Reached,
    tp2Reached,
    stopReached,
    stopBeforeTp1,
    tp1ThenStop,
    noTp1OrStop: !tp1Reached && !stopReached,
    tp1OnlyAtExpiry: tp1Reached && !tp2Reached && !stopReached,
    unresolvedBeforeTp2: !tp2Reached && !stopReached,
    outcomeTime
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
  return [Number(((center - margin) * 100).toFixed(2)), Number(((center + margin) * 100).toFixed(2))];
}

function summarize(records) {
  const activated = records.filter(item => item.activated);
  const count = key => activated.filter(item => item[key]).length;
  return {
    snapshots: records.length,
    activated: activated.length,
    activationRate: pct(activated.length, records.length),
    buyActivations: activated.filter(item => item.side === 'BUY').length,
    sellActivations: activated.filter(item => item.side === 'SELL').length,
    noTrigger: records.filter(item => !item.activated).length,
    tp1Reached: count('tp1Reached'),
    tp1Rate: pct(count('tp1Reached'), activated.length),
    tp1Ci95: wilson(count('tp1Reached'), activated.length),
    tp2Reached: count('tp2Reached'),
    tp2Rate: pct(count('tp2Reached'), activated.length),
    tp2Ci95: wilson(count('tp2Reached'), activated.length),
    stoppedBeforeTp1: count('stopBeforeTp1'),
    stoppedBeforeTp1Rate: pct(count('stopBeforeTp1'), activated.length),
    tp1ThenStopped: count('tp1ThenStop'),
    tp1ThenStoppedRate: pct(count('tp1ThenStop'), activated.length),
    noTp1OrStop: count('noTp1OrStop'),
    noTp1OrStopRate: pct(count('noTp1OrStop'), activated.length),
    tp1OnlyAtExpiry: count('tp1OnlyAtExpiry'),
    tp1OnlyAtExpiryRate: pct(count('tp1OnlyAtExpiry'), activated.length),
    unresolvedBeforeTp2: count('unresolvedBeforeTp2'),
    unresolvedBeforeTp2Rate: pct(count('unresolvedBeforeTp2'), activated.length)
  };
}

function tableMonthly(monthly) {
  const rows = Object.entries(monthly).map(([month, item]) =>
    `| ${month} | ${item.snapshots} | ${item.activated} | ${item.activationRate.toFixed(2)}% | ${item.tp1Rate.toFixed(2)}% | ${item.tp2Rate.toFixed(2)}% | ${item.stoppedBeforeTp1Rate.toFixed(2)}% |`
  );
  return ['| Bulan | Snapshot | Aktif | Aktivasi | TP1 | TP2 | Stop sebelum TP1 |', '|---|---:|---:|---:|---:|---:|---:|', ...rows].join('\n');
}

const candles = loadM15();
const records = [];
for (let index = WARMUP_BARS; index < candles.length - SNAPSHOT_STEP - 2; index += SNAPSHOT_STEP) {
  const history = candles.slice(0, index + 1);
  const future = candles.slice(index + 1, index + SNAPSHOT_STEP + 1);
  const snapshotTime = candles[index].time;
  const built = buildTradeScenarios({ candles: history, price: candles[index].close, now: snapshotTime });
  if (built.status !== 'READY') continue;
  const activation = triggerScenario(built, future);
  if (!activation) {
    records.push({ snapshotTime, month: monthKey(snapshotTime), activated: false });
    continue;
  }
  const evaluation = evaluateActivated(activation, future);
  records.push({
    snapshotTime,
    month: monthKey(snapshotTime),
    activated: true,
    side: activation.scenario.side,
    triggerTime: activation.triggerTime,
    entry: activation.scenario.entry,
    stopLoss: activation.scenario.stopLoss,
    takeProfit1: activation.scenario.takeProfit1,
    takeProfit2: activation.scenario.takeProfit2,
    ...evaluation
  });
}

const overall = summarize(records);
const monthly = Object.fromEntries(
  [...new Set(records.map(item => item.month))].sort().map(month => [month, summarize(records.filter(item => item.month === month))])
);
const rawHash = crypto.createHash('sha256').update(JSON.stringify(records)).digest('hex');
const result = {
  status: 'FINAL_BACKTEST_DUAL_CONDITIONAL_SCENARIOS_2024',
  generatedAt: new Date().toISOString(),
  methodology: {
    dataset: 'XAU/USD M15 January–December 2024',
    candleCount: candles.length,
    firstCandleUtc: new Date(candles[0].time).toISOString(),
    lastCandleUtc: new Date(candles.at(-1).time).toISOString(),
    warmupBars: WARMUP_BARS,
    snapshotStepBars: SNAPSHOT_STEP,
    noLookahead: true,
    ocoActivation: 'First M15 close above Buy entry or below Sell entry activates; opposite scenario is cancelled.',
    fill: 'Actual trigger candle close.',
    evaluation: 'From the candle after trigger until the original 32-bar validity window ends.',
    intrabarConflict: 'Stop-first conservative ordering.',
    spreadSlippageCommission: 'Not modeled.',
    news: 'Not modeled.'
  },
  config: TRADE_SCENARIO_CONFIG,
  overall,
  monthly,
  audit: { rawRecordsSha256: rawHash }
};

const report = `# Amy FX — Backtest Saran Level Dua Skenario 2024

> **Status:** final untuk pengecekan awal akurasi desain Saran Level.  
> **Periode:** XAU/USD Januari–Desember 2024.  
> **Versi aplikasi dan jalur rilis tidak diubah.**

## Aturan yang diuji

- Timeframe pemicu: **M15**.
- Resistance dan support: ekstrem **32 candle M15 tertutup** terakhir.
- Buy aktif setelah candle M15 close di atas resistance + **0,05 ATR**.
- Sell aktif setelah candle M15 close di bawah support − **0,05 ATR**.
- Skenario pertama yang aktif membatalkan sisi berlawanan.
- Fill memakai harga close candle pemicu.
- Stop struktural memakai padding **0,75 ATR**.
- TP1 = **0,5R** dan TP2 = **1,0R**.
- Masa berlaku: **32 candle M15 / 8 jam**.
- Snapshot tidak tumpang tindih dan memakai warm-up **299 candle tertutup**.
- Tidak ada look-ahead. Jika stop dan target tersentuh dalam candle yang sama, stop dihitung lebih dahulu.

## Hasil keseluruhan

| Metrik | Hasil |
|---|---:|
| Snapshot | ${overall.snapshots} |
| Skenario aktif | ${overall.activated} |
| Tingkat aktivasi | ${overall.activationRate.toFixed(2)}% |
| Buy aktif | ${overall.buyActivations} |
| Sell aktif | ${overall.sellActivations} |
| Tidak ada trigger | ${overall.noTrigger} |
| **TP1 tercapai sebelum stop** | **${overall.tp1Reached} / ${overall.activated} = ${overall.tp1Rate.toFixed(2)}%** |
| Wilson 95% CI TP1 | ${overall.tp1Ci95[0].toFixed(2)}–${overall.tp1Ci95[1].toFixed(2)}% |
| **TP2 tercapai sebelum stop** | **${overall.tp2Reached} / ${overall.activated} = ${overall.tp2Rate.toFixed(2)}%** |
| Wilson 95% CI TP2 | ${overall.tp2Ci95[0].toFixed(2)}–${overall.tp2Ci95[1].toFixed(2)}% |
| Stop sebelum TP1 | ${overall.stoppedBeforeTp1} / ${overall.activated} = ${overall.stoppedBeforeTp1Rate.toFixed(2)}% |
| TP1 lalu stop sebelum TP2 | ${overall.tp1ThenStopped} / ${overall.activated} = ${overall.tp1ThenStoppedRate.toFixed(2)}% |
| Tidak menyentuh TP1 maupun SL sampai expiry | ${overall.noTp1OrStop} / ${overall.activated} = ${overall.noTp1OrStopRate.toFixed(2)}% |
| TP1 tercapai lalu expiry tanpa TP2/SL | ${overall.tp1OnlyAtExpiry} / ${overall.activated} = ${overall.tp1OnlyAtExpiryRate.toFixed(2)}% |

## Hasil per bulan

${tableMonthly(monthly)}

## Kesimpulan

Desain dua skenario kondisional lebih terukur daripada Outlook arah tunggal pada data 2024. Skenario tidak menebak sisi sebelum market memilih; sistem menunggu close M15 valid. Dengan definisi TP1 0,5R, tingkat keberhasilan awal adalah **${overall.tp1Rate.toFixed(2)}%**. Untuk TP2 1,0R, hasilnya **${overall.tp2Rate.toFixed(2)}%**.

## Batasan

- Spread, slippage, komisi, dan perbedaan eksekusi broker belum dimodelkan.
- News historis tidak dimasukkan.
- Pengujian ini memakai M15 saja dan mengevaluasi level kondisional, bukan profitabilitas akun.
- TP1 0,5R dan TP2 1,0R adalah aturan tetap yang dikunci sebelum hasil dibaca.

## Audit

- Jumlah candle M15: **${candles.length.toLocaleString('id-ID')}**.
- Rentang UTC: **${new Date(candles[0].time).toISOString()} — ${new Date(candles.at(-1).time).toISOString()}**.
- SHA-256 raw records: \`${rawHash}\`.
`;

fs.writeFileSync(JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
fs.writeFileSync(REPORT_PATH, report);
console.log(JSON.stringify(result, null, 2));

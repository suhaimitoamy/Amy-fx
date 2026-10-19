import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const code = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/journal/journal-export.js'), 'utf8');

function loadModule(extraWindow = {}) {
  const context = {
    console,
    Blob: class MockBlob {
      constructor(content, options) {
        this.content = content;
        this.options = options;
      }
    },
    URL: {
      createObjectURL: () => 'blob:mock-url',
      revokeObjectURL: () => {}
    },
    document: {
      createElement: () => ({ click() {} })
    },
    setTimeout: (fn) => setTimeout(fn, 0),
    window: { ...extraWindow }
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.window.AmyJournalExport;
}

const AmyJournalExport = loadModule();

test('1. toObsidianMarkdown generates proper frontmatter and structured trade parameters', () => {
  const sampleTrade = {
    id: 'JRN-20261019-001',
    date: '2026-10-19',
    pair: 'XAU/USD',
    timeframe: 'M15',
    setupType: 'FVG + Liquidity Sweep',
    setupScore: 85,
    htfBias: 'BULLISH',
    actualEntryPrice: 2724.50,
    stopLoss: 2719.50,
    takeProfit1: 2734.50,
    takeProfit2: 2744.50,
    riskReward: '1:2.0',
    result: 'WIN',
    exitPrice: 2734.50,
    pnlPips: 100,
    pnlMoney: 500,
    followedPlan: true,
    planNote: 'London Killzone sweep of Asian Low followed by M15 displacement',
    lesson: 'Disiplin menunggu konfirmasi CE 50% memberikan R:R maksimal'
  };

  const md = AmyJournalExport.toObsidianMarkdown(sampleTrade);
  assert.ok(md.startsWith('---'), 'Must start with YAML frontmatter');
  assert.match(md, /id: "JRN-20261019-001"/);
  assert.match(md, /pair: "XAU\/USD"/);
  assert.match(md, /result: "WIN"/);
  assert.match(md, /score: 85/);
  assert.match(md, /- trading_journal/);
  assert.match(md, /- ict/);
  assert.match(md, /## 📊 Detail Parameter Eksekusi/);
  assert.match(md, /2724\.5/);
  assert.match(md, /2719\.5/);
  assert.match(md, /2734\.5/);
  assert.match(md, /London Killzone sweep of Asian Low/);
  assert.match(md, /#trading_journal #ict #fvg #mss #liquidity_sweep #a_plus_setup/);
});

test('2. personalNoteToObsidianMarkdown generates clean reflection note with frontmatter', () => {
  const note = {
    id: 'NOTE-101',
    date: '2026-10-19',
    title: 'Evaluasi Mental Pasca Libur Weekend',
    content: 'Fokus tetap tenang dan tidak terburu-buru membuka posisi di jam pembukaan sesi Asia.'
  };

  const md = AmyJournalExport.personalNoteToObsidianMarkdown(note);
  assert.ok(md.startsWith('---'));
  assert.match(md, /title: "Evaluasi Mental Pasca Libur Weekend"/);
  assert.match(md, /- catatan_pribadi/);
  assert.match(md, /- psikologi_trading/);
  assert.match(md, /# 📓 Evaluasi Mental Pasca Libur Weekend/);
  assert.match(md, /Fokus tetap tenang/);
});

test('3. syncToObsidian routes to native Android bridge or downloads markdown', () => {
  const journals = [{ id: 'J1', pair: 'XAU/USD', result: 'WIN', setupScore: 80 }];
  const notes = [{ id: 'N1', title: 'Catatan 1', content: 'Isi 1' }];

  let savedName = null;
  let savedContent = null;
  const nativeAmyExport = loadModule({
    Android: {
      saveObsidianMarkdown: (fname, cnt) => {
        savedName = fname;
        savedContent = cnt;
        return true;
      }
    }
  });

  const result = nativeAmyExport.syncToObsidian(journals, notes);
  assert.equal(result.ok, true);
  assert.equal(result.count, 2);
  assert.equal(result.target, 'native');
  assert.ok(savedName.includes('Obsidian-Trading-Journal-Sync'));
  assert.match(savedContent, /Total Trade: \*\*1\*\*/);
});

test('4. MainActivity.kt contains saveObsidianMarkdown and markdown mimeType', () => {
  const content = fs.readFileSync(path.join(ROOT, 'app/src/main/java/com/amyelitesuite/MainActivity.kt'), 'utf8');
  assert.match(content, /fun saveObsidianMarkdown\(filename: String, content: String\): Boolean/);
  assert.match(content, /Obsidian\/Catatan Pribadi\/Trading Journal/);
  assert.match(content, /filename\.endsWith\("\.md", ignoreCase = true\) -> "text\/markdown"/);
});

test('5. journal index.html and app.js have Obsidian sync button listeners', () => {
  const html = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/journal/index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'app/src/main/assets/apps/journal/app.js'), 'utf8');

  assert.match(html, /id="syncObsidianBtn"/);
  assert.match(html, /id="syncNotesObsidianBtn"/);
  assert.match(appJs, /syncObsidianBtn.*addEventListener/);
  assert.match(appJs, /syncToObsidian/);
});

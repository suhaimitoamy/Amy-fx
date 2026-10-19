const PREFERRED_KEYS = [
  'id', 'analysisTime', 'date', 'pair', 'symbol', 'timeframe', 'platform',
  'htfBias', 'setupType', 'setupScore', 'entryArea', 'stopLoss',
  'takeProfit1', 'takeProfit2', 'takeProfit3', 'riskReward', 'actualEntryTime', 'actualEntryPrice', 'lotSize',
  'result', 'exitPrice', 'pnlPips', 'pnlMoney',
  'followedPlan', 'rating', 'mistake', 'lesson', 'planNote',
  'screenshot', 'screenshotUrl', 'createdAt', 'updatedAt'
];

const AmyJournalExport = {
  getOrderedKeys(entries) {
    if (!Array.isArray(entries) || !entries.length) return [];
    const allKeys = new Set(entries.flatMap(e => Object.keys(e || {})));
    const ordered = [];
    // 1. Prioritize preferred structured columns
    for (const key of PREFERRED_KEYS) {
      if (allKeys.has(key)) {
        ordered.push(key);
        allKeys.delete(key);
      }
    }
    // 2. Append all remaining custom user fields
    for (const remainingKey of allKeys) {
      ordered.push(remainingKey);
    }
    return ordered;
  },

  toCsv(entries) {
    if (!Array.isArray(entries) || !entries.length) return '';
    const keys = this.getOrderedKeys(entries);
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [keys.join(','), ...entries.map(row => keys.map(k => esc(row?.[k])).join(','))].join('\n');
  },

  downloadCsv(entries, filename = 'amyfx-journal.csv') {
    const csv = this.toCsv(entries);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 15000);
  },

  toJsonBackup(entries, metadata = {}) {
    const list = Array.isArray(entries) ? entries : [];
    return JSON.stringify({
      schemaVersion: 'amyfx-journal-backup-v2',
      app: 'Amy FX Pro Journal',
      exportedAt: new Date().toISOString(),
      totalEntries: list.length,
      metadata: {
        client: 'Amy FX Suite',
        platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
        ...metadata
      },
      entries: list
    }, null, 2);
  },

  downloadJsonBackup(entries, filename = `amyfx-journal-backup-${new Date().toISOString().slice(0, 10)}.json`, metadata = {}) {
    const jsonStr = this.toJsonBackup(entries, metadata);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 15000);
  },

  parseAndValidateBackup(jsonString) {
    try {
      const parsed = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'Data backup bukan objek JSON yang valid.' };
      }
      let rawEntries = [];
      if (Array.isArray(parsed)) {
        rawEntries = parsed;
      } else if (Array.isArray(parsed.entries)) {
        rawEntries = parsed.entries;
      } else if (Array.isArray(parsed.journals)) {
        rawEntries = parsed.journals;
      } else if (Array.isArray(parsed.items)) {
        rawEntries = parsed.items;
      } else {
        return { ok: false, error: 'Format backup tidak mengandung daftar entri jurnal yang valid.' };
      }
      return {
        ok: true,
        count: rawEntries.length,
        schemaVersion: parsed.schemaVersion || 'legacy-v1',
        exportedAt: parsed.exportedAt || null,
        metadata: parsed.metadata || {},
        entries: rawEntries
      };
    } catch (e) {
      return { ok: false, error: `Gagal mem-parsing file backup JSON: ${e.message}` };
    }
  },

  parseCsv(csvString) {
    if (!csvString || typeof csvString !== 'string') return [];
    const text = csvString.replace(/^\uFEFF/, '').trim();
    if (!text) return [];

    const rows = [];
    let currentRow = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentField);
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField);
        currentField = '';
        if (currentRow.some(cell => cell.trim().length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
      } else {
        currentField += char;
      }
    }
    if (currentField.length > 0 || currentRow.length > 0) {
      currentRow.push(currentField);
      if (currentRow.some(cell => cell.trim().length > 0)) {
        rows.push(currentRow);
      }
    }

    if (rows.length < 2) return [];
    const headers = rows[0].map(h => h.trim());
    const entries = [];

    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const entry = {};
      for (let c = 0; c < headers.length; c++) {
        const key = headers[c];
        if (key) {
          entry[key] = row[c] !== undefined ? row[c] : '';
        }
      }
      entries.push(entry);
    }
    return entries;
  },

  computeFingerprint(entry) {
    if (!entry || typeof entry !== 'object') return '';
    const time = String(entry.actualEntryTime || entry.date || entry.createdAt || entry.analysisTime || '').trim();
    const sym = String(entry.pair || entry.symbol || 'XAU/USD').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const entryPrice = Number(entry.actualEntryPrice || entry.entryArea || entry.entry || 0).toFixed(2);
    const sl = Number(entry.stopLoss || entry.sl || 0).toFixed(2);
    return `${time}::${sym}::${entryPrice}::${sl}`;
  },

  reconcileJournals(existingJournals, importedEntries) {
    const existing = Array.isArray(existingJournals) ? existingJournals : [];
    const incoming = Array.isArray(importedEntries) ? importedEntries : [];

    const existingIds = new Set(existing.map(j => j && j.id).filter(Boolean));
    const existingFps = new Set(existing.map(j => this.computeFingerprint(j)).filter(Boolean));

    const added = [];
    let skippedCount = 0;

    for (const raw of incoming) {
      if (!raw || typeof raw !== 'object') {
        skippedCount++;
        continue;
      }
      const entry = { ...raw };
      const fp = this.computeFingerprint(entry);

      const isDuplicate = (entry.id && existingIds.has(entry.id)) || (fp && existingFps.has(fp));
      if (isDuplicate) {
        skippedCount++;
        continue;
      }

      if (!entry.id) {
        entry.id = 'JRN-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
      }
      if (!entry.createdAt) {
        entry.createdAt = Date.now();
      }
      if (!entry.updatedAt) {
        entry.updatedAt = Date.now();
      }

      existingIds.add(entry.id);
      if (fp) existingFps.add(fp);
      added.push(entry);
    }

    return {
      added,
      skippedCount,
      totalImported: incoming.length,
      merged: [...existing, ...added]
    };
  },

  toObsidianMarkdown(entry) {
    if (!entry || typeof entry !== 'object') return '';
    const pair = String(entry.pair || entry.symbol || 'XAU/USD').toUpperCase();
    const date = entry.date || entry.analysisTime || new Date().toISOString().slice(0, 10);
    const result = (entry.result || 'PENDING').toUpperCase();
    const setupType = entry.setupType || 'ICT Setup';
    const setupScore = entry.setupScore !== undefined ? entry.setupScore : '—';
    const tagSetup = String(setupType).toLowerCase().replace(/[^a-z0-9]/g, '_');
    const tagResult = result.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const entryPrice = entry.actualEntryPrice || entry.entryArea || entry.entry || '—';
    const sl = entry.stopLoss || entry.sl || '—';
    const tp1 = entry.takeProfit1 || entry.tp1 || '—';
    const tp2 = entry.takeProfit2 || entry.tp2 || '';
    const rr = entry.riskReward || entry.rr || '1:2.0';
    const pips = entry.pnlPips !== undefined ? entry.pnlPips : '0';
    const money = entry.pnlMoney !== undefined ? entry.pnlMoney : '0';
    const planFollowed = entry.followedPlan === true || entry.followedPlan === 'true' || entry.followedPlan === 1 || entry.followedPlan === '1' || entry.followedPlan === 'yes';

    return `---
id: "${entry.id || ''}"
date: "${date}"
pair: "${pair}"
timeframe: "${entry.timeframe || 'M15'}"
setup: "${setupType}"
score: ${Number(setupScore) || 0}
result: "${result}"
rr: "${rr}"
pnl_pips: ${Number(pips) || 0}
pnl_money: ${Number(money) || 0}
tags:
  - trading_journal
  - ict
  - amyfx
  - ${tagSetup || 'general_setup'}
  - ${tagResult || 'pending'}
---

# Jurnal Trade: ${pair} · ${date} [${result}]

## 📊 Detail Parameter Eksekusi
| Parameter | Nilai |
| :--- | :--- |
| **Pair / Simbol** | ${pair} (${entry.timeframe || 'M15'}) |
| **Tipe Setup** | ${setupType} (Skor: ${setupScore}/100) |
| **HTF Bias** | ${entry.htfBias || 'NEUTRAL'} |
| **Entry Price** | ${entryPrice} |
| **Stop Loss** | ${sl} |
| **Take Profit 1** | ${tp1} |
| **Take Profit 2** | ${tp2 || '—'} |
| **Risk : Reward** | ${rr} |
| **Lot Size** | ${entry.lotSize || '—'} |
| **Hasil Akhir** | **${result}** |
| **Exit Price** | ${entry.exitPrice || '—'} |
| **P&L Pips** | ${pips} pips |
| **P&L Moneter** | $${money} |

## 🧠 Refleksi Psikologi & Catatan
- **Kepatuhan Plan:** ${planFollowed ? '✅ Sesuai SOP Trading' : '⚠️ Melenceng dari SOP'}
- **Catatan Analisis:**
${entry.planNote ? `  ${entry.planNote}` : '  *(Tidak ada catatan khusus)*'}
- **Kesalahan / Mistake:**
${entry.mistake ? `  ${entry.mistake}` : '  *(Tidak ada kesalahan fatal)*'}
- **Pelajaran Berharga / Lesson:**
${entry.lesson ? `  ${entry.lesson}` : '  *(Pertahankan eksekusi probabilitas tinggi)*'}

## 🏷️ Tag Pencarian ICT
#trading_journal #ict #fvg #mss #liquidity_sweep #a_plus_setup #${tagSetup} #${tagResult}
`;
  },

  personalNoteToObsidianMarkdown(note) {
    if (!note || typeof note !== 'object') return '';
    const date = note.date || new Date().toISOString().slice(0, 10);
    const title = note.title || 'Catatan Pribadi Trader';
    return `---
id: "${note.id || ''}"
date: "${date}"
title: "${title.replace(/"/g, '\\"')}"
tags:
  - catatan_pribadi
  - psikologi_trading
  - refleksi_diri
  - amyfx
---

# 📓 ${title}
*Tanggal: ${date}*

${note.content || note.text || '*(Catatan kosong)*'}

---
#catatan_pribadi #psikologi_trading #refleksi_diri #amyfx
`;
  },

  syncToObsidian(journals = [], personalNotes = []) {
    const tradeList = Array.isArray(journals) ? journals : [];
    const noteList = Array.isArray(personalNotes) ? personalNotes : [];
    const totalCount = tradeList.length + noteList.length;

    if (totalCount === 0) {
      return { ok: false, count: 0, message: 'Tidak ada catatan atau jurnal untuk disinkronkan.' };
    }

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `Obsidian-Trading-Journal-Sync-${timestamp}.md`;

    const sections = [];
    sections.push(`---
title: "Amy FX Trading Journal & Catatan Pribadi"
exportedAt: "${new Date().toISOString()}"
totalTrades: ${tradeList.length}
totalNotes: ${noteList.length}
tags:
  - trading_journal
  - catatan_pribadi
  - ict_mastery
  - obsidian_sync
---

# 📓 Amy FX Suite — Obsidian Catatan Pribadi Sync
> Dokumen ini disinkronkan otomatis dari aplikasi Amy FX Pro ke vault Obsidian Catatan Pribadi.
- Total Trade: **${tradeList.length}**
- Total Catatan Refleksi: **${noteList.length}**
- Waktu Sinkronisasi: **${new Date().toLocaleString('id-ID')}**
`);

    if (tradeList.length > 0) {
      sections.push(`## 📈 Histori Transaksi & Jurnal ICT\n`);
      for (const trade of tradeList) {
        sections.push(this.toObsidianMarkdown(trade));
      }
    }

    if (noteList.length > 0) {
      sections.push(`## 📝 Catatan Pribadi & Refleksi Psikologi\n`);
      for (const note of noteList) {
        sections.push(this.personalNoteToObsidianMarkdown(note));
      }
    }

    const fullMarkdown = sections.join('\n\n---\n\n');

    if (typeof window !== 'undefined' && typeof window.Android?.saveObsidianMarkdown === 'function') {
      const ok = window.Android.saveObsidianMarkdown(filename, fullMarkdown);
      return { ok, count: totalCount, filename, target: 'native' };
    }

    this.downloadMarkdown(fullMarkdown, filename);
    return { ok: true, count: totalCount, filename, target: 'download' };
  },

  downloadMarkdown(content, filename = 'amyfx-journal.md') {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 15000);
  }
};

if (typeof window !== 'undefined') {
  window.AmyJournalExport = AmyJournalExport;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AmyJournalExport;
}

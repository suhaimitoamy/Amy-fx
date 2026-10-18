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
  }
};

if (typeof window !== 'undefined') {
  window.AmyJournalExport = AmyJournalExport;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AmyJournalExport;
}

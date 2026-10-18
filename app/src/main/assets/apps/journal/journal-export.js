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
  }
};

if (typeof window !== 'undefined') {
  window.AmyJournalExport = AmyJournalExport;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AmyJournalExport;
}

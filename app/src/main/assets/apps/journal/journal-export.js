window.AmyJournalExport = {
  toCsv(entries){
    if (!Array.isArray(entries) || !entries.length) return '';
    const keys = Array.from(new Set(entries.flatMap(e => Object.keys(e || {}))));
    const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
    return [keys.join(','), ...entries.map(row => keys.map(k => esc(row?.[k])).join(','))].join('\n');
  },
  downloadCsv(entries, filename='amyfx-journal.csv'){
    const csv = this.toCsv(entries);
    const blob = new Blob([csv], {type:'text/csv'});
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

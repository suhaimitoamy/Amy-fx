function normalizeResult(res) {
  const s = String(res || '').trim().toUpperCase();
  if (s === 'WIN') return 'Win';
  if (s === 'LOSS') return 'Loss';
  if (s === 'BREAKEVEN' || s === 'BE') return 'Breakeven';
  return null;
}

window.AmyJournalAnalytics = {
  normalizeResult,
  analyze(entries){
    const list = Array.isArray(entries) ? entries : [];
    const closed = list.map(x => ({ entry: x, result: normalizeResult(x.result) }))
                       .filter(x => x.result !== null);
    const wins = closed.filter(x => x.result === 'Win').length;
    const losses = closed.filter(x => x.result === 'Loss').length;
    const winRate = closed.length ? (wins / closed.length) * 100 : 0;
    const rrValues = closed.map(x => Number(x.entry.riskReward)).filter(Number.isFinite);
    const avgRR = rrValues.length ? rrValues.reduce((a,b)=>a+b,0)/rrValues.length : 0;
    const bySetup = {};
    const bySession = {};
    closed.forEach(x => {
      const setup = x.entry.setupType || 'Unknown';
      const session = x.entry.session || 'Unknown';
      bySetup[setup] = bySetup[setup] || {total:0,win:0,loss:0};
      bySession[session] = bySession[session] || {total:0,win:0,loss:0};
      bySetup[setup].total++; bySession[session].total++;
      if(x.result==='Win'){bySetup[setup].win++; bySession[session].win++;}
      if(x.result==='Loss'){bySetup[setup].loss++; bySession[session].loss++;}
    });
    return {total:list.length, closed:closed.length, wins, losses, winRate:+winRate.toFixed(2), avgRR:+avgRR.toFixed(2), bySetup, bySession};
  },
  equity(entries){
    let balance = 0;
    let balanceR = 0;
    let balanceMoney = 0;
    const rawList = Array.isArray(entries) ? entries : [];
    const list = rawList.map(x => ({ entry: x, result: normalizeResult(x.result) }))
                        .filter(x => x.result !== null);
    
    const entryTime = (e) => {
      const raw = e?.actualEntryTime || e?.entryTime || e?.exitTime || e?.analysisTime || e?.date || e?.createdAt || e?.timestamp;
      const t = raw ? new Date(raw).getTime() : 0;
      return Number.isFinite(t) ? t : 0;
    };
    list.sort((a, b) => entryTime(a.entry) - entryTime(b.entry));

    const hasMoney = list.some(x => {
      const e = x.entry;
      const m = e.pnlMoney != null && e.pnlMoney !== '' ? Number(e.pnlMoney) : ((Number(e.profit)||0) - (Number(e.loss)||0));
      return Number.isFinite(m) && m !== 0;
    });

    return list.map(x => {
      const e = x.entry;
      const explicitMoney = e.pnlMoney != null && e.pnlMoney !== '' ? Number(e.pnlMoney) : null;
      const calcMoney = (e.profit || e.loss) ? ((Number(e.profit)||0) - (Number(e.loss)||0)) : null;
      const moneyVal = explicitMoney != null && Number.isFinite(explicitMoney) ? explicitMoney : (calcMoney != null && Number.isFinite(calcMoney) ? calcMoney : null);
      
      const deltaR = x.result === 'Win' ? Number(e.riskReward || 2) : x.result === 'Loss' ? -1 : 0;
      const deltaMoney = moneyVal != null ? moneyVal : 0;
      
      balanceR += deltaR;
      balanceMoney += deltaMoney;

      const delta = (hasMoney && moneyVal != null) ? moneyVal : deltaR;
      balance += delta;

      const timeIso = e.analysisTime || e.createdAt || e.date || new Date().toISOString();
      return {
        time: timeIso,
        balance,
        balanceR,
        balanceMoney,
        delta,
        deltaR,
        deltaMoney,
        unit: hasMoney ? '$' : 'R',
        hasMoney
      };
    });
  },
  renderEquitySVG(entries){
    const data = this.equity(entries);
    if (!data.length) {
      return '<div style="padding:20px;text-align:center;color:var(--muted,#888);font-size:13px;">Belum ada data trade tertutup untuk kurva equity.</div>';
    }
    const lastPoint = data[data.length - 1];
    const values = [0, ...data.map(d => d.balance)];
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const range = (maxVal - minVal) || 1;
    
    const width = 600;
    const height = 180;
    const padding = 20;
    const innerW = width - padding * 2;
    const innerH = height - padding * 2;

    const points = values.map((v, i) => {
      const x = padding + (i / (values.length - 1 || 1)) * innerW;
      const y = height - padding - ((v - minVal) / range) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const isPositive = values[values.length - 1] >= 0;
    const strokeColor = isPositive ? '#00d97e' : '#ff4c4c';
    const fillColor = isPositive ? 'rgba(0, 217, 126, 0.12)' : 'rgba(255, 76, 76, 0.12)';

    const areaPoints = `${padding},${height - padding} ${points.join(' ')} ${width - padding},${height - padding}`;

    const rLabel = `${lastPoint.balanceR >= 0 ? '+' : ''}${lastPoint.balanceR.toFixed(2)} R`;
    const moneyLabel = lastPoint.hasMoney ? `${lastPoint.balanceMoney >= 0 ? '+$' : '-$'}${Math.abs(lastPoint.balanceMoney).toFixed(2)}` : null;
    const badgeText = moneyLabel ? `${rLabel} · ${moneyLabel}` : rLabel;

    return `
      <div style="background:var(--surface-soft, rgba(255,255,255,0.03));border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:20px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
          <span style="font-size:13px;font-weight:700;color:var(--gold,#d4a832);">EQUITY GROWTH CURVE (${lastPoint.hasMoney ? 'CHRONOLOGICAL REAL &amp; R' : 'CHRONOLOGICAL R-MULTIPLE'})</span>
          <span style="font-size:13px;font-weight:700;color:${strokeColor};">${badgeText}</span>
        </div>
        <svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;overflow:visible;">
          <polygon points="${areaPoints}" fill="${fillColor}" />
          <polyline points="${points.join(' ')}" fill="none" stroke="${strokeColor}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    `;
  }
};


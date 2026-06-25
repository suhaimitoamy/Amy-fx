/* Amy FX Journal Analytics v2.0 — statistik lengkap, equity curve, performa per setup */
window.AmyAnalytics = (function(){
  'use strict';

  function compute(entries) {
    if (!entries || entries.length === 0) return null;

    const closed = entries.filter(e => e.result && e.result !== '');
    const wins   = closed.filter(e => e.result === 'WIN');
    const losses = closed.filter(e => e.result === 'LOSS');
    const be     = closed.filter(e => e.result === 'BREAKEVEN');

    const total  = closed.length;
    const winRate = total > 0 ? ((wins.length / total) * 100).toFixed(1) : '0.0';

    // PnL stats
    const totalPnlPips = closed.reduce((s, e) => s + (Number(e.pnlPips) || 0), 0);
    const totalPnlMoney = closed.reduce((s, e) => s + (Number(e.pnlMoney) || 0), 0);

    // Average RR
    const rrValues = closed.map(e => Number(e.riskReward)).filter(x => x > 0);
    const avgRR = rrValues.length > 0
      ? (rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2)
      : '0.00';

    // Profit factor
    const grossProfit = wins.reduce((s, e) => s + Math.abs(Number(e.pnlMoney) || 0), 0);
    const grossLoss   = losses.reduce((s, e) => s + Math.abs(Number(e.pnlMoney) || 0), 0);
    const profitFactor = grossLoss > 0 ? (grossProfit / grossLoss).toFixed(2) : '∞';

    // Streak
    let maxWinStreak = 0, maxLossStreak = 0, cur = 0, last = '';
    closed.forEach(e => {
      if (e.result === last && e.result === 'WIN') { cur++; maxWinStreak = Math.max(maxWinStreak, cur); }
      else if (e.result === last && e.result === 'LOSS') { cur++; maxLossStreak = Math.max(maxLossStreak, cur); }
      else { cur = 1; }
      last = e.result;
    });

    // Equity curve (cumulative PnL)
    let equity = 0;
    const equityCurve = closed.map(e => {
      equity += (Number(e.pnlMoney) || 0);
      return { date: e.analysisTime ? e.analysisTime.slice(0, 10) : '', equity: +equity.toFixed(2) };
    });

    // Max drawdown
    let peak = 0, maxDD = 0;
    equityCurve.forEach(p => {
      if (p.equity > peak) peak = p.equity;
      const dd = peak - p.equity;
      if (dd > maxDD) maxDD = dd;
    });

    // Per setup type
    const bySetup = {};
    closed.forEach(e => {
      const st = e.setupType || 'Unknown';
      if (!bySetup[st]) bySetup[st] = { total: 0, wins: 0 };
      bySetup[st].total++;
      if (e.result === 'WIN') bySetup[st].wins++;
    });
    const setupStats = Object.entries(bySetup).map(([name, d]) => ({
      name,
      total: d.total,
      wins: d.wins,
      winRate: ((d.wins / d.total) * 100).toFixed(1)
    })).sort((a, b) => b.total - a.total);

    // Per session
    const sessionMap = { LONDON: { t: 0, w: 0 }, NEW_YORK: { t: 0, w: 0 }, ASIA: { t: 0, w: 0 }, OTHER: { t: 0, w: 0 } };
    closed.forEach(e => {
      const h = e.actualEntryTime ? new Date(e.actualEntryTime).getHours() : -1;
      let sess = 'OTHER';
      if (h >= 13 && h < 17) sess = 'LONDON';
      else if (h >= 19 && h < 23) sess = 'NEW_YORK';
      else if (h >= 6 && h < 12) sess = 'ASIA';
      sessionMap[sess].t++;
      if (e.result === 'WIN') sessionMap[sess].w++;
    });

    // Per weekday
    const days = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
    const dayMap = {};
    days.forEach(d => { dayMap[d] = { t: 0, w: 0 }; });
    closed.forEach(e => {
      const d = e.analysisTime ? days[new Date(e.analysisTime).getDay()] : null;
      if (d) { dayMap[d].t++; if (e.result === 'WIN') dayMap[d].w++; }
    });

    // Kesalahan paling sering
    const mistakeMap = {};
    closed.forEach(e => {
      if (e.mistake) {
        mistakeMap[e.mistake] = (mistakeMap[e.mistake] || 0) + 1;
      }
    });
    const topMistakes = Object.entries(mistakeMap).sort((a, b) => b[1] - a[1]).slice(0, 5);

    return {
      total, wins: wins.length, losses: losses.length, be: be.length,
      winRate, totalPnlPips: totalPnlPips.toFixed(1), totalPnlMoney: totalPnlMoney.toFixed(2),
      avgRR, profitFactor, maxWinStreak, maxLossStreak,
      equityCurve, maxDrawdown: maxDD.toFixed(2),
      setupStats, sessionMap, dayMap, topMistakes
    };
  }

  function renderDashboard(stats, containerId) {
    const el = document.getElementById(containerId);
    if (!el) return;
    if (!stats) {
      el.innerHTML = '<div style="text-align:center;color:#888;padding:24px">Belum ada trade yang dicatat. Mulai tambah entry jurnal pertamamu!</div>';
      return;
    }

    const s = stats;
    const wr = parseFloat(s.winRate);
    const wrColor = wr >= 60 ? '#4ade80' : wr >= 45 ? '#d4af37' : '#ff5252';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:16px">
        ${statCard('Total Trade', s.total, '')}
        ${statCard('Win Rate', s.winRate + '%', wrColor)}
        ${statCard('Avg RR', s.avgRR, '')}
        ${statCard('Profit Factor', s.profitFactor, s.profitFactor > 1 ? '#4ade80' : '#ff5252')}
        ${statCard('Total PnL (pips)', s.totalPnlPips, Number(s.totalPnlPips) >= 0 ? '#4ade80' : '#ff5252')}
        ${statCard('Max Drawdown', '$' + s.maxDrawdown, '#ff5252')}
        ${statCard('Win Streak Maks', s.maxWinStreak, '#4ade80')}
        ${statCard('Loss Streak Maks', s.maxLossStreak, '#ff5252')}
      </div>

      ${s.equityCurve.length > 1 ? equityChart(s.equityCurve) : ''}

      <div style="background:#141414;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;margin-bottom:12px">
        <div style="font-weight:900;color:#d4af37;margin-bottom:10px">📊 Performa per Setup</div>
        ${s.setupStats.map(x => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">
            <span style="font-weight:700;font-size:13px">${x.name}</span>
            <div style="display:flex;gap:10px;align-items:center">
              <span style="color:#888;font-size:12px">${x.wins}/${x.total} trade</span>
              <span style="font-weight:900;color:${parseFloat(x.winRate)>=50?'#4ade80':'#ff5252'}">${x.winRate}%</span>
            </div>
          </div>
        `).join('') || '<div style="color:#666">Belum ada data</div>'}
      </div>

      <div style="background:#141414;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;margin-bottom:12px">
        <div style="font-weight:900;color:#d4af37;margin-bottom:10px">⏰ Performa per Session</div>
        ${['LONDON','NEW_YORK','ASIA'].map(sess => {
          const d = s.sessionMap[sess];
          const wr2 = d.t > 0 ? ((d.w/d.t)*100).toFixed(0) : '-';
          return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05)">
            <span style="font-weight:700;font-size:13px">${sess.replace('_',' ')}</span>
            <span style="font-weight:900;color:${wr2!=='-'&&parseInt(wr2)>=50?'#4ade80':'#ff5252'}">${d.t} trade • ${wr2}% WR</span>
          </div>`;
        }).join('')}
      </div>

      ${s.topMistakes.length > 0 ? `
        <div style="background:#141414;border:1px solid rgba(255,82,82,.15);border-radius:16px;padding:14px;margin-bottom:12px">
          <div style="font-weight:900;color:#ff5252;margin-bottom:10px">⚠️ Kesalahan Paling Sering</div>
          ${s.topMistakes.map(([m, c]) => `
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05)">
              <span style="font-size:13px">${m}</span>
              <span style="font-weight:900;color:#ff5252">${c}x</span>
            </div>
          `).join('')}
        </div>
      ` : ''}
    `;
  }

  function statCard(label, value, color) {
    return `<div style="background:#141414;border:1px solid rgba(255,255,255,.07);border-radius:14px;padding:12px">
      <div style="font-size:11px;font-weight:800;color:#888;margin-bottom:4px">${label}</div>
      <div style="font-size:20px;font-weight:950;color:${color||'#f7f7f7'}">${value}</div>
    </div>`;
  }

  function equityChart(curve) {
    const vals = curve.map(p => p.equity);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const W = 300, H = 80;
    const pts = curve.map((p, i) => {
      const x = (i / (curve.length - 1)) * W;
      const y = H - ((p.equity - min) / range) * H;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    const lastEq = vals[vals.length - 1];
    const color = lastEq >= 0 ? '#4ade80' : '#ff5252';
    return `<div style="background:#141414;border:1px solid rgba(255,255,255,.07);border-radius:16px;padding:14px;margin-bottom:12px">
      <div style="font-weight:900;color:#d4af37;margin-bottom:10px">📈 Equity Curve</div>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:80px">
        <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2"/>
        <line x1="0" y1="${H - ((0 - min) / range) * H}" x2="${W}" y2="${H - ((0 - min) / range) * H}" stroke="rgba(255,255,255,.1)" stroke-dasharray="4"/>
      </svg>
      <div style="text-align:right;font-weight:900;color:${color};font-size:13px">Net: $${lastEq.toFixed(2)}</div>
    </div>`;
  }

  return { compute, renderDashboard };
})();

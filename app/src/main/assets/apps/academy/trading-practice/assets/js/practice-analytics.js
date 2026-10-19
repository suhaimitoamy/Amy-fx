/* Amy FX Trading Practice — Local IndexedDB Analytics & Performance Dashboard */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    var g = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : root);
    if (g) {
      g.AmyPracticeAnalytics = factory();
    }
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)), function () {
  'use strict';

  function classifySession(tradeTime) {
    if (!tradeTime) return 'Other';
    var date = new Date(Number(tradeTime) * 1000);
    var utcHours = date.getUTCHours();
    // Asia: 00:00 - 07:00 UTC (08:00 - 15:00 WITA)
    // London: 07:00 - 13:00 UTC (15:00 - 21:00 WITA)
    // New York: 13:00 - 21:00 UTC (21:00 - 05:00 WITA)
    if (utcHours >= 0 && utcHours < 7) return 'Asia';
    if (utcHours >= 7 && utcHours < 13) return 'London';
    if (utcHours >= 13 && utcHours < 21) return 'New York';
    return 'Other';
  }

  function classifySetup(notes, reason, defaultSetup) {
    var text = String((notes || '') + ' ' + (reason || '')).toLowerCase();
    if (text.indexOf('fvg') !== -1 || text.indexOf('fair value') !== -1 || text.indexOf('imbalance') !== -1) {
      return 'FVG';
    }
    if (text.indexOf('ob') !== -1 || text.indexOf('order block') !== -1 || text.indexOf('orderblock') !== -1 || text.indexOf('breaker') !== -1) {
      return 'Order Block';
    }
    if (text.indexOf('sweep') !== -1 || text.indexOf('turtle') !== -1 || text.indexOf('bsl') !== -1 || text.indexOf('ssl') !== -1 || text.indexOf('liquidity') !== -1) {
      return 'Liquidity Sweep';
    }
    if (text.indexOf('bos') !== -1 || text.indexOf('mss') !== -1 || text.indexOf('structure') !== -1) {
      return 'Structure Break';
    }
    return defaultSetup || 'ICT General';
  }

  function computeStats(trades) {
    var list = Array.isArray(trades) ? trades : [];
    var closed = list.filter(function (t) { return t && (t.result === 'WIN' || t.result === 'LOSS'); });
    var wins = closed.filter(function (t) { return t.result === 'WIN'; });
    var losses = closed.filter(function (t) { return t.result === 'LOSS'; });
    var missed = list.filter(function (t) { return t && t.result === 'MISSED'; });
    var open = list.filter(function (t) { return t && (t.result === 'OPEN' || !t.result || t.result === 'WAIT'); });

    var totalClosed = closed.length;
    var winRate = totalClosed > 0 ? Math.round((wins.length / totalClosed) * 1000) / 10 : 0;

    var grossWinR = 0;
    var grossLossR = 0;
    var totalR = 0;

    var peakR = 0;
    var currentR = 0;
    var maxDrawdownR = 0;

    // Chronological order for equity and drawdown calculation
    var sortedClosed = closed.slice().sort(function (a, b) {
      return Number(a.tradeTime || a.createdAt || 0) - Number(b.tradeTime || b.createdAt || 0);
    });

    for (var i = 0; i < sortedClosed.length; i++) {
      var t = sortedClosed[i];
      var r = Number.isFinite(Number(t.r)) ? Number(t.r) : (t.result === 'WIN' ? Number(t.plannedR || 2) : -1);
      totalR += r;
      if (r > 0) grossWinR += r;
      if (r < 0) grossLossR += Math.abs(r);

      currentR += r;
      if (currentR > peakR) peakR = currentR;
      var dd = peakR - currentR;
      if (dd > maxDrawdownR) maxDrawdownR = dd;
    }

    var profitFactor = grossLossR > 0
      ? Math.round((grossWinR / grossLossR) * 100) / 100
      : (grossWinR > 0 ? 99.99 : 0);

    var expectancyR = totalClosed > 0
      ? Math.round((totalR / totalClosed) * 100) / 100
      : 0;

    // Breakdown by setup
    var setupMap = {};
    for (var j = 0; j < list.length; j++) {
      var trade = list[j];
      var setup = trade.setupType || classifySetup(trade.notes, trade.reason);
      if (!setupMap[setup]) setupMap[setup] = { total: 0, wins: 0, losses: 0, missed: 0, totalR: 0 };
      setupMap[setup].total++;
      if (trade.result === 'WIN') {
        setupMap[setup].wins++;
        setupMap[setup].totalR += (Number(trade.r) || Number(trade.plannedR) || 2);
      } else if (trade.result === 'LOSS') {
        setupMap[setup].losses++;
        setupMap[setup].totalR -= 1;
      } else if (trade.result === 'MISSED') {
        setupMap[setup].missed++;
      }
    }

    var breakdownBySetup = Object.keys(setupMap).map(function (k) {
      var s = setupMap[k];
      var closedCount = s.wins + s.losses;
      return {
        setup: k,
        total: s.total,
        wins: s.wins,
        losses: s.losses,
        missed: s.missed,
        winRate: closedCount > 0 ? Math.round((s.wins / closedCount) * 100) : 0,
        totalR: Math.round(s.totalR * 10) / 10
      };
    });

    // Breakdown by session
    var sessionMap = { London: { wins: 0, losses: 0, total: 0 }, 'New York': { wins: 0, losses: 0, total: 0 }, Asia: { wins: 0, losses: 0, total: 0 }, Other: { wins: 0, losses: 0, total: 0 } };
    for (var k = 0; k < list.length; k++) {
      var tr = list[k];
      var sess = tr.session || classifySession(tr.tradeTime);
      if (!sessionMap[sess]) sessionMap[sess] = { wins: 0, losses: 0, total: 0 };
      sessionMap[sess].total++;
      if (tr.result === 'WIN') sessionMap[sess].wins++;
      else if (tr.result === 'LOSS') sessionMap[sess].losses++;
    }

    var breakdownBySession = Object.keys(sessionMap).map(function (k) {
      var s = sessionMap[k];
      var closedCount = s.wins + s.losses;
      return {
        session: k,
        total: s.total,
        wins: s.wins,
        losses: s.losses,
        winRate: closedCount > 0 ? Math.round((s.wins / closedCount) * 100) : 0
      };
    });

    return {
      totalTrades: list.length,
      closedTrades: totalClosed,
      wins: wins.length,
      losses: losses.length,
      missed: missed.length,
      open: open.length,
      winRate: winRate,
      expectancyR: expectancyR,
      profitFactor: profitFactor,
      maxDrawdownR: Math.round(maxDrawdownR * 10) / 10,
      totalRealizedR: Math.round(totalR * 10) / 10,
      breakdownBySetup: breakdownBySetup,
      breakdownBySession: breakdownBySession
    };
  }

  return {
    classifySession: classifySession,
    classifySetup: classifySetup,
    computeStats: computeStats
  };
});

window.AmyJournalSchema = {
  requiredFields: ['analysisTime','pair','timeframe','htfBias','setupType','entryArea','stopLoss','setupScore'],
  emptyEntry(){
    return {
      id: 'JRN-' + Date.now(),
      analysisTime: new Date().toISOString(),
      pair: 'XAU/USD',
      timeframe: '',
      htfBias: '',
      setupType: '',
      entryArea: '',
      stopLoss: '',
      takeProfit1: '',
      takeProfit2: '',
      takeProfit3: '',
      riskReward: '',
      setupScore: '',
      screenshot: '',
      planNote: '',
      actualEntryTime: '',
      actualEntryPrice: '',
      lotSize: '',
      platform: '',
      result: '',
      exitPrice: '',
      pnlPips: '',
      pnlMoney: '',
      followedPlan: '',
      mistake: '',
      lesson: '',
      rating: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  },
  validate(entry){
    const required = ['analysisTime', 'pair', 'timeframe', 'htfBias', 'setupType', 'entryArea', 'stopLoss'];
    const missing = required.filter(k => entry[k] === undefined || entry[k] === null || String(entry[k]).trim() === '');
    const hasTp = (entry.takeProfit1 !== undefined && entry.takeProfit1 !== null && String(entry.takeProfit1).trim() !== '') ||
                  (entry.takeProfit2 !== undefined && entry.takeProfit2 !== null && String(entry.takeProfit2).trim() !== '');
    if (!hasTp) missing.push('takeProfit1 / takeProfit2');
    if (entry.setupScore === undefined || entry.setupScore === null || String(entry.setupScore).trim() === '') {
      missing.push('setupScore');
    }
    return {ok: missing.length === 0, missing};
  },
  computeRR(entry){
    const e = Number(entry.actualEntryPrice || entry.entryArea);
    const sl = Number(entry.stopLoss);
    const tp = Number(entry.takeProfit2 || entry.takeProfit1);
    if(!Number.isFinite(e)||!Number.isFinite(sl)||!Number.isFinite(tp)||e===sl) return '';
    return Math.abs((tp-e)/(e-sl)).toFixed(2);
  }
};

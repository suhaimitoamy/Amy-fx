// Presentation settings never change server-owned bias/scoring.
export const DISPLAY_DEFAULTS=Object.freeze({mode:'Present',structure:true,mss:true,bos:true,displacement:false,ob:true,breaker:true,polarity:false,liquidity:true,fvg:true,gapType:'FVG',bpr:false,vi:true,nwog:true,ndog:false,pivots:true,pivotTf:'D',pivotMode:'Clean',nearAtr:2,keyLevels:true,mo:true,pdh:true,pdl:true,bsl:false,ssl:false,asia:true,killzones:false,ny:true,londonOpen:true,londonClose:true,asian:true,fib:'NONE',fibExtend:false,labels:true,signals:false,narration:false,dashboard:true,panel:false,assistantNotif:true,visible:2,bullOb:1,bearOb:1,nwogCount:3,ndogCount:1,backBars:80,rightBars:40,lineWidth:1});
export function loadDisplay(storage=globalThis.localStorage){try{return {...DISPLAY_DEFAULTS,...JSON.parse(storage.getItem('amyfx.ict.display.v2')||'{}')};}catch{return {...DISPLAY_DEFAULTS};}}
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const n=x=>Number.isFinite(x)?x.toFixed(2):'—';
const range=z=>z?`${n(z.high)} – ${n(z.low)}`:'—';
const directions=x=>x===1?'BUY CTX · NAIK':x===-1?'SELL CTX · TURUN':'NO CLEAR BIAS';
export function dashboardRows(amy){
  const d=amy?.dashboard;if(!d)return [];
  const state=['None','Fresh','Old','Invalid'][d.sweepStatus],invalid=['Valid','Near Invalid','Invalid','No Bias'][d.invalidStatus];
  const poi=d.poi,poiName=poi?`${poi.side==='BUY'?'Bull':'Bear'} ${poi.kind}`:'None';
  const zone=x=>x===1?'Premium':x===-1?'Discount':'EQ Zone';
  return [['BIAS',directions(d.biasDir)],['STRUKTUR',d.mssDir===1?'M15 Bullish':d.mssDir===-1?'M15 Bearish':'M15 Neutral'],
    ['PROTECTED',`H ${n(d.protectedHigh)} | L ${n(d.protectedLow)}`],['LIQUIDITY',`BSL ${n(d.bsl)} | SSL ${n(d.ssl)}`],
    ['SWEEP',`${d.sweepDir===1?'SSL Swept':d.sweepDir===-1?'BSL Swept':'None'} | ${state}`],
    ['SWEEP PRICE',`Swept ${n(d.sweep?.price)} | Extreme ${n(d.sweep?.extreme)}`],
    ['DOL',`${d.dolDir===1?'Draw to BSL':d.dolDir===-1?'Draw to SSL':'Neutral'} @ ${n(d.dolTarget)} | ${['Neutral','Active','Reached'][d.dolStatus]}`],
    ['DOL DETAIL',`Dist ${n(d.dolDistance)} | ${d.dolAlign===1?'With Bias':d.dolAlign===-1?'Against Bias':'Neutral'}`],
    ['POI',`${poiName} | ${poi?.lifecycle||'None'} | ${d.poiPriority===2?'Main':d.poiPriority===1?'Secondary':'Ignore'}`],
    ['POI PRICE',`${range(poi)} | CE ${n(poi?.ce)}`],['POI DETAIL',`Dist ${n(d.poiDistance)} | ${zone(d.poiLocation)}`],
    ['POSISI',`${zone(d.priceZone)} | ${d.locationStatus===1?'Healthy':d.locationStatus===-1?'Bad Location':'Neutral'}`],
    ['RANGE',`H ${n(d.rangeHigh)} | L ${n(d.rangeLow)} | EQ ${n(d.eqLow)} – ${n(d.eqHigh)}`],
    ['INVALID',`${invalid} | Level ${n(d.invalidLevel)} | Dist ${d.invalidLevel!=null?n(Math.abs(d.candle.close-d.invalidLevel)):'—'}`],
    ['ALASAN INTI',`${d.mssDir===1?'M15 Bullish':d.mssDir===-1?'M15 Bearish':'M15 Neutral'} | ${d.sweepStatus===1?'Fresh Sweep':'Tunggu Sweep'} | ${poiName}`]];
}
// Compact copy reads server flags only; full narration stays in Detail.
export function mappingWarnings(amy,news=null){
  if(!amy)return [];
  const d=amy.dashboard,e=amy.entry,warnings=[];
  if(news?.status==='NEWS_LOCK')warnings.push('NEWS LOCK · Tunda eksekusi.');
  if(e?.m5Invalid)warnings.push('Close M5 melewati invalidasi · tunggu close M15.');
  else if(d?.invalidStatus===2)warnings.push('Setup batal · tunggu struktur baru.');
  else if(d?.invalidStatus===1)warnings.push(`Dekat invalidasi ${n(d.invalidLevel)}.`);
  if(e?.winDir&&d?.biasDir&&e.winDir!==d.biasDir)warnings.push(`Skor ${e.winDir===1?'BUY':'SELL'} berlawanan bias M15 · tunggu struktur baru.`);
  return warnings;
}
export function compactChartNarration(amy,news=null){
  const warnings=mappingWarnings(amy,news);
  if(warnings.length)return warnings.slice(0,2);
  return (amy?.entry?.text||'Menunggu candle tertutup.').split('\n').filter(Boolean).slice(0,2);
}
const rowNames={'PROTECTED':'Protected swing','LIQUIDITY':'Likuiditas','SWEEP PRICE':'Harga sweep','DOL':'Target DOL','DOL DETAIL':'Jarak DOL','POI PRICE':'Area & CE','POI DETAIL':'Lokasi POI','RANGE':'Dealing Range','INVALID':'Invalidasi','ALASAN INTI':'Ringkasan'};
const layerNames={bias:'Bias M15',sweep:'Liquidity sweep',poi:'Area POI',poiBonus:'Reaksi POI',dol:'Target DOL',location:'Premium / Discount',displacement:'Displacement',structure:'Break struktur',asia:'Level Asia'};
const readable=text=>String(text).replaceAll('NO CLEAR BIAS','Bias belum jelas').replaceAll('EQ Zone','Zona EQ').replaceAll('Near Invalid','Dekat invalidasi').replaceAll('No Bias','Tanpa bias').replaceAll('Against Bias','Lawan bias').replaceAll('With Bias','Searah bias').replaceAll('Bad Location','Lokasi kurang ideal').replaceAll('Healthy','Lokasi sesuai').replaceAll('Reached','Tercapai').replaceAll('Active','Aktif').replaceAll('Secondary','Tambahan').replaceAll('Ignore','Abaikan').replaceAll('Main','Utama').replaceAll('None','Belum ada').replaceAll('Fresh','Baru').replaceAll('Old','Lama').replaceAll('Dist ','Jarak ').replaceAll('Extreme ','Ekstrem ').replaceAll('Draw to ','Menuju ');
export function isGoldMarketOpen(nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    }).formatToParts(new Date(nowSeconds * 1000));
    const values = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const weekday = values.weekday;
    const hour = Number(values.hour) + Number(values.minute) / 60;
    if (weekday === 'Sat') return false;
    if (weekday === 'Sun') return hour >= 17;
    if (weekday === 'Fri') return hour < 17;
    if (hour >= 17 && hour < 18) return false;
    return true;
  } catch (_) {
    const d = new Date(nowSeconds * 1000);
    const day = d.getUTCDay();
    return day !== 0 && day !== 6;
  }
}

export function isPreMarketWarming(nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
      weekday: 'short'
    }).formatToParts(new Date(nowSeconds * 1000));
    const values = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const hour = Number(values.hour) + Number(values.minute) / 60;
    return values.weekday === 'Sun' && hour >= 16.9166 && hour < 17;
  } catch (_) {
    return false;
  }
}

export function getMarketPowerState(nowSeconds = Math.floor(Date.now() / 1000)) {
  if (isGoldMarketOpen(nowSeconds)) return 'MARKET_OPEN';
  if (isPreMarketWarming(nowSeconds)) return 'PRE_MARKET_WARMUP';
  return 'DEEP_SLEEP';
}

export function detectLiquiditySweep(amy, context = null) {
  if (!amy) return null;
  const d = amy.dashboard;
  const e = amy.entry;
  const trg = amy.trigger;
  const ctx = context || (typeof window !== 'undefined' ? window.AmyMarketContext : null);
  const levels = amy.levels || ctx?.levels || ctx?.keyLevels || {};
  const c = trg?.candle || d?.candle || amy.candle || (amy.chartCandles && amy.chartCandles.length ? amy.chartCandles[amy.chartCandles.length - 1] : null);
  const lines = (e?.text || '').split('\n').map(s => s.trim()).filter(Boolean);
  const liqList = Array.isArray(ctx?.liquidity) ? ctx.liquidity : [];

  const num = x => (x != null && Number.isFinite(Number(x))) ? Number(x) : null;

  const activeSweepTime = (d?.sweepStatus === 1 ? num(d?.sweep?.time) : null)
    || ((num(trg?.sweepDir) === 1 || num(trg?.sweepDir) === -1) ? num(trg?.time) : null);
  const candleCloseTime = num(c?.close_time ?? c?.time);

  // 1. Asia High / Asia Low sweep
  const asiaHigh = num(levels.asiaHigh ?? ctx?.keyLevels?.asiaHigh);
  const asiaLow = num(levels.asiaLow ?? ctx?.keyLevels?.asiaLow);
  const liqAsiaHighSwept = liqList.find(l => /asia\s*high/i.test(l.label) && /swept/i.test(l.status));
  const liqAsiaLowSwept = liqList.find(l => /asia\s*low/i.test(l.label) && /swept/i.test(l.status));
  const textAsiaHigh = lines.some(l => /asia\s*high.*swept/i.test(l));
  const textAsiaLow = lines.some(l => /asia\s*low.*swept/i.test(l));

  if (liqAsiaHighSwept || textAsiaHigh || (c && asiaHigh && c.high > asiaHigh && c.close < asiaHigh)) {
    const lvl = num(liqAsiaHighSwept?.level) || asiaHigh || (c ? c.high : 0);
    const ext = (c && c.high > lvl) ? c.high : (lvl ? lvl + 1.20 : 0);
    const isCurrentBarSweep = Boolean(c && asiaHigh && c.high > asiaHigh && c.close < asiaHigh);
    const sweepTime = activeSweepTime || (isCurrentBarSweep ? candleCloseTime : null) || num(liqAsiaHighSwept?.sweptAt) || (liqAsiaHighSwept && d?.sweepStatus !== 1 ? 1 : null);
    return { name: 'Asia High', level: lvl, extreme: ext, side: 'SELL', time: sweepTime, index: d?.sweep?.index ?? null };
  }
  if (liqAsiaLowSwept || textAsiaLow || (c && asiaLow && c.low < asiaLow && c.close > asiaLow)) {
    const lvl = num(liqAsiaLowSwept?.level) || asiaLow || (c ? c.low : 0);
    const ext = (c && c.low < lvl) ? c.low : (lvl ? lvl - 1.20 : 0);
    const isCurrentBarSweep = Boolean(c && asiaLow && c.low < asiaLow && c.close > asiaLow);
    const sweepTime = activeSweepTime || (isCurrentBarSweep ? candleCloseTime : null) || num(liqAsiaLowSwept?.sweptAt) || (liqAsiaLowSwept && d?.sweepStatus !== 1 ? 1 : null);
    return { name: 'Asia Low', level: lvl, extreme: ext, side: 'BUY', time: sweepTime, index: d?.sweep?.index ?? null };
  }

  // 2. PDH / PDL sweep
  const pdh = num(levels.pdh ?? ctx?.keyLevels?.pdh);
  const pdl = num(levels.pdl ?? ctx?.keyLevels?.pdl);
  const liqPdhSwept = liqList.find(l => /pdh|previous\s*day\s*high/i.test(l.label) && /swept/i.test(l.status));
  const liqPdlSwept = liqList.find(l => /pdl|previous\s*day\s*low/i.test(l.label) && /swept/i.test(l.status));
  const textPdh = lines.some(l => /pdh.*swept/i.test(l));
  const textPdl = lines.some(l => /pdl.*swept/i.test(l));

  if (liqPdhSwept || textPdh || (c && pdh && c.high > pdh && c.close < pdh)) {
    const lvl = num(liqPdhSwept?.level) || pdh || (c ? c.high : 0);
    const ext = (c && c.high > lvl) ? c.high : (lvl ? lvl + 1.20 : 0);
    const isCurrentBarSweep = Boolean(c && pdh && c.high > pdh && c.close < pdh);
    const sweepTime = activeSweepTime || (isCurrentBarSweep ? candleCloseTime : null) || num(liqPdhSwept?.sweptAt) || (liqPdhSwept && d?.sweepStatus !== 1 ? 1 : null);
    return { name: 'PDH', level: lvl, extreme: ext, side: 'SELL', time: sweepTime, index: d?.sweep?.index ?? null };
  }
  if (liqPdlSwept || textPdl || (c && pdl && c.low < pdl && c.close > pdl)) {
    const lvl = num(liqPdlSwept?.level) || pdl || (c ? c.low : 0);
    const ext = (c && c.low < lvl) ? c.low : (lvl ? lvl - 1.20 : 0);
    const isCurrentBarSweep = Boolean(c && pdl && c.low < pdl && c.close > pdl);
    const sweepTime = activeSweepTime || (isCurrentBarSweep ? candleCloseTime : null) || num(liqPdlSwept?.sweptAt) || (liqPdlSwept && d?.sweepStatus !== 1 ? 1 : null);
    return { name: 'PDL', level: lvl, extreme: ext, side: 'BUY', time: sweepTime, index: d?.sweep?.index ?? null };
  }

  // 3. BSL / SSL sweep
  const dSweepPrice = num(d?.sweep?.price);
  const dSweepExtreme = num(d?.sweep?.extreme);
  const dSweepDir = num(d?.sweep?.dir) ?? (d?.sweepDir || 0);

  const trgSweepDir = num(trg?.sweepDir) || 0;
  const trgSweptPrice = num(trg?.sweptPrice);
  const trgSweepExtreme = num(trg?.sweepExtreme);

  const bslLevel = num(d?.bsl) || num(levels.bsl) || num(liqList.find(l => l.label === 'BSL')?.level) || num(d?.protectedHigh);
  const sslLevel = num(d?.ssl) || num(levels.ssl) || num(liqList.find(l => l.label === 'SSL')?.level) || num(d?.protectedLow);

  const hasSslSweep = (d?.sweepStatus === 1 && dSweepDir === 1) ||
    (trgSweepDir === 1) ||
    lines.some(l => /ssl.*swept/i.test(l)) ||
    liqList.some(l => l.label === 'SSL' && /swept/i.test(l.status));

  const hasBslSweep = (d?.sweepStatus === 1 && dSweepDir === -1) ||
    (trgSweepDir === -1) ||
    lines.some(l => /bsl.*swept/i.test(l)) ||
    liqList.some(l => l.label === 'BSL' && /swept/i.test(l.status));

  const marketPrice = num(amy?.currentPrice) || num(amy?.price) || (typeof window !== 'undefined' ? (num(window.amyfxCurrentPrice) || num(window.currentPrice)) : null) || 0;
  const defaultSsl = c ? c.low : marketPrice;
  const defaultBsl = c ? c.high : marketPrice;

  if (hasSslSweep) {
    const lvl = (dSweepDir === 1 && dSweepPrice) || (trgSweepDir === 1 && trgSweptPrice) || sslLevel || defaultSsl;
    const ext = (dSweepDir === 1 && dSweepExtreme) || (trgSweepDir === 1 && trgSweepExtreme) || (c && c.low < lvl ? c.low : (lvl ? lvl - 1.70 : 0));
    const sweepTime = activeSweepTime || num(liqList.find(l => l.label === 'SSL' && /swept/i.test(l.status))?.sweptAt) || null;
    return { name: 'SSL', level: lvl, extreme: ext, side: 'BUY', time: sweepTime, index: d?.sweep?.index ?? null };
  }

  if (hasBslSweep) {
    const lvl = (dSweepDir === -1 && dSweepPrice) || (trgSweepDir === -1 && trgSweptPrice) || bslLevel || defaultBsl;
    const ext = (dSweepDir === -1 && dSweepExtreme) || (trgSweepDir === -1 && trgSweepExtreme) || (c && c.high > lvl ? c.high : (lvl ? lvl + 1.70 : 0));
    const sweepTime = activeSweepTime || num(liqList.find(l => l.label === 'BSL' && /swept/i.test(l.status))?.sweptAt) || null;
    return { name: 'BSL', level: lvl, extreme: ext, side: 'SELL', time: sweepTime, index: d?.sweep?.index ?? null };
  }

  // 4. Any line containing "swept"
  if (lines.some(l => l.toLowerCase().includes('swept'))) {
    const isSsl = lines.some(l => /ssl/i.test(l));
    const name = isSsl ? 'SSL' : 'BSL';
    const lvl = isSsl ? (sslLevel || defaultSsl) : (bslLevel || defaultBsl);
    const ext = isSsl ? (c && c.low < lvl ? c.low : (lvl ? lvl - 1.70 : 0)) : (c && c.high > lvl ? c.high : (lvl ? lvl + 1.70 : 0));
    const sweepTime = activeSweepTime || null;
    return { name, level: lvl, extreme: ext, side: isSsl ? 'BUY' : 'SELL', time: sweepTime, index: d?.sweep?.index ?? null };
  }

  return null;
}

export function getAvailableM5Candles(amy, context = null) {
  if (amy?.timeframe === 'M5' && Array.isArray(amy?.chartCandles) && amy.chartCandles.length >= 3) {
    return amy.chartCandles;
  }
  if (typeof window !== 'undefined' && Array.isArray(window.amyfxLastCandlesM5) && window.amyfxLastCandlesM5.length >= 3) {
    return window.amyfxLastCandlesM5;
  }
  const ctx = context || (typeof window !== 'undefined' ? window.AmyMarketContext : null);
  if (Array.isArray(ctx?.amy?.chartCandles?.M5) && ctx.amy.chartCandles.M5.length >= 3) {
    return ctx.amy.chartCandles.M5;
  }
  if (typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem('amyfx.mapping.candles.M5');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.values) && parsed.values.length >= 3) {
          return parsed.values;
        }
      }
    } catch (_) {}
  }
  return [];
}

export function detectM5SniperTrigger(amy, context = null) {
  const rawM5 = getAvailableM5Candles(amy, context);
  if (!rawM5 || rawM5.length < 3) return null;

  const m5 = rawM5.map(c => ({
    open: Number(c.open),
    high: Number(c.high),
    low: Number(c.low),
    close: Number(c.close),
    time: Number(c.time || c.open_time || (c.datetime ? Math.floor(new Date(c.datetime).getTime() / 1000) : 0))
  })).filter(c => Number.isFinite(c.open) && Number.isFinite(c.close));

  if (m5.length < 3) return null;

  const ctx = context || (typeof window !== 'undefined' ? window.AmyMarketContext : null);
  const d = amy?.dashboard;
  const levels = amy?.levels || ctx?.levels || ctx?.keyLevels || {};

  const currentPrice = (typeof window !== 'undefined' && Number.isFinite(Number(window.amyfxCurrentPrice)) && Number(window.amyfxCurrentPrice) > 0)
    ? Number(window.amyfxCurrentPrice)
    : (Number.isFinite(Number(amy?.currentPrice)) && Number(amy?.currentPrice) > 0)
    ? Number(amy.currentPrice)
    : (Number.isFinite(Number(ctx?.price)) && Number(ctx.price) > 0)
    ? Number(ctx.price)
    : m5[m5.length - 1].close;

  const rHigh = Number(ctx?.m15?.dealingRange?.rangeHigh ?? d?.rangeHigh ?? d?.protectedHigh ?? levels?.bsl);
  const rLow = Number(ctx?.m15?.dealingRange?.rangeLow ?? d?.rangeLow ?? d?.protectedLow ?? levels?.ssl);
  const hasRange = Number.isFinite(rHigh) && Number.isFinite(rLow) && rHigh > rLow;
  const rangePct = (hasRange && currentPrice > 0) ? Math.min(100, Math.max(0, Math.round(((currentPrice - rLow) / (rHigh - rLow)) * 100))) : 50;

  const sslVal = Number(levels?.ssl ?? d?.ssl ?? rLow);
  const bslVal = Number(levels?.bsl ?? d?.bsl ?? rHigh);
  const pdlVal = Number(levels?.pdl ?? ctx?.keyLevels?.pdl);
  const pdhVal = Number(levels?.pdh ?? ctx?.keyLevels?.pdh);
  const asiaLow = Number(levels?.asiaLow ?? ctx?.keyLevels?.asiaLow);
  const asiaHigh = Number(levels?.asiaHigh ?? ctx?.keyLevels?.asiaHigh);

  const len = m5.length;
  const c0 = m5[len - 1]; // latest M5
  const c1 = m5[len - 2]; // previous M5
  const c2 = m5[len - 3]; // candle before previous

  const c0Body = Math.abs(c0.close - c0.open);
  const c1Body = Math.abs(c1.close - c1.open);

  const c0LowerWick = Math.min(c0.open, c0.close) - c0.low;
  const c0UpperWick = c0.high - Math.max(c0.open, c0.close);
  const c1LowerWick = Math.min(c1.open, c1.close) - c1.low;
  const c1UpperWick = c1.high - Math.max(c1.open, c1.close);

  const floorLevels = [sslVal, pdlVal, asiaLow, rLow].filter(Number.isFinite);
  const ceilingLevels = [bslVal, pdhVal, asiaHigh, rHigh].filter(Number.isFinite);

  const patternLow = Math.min(c0.low, c1.low, c2.low);
  const nearFloor = floorLevels.some(lvl => Math.abs(patternLow - lvl) <= 4.0 || patternLow < lvl);
  const inDiscount = rangePct < 48.0;

  // 1. BULLISH SNIPER REVERSAL
  if ((inDiscount || nearFloor) && rangePct <= 52.0) {
    const hasAbsorption = (c1LowerWick >= c1Body * 0.8 && c1LowerWick >= 0.7) || (c0LowerWick >= c0Body * 0.8 && c0LowerWick >= 0.7) || (c1.close > c1.low + (c1.high - c1.low) * 0.5);
    const hasBullDisp = (c0.close > c0.open && c0.close >= Math.max(c1.close, c1.open)) || (c0.close > c1.high * 0.9995);

    if (hasAbsorption && hasBullDisp) {
      const entry = currentPrice;
      const sl = Number((patternLow - 1.50).toFixed(2));
      const risk = Number(Math.max(1.5, entry - sl).toFixed(2));
      const tp1 = Number((entry + 5.00).toFixed(2)); // +50 Pips Sayang
      const tp2Target = (Number.isFinite(bslVal) && bslVal > entry + 6.0) ? bslVal : (entry + 10.00);
      const tp2 = Number(tp2Target.toFixed(2)); // +100 Pips DOL
      const rr1 = Number((5.0 / risk).toFixed(1));
      const rr2 = Number(((tp2 - entry) / risk).toFixed(1));

      return {
        side: 'BUY',
        signalType: 1,
        signalName: '🟢 SNIPER BUY (M5 3-CANDLE ABSORPTION)',
        status: 'READY',
        mathZone: inDiscount ? `DISCOUNT EKSTREM (${rangePct}%)` : `SWEEP LANTAI @ ${patternLow.toFixed(2)}`,
        entry,
        sl,
        tp1,
        tp2,
        risk,
        rr1,
        rr2,
        reasons: [
          `Detektor 3-Candle M5: Serapan ekor bawah (absorption wick) di lantai ekstrem $${patternLow.toFixed(2)}.`,
          `Displacement hijau M5 memicu konfirmasi Micro-MSS menuju likuiditas atas.`,
          `Target Presisi 100 Pips Sayang: TP1 +50 Pips ($${tp1.toFixed(2)}) kunci profit & TP2 +100 Pips DOL ($${tp2.toFixed(2)}).`
        ],
        reclaimed: true
      };
    }
  }

  // 2. BEARISH SNIPER REVERSAL
  const patternHigh = Math.max(c0.high, c1.high, c2.high);
  const nearCeiling = ceilingLevels.some(lvl => Math.abs(patternHigh - lvl) <= 4.0 || patternHigh > lvl);
  const inPremium = rangePct > 52.0;

  if ((inPremium || nearCeiling) && rangePct >= 48.0) {
    const hasAbsorption = (c1UpperWick >= c1Body * 0.8 && c1UpperWick >= 0.7) || (c0UpperWick >= c0Body * 0.8 && c0UpperWick >= 0.7) || (c1.close < c1.high - (c1.high - c1.low) * 0.5);
    const hasBearDisp = (c0.close < c0.open && c0.close <= Math.min(c1.close, c1.open)) || (c0.close < c1.low * 1.0005);

    if (hasAbsorption && hasBearDisp) {
      const entry = currentPrice;
      const sl = Number((patternHigh + 1.50).toFixed(2));
      const risk = Number(Math.max(1.5, sl - entry).toFixed(2));
      const tp1 = Number((entry - 5.00).toFixed(2)); // +50 Pips Sayang
      const tp2Target = (Number.isFinite(sslVal) && sslVal < entry - 6.0) ? sslVal : (entry - 10.00);
      const tp2 = Number(tp2Target.toFixed(2)); // +100 Pips DOL
      const rr1 = Number((5.0 / risk).toFixed(1));
      const rr2 = Number(((entry - tp2) / risk).toFixed(1));

      return {
        side: 'SELL',
        signalType: -1,
        signalName: '🔴 SNIPER SELL (M5 3-CANDLE ABSORPTION)',
        status: 'READY',
        mathZone: inPremium ? `PREMIUM EKSTREM (${rangePct}%)` : `SWEEP PLAFON @ ${patternHigh.toFixed(2)}`,
        entry,
        sl,
        tp1,
        tp2,
        risk,
        rr1,
        rr2,
        reasons: [
          `Detektor 3-Candle M5: Serapan ekor atas (rejection wick) di plafon ekstrem $${patternHigh.toFixed(2)}.`,
          `Displacement merah M5 memicu konfirmasi Micro-MSS menuju likuiditas bawah.`,
          `Target Presisi 100 Pips Sayang: TP1 +50 Pips ($${tp1.toFixed(2)}) kunci profit & TP2 +100 Pips DOL ($${tp2.toFixed(2)}).`
        ],
        reclaimed: true
      };
    }
  }

  return null;
}

export function dashboardContextV4Rows(amy, context = null) {
  const d = amy?.dashboard;
  const ctx = context || (typeof window !== 'undefined' ? window.AmyMarketContext : null);
  const levels = amy?.levels || ctx?.levels || ctx?.keyLevels || {};
  const currentPrice = (typeof window !== 'undefined' && Number.isFinite(Number(window.amyfxCurrentPrice)) && Number(window.amyfxCurrentPrice) > 0)
    ? Number(window.amyfxCurrentPrice)
    : (Number.isFinite(Number(amy?.currentPrice)) && Number(amy?.currentPrice) > 0)
    ? Number(amy.currentPrice)
    : (Number.isFinite(Number(ctx?.price)) && Number(ctx.price) > 0)
    ? Number(ctx.price)
    : (Number.isFinite(Number(d?.candle?.close)) && Number(d.candle.close) > 0)
    ? Number(d.candle.close)
    : (Number.isFinite(Number(lastCandle?.close)) && Number(lastCandle.close) > 0)
    ? Number(lastCandle.close)
    : 0;

  // 1. Timeframe Matrix Directions
  const isHtfBull = (ctx?.h1?.bias === 'BULLISH') || (d?.biasDir === 1);
  const isMtfBull = (ctx?.m15?.structure === 'BULLISH') || (d?.mssDir === 1);
  const isLtfBull = (ctx?.m5?.status === 'CONFIRMED' ? (ctx?.primary?.side === 'BUY') : Boolean(amy?.trigger?.bullBreak || amy?.trigger?.bullDisp || ((amy?.entry?.buy || 0) > (amy?.entry?.sell || 0))));

  const isFullBullAlign = isHtfBull && isMtfBull && isLtfBull;
  const isFullBearAlign = !isHtfBull && !isMtfBull && !isLtfBull;
  const isBullPullback = isHtfBull && (!isLtfBull || !isMtfBull);
  const isBearPullback = !isHtfBull && (isLtfBull || isMtfBull);

  // 2. Dealing Range & Percent
  const rHigh = Number(ctx?.m15?.dealingRange?.rangeHigh ?? d?.rangeHigh ?? d?.protectedHigh ?? levels?.bsl);
  const rLow = Number(ctx?.m15?.dealingRange?.rangeLow ?? d?.rangeLow ?? d?.protectedLow ?? levels?.ssl);
  const hasRange = Number.isFinite(rHigh) && Number.isFinite(rLow) && rHigh > rLow;
  const eqMid = hasRange ? (rHigh + rLow) / 2 : null;
  const rangePct = (hasRange && currentPrice > 0) ? Math.min(100, Math.max(0, Math.round(((currentPrice - rLow) / (rHigh - rLow)) * 100))) : 50;
  const isDiscount = rangePct < 47.5;
  const isPremium = rangePct > 52.5;
  const zoneLabel = isDiscount ? `DISCOUNT (<47.5%) [${rangePct}%]` : isPremium ? `PREMIUM (>52.5%) [${rangePct}%]` : `EQUILIBRIUM (50%) [${rangePct}%] · NO-TRADE ZONE`;

  // 3. Sweeps & Liquidity
  const sweep = detectLiquiditySweep(amy, ctx);
  const sslSwept = (sweep?.side === 'BUY' && (sweep.name === 'SSL' || sweep.name === 'PDL' || sweep.name === 'Asia Low')) || (d?.sweepStatus === 1 && d?.sweepDir === 1);
  const bslSwept = (sweep?.side === 'SELL' && (sweep.name === 'BSL' || sweep.name === 'PDH' || sweep.name === 'Asia High')) || (d?.sweepStatus === 1 && d?.sweepDir === -1);
  const pdhSwept = sweep?.name === 'PDH';
  const pdlSwept = sweep?.name === 'PDL';
  const asiaHighSwept = sweep?.name === 'Asia High';
  const asiaLowSwept = sweep?.name === 'Asia Low';

  // 4. Supply & Demand Zones (M15)
  const poi = d?.poi || ctx?.m15?.poi;
  const inBullDemand = (poi?.side === 'BUY' && (d?.poiLocation === -1 || (currentPrice > 0 && poi.low != null && poi.high != null && currentPrice >= poi.low && currentPrice <= poi.high)));
  const inBearSupply = (poi?.side === 'SELL' && (d?.poiLocation === 1 || (currentPrice > 0 && poi.low != null && poi.high != null && currentPrice >= poi.low && currentPrice <= poi.high)));

  // 5. Narrative Phase & Action Guide
  let phaseStatus = '';
  let actionGuide = '';
  let phaseClass = 'bias-val-gold';

  if (isHtfBull) {
    if (sslSwept || pdlSwept || asiaLowSwept) {
      phaseStatus = 'MANIPULASI BAWAH (SSL/PDL/Asia L Tersapu di Tren Bullish)';
      actionGuide = 'Likuiditas Bawah Sudah Diambil — Pantau CHoCH Naik di M5';
      phaseClass = 'bias-val-gold';
    } else if (isBullPullback && inBullDemand) {
      phaseStatus = 'PULLBACK DI ZONA DEMAND (HTF Bullish, LTF Turun Masuk POI)';
      actionGuide = 'Harga di Demand/Discount — JANGAN SELL! Tunggu M5 CHoCH Bullish';
      phaseClass = 'bias-val-gold';
    } else if (isBullPullback) {
      phaseStatus = 'FASE PULLBACK / KOREKSI TURUN (HTF Bullish vs M5 Bearish)';
      actionGuide = 'Penurunan Ini Koreksi Menuju Discount — Awas Jebakan Sell di Bawah!';
      phaseClass = 'bias-val-purple';
    } else if (rangePct >= 47.5 && rangePct <= 52.5) {
      phaseStatus = 'NO-TRADE ZONE (Harga di Poros Equilibrium 50%)';
      actionGuide = '🛡️ SOP ANTI-YES-MAN: DILARANG ENTRY! Diam & tunggu harga sweep Support / SSL (<47.5%) atau Resistance / BSL (>52.5%).';
      phaseClass = 'bias-val-purple';
    } else if (isFullBullAlign && isPremium) {
      phaseStatus = `EKSPANSI BULLISH DI AREA PREMIUM (${rangePct}%)`;
      actionGuide = 'Tren Naik Kuat Menuju BSL, Tapi Rawan Pullback (Jangan FOMO Buy di Pucuk)';
      phaseClass = 'bias-val-bull';
    } else {
      phaseStatus = 'SEARAH BULLISH (HTF, M15, & M5 Kompak Naik)';
      actionGuide = 'Struktur Sehat Searah Menuju Magnet Likuiditas Atas (BSL / PDH)';
      phaseClass = 'bias-val-bull';
    }
  } else {
    if (bslSwept || pdhSwept || asiaHighSwept) {
      phaseStatus = 'MANIPULASI ATAS (BSL/PDH/Asia H Tersapu di Tren Bearish)';
      actionGuide = 'Likuiditas Atas Sudah Diambil — Pantau CHoCH Turun di M5';
      phaseClass = 'bias-val-gold';
    } else if (isBearPullback && inBearSupply) {
      phaseStatus = 'PULLBACK DI ZONA SUPPLY (HTF Bearish, LTF Naik Masuk POI)';
      actionGuide = 'Harga di Supply/Premium — JANGAN BUY! Tunggu M5 CHoCH Bearish';
      phaseClass = 'bias-val-gold';
    } else if (isBearPullback) {
      phaseStatus = 'FASE PULLBACK / KOREKSI NAIK (HTF Bearish vs M5 Bullish)';
      actionGuide = 'Kenaikan Ini Koreksi Menuju Premium — Awas Jebakan Buy di Pucuk!';
      phaseClass = 'bias-val-purple';
    } else if (rangePct >= 47.5 && rangePct <= 52.5) {
      phaseStatus = 'NO-TRADE ZONE (Harga di Poros Equilibrium 50%)';
      actionGuide = '🛡️ SOP ANTI-YES-MAN: DILARANG ENTRY! Diam & tunggu harga sweep Support / SSL (<47.5%) atau Resistance / BSL (>52.5%).';
      phaseClass = 'bias-val-purple';
    } else if (isFullBearAlign && isDiscount) {
      phaseStatus = `EKSPANSI BEARISH DI AREA DISCOUNT (${rangePct}%)`;
      actionGuide = 'Tren Turun Kuat Menuju SSL, Tapi Rawan Pullback (Jangan FOMO Sell di Dasar)';
      phaseClass = 'bias-val-bear';
    } else {
      phaseStatus = 'SEARAH BEARISH (HTF, M15, & M5 Kompak Turun)';
      actionGuide = 'Struktur Sehat Searah Menuju Magnet Likuiditas Bawah (SSL / PDL)';
      phaseClass = 'bias-val-bear';
    }
  }

  // Row 1: MATRIKS 3-TIMEFRAME
  const tfMatrix = `H1 (Major): ${isHtfBull ? 'BULLISH' : 'BEARISH'}  |  M15 (Swing): ${isMtfBull ? 'BULLISH' : 'BEARISH'}  |  M5 (Orderflow): ${isLtfBull ? 'BULLISH' : 'BEARISH'}`;
  const tfMatrixClass = isHtfBull ? 'bias-val-bull' : 'bias-val-bear';

  // Row 3: DEALING RANGE & ZONA
  const rngInfo = hasRange
    ? `${zoneLabel}  |  Range: ${n(rLow)} - ${n(rHigh)} (EQ: ${n(eqMid)})`
    : '—';
  const rngClass = (isHtfBull && isDiscount) || (!isHtfBull && isPremium) ? 'bias-val-bull' : '';

  // Row 4: MAGNET ATAS (BSL/PDH)
  const bslVal = Number(levels?.bsl ?? d?.bsl ?? rHigh);
  const pdhVal = Number(levels?.pdh ?? ctx?.keyLevels?.pdh);
  const distBSL = (Number.isFinite(bslVal) && currentPrice > 0) ? Math.abs(bslVal - currentPrice) : null;
  const bslInfo = `M15 BSL: ${n(bslVal)}${distBSL != null ? ` ($${distBSL.toFixed(2)})` : ''}${bslSwept ? ' [SWEPT]' : ''}  |  PDH: ${n(pdhVal)}${pdhSwept ? ' [SWEPT]' : ''}`;
  const bslClass = (bslSwept || pdhSwept) ? 'bias-val-gold' : (isHtfBull ? 'bias-val-cyan' : '');

  // Row 5: MAGNET BAWAH (SSL/PDL)
  const sslVal = Number(levels?.ssl ?? d?.ssl ?? rLow);
  const pdlVal = Number(levels?.pdl ?? ctx?.keyLevels?.pdl);
  const distSSL = (Number.isFinite(sslVal) && currentPrice > 0) ? Math.abs(currentPrice - sslVal) : null;
  const sslInfo = `M15 SSL: ${n(sslVal)}${distSSL != null ? ` ($${distSSL.toFixed(2)})` : ''}${sslSwept ? ' [SWEPT]' : ''}  |  PDL: ${n(pdlVal)}${pdlSwept ? ' [SWEPT]' : ''}`;
  const sslClass = (sslSwept || pdlSwept) ? 'bias-val-gold' : (!isHtfBull ? 'bias-val-cyan' : '');

  // Row 6: SESI & ASIA RANGE
  const sessName = ctx?.session || 'LONDON';
  const asiaHigh = Number(levels?.asiaHigh ?? ctx?.keyLevels?.asiaHigh);
  const asiaLow = Number(levels?.asiaLow ?? ctx?.keyLevels?.asiaLow);
  const asiaStat = asiaHighSwept ? 'Asia High Swept' : asiaLowSwept ? 'Asia Low Swept' : 'Dalam Range';
  const sessInfo = `Sesi Aktif: ${sessName}  |  Asia H/L: ${n(asiaHigh)} / ${n(asiaLow)} (${asiaStat})`;
  const sessClass = (asiaHighSwept || asiaLowSwept) ? 'bias-val-gold' : '';

  // Row 7: INDUCEMENT (IDM)
  const idmVal = isHtfBull
    ? (Number(d?.protectedLow) || (poi?.side === 'BUY' ? Number(poi.low) : null))
    : (Number(d?.protectedHigh) || (poi?.side === 'SELL' ? Number(poi.high) : null));
  const idmSwept = (d?.sweepStatus === 1) || (isHtfBull ? sslSwept : bslSwept);
  const idmInfo = Number.isFinite(idmVal)
    ? `IDM (M15): ${n(idmVal)} ${idmSwept ? '[SUDAH DISAPU — POI di Belakangnya Valid]' : '[BELUM DISAPU — Waspada Umpan Likuiditas]'}`
    : 'Menunggu Pembentukan Swing IDM';
  const idmClass = idmSwept ? 'bias-val-bull' : 'bias-val-gold';

  // Row 8: ZONA SUPPLY (M15)
  const bearOB = (poi?.side === 'SELL' && poi?.kind === 'OB') ? poi : null;
  const bearFVG = (poi?.side === 'SELL' && poi?.kind === 'FVG') ? poi : null;
  const supObTxt = bearOB ? `${n(bearOB.low)}-${n(bearOB.high)}` : 'Mitigated';
  const supFvgTxt = bearFVG ? `${n(bearFVG.low)}-${n(bearFVG.high)}` : 'Mitigated';
  const supInfo = `Supply OB: ${supObTxt}  |  Bear FVG: ${supFvgTxt}${inBearSupply ? '  [HARGA DI DALAM SUPPLY!]' : ''}`;
  const supClass = inBearSupply ? 'bias-val-bear' : '';

  // Row 9: ZONA DEMAND (M15)
  const bullOB = (poi?.side === 'BUY' && poi?.kind === 'OB') ? poi : null;
  const bullFVG = (poi?.side === 'BUY' && poi?.kind === 'FVG') ? poi : null;
  const demObTxt = bullOB ? `${n(bullOB.low)}-${n(bullOB.high)}` : 'Mitigated';
  const demFvgTxt = bullFVG ? `${n(bullFVG.low)}-${n(bullFVG.high)}` : 'Mitigated';
  const demInfo = `Demand OB: ${demObTxt}  |  Bull FVG: ${demFvgTxt}${inBullDemand ? '  [HARGA DI DALAM DEMAND!]' : ''}`;
  const demClass = inBullDemand ? 'bias-val-bull' : '';

  // Row 10: BATAS CHoCH (H1)
  const htfLow = Number(ctx?.h1?.swingLow ?? ctx?.h1?.protectedLevel ?? (hasRange ? rLow - 10 : 2630));
  const htfHigh = Number(ctx?.h1?.swingHigh ?? ctx?.h1?.protectedLevel ?? (hasRange ? rHigh + 10 : 2685));
  const invInfo = `HTF Bullish Batal Jika Tutup < ${n(htfLow)}  |  HTF Bearish Batal Jika Tutup > ${n(htfHigh)}`;

  return [
    ['MATRIKS 3-TIMEFRAME', tfMatrix, tfMatrixClass],
    ['FASE NARASI MARKET', phaseStatus, phaseClass],
    ['DEALING RANGE & ZONA', rngInfo, rngClass],
    ['MAGNET ATAS (BSL/PDH)', bslInfo, bslClass],
    ['MAGNET BAWAH (SSL/PDL)', sslInfo, sslClass],
    ['SESI & ASIA RANGE', sessInfo, sessClass],
    ['INDUCEMENT (IDM)', idmInfo, idmClass],
    ['ZONA SUPPLY (M15)', supInfo, supClass],
    ['ZONA DEMAND (M15)', demInfo, demClass],
    ['BATAS CHoCH (H1)', invInfo, ''],
    ['PANDUAN KONTEKS', actionGuide, phaseClass]
  ];
}

export function dashboardContextV6Rows(amy, context = null) {
  const d = amy?.dashboard;
  const ctx = context || (typeof window !== 'undefined' ? window.AmyMarketContext : null);
  const ind = (typeof window !== 'undefined' ? window.amyfxLastIndicators : null);
  const chartCandles = (typeof window !== 'undefined' && Array.isArray(window.amyfxLastCandles) && window.amyfxLastCandles.length > 0)
    ? window.amyfxLastCandles
    : (Array.isArray(amy?.chartCandles) ? amy.chartCandles : []);

  let candleHigh = null;
  let candleLow = null;
  if (chartCandles.length > 0) {
    const slice = chartCandles.slice(-80);
    candleHigh = Math.max(...slice.map(c => Number(c.high)));
    candleLow = Math.min(...slice.map(c => Number(c.low)));
  }

  const levels = amy?.levels || ctx?.levels || ctx?.keyLevels || {};
  const currentPrice = (typeof window !== 'undefined' && Number.isFinite(Number(window.amyfxCurrentPrice)) && Number(window.amyfxCurrentPrice) > 0)
    ? Number(window.amyfxCurrentPrice)
    : (Number.isFinite(Number(amy?.currentPrice)) && Number(amy?.currentPrice) > 0)
    ? Number(amy.currentPrice)
    : (Number.isFinite(Number(ctx?.price)) && Number(ctx.price) > 0)
    ? Number(ctx.price)
    : (Number.isFinite(Number(d?.candle?.close)) && Number(d.candle.close) > 0)
    ? Number(d.candle.close)
    : (Number.isFinite(Number(lastCandle?.close)) && Number(lastCandle.close) > 0)
    ? Number(lastCandle.close)
    : 0;

  // 1. 3-TF Order Flow
  const isHtfBull = (ind?.structure?.trend === 'BULL') || (ctx?.h1?.bias === 'BULLISH') || (d?.biasDir === 1);
  const isMtfBull = (ind?.keyLevels?.trend === 'BULL') || (ctx?.m15?.structure === 'BULLISH') || (d?.mssDir === 1);
  const isLtfBull = (ctx?.m5?.status === 'CONFIRMED' ? (ctx?.primary?.side === 'BUY') : Boolean(amy?.trigger?.bullBreak || amy?.trigger?.bullDisp || ((amy?.entry?.buy || 0) > (amy?.entry?.sell || 0))));

  const isFullBullAlign = isHtfBull && isMtfBull && isLtfBull;
  const isFullBearAlign = !isHtfBull && !isMtfBull && !isLtfBull;
  const isBullPullback = isHtfBull && (!isLtfBull || !isMtfBull);
  const isBearPullback = !isHtfBull && (isLtfBull || isMtfBull);

  // 2. Dealing Range & Percent (prioritize live chart candles / indicators over stale server numbers)
  const indHigh = ind?.keyLevels?.pdHigh || candleHigh;
  const indLow = ind?.keyLevels?.pdLow || candleLow;
  const ctxHigh = Number(ctx?.m15?.dealingRange?.rangeHigh ?? ctx?.keyLevels?.rangeHigh);
  const ctxLow = Number(ctx?.m15?.dealingRange?.rangeLow ?? ctx?.keyLevels?.rangeLow);

  const rHigh = (Number.isFinite(indHigh) && indHigh > 0 && (!currentPrice || Math.abs(indHigh - currentPrice) < 80))
    ? indHigh
    : (Number.isFinite(ctxHigh) && ctxHigh > 0 && (!currentPrice || Math.abs(ctxHigh - currentPrice) < 80))
    ? ctxHigh
    : Number(d?.rangeHigh ?? d?.protectedHigh ?? levels?.bsl);

  const rLow = (Number.isFinite(indLow) && indLow > 0 && (!currentPrice || Math.abs(currentPrice - indLow) < 80))
    ? indLow
    : (Number.isFinite(ctxLow) && ctxLow > 0 && (!currentPrice || Math.abs(currentPrice - ctxLow) < 80))
    ? ctxLow
    : Number(d?.rangeLow ?? d?.protectedLow ?? levels?.ssl);

  const hasRange = Number.isFinite(rHigh) && Number.isFinite(rLow) && rHigh > rLow;
  const eqMid = hasRange ? (rHigh + rLow) / 2 : null;
  const rangePct = (hasRange && currentPrice > 0) ? Math.min(100, Math.max(0, Math.round(((currentPrice - rLow) / (rHigh - rLow)) * 100))) : 50;
  const isDiscount = rangePct < 47.5;
  const isPremium = rangePct > 52.5;
  const zoneLabel = isDiscount ? `DISCOUNT (<47.5%) [${rangePct}%]` : isPremium ? `PREMIUM (>52.5%) [${rangePct}%]` : `EQUILIBRIUM (50%) [${rangePct}%]`;

  if (typeof window !== 'undefined') {
    window.amyfxLastDealingRange = {
      rHigh,
      rLow,
      rangeHigh: rHigh,
      rangeLow: rLow,
      eq: eqMid,
      equilibrium: eqMid,
      location: isDiscount ? 'DISCOUNT' : isPremium ? 'PREMIUM' : 'EQUILIBRIUM'
    };
  }

  // 3. Batas Ekspansi (Std Dev -2.0 & -4.0 ala AMY ICT V6.1)
  const atrVal = Number(d?.atr || ctx?.volatility?.atr || 5.0);
  const legRange = hasRange ? Math.max(rHigh - rLow, atrVal * 2) : (atrVal * 3);
  const expNorm = ind?.expansion?.expNorm ?? (isMtfBull ? (rHigh + legRange * 1.0) : (rLow - legRange * 1.0));
  const expMax = ind?.expansion?.expMax ?? (isMtfBull ? (rHigh + legRange * 2.5) : (rLow - legRange * 2.5));
  const hitExpNorm = isMtfBull ? (currentPrice >= expNorm) : (currentPrice <= expNorm);
  const hitExpMax = isMtfBull ? (currentPrice >= expMax) : (currentPrice <= expMax);

  // 4. Sweeps & Liquidity
  const sweep = detectLiquiditySweep(amy, ctx);
  const sslSwept = (sweep?.side === 'BUY' && (sweep.name === 'SSL' || sweep.name === 'PDL' || sweep.name === 'Asia Low')) || (d?.sweepStatus === 1 && d?.sweepDir === 1);
  const bslSwept = (sweep?.side === 'SELL' && (sweep.name === 'BSL' || sweep.name === 'PDH' || sweep.name === 'Asia High')) || (d?.sweepStatus === 1 && d?.sweepDir === -1);
  const pdhSwept = sweep?.name === 'PDH' || Boolean(ind?.keyLevels?.pdhConsumed);
  const pdlSwept = sweep?.name === 'PDL' || Boolean(ind?.keyLevels?.pdlConsumed);
  const asiaHighSwept = sweep?.name === 'Asia High' || Boolean(ind?.keyLevels?.asiaHighConsumed);
  const asiaLowSwept = sweep?.name === 'Asia Low' || Boolean(ind?.keyLevels?.asiaLowConsumed);

  // 5. Supply & Demand (PDA)
  const indOb = ind?.poi?.ob?.[0];
  const indFvg = ind?.poi?.fvg?.[0];
  const poi = indOb || indFvg || d?.poi || ctx?.m15?.poi;
  const inBullDemand = (poi?.side === 'BUY' && (d?.poiLocation === -1 || (currentPrice > 0 && poi.low != null && poi.high != null && currentPrice >= poi.low && currentPrice <= poi.high)));
  const inBearSupply = (poi?.side === 'SELL' && (d?.poiLocation === 1 || (currentPrice > 0 && poi.low != null && poi.high != null && currentPrice >= poi.low && currentPrice <= poi.high)));
  const rejBullDemand = !inBullDemand && poi?.side === 'BUY' && currentPrice > (poi.high || 0) && (currentPrice - (poi.high || 0)) <= atrVal;
  const rejBearSupply = !inBearSupply && poi?.side === 'SELL' && currentPrice < (poi.low || 0) && ((poi.low || 0) - currentPrice) <= atrVal;

  // 6. Inducement (IDM)
  const idmVal = ind?.idm?.level ?? (isHtfBull
    ? (Number(d?.protectedLow) || (poi?.side === 'BUY' ? Number(poi.low) : (rLow + atrVal * 0.5)))
    : (Number(d?.protectedHigh) || (poi?.side === 'SELL' ? Number(poi.high) : (rHigh - atrVal * 0.5))));
  const idmSwept = (ind?.idm?.swept === true) || (d?.sweepStatus === 1) || (isHtfBull ? sslSwept : bslSwept);

  // 7. Narasi Fase Market & Action Guide
  let phaseStatus = '';
  let actionGuide = '';
  let phaseClass = 'bias-val-gold';

  if (isHtfBull) {
    if (inBullDemand) {
      phaseStatus = 'DI ZONA BELI ICT: Menguji Demand / Bullish OB' + (idmSwept ? ' (IDM Swept!)' : '');
      actionGuide = 'Harga di Zona Beli — JANGAN SELL! Tunggu Konfirmasi MSS Naik M5';
      phaseClass = 'bias-val-gold';
    } else if (rejBullDemand) {
      phaseStatus = 'REJEKSI DARI DEMAND / +OB (Memantul Naik)';
      actionGuide = 'Demand Menahan Harga — Ikuti Order Flow Naik di M5';
      phaseClass = 'bias-val-bull';
    } else if (hitExpMax && isMtfBull) {
      phaseStatus = 'BATAS NAIK (HABIS) TERCAPAI (Klimaks Ekspansi)';
      actionGuide = 'Ekspansi Mencapai Batas Habis — DILARANG BUY DI PUCUK!';
      phaseClass = 'bias-val-gold';
    } else if (hitExpNorm && isMtfBull) {
      phaseStatus = 'TARGET NAIK (NORMAL) TERCAPAI (Waspada Pullback)';
      actionGuide = 'Target Normal Tercapai — Amankan Profit / Tunggu Retracement';
      phaseClass = 'bias-val-bull';
    } else if (sslSwept || pdlSwept || asiaLowSwept) {
      phaseStatus = 'JUDAS SWING / MANIPULASI SSL (Sweep Bawah di Tren Bullish)';
      actionGuide = 'Likuiditas Bawah Disapu — Tunggu Konfirmasi M5 MSS Naik';
      phaseClass = 'bias-val-gold';
    } else if (isBullPullback) {
      phaseStatus = 'FASE PULLBACK / KOREKSI TURUN (HTF Bullish vs M5 Bearish)';
      actionGuide = isPremium ? 'Koreksi Wajar Menuju Discount — Cari Pantulan di Demand' : 'Harga Sudah di Discount — Pantau Rejeksi di Demand / +FVG';
      phaseClass = 'bias-val-purple';
    } else {
      phaseStatus = 'EKSPANSI BULLISH SEARAH (H1 / M15 / M5 Kompak Naik)';
      actionGuide = 'Order Flow Naik Menuju Target Normal & BSL';
      phaseClass = 'bias-val-bull';
    }
  } else {
    if (inBearSupply) {
      phaseStatus = 'DI ZONA JUAL ICT: Menguji Supply / Bearish OB' + (idmSwept ? ' (IDM Swept!)' : '');
      actionGuide = 'Harga di Zona Jual — JANGAN BUY! Tunggu Konfirmasi MSS Turun M5';
      phaseClass = 'bias-val-gold';
    } else if (rejBearSupply) {
      phaseStatus = 'REJEKSI DARI SUPPLY / -OB (Memantul Turun)';
      actionGuide = 'Supply Menolak Harga — Ikuti Order Flow Turun di M5';
      phaseClass = 'bias-val-bear';
    } else if (hitExpMax && !isMtfBull) {
      phaseStatus = 'BATAS TURUN (HABIS) TERCAPAI (Klimaks Ekspansi)';
      actionGuide = 'Ekspansi Mencapai Batas Habis — DILARANG SELL DI DASAR!';
      phaseClass = 'bias-val-gold';
    } else if (hitExpNorm && !isMtfBull) {
      phaseStatus = 'TARGET TURUN (NORMAL) TERCAPAI (Waspada Pullback)';
      actionGuide = 'Target Normal Tercapai — Amankan Profit / Tunggu Retracement';
      phaseClass = 'bias-val-bear';
    } else if (bslSwept || pdhSwept || asiaHighSwept) {
      phaseStatus = 'JUDAS SWING / MANIPULASI BSL (Sweep Atas di Tren Bearish)';
      actionGuide = 'Likuiditas Atas Disapu — Tunggu Konfirmasi M5 MSS Turun';
      phaseClass = 'bias-val-gold';
    } else if (isBearPullback) {
      phaseStatus = 'FASE PULLBACK / KOREKSI NAIK (HTF Bearish vs M5 Bullish)';
      actionGuide = 'Pantulan Koreksi Naik Menuju Premium — Awas Jebakan Buy di Pucuk!';
      phaseClass = 'bias-val-purple';
    } else {
      phaseStatus = 'EKSPANSI BEARISH SEARAH (H1 / M15 / M5 Kompak Turun)';
      actionGuide = 'Order Flow Turun Menuju Target Normal & SSL';
      phaseClass = 'bias-val-bear';
    }
  }

  // 8. Format Rows (AMY ICT V6.1 Standard)
  const tfMatrix = `H1: ${isHtfBull ? 'BULL' : 'BEAR'}  |  M15: ${isMtfBull ? 'BULL' : 'BEAR'}  |  M5: ${isLtfBull ? 'BULL' : 'BEAR'}`;
  const tfMatrixClass = isHtfBull ? 'bias-val-bull' : 'bias-val-bear';

  const expDirName = isMtfBull ? 'Naik' : 'Turun';
  const expStatTxt = `Target ${expDirName} (Normal): ${n(expNorm)} ${hitExpNorm ? '[Tercapai]' : ''}  |  Batas Habis: ${n(expMax)} ${hitExpMax ? '[Klimaks!]' : ''}`;
  const expClass = hitExpMax ? 'bias-val-gold' : hitExpNorm ? 'bias-val-cyan' : '';

  const rngInfo = hasRange ? `${zoneLabel}  |  ${n(rLow)} - ${n(rHigh)} (EQ: ${n(eqMid)})` : '—';
  const rngClass = (isHtfBull && isDiscount) || (!isHtfBull && isPremium) ? 'bias-val-bull' : '';

  const bslVal = Number(ind?.liquidity?.bsl?.[0]?.level ?? levels?.bsl ?? d?.bsl ?? rHigh);
  const pdhVal = Number(ind?.keyLevels?.pdh ?? levels?.pdh ?? ctx?.keyLevels?.pdh);
  const pwhVal = Number(ind?.keyLevels?.pwh ?? levels?.pwh ?? ctx?.keyLevels?.pwh);
  const pwhSwept = (Number.isFinite(pwhVal) && currentPrice > 0 && pwhVal <= currentPrice) || Boolean(ind?.keyLevels?.pwhConsumed);
  const pwhTag = Number.isFinite(pwhVal) ? `  |  PWH: ${n(pwhVal)}${pwhSwept ? ' [SWEPT]' : ''}` : '';
  const bslInfo = `M15 BSL: ${n(bslVal)}${bslSwept ? ' [SWEPT]' : ''}  |  PDH: ${n(pdhVal)}${pdhSwept ? ' [SWEPT]' : ''}${pwhTag}`;
  const bslClass = (bslSwept || pdhSwept) ? 'bias-val-gold' : (isHtfBull ? 'bias-val-cyan' : '');

  const sslVal = Number(ind?.liquidity?.ssl?.[0]?.level ?? levels?.ssl ?? d?.ssl ?? rLow);
  const pdlVal = Number(ind?.keyLevels?.pdl ?? levels?.pdl ?? ctx?.keyLevels?.pdl);
  const pwlVal = Number(ind?.keyLevels?.pwl ?? levels?.pwl ?? ctx?.keyLevels?.pwl);
  const sslInfo = `M15 SSL: ${n(sslVal)}${sslSwept ? ' [SWEPT]' : ''}  |  PDL: ${n(pdlVal)}${pdlSwept ? ' [SWEPT]' : ''}  |  PWL: ${n(pwlVal)}`;
  const sslClass = (sslSwept || pdlSwept) ? 'bias-val-gold' : (!isHtfBull ? 'bias-val-cyan' : '');

  const curDate = new Date();
  const curHourWITA = (curDate.getUTCHours() + 8) % 24;
  const isAsiaTime = curHourWITA >= 8 && curHourWITA < 16;
  const isLondonTime = curHourWITA >= 16 && curHourWITA < 20;
  const isNYTime = (curHourWITA >= 20 && curHourWITA <= 23) || curHourWITA === 0;
  const defaultSessName = isAsiaTime ? 'ASIA' : isLondonTime ? 'LONDON' : isNYTime ? 'NEW YORK' : 'OFF_SESSION';
  const sessName = (ctx?.session && ctx.session !== 'DI LUAR JAM INTI' && ctx.session !== 'LONDON')
    ? ctx.session
    : defaultSessName;
  const asiaHigh = Number(ind?.keyLevels?.asiaHigh ?? levels?.asiaHigh ?? ctx?.keyLevels?.asiaHigh);
  const asiaLow = Number(ind?.keyLevels?.asiaLow ?? levels?.asiaLow ?? ctx?.keyLevels?.asiaLow);
  const asiaStat = asiaHighSwept ? 'Asia H Swept' : asiaLowSwept ? 'Asia L Swept' : 'In Range';
  const sessInfo = `${sessName}  |  Asia: ${n(asiaLow)} - ${n(asiaHigh)} (${asiaStat})`;
  const sessClass = (asiaHighSwept || asiaLowSwept) ? 'bias-val-gold' : '';

  const idmInfo = Number.isFinite(idmVal)
    ? `${n(idmVal)} ${idmSwept ? '[SUDAH DISAPU — Origin OB Valid]' : '[BELUM DISAPU — Awas Inducement]'}`
    : 'Menunggu Internal Pullback';
  const idmClass = idmSwept ? 'bias-val-bull' : 'bias-val-gold';

  const bearOB = (poi?.side === 'SELL' && poi?.kind === 'OB') ? poi : null;
  const bearFVG = (poi?.side === 'SELL' && poi?.kind === 'FVG') ? poi : null;
  const supObTxt = bearOB ? `${n(bearOB.low)}-${n(bearOB.high)} [Fresh]` : 'Mitigated';
  const supFvgTxt = bearFVG ? `${n(bearFVG.low)}-${n(bearFVG.high)}` : 'Mitigated';
  const supInfo = `-OB: ${supObTxt}  |  -FVG: ${supFvgTxt}${inBearSupply ? '  [DI ZONA!]' : ''}`;
  const supClass = inBearSupply ? 'bias-val-bear' : '';

  const bullOB = (poi?.side === 'BUY' && poi?.kind === 'OB') ? poi : null;
  const bullFVG = (poi?.side === 'BUY' && poi?.kind === 'FVG') ? poi : null;
  const demObTxt = bullOB ? `${n(bullOB.low)}-${n(bullOB.high)} [Fresh]` : 'Mitigated';
  const demFvgTxt = bullFVG ? `${n(bullFVG.low)}-${n(bullFVG.high)}` : 'Mitigated';
  const demInfo = `+OB: ${demObTxt}  |  +FVG: ${demFvgTxt}${inBullDemand ? '  [DI ZONA!]' : ''}`;
  const demClass = inBullDemand ? 'bias-val-bull' : '';

  const htfLow = Number(ctx?.h1?.swingLow ?? ctx?.h1?.protectedLevel ?? (hasRange ? rLow - 10 : 2630));
  const htfHigh = Number(ctx?.h1?.swingHigh ?? ctx?.h1?.protectedLevel ?? (hasRange ? rHigh + 10 : 2685));
  const nwogVal = Number(levels?.nwog ?? ctx?.keyLevels?.nwog);
  const nwogTag = Number.isFinite(nwogVal) ? `  |  NWOG: ${n(nwogVal)}` : '';
  const htfWallTxt = `H1 -OB: ${n(htfHigh)}  |  H1 +OB: ${n(htfLow)}${nwogTag}`;

  const invInfo = isHtfBull ? `H1 Batal Bull < ${n(htfLow)}` : `H1 Batal Bear > ${n(htfHigh)}`;

  const buyZoneName = inBullDemand ? 'Di Origin +OB -> Tunggu MSS M5' : 'Demand M15 / +FVG';
  const sellZoneName = inBearSupply ? 'Di Origin -OB -> Tunggu MSS M5' : 'Supply M15 / -FVG';
  let entryRecTxt = '';
  if (isHtfBull) {
    entryRecTxt = !isMtfBull ? `Buy H1: ${buyZoneName}  |  Sell M15: ${sellZoneName}` : `Fokus Buy (H1/M15): ${buyZoneName}`;
  } else {
    entryRecTxt = isMtfBull ? `Sell H1: ${sellZoneName}  |  Buy M15: ${buyZoneName}` : `Fokus Sell (H1/M15): ${sellZoneName}`;
  }
  const recClass = (inBullDemand || inBearSupply) ? 'bias-val-gold' : isHtfBull ? 'bias-val-bull' : 'bias-val-bear';

  return [
    ['3-TF ORDER FLOW', tfMatrix, tfMatrixClass],
    ['FASE MARKET', phaseStatus, phaseClass],
    ['BATAS EKSPANSI', expStatTxt, expClass],
    ['DEALING RANGE & ZONA', rngInfo, rngClass],
    ['DRAW ON LIQ (BSL)', bslInfo, bslClass],
    ['DRAW ON LIQ (SSL)', sslInfo, sslClass],
    ['KILLZONE & ASIA', sessInfo, sessClass],
    ['INDUCEMENT (IDM)', idmInfo, idmClass],
    ['BEARISH PDA (M15)', supInfo, supClass],
    ['BULLISH PDA (M15)', demInfo, demClass],
    ['JEJAK HTF & NWOG', htfWallTxt, ''],
    ['BATAS MSS / CHoCH', invInfo, ''],
    ['TARGET ENTRY (2-ARAH)', entryRecTxt, recClass],
    ['PANDUAN KONTEKS ICT', actionGuide, phaseClass]
  ];
}

export function renderLiveAssistant(amy,news=null,settings={},context=null){
  const root=document.getElementById('amy-live-assistant');
  const badgeEl=document.getElementById('assistant-badge');
  const primaryEl=document.getElementById('assistant-primary-msg');
  const subEl=document.getElementById('assistant-sub-msg');
  const confEl=document.getElementById('assistant-confluence-tag');
  const clockEl=document.getElementById('assistant-clock');
  if(!root||!badgeEl||!primaryEl||!subEl)return;

  const ctx=context||(typeof window!=='undefined'?window.AmyMarketContext:null);
  const marketOpen = typeof ctx?.isMarketOpen === 'boolean' ? ctx.isMarketOpen : isGoldMarketOpen(ctx?.nowSeconds);
  const isClosed=!marketOpen||ctx?.session==='PASAR TUTUP'||(typeof window!=='undefined'&&window.AmyMarketContext?.session==='PASAR TUTUP');

  if(isClosed){
    badgeEl.textContent='PASAR TUTUP';
    badgeEl.className='assistant-badge badge-neutral';
    root.className='amy-live-assistant';
    primaryEl.textContent='Pasar Gold (XAU/USD) Sedang Tutup';
    subEl.textContent='Perdagangan libur akhir pekan / di luar jam pasar. Notifikasi live dinonaktifkan hingga sesi buka.';
    if(confEl)confEl.innerHTML='Status: <strong style="color:#94A3B8">OFFLINE</strong> (Weekend)';
    if(clockEl)clockEl.textContent='Market Closed';
    return;
  }

  if(!amy){
    badgeEl.textContent='STANDBY';
    badgeEl.className='assistant-badge badge-neutral';
    root.className='amy-live-assistant';
    primaryEl.textContent='Memeriksa aksi harga M15...';
    subEl.textContent='Menunggu data candle tertutup server.';
    if(confEl)confEl.textContent='Confluence: —';
    if(clockEl)clockEl.textContent='Live Sync';
    return;
  }

  const d=amy.dashboard,e=amy.entry,ast=amy.assistant||null,plan=ast?.plan||amy.plan||null;
  const lines=(e?.text||'').split('\n').map(s=>s.trim()).filter(Boolean);
  let badge='STANDBY',badgeClass='badge-neutral',stateClass='';
  let primary=lines[0]||'Kondisi pasar seimbang';
  let sub='Menunggu konfirmasi candle tertutup.';
  let notify=false,notifTitle='',notifBody='';
  const nowSec = Math.floor(Date.now() / 1000);

  const mathZoneText=ast?.mathZone||(d?.priceZone===-1?'Diskon (Discount Zone)':d?.priceZone===1?'Premium Zone':'Equilibrium Zone');
  const antiChaseText=ast?.status==='READY'?'READY DI ZONA':ast?.status==='MISSED'?'MISSED - JANGAN KEJAR':'STANDBY';
  const sweepInfo=detectLiquiditySweep(amy,context);
  const sniperTrigger=detectM5SniperTrigger(amy,context);

  const planFormedSec = plan?.formedAt ? Math.floor(new Date(plan.formedAt).getTime() / 1000) : null;
  const isPlanFresh = !planFormedSec || (nowSec - planFormedSec >= 0 && nowSec - planFormedSec <= 900);
  const lastBreakSec = Number(context?.m15?.lastBreak?.time || 0);
  const isInvalidFresh = !lastBreakSec || (nowSec - lastBreakSec >= 0 && nowSec - lastBreakSec <= 900);

  if(news?.status==='NEWS_LOCK'){
    badge='NEWS LOCK';badgeClass='badge-news';stateClass='assistant-state-news';
    primary='🛡️ Tunda Eksekusi: Berita High-Impact Berlangsung';
    sub=news.note||'Pasar sangat liar dan rawan slippage. Jangan entry sebelum volatilitas stabil.';
    notify=true;notifTitle='🛡️ Asisten Amy: NEWS LOCK Aktif';notifBody=sub;
  }else if(d?.invalidStatus===2){
    badge='SETUP BATAL';badgeClass='badge-invalid';stateClass='assistant-state-invalid';
    primary='⚠️ Setup Batal: Harga Melewati Level Invalidasi';
    sub=`Close M15 menembus batas pembatalan ${d.invalidLevel?n(d.invalidLevel):''}. Tunggu pembentukan struktur baru.`;
    if(isInvalidFresh){
      notify=true;notifTitle='⚠️ Asisten Amy: Setup Batal (Invalid)';notifBody=sub;
    }
  }else if(sniperTrigger && (!ast || ast.status !== 'READY')){
    const isBuy=sniperTrigger.side==='BUY';
    const isMtfBearish=d?.dirMTF?d.dirMTF<0:(ctx?.m15?.dir?ctx.m15.dir<0:false);
    const isMtfBullish=d?.dirMTF?d.dirMTF>0:(ctx?.m15?.dir?ctx.m15.dir>0:false);
    const isCounterTrend=(isBuy&&isMtfBearish)||(!isBuy&&isMtfBullish);
    const confZone=amy?.confluence?.zone||ctx?.confluence?.zone||'';
    const confScore=Number(amy?.confluence?.score??ctx?.confluence?.score??0);
    const isNoEntry=confZone==='NO ENTRY'||(confScore>0&&confScore<60);

    if(isCounterTrend||isNoEntry){
      badge='PULLBACK WATCH';
      badgeClass='badge-neutral';
      stateClass='assistant-state-neutral';
      primary=`⚠️ PULLBACK KOREKTIF (M5 Reversal vs M15 ${isMtfBearish?'Bearish':'Bullish'})`;
      sub=`SOP Anti-Yes-Man: Pantulan M5 di area ${sniperTrigger.mathZone}. Dilarang FOMO ${isBuy?'Buy':'Sell'} — Tunggu konfirmasi struktur baru atau jemputan di zona ekstrem!`;
      notify=false;
    }else{
      badge=isBuy?'SNIPER BUY':'SNIPER SELL';
      badgeClass=isBuy?'badge-bull':'badge-bear';
      stateClass=isBuy?'assistant-state-bull':'assistant-state-bear';
      primary=`${isBuy?'🟢':'🔴'} SNIPER ${sniperTrigger.side} ENTRY · M5 Reversal`;
      sub=`Detektor 3-Candle M5: Terkonfirmasi @ ${sniperTrigger.mathZone}. Entry ${n(sniperTrigger.entry)} · Target 100 Pips Sayang`;
      notify=true;notifTitle=`⚡ Asisten Amy: ${badge}`;notifBody=`${primary}. ${sub}`;
    }
  }else if(ast&&(ast.signalType===1||(ast.rawSignalType===1&&ast.status==='READY'))){
    badge='BUY ENTRY';badgeClass='badge-bull';stateClass='assistant-state-bull';
    primary=`🟢 BUY ENTRY · ${ast.signalName||'Trend Buy'}`;
    sub=`Anti-Chase: READY · Math Zone: ${mathZoneText} · Entry ${plan?.entry!=null?n(plan.entry):'—'}`;
    if(isPlanFresh){
      notify=true;notifTitle='🟢 Asisten Amy: BUY ENTRY';notifBody=`${primary}. ${sub}`;
    }
  }else if(ast&&(ast.signalType===-1||(ast.rawSignalType===-1&&ast.status==='READY'))){
    badge='SELL ENTRY';badgeClass='badge-bear';stateClass='assistant-state-bear';
    primary=`🔴 SELL ENTRY · ${ast.signalName||'Trend Sell'}`;
    sub=`Anti-Chase: READY · Math Zone: ${mathZoneText} · Entry ${plan?.entry!=null?n(plan.entry):'—'}`;
    if(isPlanFresh){
      notify=true;notifTitle='🔴 Asisten Amy: SELL ENTRY';notifBody=`${primary}. ${sub}`;
    }
  }else if(ast&&(ast.signalType===-2||(ast.rawSignalType===-2&&ast.status==='READY'))){
    badge='PULLBACK SELL (CISD)';badgeClass='badge-bear';stateClass='assistant-state-bear';
    primary='🟠 PULLBACK SELL (CISD Pucuk Premium)';
    sub=`Anti-Chase: READY · CISD Terkonfirmasi · Entry ${plan?.entry!=null?n(plan.entry):'—'}`;
    if(isPlanFresh){
      notify=true;notifTitle='🟠 Asisten Amy: PULLBACK SELL (CISD)';notifBody=`${primary}. ${sub}`;
    }
  }else if(ast&&(ast.signalType===2||(ast.rawSignalType===2&&ast.status==='READY'))){
    badge='PULLBACK BUY (CISD)';badgeClass='badge-bull';stateClass='assistant-state-bull';
    primary='🔵 PULLBACK BUY (CISD Dasar Diskon)';
    sub=`Anti-Chase: READY · CISD Terkonfirmasi · Entry ${plan?.entry!=null?n(plan.entry):'—'}`;
    if(isPlanFresh){
      notify=true;notifTitle='🔵 Asisten Amy: PULLBACK BUY (CISD)';notifBody=`${primary}. ${sub}`;
    }
  }else if(ast&&ast.status==='MISSED'){
    badge='STANDBY';badgeClass='badge-warn';stateClass='assistant-state-sweep';
    primary=`⚠️ Sinyal ${ast.rawSignalType===1?'BUY':ast.rawSignalType===-1?'SELL':'PULLBACK'}: MISSED - JANGAN KEJAR`;
    sub=`Anti-Chase: MISSED - JANGAN KEJAR · Math Zone: ${mathZoneText} (Harga sudah menjauh)`;
  }else if(e?.rejectBuy||e?.rejectSell){
    const isBuy=Boolean(e?.rejectBuy);
    badge=isBuy?'BUY ENTRY':'SELL ENTRY';badgeClass=isBuy?'badge-bull':'badge-bear';
    stateClass=isBuy?'assistant-state-bull':'assistant-state-bear';
    primary=`🔥 Rejection Kuat di Area ${d?.poi?.kind||'POI'}`;
    sub=`Candle menolak ${isBuy?'bawah':'atas'} dengan wick panjang. Math Zone: ${mathZoneText} · Anti-Chase: ${antiChaseText}`;
    notify=true;notifTitle=`🔥 Asisten Amy: ${badge}`;notifBody=`${primary}. ${sub}`;
  }else if(sweepInfo){
    badge=`${sweepInfo.name.toUpperCase()} SWEPT`;
    badgeClass='badge-sweep';
    stateClass='assistant-state-sweep';
    primary=`💧 ${sweepInfo.name} @ ${n(sweepInfo.level)} Swept!`;
    sub=`Tersapu hingga ekor ${n(sweepInfo.extreme)}. Pantau pembentukan rejection untuk potensi ${sweepInfo.side}.`;
    const sweepAge = sweepInfo.time ? (nowSec - sweepInfo.time) : 0;
    const hasChartIndex = sweepInfo.index != null && Array.isArray(amy.chartCandles) && amy.chartCandles.length > 0;
    const isLatestBar = hasChartIndex
      ? (sweepInfo.index === amy.chartCandles.length - 1)
      : true;
    const isFresh = (sweepInfo.time ? (sweepAge >= 0 && sweepAge <= 900) : isLatestBar) && (!hasChartIndex || isLatestBar);
    if(isFresh){
      notify=true;
      notifTitle=`💧 Asisten Amy: ${sweepInfo.name} @ ${n(sweepInfo.level)} Swept!`;
      notifBody=`${primary} ${sub}`;
    }
  }else if(e?.importance === 4){
    const isBull = d?.biasDir === 1;
    const trg = amy?.trigger;
    const trgHigh = trg?.high;
    const trgLow = trg?.low;
    const lastBreak = ctx?.m15?.lastBreak;
    const breakKind = lastBreak?.kind || (isBull ? 'BOS Bullish' : 'BOS Bearish');
    const brokenLvl = isBull ? (trgHigh || lastBreak?.level || d?.protectedHigh) : (trgLow || lastBreak?.level || d?.protectedLow);
    const brokenStr = brokenLvl ? `@ ${n(brokenLvl)}` : '';
    const dolTgt = d?.dolTarget ? ` · Target DOL: ${n(d.dolTarget)}` : '';
    badge = isBull ? 'VALID BREAK BULL' : 'VALID BREAK BEAR';
    badgeClass = isBull ? 'badge-bull' : 'badge-bear';
    stateClass = isBull ? 'assistant-state-bull' : 'assistant-state-bear';
    primary = `✓ Valid Break ${isBull ? 'Bullish' : 'Bearish'} dengan Displacement: ${breakKind} ${brokenStr} Ditembus!`;
    sub = `Struktur M5 terkonfirmasi searah tren${dolTgt}. Siapkan observasi entry Sayang.`;
    notify = true;
    notifTitle = `✓ Asisten Amy: VALID BREAK ${isBull ? 'BULLISH' : 'BEARISH'} (${breakKind})`;
    notifBody = `${primary} ${sub}`;
  }else{
    const v4Rows = dashboardContextV4Rows(amy, context);
    const phaseRow = v4Rows.find(r => r[0] === 'FASE NARASI MARKET');
    const guideRow = v4Rows.find(r => r[0] === 'PANDUAN KONTEKS');
    if(phaseRow && guideRow && phaseRow[1]){
      primary = phaseRow[1];
      sub = guideRow[1];
      if(primary.includes('NO-TRADE ZONE') || primary.includes('ZONA CINCANG')){
        badge = 'NO-TRADE ZONE'; badgeClass = 'badge-warn'; stateClass = 'assistant-state-sweep';
      } else if(primary.includes('SEARAH BULLISH') || primary.includes('EKSPANSI BULLISH')){
        badge = 'SEARAH BULLISH'; badgeClass = 'badge-bull'; stateClass = 'assistant-state-bull';
      } else if(primary.includes('SEARAH BEARISH') || primary.includes('EKSPANSI BEARISH')){
        badge = 'SEARAH BEARISH'; badgeClass = 'badge-bear'; stateClass = 'assistant-state-bear';
      } else if(primary.includes('PULLBACK')){
        badge = 'FASE PULLBACK'; badgeClass = 'badge-warn'; stateClass = 'assistant-state-sweep';
      } else if(primary.includes('MANIPULASI')){
        badge = 'MANIPULASI'; badgeClass = 'badge-sweep'; stateClass = 'assistant-state-sweep';
      } else {
        const isBull = (d?.biasDir === 1) || (ctx?.h1?.bias === 'BULLISH');
        badge = 'STANDBY'; badgeClass = 'badge-neutral';
        stateClass = isBull ? 'assistant-state-bull' : 'assistant-state-bear';
      }
    } else if(d?.biasDir){
      const isBull = d.biasDir === 1;
      badge = 'STANDBY'; badgeClass = 'badge-neutral';
      stateClass = isBull ? 'assistant-state-bull' : 'assistant-state-bear';
      primary = `Bias M15: ${isBull ? 'Bullish (Mencari Buy)' : 'Bearish (Mencari Sell)'} · STANDBY`;
      sub = `Anti-Chase: STANDBY · Math Zone: ${mathZoneText}`;
    } else {
      badge = 'STANDBY'; badgeClass = 'badge-neutral'; stateClass = '';
      primary = 'Kondisi Pasar Netral / Belum Ada Bias Jelas';
      sub = `Anti-Chase: STANDBY · Math Zone: ${mathZoneText}`;
    }
  }

  badgeEl.textContent=badge;
  badgeEl.className=`assistant-badge ${badgeClass}`;
  root.className=`amy-live-assistant ${stateClass}`.trim();
  primaryEl.textContent=primary;
  subEl.textContent=sub;

  if(confEl&&e){
    const scoreColor=e.score>=75?'#00e676':e.score>=60?'#ff9800':'#94A3B8';
    confEl.innerHTML=`Confluence: <strong style="color:${scoreColor}">${e.score}/100</strong> (${esc(e.grade)}) · Zone: <strong style="color:var(--amy-accent,#F5C451)">${esc(mathZoneText)}</strong>`;
  }
  if(clockEl){
    const nowStr=new Date().toLocaleTimeString('id-ID',{timeZone:'Asia/Makassar',hour:'2-digit',minute:'2-digit'})+' WITA';
    clockEl.textContent=`M15: ${nowStr}`;
  }

  const candleTime = amy.source?.M15 || amy.source?.M5;
  const isStale = !candleTime || (nowSec - candleTime > 900);

  if(notify && notifTitle && settings?.assistantNotif !== false && !isStale && candleTime){
    try{
      const timeKey = (badge.includes('SWEPT') && sweepInfo?.time)
        ? sweepInfo.time
        : (badge === 'SETUP BATAL' && d?.invalidLevel)
        ? `inv_${n(d.invalidLevel)}_${lastBreakSec || candleTime}`
        : (plan?.entry != null && (badge.includes('ENTRY') || badge.includes('PULLBACK')))
        ? `plan_${n(plan.entry)}_${planFormedSec || candleTime}`
        : candleTime;
      const eventKey = `${badge}|${timeKey}`;
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('amyfx_notified_assistant_events') : null;
      const notified = raw ? JSON.parse(raw) : {};
      if(!notified[eventKey]){
        notified[eventKey] = Date.now();
        const keys = Object.keys(notified).slice(-40), trimmed = {};
        keys.forEach(k => trimmed[k] = notified[k]);
        localStorage.setItem('amyfx_notified_assistant_events', JSON.stringify(trimmed));
        const targetUrl = typeof location !== 'undefined' ? `${location.href.split('#')[0]}#Dashboard` : null;
        if(typeof window !== 'undefined' && window.Android?.showNotificationWithUrl){
          window.Android.showNotificationWithUrl(notifTitle, notifBody, targetUrl);
        }else if(typeof Notification !== 'undefined' && Notification.permission === 'granted'){
          new Notification(notifTitle, { body: notifBody });
        }
      }
    }catch(_){}
  }
}

export function renderBiasDashboardV2(amy,context=null){
  const tbody=document.getElementById('bias-table-body'),headerEl=document.getElementById('bias-table-header'),statusEl=document.getElementById('bias-dashboard-status');
  if(!tbody)return;
  const hasLiveCandles=(typeof window!=='undefined'&&Array.isArray(window.amyfxLastCandles)&&window.amyfxLastCandles.length>0);
  if(!amy?.dashboard&&!context&&!hasLiveCandles){
    tbody.innerHTML='<tr><td colspan="2" style="text-align:center; padding:16px; color:var(--muted);">Menunggu konteks server yang segar...</td></tr>';
    if(headerEl)headerEl.textContent='AMY ICT V6.1 [INTRA]';
    return;
  }
  const rows=dashboardContextV6Rows(amy,context);
  const tfRow=rows.find(r=>r[0]==='3-TF ORDER FLOW');
  const isFullBull=tfRow&&tfRow[1].includes('H1: BULL')&&tfRow[1].includes('M15: BULL')&&tfRow[1].includes('M5: BULL');
  const isFullBear=tfRow&&tfRow[1].includes('H1: BEAR')&&tfRow[1].includes('M15: BEAR')&&tfRow[1].includes('M5: BEAR');
  const alignBadge=(isFullBull||isFullBear)?'SEARAH (ALIGNED)':'FASE PULLBACK / TRANSISI';
  if(headerEl){
    headerEl.textContent=`AMY ICT V6.1 [INTRA] · STATUS: ${alignBadge}`;
  }
  if(statusEl){
    statusEl.textContent=alignBadge;
    statusEl.style.color=isFullBull?'#00e676':isFullBear?'#ff5252':'#F5C451';
  }
  tbody.innerHTML=rows.map(([key,val,valClass])=>`<tr><td class="bias-key-col">${esc(key)}</td><td class="bias-val-col ${valClass||''}">${esc(val)}</td></tr>`).join('');
}

export function renderEntryAssistantPlan(amy,context=null){
  const planEl=document.getElementById('amy-entry-assistant-v3');
  if(!planEl)return;
  const ast=amy?.assistant||null;
  const sniperTrigger=detectM5SniperTrigger(amy,context);
  const plan=(ast?.status==='READY'&&ast?.plan)?ast.plan:(sniperTrigger||ast?.plan||amy?.plan||null);
  const badgeEl=document.getElementById('plan-signal-badge');
  const antiChaseEl=document.getElementById('plan-anti-chase-pill');
  const rejectionEl=document.getElementById('plan-rejection-pill');
  const mathZoneEl=document.getElementById('plan-math-zone');
  const pullbackEl=document.getElementById('plan-pullback-notice');
  const entryVal=document.getElementById('plan-entry-val');
  const slVal=document.getElementById('plan-sl-val');
  const slSub=document.getElementById('plan-sl-sub');
  const tp1Val=document.getElementById('plan-tp1-val');
  const tp1Sub=document.getElementById('plan-tp1-sub');
  const tp2Val=document.getElementById('plan-tp2-val');
  const tp2Sub=document.getElementById('plan-tp2-sub');
  const reasonsEl=document.getElementById('plan-reasons-list');
  const btnChart=document.getElementById('btn-show-plan-chart');

  if(!plan){
    const d=amy?.dashboard;
    const ctx=context||(typeof window!=='undefined'?window.AmyMarketContext:null);
    const levels=amy?.levels||ctx?.levels||ctx?.keyLevels||{};
    const currentPrice=(typeof window!=='undefined'&&Number.isFinite(Number(window.amyfxCurrentPrice))&&Number(window.amyfxCurrentPrice)>0)
      ?Number(window.amyfxCurrentPrice)
      :(Number.isFinite(Number(amy?.currentPrice))&&Number(amy?.currentPrice)>0)
      ?Number(amy.currentPrice)
      :(Number.isFinite(Number(ctx?.price))&&Number(ctx.price)>0)
      ?Number(ctx.price)
      :0;
    const rHigh=Number(ctx?.m15?.dealingRange?.rangeHigh??d?.rangeHigh??d?.protectedHigh??levels?.bsl);
    const rLow=Number(ctx?.m15?.dealingRange?.rangeLow??d?.rangeLow??d?.protectedLow??levels?.ssl);
    const hasRange=Number.isFinite(rHigh)&&Number.isFinite(rLow)&&rHigh>rLow;
    const rangePct=(hasRange&&currentPrice>0)?Math.min(100,Math.max(0,Math.round(((currentPrice-rLow)/(rHigh-rLow))*100))):50;
    const isEquilibrium=(rangePct>=47.5&&rangePct<=52.5);

    if(isEquilibrium){
      if(badgeEl){badgeEl.textContent='NO-TRADE ZONE';badgeEl.className='plan-badge badge-neutral';}
      if(antiChaseEl){antiChaseEl.textContent='DILARANG ENTRY';antiChaseEl.className='anti-chase-pill pill-warning';}
      if(rejectionEl)rejectionEl.style.display='none';
      if(mathZoneEl)mathZoneEl.textContent='Math Zone: EQUILIBRIUM 50% (NO-TRADE ZONE)';
      if(pullbackEl)pullbackEl.style.display='none';
      if(entryVal)entryVal.textContent='—';
      if(slVal)slVal.textContent='—';if(slSub)slSub.textContent='Rem Disiplin';
      if(tp1Val)tp1Val.textContent='—';if(tp1Sub)tp1Sub.textContent='Stand Aside';
      if(tp2Val)tp2Val.textContent='—';if(tp2Sub)tp2Sub.textContent='Anti-Yes-Man';
      if(reasonsEl){
        const items=[
          'Harga sedang berputar di poros tengah Dealing Range (Equilibrium 50%).',
          'SOP Anti-Yes-Man: DIAM dan simpan peluru! Jangan menekan tombol order di area tengah (No-Trade Zone).',
          'Tunggu penjemputan likuiditas di Support / Demand (<47.5%) atau Resistance / Supply (>52.5%).'
        ];
        reasonsEl.innerHTML=items.map(r=>`<li>${esc(r)}</li>`).join('');
      }
      const btnTakeTrade=document.getElementById('btn-take-trade');
      if(btnTakeTrade){
        btnTakeTrade.disabled=true;
        btnTakeTrade.style.background='rgba(255,255,255,0.06)';
        btnTakeTrade.style.color='#94a3b8';
        btnTakeTrade.style.border='1px solid rgba(255,255,255,0.15)';
        btnTakeTrade.style.opacity='0.6';
        btnTakeTrade.style.cursor='not-allowed';
        btnTakeTrade.textContent='🛡️ Zona Cincang (Dilarang Entry)';
      }
      if(btnChart){btnChart.disabled=true;btnChart.style.opacity='0.5';btnChart.onclick=null;}
      return;
    }

    if(badgeEl){badgeEl.textContent='MENUNGGU KONFIRMASI';badgeEl.className='plan-badge badge-neutral';}
    if(antiChaseEl){antiChaseEl.textContent='STANDBY';antiChaseEl.className='anti-chase-pill pill-neutral';}
    if(rejectionEl)rejectionEl.style.display='none';
    if(mathZoneEl)mathZoneEl.textContent=`Math Zone: ${ast?.mathZone||'Menunggu zona terkonfirmasi'}`;
    if(pullbackEl)pullbackEl.style.display='none';
    if(entryVal)entryVal.textContent='—';
    if(slVal)slVal.textContent='—';if(slSub)slSub.textContent='Risk: —';
    if(tp1Val)tp1Val.textContent='—';if(tp1Sub)tp1Sub.textContent='RR: —';
    if(tp2Val)tp2Val.textContent='—';if(tp2Sub)tp2Sub.textContent='Runner: —';
    if(reasonsEl){
      const items=ast?.reasons&&ast.reasons.length?ast.reasons:['Menunggu konfirmasi candle tertutup M15.','Belum ada pemicu entry aktif di zona matematika.'];
      reasonsEl.innerHTML=items.map(r=>`<li>${esc(r)}</li>`).join('');
    }
    if(btnChart){btnChart.disabled=true;btnChart.style.opacity='0.5';btnChart.onclick=null;}
    return;
  }

  const ctx=context||(typeof window!=='undefined'?window.AmyMarketContext:null);
  const d=amy?.dashboard;
  const isMtfBull=d?.dirMTF?d.dirMTF>0:(ctx?.m15?.dir?ctx.m15.dir>0:false);
  const confZone=amy?.confluence?.zone||ctx?.confluence?.zone||'';
  const confScore=Number(amy?.confluence?.score??ctx?.confluence?.score??0);
  const isNoEntry=confZone==='NO ENTRY'||(confScore>0&&confScore<60);
  const isBuy=plan.side==='BUY';
  const isCounterTrend=(isBuy&&!isMtfBull)||(!isBuy&&isMtfBull);
  const isPullback=Math.abs(plan.signalType)===2||Boolean(ast?.isPullback)||isCounterTrend;

  const badgeText=isCounterTrend
    ?`⚠️ PULLBACK (M15 ${isMtfBull?'BULL':'BEAR'})`
    :(plan.signalName||(isPullback?(isBuy?'PULLBACK BUY':'PULLBACK SELL'):(isBuy?'BUY ENTRY':'SELL ENTRY')));
  const badgeClass=isCounterTrend?'badge-neutral':(isBuy?'badge-bull':'badge-bear');

  if(badgeEl){badgeEl.textContent=badgeText;badgeEl.className=`plan-badge ${badgeClass}`;}
  if(antiChaseEl){
    if(isCounterTrend||isNoEntry){
      antiChaseEl.textContent='DILARANG ENTRY (PULLBACK KOREKTIF)';antiChaseEl.className='anti-chase-pill pill-warning';
    }else if(plan.signalName?.includes('SNIPER')){
      antiChaseEl.textContent='READY DI ZONA EKSTREM';antiChaseEl.className='anti-chase-pill pill-ready';
    }else if(ast?.status==='READY'||plan.status==='READY'){
      antiChaseEl.textContent='READY DI ZONA';antiChaseEl.className='anti-chase-pill pill-ready';
    }else if(ast?.status==='MISSED'||plan.status==='MISSED'){
      antiChaseEl.textContent='MISSED: Harga sudah menjauh dari entry';antiChaseEl.className='anti-chase-pill pill-missed';
    }else{
      antiChaseEl.textContent='STANDBY';antiChaseEl.className='anti-chase-pill pill-neutral';
    }
  }

  // Visual Rejection Candle Body Filter (Item 2.24)
  const sweepInfo=ast?.sweep||plan?.sweep||amy?.sweep||null;
  const rejectionState=ast?.rejectionState||plan?.rejectionState||(ast?.reclaimed?'SWEEP_REJECTION':(ast?.waitingRejectionClose?'SWEEP_UNCONFIRMED':null));
  if(rejectionEl){
    if(isCounterTrend||isNoEntry){
      rejectionEl.style.display='inline-block';
      rejectionEl.textContent='🛡️ Lawan Bias MTF';
      rejectionEl.className='anti-chase-pill pill-warning';
    }else if(rejectionState==='SWEEP_REJECTION'||ast?.reclaimed===true||plan?.reclaimed===true||plan?.signalName?.includes('SNIPER')){
      rejectionEl.style.display='inline-block';
      rejectionEl.textContent='🎯 Reclaimed Valid';
      rejectionEl.className='anti-chase-pill pill-ready';
    }else if(rejectionState==='SWEEP_UNCONFIRMED'||ast?.waitingRejectionClose||(sweepInfo&&!ast?.reclaimed)){
      rejectionEl.style.display='inline-block';
      rejectionEl.textContent='⚖️ Menunggu Rejection Close';
      rejectionEl.className='anti-chase-pill pill-warning';
    }else{
      rejectionEl.style.display='none';
    }
  }
  if(mathZoneEl)mathZoneEl.textContent=`Math Zone: ${plan.mathZone||ast?.mathZone||'Fibo OTE / SNR / POI'}`;
  if(pullbackEl){
    if(isCounterTrend||isPullback){
      pullbackEl.style.display='block';
      pullbackEl.innerHTML=`<span>🛡️ <strong>SOP ANTI-YES-MAN:</strong> Sinyal ${isBuy?'BUY':'SELL'} ini adalah koreksi/pullback yang berlawanan dengan arah Order Flow M15 (${isMtfBull?'BULLISH':'BEARISH'}). DILARANG FOMO ${isBuy?'BUY':'SELL'}! Disiplin tunggu setup searah.</span>`;
    }else{
      pullbackEl.style.display='none';
    }
  }

  if(entryVal)entryVal.textContent=n(plan.entry);
  if(slVal)slVal.textContent=n(plan.sl);
  if(slSub)slSub.textContent=plan.risk?`Risk: ${n(plan.risk)} pts`:'Batas Risiko';
  if(tp1Val)tp1Val.textContent=n(plan.tp1);
  if(tp1Sub)tp1Sub.textContent=plan.rr1?`RR 1:${plan.rr1.toFixed(1)} · +50 Pips (BE)`:'+50 Pips (Kunci & Geser BE)';
  if(tp2Val)tp2Val.textContent=n(plan.tp2);
  if(tp2Sub)tp2Sub.textContent=plan.rr2?`RR 1:${plan.rr2.toFixed(1)} · +100 Pips DOL`:'+100 Pips Target Sayang (DOL)';

  if(reasonsEl){
    const items=plan.reasons&&plan.reasons.length?plan.reasons:(ast?.reasons&&ast.reasons.length?ast.reasons:(plan.reason||'').split('\n').filter(Boolean));
    reasonsEl.innerHTML=items.map(r=>`<li>${esc(r)}</li>`).join('');
  }

  // Pre-Trade Confluence Checklist 4-Poin (Item 2.22)
  const chkSession=document.getElementById('chk-pretrade-session');
  const chkZone=document.getElementById('chk-pretrade-zone');
  const chkLiq=document.getElementById('chk-pretrade-liquidity');
  const chkRR=document.getElementById('chk-pretrade-rr');
  const scoreEl=document.getElementById('pretrade-checklist-score');
  const btnTakeTrade=document.getElementById('btn-take-trade');

  const sessionText=String(amy?.session||ast?.session||plan?.session||'').toUpperCase();
  const cSession=sessionText.includes('LONDON')||sessionText.includes('NEW_YORK')||sessionText.includes('NY')||sessionText.includes('KILLZONE')||(new Date().getUTCHours()+8>=14&&new Date().getUTCHours()+8<=23);
  const mathZoneText=String(ast?.mathZone||plan?.zone||'').toUpperCase();
  const cZone=mathZoneText.includes('OTE')||mathZoneText.includes('DISCOUNT')||mathZoneText.includes('PREMIUM')||mathZoneText.includes('FIBO')||Boolean(plan?.entry);
  const cLiq=Boolean(ast?.reclaimed||ast?.rejectionState==='SWEEP_REJECTION'||ast?.sweep||plan?.sweep);
  const cRR=Number(plan?.rr2||plan?.rr||plan?.rr1||0)>=2.0;

  if(chkSession)chkSession.checked=cSession;
  if(chkZone)chkZone.checked=cZone;
  if(chkLiq)chkLiq.checked=cLiq;
  if(chkRR)chkRR.checked=cRR;

  const updatePreTradeUI=()=>{
    const s1=Boolean(chkSession?.checked);
    const s2=Boolean(chkZone?.checked);
    const s3=Boolean(chkLiq?.checked);
    const s4=Boolean(chkRR?.checked);
    const currentScore=[s1,s2,s3,s4].filter(Boolean).length;
    if(scoreEl)scoreEl.textContent=`${currentScore}/4 Kriteria`;

    if(btnTakeTrade){
      if(currentScore>=3){
        btnTakeTrade.disabled=false;
        btnTakeTrade.style.background='linear-gradient(135deg, #059669 0%, #10b981 100%)';
        btnTakeTrade.style.color='#ffffff';
        btnTakeTrade.style.border='1px solid #34d399';
        btnTakeTrade.style.boxShadow='0 0 16px rgba(16,185,129,0.4)';
        btnTakeTrade.style.opacity='1';
        btnTakeTrade.style.cursor='pointer';
        btnTakeTrade.textContent=`🚀 Ambil Trade (${currentScore}/4 Aman)`;
        btnTakeTrade.onclick=()=>{
          try{
            localStorage.setItem('amy_pretrade_selected_setup',JSON.stringify({
              time:Date.now(),
              plan,
              checklist:{session:s1,zone:s2,liquidity:s3,rr:s4,score:currentScore}
            }));
            if(window.Android?.triggerHaptic)window.Android.triggerHaptic(50);
            window.location.href='../journal/index.html?prefill=1';
          }catch(_){}
        };
      }else{
        btnTakeTrade.disabled=true;
        btnTakeTrade.style.background='rgba(255,255,255,0.06)';
        btnTakeTrade.style.color='#94a3b8';
        btnTakeTrade.style.border='1px solid rgba(255,255,255,0.15)';
        btnTakeTrade.style.boxShadow='none';
        btnTakeTrade.style.opacity='0.6';
        btnTakeTrade.style.cursor='not-allowed';
        btnTakeTrade.textContent=`🛡️ Ambil Trade (${currentScore}/4)`;
        btnTakeTrade.onclick=null;
      }
    }
  };

  [chkSession,chkZone,chkLiq,chkRR].forEach(chk=>{
    if(chk)chk.onchange=updatePreTradeUI;
  });
  updatePreTradeUI();

  if(btnChart){
    btnChart.disabled=false;btnChart.style.opacity='1';
    btnChart.onclick=()=>{
      window.dispatchEvent(new CustomEvent('amyfx:driver-plan',{detail:{id:'assistant-v3',entry:plan.entry,sl:plan.sl,tp1:plan.tp1,tp:plan.tp2,label:plan.signalName}}));
      window.dispatchEvent(new CustomEvent('amyfx:assistant-plan',{detail:plan}));
      window.setTab?.('Dashboard');
      document.getElementById('chart')?.scrollIntoView({behavior:'smooth',block:'center'});
    };
  }
}

export function renderAmy(amy,settings,news=null,context=null){
  const dash=document.getElementById('amy-dashboard'),assistant=document.getElementById('amy-assistant'),score=document.getElementById('amy-score-panel');
  const alert=document.getElementById('mapping-alert');if(alert){const warnings=mappingWarnings(amy,news);alert.hidden=!warnings.length;alert.textContent=warnings.join(' ');}
  if(dash){
    dash.hidden=!settings.dashboard;
    const v6Rows=dashboardContextV6Rows(amy,context);
    dash.innerHTML=(v6Rows&&v6Rows.length)
      ?`<div class="section-heading"><h2>Rincian Presisi ICT V6.1</h2><span>Live &amp; Candle Tertutup</span></div><dl class="amy-dashboard">${v6Rows.map(([a,b,cls])=>`<div><dt>${esc(a)}</dt><dd class="${cls||''}">${esc(b)}</dd></div>`).join('')}</dl>`
      :'<p>Menunggu konteks server yang segar.</p>';
  }
  if(assistant){assistant.hidden=false;assistant.innerHTML=amy?`<h2>Entry Assistant · M15</h2><p class="amy-narration">${esc(news?.status==='NEWS_LOCK'?news.note:amy.entry.text)}</p><small>Skor confluence adalah poin model, bukan peluang menang.</small>`:'<p>Menunggu candle tertutup.</p>';}
  if(score){score.hidden=!settings.panel;const e=amy?.entry;score.innerHTML=e?`<h2>${esc(e.grade)} · ${e.score}/100 poin</h2><p>BUY ${e.buy} | SELL ${e.sell} · ${directions(e.winDir)}</p><table class="amy-score-table"><thead><tr><th>Lapisan</th><th>BUY</th><th>SELL</th></tr></thead><tbody>${Object.keys(e.breakdown.buy||{}).map(k=>`<tr><td>${esc(layerNames[k]||k)}</td><td>${e.breakdown.buy[k]}</td><td>${e.breakdown.sell[k]}</td></tr>`).join('')}</tbody></table><small>Skor mentah dibatasi 100; dekat invalidasi: skor × 0.7.</small>`:'<p>Skor belum tersedia.</p>';}
  renderLiveAssistant(amy,news,settings,context);
  renderBiasDashboardV2(amy,context);
  renderEntryAssistantPlan(amy,context);
}

export function mountDisplay(onChange){
  const container=document.getElementById('ict-controls');let settings=loadDisplay();
  const check=(key,label)=>`<label><input type="checkbox" data-ict="${key}" ${settings[key]?'checked':''}> ${label}</label>`;
  const choices={Present:'Terbaru',Historical:'Riwayat',All:'Semua',Clean:'Ringkas','Major Only':'Level utama',NONE:'Nonaktif',D:'Harian',W:'Mingguan',M:'Bulanan'};
  const select=(key,label,values)=>`<label>${label}<select data-ict="${key}">${values.map(v=>`<option value="${v}" ${settings[key]===v?'selected':''}>${choices[v]||v}</option>`).join('')}</select></label>`;
  const number=(key,label,min,max)=>`<label>${label}<input type="number" data-ict="${key}" value="${settings[key]}" min="${min}" max="${max}"></label>`;
  container.innerHTML=`<details class="settings-group"><summary>Struktur &amp; zona ICT</summary><fieldset><legend>Referensi visual</legend>${select('mode','Mode',['Present','Historical'])}${check('structure','Market Structure')}${check('mss','MSS')}${check('bos','BOS')}${check('displacement','Displacement')}${check('ob','Order Blocks')}${check('breaker','Breaker Blocks')}${check('polarity','Label perubahan OB')}${check('liquidity','Zona likuiditas')}${check('fvg','Fair Value Gaps')}${select('gapType','Jenis gap',['FVG','IFVG'])}${check('bpr','Balance Price Range')}${check('vi','Volume Imbalance')}${check('nwog','NWOG')}${check('ndog','NDOG')}${number('visible','Zona per arah',1,20)}${number('bullOb','Bull OB',0,20)}${number('bearOb','Bear OB',0,20)}${number('nwogCount','Jumlah NWOG',0,50)}${number('ndogCount','Jumlah NDOG',0,50)}</fieldset></details>
    <details class="settings-group"><summary>Pivot &amp; Key Levels</summary><fieldset><legend>Level harga</legend>${check('pivots','Pivot Levels')}${select('pivotTf','Sumber Pivot',['D','W','M'])}${select('pivotMode','Mode Pivot',['All','Clean','Major Only'])}${number('nearAtr','Jarak ATR',.5,20)}${check('keyLevels','Key Levels')}${check('mo','Midnight Open NY')}${check('pdh','PDH')}${check('pdl','PDL')}${check('bsl','BSL')}${check('ssl','SSL')}${check('asia','Asia High/Low (NY 20–00)')}</fieldset></details>
    <details class="settings-group"><summary>Fibonacci &amp; Killzones</summary><fieldset><legend>Sesi &amp; Fibonacci</legend>${select('fib','Fibonacci dari',['NONE','FVG','BPR','OB','Liq','VI','NWOG'])}${check('fibExtend','Perpanjang Fibonacci')}${check('killzones','Warna sesi Killzones')}${check('ny','New York')}${check('londonOpen','London Open')}${check('londonClose','London Close')}${check('asian','Asian')}</fieldset></details>
    <details class="settings-group"><summary>Label &amp; panel</summary><fieldset><legend>Informasi chart</legend>${check('dashboard','Rincian bias M15')}${check('panel','Rincian skor')}${check('narration','Ringkasan di chart')}${check('assistantNotif','Notifikasi HP Asisten (Sweep/Break/POI)')}${check('signals','Marker Strong / Ready')}${check('labels','Label harga')}${number('backBars','Candle ke kiri',10,500)}${number('rightBars','Candle ke kanan',5,300)}${number('lineWidth','Tebal garis',1,4)}</fieldset></details><button type="button" id="ict-reset">Reset tampilan</button>`;
  container.addEventListener('change',event=>{const el=event.target,key=el.dataset.ict;if(!key)return;
    if(el.type==='checkbox')settings[key]=el.checked;else if(el.type==='number')settings[key]=Math.min(+el.max,Math.max(+el.min,+el.value||+el.min));else settings[key]=el.value;
    try{localStorage.setItem('amyfx.ict.display.v2',JSON.stringify(settings));}catch{}onChange({...settings});});
  container.querySelector('#ict-reset').addEventListener('click',()=>{try{localStorage.removeItem('amyfx.ict.display.v2');}catch{}location.reload();});
  return settings;
}

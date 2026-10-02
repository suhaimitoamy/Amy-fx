import {analyzeAmy,AMY_POLICY} from './amy-ict.mjs';
// Closed-candle XAU/USD context. Shared AMY Dashboard V2 decisions and ICT references.
// Every threshold below is a configurable model heuristic aligned with ICT displacement,
// dealing range, and multi-layer confluence scoring.
export const CONTEXT_VERSION = 'amyfx-gold-context-v1';
export const CONTEXT_POLICY = AMY_POLICY;
const PIVOT = 2;
const round = value => Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
const latest = rows => rows.at(-1);

export function closedCandles(rows, nowSeconds, duration=null) {
  const byTime = new Map();
  for (const raw of rows || []) {
    const c = {open_time:Number(raw.open_time),close_time:Number(raw.close_time),open:Number(raw.open),high:Number(raw.high),low:Number(raw.low),close:Number(raw.close)};
    if (raw.is_closed === false || !Object.values(c).every(Number.isFinite) || c.open_time <= 0 ||
        c.close_time <= c.open_time || (duration && c.close_time-c.open_time !== duration) || c.close_time > nowSeconds || c.low <= 0 ||
        c.low > Math.min(c.open,c.close) || c.high < Math.max(c.open,c.close)) continue;
    byTime.set(c.open_time,c);
  }
  return [...byTime.values()].sort((a,b)=>a.open_time-b.open_time);
}

function contiguous(rows) {
  return rows.every((c,i) => c.close_time-c.open_time === rows[0].close_time-rows[0].open_time &&
    (!i || c.open_time === rows[i-1].close_time));
}

export function atr(candles, end=candles.length, period=14) {
  if (end < period+1 || !contiguous(candles.slice(end-period-1,end))) return null;
  let total=0;
  for(let i=end-period;i<end;i++) {
    const c=candles[i], previous=candles[i-1];
    total+=Math.max(c.high-c.low,Math.abs(c.high-previous.close),Math.abs(c.low-previous.close));
  }
  return total/period;
}

export function swings(candles, width=PIVOT) {
  const highs=[],lows=[];
  for(let i=width;i<candles.length-width;i++) {
    const c=candles[i], window=candles.slice(i-width,i+width+1);
    if (!contiguous(window)) continue;
    if(window.every((x,j)=>j===width||c.high>x.high)) highs.push({level:c.high,time:c.open_time,confirmedAt:candles[i+width].close_time,index:i});
    if(window.every((x,j)=>j===width||c.low<x.low)) lows.push({level:c.low,time:c.open_time,confirmedAt:candles[i+width].close_time,index:i});
  }
  return {highs,lows};
}

export function structure(candles, points=swings(candles)) {
  const highs=points.highs,lows=points.lows;
  let lastBreak=null;
  for(let i=1;i<candles.length;i++) {
    const c=candles[i],prev=candles[i-1];
    const confirmedHighs=highs.filter(p=>p.confirmedAt<=c.open_time&&p.index<i);
    const confirmedLows=lows.filter(p=>p.confirmedAt<=c.open_time&&p.index<i);
    const high=confirmedHighs.at(-1),low=confirmedLows.at(-1);
    if(high && prev.close<=high.level && c.close>high.level) lastBreak={side:'BULLISH',type:(lastBreak?.side==='BEARISH'||!lastBreak&&confirmedHighs.at(-1)?.level<confirmedHighs.at(-2)?.level)?'MSS':'BOS',level:high.level,time:c.close_time};
    if(low && prev.close>=low.level && c.close<low.level) lastBreak={side:'BEARISH',type:(lastBreak?.side==='BULLISH'||!lastBreak&&confirmedLows.at(-1)?.level>confirmedLows.at(-2)?.level)?'MSS':'BOS',level:low.level,time:c.close_time};
  }
  const h=highs.at(-1),h0=highs.at(-2),l=lows.at(-1),l0=lows.at(-2);
  const sequence=h&&h0&&l&&l0?(h.level>h0.level&&l.level>l0.level?'BULLISH':h.level<h0.level&&l.level<l0.level?'BEARISH':'NEUTRAL'):'NEUTRAL';
  const breakAge=lastBreak?latest(candles).close_time-lastBreak.time:Infinity;
  const recentBreak=lastBreak && (breakAge<=8*3600 || (sequence==='NEUTRAL'&&breakAge<=24*3600));
  let bias=recentBreak?lastBreak.side:sequence;
  let health=bias==='NEUTRAL'?'WEAKENING':'HEALTHY';
  if(bias!=='NEUTRAL' && sequence!=='NEUTRAL' && sequence!==bias) health='WEAKENING';
  if(bias==='BULLISH'&&h&&h0&&h.level<h0.level||bias==='BEARISH'&&l&&l0&&l.level>l0.level)health='WEAKENING';
  const protectedLevel=bias==='BULLISH'?l?.level:bias==='BEARISH'?h?.level:null;
  if(bias==='BULLISH' && protectedLevel!=null && latest(candles).close<protectedLevel ||
     bias==='BEARISH' && protectedLevel!=null && latest(candles).close>protectedLevel) {
    health='INVALIDATED';
    bias='NEUTRAL';
  }
  return {bias,health,sequence,lastBreak,protectedLevel:round(protectedLevel),swingHigh:round(h?.level),swingLow:round(l?.level),
    highPattern:h&&h0?(h.level>h0.level?'HH':'LH'):null,lowPattern:l&&l0?(l.level>l0.level?'HL':'LL'):null};
}

export function dealingRange(candles, struct, points, side=null) {
  if (!candles || candles.length < 2) {
    return {
      rangeHigh: null,
      rangeLow: null,
      eq: null,
      eqLow: null,
      eqHigh: null,
      priceZone: 0,
      location: 'EQUILIBRIUM',
      locationStatus: 0,
      span: null
    };
  }
  const recent = candles.slice(-50);
  const highest = Math.max(...recent.map(c => c.high));
  const lowest = Math.min(...recent.map(c => c.low));

  const rangeHigh = struct?.bias === 'BEARISH' && struct?.protectedLevel ? Math.max(struct.protectedLevel, highest) : (struct?.swingHigh || highest);
  const rangeLow = struct?.bias === 'BULLISH' && struct?.protectedLevel ? Math.min(struct.protectedLevel, lowest) : (struct?.swingLow || lowest);
  const span = rangeHigh - rangeLow;

  if (span <= 0) {
    return {
      rangeHigh: round(rangeHigh),
      rangeLow: round(rangeLow),
      eq: round(rangeHigh),
      eqLow: round(rangeHigh),
      eqHigh: round(rangeHigh),
      priceZone: 0,
      location: 'EQUILIBRIUM',
      locationStatus: 0,
      span: 0
    };
  }

  const eq = (rangeHigh + rangeLow) * 0.50;
  const eqLow = rangeLow + span * 0.48;
  const eqHigh = rangeLow + span * 0.52;
  const close = candles.at(-1).close;

  const priceZone = close > eqHigh ? 1 : close < eqLow ? -1 : 0;
  const location = priceZone === 1 ? 'PREMIUM' : priceZone === -1 ? 'DISCOUNT' : 'EQUILIBRIUM';

  let locationStatus = 0;
  if (side === 'BUY') {
    locationStatus = priceZone === -1 ? 1 : priceZone === 1 ? -1 : 0;
  } else if (side === 'SELL') {
    locationStatus = priceZone === 1 ? 1 : priceZone === -1 ? -1 : 0;
  }

  return {
    rangeHigh: round(rangeHigh),
    rangeLow: round(rangeLow),
    eq: round(eq),
    eqLow: round(eqLow),
    eqHigh: round(eqHigh),
    priceZone,
    location,
    locationStatus,
    span: round(span)
  };
}

export function zones(candles, points=swings(candles)) {
  const output=[];const start=Math.max(2,candles.length-120);
  for(let i=start;i<candles.length;i++) {
    const a=candles[i-2],b=candles[i-1],c=candles[i];
    if (!contiguous([a,b,c])) continue;
    const curAtr=atr(candles,i)||1.0;
    // Minimum thickness rule: Celah < 0.8 point ($8 pips emas) otomatis ditolak (mencegah POI 0.1-0.3 pips)
    const minThickness=Math.max(0.8, curAtr*0.15);

    // Displacement logic aligned with Pine Script ICT Concepts [amygmgo]
    const bodyB=Math.abs(b.close-b.open);
    const mxB=Math.max(b.open,b.close);
    const mnB=Math.min(b.open,b.close);
    const upperWickB=b.high-mxB;
    const lowerWickB=mnB-b.low;

    let sumBody=0,countBody=0;
    for(let k=Math.max(0,i-6);k<i;k++){
      sumBody+=Math.abs(candles[k].close-candles[k].open);
      countBody++;
    }
    const meanBody=countBody>0?sumBody/countBody:bodyB;
    const isDisplaced=candles.length<15||(bodyB>=meanBody*0.7&&(upperWickB<=bodyB*0.45||lowerWickB<=bodyB*0.45||bodyB>=(b.high-b.low)*0.5));

    if(isDisplaced) {
      if(c.low>a.high && (c.low-a.high)>=minThickness) {
        output.push({id:`FVG:BUY:${c.open_time}`,kind:'FVG',side:'BUY',low:a.high,high:c.low,ce:round((a.high+c.low)/2),formedAt:c.close_time,formedIndex:i});
      } else if(c.high<a.low && (a.low-c.high)>=minThickness) {
        output.push({id:`FVG:SELL:${c.open_time}`,kind:'FVG',side:'SELL',low:c.high,high:a.low,ce:round((c.high+a.low)/2),formedAt:c.close_time,formedIndex:i});
      }
    }

    const range=atr(candles,i), body=Math.abs(c.close-c.open);
    const priorHigh=points.highs.filter(p=>p.confirmedAt<=c.open_time).at(-1);
    const priorLow=points.lows.filter(p=>p.confirmedAt<=c.open_time).at(-1);
    const buy=range && body>1.1*range && c.close>c.open && priorHigh && c.close>priorHigh.level;
    const sell=range && body>1.1*range && c.close<c.open && priorLow && c.close<priorLow.level;
    if(buy||sell) {
      const opposite=candles.slice(Math.max(0,i-3),i).reverse().find(x=>buy?x.close<x.open:x.close>x.open);
      if(opposite && (opposite.high-opposite.low)>=minThickness) {
        output.push({id:`OB:${buy?'BUY':'SELL'}:${opposite.open_time}`,kind:'OB',side:buy?'BUY':'SELL',low:opposite.low,high:opposite.high,ce:round((opposite.low+opposite.high)/2),formedAt:c.close_time,formedIndex:i});
      }
    }
  }
  return output.map(z=>{
    let touches=0,mitigated=false,invalid=false,lastTouch=null;
    for(let i=z.formedIndex+1;i<candles.length;i++) {
      const c=candles[i],touch=c.low<=z.high&&c.high>=z.low;
      if(touch){touches++;lastTouch=c.close_time;if(z.side==='BUY'?c.low<=z.ce:c.high>=z.ce)mitigated=true;}
      if(z.side==='BUY'?c.close<z.low:c.close>z.high){invalid=true;break;}
    }
    const lifecycle=invalid?'INVALID':mitigated?'MITIGATED':touches>=2?'WEAKENING':touches?'TESTED':'FRESH';
    return {...z,label:`Zona ${z.side==='BUY'?'permintaan':'penawaran'} ${z.kind}`,low:round(z.low),high:round(z.high),ce:round(z.ce),touches,lastTouch,lifecycle};
  });
}

export function liquidity(m15,d1,points=swings(m15),nowSeconds=Math.floor(Date.now()/1000)) {
  const targets=[];
  if(d1.length>=1) {
    const previous=d1.at(-1);
    targets.push({label:'PDH',level:round(previous.high),side:'BUY',sourceTime:previous.close_time},
      {label:'PDL',level:round(previous.low),side:'SELL',sourceTime:previous.close_time});
  }
  if(d1.length) {
    const week=time=>Math.floor((time+3*86400)/(7*86400));
    const previousWeek=d1.filter(x=>week(x.open_time)===week(nowSeconds)-1);
    if(previousWeek.length>=3) targets.push({label:'PWH',level:round(Math.max(...previousWeek.map(x=>x.high))),side:'BUY',sourceTime:latest(previousWeek).close_time},
      {label:'PWL',level:round(Math.min(...previousWeek.map(x=>x.low))),side:'SELL',sourceTime:latest(previousWeek).close_time});
  }
  const tolerance=(atr(m15)||1)*0.1;
  for(const [key,label,side] of [['highs','EQH','BUY'],['lows','EQL','SELL']]) {
    const recent=points[key].slice(-24);
    for(let i=recent.length-1;i>0;i--) {
      const same=recent.slice(0,i).reverse().find(p=>Math.abs(p.level-recent[i].level)<=tolerance);
      if(same){targets.push({label,level:round((same.level+recent[i].level)/2),side,sourceTime:recent[i].confirmedAt});break;}
    }
  }
  const price=latest(m15)?.close;
  return targets.map(t=>{
    const swept=m15.some(c=>c.close_time>t.sourceTime && (t.side==='BUY'?c.high>=t.level:c.low<=t.level));
    const behindPrice=t.side==='BUY'?price>=t.level:price<=t.level;
    return {...t,status:swept||behindPrice?'TAKEN':'ACTIVE'};
  });
}

export function confirmation(candles,zone,side) {
  if(!zone||!side||candles.length<18) return {status:'WAITING',sweep:null,mss:null,microFvg:null};
  let recent=candles.slice(-45).filter(c=>c.close_time>=zone.formedAt);
  // A missing bar cannot supply a sweep, MSS, or FVG for later evidence.
  let lastGap=0;
  for(let i=1;i<recent.length;i++) if(!contiguous(recent.slice(i-1,i+1))) lastGap=i;
  recent=recent.slice(lastGap);
  let touch=-1,sweep=null,mss=null,microFvg=null;
  for(let i=6;i<recent.length;i++) {
    const c=recent[i],prior=recent.slice(i-6,i);
    if(c.low<=zone.high&&c.high>=zone.low)touch=i;
    if(touch<0)continue;
    const level=side==='BUY'?Math.min(...prior.map(x=>x.low)):Math.max(...prior.map(x=>x.high));
    if(!sweep && (side==='BUY'?c.low<level&&c.close>level:c.high>level&&c.close<level)) sweep={time:c.close_time,level:round(level),extreme:round(side==='BUY'?c.low:c.high),index:i};
    if(sweep && i>sweep.index && i-sweep.index<=12) {
      const breakLevel=side==='BUY'?Math.max(...prior.map(x=>x.high)):Math.min(...prior.map(x=>x.low));
      const displacement=Math.abs(c.close-c.open)>=(atr(recent,i)||Infinity)*0.7;
      if(!mss && displacement && (side==='BUY'?c.close>breakLevel:c.close<breakLevel))mss={time:c.close_time,level:round(breakLevel)};
      if(mss && !microFvg && i>=2) {
        const first=recent[i-2];
        if(side==='BUY'&&first.high<c.low) microFvg={low:round(first.high),high:round(c.low),time:c.close_time};
        if(side==='SELL'&&first.low>c.high) microFvg={low:round(c.high),high:round(first.low),time:c.close_time};
      }
    }
  }
  const lastTime=latest(recent)?.close_time;
  const interval=recent.length>=2?Math.round(recent[1].open_time-recent[0].open_time):60;
  const sweepWindow=Math.max(15*60,interval*12);
  const valid=sweep && lastTime-sweep.time<=sweepWindow;
  const failed=sweep && recent.slice(sweep.index+1).some(c=>side==='BUY'?c.close<zone.low||c.close<sweep.extreme:c.close>zone.high||c.close>sweep.extreme);
  if(failed)return {status:'FAILED',sweep:{time:sweep.time,level:sweep.level,extreme:sweep.extreme},mss:null,microFvg:null};
  return {status:valid&&mss&&microFvg?'CONFIRMED':valid?'CONFIRMING':'WAITING',sweep:valid?{time:sweep.time,level:sweep.level,extreme:sweep.extreme}:null,
    mss:valid?mss:null,microFvg:valid?microFvg:null};
}

function goldSession(nowSeconds){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hourCycle:'h23',hour:'2-digit',minute:'2-digit',weekday:'short'})
    .formatToParts(new Date(nowSeconds*1000));
  const values=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  if(['Sat','Sun'].includes(values.weekday))return 'PASAR TUTUP';
  const hour=Number(values.hour)+Number(values.minute)/60;
  return hour>=2&&hour<5?'LONDON':hour>=7&&hour<11?'NEW YORK':'DI LUAR JAM INTI';
}

function calendarWeek(time) {
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'})
    .formatToParts(new Date(time*1000));
  const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));
  const day=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day));
  return day-new Date(day).getUTCDay()*86400000;
}

export function evaluateEconomicCalendar(calendar, nowSeconds) {
  if (!Array.isArray(calendar) || calendar.length === 0) {
    return {
      status: 'UNVERIFIED',
      impact: 'UNKNOWN',
      event: null,
      diffMinutes: null,
      note: 'Kalender berita berdampak tinggi belum terhubung; periksa berita sebelum eksekusi.'
    };
  }

  const week=calendarWeek(nowSeconds);
  if (!calendar.some(item => {
    const time=Date.parse(item?.date)/1000;
    return Number.isFinite(time) && calendarWeek(time) === week;
  })) {
    return {status:'UNVERIFIED',impact:'UNKNOWN',event:null,diffMinutes:null,
      note:'Kalender tidak mencakup minggu berjalan; periksa berita sebelum eksekusi.'};
  }

  const usdEvents = [];
  for (const item of calendar) {
    if (String(item?.country).toUpperCase() !== 'USD') continue;
    const impact = String(item.impact || '').toLowerCase();
    if (impact !== 'high' && impact !== 'medium') continue;

    const eventTime = Math.floor(new Date(item.date).getTime() / 1000);
    if (!Number.isFinite(eventTime)) continue;

    const diffMinutes = Math.round((eventTime - nowSeconds) / 60);
    usdEvents.push({
      title: item.title,
      country: 'USD',
      impact: item.impact,
      eventTime,
      diffMinutes,
      forecast: item.forecast || '',
      previous: item.previous || ''
    });
  }

  if (usdEvents.length === 0) {
    return {
      status: 'SAFE',
      impact: 'LOW',
      event: null,
      diffMinutes: null,
      note: '🟢 SAFE / CLEAR: Tidak ada berita USD berdampak tinggi dalam waktu dekat. Kondisi scalping aman.'
    };
  }

  usdEvents.sort((a, b) => Math.abs(a.diffMinutes) - Math.abs(b.diffMinutes));

  const highCritical = usdEvents.find(e => String(e.impact).toLowerCase() === 'high' && e.diffMinutes >= -15 && e.diffMinutes <= 30);
  if (highCritical) {
    const isPast = highCritical.diffMinutes < 0;
    const isNow = highCritical.diffMinutes === 0;
    const timing = isNow ? 'sedang rilis saat ini' : (isPast ? `${Math.abs(highCritical.diffMinutes)}m yang lalu` : `dalam ${highCritical.diffMinutes} menit`);
    return {
      status: 'NEWS_LOCK',
      impact: 'HIGH',
      event: highCritical.title,
      diffMinutes: highCritical.diffMinutes,
      forecast: highCritical.forecast,
      previous: highCritical.previous,
      note: `⛔ NEWS LOCK AKTIF: Rilis ${highCritical.title} (${timing}). Hindari entry scalping akibat risiko slippage & lonjakan spread.`
    };
  }

  const highUpcoming = usdEvents.find(e => String(e.impact).toLowerCase() === 'high' && e.diffMinutes > 30 && e.diffMinutes <= 120);
  if (highUpcoming) {
    return {
      status: 'UPCOMING',
      impact: 'HIGH',
      event: highUpcoming.title,
      diffMinutes: highUpcoming.diffMinutes,
      forecast: highUpcoming.forecast,
      previous: highUpcoming.previous,
      note: `⚠️ WASPADA BERITA: ${highUpcoming.title} rilis dalam ${highUpcoming.diffMinutes} menit${highUpcoming.forecast ? ` (Forecast: ${highUpcoming.forecast})` : ''}. Siapkan trailing/TP sebelum rilis.`
    };
  }

  const medCritical = usdEvents.find(e => String(e.impact).toLowerCase() === 'medium' && e.diffMinutes >= -10 && e.diffMinutes <= 15);
  if (medCritical) {
    const isPast = medCritical.diffMinutes < 0;
    const isNow = medCritical.diffMinutes === 0;
    const timing = isNow ? 'sedang rilis saat ini' : (isPast ? `${Math.abs(medCritical.diffMinutes)}m yang lalu` : `dalam ${medCritical.diffMinutes} menit`);
    return {
      status: 'MEDIUM_ALERT',
      impact: 'MEDIUM',
      event: medCritical.title,
      diffMinutes: medCritical.diffMinutes,
      forecast: medCritical.forecast,
      previous: medCritical.previous,
      note: `⚡ INFO BERITA: ${medCritical.title} (${timing}). Waspadai fluktuasi jangka pendek.`
    };
  }

  return {
    status: 'SAFE',
    impact: 'LOW',
    event: null,
    diffMinutes: null,
    note: '🟢 SAFE / CLEAR: Tidak ada berita USD berdampak tinggi dalam waktu dekat. Kondisi scalping aman.'
  };
}

export function calculateConfluenceScore({
  h1Struct,
  side,
  aligned,
  poi,
  nearPoi,
  confirming,
  levels,
  dr,
  session
}) {
  if (h1Struct?.health === 'INVALIDATED') {
    return { score: 0, grade: 'NO_SETUP', breakdown: { invalidation: 'Struktur H1 Batal' } };
  }
  if (!side) {
    return { score: 0, grade: 'NO_SETUP', breakdown: { reason: 'Tidak ada arah bias' } };
  }

  let score = 0;
  const breakdown = {};

  // Layer 1: Bias M15 Aligned with H1 (20 pts)
  if (aligned) {
    score += 20;
    breakdown.biasAlignment = 20;
  } else if (h1Struct?.bias === 'NEUTRAL' || h1Struct?.health === 'WEAKENING') {
    score += 8;
    breakdown.biasAlignment = 8;
  } else {
    breakdown.biasAlignment = 0;
  }

  // Layer 2: Liquidity Sweep (20 pts)
  if (confirming?.sweep && nearPoi) {
    score += 20;
    breakdown.liquiditySweep = 20;
  } else if (confirming?.sweep) {
    score += 12;
    breakdown.liquiditySweep = 12;
  } else {
    breakdown.liquiditySweep = 0;
  }

  // Layer 3: POI Alignment & Rejection (15 pts: 10 base + 5 rejection)
  if (poi) {
    if (nearPoi) {
      score += 10;
      breakdown.poiAlignment = 10;
    } else {
      score += 8;
      breakdown.poiAlignment = 8;
    }
    if (confirming?.status === 'CONFIRMED' || confirming?.status === 'CONFIRMING') {
      score += 5;
      breakdown.poiRejection = 5;
    }
  }

  // Layer 4: Draw on Liquidity (DOL) Active (10 pts)
  const activeTarget = levels?.find(l => l.status === 'ACTIVE' && l.side === side);
  if (activeTarget) {
    score += 10;
    breakdown.targetActive = 10;
  } else {
    breakdown.targetActive = 0;
  }

  // Layer 5: Price Location in Dealing Range (10 pts)
  const locStatus = dr?.locationStatus ?? 0;
  if (locStatus === 1) {
    score += 10;
    breakdown.dealingRange = 10;
  } else if (locStatus === 0) {
    score += 4;
    breakdown.dealingRange = 4;
  } else {
    breakdown.dealingRange = 0;
  }

  // Layer 6: LTF Displacement (10 pts)
  if (confirming?.microFvg) {
    score += 10;
    breakdown.displacement = 10;
  } else if (confirming?.status === 'CONFIRMED') {
    score += 5;
    breakdown.displacement = 5;
  } else {
    breakdown.displacement = 0;
  }

  // Layer 7: LTF Structure Break / MSS (10 pts)
  if (confirming?.mss) {
    score += 10;
    breakdown.ltfStructure = 10;
  } else {
    breakdown.ltfStructure = 0;
  }

  // Layer 8: Session Context (5 pts)
  if (session === 'LONDON' || session === 'NEW YORK') {
    score += 5;
    breakdown.session = 5;
  } else {
    score += 2;
    breakdown.session = 2;
  }

  score = Math.min(100, Math.max(0, score));

  let grade = 'NO_SETUP';
  if (score >= 75) grade = 'STRONG';
  else if (score >= 60) grade = 'READY';
  else if (score >= 40) grade = 'WATCH';

  return { score, grade, breakdown };
}

export function aPlusEligible({ready,confluence,dr,target,side,price,news}) {
  return Boolean(ready && confluence?.score>=75 && dr?.locationStatus===1 &&
    ['SAFE','UPCOMING','MEDIUM_ALERT'].includes(news?.status) &&
    ['BUY','SELL'].includes(side) && Number.isFinite(price) && Number.isFinite(target?.level) &&
    target.level>0 && target.status==='ACTIVE' && target.side===side &&
    (side==='BUY'?target.level>price:target.level<price));
}

export function buildLegacyMarketContext({h1=[],m15=[],m5=[],m1=[],d1=[],nowSeconds=Math.floor(Date.now()/1000),calendar=[]}={}) {
  const isM5=Array.isArray(m5)&&m5.length>0;
  const confCandles=isM5?m5:m1;
  const tfName=isM5?'M5':'M1';
  const H=closedCandles(h1,nowSeconds,3600),M=closedCandles(m15,nowSeconds,900),C=closedCandles(confCandles,nowSeconds,isM5?300:60),D=closedCandles(d1,nowSeconds);
  const closedM1=isM5&&m1&&m1.length?closedCandles(m1,nowSeconds):null;
  const source={H1:latest(H)?.close_time||null,M15:latest(M)?.close_time||null,
    M5:isM5?(latest(C)?.close_time||null):null,
    M1:!isM5?(latest(C)?.close_time||null):(latest(closedM1||[])?.close_time||latest(C)?.close_time||null),
    D1:latest(D)?.close_time||null};
  if(isM5&&!source.M5&&source.M1)source.M5=source.M1;
  if(!source.M1&&source.M5)source.M1=source.M5;
  const confTime=isM5?source.M5:source.M1;
  const maxConfAge=isM5?900:180;
  const fresh=H.length>=30&&M.length>=40&&C.length>=40&&source.H1&&source.M15&&confTime&&
    nowSeconds-source.H1>=0&&nowSeconds-source.H1<=3*3600&&nowSeconds-source.M15>=0&&nowSeconds-source.M15<=35*60&&
    nowSeconds-confTime>=0&&nowSeconds-confTime<=maxConfAge;
  const session=goldSession(nowSeconds);
  const newsContext=evaluateEconomicCalendar(calendar,nowSeconds);
  const base={version:CONTEXT_VERSION,policyVersion:CONTEXT_POLICY,symbol:'XAU/USD',generatedAt:new Date(nowSeconds*1000).toISOString(),source,fresh:Boolean(fresh),
    session,
    news:newsContext};
  if(!fresh) return {...base,h1:{bias:'NEUTRAL',health:'WEAKENING'},m15:{control:'BALANCED',poi:null},
    m5:{status:'WAITING'},m1:{status:'WAITING'},liquidity:[],volatility:{condition:'UNKNOWN',atr:null},marketState:'DATA TERLAMBAT',
    primary:null,alternative:null,execution:{status:'NOT READY',checklist:[],reason:`Candle H1, M15, atau ${tfName} belum lengkap atau terlambat.`},
    narrative:'Data candle tertutup belum cukup segar untuk membentuk konteks pasar.',event:null};
  const h=structure(H),m=structure(M),mp=swings(M),allZones=zones(M,mp),levels=liquidity(M,D,mp,nowSeconds);
  const hValid=h.bias!=='NEUTRAL'&&h.health!=='INVALIDATED';
  const side=hValid?(h.bias==='BULLISH'?'BUY':'SELL'):(m.bias==='BULLISH'?'BUY':m.bias==='BEARISH'?'SELL':null);
  const opposite=side==='BUY'?'SELL':side==='SELL'?'BUY':null,control=m.bias==='BULLISH'?'BUYER':m.bias==='BEARISH'?'SELLER':'BALANCED';
  const close=latest(M).close,vol=atr(M),oldVols=[];
  for(let i=Math.max(15,M.length-100);i<M.length;i++){const x=atr(M,i);if(x)oldVols.push(x);}
  oldVols.sort((a,b)=>a-b);const median=oldVols[Math.floor(oldVols.length/2)]||vol;
  const highVolatility=vol>median*1.5||latest(M).high-latest(M).low>vol*1.8;
  const choose=s=>allZones.filter(z=>z.side===s&&!['INVALID','MITIGATED'].includes(z.lifecycle)&&
    (s==='BUY'?z.low<=close+vol*2:z.high>=close-vol*2))
    .sort((a,b)=>Math.max(0,close-a.high,a.low-close)-Math.max(0,close-b.high,b.low-close)||b.formedAt-a.formedAt)[0]||null;
  const poi=side?choose(side):null,alternatePoi=side?choose(opposite):null;
  const near=poi&&Math.max(0,poi.low-close,close-poi.high)<=vol;
  const confirming=confirmation(C,poi,side);
  if(poi&&((side==='BUY'&&latest(M).close<poi.low)||(side==='SELL'&&latest(M).close>poi.high)))confirming.status='FAILED';
  const aligned=side&&hValid&&(side==='BUY'?control==='BUYER':control==='SELLER');
  if(h.bias!=='NEUTRAL'&&!aligned)h.health=h.health==='INVALIDATED'?'INVALIDATED':'WEAKENING';
  const target=levels.filter(l=>l.status==='ACTIVE'&&l.side===side).sort((a,b)=>Math.abs(a.level-close)-Math.abs(b.level-close))[0]||null;
  const altTarget=levels.filter(l=>l.status==='ACTIVE'&&l.side===opposite).sort((a,b)=>Math.abs(a.level-close)-Math.abs(b.level-close))[0]||null;

  // Dealing Range & Location Status calculation
  const dr=dealingRange(M,m,mp,side);

  // Multi-Layer Confluence Scoring (0-100)
  const confluence=calculateConfluenceScore({
    h1Struct:h,
    side,
    aligned,
    poi,
    nearPoi:near,
    confirming,
    levels,
    dr,
    session
  });

  const fallbackInvalidation = s => {
    const matchingH1=h.bias===(s==='BUY'?'BULLISH':'BEARISH');
    const candidates=s==='BUY'?[matchingH1?h.protectedLevel:null,h.swingLow,m.swingLow]:
      [matchingH1?h.protectedLevel:null,h.swingHigh,m.swingHigh];
    return candidates.find(level=>Number.isFinite(level)&&level>0&&(s==='BUY'?level<close:level>close)) ?? null;
  };
  const defaultInvalidation = side ? fallbackInvalidation(side) : null;
  const scenario=(s,z,t,isAlternative=false)=>{
    if (!s) return null;
    const inv = z ? (s==='BUY'?z.low:z.high) : fallbackInvalidation(s);
    return {side:s,label:s==='BUY'?'BELI GOLD':'JUAL GOLD',area:z?{low:z.low,high:z.high,ce:z.ce}:null,
      poiType:z?.kind||null,poiStatus:z?.lifecycle||null,target:t?.level||null,invalidation:inv,
      reasons:[isAlternative?'Dapat dipertimbangkan hanya setelah skenario utama batal':`Bias H1 ${h.bias==='BULLISH'?'naik':h.bias==='BEARISH'?'turun':'netral'}${h.health==='INVALIDATED'?' (batal)':''}`,
        isAlternative?`M15 harus beralih ke ${s==='BUY'?'pembeli':'penjual'}`:`Kontrol M15 ${control==='BUYER'?'pembeli':control==='SELLER'?'penjual':'seimbang'}`,
        z?`${z.label} M15 ${z.low.toFixed(2)}–${z.high.toFixed(2)} (CE: ${z.ce.toFixed(2)}, ${z.lifecycle})`:'Belum ada area M15 valid'],
      waiting:z?`Tunggu harga merespons area M15 dan sweep + MSS + displacement/FVG ${tfName}.`:'Tunggu POI M15 yang valid.',
      status:z?'WAITING CONFIRMATION':'NO VALID POI'};
  };
  const checklist=[{label:'H1 searah dengan M15',ok:Boolean(aligned)},
    {label:'POI M15 valid dan dekat harga',ok:Boolean(poi&&near)},
    {label:`Likuiditas ${tfName} disapu dan direbut kembali`,ok:Boolean(confirming.sweep)},
    {label:`${tfName} MSS, displacement, dan micro FVG`,ok:confirming.status==='CONFIRMED'},
    {label:'Batas invalidasi tersedia',ok:Boolean(poi||defaultInvalidation)},
    {label:'Target likuiditas aktif searah tersedia',ok:Boolean(target)},
    {label:'Kalender minggu berjalan terverifikasi',ok:newsContext.status!=='UNVERIFIED'}];
  const ready=checklist.every(x=>x.ok);
  const isNewsLock=newsContext.status==='NEWS_LOCK';
  const isAplusReady = aPlusEligible({ready,confluence,dr,target,side,price:close,news:newsContext});
  const direction=h.health==='INVALIDATED'?'Batal':h.bias==='BULLISH'?'Naik':h.bias==='BEARISH'?'Turun':'Netral';
  const controlling=control==='BUYER'?'pembeli':control==='SELLER'?'penjual':'seimbang';

  // Natural contextual narration & accurate market state
  let state;
  let narrativeText;
  if (isNewsLock) {
    state = 'NEWS LOCK · TUNDA EKSEKUSI';
    narrativeText = newsContext.note;
  } else if (h.health === 'INVALIDATED') {
    state = 'STRUKTUR BATAL';
    narrativeText = `⚠️ Setup Batal: Struktur ${direction} jebol. Konfirmasi ${tfName} dibatalkan. Jangan entry, tunggu pembentukan struktur baru.`;
  } else if (!aligned && h.bias !== 'NEUTRAL') {
    if (h.bias === 'BULLISH') {
      state = 'BULLISH PULLBACK (Koreksi Diskon)';
      narrativeText = `📊 BULLISH PULLBACK: H1 naik, M15 sedang koreksi menuju zona diskon. Konfirmasi ${tfName} ${confirming.status === 'CONFIRMED' ? 'terpenuhi' : 'masih ditunggu'}. Tahan diri, jangan pernah SELL!`;
    } else {
      state = 'BEARISH PULLBACK (Koreksi Premium)';
      narrativeText = `📊 BEARISH PULLBACK: H1 turun, M15 sedang koreksi menuju zona premium. Konfirmasi ${tfName} ${confirming.status === 'CONFIRMED' ? 'terpenuhi' : 'masih ditunggu'}. Tahan diri, jangan pernah BUY!`;
    }
  } else if (isAplusReady) {
    state = 'KONFIRMASI SEARAH (A+)';
    narrativeText = `🔥 Rejection kuat di ${poi?.label||'area M15'}. Konfirmasi ${tfName} ${side} lengkap (Sweep + MSS + Displacement). Skor Konfluensi: ${confluence.score}/100 (${confluence.grade}).`;
  } else if (poi && near) {
    state = `H1 ${direction.toLowerCase()} · dekat area M15`;
    narrativeText = `📍 Harga mendekati ${poi.label} (${poi.low.toFixed(2)}–${poi.high.toFixed(2)}). Menunggu reaksi rejection & konfirmasi sweep/MSS ${tfName}.`;
  } else {
    state = `H1 ${direction.toLowerCase()} · menunggu area`;
    narrativeText = `Gold H1 ${direction.toLowerCase()} (${h.health==='HEALTHY'?'kuat':h.health==='INVALIDATED'?'batal':'melemah'}). M15 dikuasai ${controlling}. `+
      (poi?`Area ${poi.label} ${poi.low.toFixed(2)}–${poi.high.toFixed(2)} berstatus ${poi.lifecycle.toLowerCase()}. `:'Belum ada area M15 valid. ')+
      `Konfirmasi ${tfName} ${confirming.status==='CONFIRMED'?'terpenuhi':confirming.status==='FAILED'?'gagal':'masih ditunggu'}. ${isNewsLock?'⛔ News Lock aktif; tunda eksekusi hingga pasar stabil.':ready?'Skenario layak ditinjau manual.':'Tunggu perubahan struktur dan konfirmasi sebelum meninjau eksekusi.'}`;
  }

  const status=isAplusReady?'READY TO REVIEW':'NOT READY';
  const reason=isNewsLock?`⛔ News Lock Aktif: Rilis ${newsContext.event} ${newsContext.diffMinutes<=0?'sedang rilis / baru saja rilis':`dalam ${newsContext.diffMinutes} menit`}. Hindari entry untuk mencegah slippage & spread melebar.`:
    (isAplusReady?`Semua bukti candle terpenuhi (Skor Konfluensi: ${confluence.score}/100 - ${confluence.grade}). Tinjau spread dan kalender berita secara manual.`:
    h.bias!=='NEUTRAL'&&!aligned?`H1 ${direction.toLowerCase()}, M15 sedang pullback korektif. Tahan diri dan tunggu pembentukan setup di zona diskon/premium.`:
    `Menunggu: ${checklist.find(x=>!x.ok)?.label||(dr.locationStatus!==1?'lokasi discount/premium yang sesuai':'skor konfluensi minimal 75')}.`);

  // Sniper Notification Policy:
  // HAPUS total notifikasi CONFLICT ("Scalp Kilat") dan APPROACH ("Intip Area").
  // HANYA kirim notifikasi saat:
  // 1. isNewsLock (Safety lock)
  // 2. ATAU Peluru Utama A+ (ready && confluence.score >= 75 && dr.locationStatus === 1)
  // Selain 2 kondisi di atas, event WAJIB NULL (server diam!).
  let event = null;
  if (isNewsLock) {
    event = {
      key: [CONTEXT_VERSION, 'NEWS_LOCK', newsContext.event].join(':'),
      title: '🛡️ Tahan Dulu: Pasar Lagi Liar',
      body: `Rilis ${newsContext.event||'berita'} ${newsContext.diffMinutes<=0?'sedang berlangsung':'sebentar lagi'}. Jangan dipaksa masuk, pantau dulu dari pinggir.`
    };
  } else if (isAplusReady) {
    const targetLevel = Number(target.level).toFixed(2);
    const entryLevel = poi ? `${poi.low.toFixed(2)}–${poi.high.toFixed(2)}` : 'area M15';
    event = {
      key: [CONTEXT_VERSION, 'A_PLUS_READY', side, h.bias, m.bias, m.lastBreak?.time||0, poi?.id||'none', confluence.score].join(':'),
      title: `🟢 Peluru Utama: ${side} XAUUSD`,
      body: `H1 & M15 kompak ${direction.toLowerCase()} (Skor ${confluence.score}/100). Area ${entryLevel}, TP ${targetLevel}. Setup mantap, pasang & santai!`
    };
  }

  const alternative=scenario(opposite,alternatePoi,altTarget,true);
  const activeInv = poi ? (side==='BUY'?poi.low:poi.high) : defaultInvalidation;
  if(alternative)alternative.activation=[
    activeInv!=null?`Close M15 ${side==='BUY'?'di bawah':'di atas'} ${Number(activeInv).toFixed(2)} membatalkan ${poi?'area':'struktur'} utama.`:'Area utama belum terbentuk; tunggu level invalidasi.',
    `M15 membentuk kontrol ${opposite==='BUY'?'buyer':'seller'} dan mempertahankannya.`,
    `${tfName} menunjukkan sweep, MSS, displacement, serta micro FVG ${opposite==='BUY'?'bullish':'bearish'}.`
  ];
  return {...base,price:round(close),h1:h,m15:{control,structure:m.bias,lastBreak:m.lastBreak,poi,
      opposingControl:Boolean(h.bias!=='NEUTRAL'&&!aligned),dealingRange:dr},m5:confirming,m1:confirming,liquidity:levels,
    volatility:{condition:highVolatility?'HIGH VOLATILITY':'NORMAL',atr:round(vol)},confluence,marketState:state,
    primary:scenario(side,poi,target),alternative,
    execution:{status,checklist,reason,aPlusReady:isAplusReady},narrative:narrativeText,event};
}

// Compatibility envelope for existing server consumers; M15 now owns the decision.
export function buildMarketContext(input={}) {
  const now=input.nowSeconds??Math.floor(Date.now()/1000),H=closedCandles(input.h1,now,3600),M=closedCandles(input.m15,now,900),T=closedCandles(input.m5,now,300);
  const source={H1:latest(H)?.close_time??null,M15:latest(M)?.close_time??null,M5:latest(T)?.close_time??null,M1:null,D1:null};
  const fresh=H.length>=30&&M.length>=40&&T.length>=40&&now-source.H1<=10800&&now-source.M15<=2100&&now-source.M5<=900;
  const news=evaluateEconomicCalendar(input.calendar||[],now),session=goldSession(now);
  const base={version:CONTEXT_VERSION,policyVersion:CONTEXT_POLICY,symbol:'XAU/USD',generatedAt:new Date(now*1000).toISOString(),source,fresh:Boolean(fresh),news,session};
  if(!fresh)return {...base,h1:{bias:'NEUTRAL',health:'WEAKENING'},m15:{control:'BALANCED',poi:null},m5:{status:'WAITING'},m1:{status:'WAITING'},primary:null,alternative:null,liquidity:[],volatility:{condition:'UNKNOWN',atr:null},confluence:{score:0,grade:'NO_SETUP'},marketState:'DATA TERLAMBAT',execution:{status:'NOT READY',aPlusReady:false,checklist:[],reason:'Candle H1, M15, atau M5 belum lengkap atau terlambat.'},narrative:'Menunggu candle tertutup yang segar.',event:null,amy:null};
  const amy=analyzeAmy({...input,h1:H,m15:M,m5:T,nowSeconds:now}),d=amy.dashboard,e=amy.entry,t=amy.trigger;
  const side=d.biasDir===1?'BUY':d.biasDir===-1?'SELL':null,poi=d.poi,price=t.candle.close;
  const bias=dir=>dir===1?'BULLISH':dir===-1?'BEARISH':'NEUTRAL';
  const h=structure(H),opposing=Boolean(side&&h.bias!=='NEUTRAL'&&h.bias!==bias(d.biasDir));
  const dr={rangeHigh:d.rangeHigh,rangeLow:d.rangeLow,eq:d.eq,eqLow:d.eqLow,eqHigh:d.eqHigh,location:d.priceZone===1?'PREMIUM':d.priceZone===-1?'DISCOUNT':'EQUILIBRIUM',locationStatus:d.locationStatus};
  const target=d.dolTarget!=null?{label:d.dolDir===1?'BSL':'SSL',level:d.dolTarget,side:d.dolDir===1?'BUY':'SELL',status:d.dolStatus===1?'ACTIVE':'TAKEN'}:null;
  const validTarget=target?.status==='ACTIVE'&&target.side===side&&(side==='BUY'?target.level>price:target.level<price);
  const invalidValid=d.invalidLevel!=null&&(side==='BUY'?d.invalidLevel<price:side==='SELL'?d.invalidLevel>price:false);
  const alignedTrigger=side&&(side==='BUY'?t.bullBreak&&t.bullDisp:t.bearBreak&&t.bearDisp);
  const checks=[{label:'ATR M15 tersedia dari candle berurutan',ok:Number.isFinite(d.atr)},
    {label:'Bias M15 aktif dan belum invalid',ok:Boolean(side&&d.invalidStatus<2)},
    {label:'POI searah bias dan respons harga',ok:Boolean(poi&&e.inPoi)},
    {label:'Sweep segar searah bias',ok:Boolean(d.sweepStatus===1&&d.sweepDir===d.biasDir||t.sweepDir===d.biasDir&&d.biasDir)},
    {label:'M5 break struktur dan displacement',ok:Boolean(alignedTrigger)},
    {label:'Invalidasi M15 sesuai arah',ok:invalidValid},
    {label:'Target likuiditas aktif searah',ok:Boolean(validTarget)},
    {label:'Kalender minggu berjalan terverifikasi',ok:news.status!=='UNVERIFIED'},
    {label:'Tidak ada news lock',ok:news.status!=='NEWS_LOCK'}];
  const ready=checks.every(x=>x.ok),confluence={...e,breakdown:e.breakdown,score:e.score,grade:e.grade};
  const aPlus=ready&&e.score>=75&&e.winDir===d.biasDir&&d.locationStatus===1&&news.status!=='UNVERIFIED'&&news.status!=='NEWS_LOCK';
  const status=aPlus?'READY TO REVIEW':'NOT READY',reason=news.status==='NEWS_LOCK'?news.note:aPlus?'Bukti M15/M5 lengkap. Tinjau spread dan risiko secara manual.':`Menunggu: ${checks.find(x=>!x.ok)?.label||(d.locationStatus!==1?'lokasi discount/premium yang sesuai':'skor minimal 75 searah bias')}.`;
  const scenario=side?{side,label:side==='BUY'?'BELI GOLD':'JUAL GOLD',area:poi?{low:poi.low,high:poi.high,ce:poi.ce}:null,poiType:poi?.kind??null,poiStatus:poi?.lifecycle??null,target:validTarget?target.level:null,invalidation:d.invalidLevel,reasons:[`Bias M15 ${bias(d.biasDir)}`,`H1 ${h.bias} · konteks tambahan`,poi?`${poi.kind} ${poi.lifecycle}`:'POI belum tersedia'],waiting:'Tunggu respons POI dan konfirmasi M5.',status:poi?'WAITING CONFIRMATION':'NO VALID POI'}:null;
  const levels=liquidity(M,closedCandles(input.d1,now),swings(M),now);
  for(const [label,level,side]of [['BSL',d.bsl,'BUY'],['SSL',d.ssl,'SELL'],['MO',amy.levels.midnightOpen,null],['ASIA H',amy.levels.asiaHigh,'BUY'],['ASIA L',amy.levels.asiaLow,'SELL']])if(level!=null)levels.push({label,level,side,status:'REFERENCE'});
  const counterScore=e.winDir&&d.biasDir&&e.winDir!==d.biasDir;
  const narrative=news.status==='NEWS_LOCK'?news.note:e.text+(opposing?'\nH1 berlawanan · konteks tambahan, pantau risiko.':'');
  let event=null;
  if(news.status==='NEWS_LOCK')event={key:[CONTEXT_POLICY,'NEWS_LOCK',news.event].join(':'),title:'🛡️ Tahan Dulu: News Lock',body:news.note};
  else if(aPlus)event={key:[CONTEXT_POLICY,'A_PLUS_READY',side,poi.id,d.invalidLevel,d.dolTarget].join(':'),title:`🟢 Konfirmasi M15/M5: ${side} XAUUSD`,body:`Confluence ${e.score}/100 poin. Area ${poi.low.toFixed(2)}–${poi.high.toFixed(2)}; likuiditas ${target.level.toFixed(2)}. Tinjau manual.`};
  const confirmation={status:alignedTrigger?'CONFIRMED':e.inPoi?'CONFIRMING':'WAITING',sweep:t.sweepDir?{level:t.sweptPrice,time:t.time}:d.sweepStatus===1?{level:d.sweep.price,time:d.sweep.time}:null,mss:alignedTrigger?{level:side==='BUY'?t.high:t.low,time:t.time}:null,microFvg:null};
  return {...base,source:{...amy.source,M1:amy.source.M1||amy.source.M5},price,h1:h,m15:{control:d.biasDir===1?'BUYER':d.biasDir===-1?'SELLER':'BALANCED',structure:bias(d.biasDir),lastBreak:latest(amy.events),poi:poi?{...poi,label:`${poi.side} ${poi.kind}`} :null,opposingControl:opposing,dealingRange:dr,invalidLevel:d.invalidLevel,invalidStatus:d.invalidStatus},m5:confirmation,m1:confirmation,liquidity:levels,volatility:{condition:'NORMAL',atr:d.atr},confluence,marketState:news.status==='NEWS_LOCK'?'NEWS LOCK · TUNDA EKSEKUSI':d.invalidStatus===2?'STRUKTUR M15 BATAL':counterScore?`${bias(d.biasDir)} · SKOR ${e.winDir===1?'BUY':'SELL'} BERLAWANAN BIAS`:`${bias(d.biasDir)} · ${e.grade}`,primary:scenario,alternative:null,execution:{status,aPlusReady:aPlus,checklist:checks,reason},narrative,event,amy};
}

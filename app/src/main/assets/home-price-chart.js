import {analyze} from './apps/mapping/js/ict-workspace/engine.js';
import {loadCandles} from './apps/mapping/js/ict-workspace/data.js';
import {createPriceChart} from './apps/mapping/js/ict-workspace/chart-view.js';
import {updateDealingRangeBadge} from './apps/mapping/js/ict-workspace/dealing-range-badge.js';

function isWeekendClosure(timeSec) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short'
    }).formatToParts(new Date(timeSec * 1000));
    const values = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const weekday = values.weekday, hour = Number(values.hour) + Number(values.minute) / 60;
    if (weekday === 'Sat') return true;
    if (weekday === 'Sun') return hour < 17;
    if (weekday === 'Fri') return hour >= 17;
    return false;
  } catch (_) {
    const d = new Date(timeSec * 1000), day = d.getUTCDay();
    return day === 6 || day === 0;
  }
}

function isGoldMarketOpen(nowSeconds = Math.floor(Date.now() / 1000)) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit', minute: '2-digit', weekday: 'short'
    }).formatToParts(new Date(nowSeconds * 1000));
    const values = Object.fromEntries(parts.map(x => [x.type, x.value]));
    const weekday = values.weekday, hour = Number(values.hour) + Number(values.minute) / 60;
    if (weekday === 'Sat') return false;
    if (weekday === 'Sun') return hour >= 17;
    if (weekday === 'Fri') return hour < 17;
    if (hour >= 17 && hour < 18) return false;
    return true;
  } catch (_) {
    const d = new Date(nowSeconds * 1000), day = d.getUTCDay();
    return day !== 0 && day !== 6;
  }
}

function toTimestamp(time) {
  if (typeof time === 'number') return time;
  const ms = new Date(time).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

function filterCandles(values, closed) {
  if (!closed || !Array.isArray(values)) return values || [];
  return values.filter(c => {
    if (c?.amyfxSyntheticCurrent || c?.synthetic) return false;
    const t = toTimestamp(c.time ?? c.datetime ?? c.open_time);
    return !isWeekendClosure(t);
  });
}

function lenientCandles(values) {
  const closed = !isGoldMarketOpen(Date.now() / 1000);
  const map = new Map();
  for (const c of values || []) {
    if (c?.amyfxSyntheticCurrent || c?.synthetic) continue;
    const t = toTimestamp(c.time ?? c.datetime ?? c.open_time);
    if (closed && isWeekendClosure(t)) continue;
    const o = { time: t, open: Number(c.open), high: Number(c.high), low: Number(c.low), close: Number(c.close) };
    if (Object.values(o).every(Number.isFinite) && o.low > 0) map.set(t, o);
  }
  return [...map.values()].sort((a, b) => a.time - b.time);
}

export function mountHomeChart(root) {
  const $=id=>root.querySelector('#'+id);
  let view=null,raw=null,controller=null,timer=null,generation=0,disposed=false;
  let h1Cache=null,h1CacheTime=0;
  try { view=createPriceChart($('home-price-chart')); }
  catch { $('home-price-chart').textContent='Chart tidak tersedia. Coba muat ulang aplikasi.';return ()=>{}; }
  function render(degraded=false){
    const tf=$('home-chart-tf').value;
    const closed=!isGoldMarketOpen(Date.now()/1000);
    const safeCandles=filterCandles(raw?.candles||[],closed);
    const safeContext=filterCandles(raw?.context||[],closed);
    let result=null;
    try {
      result=analyze({...raw,candles:safeCandles,context:safeContext,tf,now:Date.now()/1000,degraded:degraded||raw?.degraded||false});
    } catch (_) {
      const candles=lenientCandles(safeCandles);
      result={candles,tf,plan:null,sourceTime:candles.at(-1)?.time||null,fresh:!raw?.degraded};
    }
    view.draw(result);
    const last=result.candles.at(-1);
    $('home-chart-price').textContent=last?last.close.toFixed(2):'—';
    if($('home-chart-dealing-range-badge')){
      const dr = window.amyfxLastContext?.m15?.dealingRange || window.amyfxLastContext?.amy?.levels?.dealingRange || window.amyfxLastContext?.dealingRange;
      if(last) updateDealingRangeBadge($('home-chart-dealing-range-badge'), last.close, dr);
    }
    if($('home-chart-source')){
      if(!last){
        $('home-chart-source').textContent='Belum ada candle. Periksa koneksi lalu tekan Perbarui.';
      }else{
        const timeStr=new Date((result.sourceTime||last.time)*1000).toLocaleString('id-ID',{timeZone:'Asia/Makassar',hour12:false});
        if(closed){
          const isWeekend=isWeekendClosure(Date.now()/1000);
          const statusText=isWeekend?'Pasar Tutup (Akhir Pekan)':'Pasar Tutup';
          $('home-chart-source').textContent=`${tf} · ${statusText} · Candle Terakhir: ${timeStr} WITA · ${result.fresh?'Data Terkini':'Referensi lama / data terlambat'}`;
        }else{
          $('home-chart-source').textContent=`${tf} · Candle ${timeStr} WITA · ${result.fresh?'Candle terkini':'Referensi lama / data terlambat'}`;
        }
      }
    }
    if($('home-chart-note'))$('home-chart-note').textContent=result.plan?'Level entry, SL dan target: model ICT lokal, bukan setup Scalper server.':'';
  }
  function stop(){generation++;controller?.abort();clearTimeout(timer);}
  async function refresh(){
    if(disposed||document.hidden)return;
    stop();const id=generation,tf=$('home-chart-tf').value;
    controller=new AbortController();const request=controller;
    const timeout=setTimeout(()=>request.abort(),20000);
    $('home-chart-refresh').disabled=true;$('home-chart-error').textContent='';
    if(raw)render();
    try {
      const isH1 = tf === 'H1';
      const shouldFetchH1 = !isH1 && (!h1Cache || (Date.now() - h1CacheTime > 300000));
      const [entry, context] = await Promise.all([
        loadCandles(tf, request.signal),
        isH1 ? null : (shouldFetchH1 ? loadCandles('H1', request.signal).catch(() => h1Cache || ({ candles: [], degraded: true })) : h1Cache)
      ]);
      if(disposed||id!==generation)return;
      if (isH1) {
        h1Cache = entry;
        h1CacheTime = Date.now();
      } else if (shouldFetchH1 && context) {
        h1Cache = context;
        h1CacheTime = Date.now();
      }
      const actualContext = isH1 ? entry : (context || h1Cache || { candles: [], degraded: true });
      const closed=!isGoldMarketOpen(Date.now()/1000);
      const safeEntryCandles=filterCandles(entry.candles,closed);
      const safeContextCandles=filterCandles(actualContext.candles,closed);
      const next={candles:safeEntryCandles,context:safeContextCandles,tf,degraded:entry.degraded||actualContext.degraded};
      const result=analyze({...next,now:Date.now()/1000});
      const previous=raw?analyze({...raw,now:Date.now()/1000}):null;
      if(!result.candles.length||(previous&&result.sourceTime<previous.sourceTime))throw Error('Candle tidak lengkap atau lebih lama');
      raw=next;render();
    } catch {
      if(disposed||id!==generation)return;
      if(raw)raw.degraded=true;
      render(true);$('home-chart-error').textContent='Pembaruan gagal. Data sebelumnya hanya referensi lama.';
    } finally {
      clearTimeout(timeout);
      if(!disposed&&id===generation){
        $('home-chart-refresh').disabled=false;
        if(!document.hidden){
          const interval=isGoldMarketOpen(Date.now()/1000)?60000:300000;
          timer=setTimeout(refresh,interval);
        }
      }
    }
  }
  function change(){
    stop();
    const newTf = $('home-chart-tf').value;
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(`amyfx.mapping.candles.${newTf}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed?.values) && parsed.values.length > 0) {
            const closed = !isGoldMarketOpen(Date.now() / 1000);
            raw = {
              candles: filterCandles(parsed.values, closed),
              context: raw?.context || h1Cache?.candles || [],
              tf: newTf,
              degraded: true
            };
            render(true);
          }
        }
      }
    } catch (_) {}
    refresh();
  }
  function visibility(){if(document.hidden)stop();else refresh();}
  function pageshow(event){if(event.persisted)refresh();}
  $('home-chart-refresh').addEventListener('click',refresh);
  $('home-chart-tf').addEventListener('change',change);
  document.addEventListener('visibilitychange',visibility);
  window.addEventListener('online',refresh);window.addEventListener('pagehide',stop);window.addEventListener('pageshow',pageshow);
  refresh();
  return ()=>{disposed=true;stop();view.destroy();
    $('home-chart-refresh').removeEventListener('click',refresh);$('home-chart-tf').removeEventListener('change',change);
    document.removeEventListener('visibilitychange',visibility);window.removeEventListener('online',refresh);
    window.removeEventListener('pagehide',stop);window.removeEventListener('pageshow',pageshow);
  };
}
window.AmyHomeChart={mount:mountHomeChart,isWeekendClosure,isGoldMarketOpen,filterCandles};

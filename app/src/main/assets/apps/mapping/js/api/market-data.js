import { state, TF, log, save } from '../main.js';
import { analyze, tfGroup } from '../engine/ict-core.js';
import { render, renderSoft, renderAnalyzeLive } from '../ui/ui-render.js';
import { sendTargetsToNative, notifyImportant } from '../bridge/android-bridge.js';

export let ws = null;
export let reconnectTimer = null;
export let scanTimer = null;
export let lastWsTickAt = Number(localStorage.getItem('last_ws_tick_at')||0);

const PROXY_URL = 'https://amy-fx.vercel.app/api/twelvedata';

export async function fetchTf(tf){
  if(!state.key.trim()) throw new Error('API key kosong');
  let url = `${PROXY_URL}?symbol=XAU/USD&interval=${TF[tf]}&outputsize=300&apikey=${encodeURIComponent(state.key.trim())}`;
  let r = await fetch(url);
  let d = await r.json();
  if(d.status==='error') throw new Error(d.message||'Fetch gagal');
  let arr=(d.values||[]).reverse().map(c=>({time:new Date(c.datetime).getTime()/1000,timeframe:tf,open:+c.open,high:+c.high,low:+c.low,close:+c.close,tickCount:1,isClosed:true}));
  state.candles[tf]=arr;
  return arr;
}

export async function runAnalysis(tf=state.tf){
  if(typeof scanTimer!=='undefined'&&scanTimer){clearTimeout(scanTimer);scanTimer=null;}
  state.tf=tf;
  render();
  try{
    log('Memindai '+tf+'...');
    let group=tfGroup(tf),scanGroup=[...new Set([...group,'M1','M5','M15','M30','H1','H4'])];
    await Promise.all(scanGroup.map(x=>state.candles[x]?.length?Promise.resolve(state.candles[x]):fetchTf(x).catch(e=>[])));
    let htfBiases={};
    for(let x of group.filter(x=>x!==tf)){
      let mini=state.candles[x];
      if(mini?.length>30){
        let a=analyze(mini,x,{},state.price);
        htfBiases[x]=a?.st?.trend||'NEUTRAL';
      }
    }
    let res=analyze(state.candles[tf],tf,htfBiases,state.price);
    state.result=res;
    state.setups=[...(res?.setups||[]),...state.setups].slice(0,50);
    state.analyses=[{id:Date.now(),...res},...state.analyses].slice(0,80);
    save();
    log(`${tf} selesai: ${res.signal} score ${res.score}/100`);
    sendTargetsToNative();
    notifyImportant(res);
  }catch(e){
    log('Error '+tf+': '+e.message);
  }
  render();
}

export function connect(){
  if(!state.key.trim()){log('Masukkan API key dulu.');return}
  localStorage.setItem('twelve_api_key',state.key.trim());
  if(ws){ws.onclose=null;ws.close()}
  state.conn='Reconnecting';
  renderSoft();
  ws=new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${encodeURIComponent(state.key.trim())}`);
  ws.onopen=()=>{
    state.conn='Connected';
    renderSoft();
    ws.send(JSON.stringify({action:'subscribe',params:{symbols:'XAU/USD'}}));
    log('WebSocket Connected.');
    runAnalysis(state.tf);
  };
  ws.onmessage=e=>{
    try{
      let d=JSON.parse(e.data),p=+d.price;
      if(p>1000&&p<10000){
        lastWsTickAt=Date.now();
        localStorage.setItem('last_ws_tick_at',String(lastWsTickAt));
        state.price=p;
        localStorage.setItem('last_price',String(p));
        renderAnalyzeLive();
        if(!scanTimer)scanTimer=setTimeout(()=>{scanTimer=null;runAnalysis(state.tf)},15000);
      }
    }catch(_){}
  };
  ws.onclose=()=>{
    state.conn='Offline';
    renderSoft();
    clearTimeout(reconnectTimer);
    reconnectTimer=setTimeout(connect,8000);
  };
  ws.onerror=()=>log('WebSocket error');
}

export function updateWsVars(w, r, s, l) {
  ws = w;
  reconnectTimer = r;
  scanTimer = s;
  lastWsTickAt = l;
}

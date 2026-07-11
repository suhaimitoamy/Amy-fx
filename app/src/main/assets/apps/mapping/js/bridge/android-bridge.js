import { state, save, setupText, p2 } from '../main.js';
import { connect, stopLivePrice, runAnalysis } from '../api/market-data.js';
import { render } from '../ui/ui-render.js';

function browserNotify(title,msg,route='Analyze'){
  if(typeof Notification==='undefined')return;
  Notification.requestPermission().then(permission=>{
    if(permission!=='granted')return;
    const notification=new Notification(title,{body:msg,tag:`amy-mapping-${route.toLowerCase()}`});
    notification.onclick=()=>{window.focus();location.hash=route;window.setTab?.(route)};
  });
}

export function notifyImportant(res){
  let s=res?.bestSetup;
  if(!s||s.score<70)return;
  let key=`${s.type}:${s.dir}:${Math.round(s.entryLow*10)}:${Math.round(s.sl*10)}`;
  let last=state.notified[key]||0;
  if(Date.now()-last<300000)return;
  state.notified[key]=Date.now();
  localStorage.setItem('amy_mapping_notified',JSON.stringify(state.notified));
  let msg=setupText(s);
  if(window.Android?.showNotificationWithUrl)window.Android.showNotificationWithUrl('AMY FX — '+s.type,msg,location.href);
  else browserNotify('AMY FX — '+s.type,msg);
}

export function sendTargetsToNative(){if(!state.bg||!state.key.trim())return;if(state.tf!=='M15'){if(window.Android?.stopBackgroundScanner)window.Android.stopBackgroundScanner();return}if(window.Android?.startBackgroundScanner){let s=state.result?.bestSetup;if(s?.executionMode==='M15_PRECISION'&&Number.isFinite(s.entryLow)&&Number.isFinite(s.entryHigh)){let upper=0.0,lower=0.0;if(s.dir.includes('SELL')){upper=Math.min(Number(s.entryLow),Number(s.entryHigh))}else if(s.dir.includes('BUY')){lower=Math.max(Number(s.entryLow),Number(s.entryHigh))}window.Android.startBackgroundScanner(state.key,String(upper),String(lower))}else if(window.Android?.stopBackgroundScanner)window.Android.stopBackgroundScanner()}}

export function saveConnect(){
  state.key=document.getElementById('apiKey').value.trim();
  localStorage.setItem('twelve_api_key',state.key);
  if(state.key)connect();
  else {stopLivePrice();window.Android?.stopBackgroundScanner?.();if(state.bg){state.bg=false;save()}runAnalysis(state.tf)}
  sendTargetsToNative();
}

export function toggleBg(){
  if(!state.key.trim()){alert('Isi API key dulu.');return}
  state.bg=!state.bg;
  save();
  if(state.bg) {
    stopLivePrice();
    sendTargetsToNative();
  } else {
    window.Android?.stopBackgroundScanner?.();
    if(state.key.trim()) connect();
  }
  render();
}

export function testNotif(){
  let s=state.result?.bestSetup||{type:'LIQUIDITY SWEEP',dir:'BUY WATCH',tf:'M5',score:78,entryLow:2355.20,entryHigh:2356.00,sl:2353.50,tp1:2358.50,tp2:2362.00,reason:'Contoh notifikasi setup angka.'};
  let msg=setupText(s);
  if(window.Android?.showNotificationWithUrl)window.Android.showNotificationWithUrl('AMY FX — '+s.type,msg,location.href);
  else browserNotify('AMY FX — '+s.type,msg);
}

export function downloadLogs(){
  let blob=new Blob([state.logs.join('\n')],{type:'text/plain'});
  let url=URL.createObjectURL(blob);
  let a=document.createElement('a');
  a.href=url;
  a.download='amy-fx-logs.txt';
  a.click();
  URL.revokeObjectURL(url);
}

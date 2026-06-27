import { state, save, setupText, p2 } from '../main.js';
import { connect } from '../api/market-data.js';
import { render } from '../ui/ui-render.js';

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
  else if(typeof Notification!=='undefined')Notification.requestPermission().then(p=>p==='granted'&&new Notification('AMY FX — '+s.type,{body:msg}));
}

export function sendTargetsToNative(){
  if(state.bg&&window.Android?.startBackgroundScanner){
    let s=state.result?.bestSetup;
    if(s){
      let upper=Math.max(Number(s.entryLow),Number(s.entryHigh)),lower=Math.min(Number(s.entryLow),Number(s.entryHigh));
      window.Android.startBackgroundScanner(state.key,String(upper),String(lower));
    }else{
      let r=state.result;
      window.Android.startBackgroundScanner(state.key,String(r?.bsl||''),String(r?.ssl||''));
    }
  }
}

export function saveConnect(){
  state.key=document.getElementById('apiKey').value.trim();
  localStorage.setItem('twelve_api_key',state.key);
  connect();
  sendTargetsToNative();
}

export function toggleBg(){
  if(!state.key.trim()){alert('Isi API key dulu.');return}
  state.bg=!state.bg;
  save();
  if(state.bg)sendTargetsToNative();
  else window.Android?.stopBackgroundScanner?.();
  render();
}

export function testNotif(){
  let s=state.result?.bestSetup||{type:'LIQUIDITY SWEEP',dir:'BUY WATCH',tf:'M5',score:78,entryLow:2355.20,entryHigh:2356.00,sl:2353.50,tp1:2358.50,tp2:2362.00,reason:'Contoh notifikasi setup angka.'};
  let msg=setupText(s);
  if(window.Android?.showNotificationWithUrl)window.Android.showNotificationWithUrl('AMY FX — '+s.type,msg,location.href);
  else if(typeof Notification!=='undefined')Notification.requestPermission().then(p=>p==='granted'&&new Notification('AMY FX — '+s.type,{body:msg}));
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

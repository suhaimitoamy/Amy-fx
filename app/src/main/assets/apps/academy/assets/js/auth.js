const ACADEMY_ACCESS_KEY='amy_academy_access_hash';
const ACADEMY_SESSION_KEY='amy_academy_session';
const ACADEMY_ACCESS_MODE='PERSONAL_PREVIEW';

async function sha256Hex(message){
    const value=String(message||'');
    if(window.crypto?.subtle){
        const bytes=new TextEncoder().encode(value);
        const hash=await window.crypto.subtle.digest('SHA-256',bytes);
        return Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');
    }
    let hash=2166136261;
    for(let i=0;i<value.length;i++){hash^=value.charCodeAt(i);hash=Math.imul(hash,16777619)}
    return String(hash>>>0);
}

async function validateCode(code){
    const value=String(code||'').trim();
    if(value.length<4)return{ok:false,label:'Kode minimal 4 karakter.'};
    const stored=localStorage.getItem(ACADEMY_ACCESS_KEY);
    const hash=await sha256Hex(value);
    if(!stored){localStorage.setItem(ACADEMY_ACCESS_KEY,hash);return{ok:true,label:'Kode akses dibuat di perangkat ini.'}}
    return stored===hash?{ok:true,label:'Akses diterima.'}:{ok:false,label:'Kode akses salah.'};
}

async function requireLogin(){
    sessionStorage.setItem(ACADEMY_SESSION_KEY,ACADEMY_ACCESS_MODE);
    document.documentElement.classList.add('is-authed');
    window.AmyAcademyAccess=Object.freeze({mode:ACADEMY_ACCESS_MODE,personal:true});
    return true;
}
function logout(){sessionStorage.removeItem(ACADEMY_SESSION_KEY);location.href=typeof ROOT_PATH!=='undefined'?ROOT_PATH+'index.html':'index.html'}

(function(){
  if(window.__amyAcademyCatalog36Loaded)return;
  window.__amyAcademyCatalog36Loaded=true;
  const script=document.createElement('script');
  const root=(typeof ROOT_PATH!=='undefined')?ROOT_PATH:'';
  script.src=root+'assets/js/catalog-36.js';script.async=false;document.head.appendChild(script);
})();

/* Academy reading history is shared with Amy FX production and loaded on every page. */
(function(){
  if(window.__amyAcademyReadingHistoryLoaderV2)return;
  window.__amyAcademyReadingHistoryLoaderV2=true;
  const script=document.createElement('script');
  const root=(typeof ROOT_PATH!=='undefined')?ROOT_PATH:'';
  script.src=root+'assets/js/reading-history-v2.js';
  script.async=false;
  script.onerror=function(){window.__amyAcademyReadingHistoryLoaderV2=false;};
  document.head.appendChild(script);
})();

/* Every nested lesson receives the same Amy Mentor stack as the Academy home page. */
(function(){
  if(window.__amyAcademyMentorLoaderV3)return;
  window.__amyAcademyMentorLoaderV3=true;
  const pathname=(location.pathname||'').replace(/\/+$/,'/');
  if(/\/apps\/academy\/(?:index\.html)?$/i.test(pathname))return;
  const academyRoot=new URL((typeof ROOT_PATH!=='undefined')?ROOT_PATH:'./',location.href);
  const sharedRoot=new URL('../shared/',academyRoot);
  function style(filename,marker){
    if(document.querySelector(`link[${marker}="v1"]`))return;
    const link=document.createElement('link');link.rel='stylesheet';link.href=new URL(filename,sharedRoot).href;link.setAttribute(marker,'v1');document.head.appendChild(link);
  }
  style('amyfx-blueprint-v1.css','data-amyfx-blueprint-css');
  style('amyfx-ui-tokens.css','data-amyfx-ui-tokens');
  style('amyfx-theme.css','data-amyfx-theme');
  style('amyfx-components.css','data-amyfx-components');
  function load(filename,marker,flag,next){
    if(window[flag]){next?.();return}
    const existing=document.querySelector(`script[${marker}="v1"]`);
    if(existing){const done=()=>next?.();existing.addEventListener('load',done,{once:true});existing.addEventListener('error',done,{once:true});setTimeout(()=>{if(window[flag])next?.()},0);return}
    const script=document.createElement('script');script.src=new URL(filename,sharedRoot).href;script.setAttribute(marker,'v1');script.async=false;
    script.addEventListener('load',()=>next?.(),{once:true});script.addEventListener('error',()=>next?.(),{once:true});document.head.appendChild(script);
  }
  load('amyfx-theme-controller.js','data-amyfx-theme-controller','__amyFxThemeController',()=>{
    load('amyfx-loading.js','data-amyfx-loading','__amyFxLoadingRuntime',()=>{
      load('amyfx-blueprint-v1.js','data-amyfx-blueprint-js','__amyFxBlueprintPreviewV1',()=>{
        load('amyfx-blueprint-hotfix-v1.js','data-amyfx-blueprint-hotfix','__amyFxBlueprintHotfixV1',()=>{
          load('amyfx-provider-detection-v1.js','data-amyfx-provider-detection','__amyFxProviderDetectionV1');
        });
      });
    });
  });
})();

/* AMYFX_NOTIFY_GUARD_START */
(function(){
  if(window.__amyfxNotifyGuardLoaded)return;
  window.__amyfxNotifyGuardLoaded=true;
  const STORE='amyfx.notify.last.sent';const COOLDOWN=5*60*1000;const RESUME_MUTE=9000;const MAX_ITEMS=80;let muteUntil=0;
  function now(){return Date.now()}
  function norm(x){return String(x||'').replace(/\d+([.,]\d+)?/g,'#').replace(/\s+/g,' ').trim().slice(0,180)}
  function kind(t,b){const x=(String(t||'')+' '+String(b||'')).toLowerCase();if(x.includes('scanner terhubung'))return'scanner_connected';if(x.includes('amy fx aktif'))return'scanner_alive';if(x.includes('liquidity sweep'))return'liquidity_sweep';if(x.includes('ssl')||x.includes('bsl'))return'bsl_ssl_touched';return'amyfx_alert'}
  function key(t,b){return kind(t,b)+'|'+norm(t)+'|'+norm(b)}
  function read(){try{return JSON.parse(localStorage.getItem(STORE)||'{}')}catch(e){return{}}}
  function write(o){const arr=Object.entries(o).sort((a,b)=>b[1]-a[1]).slice(0,MAX_ITEMS);localStorage.setItem(STORE,JSON.stringify(Object.fromEntries(arr)))}
  function route(t,b){const k=kind(t,b);if(k==='liquidity_sweep'||k==='bsl_ssl_touched')return'Analyze';if(k==='scanner_connected'||k==='scanner_alive')return'Dashboard';return'Analyze'}
  function openRoute(t,b){const r=route(t,b);try{localStorage.setItem('amyfx.notification.route',r)}catch(e){}try{if(typeof setTab==='function')setTab(r)}catch(e){}try{window.focus()}catch(e){}}
  function allow(t,b){const n=now();const k=key(t,b);if(n<muteUntil&&kind(t,b)!=='scanner_alive')return false;const last=read();const prev=last[k]||0;if(n-prev<COOLDOWN)return false;last[k]=n;write(last);return true}
  document.addEventListener('visibilitychange',function(){if(!document.hidden)muteUntil=now()+RESUME_MUTE});
  window.addEventListener('pageshow',function(){muteUntil=now()+RESUME_MUTE});
  try{
    if('Notification'in window&&!window.Notification.__amyfxWrapped){
      const OriginalNotification=window.Notification;
      const WrappedNotification=function(title,opts){opts=opts||{};const body=opts.body||'';if(!allow(title,body))return null;const n=new OriginalNotification(title,opts);n.onclick=function(){openRoute(title,body)};return n};
      Object.getOwnPropertyNames(OriginalNotification).forEach(function(k){try{WrappedNotification[k]=OriginalNotification[k]}catch(e){}});
      WrappedNotification.prototype=OriginalNotification.prototype;WrappedNotification.__amyfxWrapped=true;window.Notification=WrappedNotification;
    }
  }catch(e){}
  function wrapBridge(obj){if(!obj||obj.__amyfxNotifyBridgeWrapped)return;Object.keys(obj).forEach(function(k){if(!/notify|notification|alert|push/i.test(k)||typeof obj[k]!=='function')return;const old=obj[k];obj[k]=function(){const args=[].slice.call(arguments);const title=args[0]||'Amy FX';const body=args[1]||args[0]||'';if(!allow(title,body))return null;try{return old.apply(this,args)}catch(e){return null}}});obj.__amyfxNotifyBridgeWrapped=true}
  function wrapAll(){['Android','AndroidBridge','AmyFX','AmyFx','Native','NotificationBridge','AppBridge'].forEach(function(n){try{wrapBridge(window[n])}catch(e){}})}
  wrapAll();setInterval(wrapAll,1500);window.__amyfxNotifyAllow=allow;window.__amyfxNotifyOpenRoute=openRoute;
})();
/* AMYFX_NOTIFY_GUARD_END */

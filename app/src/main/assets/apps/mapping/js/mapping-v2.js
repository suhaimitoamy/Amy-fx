import{detectMarketRegimeV2 as t,regimeSummary as n}from"./engine/market-regime-engine.js";const e="amy-mapping-v2-decision",i="amy_mapping_v2_view_mode";let a="",s=0;function o(t){return String(t??"").replace(/[&<>"']/g,t=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[t]))}function r(t,n=0){const e=Number(t);return Number.isFinite(e)?e.toFixed(n):"-"}function d(t){return String(t||"-").replaceAll("_"," ")}function l(){return"DETAIL"===localStorage.getItem(i)?"DETAIL":"FOCUS"}function c(t){const n=t?.bestSetup;if(!n||"M15"!==String(n.tf||"").toUpperCase())return null;const e=String(n.lifecycle?.status||n.status||"").toUpperCase(),i=!1!==n.lifecycle?.live&&!1!==n.live,a=/(WAIT|INVALID|BROKEN|EXPIRED|SL HIT|TP2 HIT|TP1 \/ BE)/.test(e);return i&&!a?n:null}function u(t,n){const e=c(t);if(n?.executionGateEnabled&&n?.shift?.blockRecommended)return"WAIT";if(!e)return"WAIT";const i=String(e.dir||e.direction||"").toUpperCase();return i.includes("BUY")||i.includes("BULL")?"BUY":i.includes("SELL")||i.includes("BEAR")?"SELL":"WAIT"}function m(t,n,e){const i=c(t);return n?.executionGateEnabled&&n?.shift?.blockRecommended?"Market Shift terkonfirmasi. Setup baru ditahan sampai struktur kembali stabil.":i?"BUY"===e||"SELL"===e?`Setup produksi ${e} masih aktif; Market Regime V2 hanya menjadi konteks tambahan.`:n?.reasons?.[0]||"Belum ada alasan yang cukup aman untuk entry.":"Belum ada setup M15 aktif yang lolos seluruh filter."}function p(t,i){const a=n(i),s=u(t,i),p=l(),g=Number(i?.shift?.risk||0),v=i?.shift?.confirmed?"danger":g>=55?"warning":g>=25?"watch":"stable",f=function(t,n){const e=n?.features||{},i=c(t),a=Number(e.htfScore||0);return[["HTF",Math.abs(a)<.15?"MIXED":a>0?"BULLISH":"BEARISH"],["Struktur",t?.st?.confirmedTrend||t?.st?.trend||"NEUTRAL"],["Volatilitas",`${r(e.atrRatio,2)}× ATR`],["Setup M15",i?"AKTIF":"BELUM ADA"]]}(t,i).map(([t,n])=>`<div><small>${o(t)}</small><strong>${o(d(n))}</strong></div>`).join(""),b=[m(t,i,s),...(i?.shift?.reasons||[]).slice(0,2)].filter(Boolean).slice(0,3);return`<section class="card mapping-v2-decision-card" id="${e}">
    <div class="mapping-v2-head">
      <div><div class="kicker">MAPPING V2 · DECISION FIRST</div><h2>${o(a.headline)}</h2></div>
      <span class="mapping-v2-context-badge">EXPERIMENTAL · CONTEXT ONLY</span>
    </div>

    <div class="mapping-v2-primary ${s.toLowerCase()}">
      <small>TINDAKAN SEKARANG</small>
      <strong>${o(s)}</strong>
      <p>${o(m(t,i,s))}</p>
    </div>

    <div class="mapping-v2-overview">
      <div><small>Market Regime</small><strong>${o(d(i?.regime))}</strong><span>Kejelasan ${r(i?.confidence)}%</span></div>
      <div class="${v}"><small>Market Shift</small><strong>${o(d(i?.shift?.status))}</strong><span>Risiko ${r(g)}%</span></div>
      <div><small>Strategi Aktif</small><strong>${o(d(i?.strategy))}</strong><span>${i?.executionGateEnabled?"Filter aktif":"Belum memblokir entry"}</span></div>
    </div>

    <div class="mapping-v2-evidence">${f}</div>

    <div class="mapping-v2-why">
      <b>Mengapa?</b>
      <ul>${b.map(t=>`<li>${o(t)}</li>`).join("")}</ul>
    </div>

    <details class="mapping-v2-probabilities">
      <summary>Probabilitas regime dan bukti mesin</summary>
      <div>${function(t){return Object.entries(t?.probabilities||{}).sort((t,n)=>n[1]-t[1]).map(([t,n])=>`<div class="mapping-v2-probability">
      <span>${o(d(t))}</span><b>${r(n)}%</b><i style="--mapping-v2-value:${r(n)}%"></i>
    </div>`).join("")}(i)}</div>
    </details>

    <div class="mapping-v2-actions">
      <button type="button" data-mapping-v2-mode="FOCUS" class="${"FOCUS"===p?"active":""}">Ringkas</button>
      <button type="button" data-mapping-v2-mode="DETAIL" class="${"DETAIL"===p?"active":""}">Buka Detail Teknis</button>
    </div>
    ${"FOCUS"===p?'<p class="mapping-v2-hidden-note">Detail lama disembunyikan. Buka hanya saat ingin mengaudit struktur, OB, FVG, liquidity, dan outlook.</p>':""}
  </section>`}export function syncMappingV2(){const n=document.getElementById("app"),s=window.state||{},o=s.result||null;if(!n||!o||!["Dashboard","Analyze"].includes(s.tab))return document.getElementById(e)?.remove(),document.body.classList.remove("mapping-v2-focus-mode","mapping-v2-detail-mode"),void(a="");const r=function(){const n=window.state||{},e=n.result||null,i=e?.tf||n.tf||"M15",a=n.candles?.[i]||[];if(!e||a.length<30)return null;const s=window.AmyFXIntel?.read?.()||{},o=t({candles:a,tf:i,htfBiases:e.htfBiases||{},marketConcepts:e.marketConcepts||null,entryMap:e.entryMap||null,currentPrice:n.price||e.price,newsRisk:window.AmyFXIntel?.newsRisk?.(s)||"UNKNOWN",freshness:window.AmyMappingIntegrity?.qualityByInterval||{}});return e.mappingV2=o,o}();if(!r)return;const d=function(t,n){const e=window.state||{},i=t?.tf||e.tf,a=e.candles?.[i]||[];return JSON.stringify({tab:e.tab,tf:i,candle:a.at(-1)?.time||0,price:Number(e.price||0).toFixed(2),regime:n?.regime,probabilities:n?.probabilities,shift:n?.shift,strategy:n?.strategy,action:u(t,n),setup:t?.bestSetup?.id||t?.bestSetup?.timestamp||t?.bestSetup?.status||"",mode:l()})}(o,r);!function(){const t="Analyze"===window.state?.tab,n=t&&"FOCUS"===l();document.body.classList.toggle("mapping-v2-focus-mode",n),document.body.classList.toggle("mapping-v2-detail-mode",t&&!n)}();const c=document.getElementById(e);if(c&&d===a)return;const m=p(o,r);c?c.outerHTML=m:n.insertAdjacentHTML("afterbegin",m),a=d,function(){const t=document.getElementById(e);t&&"true"!==t.dataset.bound&&(t.dataset.bound="true",t.addEventListener("click",t=>{const n=t.target.closest("[data-mapping-v2-mode]");n&&(localStorage.setItem(i,n.dataset.mappingV2Mode),a="",syncMappingV2(),window.scrollTo({top:0,behavior:"smooth"}))}))}()}function g(t=0){clearTimeout(s),s=setTimeout(()=>requestAnimationFrame(syncMappingV2),t)}function v(){g(),document.addEventListener("click",()=>g(80),{passive:!0}),document.addEventListener("visibilitychange",()=>{document.hidden||g()}),window.addEventListener("storage",t=>{t.key===i&&g()}),setInterval(()=>{document.hidden||g()},5e3)}"loading"===document.readyState?document.addEventListener("DOMContentLoaded",v,{once:!0}):v();
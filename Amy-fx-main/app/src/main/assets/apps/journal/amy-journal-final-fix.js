(function(){
  function $(s,r=document){return r.querySelector(s)}
  function updateLibraryControls(){
    const countText = ($('#libraryCount')?.textContent || '').trim();
    const count = Number((countText.match(/\d+/)||['0'])[0]);
    const hasCards = !!document.querySelector('.library-card,.item-card,[data-item-id]');
    document.body.classList.toggle('has-library-items', count > 0 || hasCards);
    const q = ($('#searchInput')?.value || '').trim();
    const hasActive = q || document.querySelector('.pill-button.is-active:not(:first-child), .filter-chip.is-active:not(:first-child)');
    document.body.classList.toggle('has-active-filter', !!hasActive);
  }
  function ensureAiKeyPanel(){
    const view = document.getElementById('assistantView');
    if(!view || document.getElementById('amyAiKeyPanel')) return;
    const panel=document.createElement('section');
    panel.id='amyAiKeyPanel'; panel.className='amy-ai-key-panel';
    panel.innerHTML=`<h3>API Key AI</h3>
      <label>Provider</label><select id="amyAiProvider"><option value="openai">ChatGPT / OpenAI</option><option value="deepseek">DeepSeek</option><option value="gemini">Gemini</option></select>
      <label>API Key</label><input id="amyAiApiKey" type="password" placeholder="Masukkan API key sesuai provider">
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button id="amySaveAiKey" type="button">Simpan API Key</button><button id="amyClearAiKey" type="button">Hapus</button></div>
      <div class="amy-ai-status" id="amyAiStatus">Tersimpan lokal di HP.</div>`;
    const first = view.firstElementChild;
    view.insertBefore(panel, first ? first.nextSibling : null);
    const provider=$('#amyAiProvider'), key=$('#amyAiApiKey'), status=$('#amyAiStatus');
    const savedProvider=localStorage.getItem('amy_ai_provider')||'openai'; provider.value=savedProvider;
    key.value=localStorage.getItem('amy_ai_key_'+savedProvider)||'';
    provider.onchange=()=>{key.value=localStorage.getItem('amy_ai_key_'+provider.value)||''};
    $('#amySaveAiKey').onclick=()=>{localStorage.setItem('amy_ai_provider',provider.value);localStorage.setItem('amy_ai_key_'+provider.value,key.value.trim());status.textContent='API key '+provider.options[provider.selectedIndex].text+' tersimpan.'};
    $('#amyClearAiKey').onclick=()=>{localStorage.removeItem('amy_ai_key_'+provider.value);key.value='';status.textContent='API key dihapus.'};
  }
  function tick(){updateLibraryControls();ensureAiKeyPanel();}
  document.addEventListener('DOMContentLoaded',tick);
  document.addEventListener('click',()=>setTimeout(tick,60),true);
  document.addEventListener('input',()=>setTimeout(tick,60),true);
  setInterval(tick,1200);
})();

import test from 'node:test';
import assert from 'node:assert/strict';
import {compactChartNarration,mappingWarnings,renderAmy,DISPLAY_DEFAULTS} from '../app/src/main/assets/apps/mapping/js/ict-workspace/ict-presentation.js';

const amy=()=>({dashboard:{biasDir:1,invalidStatus:0,invalidLevel:3300,candle:{close:3310}},entry:{winDir:1,text:'Bias M15 Bullish\nTunggu zona discount\nPosisi Premium\nConfluence 55/100 poin'}});

test('compact chart prioritizes invalidation and opposing score over long narration',()=>{
  const a=amy();a.entry.m5Invalid=true;a.entry.winDir=-1;
  assert.equal(compactChartNarration(a).length,2);
  assert.match(compactChartNarration(a)[0],/Close M5 melewati invalidasi/);
  assert.match(compactChartNarration(a)[1],/SELL berlawanan bias M15/);
  assert.equal(a.entry.text.split('\n').length,4);
});
test('news lock and near invalid remain visible in compact copy',()=>{
  const a=amy();a.dashboard.invalidStatus=1;
  const warnings=mappingWarnings(a,{status:'NEWS_LOCK'});
  assert.match(warnings[0],/NEWS LOCK/);assert.match(warnings[1],/3300.00/);
  assert.deepEqual(mappingWarnings(null,{status:'NEWS_LOCK'}),[]);
  assert.equal(compactChartNarration(amy()).length,2);
});
test('offline clears top warnings and disabling chart narration retains full assistant details',()=>{
  const nodes=Object.fromEntries(['mapping-alert','amy-assistant'].map(id=>[id,{hidden:false,textContent:'',innerHTML:''}]));
  const previous=globalThis.document;
  globalThis.document={getElementById:id=>nodes[id]};
  try{
    const a=amy();a.dashboard.invalidStatus=2;
    renderAmy(a,{...DISPLAY_DEFAULTS,narration:false});
    assert.equal(nodes['mapping-alert'].hidden,false);
    assert.equal(nodes['amy-assistant'].hidden,false);
    assert.match(nodes['amy-assistant'].innerHTML,/Confluence 55\/100 poin/);
    renderAmy(null,DISPLAY_DEFAULTS);
    assert.equal(nodes['mapping-alert'].hidden,true);
    assert.equal(nodes['mapping-alert'].textContent,'');
    assert.doesNotMatch(nodes['amy-assistant'].innerHTML,/55\/100/);
  }finally{globalThis.document=previous;}
});

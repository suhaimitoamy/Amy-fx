import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

function mount(touchAxes){
  let config,fit=0,updates=0;const applied=[],priceOptions=[];
  const chart={applyOptions:o=>applied.push(o),priceScale:()=>({applyOptions:o=>priceOptions.push(o)}),
    addCandlestickSeries:()=>({setData:()=>updates++,setMarkers(){},removePriceLine(){}}),
    timeScale:()=>({fitContent:()=>fit++}),remove(){}};
  const context={window:{LightweightCharts:{createChart:(_,options)=>{config=options;return chart;}},addEventListener(){},removeEventListener(){}},
    document:{documentElement:{dataset:{}}},createIctCanvas:()=>({update(){},invalidate(){},destroy(){}})};
  const source=readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/chart-view.js','utf8').replace(/^import .*;\n/gm,'').replace('export function','function');
  vm.runInNewContext(source,context);
  const view=context.createPriceChart({},touchAxes===undefined?undefined:{touchAxes});
  return {view,applied,priceOptions,get config(){return config;},get fit(){return fit;},get updates(){return updates;}};
}

test('Mapping owns vertical price-axis touch while Home retains page scrolling',()=>{
  const mapping=mount(true),home=mount();
  assert.equal(mapping.config.handleScroll.vertTouchDrag,true);
  assert.equal(home.config.handleScroll.vertTouchDrag,false);
  assert.equal(mapping.config.handleScale.axisPressedMouseMove.price,true);
  assert.equal(mapping.config.handleScale.axisPressedMouseMove.time,true);
  assert.equal(mapping.config.handleScale.axisDoubleClickReset.price,true);
});

test('server refresh never reapplies the saved right offset over a manually adjusted viewport',()=>{
  const m=mount(true),result={tf:'M15',candles:[{time:1,open:100,high:102,low:99,close:101}],plan:null};
  const presentation={settings:{rightBars:40,signals:false,displacement:false},amy:{}};
  m.view.draw(result,null,presentation);m.view.draw(result,null,presentation);
  assert.equal(m.applied.filter(o=>o.timeScale?.rightOffset===40).length,1);
  assert.equal(m.updates,1);assert.equal(m.fit,1);
  m.view.draw(result,null,{...presentation,settings:{...presentation.settings,rightBars:50}});
  assert.equal(m.applied.filter(o=>o.timeScale?.rightOffset===50).length,1);
  m.view.autoPrice();assert.equal(m.priceOptions[0].autoScale,true);
  assert.equal(m.fit,1,'Auto harga must not reset horizontal zoom');
  m.view.destroy();
});

test('fullscreen mode explicitly applies full vertical price scale zoom capability and axis touch scaling',()=>{
  const m=mount(true);
  m.view.setFullscreen(true);
  const fsOptions=m.applied.at(-1);
  assert.equal(fsOptions.rightPriceScale.minimumWidth,90);
  assert.equal(fsOptions.handleScroll.vertTouchDrag,true);
  assert.equal(fsOptions.handleScroll.horzTouchDrag,true);
  assert.equal(fsOptions.handleScroll.pressedMouseMove,true);
  assert.equal(fsOptions.handleScroll.mouseWheel,true);
  assert.equal(fsOptions.handleScale.pinch,true);
  assert.equal(fsOptions.handleScale.mouseWheel,true);
  assert.equal(fsOptions.handleScale.axisPressedMouseMove.price,true);
  assert.equal(fsOptions.handleScale.axisPressedMouseMove.time,true);
  assert.equal(fsOptions.handleScale.axisDoubleClickReset.price,true);
  assert.equal(fsOptions.handleScale.axisDoubleClickReset.time,true);
  m.view.setFullscreen(false);
  const exitOptions=m.applied.at(-1);
  assert.equal(exitOptions.rightPriceScale.minimumWidth,65);
  assert.equal(exitOptions.handleScroll.vertTouchDrag,true);
  m.view.destroy();
});

test('Mapping app initializes chart with touchAxes enabled',()=>{
  const appSource=readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/app.js','utf8');
  assert.match(appSource,/createPriceChart\(\$\('chart'\),\s*\{touchAxes:\s*true\}\)/);
});

test('ICT overlay canvas has pointer-events none to not block price scale interaction',()=>{
  const css=readFileSync('app/src/main/assets/apps/mapping/css/ict-workspace.css','utf8');
  assert.match(css,/\.ict-overlay\s*\{[^}]*pointer-events:\s*none/);
  const canvasSource=readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/ict-canvas.js','utf8');
  assert.match(canvasSource,/canvas\.style\.pointerEvents\s*=\s*['"]none['"]/);
});

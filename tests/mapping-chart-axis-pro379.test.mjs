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

test('Item 2.35: Auto-Clamping Bounded Y-Axis Visualizer clamps outlier ranges and hides distant levels',()=>{
  let seriesOptions = null, createdLines = [];
  const chart = {
    applyOptions(){}, priceScale:()=>({applyOptions(){}}),
    addCandlestickSeries: options => {
      seriesOptions = options;
      return {
        setData(){}, setMarkers(){},
        createPriceLine: line => { createdLines.push(line); return line; },
        removePriceLine(){}
      };
    },
    timeScale:()=>({fitContent(){}}), remove(){}
  };
  const context = {
    window: { LightweightCharts: { createChart: () => chart }, addEventListener(){}, removeEventListener(){} },
    document: { documentElement: { dataset: {} } },
    createIctCanvas: () => ({ update(){}, invalidate(){}, destroy(){} })
  };
  const source = readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/chart-view.js','utf8')
    .replace(/^import .*;\n/gm,'').replace('export function','function');
  vm.runInNewContext(source, context);
  const view = context.createPriceChart({});

  // 1. Verify autoscaleInfoProvider clamps wide ranges
  assert.equal(typeof seriesOptions.autoscaleInfoProvider, 'function');
  const normalScale = seriesOptions.autoscaleInfoProvider(() => ({
    priceRange: { minValue: 2640, maxValue: 2660 }, margins: { above: 0.1, below: 0.1 }
  }));
  assert.equal(normalScale.priceRange.minValue, 2640);
  assert.equal(normalScale.priceRange.maxValue, 2660);

  // Anomaly spike range (span = 200 > 70)
  const clampedScale = seriesOptions.autoscaleInfoProvider(() => ({
    priceRange: { minValue: 2500, maxValue: 2700 }, margins: { above: 0.1, below: 0.1 }
  }));
  assert.equal(clampedScale.priceRange.maxValue - clampedScale.priceRange.minValue, 70);
  assert.equal(clampedScale.priceRange.minValue, 2565);
  assert.equal(clampedScale.priceRange.maxValue, 2635);

  // 2. Verify levels >$35 away from last price ($2650) are excluded
  const candles = [{ time: 100, open: 2648, high: 2652, low: 2647, close: 2650 }];
  view.draw({
    tf: 'M15',
    candles,
    plan: {
      entry: 2652, // within $35 -> included
      sl: 2645,    // within $35 -> included
      tp1: 2660,   // within $35 -> included
      tp: 2750     // >$35 away -> excluded by auto-clamping filter
    }
  });

  const titles = createdLines.map(l => l.title);
  assert.ok(titles.includes('ENTRY'));
  assert.ok(titles.includes('SL'));
  assert.ok(titles.includes('TP1'));
  assert.ok(!titles.includes('TARGET'), 'Target >$35 away must be clamped out');
});


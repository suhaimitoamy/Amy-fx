import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const scriptBase = new URL('../app/src/main/assets/apps/academy/trading-practice/assets/js/', import.meta.url);

function classList() {
  const values = new Set();
  return {
    add: (...items) => items.forEach(item => values.add(item)),
    remove: (...items) => items.forEach(item => values.delete(item)),
    toggle: (item, force) => force === undefined ? (values.has(item) ? !values.delete(item) : Boolean(values.add(item))) : (force ? Boolean(values.add(item)) : !values.delete(item)),
    contains: item => values.has(item)
  };
}

function node(name = 'div') {
  const listeners = new Map();
  const element = {
    nodeName: name.toUpperCase(), className: '', classList: classList(), style: {}, attributes: {}, children: [],
    clientWidth: 360, clientHeight: 520, firstChild: null, textContent: '',
    appendChild(child) { this.children.push(child); this.firstChild = this.children[0] || null; child.parentNode = this; return child; },
    removeChild(child) { this.children = this.children.filter(item => item !== child); this.firstChild = this.children[0] || null; child.parentNode = null; },
    remove() { if (this.parentNode) this.parentNode.removeChild(this); },
    setAttribute(key, value) { this.attributes[key] = String(value); if (key === 'class') this.className = String(value); },
    getAttribute(key) { return this.attributes[key] ?? null; },
    matches(selector) {
      return String(selector).split(',').some(part => {
        const value = part.trim();
        if (value.startsWith('.')) return `${this.className} ${this.attributes.class || ''}`.split(/\s+/).includes(value.slice(1));
        if (value.startsWith('[')) {
          const match = value.match(/^\[([^=\]]+)(?:=["']?([^"'\]]+)["']?)?\]$/);
          return Boolean(match && this.getAttribute(match[1]) != null && (match[2] == null || this.getAttribute(match[1]) === match[2]));
        }
        return this.nodeName.toLowerCase() === value.toLowerCase();
      });
    },
    closest(selector) { let current = this; while (current) { if (current.matches && current.matches(selector)) return current; current = current.parentNode; } return null; },
    addEventListener(type, callback) { const items = listeners.get(type) || []; items.push(callback); listeners.set(type, items); },
    removeEventListener(type, callback) { listeners.set(type, (listeners.get(type) || []).filter(item => item !== callback)); },
    dispatchEvent(event) { event.target ||= this; for (const callback of listeners.get(event.type) || []) callback.call(this, event); return true; },
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches && child.matches(selector) ? [child] : []), ...(child.querySelectorAll ? child.querySelectorAll(selector) : [])]); },
    querySelector(selector) {
      for (const child of this.children) {
        if (child.matches && child.matches(selector)) return child;
        const nested = child.querySelector && child.querySelector(selector);
        if (nested) return nested;
      }
      return null;
    },
    focus() { this.focused = true; },
    getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
  };
  return element;
}

function createRuntime() {
  const chartCalls = { create: null, apply: [], series: null, seriesApi: null, timeScale: null, data: [] };
  let visibleRange = { from: 0, to: 80 };
  chartCalls.rangeWrites = 0;
  chartCalls.dataWrites = 0;
  chartCalls.updates = 0;
  let horizontalScale = 1;
  let verticalScale = 1;
  const visibleTimeHandlers = new Set();
  const visibleLogicalHandlers = new Set();
  const sizeHandlers = new Set();
  const timeScale = {
    width: () => 276,
    height: () => 24,
    timeToCoordinate: time => time === 0 || time === 120 ? time * horizontalScale : null,
    coordinateToTime: coordinate => coordinate / horizontalScale,
    fitContent() {},
    getVisibleLogicalRange: () => ({ ...visibleRange }),
    setVisibleLogicalRange(range) { visibleRange = { ...range }; chartCalls.rangeWrites++; },
    subscribeVisibleTimeRangeChange(handler) { visibleTimeHandlers.add(handler); },
    unsubscribeVisibleTimeRangeChange(handler) { visibleTimeHandlers.delete(handler); },
    subscribeVisibleLogicalRangeChange(handler) { visibleLogicalHandlers.add(handler); },
    unsubscribeVisibleLogicalRangeChange(handler) { visibleLogicalHandlers.delete(handler); },
    subscribeSizeChange(handler) { sizeHandlers.add(handler); },
    unsubscribeSizeChange(handler) { sizeHandlers.delete(handler); },
    setHorizontalScale(value) {
      horizontalScale = value;
      for (const handler of visibleLogicalHandlers) handler({ from: 0, to: 120 / horizontalScale });
    },
    triggerSize() { for (const handler of sizeHandlers) handler(276, 496); }
  };
  const series = {
    setData(value) { chartCalls.data = value.slice(); chartCalls.dataWrites++; visibleRange = { from: 10, to: 90 }; },
    update(bar) { chartCalls.updates++; const last = chartCalls.data.at(-1); if (last?.time === bar.time) chartCalls.data[chartCalls.data.length - 1] = bar; else chartCalls.data.push(bar); },
    priceToCoordinate: price => (5000 - price) * verticalScale,
    coordinateToPrice: coordinate => 5000 - coordinate / verticalScale,
    setVerticalScale(value) { verticalScale = value; },
    createPriceLine: options => options, removePriceLine() {}
  };
  chartCalls.timeScale = timeScale;
  chartCalls.seriesApi = series;
  const lightweight = {
    CrosshairMode: { Normal: 0 }, LineStyle: { Dashed: 2 },
    createChart(host, options) {
      chartCalls.create = options;
      return {
        addCandlestickSeries(optionsForSeries) { chartCalls.series = optionsForSeries; return series; },
        subscribeCrosshairMove() {}, unsubscribeCrosshairMove() {}, subscribeClick() {}, unsubscribeClick() {},
        timeScale: () => timeScale,
        priceScale: () => ({ width: () => 84 }),
        applyOptions(optionsToApply) { chartCalls.apply.push(optionsToApply); },
        remove() {}
      };
    }
  };
  const localValues = new Map();
  const body = node('body');
  const document = {
    body,
    createElement: name => node(name), createElementNS: (_, name) => node(name),
    addEventListener() {}, removeEventListener() {}, querySelector: selector => body.querySelector(selector)
  };
  const runtime = {
    console, document, LightweightCharts: lightweight,
    localStorage: { getItem: key => localValues.get(key) ?? null, setItem: (key, value) => localValues.set(key, String(value)) },
    addEventListener() {}, removeEventListener() {}, requestAnimationFrame: callback => callback(), cancelAnimationFrame() {},
    setTimeout, clearTimeout
  };
  runtime.window = runtime;
  runtime.globalThis = runtime;
  vm.createContext(runtime);
  for (const name of ['drawing-core.js', 'chart-engine.js']) {
    vm.runInContext(readFileSync(new URL(name, scriptBase), 'utf8'), runtime, { filename: name });
  }
  return { runtime, chartCalls, container: node('section'), localValues };
}

test('pointer release outside plot clears gesture and delivers queued timeframe candles', () => {
  const {runtime,container,chartCalls}=createRuntime();
  const chart=new runtime.AmyCandleChart.CandleChart(container,{});
  const old=[{time:0,open:100,high:102,low:99,close:101}];
  const next=[{time:60,open:101,high:103,low:100,close:102}];
  chart.setCandles(old);
  chart.setTool('trend');
  chart.pointFromEvent=()=>({x:10,y:10,time:0,price:100});
  chart.handlePointerDown({pointerId:1,preventDefault(){},stopPropagation(){}});
  chart.setCandles(next,true);
  assert.equal(chartCalls.data[0].time,0);
  chart.pointFromEvent=()=>null;
  chart.handlePointerUp({pointerId:1,preventDefault(){}});
  assert.equal(chart.gestureStart,null);
  assert.equal(chart.pendingCandles,null);
  assert.equal(chartCalls.data[0].time,60);
});

test('first tap of a multi-point drawing flushes candles without losing its anchor', () => {
  const {runtime,container,chartCalls}=createRuntime();
  const chart=new runtime.AmyCandleChart.CandleChart(container,{});
  chart.setCandles([{time:0,open:100,high:102,low:99,close:101}]);
  chart.setTool('trend');chart.findDrawingAt=()=>null;
  chart.pointFromEvent=()=>({x:10,y:10,time:0,price:100});
  const event={pointerId:1,preventDefault(){},stopPropagation(){}};
  chart.handlePointerDown(event);
  chart.setCandles([{time:60,open:101,high:103,low:100,close:102}],true);
  chart.handlePointerUp(event);
  assert.ok(chart.tapAnchor);
  assert.equal(chart.gestureStart,null);
  assert.equal(chartCalls.data[0].time,60);
});

test('direct chart delete preserves other drawings, persistence and undo without menus', () => {
  const { runtime, container, localValues } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container, { storageKey: 'direct-delete' });
  const button = chart.deleteButton;
  assert.equal(button.hidden, true);
  assert.equal(button.parentNode, container, 'inside chart in normal and fullscreen layouts');
  assert.equal(button.type, 'button');
  assert.equal(button.getAttribute('aria-label'), 'Hapus gambar terpilih');
  chart.setCandles([0,120].map(time => ({time,open:4900,high:4910,low:4880,close:4900})));
  const kept = chart.addDrawing('horizontal', [{time:0,price:4900}]);
  const removed = chart.addDrawing('rectangle', [{time:0,price:4910},{time:120,price:4880}]);
  const before = JSON.stringify(chart.drawings);
  let stopped = 0;
  button.dispatchEvent({type:'pointerdown',stopPropagation(){stopped++;}});
  assert.equal(stopped, 1);
  assert.equal(chart.dragState, null);
  assert.equal(button.hidden, false);
  button.dispatchEvent({type:'click',stopPropagation(){}});
  assert.deepEqual(Array.from(chart.drawings, d=>d.id), [kept.id]);
  assert.equal(JSON.parse(localValues.get('direct-delete')).length, 1);
  assert.equal(button.hidden, true);
  assert.equal(container.focused, true);
  assert.equal(chart.undo(), true);
  assert.equal(JSON.stringify(chart.drawings), before);
  chart.selectDrawing(removed.id);
  chart.handlePointerDown({clientX:0,clientY:90,pointerId:1,target:chart.overlay.querySelector('[data-drawing-id="'+removed.id+'"]'),preventDefault(){},stopPropagation(){}});
  assert.equal(button.hidden, true, 'no accidental delete during resize/drag');
  button.dispatchEvent({type:'click',stopPropagation(){}});
  assert.equal(chart.drawings.length, 2);
  chart.handlePointerCancel({pointerId:1});
  assert.equal(button.hidden, false);
  chart.handleClick({point:{x:250,y:250}});
  assert.equal(button.hidden, true, 'blank-chart tap clears action');
  chart.selectDrawing(removed.id);
  chart.setDrawingTimeBoundary(0);
  assert.equal(button.hidden, true, 'future drawing cannot be deleted by hidden action');
  chart.setDrawingTimeBoundary(null);
  chart.selectDrawing(kept.id);
  chart.setTool(null);
  assert.equal(button.hidden, true, 'gesture mode stays unobstructed');
  chart.destroy();
  assert.equal(button.parentNode, null);
});

test('positions reject inverted creation/drag, keep legacy data and space labels',()=>{
 const {runtime,container}=createRuntime();
 const model=runtime.AmyPracticeDrawing;
 const chart=new runtime.AmyCandleChart.CandleChart(container,{});
 chart.setCandles([{time:0,open:4900,high:4920,low:4880,close:4900},{time:120,open:4900,high:4920,low:4880,close:4900}]);
 for(const [type,sign] of [['longPosition',1],['shortPosition',-1]]){
  const points=[{time:0,price:4900},{time:120,price:4900+sign*10},{time:120,price:4900-sign*5}];
  const valid=chart.addDrawing(type,points);assert.ok(valid);assert.equal(model.positionStats(valid).rr,2);
  const bad=model.create(type,[points[0],points[2],points[1]]);
  assert.equal(model.positionStats(bad).valid,false);assert.equal(model.positionStats(bad).rr,null);
  assert.equal(chart.addDrawing(type,bad.points),null);
  const before=JSON.stringify(bad);const group=chart.renderDrawing(bad);
  assert.ok(group.querySelectorAll('text').some(n=>n.textContent.includes('TIDAK VALID')));assert.equal(JSON.stringify(bad),before);
  chart.setTool('select');chart.dragState={id:valid.id,mode:'point',timeIndex:-1,priceIndex:1,startPoint:{x:0,y:0},original:model.clone(valid),remembered:false};
  chart.pointFromEvent=()=>({x:20,y:20,time:120,price:4900-sign*10});
  chart.handlePointerMove({preventDefault(){}});
  assert.equal(model.positionStats(chart.drawings.find(d=>d.id===valid.id)).rr,2);
  chart.handlePointerCancel();
 }
 const tiny=model.create('longPosition',[{time:0,price:4900},{time:120,price:4900.1},{time:120,price:4899.9}]);
 const labels=chart.renderDrawing(tiny).querySelectorAll('text').map(n=>Number(n.getAttribute('y'))).sort((a,b)=>a-b);
 assert.equal(labels.length,3);assert.ok(labels[1]-labels[0]>=24&&labels[2]-labels[1]>=24);
});

test('four-digit XAUUSD prices and the current-price label have a dedicated unclipped axis', () => {
  const { runtime, chartCalls, container } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container, { storageKey: 'price-axis-test' });

  assert.equal(chartCalls.create.localization.priceFormatter(4101.27), '4101.27');
  assert.equal(chartCalls.create.rightPriceScale.entireTextOnly, true);
  assert.ok(chartCalls.create.rightPriceScale.minimumWidth >= 84);
  assert.equal(chartCalls.series.lastValueVisible, true);
  assert.equal(chartCalls.series.priceLineVisible, true);
  assert.equal(chartCalls.series.priceFormat.precision, 2);
  assert.equal(chartCalls.apply.at(-1).rightPriceScale.minimumWidth, 84, 'mobile width keeps an explicit price-axis minimum');
  assert.equal(chart.overlay.style.width, '276px', 'drawing overlay stops at plot edge instead of covering the price axis');
});

test('TIME + PRICE drawing interpolation and persistence survive chart recreation', () => {
  const { runtime, container, localValues } = createRuntime();
  const first = new runtime.AmyCandleChart.CandleChart(container, { storageKey: 'drawing-persistence-test' });
  first.setCandles([
    { time: 0, open: 4099, high: 4102, low: 4098, close: 4101 },
    { time: 120, open: 4101, high: 4110, low: 4100, close: 4108 }
  ]);
  assert.equal(first.timeToX(60), 60, 'time between candles is interpolated after a timeframe change');
  const saved = first.addDrawing('trend', [{ time: 60, price: 4101.25 }, { time: 120, price: 4108.5 }]);
  assert.ok(saved);
  assert.ok(localValues.has('drawing-persistence-test'));
  assert.equal(first.activeTool, 'select', 'a finished drawing immediately enters edit mode');
  assert.equal(first.selectedId, saved.id, 'a finished drawing is immediately selected');
  assert.equal(first.overlay.classList.contains('is-selecting'), true);
  assert.equal(first.deleteSelected(), true);
  assert.equal(first.drawings.length, 0);
  assert.equal(first.undo(), true);
  assert.equal(first.drawings.length, 1);
  first.clearDrawings();
  assert.equal(first.drawings.length, 0);
  assert.equal(first.undo(), true, 'clear-all remains recoverable with Undo');
  assert.equal(first.drawings.length, 1);
  first.setDrawingTimeBoundary(60);
  assert.equal(first.isDrawingVisible(saved), false, 'a replay rewind must hide drawing anchors from a future cursor');
  const clamped = first.pointFromEvent({ clientX: 100, clientY: 100 });
  assert.equal(clamped.time, 60, 'new drawing anchors cannot move past the replay cursor');

  const nextContainer = node('section');
  const second = new runtime.AmyCandleChart.CandleChart(nextContainer, { storageKey: 'drawing-persistence-test' });
  assert.equal(second.drawings.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(second.drawings[0].points)), [
    { time: 60, price: 4101.25 }, { time: 120, price: 4108.5 }
  ]);
  assert.equal(second.activeTool, 'select', 'restored drawings remain selectable in Pro329+');
  assert.equal(second.overlay.classList.contains('is-drawing'), false, 'select mode keeps blank-chart gestures available');
});

test('painted drawings can be selected and dragged using mobile-sized hit targets', () => {
  const { runtime, container } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container, { storageKey: 'drawing-touch-test' });
  chart.setCandles([
    { time: 0, open: 4898, high: 4904, low: 4895, close: 4900 },
    { time: 120, open: 4900, high: 4902, low: 4875, close: 4880 }
  ]);
  const trend = chart.addDrawing('trend', [{ time: 0, price: 4900 }, { time: 120, price: 4880 }]);
  chart.addDrawing('rectangle', [{ time: 30, price: 4920 }, { time: 90, price: 4860 }]);

  const drawingGroup = chart.overlay.children.find(item => item.getAttribute && item.getAttribute('data-drawing-id') === trend.id);
  assert.ok(drawingGroup, 'trend SVG group is rendered');
  const paintedLine = drawingGroup.children.find(item => item.nodeName === 'LINE' && item.getAttribute('stroke') !== 'transparent');
  const touchLine = drawingGroup.children.find(item => item.getAttribute('class') === 'practice-drawing-hit');
  assert.ok(paintedLine, 'visible trend line is rendered');
  assert.equal(touchLine.getAttribute('stroke-width'), '28', 'thin lines expose a forgiving invisible touch target');

  chart.handlePointerDown({
    clientX: 20, clientY: 100, pointerId: 1, target: paintedLine,
    preventDefault() {}, stopPropagation() {}
  });
  assert.equal(chart.selectedId, trend.id, 'the painted SVG target selects its owning drawing');
  const handleHits = chart.overlay.children.filter(item => item.getAttribute && item.getAttribute('class') === 'practice-drawing-handle-hit');
  assert.equal(handleHits.length, 2);
  assert.ok(handleHits.every(item => item.getAttribute('r') === '18'), 'edit handles have a 36px touch area');

  chart.handlePointerMove({ clientX: 30, clientY: 110, preventDefault() {} });
  chart.handlePointerUp({ clientX: 30, clientY: 110, preventDefault() {} });
  const moved = chart.drawings.find(item => item.id === trend.id);
  assert.deepEqual(JSON.parse(JSON.stringify(moved.points)), [
    { time: 10, price: 4890 }, { time: 130, price: 4870 }
  ]);
});

test('horizontal zoom stays enabled and TIME + PRICE drawings follow chart scale transforms', () => {
  const { runtime, chartCalls, container } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container, { storageKey: 'drawing-scale-sync-test' });
  chart.setCandles([
    { time: 0, open: 4898, high: 4904, low: 4895, close: 4900 },
    { time: 120, open: 4900, high: 4902, low: 4875, close: 4880 }
  ]);
  const arrow = chart.addDrawing('arrow', [{ time: 0, price: 4900 }, { time: 120, price: 4880 }]);
  const coordinates = () => {
    const group = chart.overlay.children.find(item => item.getAttribute && item.getAttribute('data-drawing-id') === arrow.id);
    const line = group.children.find(item => item.nodeName === 'LINE' && item.getAttribute('stroke') !== 'transparent');
    return ['x1', 'y1', 'x2', 'y2'].map(name => Number(line.getAttribute(name)));
  };

  assert.deepEqual(JSON.parse(JSON.stringify(chartCalls.create.handleScale)), {
    axisPressedMouseMove: { time: true, price: true },
    axisDoubleClickReset: { time: true, price: true },
    mouseWheel: true,
    pinch: true
  });
  assert.deepEqual(JSON.parse(JSON.stringify(chartCalls.create.handleScroll)), {
    mouseWheel: true,
    pressedMouseMove: true,
    horzTouchDrag: true,
    vertTouchDrag: true
  });
  assert.deepEqual(coordinates(), [0, 100, 120, 120]);

  chartCalls.timeScale.setHorizontalScale(0.5);
  assert.deepEqual(coordinates(), [0, 100, 60, 120], 'logical-range zoom redraws the arrow at the new candle spacing');

  chartCalls.seriesApi.setVerticalScale(2);
  chart.host.dispatchEvent({ type: 'wheel' });
  assert.deepEqual(coordinates(), [0, 200, 60, 240], 'price-scale gestures redraw the arrow against the new price coordinates');
  assert.deepEqual(JSON.parse(JSON.stringify(arrow.points)), [
    { time: 0, price: 4900 }, { time: 120, price: 4880 }
  ], 'zoom changes screen coordinates without mutating TIME + PRICE anchors');

  chart.handleClick({ point: { x: 220, y: 200 }, time: 60 });
  assert.equal(chart.selectedId, null, 'a blank-chart tap releases selection so native pan and pinch remain available');
});

test('text editor stays outside the clipped chart and saved text is visible and editable', () => {
  const { runtime, container } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container, { storageKey: 'drawing-text-test' });
  chart.setCandles([
    { time: 0, open: 4898, high: 4904, low: 4895, close: 4900 },
    { time: 120, open: 4900, high: 4908, low: 4898, close: 4905 }
  ]);

  chart.setTool('text');
  chart.openTextEditor('text', { time: 60, price: 4900 });
  const editor = chart.textEditor;
  assert.ok(editor, 'text dialog opens');
  assert.equal(editor.parentNode, runtime.document.body, 'text dialog is not clipped by the chart shell');
  assert.equal(editor.getAttribute('role'), 'dialog');
  const input = editor.querySelector('textarea');
  assert.equal(input.focused, true);
  input.value = 'Area beli utama';
  editor.dispatchEvent({ type: 'submit', preventDefault() {} });

  const drawing = chart.drawings.at(-1);
  assert.equal(drawing.type, 'text');
  assert.equal(drawing.text, 'Area beli utama');
  assert.equal(chart.textEditor, null);
  assert.equal(chart.activeTool, 'select');
  assert.equal(chart.selectedId, drawing.id);
  const group = chart.overlay.children.find(item => item.getAttribute && item.getAttribute('data-drawing-id') === drawing.id);
  assert.equal(group.querySelector('text').textContent, 'Area beli utama');
});

test('every supported drawing type renders and can be selected through its painted SVG', () => {
  const { runtime, container } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container, { storageKey: 'drawing-all-tools-test' });
  chart.setCandles([
    { time: 0, open: 4898, high: 4910, low: 4888, close: 4900 },
    { time: 120, open: 4900, high: 4920, low: 4870, close: 4890 }
  ]);
  const one = [{ time: 30, price: 4900 }];
  const two = [{ time: 20, price: 4910 }, { time: 100, price: 4880 }];
  const three = [{ time: 20, price: 4900 }, { time: 100, price: 4920 }, { time: 80, price: 4875 }];
  const inputs = {
    horizontal: one, horizontalRay: one, entry: one, stop: one, target: one,
    text: one, note: one, priceNote: one,
    trend: two, fibonacci: two, priceRange: two, rectangle: two, arrow: two, circle: two,
    parallelChannel: three, longPosition: three, shortPosition: [three[0],three[2],three[1]],
    path: [{ time: 10, price: 4910 }, { time: 60, price: 4885 }, { time: 110, price: 4905 }]
  };
  const created = Object.entries(inputs).map(([type, points]) => chart.addDrawing(type, points, type === 'text' ? 'Teks terlihat' : ''));
  assert.ok(created.every(Boolean));

  for (const drawing of created) {
    const group = chart.overlay.children.find(item => item.getAttribute && item.getAttribute('data-drawing-id') === drawing.id);
    assert.ok(group && group.children.length, `${drawing.type} must render visible SVG content`);
    const painted = group.children.find(item => item.getAttribute('class') !== 'practice-drawing-hit') || group;
    chart.handlePointerDown({
      clientX: 40, clientY: 100, pointerId: 7, target: painted,
      preventDefault() {}, stopPropagation() {}
    });
    assert.equal(chart.selectedId, drawing.id, `${drawing.type} must be selectable from its SVG target`);
    chart.handlePointerUp({ clientX: 40, clientY: 100, preventDefault() {} });
  }

  const css = readFileSync(new URL('../app/src/main/assets/apps/academy/trading-practice/assets/css/practice.css', import.meta.url), 'utf8');
  assert.match(css, /\.practice-drawing-editor \{ position:fixed;/, 'text entry must not be clipped by the chart shell');
  assert.match(css, /\.practice-drawing-handle, \.practice-drawing-handle-hit \{ cursor:\s*move; pointer-events:\s*all;/);
  assert.match(css, /\.practice-chart-overlay\.is-selecting \{ pointer-events:\s*none;/, 'blank selected-chart space must pass pinch and pan gestures through');
  assert.match(css, /\.practice-chart-overlay\.is-selecting \.practice-drawing \{[^}]*pointer-events:\s*visiblePainted;/, 'only painted drawings intercept edit gestures');
});

test('analysis and replay expose every required drawing tool and load the domain model first', () => {
  const required = [
    'select', 'trend', 'horizontal', 'horizontalRay', 'parallelChannel', 'fibonacci', 'longPosition',
    'shortPosition', 'priceRange', 'rectangle', 'arrow', 'path', 'circle', 'text', 'note', 'priceNote'
  ];
  for (const page of ['chart-analysis.html', 'candle-replay.html']) {
    const source = readFileSync(new URL(`../app/src/main/assets/apps/academy/trading-practice/${page}`, import.meta.url), 'utf8');
    for (const type of required) assert.match(source, new RegExp(`data-drawing-tool=["']${type}["']`), `${page} is missing ${type}`);
    assert.ok(source.indexOf('drawing-core.js') < source.indexOf('chart-engine.js'));
    assert.match(source, /id="deleteDrawing"/);
    assert.match(source, /id="clearDrawings"/);
  }
});

test('live mode keeps the active pack as an immutable base and does not refit the viewport', () => {
  const source = readFileSync(new URL('../app/src/main/assets/apps/academy/trading-practice/assets/js/chart-analysis.js', import.meta.url), 'utf8');
  assert.match(source, /provider\.getCandles\(\{ symbol: 'XAUUSD', timeframe: timeframe\(\), sourceId: sourceId\(\) \}\)/);
  assert.match(source, /mergeCandleSeries\(historicalCandles, nativeContext\)/);
  assert.match(source, /immutableThrough: historicalEnd/);
  assert.match(source, /seedLiveContext\(false\)/);
  assert.match(source, /item\.sourceId === payload\.sourceId|sourceId\(\)/);
});



test('replay append does not reset an active pan and rewind preserves exact logical range', () => {
  const { runtime, chartCalls, container } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container, { followReplay: true });
  const bars = [0, 60, 120].map(time => ({ time, open: 4900, high: 4902, low: 4898, close: 4901 }));
  chart.setCandles(bars.slice(0, 2));
  chart.host.dispatchEvent({ type: 'pointerdown' });
  assert.equal(chart.followReplay, false);
  chartCalls.timeScale.setVisibleLogicalRange({ from: -32.5, to: 18.25 });
  const writes = chartCalls.rangeWrites;
  chart.setCandles(bars, false);
  assert.equal(chartCalls.dataWrites, 1, 'append uses series.update instead of full replacement');
  assert.equal(chartCalls.rangeWrites, writes, 'append must not reset native in-progress pan');
  assert.deepEqual(chartCalls.timeScale.getVisibleLogicalRange(), { from: -32.5, to: 18.25 });
  chart.setCandles(bars.slice(0, 1), false);
  assert.deepEqual(chartCalls.timeScale.getVisibleLogicalRange(), { from: -32.5, to: 18.25 }, 'rewind restores the same fractional zoom/pan range');
  chart.goToCursor();
  assert.equal(chart.followReplay, true);
  const centered = chartCalls.timeScale.getVisibleLogicalRange();
  assert.equal(centered.to, 4);
  assert.equal(centered.to - centered.from, 50.75, 'return to cursor preserves zoom');
});

test('gesture mode ignores painted objects and unrelated pointers cannot move a drawing', () => {
  const { runtime, container } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container);
  const bar = { time: 0, open: 4900, high: 4902, low: 4898, close: 4901 };
  chart.setCandles([bar, { ...bar, time: 120 }]);
  const item = chart.addDrawing('trend', [{ time: 0, price: 4900 }, { time: 120, price: 4880 }]);
  chart.setTool(null);
  const group = chart.overlay.children.find(n => n.getAttribute('data-drawing-id') === item.id);
  chart.handlePointerDown({ pointerId: 1, target: group, preventDefault() { throw new Error('pan must pass through'); } });
  assert.equal(chart.dragState, null);
  chart.setTool('select');
  chart.handlePointerDown({ clientX: 20, clientY: 100, pointerId: 1, target: group, preventDefault() {}, stopPropagation() {} });
  chart.handlePointerMove({ clientX: 70, clientY: 160, pointerId: 2, preventDefault() {} });
  assert.equal(chart.dragState.remembered, false);
  chart.handlePointerUp({ clientX: 70, clientY: 160, pointerId: 2, preventDefault() {} });
  assert.ok(chart.dragState, 'second finger cannot finish the first drag');
  chart.handlePointerCancel({ pointerId: 1 });
  assert.equal(chart.dragState, null);
});

test('replay data waits for drawing release and redo restores the completed edit', () => {
  const { runtime, chartCalls, container } = createRuntime();
  const chart = new runtime.AmyCandleChart.CandleChart(container);
  const bars = [0, 120, 240].map(time => ({ time, open: 4900, high: 4902, low: 4898, close: 4901 }));
  chart.setCandles(bars.slice(0, 2));
  const drawing = chart.addDrawing('trend', [{ time: 0, price: 4900 }, { time: 120, price: 4880 }]);
  const group = chart.overlay.children.find(n => n.getAttribute('data-drawing-id') === drawing.id);
  chart.handlePointerDown({ clientX: 20, clientY: 100, pointerId: 1, target: group, preventDefault() {}, stopPropagation() {} });
  chart.setCandles(bars, false);
  assert.equal(chart.candles.length, 2, 'scale stays fixed during object gesture');
  chart.handlePointerMove({ clientX: 30, clientY: 110, pointerId: 1, preventDefault() {} });
  chart.handlePointerUp({ clientX: 30, clientY: 110, pointerId: 1, preventDefault() {} });
  assert.equal(chart.candles.length, 3);
  const edited = JSON.stringify(chart.drawings);
  assert.equal(chart.undo(), true);
  assert.notEqual(JSON.stringify(chart.drawings), edited);
  assert.equal(chart.redo(), true);
  assert.equal(JSON.stringify(chart.drawings), edited);
});

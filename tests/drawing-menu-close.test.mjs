import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
test('close button, tool selection and Gesture Chart close the existing menu safely',()=>{
  function node(){return {dataset:{},children:[],listeners:{},classList:{toggle(){}},setAttribute(){},addEventListener(n,f){this.listeners[n]=f;},appendChild(n){this.children.push(n);},insertBefore(n){this.children.unshift(n);}};}
  const grid=node(),summary={focus(){this.focused=true;}},menu=node(),finish=node(),tool=node();
  tool.dataset.drawingTool='trend';menu.open=true;
  menu.querySelector=s=>s==='summary'?summary:s==='.drawing-menu-grid'?grid:null;
  menu.removeAttribute=()=>{menu.open=false;};
  const chart={drawings:[{id:'saved'}],setTool(t){this.activeTool=t;}};
  const context={document:{getElementById:id=>id==='finishDrawing'?finish:null,querySelector:()=>menu,querySelectorAll:()=>[tool],createElement:node},AmyPracticeCore:{}};
  context.window=context;
  vm.runInNewContext(readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/js/practice-ui.js','utf8'),context);
  context.AmyPracticeUI.bindDrawingToolbar(chart);
  const close=grid.children[0];assert.equal(close.textContent,'× Tutup');
  close.listeners.click();assert.equal(menu.open,false);assert.equal(summary.focused,true);
  menu.open=true;tool.listeners.click();assert.equal(chart.activeTool,'trend');assert.equal(menu.open,false);
  menu.open=true;finish.listeners.click();assert.equal(chart.activeTool,null);assert.equal(menu.open,false);
  assert.equal(chart.drawings[0].id,'saved');
});

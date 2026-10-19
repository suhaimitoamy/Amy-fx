import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync('app/src/main/assets/apps/academy/trading-practice/assets/js/drawing-core.js', 'utf8');
const context = {};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(code, context);

const { normalizeStyle } = context.AmyPracticeDrawing;

test('DrawingCore: normalizeStyle supports 3, 6, 8-digit hex and CSS rgba/hsla colors (Item 1.40)', () => {
  // 6-digit hex
  assert.equal(normalizeStyle({ color: '#22c55e' }).color, '#22c55e');
  assert.equal(normalizeStyle({ color: '#F5C451' }).color, '#F5C451');

  // 3-digit hex
  assert.equal(normalizeStyle({ color: '#fff' }).color, '#fff');
  assert.equal(normalizeStyle({ color: '#000' }).color, '#000');
  assert.equal(normalizeStyle({ color: '#f5c' }).color, '#f5c');

  // 8-digit hex with alpha
  assert.equal(normalizeStyle({ color: '#f5c45180' }).color, '#f5c45180');
  assert.equal(normalizeStyle({ color: '#22C55EAA' }).color, '#22C55EAA');

  // rgba / rgb
  assert.equal(normalizeStyle({ color: 'rgba(245, 196, 81, 0.5)' }).color, 'rgba(245, 196, 81, 0.5)');
  assert.equal(normalizeStyle({ color: 'rgb(34, 197, 94)' }).color, 'rgb(34, 197, 94)');

  // hsla / hsl
  assert.equal(normalizeStyle({ color: 'hsla(210, 50%, 60%, 0.8)' }).color, 'hsla(210, 50%, 60%, 0.8)');

  // Invalid colors should become null
  assert.equal(normalizeStyle({ color: 'not-a-color' }).color, null);
  assert.equal(normalizeStyle({ color: 'javascript:alert(1)' }).color, null);
  assert.equal(normalizeStyle({ color: '#12345' }).color, null);
  assert.equal(normalizeStyle({ color: '' }).color, null);
  assert.equal(normalizeStyle({}).color, null);
});

test('DrawingCore: normalizeStyle properly bounds width (1-8) and opacity (0.1-1.0)', () => {
  const minClamped = normalizeStyle({ width: 0, opacity: 0.01 });
  assert.equal(minClamped.width, 1);
  assert.equal(minClamped.opacity, 0.1);

  const maxClamped = normalizeStyle({ width: 20, opacity: 5.0 });
  assert.equal(maxClamped.width, 8);
  assert.equal(maxClamped.opacity, 1.0);

  const defaultValues = normalizeStyle({});
  assert.equal(defaultValues.width, 2);
  assert.equal(defaultValues.opacity, 1);
});

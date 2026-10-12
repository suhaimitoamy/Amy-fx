import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('home light theme pairs dark legacy text with light surfaces', () => {
  const css = readFileSync(new URL('../app/src/main/assets/styles.css', import.meta.url), 'utf8');
  const rule = selector => {
    const blocks = [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)];
    return blocks.filter(m => m[1].trim().split(/,\s*\n/).includes(selector)).at(-1)?.[2] || '';
  };
  const light = 'html[data-amyfx-theme="light"]';
  assert.match(rule(light), /--text-main:\s*#16233a;/);
  assert.match(rule(light), /--text-muted:\s*#556680;/);
  assert.match(rule(light + ' .home-hero'), /background:\s*var\(--amy-surface\);/);
  assert.match(rule(light + ' .stat-card'), /border-color:\s*var\(--amy-border\);/);
  assert.match(rule(light + ' .skeleton'), /background:\s*#dbe3ef;/);
  assert.match(rule(light + ' pre'), /background:\s*#e7eef6;\s*color:\s*#172637;/);
  const luminance = hex => hex.match(/\w\w/g).map(v => parseInt(v,16)/255)
    .map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4)
    .reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
  for (const foreground of ['16233a','556680']) {
    const contrast = (luminance('e5eafa')+.05)/(luminance(foreground)+.05);
    assert.ok(contrast >= 4.5, `light home text contrast ${contrast.toFixed(2)}:1`);
  }
});

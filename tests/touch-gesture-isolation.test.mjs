import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('touch gesture isolation for narrow mobile screens in styles.css and ict-workspace.css (Item 1.5)', () => {
  const styles = readFileSync('app/src/main/assets/styles.css', 'utf8');
  const ictStyles = readFileSync('app/src/main/assets/apps/mapping/css/ict-workspace.css', 'utf8');

  // Verify styles.css
  assert.match(styles, /\.home-price-panel\s*\{[\s\S]*?touch-action:\s*pan-y/);
  assert.match(styles, /#home-price-chart\s*\{[\s\S]*?touch-action:\s*pan-y/);
  assert.match(styles, /#home-price-chart tr:first-child td:last-child canvas\{touch-action:none!important\}/);

  // Verify ict-workspace.css
  assert.match(ictStyles, /article\.gold-price-panel\{[\s\S]*?touch-action:pan-y!important/);
  assert.match(ictStyles, /#gold-chart-workspace #chart\{[\s\S]*?touch-action:pan-y/);
  assert.match(ictStyles, /#gold-chart-workspace #chart tr:first-child td:last-child canvas\{touch-action:none!important\}/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const appPath = new URL('../app/src/main/assets/apps/market-intel/app.js', import.meta.url);
const appSource = fs.readFileSync(appPath, 'utf8');

const stylesPath = new URL('../app/src/main/assets/apps/market-intel/styles.css', import.meta.url);
const stylesSource = fs.readFileSync(stylesPath, 'utf8');

test('fundamental briefing contains macro event analyzer and 5 institutional sections', () => {
  assert.match(appSource, /function parseCalendarNumber/);
  assert.match(appSource, /function analyzeMacroEvent/);
  assert.match(appSource, /Faktor Utama: USD &amp; The Fed/);
  assert.match(appSource, /Faktor Safe Haven \(Penahan Penurunan\)/);
  assert.match(appSource, /Sentimen Pasar Hari Ini/);
  assert.match(appSource, /News yang Perlu Diperhatikan/);
  assert.match(appSource, /Kesimpulan Fundamental/);
});

test('macro analyzer correctly evaluates Unemployment Claims and inflation metrics', () => {
  // Extract analyzeMacroEvent and parseCalendarNumber to test logic
  const parseMatch = appSource.match(/function parseCalendarNumber[\s\S]*?^}/m);
  const analyzeMatch = appSource.match(/function analyzeMacroEvent[\s\S]*?^}/m);
  assert.ok(parseMatch && analyzeMatch, 'macro functions must exist in app.js');

  const evalScope = new Function(`
    ${parseMatch[0]}
    ${analyzeMatch[0]}
    return { parseCalendarNumber, analyzeMacroEvent };
  `)();

  const { parseCalendarNumber, analyzeMacroEvent } = evalScope;

  assert.equal(parseCalendarNumber('201K'), 201);
  assert.equal(parseCalendarNumber('0.2%'), 0.2);
  assert.equal(parseCalendarNumber('--'), null);

  // Test Unemployment Claims with higher forecast (labor cooling -> bullish bounce potential)
  const claimsHigher = analyzeMacroEvent({
    title: 'Initial Jobless Claims',
    forecast: '201K',
    previous: '196K'
  });
  assert.equal(claimsHigher.category, 'claims');
  assert.equal(claimsHigher.bias, 'BULLISH_BOUNCE');

  // Test CPI
  const cpiHot = analyzeMacroEvent({
    title: 'Core CPI m/m',
    forecast: '0.4%',
    previous: '0.2%'
  });
  assert.equal(cpiHot.category, 'inflation');
  assert.equal(cpiHot.bias, 'BEARISH_PRESSURE');
});

test('market intel styles include 5-point briefing layout and scorecard', () => {
  assert.match(stylesSource, /\.fundamental-briefing-wrap/);
  assert.match(stylesSource, /\.briefing-card/);
  assert.match(stylesSource, /\.scorecard-grid/);
  assert.match(stylesSource, /\.card-primary/);
  assert.match(stylesSource, /\.card-conclusion/);
});

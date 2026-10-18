import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Item 2.13: Paritas 100% Tombol "Pasang Alarm Target Harga" di Header Chart Beranda dan Mapping', async (t) => {
  await t.test('1. Beranda app.js memiliki tombol #home-chart-alert di .home-chart-controls', () => {
    const appSource = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
    assert.ok(
      appSource.includes('id="home-chart-alert"'),
      'Template renderHome di app.js harus memiliki button dengan id home-chart-alert'
    );
    assert.ok(
      appSource.includes('🔔 Pasang Alarm'),
      'Tombol harus berlabel 🔔 Pasang Alarm'
    );
    assert.ok(
      appSource.includes("mainContent.querySelector('#home-chart-alert')?.addEventListener('click'"),
      'Harus memasang click listener pada #home-chart-alert'
    );
    assert.ok(
      appSource.includes('window.AmyPriceAlertManager.openAddAlertDialog()'),
      'Click listener harus memanggil window.AmyPriceAlertManager.openAddAlertDialog()'
    );
  });

  await t.test('2. Cockpit Mapping memiliki tombol #btn-chart-custom-price-alert di .gold-chart-controls', () => {
    const mappingHtml = fs.readFileSync('app/src/main/assets/apps/mapping/index.html', 'utf8');
    assert.ok(
      mappingHtml.includes('id="btn-chart-custom-price-alert"'),
      'HTML mapping harus memiliki button dengan id btn-chart-custom-price-alert'
    );
    assert.ok(
      mappingHtml.includes('🔔 Pasang Alarm'),
      'Tombol di chart controls mapping harus berlabel 🔔 Pasang Alarm'
    );

    const mappingApp = fs.readFileSync('app/src/main/assets/apps/mapping/js/ict-workspace/app.js', 'utf8');
    assert.ok(
      mappingApp.includes("$('btn-chart-custom-price-alert')?.addEventListener('click'"),
      'Script mapping harus memasang click listener pada btn-chart-custom-price-alert'
    );
  });
});

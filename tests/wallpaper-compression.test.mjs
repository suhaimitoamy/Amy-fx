import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const themeSource = fs.readFileSync('app/src/main/assets/apps/shared/amyfx-theme-controller.js', 'utf8');

function createThemeEnv(storage = {}) {
  let createdCanvas = null;
  const mockDocument = {
    documentElement: {
      dataset: {},
      style: { setProperty: () => {}, removeProperty: () => {}, getPropertyValue: () => '' },
      toggleAttribute: () => {},
      setAttribute: () => {},
      removeAttribute: () => {},
      getAttribute: () => null,
      prepend: () => {}
    },
    getElementById: () => null,
    createElement: tag => {
      if (tag === 'canvas') {
        createdCanvas = {
          width: 0,
          height: 0,
          getContext: () => ({ drawImage: () => {} }),
          toDataURL: (type, quality) => `data:${type};base64,mockCompressedData_${quality}`
        };
        return createdCanvas;
      }
      return { style: {}, setAttribute: () => {} };
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const context = {
    document: mockDocument,
    localStorage: {
      getItem: k => storage[k] ?? null,
      setItem: (k, v) => {
        if (storage.__quotaExceeded) {
          const err = new Error('QuotaExceededError');
          err.name = 'QuotaExceededError';
          throw err;
        }
        storage[k] = String(v);
      },
      removeItem: k => { delete storage[k]; }
    },
    console: { warn: () => {}, log: () => {} },
    location: { pathname: '/index.html' },
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => true,
    CustomEvent: class CustomEvent {
      constructor(type, init) {
        this.type = type;
        this.detail = init?.detail;
      }
    }
  };
  context.window = context;
  context.root = mockDocument.documentElement;
  vm.createContext(context);
  vm.runInContext(themeSource, context);
  return { AmyFXTheme: context.window.AmyFXTheme, getCanvas: () => createdCanvas, storage };
}

test('Wallpaper Compression: compressWallpaper scales down to max 1080x720 and exports WebP (Item 1.27 & 2.14)', () => {
  const { AmyFXTheme, getCanvas } = createThemeEnv();
  assert.equal(typeof AmyFXTheme.compressWallpaper, 'function', 'Must expose compressWallpaper');

  // Test 4K image 3840x2160 (16:9)
  const mock4kImg = { width: 3840, height: 2160 };
  const res = AmyFXTheme.compressWallpaper(mock4kImg, 1080, 720, 0.75);

  const canvas = getCanvas();
  assert.ok(canvas, 'Must create canvas');
  assert.equal(canvas.width, 1080);
  assert.equal(canvas.height, 608); // 2160 * (1080/3840) = 607.5 -> 608
  assert.match(res, /^data:image\/webp;base64,/);
});

test('Wallpaper Compression: setCustomBg handles QuotaExceededError gracefully without throwing (Item 1.27)', () => {
  const { AmyFXTheme } = createThemeEnv({ __quotaExceeded: true });

  // When localStorage throws QuotaExceededError, setCustomBg should not crash
  assert.doesNotThrow(() => {
    AmyFXTheme.setCustomBg({
      image: 'data:image/webp;base64,largeImageSample',
      dim: 50,
      blur: 20
    });
  }, 'Must catch and prevent QuotaExceededError crash');
});

test('Wallpaper Compression: app.js contains 1080x720 WebP compression (Item 1.27 & 2.14)', () => {
  const appJs = fs.readFileSync('app/src/main/assets/app.js', 'utf8');
  assert.match(appJs, /compressWallpaper\(img,\s*1080,\s*720,\s*0\.75\)/);
  assert.match(appJs, /maxWidth\s*=\s*1080/);
  assert.match(appJs, /maxHeight\s*=\s*720/);
});

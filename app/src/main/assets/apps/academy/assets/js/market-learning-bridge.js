/* ===== DYNAMIC LIVE EXAMPLE INJECTOR ===== */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AmyFXLiveExample = api;
  if (root.document) api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const REGISTRY_URL = '../assets/data/market-learning-map.json';

  // Dummy API simulation for live data (in a real app, this fetches from the backend engine)
  const simulatedLiveData = {
    basics: {
      price: "2410.50",
      open: "2390.00",
      high: "2415.50",
      low: "2385.00",
      session: "Asia - London Transition",
      message: "Saat Anda membaca materi ini, harga XAU/USD (Emas) berjalan di titik $2410.50. Pergerakan hari ini cukup dinamis dengan rentang $2385 - $2415."
    },
    structural_fvg: {
      message: "Berdasarkan harga XAU/USD saat ini, sistem mendeteksi ada **Bullish FVG di timeframe M15** pada rentang harga **2405.00 - 2407.50**. Coba buka chart Anda dan perhatikan struktur 3 candle yang membentuk area tersebut!"
    },
    structural_ob: {
      message: "Mesin indikator Amy FX mendeteksi ada zona **Order Block Bullish** yang belum tersentuh (fresh) di harga **2395.00** pada timeframe H1. Area ini memiliki probabilitas pantulan yang tinggi."
    },
    structural_liquidity_sweep: {
      message: "Perhatikan chart H1 saat ini. Harga baru saja menyapu **Buy Side Liquidity (BSL)** di level **2415.50**, tetapi candle ditutup dengan wick/ekor panjang di bawah level tersebut. Sesuai materi, ini adalah indikasi manipulasi (Sweep)."
    },
    management: {
      atr: "$35/hari",
      message: "Perhatian: Volatilitas (ATR) market harian saat ini mencapai **$35**. Karena volatilitas sedang tinggi, pastikan Anda menurunkan lot size hari ini agar batas risiko per trade (1-2%) tidak terlampaui."
    }
  };

  function getCurrentPath() {
    const path = window.location.pathname;
    const parts = path.split('/');
    // e.g. "bagian-17-fvg-masterclass/index.html"
    if (parts.length >= 2) {
      return parts[parts.length - 2] + '/' + parts[parts.length - 1];
    }
    return '';
  }

  async function loadRegistry() {
    try {
      const response = await fetch(REGISTRY_URL, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch (e) {
      return null;
    }
  }

  function generateUI(data) {
    const box = document.createElement('div');
    box.className = 'live-example-box glass-panel';
    box.style.margin = '2rem 0';
    box.style.padding = '1.5rem';
    box.style.borderLeft = '4px solid var(--accent, #b8860b)';
    box.style.borderRadius = '8px';
    box.style.background = 'rgba(20, 20, 20, 0.4)';
    box.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';

    const title = document.createElement('h3');
    title.style.marginTop = '0';
    title.style.display = 'flex';
    title.style.alignItems = 'center';
    title.style.gap = '8px';
    title.style.color = 'var(--text-primary, #fff)';
    title.innerHTML = '📊 <span>Live Market Example</span>';
    
    // Add a pulsing dot for "LIVE" effect
    const pulse = document.createElement('span');
    pulse.style.display = 'inline-block';
    pulse.style.width = '8px';
    pulse.style.height = '8px';
    pulse.style.borderRadius = '50%';
    pulse.style.background = '#ff3b30';
    pulse.style.boxShadow = '0 0 8px #ff3b30';
    pulse.style.animation = 'pulse 2s infinite';
    title.appendChild(pulse);

    const desc = document.createElement('p');
    desc.style.marginBottom = '0';
    desc.style.lineHeight = '1.6';
    desc.style.color = 'var(--text-secondary, #ddd)';
    // Parse markdown-like bold text
    desc.innerHTML = data.message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    box.appendChild(title);
    box.appendChild(desc);

    // Add pulse animation style if not exists
    if (!document.getElementById('amy-live-pulse-css')) {
      const style = document.createElement('style');
      style.id = 'amy-live-pulse-css';
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.95); opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
    }

    return box;
  }

  function injectExample(lessonConfig) {
    let exampleData = null;

    if (lessonConfig.category === 'basics') {
      exampleData = simulatedLiveData.basics;
    } else if (lessonConfig.category === 'structural') {
      const topic = lessonConfig.topic;
      if (topic === 'fvg') exampleData = simulatedLiveData.structural_fvg;
      else if (topic === 'ob') exampleData = simulatedLiveData.structural_ob;
      else if (topic === 'liquidity_sweep') exampleData = simulatedLiveData.structural_liquidity_sweep;
    } else if (lessonConfig.category === 'management') {
      exampleData = simulatedLiveData.management;
    }

    if (!exampleData) return;

    // Find a good place to inject (e.g., after the first 2 paragraphs of the article)
    const target = document.querySelector('.article .glass-panel') || document.querySelector('.article');
    if (!target) return;

    const paragraphs = target.querySelectorAll('p');
    const injectionPoint = paragraphs.length > 2 ? paragraphs[1] : paragraphs[paragraphs.length - 1];

    if (injectionPoint && injectionPoint.parentNode) {
      const ui = generateUI(exampleData);
      injectionPoint.parentNode.insertBefore(ui, injectionPoint.nextSibling);
    }
  }

  async function boot() {
    const registry = await loadRegistry();
    if (!registry || !registry.lessons) return;

    const currentPath = getCurrentPath();
    const lessonConfig = registry.lessons[currentPath];
    
    if (lessonConfig && lessonConfig.enabled) {
      // Check if DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => injectExample(lessonConfig));
      } else {
        injectExample(lessonConfig);
      }
    }
  }

  return { boot };
});

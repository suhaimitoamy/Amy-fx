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

  function getCurrentPath() {
    const path = window.location.pathname;
    const parts = path.split('/');
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

  function generateUI(category, topic) {
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
    desc.innerHTML = `<em>Loading live data for topic: <strong>${topic.replace(/-/g, ' ')}</strong>...</em>`;
    
    // (In the real app, this is where you fetch() to the backend using the topic)
    setTimeout(() => {
        desc.innerHTML = `Sistem Amy FX mendeteksi data live untuk materi <strong>${topic.replace(/-/g, ' ')}</strong>. <br>(Siap disambungkan ke API backend!)`;
    }, 1500);

    box.appendChild(title);
    box.appendChild(desc);

    if (!document.getElementById('amy-live-pulse-css')) {
      const style = document.createElement('style');
      style.id = 'amy-live-pulse-css';
      style.textContent = `@keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }`;
      document.head.appendChild(style);
    }

    return box;
  }

  function injectExample(lessonConfig) {
    const target = document.querySelector('.article .glass-panel') || document.querySelector('.article');
    if (!target) return;

    const paragraphs = target.querySelectorAll('p');
    const injectionPoint = paragraphs.length > 2 ? paragraphs[1] : paragraphs[paragraphs.length - 1];

    if (injectionPoint && injectionPoint.parentNode) {
      const ui = generateUI(lessonConfig.category, lessonConfig.topic);
      injectionPoint.parentNode.insertBefore(ui, injectionPoint.nextSibling);
    }
  }

  async function boot() {
    const registry = await loadRegistry();
    if (!registry || !registry.lessons) return;

    const currentPath = getCurrentPath();
    const lessonConfig = registry.lessons[currentPath];
    
    if (lessonConfig && lessonConfig.enabled) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => injectExample(lessonConfig));
      } else {
        injectExample(lessonConfig);
      }
    }
  }

  return { boot };
});

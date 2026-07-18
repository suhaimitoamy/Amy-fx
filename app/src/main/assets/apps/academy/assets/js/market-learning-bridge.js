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
  const DEFAULT_API_URL = 'https://amy-fx.vercel.app/api/learning-live-example';
  const FETCH_TIMEOUT_MS = 15000;

  function getCurrentPath() {
    const path = String(root.location?.pathname || '').replace(/\/+$/, '');
    const parts = path.split('/').filter(Boolean);
    if (!parts.length) return '';
    const last = parts.at(-1);
    if (last && last.includes('.')) {
      return parts.length >= 2 ? `${parts.at(-2)}/${last}` : last;
    }
    return `${last}/index.html`;
  }

  async function loadRegistry() {
    try {
      const response = await root.fetch(REGISTRY_URL, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[character]);
  }

  function renderMessage(value) {
    return escapeHtml(value).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  }

  function topicLabel(topic) {
    return String(topic || 'materi').replace(/-/g, ' ');
  }

  function apiUrl() {
    return String(root.AMY_FX_LEARNING_API_URL || DEFAULT_API_URL);
  }

  async function fetchLiveExample(category, topic) {
    const controller = typeof root.AbortController === 'function'
      ? new root.AbortController()
      : null;
    const timeout = controller
      ? root.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
      : null;

    try {
      const params = new URLSearchParams({
        category: String(category || 'basics'),
        topic: String(topic || '')
      });
      const response = await root.fetch(`${apiUrl()}?${params.toString()}`, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        ...(controller ? { signal: controller.signal } : {})
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.status !== 'ok' || !data?.content?.message) {
        throw new Error(data?.message || `HTTP ${response.status}`);
      }
      return data;
    } finally {
      if (timeout) root.clearTimeout(timeout);
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
    box.dataset.category = String(category || '');
    box.dataset.topic = String(topic || '');

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
    desc.dataset.liveExampleDescription = 'true';
    desc.style.marginBottom = '0';
    desc.style.lineHeight = '1.6';
    desc.style.color = 'var(--text-secondary, #ddd)';
    desc.innerHTML = `<em>Memuat data market untuk topik <strong>${escapeHtml(topicLabel(topic))}</strong>...</em>`;

    box.appendChild(title);
    box.appendChild(desc);

    if (!document.getElementById('amy-live-pulse-css')) {
      const style = document.createElement('style');
      style.id = 'amy-live-pulse-css';
      style.textContent = '@keyframes pulse { 0% { transform: scale(0.95); opacity: 0.8; } 50% { transform: scale(1.2); opacity: 1; } 100% { transform: scale(0.95); opacity: 0.8; } }';
      document.head.appendChild(style);
    }

    return box;
  }

  async function hydrateUI(box, lessonConfig) {
    const desc = box.querySelector('[data-live-example-description="true"]');
    if (!desc) return;

    try {
      const data = await fetchLiveExample(lessonConfig.category, lessonConfig.topic);
      const disclaimer = data.content.disclaimer
        ? `<br><small>${escapeHtml(data.content.disclaimer)}</small>`
        : '';
      desc.innerHTML = `${renderMessage(data.content.message)}${disclaimer}`;
      box.dataset.routeGroup = String(data.route?.group || '');
      box.dataset.marketGeneratedAt = String(data.market?.generatedAt || '');
    } catch (_) {
      desc.innerHTML = `Data live untuk topik <strong>${escapeHtml(topicLabel(lessonConfig.topic))}</strong> belum tersedia. Buka kembali halaman saat koneksi market stabil.`;
      const pulse = box.querySelector('h3 span:last-child');
      if (pulse) {
        pulse.style.background = '#ff9f0a';
        pulse.style.boxShadow = '0 0 8px #ff9f0a';
      }
    }
  }

  function injectExample(lessonConfig) {
    if (document.querySelector('.live-example-box[data-topic]')) return;

    const target = document.querySelector('.article .glass-panel') || document.querySelector('.article');
    if (!target) return;

    const paragraphs = target.querySelectorAll('p');
    const injectionPoint = paragraphs.length > 2 ? paragraphs[1] : paragraphs[paragraphs.length - 1];
    if (!injectionPoint?.parentNode) return;

    const ui = generateUI(lessonConfig.category, lessonConfig.topic);
    injectionPoint.parentNode.insertBefore(ui, injectionPoint.nextSibling);
    hydrateUI(ui, lessonConfig);
  }

  async function boot() {
    const registry = await loadRegistry();
    if (!registry?.lessons) return;

    const lessonConfig = registry.lessons[getCurrentPath()];
    if (!lessonConfig?.enabled || !lessonConfig.topic || lessonConfig.topic === 'index') return;

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => injectExample(lessonConfig), { once: true });
    } else {
      injectExample(lessonConfig);
    }
  }

  return {
    boot,
    fetchLiveExample,
    getCurrentPath,
    renderMessage
  };
});

/* Tutorial Trading → Mapping / Market Intel learning-context bridge. */
(function (root, factory) {
  'use strict';
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AmyFXMarketLearningBridge = api;
  if (root.document) api.boot();
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  const SCHEMA_VERSION = 1;
  const ACADEMY_PREFIX = '/assets/apps/academy/';
  const REGISTRY_URL = ACADEMY_PREFIX + 'assets/data/market-learning-map.json';
  const CONTEXT_RUNTIME_URL = '/assets/apps/shared/learning-context.js';
  const CTA_ID = 'amy-market-learning-cta';
  const RUNTIME_SCRIPT_ID = 'amy-learning-context-runtime';
  const ALLOWED_DESTINATIONS = new Set(['mapping', 'market-intel']);
  const ALLOWED_TIMEFRAMES = new Set(['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1']);
  const MANUAL_TEMPLATE = 'manual-review.v1';
  let bootPromise = null;

  function isObject(value) {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
  }

  function positiveNumber(value) {
    return Number.isFinite(Number(value)) && Number(value) > 0;
  }

  function lessonKeyFromPath(pathname) {
    if (typeof pathname !== 'string' || !pathname.startsWith(ACADEMY_PREFIX)) return null;
    let relative = pathname.slice(ACADEMY_PREFIX.length).replace(/^\/+/, '');
    try { relative = decodeURIComponent(relative); } catch (_) {}
    if (!relative || relative.includes('..') || relative.includes('\\')) return null;
    return relative;
  }

  function validateDefaults(defaults) {
    return isObject(defaults) &&
      positiveNumber(defaults.maxAgeMs) &&
      positiveNumber(defaults.resumeGraceMs) &&
      positiveNumber(defaults.hardMaxAgeMs) &&
      Number(defaults.resumeGraceMs) >= Number(defaults.maxAgeMs) &&
      Number(defaults.hardMaxAgeMs) >= Number(defaults.resumeGraceMs) &&
      Number(defaults.passScore) === 80;
  }

  function validateLesson(key, lesson, registry, runtime) {
    const errors = [];
    if (typeof key !== 'string' || !key || key.includes('..') || key.includes('\\')) errors.push('INVALID_LESSON_KEY');
    if (!isObject(lesson)) return { valid: false, errors: ['INVALID_LESSON'] };
    if (typeof lesson.enabled !== 'boolean') errors.push('ENABLED_FLAG_REQUIRED');
    if (lesson.enabled !== true) return { valid: errors.length === 0, errors };
    if (typeof lesson.id !== 'string' || !lesson.id.trim()) errors.push('INVALID_LESSON_ID');
    if (typeof lesson.title !== 'string' || !lesson.title.trim()) errors.push('INVALID_TITLE');
    if (!ALLOWED_DESTINATIONS.has(lesson.destination)) errors.push('INVALID_DESTINATION');
    if (lesson.timeframe !== null && lesson.timeframe !== undefined && !ALLOWED_TIMEFRAMES.has(lesson.timeframe)) errors.push('INVALID_TIMEFRAME');
    if (typeof lesson.template !== 'string' || !isObject(registry.templates[lesson.template])) errors.push('INVALID_TEMPLATE');
    if (lesson.template !== MANUAL_TEMPLATE && (!Array.isArray(lesson.requiredFacts) || lesson.requiredFacts.length === 0)) errors.push('REQUIRED_FACTS_MISSING');
    const returnPath = ACADEMY_PREFIX + key;
    if (!runtime || typeof runtime.safeLocalPath !== 'function' || runtime.safeLocalPath(returnPath) !== returnPath) errors.push('INVALID_RETURN_PATH');
    return { valid: errors.length === 0, errors };
  }

  function validateRegistry(registry, runtime) {
    const errors = [];
    if (!isObject(registry)) return { valid: false, errors: ['REGISTRY_NOT_OBJECT'] };
    if (registry.schemaVersion !== SCHEMA_VERSION) errors.push('UNSUPPORTED_SCHEMA');
    if (!validateDefaults(registry.defaults)) errors.push('INVALID_DEFAULTS');
    if (!isObject(registry.templates)) errors.push('INVALID_TEMPLATES');
    if (!isObject(registry.lessons)) errors.push('INVALID_LESSONS');
    if (!errors.length) {
      Object.entries(registry.lessons).forEach(([key, lesson]) => {
        const result = validateLesson(key, lesson, registry, runtime);
        result.errors.forEach(error => errors.push(key + ':' + error));
      });
    }
    return { valid: errors.length === 0, errors };
  }

  function activeLessonForPath(registry, pathname, runtime) {
    const registryValidation = validateRegistry(registry, runtime);
    if (!registryValidation.valid) return null;
    const key = lessonKeyFromPath(pathname);
    if (!key) return null;
    const lesson = registry.lessons[key];
    if (!lesson || lesson.enabled !== true) return null;
    const lessonValidation = validateLesson(key, lesson, registry, runtime);
    return lessonValidation.valid ? { key, lesson } : null;
  }

  function loadScript(documentObject, source, id) {
    return new Promise((resolve, reject) => {
      if (id && documentObject.getElementById(id)) {
        const check = () => root.AmyFXLearningContext ? resolve(root.AmyFXLearningContext) : reject(new Error('Learning runtime unavailable'));
        if (root.AmyFXLearningContext) resolve(root.AmyFXLearningContext);
        else root.setTimeout(check, 0);
        return;
      }
      const script = documentObject.createElement('script');
      if (id) script.id = id;
      script.src = source;
      script.async = false;
      script.onload = () => resolve(root.AmyFXLearningContext || true);
      script.onerror = () => reject(new Error('Failed to load ' + source));
      documentObject.head.appendChild(script);
    });
  }

  async function ensureRuntime(documentObject) {
    if (root.AmyFXLearningContext) return root.AmyFXLearningContext;
    await loadScript(documentObject, CONTEXT_RUNTIME_URL, RUNTIME_SCRIPT_ID);
    if (!root.AmyFXLearningContext) throw new Error('Learning context runtime did not initialize');
    return root.AmyFXLearningContext;
  }

  async function loadRegistry(fetchFunction) {
    const response = await fetchFunction(REGISTRY_URL, { headers: { Accept: 'application/json' }, cache: 'no-store' });
    if (!response || !response.ok) throw new Error('Learning registry unavailable');
    return response.json();
  }

  function articleTarget(documentObject) {
    return documentObject.querySelector('.article .glass-panel') ||
      documentObject.querySelector('.article-layout .article') ||
      documentObject.querySelector('.article');
  }

  function currentPath(locationObject) {
    return locationObject && typeof locationObject.pathname === 'string' ? locationObject.pathname : '';
  }

  function finalizeReturnedContext(runtime, windowObject) {
    try {
      const state = windowObject.history && windowObject.history.state;
      const ownership = state && state.amyLearningSource;
      if (!ownership) return false;
      const context = runtime.readContext();
      if (!context || !runtime.ownershipMatches(context, ownership)) return false;
      const safeReturn = runtime.safeLocalPath(context.returnPath);
      if (!safeReturn || new URL(safeReturn, runtime.APP_ORIGIN).pathname !== currentPath(windowObject.location)) return false;
      return Boolean(runtime.finalizeReturn(ownership).ok);
    } catch (_) {
      return false;
    }
  }

  function createContextFromLesson(runtime, entry, registry, windowObject) {
    const defaults = registry.defaults;
    const lesson = entry.lesson;
    const returnPath = ACADEMY_PREFIX + entry.key;
    const context = runtime.createContext({
      lessonId: lesson.id,
      lessonTitle: lesson.title,
      destination: lesson.destination,
      destinationTab: lesson.tab || null,
      timeframe: lesson.timeframe || null,
      returnPath,
      maxAgeMs: defaults.maxAgeMs,
      resumeGraceMs: defaults.resumeGraceMs,
      hardMaxAgeMs: defaults.hardMaxAgeMs
    });

    try {
      const previousState = isObject(windowObject.history.state) ? windowObject.history.state : {};
      windowObject.history.replaceState(Object.assign({}, previousState, {
        amyLearningSource: runtime.ownershipOf(context)
      }), '', windowObject.location.href);
    } catch (_) {}
    return context;
  }

  function injectCta(documentObject, runtime, entry, registry, windowObject) {
    if (documentObject.getElementById(CTA_ID)) return false;
    const target = articleTarget(documentObject);
    if (!target) return false;

    const card = documentObject.createElement('section');
    card.id = CTA_ID;
    card.className = 'glass-panel';
    card.setAttribute('aria-label', 'Latihan market nyata');

    const title = documentObject.createElement('h2');
    title.textContent = 'Praktikkan di market saat ini';
    const description = documentObject.createElement('p');
    description.textContent = entry.lesson.exercisePrompt || 'Buka kondisi market yang relevan dan lakukan analisis sebelum melihat pembanding.';
    const button = documentObject.createElement('button');
    button.type = 'button';
    button.className = 'btn primary';
    button.textContent = entry.lesson.destination === 'mapping' ? 'Buka Mapping' : 'Buka Market Intel';

    button.addEventListener('click', function () {
      if (button.disabled) return;
      button.disabled = true;
      try {
        const context = createContextFromLesson(runtime, entry, registry, windowObject);
        const launched = runtime.launchDestination(context);
        if (!launched.ok) throw new Error(launched.reason || 'Navigation failed');
      } catch (_) {
        button.disabled = false;
        if (typeof root.showToast === 'function') root.showToast('Latihan market belum dapat dibuka.');
      }
    });

    card.appendChild(title);
    card.appendChild(description);
    card.appendChild(button);
    target.appendChild(card);
    return true;
  }

  async function initialize(options) {
    const windowObject = options && options.window ? options.window : root;
    const documentObject = options && options.document ? options.document : windowObject.document;
    const fetchFunction = options && options.fetch ? options.fetch : windowObject.fetch && windowObject.fetch.bind(windowObject);
    if (!documentObject || typeof fetchFunction !== 'function') return { active: false, reason: 'ENVIRONMENT_UNAVAILABLE' };

    try {
      const runtime = options && options.runtime ? options.runtime : await ensureRuntime(documentObject);
      finalizeReturnedContext(runtime, windowObject);
      const registry = options && options.registry ? options.registry : await loadRegistry(fetchFunction);
      const validation = validateRegistry(registry, runtime);
      if (!validation.valid) return { active: false, reason: 'INVALID_REGISTRY', errors: validation.errors };
      const entry = activeLessonForPath(registry, currentPath(windowObject.location), runtime);
      if (!entry) return { active: false, reason: 'NO_ACTIVE_LESSON' };
      return { active: injectCta(documentObject, runtime, entry, registry, windowObject), reason: null, entry };
    } catch (_) {
      return { active: false, reason: 'BRIDGE_UNAVAILABLE' };
    }
  }

  function boot() {
    if (bootPromise) return bootPromise;
    bootPromise = new Promise(resolve => {
      const start = () => initialize().then(resolve);
      if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', start, { once: true });
      else start();
    });
    root.addEventListener('pageshow', function () {
      if (root.AmyFXLearningContext) finalizeReturnedContext(root.AmyFXLearningContext, root);
    });
    return bootPromise;
  }

  return Object.freeze({
    SCHEMA_VERSION,
    ACADEMY_PREFIX,
    REGISTRY_URL,
    CONTEXT_RUNTIME_URL,
    ALLOWED_DESTINATIONS,
    ALLOWED_TIMEFRAMES,
    lessonKeyFromPath,
    validateLesson,
    validateRegistry,
    activeLessonForPath,
    finalizeReturnedContext,
    initialize,
    boot
  });
});

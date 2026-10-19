export function initDetailsPersistence(targetDoc = typeof document !== 'undefined' ? document : null) {
  if (!targetDoc) return null;
  const STORAGE_KEY = 'amy_mapping_open_details';
  function getOpenDetails() {
    try {
      if (typeof sessionStorage !== 'undefined') {
        return new Set(JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '[]'));
      }
    } catch (_) {}
    return new Set();
  }
  function saveOpenDetails(openSet) {
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(openSet)));
      }
    } catch (_) {}
  }
  function getDetailKey(detail) {
    return detail.id || detail.dataset?.driver || detail.dataset?.plan || detail.querySelector?.('summary')?.textContent?.trim() || '';
  }

  function restoreOpenDetails(root = targetDoc) {
    const openSet = getOpenDetails();
    if (!openSet.size) return;
    const items = root.querySelectorAll ? root.querySelectorAll('details') : [];
    items.forEach(detail => {
      const key = getDetailKey(detail);
      if (key && openSet.has(key)) {
        detail.open = true;
      }
    });
  }

  targetDoc.addEventListener?.('toggle', (e) => {
    if (e.target?.tagName?.toLowerCase() === 'details') {
      const detail = e.target;
      const key = getDetailKey(detail);
      if (!key) return;
      const openSet = getOpenDetails();
      if (detail.open) {
        openSet.add(key);
      } else {
        openSet.delete(key);
      }
      saveOpenDetails(openSet);
    }
  }, true);

  if (typeof MutationObserver !== 'undefined' && targetDoc.body) {
    let pending = false;
    const observer = new MutationObserver(() => {
      if (!pending) {
        pending = true;
        Promise.resolve().then(() => {
          pending = false;
          restoreOpenDetails();
        });
      }
    });
    observer.observe(targetDoc.body, { childList: true, subtree: true });
  }

  restoreOpenDetails();
  return { restoreOpenDetails, getOpenDetails, saveOpenDetails, getDetailKey };
}

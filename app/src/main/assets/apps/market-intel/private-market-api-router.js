(function () {
  'use strict';

  if (window.__amyFxPrivateMarketApiRouterV1) return;
  window.__amyFxPrivateMarketApiRouterV1 = true;

  const nativeFetch = window.fetch.bind(window);
  const PRIVATE_ORIGIN = 'https://amy-fx-git-personal-amyfx-private-aplikasi-trading.vercel.app';
  const MARKET_PATHS = new Set(['/api/twelvedata', '/api/heatmap', '/api/liquidity']);

  function route(input) {
    const source = new URL(input instanceof Request ? input.url : String(input), location.href);
    if (source.hostname !== 'amy-fx.vercel.app' || !MARKET_PATHS.has(source.pathname)) return null;
    const target = new URL(source.pathname, PRIVATE_ORIGIN);
    target.search = source.search;
    return target.toString();
  }

  window.fetch = function privateMarketFetch(input, init) {
    try {
      const target = route(input);
      if (!target) return nativeFetch(input, init);
      const request = input instanceof Request ? new Request(target, input) : target;
      return nativeFetch(request, init);
    } catch (_) {
      return nativeFetch(input, init);
    }
  };

  window.AmyFXPrivateMarketApi = Object.freeze({ origin: PRIVATE_ORIGIN });
})();

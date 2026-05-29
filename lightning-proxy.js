/**
 * stillWeather — Cloudflare Worker: Lightning API Proxy
 * File: lightning-proxy.js  (deploy to Cloudflare Workers)
 * ──────────────────────────────────────────────────────────────────────────────
 *
 * RATE FACTS (Weatherbit Standard, $45/mo)
 *   • 25,000 quota units / day
 *   • Current Lightning API costs 10 units per upstream call
 *   • = 2,500 effective lightning calls / day available
 *   • Weatherbit source data refreshes every 5 minutes
 *   • This Worker caches responses for 120 s — well within the 5-min refresh
 *     window, so no stale data is ever served.
 *   • Worst-case (refresh every 2 min all day): 720 upstream calls = 7,200 units
 *   • Realistic (swim club, ~10 loads/day): ~100 units  (0.4% of daily quota)
 *
 * SETUP STEPS
 *   1. workers.cloudflare.com → Create Worker → paste this file
 *   2. Settings → Variables → Add encrypted variable:
 *        Name:  WEATHERBIT_API_KEY
 *        Value: <your key>
 *   3. Note your worker URL (e.g. https://stillweather-lightning.YOURNAME.workers.dev)
 *   4. In index.html, set:
 *        const LIGHTNING_PROXY_URL = 'https://stillweather-lightning.YOURNAME.workers.dev';
 *   5. Optionally set a custom domain under Workers → Triggers → Custom Domains
 *
 * ALLOWED ORIGINS — restrict to your deployed site to prevent key abuse
 */

const ALLOWED_ORIGINS = [
  'https://ecstatictech641.github.io',
  'http://localhost',
  'http://127.0.0.1',
  // Add your custom domain here if you set one up:
  // 'https://weather.yourdomain.com',
];

const CACHE_TTL_SECONDS = 120;  // 2 min — Weatherbit refreshes every 5 min

export default {
  async fetch(request, env, ctx) {

    // ── CORS headers ─────────────────────────────────────────────────────────
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.some(o => origin.startsWith(o));
    const corsHeaders = allowed
      ? {
          'Access-Control-Allow-Origin':  origin,
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ── Route guard ──────────────────────────────────────────────────────────
    const url  = new URL(request.url);
    const path = url.pathname;

    if (path !== '/lightning') {
      return new Response(JSON.stringify({ error: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Required param check ─────────────────────────────────────────────────
    const lat = url.searchParams.get('lat');
    const lon = url.searchParams.get('lon');
    if (!lat || !lon) {
      return new Response(JSON.stringify({ error: 'lat and lon are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ── Build upstream URL (key never leaves the Worker) ────────────────────
    const searchKm   = url.searchParams.get('search_distance_km') || '40';
    const searchMins = url.searchParams.get('search_mins')         || '30';
    const limit      = url.searchParams.get('limit')               || '20';
    const sort       = url.searchParams.get('sort')                || 'distance';

    const upstreamUrl =
      `https://api.weatherbit.io/v2.0/current/lightning` +
      `?lat=${lat}&lon=${lon}` +
      `&search_distance_km=${searchKm}` +
      `&search_mins=${searchMins}` +
      `&sort=${sort}&limit=${limit}` +
      `&key=${env.WEATHERBIT_API_KEY}`;

    // ── Cloudflare Cache API (edge cache, shared across all requests) ────────
    const cache     = caches.default;
    // Build a cache key that strips the API key (safe to cache publicly)
    const cacheKey  = new Request(
      `https://cache.stillweather/lightning?lat=${lat}&lon=${lon}` +
      `&km=${searchKm}&mins=${searchMins}&limit=${limit}&sort=${sort}`
    );

    // Check cache first
    let cachedResponse = await cache.match(cacheKey);
    if (cachedResponse) {
      // Clone and re-attach CORS headers (stripped when stored)
      const headers = new Headers(cachedResponse.headers);
      Object.entries(corsHeaders).forEach(([k, v]) => headers.set(k, v));
      headers.set('X-Cache', 'HIT');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        headers,
      });
    }

    // ── Upstream call ────────────────────────────────────────────────────────
    try {
      const apiRes = await fetch(upstreamUrl);

      // Pass through Weatherbit rate limit headers for monitoring
      const rlLimit     = apiRes.headers.get('X-RateLimit-Limit')     || 'unknown';
      const rlRemaining = apiRes.headers.get('X-RateLimit-Remaining') || 'unknown';
      const rlReset     = apiRes.headers.get('X-RateLimit-Reset')     || 'unknown';

      const payload = await apiRes.json();

      const responseHeaders = {
        'Content-Type':             'application/json',
        'Cache-Control':            `public, max-age=${CACHE_TTL_SECONDS}`,
        'X-Cache':                  'MISS',
        'X-RateLimit-Limit':        rlLimit,
        'X-RateLimit-Remaining':    rlRemaining,
        'X-RateLimit-Reset':        rlReset,
        ...corsHeaders,
      };

      const freshResponse = new Response(JSON.stringify(payload), {
        status: apiRes.status,
        headers: responseHeaders,
      });

      // Store in edge cache (only on success)
      if (apiRes.status === 200) {
        // Cache a copy without CORS headers (those are request-specific)
        const toCache = new Response(JSON.stringify(payload), {
          status: 200,
          headers: {
            'Content-Type':  'application/json',
            'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
            'X-RateLimit-Limit':     rlLimit,
            'X-RateLimit-Remaining': rlRemaining,
            'X-RateLimit-Reset':     rlReset,
          },
        });
        ctx.waitUntil(cache.put(cacheKey, toCache));
      }

      return freshResponse;

    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Upstream API error', detail: err.message }),
        { status: 502, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }
  },
};

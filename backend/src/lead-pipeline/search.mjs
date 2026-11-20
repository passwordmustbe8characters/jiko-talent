// Search layer: cache first, then providers in order, with budget counters.
// Result shape is the same for every provider: { title, url, snippet }.
// NOTE: provider request formats were written from memory of their docs. If a provider
// rejects a request, check its current API docs and adjust the matching adapter below.
import { config } from './config.mjs';
import { query } from './db.mjs';
import { reserve, refund } from './usage.mjs';

async function postJson(url, body, headers) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

const adapters = {
  async tavily({ q, num, apiKey }) {
    const r = await postJson(
      'https://api.tavily.com/search',
      { query: q, max_results: num, search_depth: 'basic' },
      { Authorization: `Bearer ${apiKey}` }
    );
    return (r.results ?? []).map((x) => ({ title: x.title, url: x.url, snippet: x.content ?? '' }));
  },
  async exa({ q, num, apiKey, category }) {
    const r = await postJson(
      'https://api.exa.ai/search',
      { query: q, numResults: num, type: 'auto', ...(category ? { category } : {}) },
      { 'x-api-key': apiKey }
    );
    return (r.results ?? []).map((x) => ({ title: x.title, url: x.url, snippet: x.text ?? '' }));
  },
  async serper({ q, num, apiKey, country }) {
    const r = await postJson(
      'https://google.serper.dev/search',
      { q, num, ...(country ? { gl: country } : {}) },
      { 'X-API-KEY': apiKey }
    );
    return (r.organic ?? []).map((x) => ({ title: x.title, url: x.link, snippet: x.snippet ?? '' }));
  },
};

const dedupe = (items) => {
  const seen = new Set();
  return items.filter((i) => i.url && !seen.has(i.url) && seen.add(i.url));
};

/**
 * search('fintech startup Lagos careers', { num: 8, country: 'ng' })
 * Returns { provider, cached, results }.
 * Throws if no provider is configured or all are exhausted.
 */
export async function search(queryText, { num = 8, country, providers, fresh = false, category } = {}) {
  // category ('company') is only used by Exa; it is part of the cache key so results are not mixed up
  const q = (category ? `[${category}] ` : '') + queryText.trim().replace(/\s+/g, ' ');

  if (!fresh) {
    const { rows } = await query(
      `SELECT provider, results FROM search_cache
       WHERE query = $1 AND fetched_at > now() - ($2 || ' days')::interval
       ORDER BY fetched_at DESC LIMIT 1`,
      [q, String(config.search.cacheDays)]
    );
    if (rows[0]) return { provider: rows[0].provider, cached: true, results: rows[0].results };
  }

  const order = providers ?? config.search.order;
  const errors = [];

  for (const name of order) {
    const cfg = config.search.providers[name];
    if (!cfg?.apiKey || !adapters[name]) continue;

    if (!(await reserve(name, 1, cfg.monthlyLimit))) {
      errors.push(`${name}: monthly limit reached`);
      continue;
    }
    try {
      const results = dedupe(await adapters[name]({ q: q.replace(/^\[[^\]]+\] /, ''), num, apiKey: cfg.apiKey, country, category }));
      await query(
        `INSERT INTO search_cache (provider, query, results, result_count, fetched_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (provider, query) DO UPDATE
           SET results = EXCLUDED.results, result_count = EXCLUDED.result_count, fetched_at = now()`,
        [name, q, JSON.stringify(results), results.length]
      );
      return { provider: name, cached: false, results };
    } catch (err) {
      await refund(name, 1); // the call failed, so don't count it against the budget
      errors.push(`${name}: ${err.message}`);
    }
  }
  throw new Error(`No search provider could answer "${q}". ${errors.join(' | ') || 'No provider keys configured.'}`);
}

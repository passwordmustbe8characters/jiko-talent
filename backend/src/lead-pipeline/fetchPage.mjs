// Reads a web page politely and stores its text in web_cache.
// That stored text is the evidence the verification step checks quotes against.
import crypto from 'node:crypto';
import * as cheerio from 'cheerio';
import robotsParser from 'robots-parser';
import { config } from './config.mjs';
import { query } from './db.mjs';

const robotsCache = new Map();
const lastHit = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function normalizeUrl(input) {
  const u = new URL(input);
  u.hash = '';
  u.hostname = u.hostname.toLowerCase();
  if (u.pathname.length > 1 && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
  return u.toString();
}

export function domainOf(input) {
  return new URL(input).hostname.toLowerCase().replace(/^www\./, '');
}

async function timedFetch(url, options = {}, ms = config.fetch.timeoutMs) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...options, signal: ctrl.signal, redirect: 'follow' });
  } finally {
    clearTimeout(timer);
  }
}

async function robotsFor(url) {
  const { origin, host } = new URL(url);
  if (robotsCache.has(host)) return robotsCache.get(host);
  let parser = null;
  try {
    const res = await timedFetch(`${origin}/robots.txt`, { headers: { 'User-Agent': config.fetch.userAgent } }, 8000);
    if (res.ok) parser = robotsParser(`${origin}/robots.txt`, await res.text());
  } catch {
    /* no robots.txt reachable: treat as allowed */
  }
  robotsCache.set(host, parser);
  return parser;
}

async function politeWait(host) {
  const wait = (lastHit.get(host) ?? 0) + config.fetch.minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastHit.set(host, Date.now());
}

/** Turn HTML into readable text. Keeps footers (they often hold contact details). */
export function extractText(html) {
  const $ = cheerio.load(html);
  const title = $('title').first().text().trim();

  const emails = new Set();
  $('a[href^="mailto:"]').each((_, a) => {
    const address = ($(a).attr('href') || '').replace(/^mailto:/i, '').split('?')[0].trim();
    if (address) emails.add(address);
  });

  $('script, style, noscript, svg, iframe').remove();
  $('br').replaceWith('\n');
  $('p, div, li, ul, ol, h1, h2, h3, h4, h5, h6, tr, section, article, header, footer, nav, main').append('\n');

  let text = $('body').text() || $.root().text();
  text = text
    .replace(/[ \t\f\v\u00a0]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (emails.size) text += `\n\nEmail addresses listed on this page: ${[...emails].join(', ')}`;
  return { title, text };
}

/**
 * getPage(url) -> { ok: true, cached, page } or { ok: false, reason }
 * Respects robots.txt, waits between hits to the same site, and caches results.
 * Pages that come back nearly empty (JavaScript-rendered sites) are reported, not stored.
 */
export async function getPage(rawUrl, { force = false } = {}) {
  let url;
  try {
    url = normalizeUrl(rawUrl);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }

  if (!force) {
    const { rows } = await query(
      `SELECT * FROM web_cache
       WHERE url = $1 AND content IS NOT NULL AND fetched_at > now() - ($2 || ' days')::interval`,
      [url, String(config.fetch.cacheDays)]
    );
    if (rows[0]) return { ok: true, cached: true, page: rows[0] };
  }

  const botName = config.fetch.userAgent.split('/')[0];
  const robots = await robotsFor(url);
  if (robots && robots.isAllowed(url, botName) === false) return { ok: false, reason: 'blocked_by_robots' };

  await politeWait(new URL(url).host);

  let res;
  try {
    res = await timedFetch(url, {
      headers: { 'User-Agent': config.fetch.userAgent, Accept: 'text/html,application/xhtml+xml' },
    });
  } catch (err) {
    return { ok: false, reason: `network_error (${err.name})` };
  }
  if (!res.ok) return { ok: false, reason: `http_${res.status}` };

  const type = res.headers.get('content-type') || '';
  if (!/text\/html|application\/xhtml/i.test(type)) return { ok: false, reason: `not_html (${type || 'unknown'})` };

  const buffer = Buffer.from(await res.arrayBuffer());
  const html = buffer.subarray(0, config.fetch.maxBytes).toString('utf8');
  const { title, text } = extractText(html);
  const content = text.slice(0, config.fetch.maxChars);
  if (content.length < 200) return { ok: false, reason: 'thin_content (probably a JavaScript-rendered site)' };

  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const { rows } = await query(
    `INSERT INTO web_cache (url, title, content, content_hash, http_status, fetched_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (url) DO UPDATE
       SET title = EXCLUDED.title, content = EXCLUDED.content, content_hash = EXCLUDED.content_hash,
           http_status = EXCLUDED.http_status, fetched_at = now()
     RETURNING *`,
    [url, title, content, hash, res.status]
  );
  return { ok: true, cached: false, page: rows[0] };
}

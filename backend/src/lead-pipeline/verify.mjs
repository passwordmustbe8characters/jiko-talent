// The only way a fact enters the database. A fact is saved only if its quote
// really appears in the stored copy of the page it cites.
import { query } from './db.mjs';
import { normalizeUrl } from './fetchPage.mjs';

export const MIN_QUOTE_CHARS = 20;
const CATEGORIES = ['overview', 'tech_stack', 'hiring', 'funding', 'culture', 'contact', 'other'];

export function normalizeForMatch(text) {
  return String(text)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Does `quote` appear in `pageText`, ignoring case, spacing and curly quotes? */
export function quoteInPage(quote, pageText) {
  const q = normalizeForMatch(quote).replace(/[.…]+$/, '').trim();
  if (q.length < MIN_QUOTE_CHARS) return { ok: false, reason: 'quote_too_short' };
  return normalizeForMatch(pageText).includes(q) ? { ok: true } : { ok: false, reason: 'quote_not_found_in_page' };
}

/**
 * saveFact({ leadId, category, claim, sourceUrl, quote })
 * The page must already be in web_cache (fetch it with getPage first).
 * Unverified facts are rejected unless keepUnverified is true.
 */
export async function saveFact({ leadId, category = 'other', claim, sourceUrl, quote, keepUnverified = false }) {
  if (!claim || !sourceUrl || !quote) return { saved: false, reason: 'missing_fields' };

  let url;
  try {
    url = normalizeUrl(sourceUrl);
  } catch {
    return { saved: false, reason: 'invalid_source_url' };
  }

  const { rows: pages } = await query('SELECT id, content, fetched_at FROM web_cache WHERE url = $1', [url]);
  const page = pages[0];
  if (!page) return { saved: false, reason: 'source_not_fetched' };

  const check = quoteInPage(quote, page.content);
  if (!check.ok && !keepUnverified) return { saved: false, reason: check.reason };

  const { rows } = await query(
    `INSERT INTO lead_facts
       (lead_id, category, claim, source_url, evidence_quote, web_cache_id, fetched_at, verified, verified_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, verified`,
    [
      leadId,
      CATEGORIES.includes(category) ? category : 'other',
      claim,
      url,
      quote,
      page.id,
      page.fetched_at,
      check.ok,
      check.ok ? new Date() : null,
    ]
  );
  return { saved: true, id: rows[0].id, verified: rows[0].verified };
}

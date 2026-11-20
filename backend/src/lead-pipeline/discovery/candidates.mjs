// Picks real company websites out of search results (drops job boards, social sites and news).
const BLOCKED = [
  'linkedin.com', 'indeed.com', 'glassdoor.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com',
  'youtube.com', 'tiktok.com', 'medium.com', 'wikipedia.org', 'reddit.com', 'quora.com', 'github.com',
  'crunchbase.com', 'pinterest.com', 'jobberman.com', 'myjobmag.com', 'ngcareers.com', 'hotnigerianjobs.com',
  'jobwebnigeria.com', 'workable.com', 'lever.co', 'greenhouse.io', 'ashbyhq.com', 'smartrecruiters.com',
  'bamboohr.com', 'breezy.hr', 'recruitee.com', 'wellfound.com', 'angel.co', 'remoteok.com', 'weworkremotely.com',
  'remote.co', 'flexjobs.com', 'ziprecruiter.com', 'monster.com', 'jooble.org', 'talent.com', 'techcabal.com',
  'techpoint.africa', 'disruptafrica.com', 'techcrunch.com', 'forbes.com', 'businessinsider.com', 'nairametrics.com',
  'punchng.com', 'guardian.ng', 'vanguardngr.com', 'premiumtimesng.com', 'google.com', 'bing.com', 'amazon.com',
  'apple.com', 'play.google.com', 'udemy.com', 'coursera.org', 'wikihow.com', 'stackoverflow.com', 'notion.site',
];

const SECOND_LEVEL = new Set(['co', 'com', 'org', 'gov', 'edu', 'ac', 'net']);

/** careers.acme.com -> acme.com ;  www.acme.com.ng -> acme.com.ng */
export function rootDomain(host) {
  const parts = host.toLowerCase().replace(/^www\./, '').split('.');
  if (parts.length <= 2) return parts.join('.');
  const take = parts[parts.length - 1].length === 2 && SECOND_LEVEL.has(parts[parts.length - 2]) ? 3 : 2;
  return parts.slice(-take).join('.');
}

export function isBlocked(domain) {
  return BLOCKED.some((b) => domain === b || domain.endsWith(`.${b}`));
}

/**
 * perQuery: [{ q, kind, results: [{ title, url, snippet }] }]
 * Returns the best `max` company candidates: [{ domain, urls, score, foundVia, kinds }]
 */
export function pickCandidates(perQuery, { max = 10 } = {}) {
  const byDomain = new Map();
  for (const { q, kind, results } of perQuery) {
    results.forEach((r, rank) => {
      let u;
      try { u = new URL(r.url); } catch { return; }
      if (!/^https?:$/.test(u.protocol)) return;
      const domain = rootDomain(u.hostname);
      if (isBlocked(domain)) return;
      if (!byDomain.has(domain)) byDomain.set(domain, { domain, urls: [], score: 0, foundVia: [], kinds: new Set() });
      const c = byDomain.get(domain);
      c.score += 1 / (rank + 1);
      if (!c.urls.includes(r.url)) c.urls.push(r.url);
      if (!c.foundVia.includes(q)) { c.foundVia.push(q); c.score += 0.5; }
      c.kinds.add(kind);
    });
  }
  return [...byDomain.values()]
    .map((c) => ({ ...c, kinds: [...c.kinds] }))
    .sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain))
    .slice(0, max);
}

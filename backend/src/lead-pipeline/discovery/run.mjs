// Discovery: batch -> searches -> company websites -> verified facts -> leads.
// Runs in the background; the admin screen polls getJob() for progress.
import crypto from 'node:crypto';
import { pool } from '../db.mjs';
import { search } from '../search.mjs';
import { getPage, normalizeUrl } from '../fetchPage.mjs';
import { saveFact, quoteInPage, normalizeForMatch } from '../verify.mjs';
import { roleFamilyFrom } from '../tags.mjs';
import { buildQueries, humanTag } from './queries.mjs';
import { pickCandidates } from './candidates.mjs';
import { detectTech, detectHiring, bestHiring, extractEmails, isGenericInbox, regionOf } from './signals.mjs';
import { extractCompany } from './extract.mjs';
import { classifySite, kindFromType, domainName } from './classify.mjs';

const jobs = new Map();
export const getJob = (id) => jobs.get(id) ?? null;
export const latestJobForBatch = (batchId) =>
  [...jobs.values()].filter((j) => j.batchId === batchId).sort((a, b) => b.startedAt - a.startedAt)[0] ?? null;

const log = (job, msg) => { job.log.push({ t: Date.now(), msg }); if (job.log.length > 300) job.log.shift(); };
const ROLE_WORD = {
  frontend: 'frontend developer', backend: 'backend developer', fullstack: 'full stack developer', 'data-ai': 'data analyst',
  mobile: 'mobile developer', design: 'UI/UX designer', devops: 'devops engineer', 'security-networking': 'cybersecurity analyst',
  'embedded-iot': 'embedded engineer', product: 'product manager', qa: 'QA engineer', other: 'software developer',
};

/** Starts a run and returns immediately. Throws if this batch already has one running. */
export async function startDiscovery(batchId, { maxCompanies = 10, maxQueries = 6 } = {}) {
  const running = latestJobForBatch(batchId);
  if (running?.status === 'running') throw Object.assign(new Error('Discovery is already running for this batch.'), { status: 409 });

  const { rows: [batch] } = await pool.query('SELECT * FROM batches WHERE id = $1', [batchId]);
  if (!batch) throw Object.assign(new Error('Batch not found.'), { status: 404 });

  const job = {
    id: crypto.randomUUID(), batchId, status: 'running', startedAt: Date.now(), finishedAt: null, error: null, log: [],
    stats: { queries: 0, searchesUsed: 0, candidates: 0, processed: 0, leadsNew: 0, leadsReused: 0, skipped: 0, factsSaved: 0, factsRejected: 0, contactsSaved: 0, channels: 0 },
  };
  jobs.set(job.id, job);
  execute(job, batch, { maxCompanies, maxQueries }).catch(async (err) => {
    job.status = 'error'; job.error = err.message; job.finishedAt = Date.now();
    log(job, `Stopped: ${err.message}`);
    await pool.query(`UPDATE batches SET status = 'draft' WHERE id = $1 AND status = 'researching'`, [batchId]).catch(() => {});
  });
  return job;
}

async function readCompanyPages(job, domain, resultUrls) {
  const tryUrls = [...new Set([`https://${domain}/`, ...resultUrls.slice(0, 2), `https://${domain}/about`, `https://${domain}/careers`, `https://${domain}/contact`, `https://${domain}/about-us`, `https://${domain}/jobs`]
    .map((u) => { try { return normalizeUrl(u); } catch { return null; } }).filter(Boolean))];
  const pages = [];
  let tries = 0;
  for (const url of tryUrls) {
    if (pages.length >= 4 || tries >= 7) break;
    tries += 1;
    const r = await getPage(url);
    if (r.ok) pages.push({ url: r.page.url, content: r.page.content, title: r.page.title });
    else if (r.reason === 'blocked_by_robots') log(job, `  skipped ${url} (the site asks bots not to read it)`);
  }
  return pages;
}

async function execute(job, batch, { maxCompanies, maxQueries }) {
  const batchTags = batch.defining_tags ?? [];
  const family = roleFamilyFrom(batch.role_family);
  const role = ROLE_WORD[family] ?? ROLE_WORD.other;
  await pool.query(`UPDATE batches SET status = 'researching' WHERE id = $1`, [batch.id]);

  // 1. Searches
  const { rows: domains } = await pool.query(
    `SELECT d AS tag FROM (
       SELECT unnest(t.domain_tags) AS d FROM batch_students bs JOIN student_tags t ON t.student_id = bs.student_id WHERE bs.batch_id = $1
     ) x GROUP BY d ORDER BY count(*) DESC, d LIMIT 2`, [batch.id]);
  const queries = buildQueries(batch, domains.map((r) => r.tag), { max: maxQueries });
  job.stats.queries = queries.length;
  log(job, `Searching the web with ${queries.length} queries for: ${role}, ${batchTags.slice(0, 3).map(humanTag).join(', ') || 'general skills'}`);

  const perQuery = [];
  for (const { q, kind, mode } of queries) {
    try {
      const country = kind === 'local' ? 'ng' : undefined;
      const r = await search(q, mode === 'company'
        ? { num: 10, country, category: 'company', providers: ['exa', 'tavily'] }
        : { num: 8, country, providers: ['tavily', 'exa', 'serper'] });
      if (!r.cached) job.stats.searchesUsed += 1;
      perQuery.push({ q, kind, results: r.results });
      log(job, `  "${q}": ${r.results.length} results${r.cached ? ' (from cache)' : ` via ${r.provider}`}`);
    } catch (err) {
      log(job, `  "${q}" failed: ${err.message}`);
    }
  }
  if (!perQuery.length) throw new Error('No search could be completed. Check your search keys and monthly limits.');

  // 2. Candidate companies
  const candidates = pickCandidates(perQuery, { max: maxCompanies });
  job.stats.candidates = candidates.length;
  log(job, `Found ${candidates.length} candidate companies to look at`);

  // 3. Research each one
  for (const cand of candidates) {
    job.stats.processed += 1;
    log(job, `Researching ${cand.domain}`);
    try {
      await researchCompany(job, batch, { batchTags, role }, cand);
    } catch (err) {
      job.stats.skipped += 1;
      log(job, `  problem with ${cand.domain}: ${err.message}`);
    }
  }

  // 4. Finish
  const { rows: [c] } = await pool.query('SELECT count(*)::int AS n FROM batch_leads WHERE batch_id = $1', [batch.id]);
  await pool.query(`UPDATE batches SET status = $2 WHERE id = $1`, [batch.id, c.n > 0 ? 'ready_for_review' : 'draft']);
  job.status = 'done'; job.finishedAt = Date.now();
  log(job, `Done: ${job.stats.leadsNew} new employer lead(s), ${job.stats.leadsReused} reused, ${job.stats.channels} site(s) for students, ${job.stats.skipped} skipped.`);
}

async function linkToBatch(batchId, leadId, foundVia, fitNote) {
  await pool.query(
    `INSERT INTO batch_leads (batch_id, lead_id, found_via, fit_note) VALUES ($1, $2, $3, $4)
     ON CONFLICT (batch_id, lead_id) DO UPDATE SET fit_note = EXCLUDED.fit_note`,
    [batchId, leadId, foundVia, fitNote]);
}
const fitNoteFor = (batchTags, stack, hiring) => {
  const overlap = batchTags.filter((t) => stack.includes(t));
  const bits = [];
  if (batchTags.length) bits.push(overlap.length ? `Mentions ${overlap.length} of ${batchTags.length} batch skills (${overlap.map(humanTag).join(', ')})` : 'No batch skills mentioned');
  if (hiring === 'active') bits.push('advertises roles');
  else if (hiring === 'possible') bits.push('mentions hiring');
  return bits.join('; ');
};

async function saveChannel(job, batch, cand, pages, foundVia) {
  const { region, country } = regionOf(cand.domain, pages.map((p) => p.content).join('\n'));
  const { rows: [lead] } = await pool.query(
    `INSERT INTO leads (company_name, domain, website_url, region, country, summary, kind)
     VALUES ($1, $2, $3, $4, $5, $6, 'channel')
     ON CONFLICT (domain) DO UPDATE SET kind = 'channel' RETURNING id`,
    [domainName(cand.domain), cand.domain, `https://${cand.domain}`, region, country, pages[0].title?.slice(0, 200) ?? null]);
  await linkToBatch(batch.id, lead.id, foundVia, 'Site students can register or apply on');
  job.stats.channels += 1;
  log(job, '  job board or marketplace: saved as a site for students, not as an employer');
}

async function researchCompany(job, batch, { batchTags, role }, cand) {
  const foundVia = cand.foundVia[0] ?? null;

  // Already researched (maybe for another batch)? Reuse it instead of paying again.
  const { rows: [existing] } = await pool.query(
    `SELECT l.id, l.status, l.tech_stack, l.hiring_signal, l.deleted_at,
            EXISTS (SELECT 1 FROM lead_facts f WHERE f.lead_id = l.id) AS has_facts
     FROM leads l WHERE l.domain = $1`, [cand.domain]);
  if (existing) {
    if (existing.deleted_at || existing.status === 'rejected') { job.stats.skipped += 1; log(job, '  previously rejected, skipping'); return; }
    if (existing.has_facts) {
      await linkToBatch(batch.id, existing.id, foundVia, fitNoteFor(batchTags, existing.tech_stack, existing.hiring_signal));
      job.stats.leadsReused += 1; log(job, '  already researched, linked to this batch'); return;
    }
  }

  const pages = await readCompanyPages(job, cand.domain, cand.urls);
  if (!pages.length) { job.stats.skipped += 1; log(job, '  no readable pages (blocked, empty or JavaScript-only), skipping'); return; }

  // What kind of site is this? Job boards, investors and recruiters are not employers to pitch.
  const cls = classifySite({ domain: cand.domain, text: pages.map((p) => p.content).join('\n') });
  if (cls.kind === 'job_board') { await saveChannel(job, batch, cand, pages, foundVia); return; }
  if (cls.kind !== 'employer') { job.stats.skipped += 1; log(job, `  skipped: looks like ${cls.label} (${cls.reason})`); return; }

  // Deterministic signals, each with the page it came from
  const tech = new Map(); // tag -> { quote, url }
  let hiring = { signal: 'unknown', quote: null, claim: null, url: null };
  const emails = new Map(); // email -> url
  for (const p of pages) {
    for (const [tag, v] of detectTech(p.content)) if (!tech.has(tag)) tech.set(tag, { ...v, url: p.url });
    const h = detectHiring(p.content);
    let path = ''; try { path = new URL(p.url).pathname; } catch { /* keep empty */ }
    const careersPage = /career|jobs?|join|vacanc|opportunit|work-with-us|hiring/i.test(path) || /career|jobs/i.test(p.title ?? '');
    // "Advertises roles" must come from the company's own careers page; elsewhere it is only "mentions hiring"
    hiring = bestHiring(hiring, { ...(h.signal === 'active' && !careersPage ? { ...h, signal: 'possible' } : h), url: p.url });
    for (const e of extractEmails(p.content)) if (!emails.has(e)) emails.set(e, p.url);
  }
  const stack = [...tech.keys()];
  const overlap = batchTags.filter((t) => stack.includes(t));
  if (batchTags.length && overlap.length === 0 && hiring.signal === 'unknown') {
    job.stats.skipped += 1; log(job, '  no sign of the batch skills or hiring, skipping'); return;
  }

  // Model suggestions (optional: if it fails we still keep the deterministic findings)
  let ai = null;
  try { ai = await extractCompany({ pages, role, tags: batchTags.map(humanTag) }); }
  catch (err) { log(job, `  AI summary unavailable (${err.message.slice(0, 80)})`); }

  const aiKind = ai?.companyType ? kindFromType(ai.companyType) : 'employer';
  if (aiKind === 'channel') { await saveChannel(job, batch, cand, pages, foundVia); return; }
  if (aiKind === 'skip') { job.stats.skipped += 1; log(job, `  skipped: the AI says this is a ${ai.companyType.replace('_', ' ')}`); return; }

  const text = pages.map((p) => p.content).join('\n');
  const { region, country: regionCountry } = regionOf(cand.domain, text);
  const name = ai?.companyName ?? domainName(cand.domain);

  const { rows: [lead] } = await pool.query(
    `INSERT INTO leads (company_name, domain, website_url, region, country, city, industry, summary, company_size, funding_stage, tech_stack, hiring_signal, kind)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'employer')
     ON CONFLICT (domain) DO UPDATE SET
       company_name = COALESCE(EXCLUDED.company_name, leads.company_name),
       website_url = COALESCE(EXCLUDED.website_url, leads.website_url),
       region = EXCLUDED.region,
       country = COALESCE(EXCLUDED.country, leads.country), city = COALESCE(EXCLUDED.city, leads.city),
       industry = COALESCE(EXCLUDED.industry, leads.industry), summary = COALESCE(EXCLUDED.summary, leads.summary),
       company_size = COALESCE(EXCLUDED.company_size, leads.company_size),
       funding_stage = COALESCE(EXCLUDED.funding_stage, leads.funding_stage),
       tech_stack = EXCLUDED.tech_stack, kind = 'employer',
       hiring_signal = CASE WHEN EXCLUDED.hiring_signal = 'unknown' THEN leads.hiring_signal ELSE EXCLUDED.hiring_signal END
     RETURNING id`,
    [name, cand.domain, `https://${cand.domain}`, region, ai?.country ?? regionCountry, ai?.city ?? null, ai?.industry ?? null,
     ai?.summary ?? null, ai?.companySize ?? null, ai?.fundingStage ?? null, stack.slice(0, 20), hiring.signal]);
  await linkToBatch(batch.id, lead.id, foundVia, fitNoteFor(batchTags, stack, hiring.signal));
  job.stats.leadsNew += 1;

  // Facts: only saved if the quote is really on the stored page
  const factInputs = [];
  const ordered = [...overlap, ...stack.filter((t) => !overlap.includes(t))].slice(0, 8);
  for (const tag of ordered) {
    const v = tech.get(tag);
    factInputs.push({ category: 'tech_stack', claim: `Mentions ${humanTag(tag)} on its website`, sourceUrl: v.url, quote: v.quote });
  }
  if (hiring.quote) factInputs.push({ category: 'hiring', claim: hiring.claim, sourceUrl: hiring.url, quote: hiring.quote });
  for (const f of ai?.facts ?? []) factInputs.push({ category: f.category, claim: f.claim, sourceUrl: f.sourceUrl, quote: f.quote });

  for (const f of factInputs) {
    const dup = await pool.query('SELECT 1 FROM lead_facts WHERE lead_id = $1 AND claim = $2', [lead.id, f.claim]);
    if (dup.rowCount) continue;
    const r = await saveFact({ leadId: lead.id, ...f });
    if (r.saved) job.stats.factsSaved += 1; else job.stats.factsRejected += 1;
  }

  // Contacts: general inboxes found on the pages, plus named people the model found with a checkable quote
  const pageByUrl = new Map(pages.map((p) => [normalizeUrl(p.url), p]));
  const addContact = async (c) => {
    if (c.email) {
      const dup = await pool.query('SELECT id FROM lead_contacts WHERE lead_id = $1 AND lower(email) = $2', [lead.id, c.email]);
      if (dup.rowCount) {
        // Same email already saved: let a named record fill in the person's name and title
        if (c.fullName || c.jobTitle) {
          await pool.query(
            `UPDATE lead_contacts SET full_name = COALESCE(full_name, $2), job_title = COALESCE(job_title, $3), notes = COALESCE($4, notes) WHERE id = $1`,
            [dup.rows[0].id, c.fullName ?? null, c.jobTitle ?? null, c.notes ?? null]);
        }
        return;
      }
    }
    await pool.query(
      `INSERT INTO lead_contacts (lead_id, full_name, job_title, email, phone, source_url, confidence, notes)
       VALUES ($1, $2, $3, $4, $5, $6, 'on_company_site', $7)`,
      [lead.id, c.fullName ?? null, c.jobTitle ?? null, c.email ?? null, c.phone ?? null, c.sourceUrl, c.notes ?? null]);
    job.stats.contactsSaved += 1;
  };
  for (const c of ai?.contacts ?? []) {
    let page; try { page = pageByUrl.get(normalizeUrl(c.sourceUrl)); } catch { page = null; }
    if (!page || !quoteInPage(c.quote, page.content).ok) continue;
    const hay = normalizeForMatch(page.content);
    const email = c.email && hay.includes(c.email) ? c.email : null;          // never keep an email that is not on the page
    const phone = c.phone && hay.replace(/[^0-9]/g, '').includes(c.phone.replace(/[^0-9]/g, '')) && c.phone.replace(/[^0-9]/g, '').length >= 7 ? c.phone : null;
    if (!(c.fullName && c.jobTitle) && !email) continue;
    await addContact({ ...c, email, phone, sourceUrl: page.url, notes: 'Named on the company website' });
  }
  for (const [email, url] of [...emails.entries()].slice(0, 4)) {
    await addContact({ email, sourceUrl: url, notes: isGenericInbox(email) ? 'General inbox listed on the website' : 'Email listed on the website' });
  }
  log(job, `  saved: ${stack.length} technologies, hiring: ${hiring.signal}, ${region}`);
}

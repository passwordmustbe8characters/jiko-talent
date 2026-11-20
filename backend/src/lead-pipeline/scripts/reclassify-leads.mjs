// Usage (from backend/):  node src/lead-pipeline/scripts/reclassify-leads.mjs         (preview)
//                         node src/lead-pipeline/scripts/reclassify-leads.mjs --save  (apply)
// Re-checks leads you already have using the page text saved earlier (no internet, no AI, no search credits).
// Job boards become "sites for students"; investors and recruiters are marked rejected.
import { pool, closeDb } from '../db.mjs';
import { classifySite } from '../discovery/classify.mjs';
import { rootDomain } from '../discovery/candidates.mjs';

const SAVE = process.argv.includes('--save');
try {
  const { rows: leads } = await pool.query(`SELECT id, company_name, domain, status FROM leads WHERE kind = 'employer' AND deleted_at IS NULL`);
  const { rows: pages } = await pool.query(`SELECT url, content FROM web_cache WHERE content IS NOT NULL`);
  const byDomain = new Map();
  for (const p of pages) {
    let d; try { d = rootDomain(new URL(p.url).hostname); } catch { continue; }
    byDomain.set(d, (byDomain.get(d) ?? '') + '\n' + p.content);
  }
  let changed = 0;
  for (const l of leads) {
    const text = byDomain.get(l.domain);
    if (!text) { console.log(`  ${l.domain}: no saved pages, left as is`); continue; }
    const c = classifySite({ domain: l.domain, text });
    if (c.kind === 'employer') { console.log(`  ${l.domain}: employer (kept)`); continue; }
    console.log(`  ${l.domain}: ${c.label} (${c.reason}) -> ${c.kind === 'job_board' ? 'site for students' : 'rejected'}`);
    changed += 1;
    if (SAVE) {
      if (c.kind === 'job_board') await pool.query(`UPDATE leads SET kind = 'channel' WHERE id = $1`, [l.id]);
      else await pool.query(`UPDATE leads SET status = 'rejected', reject_reason = $2 WHERE id = $1`, [l.id, `Looks like ${c.label}`]);
    }
  }
  console.log(SAVE ? `\n✅ Updated ${changed} lead(s).` : `\n${changed} lead(s) would change. Run again with --save to apply.`);
} catch (err) {
  console.error('❌ Failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}

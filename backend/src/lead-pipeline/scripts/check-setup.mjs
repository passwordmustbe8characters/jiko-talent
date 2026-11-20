// Usage (from the backend folder):  node src/lead-pipeline/scripts/check-setup.mjs
// Checks the database, tables, model key, search keys and page fetching, one by one.
// Search checks use one credit per provider. Nothing here touches student data.
import { config } from '../config.mjs';
import { pool, closeDb } from '../db.mjs';
import { chat, currentModel } from '../llm.mjs';
import { search } from '../search.mjs';
import { getPage } from '../fetchPage.mjs';
import { usageReport } from '../usage.mjs';

const ok = (m) => console.log(`✅ ${m}`);
const warn = (m) => console.log(`⚠️  ${m}`);
const bad = (m) => console.log(`❌ ${m}`);

const TABLES = ['batches', 'student_tags', 'batch_students', 'leads', 'batch_leads', 'web_cache',
  'search_cache', 'lead_facts', 'lead_contacts', 'matches', 'drafts', 'outreach_log', 'api_usage'];

try {
  // 1. Database
  if (!config.databaseUrl) bad('DATABASE_URL is not set in .env');
  else {
    await pool.query('SELECT 1');
    ok('Database connection works');
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [TABLES]
    );
    const missing = TABLES.filter((t) => !rows.some((r) => r.table_name === t));
    missing.length ? bad(`Missing tables: ${missing.join(', ')} (run run-migration.mjs)`) : ok('All 13 pipeline tables exist');
  }

  // 2. Model
  const llm = config.llm.providers[config.llm.provider];
  if (!llm?.apiKey) warn(`No API key for LLM provider "${config.llm.provider}"`);
  else {
    try {
      const r = await chat({ user: 'Reply with the single word: ready', tier: 'fast', maxTokens: 400, retries: 1 });
      ok(`${config.llm.provider} model ${currentModel('fast')} replied: "${r.text.trim().slice(0, 40)}"`);
    } catch (e) {
      bad(`LLM call failed: ${e.message}`);
    }
  }

  // 3. Search providers (each one tested directly, bypassing the cache)
  for (const name of Object.keys(config.search.providers)) {
    if (!config.search.providers[name].apiKey) { warn(`${name}: no key set (skipped)`); continue; }
    try {
      const r = await search('fintech startup Lagos careers', { providers: [name], num: 3, fresh: true });
      ok(`${name}: ${r.results.length} results, first: ${r.results[0]?.url ?? 'none'}`);
    } catch (e) {
      bad(`${name}: ${e.message}`);
    }
  }

  // 4. Page fetching
  const page = await getPage('https://example.com', { force: true });
  page.ok ? ok('Page fetching works') : warn(`Page fetch said: ${page.reason} (example.com is tiny, so "thin_content" is expected)`);

  console.log('\nUsage this month:', await usageReport());
} catch (err) {
  bad(`Setup check crashed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await closeDb();
}

// Discovery + leads endpoints. Mounted by routes.mjs after the admin login check.
import { Router } from 'express';
import { pool } from '../db.mjs';
import { startDiscovery, getJob, latestJobForBatch } from '../discovery/run.mjs';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEAD_STATUSES = ['new', 'reviewing', 'approved', 'contacted', 'replied', 'closed', 'rejected'];
const fail = (res, err, label) => {
  console.error(`Admin ${label} error:`, err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
};
const snapshot = (job) => job && ({ id: job.id, batchId: job.batchId, status: job.status, error: job.error, stats: job.stats, startedAt: job.startedAt, finishedAt: job.finishedAt, log: job.log.slice(-40).map((l) => l.msg) });

router.post('/batches/:id/discover', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Batch not found.' });
    const maxCompanies = Math.min(Math.max(parseInt(req.body?.maxCompanies, 10) || 10, 1), 20);
    const job = await startDiscovery(req.params.id, { maxCompanies });
    res.status(202).json({ job: snapshot(job) });
  } catch (e) { fail(res, e, 'start discovery'); }
});

router.get('/batches/:id/discovery', (req, res) => {
  res.json({ job: snapshot(latestJobForBatch(req.params.id)) });
});

router.get('/discovery/:jobId', (req, res) => {
  const job = getJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Run not found (the server may have restarted).' });
  res.json({ job: snapshot(job) });
});

router.get('/batches/:id/leads', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Batch not found.' });
    const includeRejected = req.query.includeRejected === '1';
    const { rows } = await pool.query(`
      SELECT l.id, l.company_name, l.domain, l.region, l.country, l.city, l.industry, l.summary, l.hiring_signal,
             l.tech_stack, l.status, bl.fit_note,
             (SELECT count(*)::int FROM lead_facts f WHERE f.lead_id = l.id) AS fact_count,
             (SELECT count(*)::int FROM lead_facts f WHERE f.lead_id = l.id AND f.verified) AS verified_count,
             (SELECT count(*)::int FROM lead_contacts c WHERE c.lead_id = l.id) AS contact_count
      FROM batch_leads bl JOIN leads l ON l.id = bl.lead_id
      WHERE bl.batch_id = $1 AND l.deleted_at IS NULL AND l.kind = 'employer' AND ($2::boolean OR l.status <> 'rejected')
      ORDER BY CASE l.hiring_signal WHEN 'active' THEN 0 WHEN 'possible' THEN 1 WHEN 'unknown' THEN 2 ELSE 3 END, l.company_name`,
      [req.params.id, includeRejected]);
    const { rows: channels } = await pool.query(`
      SELECT l.id, l.company_name, l.domain, l.website_url, l.summary, l.country, l.status
      FROM batch_leads bl JOIN leads l ON l.id = bl.lead_id
      WHERE bl.batch_id = $1 AND l.deleted_at IS NULL AND l.kind = 'channel' AND l.status <> 'rejected'
      ORDER BY l.company_name`, [req.params.id]);
    const { rows: [rej] } = await pool.query(`
      SELECT count(*)::int AS n FROM batch_leads bl JOIN leads l ON l.id = bl.lead_id
      WHERE bl.batch_id = $1 AND l.kind = 'employer' AND l.status = 'rejected'`, [req.params.id]);
    res.json({ leads: rows, channels, rejectedCount: rej.n });
  } catch (e) { fail(res, e, 'list leads'); }
});

router.get('/leads/:id', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Lead not found.' });
    const { rows: [lead] } = await pool.query('SELECT * FROM leads WHERE id = $1 AND deleted_at IS NULL', [req.params.id]);
    if (!lead) return res.status(404).json({ error: 'Lead not found.' });
    const { rows: facts } = await pool.query(
      `SELECT id, category, claim, source_url, evidence_quote, fetched_at, verified FROM lead_facts
       WHERE lead_id = $1 ORDER BY verified DESC, category, created_at`, [req.params.id]);
    const { rows: contacts } = await pool.query(
      `SELECT id, full_name, job_title, email, phone, source_url, confidence, notes FROM lead_contacts
       WHERE lead_id = $1 ORDER BY (full_name IS NULL), full_name, email`, [req.params.id]);
    const { rows: batches } = await pool.query(
      `SELECT b.id, b.name, bl.fit_note FROM batch_leads bl JOIN batches b ON b.id = bl.batch_id WHERE bl.lead_id = $1 ORDER BY b.name`, [req.params.id]);
    res.json({ lead, facts, contacts, batches });
  } catch (e) { fail(res, e, 'get lead'); }
});

router.patch('/leads/:id', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Lead not found.' });
    const { status, rejectReason } = req.body ?? {};
    const sets = []; const vals = [];
    if (status !== undefined) {
      if (!LEAD_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
      vals.push(status); sets.push(`status = $${vals.length}`);
    }
    if (rejectReason !== undefined) { vals.push(String(rejectReason).slice(0, 1000)); sets.push(`reject_reason = $${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id);
    const { rowCount } = await pool.query(`UPDATE leads SET ${sets.join(', ')} WHERE id = $${vals.length} AND deleted_at IS NULL`, vals);
    if (!rowCount) return res.status(404).json({ error: 'Lead not found.' });
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'update lead'); }
});

export default router;

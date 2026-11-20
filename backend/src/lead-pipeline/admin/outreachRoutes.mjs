// Matching, email drafts, outreach record and results. Mounted by routes.mjs after the admin login check.
import { Router } from 'express';
import { pool } from '../db.mjs';
import { computeMatches, getMatches } from '../matching/service.mjs';
import { generateDraft, listDrafts, updateDraft } from '../drafts/service.mjs';
import { logEvent, listEvents, results } from '../outreach/service.mjs';

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res, err, label) => {
  if (!err.status) console.error(`Admin ${label} error:`, err);
  res.status(err.status ?? 500).json({ error: err.status ? err.message : 'Something went wrong on the server.' });
};
const bad = (res, what) => res.status(404).json({ error: `${what} not found.` });

router.post('/batches/:id/match', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return bad(res, 'Batch');
    res.json(await computeMatches(req.params.id));
  } catch (e) { fail(res, e, 'match'); }
});

router.get('/batches/:id/matches', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return bad(res, 'Batch');
    res.json({ companies: await getMatches(req.params.id) });
  } catch (e) { fail(res, e, 'get matches'); }
});

router.get('/leads/:id/matches', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return bad(res, 'Company');
    const { rows } = await pool.query(
      `SELECT m.batch_id, b.name AS batch_name, m.student_id, s.name, m.score, m.reason, m.matched_tags
       FROM matches m JOIN jiko_students s ON s.id = m.student_id JOIN batches b ON b.id = m.batch_id
       WHERE m.lead_id = $1 ORDER BY m.score DESC, s.name LIMIT 12`, [req.params.id]);
    res.json({ matches: rows.map((r) => ({ ...r, score: Number(r.score) })) });
  } catch (e) { fail(res, e, 'lead matches'); }
});

router.post('/batches/:id/leads/:leadId/draft', async (req, res) => {
  try {
    if (!UUID.test(req.params.id) || !UUID.test(req.params.leadId)) return bad(res, 'Company');
    res.status(201).json(await generateDraft(req.params.id, req.params.leadId));
  } catch (e) { fail(res, e, 'draft'); }
});

router.get('/leads/:id/drafts', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return bad(res, 'Company');
    res.json({ drafts: await listDrafts(req.params.id) });
  } catch (e) { fail(res, e, 'list drafts'); }
});

router.patch('/drafts/:id', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return bad(res, 'Draft');
    const { contactId } = req.body ?? {};
    if (contactId !== undefined && contactId !== null && !UUID.test(contactId)) return res.status(400).json({ error: 'Invalid contact.' });
    await updateDraft(req.params.id, req.body ?? {});
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'update draft'); }
});

router.get('/leads/:id/outreach', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return bad(res, 'Company');
    res.json({ events: await listEvents(req.params.id) });
  } catch (e) { fail(res, e, 'list outreach'); }
});

router.post('/leads/:id/outreach', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return bad(res, 'Company');
    const b = req.body ?? {};
    for (const key of ['contactId', 'draftId']) if (b[key] != null && !UUID.test(b[key])) return res.status(400).json({ error: `Invalid ${key}.` });
    if (b.studentId != null && !Number.isInteger(b.studentId)) return res.status(400).json({ error: 'Invalid studentId.' });
    res.status(201).json(await logEvent(req.params.id, b));
  } catch (e) { fail(res, e, 'log outreach'); }
});

router.get('/results', async (_req, res) => {
  try { res.json(await results()); } catch (e) { fail(res, e, 'results'); }
});

export default router;

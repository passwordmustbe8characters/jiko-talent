// Private admin API. Mount in server.mjs with:  app.use('/api/admin', adminRoutes)
import { Router } from 'express';
import { pool } from '../db.mjs';
import { verifyPassword, signToken, requireAdmin, loginAllowed, recordFailure, clearFailures } from './auth.mjs';
import { previewBatches, saveBatches } from './batchService.mjs';
import leadRoutes from './leadRoutes.mjs';
import outreachRoutes from './outreachRoutes.mjs';

const router = Router();
const STATUSES = ['draft', 'researching', 'ready_for_review', 'archived'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (res, err, label) => {
  console.error(`Admin ${label} error:`, err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
};

// ---- login (the only route without a token) ----
router.post('/login', (req, res) => {
  const ip = req.ip;
  if (!process.env.ADMIN_PASSWORD_HASH) return res.status(503).json({ error: 'Admin login is not set up yet (see README).' });
  if (!loginAllowed(ip)) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  if (!verifyPassword(req.body?.password, process.env.ADMIN_PASSWORD_HASH)) {
    recordFailure(ip);
    return res.status(401).json({ error: 'Wrong password.' });
  }
  clearFailures(ip);
  res.json({ token: signToken() });
});

router.use(requireAdmin);
router.use(leadRoutes);
router.use(outreachRoutes);

// ---- batches ----
router.get('/batches', async (_req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT b.id, b.name, b.role_family, b.defining_tags, b.status, b.notes, b.created_at,
        (SELECT count(*)::int FROM batch_students bs WHERE bs.batch_id = b.id) AS student_count,
        (SELECT count(*)::int FROM batch_leads bl WHERE bl.batch_id = b.id) AS lead_count
      FROM batches b ORDER BY b.created_at DESC, b.name`);
    res.json({ batches: rows });
  } catch (e) { fail(res, e, 'list batches'); }
});

// Preview (save: false) or create (save: true) batches from students not yet in an active batch.
router.post('/batches/auto', async (req, res) => {
  try {
    if (req.body?.save === true) return res.json(await saveBatches());
    res.json(await previewBatches());
  } catch (e) { fail(res, e, 'auto batch'); }
});

router.get('/batches/:id', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Batch not found.' });
    const { rows: [batch] } = await pool.query(`SELECT * FROM batches WHERE id = $1`, [req.params.id]);
    if (!batch) return res.status(404).json({ error: 'Batch not found.' });
    const { rows: students } = await pool.query(`
      SELECT s.id, s.name, s.role_in_project, s.project_title, s.is_group_project,
             t.role_family, COALESCE(t.tech_tags, '{}') AS tech_tags, COALESCE(t.domain_tags, '{}') AS domain_tags
      FROM batch_students bs
      JOIN jiko_students s ON s.id = bs.student_id
      LEFT JOIN student_tags t ON t.student_id = s.id
      WHERE bs.batch_id = $1 ORDER BY s.name`, [req.params.id]);
    const { rows: otherBatches } = await pool.query(
      `SELECT id, name FROM batches WHERE id <> $1 AND status <> 'archived' ORDER BY name`, [req.params.id]);
    const { rows: [counts] } = await pool.query(
      `SELECT count(*)::int AS lead_count FROM batch_leads WHERE batch_id = $1`, [req.params.id]);
    res.json({ batch: { ...batch, lead_count: counts.lead_count }, students, otherBatches });
  } catch (e) { fail(res, e, 'get batch'); }
});

router.patch('/batches/:id', async (req, res) => {
  try {
    if (!UUID.test(req.params.id)) return res.status(404).json({ error: 'Batch not found.' });
    const { name, status, notes } = req.body ?? {};
    const sets = []; const vals = [];
    if (name !== undefined) {
      const n = String(name).trim();
      if (!n || n.length > 150) return res.status(400).json({ error: 'Name must be 1-150 characters.' });
      vals.push(n); sets.push(`name = $${vals.length}`);
    }
    if (status !== undefined) {
      if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
      vals.push(status); sets.push(`status = $${vals.length}`);
    }
    if (notes !== undefined) { vals.push(String(notes).slice(0, 5000)); sets.push(`notes = $${vals.length}`); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update.' });
    vals.push(req.params.id);
    const { rowCount } = await pool.query(`UPDATE batches SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
    if (!rowCount) return res.status(404).json({ error: 'Batch not found.' });
    res.json({ ok: true });
  } catch (e) { fail(res, e, 'update batch'); }
});

// Move a student to another batch (toBatchId) or out of this one (toBatchId: null).
router.post('/batches/:id/students/:studentId/move', async (req, res) => {
  const client = await pool.connect();
  try {
    const studentId = Number(req.params.studentId);
    const to = req.body?.toBatchId ?? null;
    if (!UUID.test(req.params.id) || !Number.isInteger(studentId)) return res.status(404).json({ error: 'Not found.' });
    if (to !== null && (!UUID.test(to) || to === req.params.id)) return res.status(400).json({ error: 'Invalid destination batch.' });

    await client.query('BEGIN');
    const del = await client.query(`DELETE FROM batch_students WHERE batch_id = $1 AND student_id = $2`, [req.params.id, studentId]);
    if (!del.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Student is not in this batch.' }); }
    if (to) {
      const dest = await client.query(`SELECT 1 FROM batches WHERE id = $1`, [to]);
      if (!dest.rowCount) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Destination batch not found.' }); }
      await client.query(`INSERT INTO batch_students (batch_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [to, studentId]);
    }
    await client.query('COMMIT');
    res.json({ ok: true });
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    fail(res, e, 'move student');
  } finally { client.release(); }
});

export default router;

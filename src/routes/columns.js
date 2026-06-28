'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { isMember } = require('../access');
const { serializeColumn } = require('../serialize');
const realtime = require('../realtime');
const { logActivity } = require('../notify');

const router = express.Router();
router.use(requireAuth);

const getColumn = (id) => db.prepare('SELECT * FROM columns WHERE id = ?').get(Number(id));

router.post('/', (req, res) => {
  const projectId = Number(req.body.projectId);
  const name = (req.body.name || '').trim();
  if (!projectId || !name) return res.status(400).json({ error: 'A column name is required.' });
  if (!isMember(projectId, req.user.id)) return res.status(403).json({ error: 'You are not a member of this project.' });
  if (name.length > 40) return res.status(400).json({ error: 'Column name is too long.' });

  const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM columns WHERE project_id = ?').get(projectId).m;
  const info = db.prepare('INSERT INTO columns (project_id, name, position) VALUES (?, ?, ?)').run(projectId, name, max + 1);
  const column = serializeColumn(getColumn(info.lastInsertRowid));
  realtime.broadcast(projectId, 'column:created', column);
  res.status(201).json({ column });
});

router.put('/:id', (req, res) => {
  const column = getColumn(req.params.id);
  if (!column) return res.status(404).json({ error: 'Column not found.' });
  if (!isMember(column.project_id, req.user.id)) return res.status(403).json({ error: 'You are not a member of this project.' });
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'A column name is required.' });
  db.prepare('UPDATE columns SET name = ? WHERE id = ?').run(name, column.id);
  const updated = serializeColumn(getColumn(column.id));
  realtime.broadcast(column.project_id, 'column:updated', updated);
  res.json({ column: updated });
});

router.delete('/:id', (req, res) => {
  const column = getColumn(req.params.id);
  if (!column) return res.status(404).json({ error: 'Column not found.' });
  if (!isMember(column.project_id, req.user.id)) return res.status(403).json({ error: 'You are not a member of this project.' });
  const count = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE column_id = ?').get(column.id).c;
  if (count > 0) return res.status(400).json({ error: 'Move or delete this column’s cards first.' });
  db.prepare('DELETE FROM columns WHERE id = ?').run(column.id);
  realtime.broadcast(column.project_id, 'column:deleted', { id: column.id });
  res.json({ ok: true });
});

router.post('/reorder', (req, res) => {
  const projectId = Number(req.body.projectId);
  const order = Array.isArray(req.body.order) ? req.body.order.map(Number) : [];
  if (!projectId || !order.length) return res.status(400).json({ error: 'Nothing to reorder.' });
  if (!isMember(projectId, req.user.id)) return res.status(403).json({ error: 'You are not a member of this project.' });

  const apply = db.transaction(() => {
    order.forEach((id, i) => {
      db.prepare('UPDATE columns SET position = ? WHERE id = ? AND project_id = ?').run(i, id, projectId);
    });
  });
  apply();
  const columns = db.prepare('SELECT * FROM columns WHERE project_id = ? ORDER BY position ASC, id ASC').all(projectId).map(serializeColumn);
  realtime.broadcast(projectId, 'column:reordered', { projectId, columns });
  res.json({ columns });
});

module.exports = router;

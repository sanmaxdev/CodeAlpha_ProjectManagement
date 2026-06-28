'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { isMember } = require('../access');
const { serializeTask, serializeComment, userMini } = require('../serialize');
const realtime = require('../realtime');
const { logActivity, notify } = require('../notify');

const router = express.Router();
router.use(requireAuth);

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const DONE_RE = /done|complete|shipped|closed/i;

const getTask = (id) => db.prepare('SELECT * FROM tasks WHERE id = ?').get(Number(id));
const getColumn = (id) => db.prepare('SELECT * FROM columns WHERE id = ?').get(Number(id));
const columnOrder = (colId) =>
  db.prepare('SELECT id FROM tasks WHERE column_id = ? ORDER BY position ASC, id ASC').all(colId).map((r) => r.id);

function cleanLabels(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.filter((s) => typeof s === 'string' && s.trim()).map((s) => s.trim().slice(0, 20)))].slice(0, 6);
}

function memberGuard(req, res, projectId) {
  if (!isMember(projectId, req.user.id)) {
    res.status(403).json({ error: 'You are not a member of this project.' });
    return false;
  }
  return true;
}

router.get('/mine', (req, res) => {
  const rows = db
    .prepare(
      `SELECT t.*, p.name AS p_name, p.code AS p_code, p.color AS p_color, c.name AS c_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       JOIN columns c ON c.id = t.column_id
       WHERE t.assignee_id = ?
       ORDER BY (t.due_date IS NULL), date(t.due_date) ASC, t.id DESC`
    )
    .all(req.user.id);
  const tasks = rows.map((r) => ({
    ...serializeTask(r),
    project: { id: r.project_id, name: r.p_name, code: r.p_code, color: r.p_color },
    columnName: r.c_name,
  }));
  res.json({ tasks });
});

router.post('/', (req, res) => {
  const columnId = Number(req.body.columnId);
  const column = getColumn(columnId);
  if (!column) return res.status(404).json({ error: 'Column not found.' });
  if (!memberGuard(req, res, column.project_id)) return;

  const title = (req.body.title || '').trim();
  if (!title) return res.status(400).json({ error: 'A task title is required.' });
  if (title.length > 160) return res.status(400).json({ error: 'Task title is too long.' });

  const description = (req.body.description || '').trim();
  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : 'medium';
  const labels = cleanLabels(req.body.labels);
  const dueDate = req.body.dueDate ? String(req.body.dueDate).slice(0, 10) : null;
  let assigneeId = req.body.assigneeId ? Number(req.body.assigneeId) : null;
  if (assigneeId && !isMember(column.project_id, assigneeId)) assigneeId = null;

  const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM tasks WHERE column_id = ?').get(columnId).m;
  const info = db
    .prepare(
      `INSERT INTO tasks (project_id, column_id, title, description, position, assignee_id, creator_id, priority, labels, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(column.project_id, columnId, title, description, max + 1, assigneeId, req.user.id, priority, JSON.stringify(labels), dueDate);
  const task = serializeTask(getTask(info.lastInsertRowid));

  logActivity({ projectId: column.project_id, taskId: task.id, userId: req.user.id, type: 'task_created', detail: title });
  if (assigneeId) {
    notify({ userId: assigneeId, actorId: req.user.id, type: 'assigned', projectId: column.project_id, taskId: task.id, detail: title });
  }
  realtime.broadcast(column.project_id, 'task:created', { by: req.user.id, task });
  res.status(201).json({ task });
});

router.get('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!memberGuard(req, res, task.project_id)) return;
  const comments = db.prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY id ASC').all(task.id).map(serializeComment);
  res.json({ task: serializeTask(task), comments });
});

router.put('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!memberGuard(req, res, task.project_id)) return;

  const title = req.body.title !== undefined ? String(req.body.title).trim() : task.title;
  if (!title) return res.status(400).json({ error: 'A task title is required.' });
  const description = req.body.description !== undefined ? String(req.body.description).trim() : task.description;
  const priority = PRIORITIES.includes(req.body.priority) ? req.body.priority : task.priority;
  const labels = req.body.labels !== undefined ? cleanLabels(req.body.labels) : JSON.parse(task.labels || '[]');
  const dueDate = req.body.dueDate !== undefined ? (req.body.dueDate ? String(req.body.dueDate).slice(0, 10) : null) : task.due_date;
  const completed = req.body.completed !== undefined ? (req.body.completed ? 1 : 0) : task.completed;

  let assigneeId = task.assignee_id;
  if (req.body.assigneeId !== undefined) {
    assigneeId = req.body.assigneeId ? Number(req.body.assigneeId) : null;
    if (assigneeId && !isMember(task.project_id, assigneeId)) assigneeId = null;
  }
  const assigneeChanged = assigneeId !== task.assignee_id;

  db.prepare(
    `UPDATE tasks SET title = ?, description = ?, priority = ?, labels = ?, due_date = ?, completed = ?, assignee_id = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(title, description, priority, JSON.stringify(labels), dueDate, completed, assigneeId, task.id);

  const updated = serializeTask(getTask(task.id));
  if (assigneeChanged && assigneeId) {
    logActivity({ projectId: task.project_id, taskId: task.id, userId: req.user.id, type: 'assigned', detail: updated.assignee.name });
    notify({ userId: assigneeId, actorId: req.user.id, type: 'assigned', projectId: task.project_id, taskId: task.id, detail: title });
  }
  if (completed !== task.completed) {
    logActivity({ projectId: task.project_id, taskId: task.id, userId: req.user.id, type: completed ? 'completed' : 'reopened', detail: title });
  }
  realtime.broadcast(task.project_id, 'task:updated', { by: req.user.id, task: updated });
  res.json({ task: updated });
});

router.delete('/:id', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!memberGuard(req, res, task.project_id)) return;
  const columnId = task.column_id;
  db.prepare('DELETE FROM tasks WHERE id = ?').run(task.id);
  const reindex = db.transaction(() => {
    columnOrder(columnId).forEach((id, i) => db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(i, id));
  });
  reindex();
  realtime.broadcast(task.project_id, 'task:deleted', { by: req.user.id, id: task.id, columnId, order: columnOrder(columnId) });
  res.json({ ok: true });
});

router.put('/:id/move', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!memberGuard(req, res, task.project_id)) return;
  const toColumn = getColumn(req.body.columnId);
  if (!toColumn || toColumn.project_id !== task.project_id) return res.status(400).json({ error: 'Invalid destination column.' });
  const index = Number.isInteger(req.body.index) ? req.body.index : 0;
  const fromColumnId = task.column_id;

  const move = db.transaction(() => {
    let dest = db
      .prepare('SELECT id FROM tasks WHERE column_id = ? AND id <> ? ORDER BY position ASC, id ASC')
      .all(toColumn.id, task.id)
      .map((r) => r.id);
    const idx = Math.max(0, Math.min(index, dest.length));
    dest.splice(idx, 0, task.id);

    let completed = task.completed;
    if (toColumn.id !== fromColumnId) {
      if (DONE_RE.test(toColumn.name)) completed = 1;
      else if (DONE_RE.test(getColumn(fromColumnId)?.name || '')) completed = 0;
    }
    db.prepare("UPDATE tasks SET column_id = ?, completed = ?, updated_at = datetime('now') WHERE id = ?").run(toColumn.id, completed, task.id);
    dest.forEach((id, i) => db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(i, id));
    if (toColumn.id !== fromColumnId) {
      columnOrder(fromColumnId).forEach((id, i) => db.prepare('UPDATE tasks SET position = ? WHERE id = ?').run(i, id));
    }
  });
  move();

  const updated = serializeTask(getTask(task.id));
  if (toColumn.id !== fromColumnId) {
    logActivity({ projectId: task.project_id, taskId: task.id, userId: req.user.id, type: 'moved', detail: `${updated.title} → ${toColumn.name}` });
  }
  realtime.broadcast(task.project_id, 'task:moved', {
    by: req.user.id,
    task: updated,
    fromColumnId,
    affected: [
      { columnId: toColumn.id, order: columnOrder(toColumn.id) },
      ...(toColumn.id !== fromColumnId ? [{ columnId: fromColumnId, order: columnOrder(fromColumnId) }] : []),
    ],
  });
  res.json({ task: updated });
});

router.get('/:id/comments', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!memberGuard(req, res, task.project_id)) return;
  const comments = db.prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY id ASC').all(task.id).map(serializeComment);
  res.json({ comments });
});

router.post('/:id/comments', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!memberGuard(req, res, task.project_id)) return;
  const body = (req.body.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Comment cannot be empty.' });
  if (body.length > 1000) return res.status(400).json({ error: 'Comment is too long.' });

  const info = db.prepare('INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)').run(task.id, req.user.id, body);
  const comment = serializeComment(db.prepare('SELECT * FROM task_comments WHERE id = ?').get(info.lastInsertRowid));
  logActivity({ projectId: task.project_id, taskId: task.id, userId: req.user.id, type: 'comment', detail: task.title });

  const recipients = new Set();
  if (task.assignee_id) recipients.add(task.assignee_id);
  if (task.creator_id) recipients.add(task.creator_id);
  const mentions = body.match(/@([a-zA-Z0-9_]{3,20})/g) || [];
  mentions.forEach((m) => {
    const u = db.prepare('SELECT id FROM users WHERE username = ?').get(m.slice(1).toLowerCase());
    if (u && isMember(task.project_id, u.id)) recipients.add(u.id);
  });
  recipients.forEach((uid) => {
    notify({ userId: uid, actorId: req.user.id, type: 'comment', projectId: task.project_id, taskId: task.id, detail: task.title });
  });

  realtime.broadcast(task.project_id, 'comment:created', { by: req.user.id, taskId: task.id, comment });
  res.status(201).json({ comment });
});

router.delete('/:id/comments/:cid', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  if (!memberGuard(req, res, task.project_id)) return;
  const comment = db.prepare('SELECT * FROM task_comments WHERE id = ? AND task_id = ?').get(Number(req.params.cid), task.id);
  if (!comment) return res.status(404).json({ error: 'Comment not found.' });
  if (comment.user_id !== req.user.id) return res.status(403).json({ error: 'You can only delete your own comments.' });
  db.prepare('DELETE FROM task_comments WHERE id = ?').run(comment.id);
  realtime.broadcast(task.project_id, 'comment:deleted', { by: req.user.id, taskId: task.id, commentId: comment.id });
  res.json({ ok: true });
});

module.exports = router;

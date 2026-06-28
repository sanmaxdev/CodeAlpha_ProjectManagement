'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { getProject, roleOf, isMember, canManage } = require('../access');
const {
  serializeProject, serializeColumn, serializeTask, serializeActivity, projectMembers,
} = require('../serialize');
const realtime = require('../realtime');
const { logActivity, notify } = require('../notify');

const router = express.Router();

const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'In Review', 'Done'];

router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.* FROM projects p
       JOIN project_members m ON m.project_id = p.id
       WHERE m.user_id = ?
       ORDER BY p.created_at DESC`
    )
    .all(req.user.id);
  res.json({ projects: rows.map((p) => serializeProject(p, req.user.id)) });
});

router.post('/', (req, res) => {
  const name = (req.body.name || '').trim();
  const description = (req.body.description || '').trim();
  const color = (req.body.color || 'iris').trim();
  let code = (req.body.code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
  if (!name) return res.status(400).json({ error: 'Project name is required.' });
  if (name.length > 80) return res.status(400).json({ error: 'Project name is too long.' });
  if (!code) code = name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'PRJ';

  const create = db.transaction(() => {
    const info = db
      .prepare('INSERT INTO projects (name, code, description, color, owner_id) VALUES (?, ?, ?, ?, ?)')
      .run(name, code, description, color, req.user.id);
    const projectId = info.lastInsertRowid;
    db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(projectId, req.user.id, 'owner');
    DEFAULT_COLUMNS.forEach((cn, i) => {
      db.prepare('INSERT INTO columns (project_id, name, position) VALUES (?, ?, ?)').run(projectId, cn, i);
    });
    return projectId;
  });
  const projectId = create();
  const project = getProject(projectId);
  logActivity({ projectId, userId: req.user.id, type: 'project_created', detail: name });
  res.status(201).json({ project: serializeProject(project, req.user.id) });
});

router.get('/:projectId', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (!isMember(project.id, req.user.id)) return res.status(403).json({ error: 'You are not a member of this project.' });

  const columns = db.prepare('SELECT * FROM columns WHERE project_id = ? ORDER BY position ASC, id ASC').all(project.id);
  const tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC, id ASC').all(project.id);
  res.json({
    project: serializeProject(project, req.user.id),
    columns: columns.map(serializeColumn),
    tasks: tasks.map(serializeTask),
  });
});

router.put('/:projectId', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const role = roleOf(project.id, req.user.id);
  if (!canManage(role)) return res.status(403).json({ error: 'Only project admins can edit project settings.' });

  const name = (req.body.name || project.name).trim();
  const description = req.body.description !== undefined ? String(req.body.description).trim() : project.description;
  const color = (req.body.color || project.color).trim();
  if (!name) return res.status(400).json({ error: 'Project name is required.' });

  db.prepare('UPDATE projects SET name = ?, description = ?, color = ? WHERE id = ?').run(name, description, color, project.id);
  const updated = serializeProject(getProject(project.id), req.user.id);
  realtime.broadcast(project.id, 'project:updated', updated);
  res.json({ project: updated });
});

router.delete('/:projectId', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (project.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can delete this project.' });
  db.prepare('DELETE FROM projects WHERE id = ?').run(project.id);
  realtime.broadcast(project.id, 'project:deleted', { id: project.id });
  res.json({ ok: true });
});

router.get('/:projectId/activity', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (!isMember(project.id, req.user.id)) return res.status(403).json({ error: 'You are not a member of this project.' });
  const rows = db.prepare('SELECT * FROM activity WHERE project_id = ? ORDER BY id DESC LIMIT 40').all(project.id);
  res.json({ activity: rows.map(serializeActivity) });
});

router.get('/:projectId/members', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (!isMember(project.id, req.user.id)) return res.status(403).json({ error: 'You are not a member of this project.' });
  res.json({ members: projectMembers(project.id) });
});

router.post('/:projectId/members', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const role = roleOf(project.id, req.user.id);
  if (!canManage(role)) return res.status(403).json({ error: 'Only project admins can add members.' });

  const identifier = (req.body.identifier || '').trim().toLowerCase();
  if (!identifier) return res.status(400).json({ error: 'Enter a username or email.' });
  const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(identifier, identifier);
  if (!user) return res.status(404).json({ error: 'No user found with that username or email.' });
  if (isMember(project.id, user.id)) return res.status(409).json({ error: 'That person is already a member.' });

  db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)').run(project.id, user.id, 'member');
  logActivity({ projectId: project.id, userId: req.user.id, type: 'member_added', detail: user.name });
  notify({ userId: user.id, actorId: req.user.id, type: 'member_added', projectId: project.id, detail: project.name });
  const members = projectMembers(project.id);
  realtime.broadcast(project.id, 'member:added', { projectId: project.id, members });
  res.status(201).json({ members });
});

router.put('/:projectId/members/:userId', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  if (project.owner_id !== req.user.id) return res.status(403).json({ error: 'Only the owner can change roles.' });
  const targetId = Number(req.params.userId);
  const newRole = req.body.role === 'admin' ? 'admin' : 'member';
  if (targetId === project.owner_id) return res.status(400).json({ error: 'The owner role cannot be changed.' });
  if (!isMember(project.id, targetId)) return res.status(404).json({ error: 'That person is not a member.' });
  db.prepare('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?').run(newRole, project.id, targetId);
  const members = projectMembers(project.id);
  realtime.broadcast(project.id, 'member:updated', { projectId: project.id, members });
  res.json({ members });
});

router.delete('/:projectId/members/:userId', (req, res) => {
  const project = getProject(req.params.projectId);
  if (!project) return res.status(404).json({ error: 'Project not found.' });
  const targetId = Number(req.params.userId);
  const role = roleOf(project.id, req.user.id);
  const isSelf = targetId === req.user.id;
  if (!isSelf && !canManage(role)) return res.status(403).json({ error: 'Only project admins can remove members.' });
  if (targetId === project.owner_id) return res.status(400).json({ error: 'The owner cannot be removed.' });
  if (!isMember(project.id, targetId)) return res.status(404).json({ error: 'That person is not a member.' });

  db.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?').run(project.id, targetId);
  db.prepare('UPDATE tasks SET assignee_id = NULL WHERE project_id = ? AND assignee_id = ?').run(project.id, targetId);
  const members = projectMembers(project.id);
  realtime.broadcast(project.id, 'member:removed', { projectId: project.id, userId: targetId, members });
  res.json({ members });
});

module.exports = router;

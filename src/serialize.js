'use strict';

const db = require('./db');

function userMini(id) {
  if (!id) return null;
  const u = db.prepare('SELECT id, name, username, avatar, title FROM users WHERE id = ?').get(id);
  return u || null;
}

function memberRole(projectId, userId) {
  const row = db
    .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);
  return row ? row.role : null;
}

function projectMembers(projectId) {
  return db
    .prepare(
      `SELECT u.id, u.name, u.username, u.avatar, u.title, m.role
       FROM project_members m JOIN users u ON u.id = m.user_id
       WHERE m.project_id = ?
       ORDER BY (m.role = 'owner') DESC, u.name ASC`
    )
    .all(projectId);
}

function serializeProject(p, userId) {
  const taskCount = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE project_id = ?').get(p.id).c;
  const doneCount = db.prepare('SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND completed = 1').get(p.id).c;
  const members = projectMembers(p.id);
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    description: p.description,
    color: p.color,
    owner: userMini(p.owner_id),
    createdAt: p.created_at,
    members,
    counts: { tasks: taskCount, done: doneCount, members: members.length },
    myRole: userId ? memberRole(p.id, userId) : null,
  };
}

function serializeColumn(c) {
  return { id: c.id, projectId: c.project_id, name: c.name, position: c.position };
}

function serializeTask(t) {
  let labels = [];
  try { labels = JSON.parse(t.labels || '[]'); } catch (e) {}
  const commentCount = db.prepare('SELECT COUNT(*) AS c FROM task_comments WHERE task_id = ?').get(t.id).c;
  return {
    id: t.id,
    projectId: t.project_id,
    columnId: t.column_id,
    title: t.title,
    description: t.description,
    position: t.position,
    priority: t.priority,
    labels,
    dueDate: t.due_date,
    completed: !!t.completed,
    assignee: userMini(t.assignee_id),
    creator: userMini(t.creator_id),
    commentCount,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  };
}

function serializeComment(c) {
  return { id: c.id, taskId: c.task_id, body: c.body, createdAt: c.created_at, author: userMini(c.user_id) };
}

function serializeActivity(a) {
  return {
    id: a.id,
    type: a.type,
    detail: a.detail,
    taskId: a.task_id,
    createdAt: a.created_at,
    user: userMini(a.user_id),
  };
}

function serializeNotification(n) {
  const project = n.project_id
    ? db.prepare('SELECT id, name, code, color FROM projects WHERE id = ?').get(n.project_id)
    : null;
  return {
    id: n.id,
    type: n.type,
    detail: n.detail,
    createdAt: n.created_at,
    read: !!n.read_at,
    actor: userMini(n.actor_id),
    projectId: n.project_id,
    taskId: n.task_id,
    project,
  };
}

module.exports = {
  userMini,
  memberRole,
  projectMembers,
  serializeProject,
  serializeColumn,
  serializeTask,
  serializeComment,
  serializeActivity,
  serializeNotification,
};

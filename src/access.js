'use strict';

const db = require('./db');

function getProject(id) {
  return db.prepare('SELECT * FROM projects WHERE id = ?').get(Number(id));
}

function roleOf(projectId, userId) {
  const r = db
    .prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(Number(projectId), userId);
  return r ? r.role : null;
}

function isMember(projectId, userId) {
  return !!roleOf(projectId, userId);
}

const canManage = (role) => role === 'owner' || role === 'admin';

module.exports = { getProject, roleOf, isMember, canManage };

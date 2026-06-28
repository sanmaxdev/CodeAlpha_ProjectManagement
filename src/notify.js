'use strict';

const db = require('./db');
const realtime = require('./realtime');
const { serializeNotification, serializeActivity } = require('./serialize');

function logActivity({ projectId, taskId = null, userId, type, detail = '' }) {
  const info = db
    .prepare('INSERT INTO activity (project_id, task_id, user_id, type, detail) VALUES (?, ?, ?, ?, ?)')
    .run(projectId, taskId, userId, type, detail);
  const row = db.prepare('SELECT * FROM activity WHERE id = ?').get(info.lastInsertRowid);
  realtime.broadcast(projectId, 'activity', serializeActivity(row));
  return row;
}

function notify({ userId, actorId, type, projectId = null, taskId = null, detail = '' }) {
  if (!userId || userId === actorId) return null;
  const info = db
    .prepare('INSERT INTO notifications (user_id, actor_id, type, project_id, task_id, detail) VALUES (?, ?, ?, ?, ?, ?)')
    .run(userId, actorId, type, projectId, taskId, detail);
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(info.lastInsertRowid);
  const payload = serializeNotification(row);
  realtime.toUser(userId, 'notification', payload);
  realtime.toUser(userId, 'unread', { unread: unreadCount(userId) });
  return row;
}

function unreadCount(userId) {
  return db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL').get(userId).c;
}

module.exports = { logActivity, notify, unreadCount };

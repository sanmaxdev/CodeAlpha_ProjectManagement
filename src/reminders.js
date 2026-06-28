'use strict';

const db = require('./db');
const { notify } = require('./notify');

function runDueCheck() {
  const rows = db
    .prepare(
      `SELECT * FROM tasks
       WHERE completed = 0 AND assignee_id IS NOT NULL
         AND due_date IS NOT NULL AND date(due_date) <= date('now', '+1 day')`
    )
    .all();
  let created = 0;
  for (const t of rows) {
    const exists = db
      .prepare("SELECT 1 FROM notifications WHERE user_id = ? AND task_id = ? AND type = 'due_soon'")
      .get(t.assignee_id, t.id);
    if (exists) continue;
    const overdue = db.prepare("SELECT date(?) < date('now') AS o").get(t.due_date).o;
    notify({
      userId: t.assignee_id,
      actorId: null,
      type: 'due_soon',
      projectId: t.project_id,
      taskId: t.id,
      detail: t.title + (overdue ? ' is overdue' : ' is due soon'),
    });
    created += 1;
  }
  return created;
}

function start() {
  setTimeout(runDueCheck, 3000);
  setInterval(runDueCheck, 30 * 60 * 1000);
}

module.exports = { start, runDueCheck };

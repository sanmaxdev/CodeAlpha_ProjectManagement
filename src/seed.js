'use strict';

const bcrypt = require('bcryptjs');
const db = require('./db');

function dayOffset(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

module.exports = function seed() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;

  const hash = bcrypt.hashSync('cadence1234', 10);
  const insertUser = db.prepare(
    'INSERT INTO users (name, username, email, password_hash, title, avatar) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const u = {};
  const people = [
    ['Demo User', 'demo', 'demo@cadence.app', 'Product Manager', 'https://i.pravatar.cc/240?img=12'],
    ['Ava Reyes', 'ava', 'ava@cadence.app', 'Product Designer', 'https://i.pravatar.cc/240?img=45'],
    ['Noah Kim', 'noah', 'noah@cadence.app', 'Frontend Engineer', 'https://i.pravatar.cc/240?img=33'],
    ['Mia Santos', 'mia', 'mia@cadence.app', 'Backend Engineer', 'https://i.pravatar.cc/240?img=32'],
    ['Liam Walsh', 'liam', 'liam@cadence.app', 'QA Engineer', 'https://i.pravatar.cc/240?img=68'],
    ['Emma Cole', 'emma', 'emma@cadence.app', 'Marketing Lead', 'https://i.pravatar.cc/240?img=24'],
  ];
  people.forEach(([name, username, email, title, avatar]) => {
    u[username] = insertUser.run(name, username, email, hash, title, avatar).lastInsertRowid;
  });

  const insertProject = db.prepare('INSERT INTO projects (name, code, description, color, owner_id) VALUES (?, ?, ?, ?, ?)');
  const insertMember = db.prepare('INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)');
  const insertColumn = db.prepare('INSERT INTO columns (project_id, name, position) VALUES (?, ?, ?)');
  const insertTask = db.prepare(
    `INSERT INTO tasks (project_id, column_id, title, description, position, assignee_id, creator_id, priority, labels, due_date, completed)
     VALUES (@project_id, @column_id, @title, @description, @position, @assignee_id, @creator_id, @priority, @labels, @due_date, @completed)`
  );
  const insertComment = db.prepare('INSERT INTO task_comments (task_id, user_id, body) VALUES (?, ?, ?)');
  const insertActivity = db.prepare('INSERT INTO activity (project_id, task_id, user_id, type, detail) VALUES (?, ?, ?, ?, ?)');
  const insertNotif = db.prepare('INSERT INTO notifications (user_id, actor_id, type, project_id, task_id, detail) VALUES (?, ?, ?, ?, ?, ?)');

  function project(name, code, description, color, ownerKey, memberKeys) {
    const id = insertProject.run(name, code, description, color, u[ownerKey]).lastInsertRowid;
    insertMember.run(id, u[ownerKey], 'owner');
    memberKeys.forEach((k) => { if (k !== ownerKey) insertMember.run(id, u[k], 'member'); });
    const cols = {};
    ['To Do', 'In Progress', 'In Review', 'Done'].forEach((n, i) => {
      const cid = insertColumn.run(id, n, i).lastInsertRowid;
      cols[['todo', 'prog', 'review', 'done'][i]] = cid;
    });
    return { id, cols };
  }

  const pos = {};
  function task(projectId, columnId, title, opts = {}) {
    pos[columnId] = (pos[columnId] || 0);
    const done = opts.done ? 1 : 0;
    const id = insertTask.run({
      project_id: projectId,
      column_id: columnId,
      title,
      description: opts.desc || '',
      position: pos[columnId]++,
      assignee_id: opts.assignee ? u[opts.assignee] : null,
      creator_id: u[opts.by || 'demo'],
      priority: opts.priority || 'medium',
      labels: JSON.stringify(opts.labels || []),
      due_date: opts.due || null,
      completed: done,
    }).lastInsertRowid;
    return id;
  }

  // Project 1 — Mobile App Launch
  const mob = project('Mobile App Launch', 'MOB', 'Ship the v1 iOS and Android apps for the public beta.', 'iris', 'demo', ['demo', 'ava', 'noah', 'mia', 'liam']);
  task(mob.id, mob.cols.todo, 'Design empty states for the feed', { assignee: 'ava', priority: 'medium', labels: ['design'], due: dayOffset(5) });
  task(mob.id, mob.cols.todo, 'Set up push notifications', { assignee: 'mia', priority: 'high', labels: ['backend', 'infra'], due: dayOffset(7), desc: 'APNs + FCM, behind a feature flag.' });
  task(mob.id, mob.cols.todo, 'Research analytics SDKs', { assignee: 'demo', priority: 'low', labels: ['research'], due: dayOffset(1) });
  const feedTask = task(mob.id, mob.cols.prog, 'Build feed infinite scroll', { assignee: 'noah', priority: 'high', labels: ['frontend'], due: dayOffset(3), desc: 'Cursor-based pagination, prefetch next page at 80% scroll.' });
  task(mob.id, mob.cols.prog, 'Implement auth with refresh tokens', { assignee: 'mia', priority: 'high', labels: ['backend'], due: dayOffset(2) });
  task(mob.id, mob.cols.review, 'Profile screen layout', { assignee: 'ava', priority: 'medium', labels: ['design', 'frontend'], due: dayOffset(-1) });
  const crashTask = task(mob.id, mob.cols.review, 'Crash on cold start (Android)', { assignee: 'liam', priority: 'urgent', labels: ['bug'], desc: 'Reproducible on first launch after install.' });
  task(mob.id, mob.cols.done, 'Project scaffolding', { assignee: 'noah', by: 'noah', done: true });
  task(mob.id, mob.cols.done, 'Choose state management', { assignee: 'demo', done: true });
  task(mob.id, mob.cols.done, 'Design system tokens', { assignee: 'ava', by: 'ava', done: true, labels: ['design'] });

  insertComment.run(feedTask, u.noah, 'Pagination cursor is wired up, just polishing the loader animation.');
  insertComment.run(feedTask, u.demo, 'Nice work. Let’s cap the page size at 20 for now.');
  insertComment.run(crashTask, u.liam, 'Repro on a Pixel 6, stack trace points at session bootstrap.');
  insertComment.run(crashTask, u.mia, 'Looks like a null when the cached token is missing — on it.');

  // Project 2 — Website Redesign
  const web = project('Website Redesign', 'WEB', 'A full marketing site refresh ahead of the launch.', 'emerald', 'ava', ['ava', 'demo', 'noah', 'emma']);
  task(web.id, web.cols.todo, 'Audit current Lighthouse scores', { assignee: 'noah', by: 'ava', priority: 'medium', labels: ['frontend', 'research'] });
  const heroTask = task(web.id, web.cols.todo, 'New hero concepts', { assignee: 'ava', by: 'ava', priority: 'high', labels: ['design'], due: dayOffset(4) });
  task(web.id, web.cols.prog, 'Rebuild nav as a sticky header', { assignee: 'noah', by: 'ava', priority: 'medium', labels: ['frontend'], due: dayOffset(3) });
  task(web.id, web.cols.prog, 'Homepage copy refresh', { assignee: 'emma', by: 'ava', priority: 'medium', labels: ['copy'] });
  task(web.id, web.cols.review, 'Pricing page redesign', { assignee: 'ava', by: 'ava', priority: 'high', labels: ['design'], due: dayOffset(1) });
  task(web.id, web.cols.done, 'Content inventory', { assignee: 'emma', by: 'emma', done: true });
  task(web.id, web.cols.done, 'Choose typeface pairing', { assignee: 'ava', by: 'ava', done: true, labels: ['design'] });
  insertComment.run(heroTask, u.demo, 'Love direction B — can we try a darker variant?');

  // Project 3 — Q3 Marketing
  const mkt = project('Q3 Marketing', 'MKT', 'Campaign planning and content for the third quarter.', 'amber', 'emma', ['emma', 'demo']);
  task(mkt.id, mkt.cols.todo, 'Plan the launch webinar', { assignee: 'emma', by: 'emma', priority: 'medium' });
  task(mkt.id, mkt.cols.todo, 'Draft the email sequence', { assignee: 'emma', by: 'emma', priority: 'high', labels: ['copy'], due: dayOffset(6) });
  task(mkt.id, mkt.cols.prog, 'Partner outreach list', { assignee: 'demo', by: 'emma', priority: 'low', labels: ['research'], due: dayOffset(-1) });
  task(mkt.id, mkt.cols.done, 'Q2 retro write-up', { assignee: 'emma', by: 'emma', done: true });

  const activity = [
    [mob.id, feedTask, u.noah, 'comment', 'Build feed infinite scroll'],
    [mob.id, crashTask, u.liam, 'task_created', 'Crash on cold start (Android)'],
    [mob.id, null, u.demo, 'member_added', 'Liam Walsh'],
    [web.id, heroTask, u.demo, 'comment', 'New hero concepts'],
    [web.id, null, u.ava, 'project_created', 'Website Redesign'],
    [mkt.id, null, u.emma, 'member_added', 'Demo User'],
  ];
  activity.forEach(([p, t, user, type, detail]) => insertActivity.run(p, t, user, type, detail));

  const notifs = [
    [u.demo, u.ava, 'assigned', web.id, heroTask, 'New hero concepts'],
    [u.demo, u.noah, 'comment', mob.id, feedTask, 'Build feed infinite scroll'],
    [u.demo, u.emma, 'member_added', mkt.id, null, 'Q3 Marketing'],
    [u.demo, u.liam, 'comment', mob.id, crashTask, 'Crash on cold start (Android)'],
    [u.demo, u.mia, 'assigned', mob.id, null, 'Research analytics SDKs'],
  ];
  notifs.forEach(([uid, actor, type, p, t, detail]) => insertNotif.run(uid, actor, type, p, t, detail));

  console.log('  Seeded Cadence: 6 users, 3 projects, demo@cadence.app / cadence1234');
};

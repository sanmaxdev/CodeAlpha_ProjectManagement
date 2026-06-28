'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');
const { serializeNotification } = require('../serialize');
const { unreadCount } = require('../notify');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 40').all(req.user.id);
  res.json({ notifications: rows.map(serializeNotification), unread: unreadCount(req.user.id) });
});

router.get('/unread', (req, res) => {
  res.json({ unread: unreadCount(req.user.id) });
});

router.post('/read', (req, res) => {
  if (req.body.id) {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ? AND user_id = ? AND read_at IS NULL").run(Number(req.body.id), req.user.id);
  } else {
    db.prepare("UPDATE notifications SET read_at = datetime('now') WHERE user_id = ? AND read_at IS NULL").run(req.user.id);
  }
  res.json({ unread: unreadCount(req.user.id) });
});

module.exports = router;

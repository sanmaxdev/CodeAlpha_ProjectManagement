'use strict';

const express = require('express');
const db = require('../db');
const { requireAuth } = require('../auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const q = (req.query.search || '').trim();
  let rows;
  if (q) {
    rows = db
      .prepare(
        `SELECT id, name, username, avatar, title FROM users
         WHERE username LIKE @q OR name LIKE @q OR email LIKE @q
         ORDER BY name ASC LIMIT 12`
      )
      .all({ q: `%${q}%` });
  } else {
    rows = db.prepare('SELECT id, name, username, avatar, title FROM users ORDER BY name ASC LIMIT 12').all();
  }
  res.json({ users: rows });
});

module.exports = router;

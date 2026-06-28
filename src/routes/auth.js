'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { signToken, publicUser, requireAuth } = require('../auth');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

const AVATARS = [
  'https://i.pravatar.cc/240?img=12',
  'https://i.pravatar.cc/240?img=32',
  'https://i.pravatar.cc/240?img=45',
  'https://i.pravatar.cc/240?img=5',
  'https://i.pravatar.cc/240?img=68',
  'https://i.pravatar.cc/240?img=24',
];

router.post('/register', (req, res) => {
  const name = (req.body.name || '').trim();
  const username = (req.body.username || '').trim().toLowerCase();
  const email = (req.body.email || '').trim().toLowerCase();
  const password = req.body.password || '';
  const title = (req.body.title || '').trim();

  if (!name || !username || !email || !password) {
    return res.status(400).json({ error: 'All fields are required.' });
  }
  if (!USERNAME_RE.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 letters, numbers, or underscores.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  }
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    return res.status(409).json({ error: 'That username is taken.' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(409).json({ error: 'An account with that email already exists.' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const avatar = AVATARS[Math.floor(Math.random() * AVATARS.length)];
  const info = db
    .prepare('INSERT INTO users (name, username, email, password_hash, title, avatar) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, username, email, hash, title, avatar);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  res.status(201).json({ token: signToken(user), user: publicUser(user) });
});

router.post('/login', (req, res) => {
  const identifier = (req.body.identifier || '').trim().toLowerCase();
  const password = req.body.password || '';
  if (!identifier || !password) {
    return res.status(400).json({ error: 'Enter your email or username and password.' });
  }
  const user = db
    .prepare('SELECT * FROM users WHERE email = ? OR username = ?')
    .get(identifier, identifier);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Incorrect login details.' });
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

router.put('/me', requireAuth, (req, res) => {
  const name = (req.body.name || '').trim();
  const title = (req.body.title || '').trim();
  const avatar = (req.body.avatar || '').trim();
  if (!name) return res.status(400).json({ error: 'Name cannot be empty.' });
  if (title.length > 60) return res.status(400).json({ error: 'Title is too long.' });

  db.prepare('UPDATE users SET name = ?, title = ?, avatar = ? WHERE id = ?').run(
    name, title, avatar, req.user.id
  );
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  res.json({ user: publicUser(user) });
});

module.exports = router;

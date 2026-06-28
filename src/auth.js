'use strict';

const jwt = require('jsonwebtoken');
const db = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

function signToken(user) {
  return jwt.sign({ sub: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    title: user.title,
    createdAt: user.created_at,
  };
}

function userFromJwt(token) {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.sub) || null;
  } catch (err) {
    return null;
  }
}

function userFromToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? userFromJwt(header.slice(7)) : null;
}

function requireAuth(req, res, next) {
  if (!(req.headers.authorization || '').startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Please log in to continue.' });
  }
  const user = userFromToken(req);
  if (!user) {
    return res.status(401).json({ error: 'Your session has expired. Please log in again.' });
  }
  req.user = user;
  next();
}

function optionalAuth(req, res, next) {
  req.user = userFromToken(req);
  next();
}

module.exports = { signToken, publicUser, requireAuth, optionalAuth, userFromJwt, JWT_SECRET };

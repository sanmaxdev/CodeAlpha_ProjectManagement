'use strict';

const { WebSocketServer } = require('ws');
const url = require('url');
const db = require('./db');
const { userFromJwt } = require('./auth');

const rooms = new Map();      // projectId -> Set<ws>
const userSockets = new Map(); // userId -> Set<ws>

let wss = null;

function addTo(map, key, ws) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(ws);
}

function removeFrom(map, key, ws) {
  const set = map.get(key);
  if (!set) return;
  set.delete(ws);
  if (!set.size) map.delete(key);
}

function isMember(projectId, userId) {
  return !!db
    .prepare('SELECT 1 FROM project_members WHERE project_id = ? AND user_id = ?')
    .get(projectId, userId);
}

function send(ws, event, data) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ event, data }));
  }
}

function broadcast(projectId, event, data, exceptWs) {
  const set = rooms.get(Number(projectId));
  if (!set) return;
  for (const ws of set) {
    if (ws !== exceptWs) send(ws, event, data);
  }
}

function toUser(userId, event, data) {
  const set = userSockets.get(Number(userId));
  if (!set) return;
  for (const ws of set) send(ws, event, data);
}

function presenceList(projectId) {
  const set = rooms.get(Number(projectId));
  if (!set) return [];
  const seen = new Map();
  for (const ws of set) {
    if (!seen.has(ws.userId)) {
      seen.set(ws.userId, { id: ws.userId, name: ws.user.name, username: ws.user.username, avatar: ws.user.avatar });
    }
  }
  return [...seen.values()];
}

function emitPresence(projectId) {
  broadcast(projectId, 'presence', { projectId: Number(projectId), users: presenceList(projectId) });
}

function joinRoom(ws, projectId) {
  projectId = Number(projectId);
  if (!isMember(projectId, ws.userId)) {
    send(ws, 'error', { message: 'Not a member of this project.' });
    return;
  }
  if (ws.projectId && ws.projectId !== projectId) leaveRoom(ws);
  ws.projectId = projectId;
  addTo(rooms, projectId, ws);
  emitPresence(projectId);
}

function leaveRoom(ws) {
  if (!ws.projectId) return;
  const pid = ws.projectId;
  removeFrom(rooms, pid, ws);
  ws.projectId = null;
  emitPresence(pid);
}

function init(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const { pathname, query } = url.parse(req.url, true);
    if (pathname !== '/ws') return;
    const user = userFromJwt(query.token);
    if (!user) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.userId = user.id;
      ws.user = { id: user.id, name: user.name, username: user.username, avatar: user.avatar };
      ws.isAlive = true;
      ws.projectId = null;
      addTo(userSockets, user.id, ws);
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws) => {
    send(ws, 'ready', { userId: ws.userId });

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch (e) { return; }
      if (msg.type === 'join' && msg.projectId) joinRoom(ws, msg.projectId);
      else if (msg.type === 'leave') leaveRoom(ws);
      else if (msg.type === 'ping') send(ws, 'pong', {});
    });

    ws.on('close', () => {
      leaveRoom(ws);
      removeFrom(userSockets, ws.userId, ws);
    });
  });

  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeat));
}

module.exports = { init, broadcast, toUser, emitPresence };

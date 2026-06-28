'use strict';

require('dotenv').config();

const path = require('path');
const http = require('http');
const express = require('express');

const seed = require('./src/seed');
const realtime = require('./src/realtime');
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/users');
const projectRoutes = require('./src/routes/projects');
const columnRoutes = require('./src/routes/columns');
const taskRoutes = require('./src/routes/tasks');
const notificationRoutes = require('./src/routes/notifications');

seed();

const app = express();
const PORT = process.env.PORT || 4200;

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/columns', columnRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/api', (req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our end.' });
});

const server = http.createServer(app);
realtime.init(server);

server.listen(PORT, () => {
  console.log(`\n  Cadence running at http://localhost:${PORT}\n`);
});

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load backend/.env automatically (Node 20.6+); safe no-op if missing.
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path.join(__dirname, '.env'));
  }
} catch {
  // ignore
}

import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import authRoutes from './src/routes/auth.js';
import gameRoutes from './src/routes/games.js';
import questionRoutes from './src/routes/questions.js';
import configRoutes from './src/routes/config.js';

import { setupSocketHandlers } from './src/sockets/gameHandlers.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  // Faster disconnect detection so players turn "offline" quickly.
  pingInterval: 5000,
  pingTimeout: 6000,
});

// Middleware
app.use(cors());
app.use(express.json());

// Routes (ставим выше, чтобы SPA не перехватывала /api/*)
app.use('/api/auth', authRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/config', configRoutes);

// Socket.io
setupSocketHandlers(io);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve frontend (после API, чтобы SPA не забирала /api/*)
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));
app.get('*', (req, res) => {
  // Avoid stale SPA shell when deploying new hashed assets
  res.set('Cache-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`🚀 QUIZZY Backend running on port ${PORT}`);
});

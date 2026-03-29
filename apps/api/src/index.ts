import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initDb } from './db/schema.js';
import { simulationsRouter } from './routes/simulations.js';
import { authRouter } from './routes/auth.js';
import { usersRouter } from './routes/users.js';
import { classroomsRouter } from './routes/classrooms.js';
import { economyRouter } from './routes/economy.js';

// Initialize database + auto-seed if empty
initDb();

import { getDb } from './db/schema.js';
const _db = getDb();
const count = (_db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c;
_db.close();
if (count === 0) {
  console.log('Empty database detected, seeding...');
  await import('./db/seed.js');
}

const app = new Hono();

// CORS for frontend apps
app.use('*', cors({
  origin: ['http://localhost:4000', 'http://localhost:4001', 'http://localhost:3000', 'https://marketplace-sigma-ebon.vercel.app'],
  credentials: true,
}));

// Health check
app.get('/', (c) => c.json({
  name: 'Problocks API',
  version: '0.0.1',
  status: 'running',
}));

// Routes
app.route('/api/auth', authRouter);
app.route('/api/simulations', simulationsRouter);
app.route('/api/users', usersRouter);
app.route('/api/classrooms', classroomsRouter);
app.route('/api/economy', economyRouter);

// Start server
const PORT = parseInt(process.env.PORT ?? '5000', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
console.log(`Problocks API running at http://${HOST}:${PORT}`);

serve({ fetch: app.fetch, port: PORT, hostname: HOST });

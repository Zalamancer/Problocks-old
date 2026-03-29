import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { initDb } from './db/schema.js';
import { simulationsRouter } from './routes/simulations.js';
import { authRouter } from './routes/auth.js';

// Initialize database
initDb();

const app = new Hono();

// CORS for frontend apps
app.use('*', cors({
  origin: ['http://localhost:4000', 'http://localhost:4001', 'http://localhost:3000'],
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

// Start server
const PORT = parseInt(process.env.PORT ?? '5000', 10);
console.log(`Problocks API running at http://localhost:${PORT}`);

serve({ fetch: app.fetch, port: PORT });

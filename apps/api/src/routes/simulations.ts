import { Hono } from 'hono';
import { getDb } from '../db/schema.js';
import { nanoid } from 'nanoid';

export const simulationsRouter = new Hono();

// GET /simulations — list all (with optional category filter)
simulationsRouter.get('/', (c) => {
  const db = getDb();
  const category = c.req.query('category');
  const search = c.req.query('search');
  const sort = c.req.query('sort') ?? 'plays';
  const limit = parseInt(c.req.query('limit') ?? '20', 10);

  let query = `
    SELECT s.*, u.username, u.display_name as author_name
    FROM simulations s
    JOIN users u ON s.user_id = u.id
    WHERE s.status = 'published'
  `;
  const params: unknown[] = [];

  if (category && category !== 'all') {
    query += ` AND s.category = ?`;
    params.push(category);
  }

  if (search) {
    query += ` AND (s.name LIKE ? OR s.description LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  if (sort === 'plays') query += ` ORDER BY s.plays DESC`;
  else if (sort === 'rating') query += ` ORDER BY (s.rating_sum / MAX(s.rating_count, 1)) DESC`;
  else if (sort === 'newest') query += ` ORDER BY s.created_at DESC`;

  query += ` LIMIT ?`;
  params.push(limit);

  const sims = db.prepare(query).all(...params);
  db.close();

  return c.json({
    simulations: sims.map((s: any) => ({
      ...s,
      rating: s.rating_count > 0 ? (s.rating_sum / s.rating_count).toFixed(1) : null,
      capabilities: JSON.parse(s.capabilities),
    })),
  });
});

// GET /simulations/:slug — get single simulation
simulationsRouter.get('/:slug', (c) => {
  const db = getDb();
  const slug = c.req.param('slug');

  const sim: any = db.prepare(`
    SELECT s.*, u.username, u.display_name as author_name, u.bio as author_bio
    FROM simulations s
    JOIN users u ON s.user_id = u.id
    WHERE s.slug = ?
  `).get(slug);

  if (!sim) {
    db.close();
    return c.json({ error: 'Simulation not found' }, 404);
  }

  // Get versions
  const versions = db.prepare(
    `SELECT version, changelog, created_at FROM simulation_versions WHERE simulation_id = ? ORDER BY created_at DESC`,
  ).all(sim.id);

  db.close();

  return c.json({
    simulation: {
      ...sim,
      rating: sim.rating_count > 0 ? (sim.rating_sum / sim.rating_count).toFixed(1) : null,
      capabilities: JSON.parse(sim.capabilities),
      versions,
    },
  });
});

// POST /simulations/:slug/fork — fork a simulation
simulationsRouter.post('/:slug/fork', async (c) => {
  const db = getDb();
  const slug = c.req.param('slug');

  // Get original simulation
  const original: any = db.prepare(`SELECT * FROM simulations WHERE slug = ?`).get(slug);
  if (!original) {
    db.close();
    return c.json({ error: 'Simulation not found' }, 404);
  }

  // Get user from auth header (or default to first user for now)
  const body = await c.req.json().catch(() => ({}));
  const userId = body.user_id ?? db.prepare(`SELECT id FROM users LIMIT 1`).get()?.id;
  if (!userId) {
    db.close();
    return c.json({ error: 'User required' }, 400);
  }

  const id = nanoid();
  const forkSlug = `${slug}-fork-${id.slice(0, 6)}`;
  const forkName = `${original.name} (Fork)`;

  db.prepare(`
    INSERT INTO simulations (id, user_id, name, slug, description, category, version, capabilities, source_code, forked_from)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, forkName, forkSlug, original.description, original.category, '1.0.0', original.capabilities, original.source_code, original.id);

  // Increment fork count on original
  db.prepare(`UPDATE simulations SET fork_count = fork_count + 1 WHERE id = ?`).run(original.id);

  db.close();

  return c.json({ id, slug: forkSlug, name: forkName, forked_from: slug }, 201);
});

// POST /simulations/:slug/play — increment play count
simulationsRouter.post('/:slug/play', (c) => {
  const db = getDb();
  const slug = c.req.param('slug');
  db.prepare(`UPDATE simulations SET plays = plays + 1 WHERE slug = ?`).run(slug);
  db.close();
  return c.json({ ok: true });
});

// GET /simulations/:slug/source — get source code for playing
simulationsRouter.get('/:slug/source', (c) => {
  const db = getDb();
  const slug = c.req.param('slug');

  const sim: any = db.prepare(`SELECT source_code, name, version FROM simulations WHERE slug = ?`).get(slug);
  db.close();

  if (!sim) return c.json({ error: 'Not found' }, 404);

  return c.json({ name: sim.name, version: sim.version, source: sim.source_code });
});

// POST /simulations — publish a new simulation
simulationsRouter.post('/', async (c) => {
  const body = await c.req.json();
  const { name, description, category, source_code, version } = body;

  if (!name || !source_code) {
    return c.json({ error: 'name and source_code required' }, 400);
  }

  const db = getDb();
  const id = nanoid();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  // TODO: get user_id from auth token
  const userId = db.prepare(`SELECT id FROM users LIMIT 1`).get() as any;

  db.prepare(`
    INSERT INTO simulations (id, user_id, name, slug, description, category, version, source_code)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId.id, name, slug, description ?? '', category ?? 'general', version ?? '1.0.0', source_code);

  // Create version record
  db.prepare(`
    INSERT INTO simulation_versions (id, simulation_id, version, source_code, changelog)
    VALUES (?, ?, ?, ?, ?)
  `).run(nanoid(), id, version ?? '1.0.0', source_code, 'Initial release');

  db.close();

  return c.json({ id, slug, version: version ?? '1.0.0' }, 201);
});

// GET /categories — list categories with counts
simulationsRouter.get('/meta/categories', (c) => {
  const db = getDb();
  const cats = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM simulations
    WHERE status = 'published'
    GROUP BY category
    ORDER BY count DESC
  `).all();
  db.close();
  return c.json({ categories: cats });
});

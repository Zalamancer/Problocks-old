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

// POST /simulations/:slug/play — increment play count + earn Probux for creator
simulationsRouter.post('/:slug/play', (c) => {
  const db = getDb();
  const slug = c.req.param('slug');

  const sim: any = db.prepare(`SELECT user_id FROM simulations WHERE slug = ?`).get(slug);
  db.prepare(`UPDATE simulations SET plays = plays + 1 WHERE slug = ?`).run(slug);

  // Credit 1 Probux to the creator
  if (sim) {
    db.prepare(`INSERT OR IGNORE INTO wallets (user_id) VALUES (?)`).run(sim.user_id);
    db.prepare(`UPDATE wallets SET balance = balance + 1, total_earned = total_earned + 1, updated_at = datetime('now') WHERE user_id = ?`).run(sim.user_id);
    db.prepare(`INSERT INTO transactions (id, user_id, type, amount, description, simulation_id) VALUES (?, ?, 'play_earning', 1, 'Play earning', ?)`)
      .run(nanoid(), sim.user_id, slug);
  }

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

// GET /simulations/:slug/download — download as a problocks project
simulationsRouter.get('/:slug/download', (c) => {
  const db = getDb();
  const slug = c.req.param('slug');

  const sim: any = db.prepare(`
    SELECT s.*, u.username as author_username, u.display_name as author_name,
           fs.name as forked_from_name, fs.slug as forked_from_slug
    FROM simulations s
    JOIN users u ON s.user_id = u.id
    LEFT JOIN simulations fs ON s.forked_from = fs.id
    WHERE s.slug = ?
  `).get(slug);
  db.close();

  if (!sim) return c.json({ error: 'Not found' }, 404);

  // Return a project structure that can be saved to disk
  return c.json({
    manifest: {
      name: sim.name,
      version: sim.version,
      description: sim.description,
      author: sim.author_username,
      category: sim.category,
      capabilities: JSON.parse(sim.capabilities),
      engine: '>=0.0.1',
      entry: 'src/index.ts',
      forkedFrom: sim.forked_from_slug ? {
        name: sim.forked_from_name,
        slug: sim.forked_from_slug,
        author: sim.author_username,
      } : null,
    },
    files: {
      'src/index.ts': sim.source_code,
    },
  });
});

// PUT /simulations/:slug — update simulation source code
simulationsRouter.put('/:slug', async (c) => {
  const slug = c.req.param('slug');
  const body = await c.req.json();
  const { source_code, version, changelog } = body;

  if (!source_code) return c.json({ error: 'source_code required' }, 400);

  const db = getDb();
  const sim: any = db.prepare(`SELECT id, version FROM simulations WHERE slug = ?`).get(slug);
  if (!sim) { db.close(); return c.json({ error: 'Not found' }, 404); }

  const newVersion = version ?? sim.version;

  // Save current version to history before updating
  db.prepare(`
    INSERT OR IGNORE INTO simulation_versions (id, simulation_id, version, source_code, changelog)
    VALUES (?, ?, ?, ?, ?)
  `).run(nanoid(), sim.id, newVersion, source_code, changelog ?? '');

  // Update the simulation
  db.prepare(`
    UPDATE simulations SET source_code = ?, version = ?, updated_at = datetime('now') WHERE slug = ?
  `).run(source_code, newVersion, slug);

  db.close();
  return c.json({ slug, version: newVersion });
});

// GET /simulations/:slug/versions — get version history
simulationsRouter.get('/:slug/versions', (c) => {
  const db = getDb();
  const slug = c.req.param('slug');

  const sim: any = db.prepare(`SELECT id FROM simulations WHERE slug = ?`).get(slug);
  if (!sim) { db.close(); return c.json({ error: 'Not found' }, 404); }

  const versions = db.prepare(`
    SELECT version, changelog, source_code, created_at
    FROM simulation_versions
    WHERE simulation_id = ?
    ORDER BY created_at DESC
  `).all(sim.id);

  db.close();
  return c.json({ versions });
});

// POST /simulations/:slug/rate — submit a rating/review
simulationsRouter.post('/:slug/rate', async (c) => {
  const slug = c.req.param('slug');
  const { user_id, score, review } = await c.req.json();

  if (!user_id || !score || score < 1 || score > 5) {
    return c.json({ error: 'user_id and score (1-5) required' }, 400);
  }

  const db = getDb();
  const sim: any = db.prepare(`SELECT id, user_id FROM simulations WHERE slug = ?`).get(slug);
  if (!sim) { db.close(); return c.json({ error: 'Not found' }, 404); }

  if (sim.user_id === user_id) {
    db.close();
    return c.json({ error: "You can't rate your own simulation" }, 400);
  }

  // Upsert rating
  const existing: any = db.prepare(`SELECT id, score FROM ratings WHERE simulation_id = ? AND user_id = ?`).get(sim.id, user_id);

  if (existing) {
    // Update existing rating
    const scoreDiff = score - existing.score;
    db.prepare(`UPDATE ratings SET score = ?, review = ? WHERE id = ?`).run(score, review ?? '', existing.id);
    db.prepare(`UPDATE simulations SET rating_sum = rating_sum + ? WHERE id = ?`).run(scoreDiff, sim.id);
  } else {
    // New rating
    db.prepare(`INSERT INTO ratings (id, simulation_id, user_id, score, review) VALUES (?, ?, ?, ?, ?)`)
      .run(nanoid(), sim.id, user_id, score, review ?? '');
    db.prepare(`UPDATE simulations SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?`)
      .run(score, sim.id);
  }

  db.close();
  return c.json({ ok: true });
});

// GET /simulations/:slug/reviews — get all reviews
simulationsRouter.get('/:slug/reviews', (c) => {
  const db = getDb();
  const slug = c.req.param('slug');

  const sim: any = db.prepare(`SELECT id FROM simulations WHERE slug = ?`).get(slug);
  if (!sim) { db.close(); return c.json({ error: 'Not found' }, 404); }

  const reviews = db.prepare(`
    SELECT r.score, r.review, r.created_at, u.username, u.display_name
    FROM ratings r JOIN users u ON r.user_id = u.id
    WHERE r.simulation_id = ? AND r.review != ''
    ORDER BY r.created_at DESC
  `).all(sim.id);

  db.close();
  return c.json({ reviews });
});

// GET /simulations/meta/tags — all tags with counts
simulationsRouter.get('/meta/tags', (c) => {
  const db = getDb();
  const tags = db.prepare(`
    SELECT tag, COUNT(*) as count FROM simulation_tags GROUP BY tag ORDER BY count DESC
  `).all();
  db.close();
  return c.json({ tags });
});

// GET /simulations/meta/search-suggestions — autocomplete
simulationsRouter.get('/meta/suggestions', (c) => {
  const q = c.req.query('q');
  if (!q || q.length < 2) return c.json({ suggestions: [] });

  const db = getDb();

  // Search sim names
  const sims = db.prepare(`
    SELECT name, slug, category FROM simulations
    WHERE name LIKE ? AND status = 'published'
    LIMIT 5
  `).all(`%${q}%`) as any[];

  // Search tags
  const tags = db.prepare(`
    SELECT DISTINCT tag FROM simulation_tags WHERE tag LIKE ? LIMIT 5
  `).all(`%${q}%`) as any[];

  db.close();

  return c.json({
    suggestions: [
      ...sims.map((s: any) => ({ type: 'simulation', text: s.name, slug: s.slug, category: s.category })),
      ...tags.map((t: any) => ({ type: 'tag', text: t.tag })),
    ],
  });
});

// POST /simulations/:slug/favorite — toggle favorite
simulationsRouter.post('/:slug/favorite', async (c) => {
  const slug = c.req.param('slug');
  const { user_id } = await c.req.json();
  if (!user_id) return c.json({ error: 'user_id required' }, 400);

  const db = getDb();
  const sim: any = db.prepare(`SELECT id FROM simulations WHERE slug = ?`).get(slug);
  if (!sim) { db.close(); return c.json({ error: 'Not found' }, 404); }

  const existing = db.prepare(`SELECT 1 FROM favorites WHERE user_id = ? AND simulation_id = ?`).get(user_id, sim.id);

  if (existing) {
    db.prepare(`DELETE FROM favorites WHERE user_id = ? AND simulation_id = ?`).run(user_id, sim.id);
    db.close();
    return c.json({ favorited: false });
  } else {
    db.prepare(`INSERT INTO favorites (user_id, simulation_id) VALUES (?, ?)`).run(user_id, sim.id);
    db.close();
    return c.json({ favorited: true });
  }
});

// GET /simulations/:slug/favorite/:userId — check if favorited
simulationsRouter.get('/:slug/favorite/:userId', (c) => {
  const db = getDb();
  const slug = c.req.param('slug');
  const userId = c.req.param('userId');

  const sim: any = db.prepare(`SELECT id FROM simulations WHERE slug = ?`).get(slug);
  if (!sim) { db.close(); return c.json({ favorited: false }); }

  const fav = db.prepare(`SELECT 1 FROM favorites WHERE user_id = ? AND simulation_id = ?`).get(userId, sim.id);
  db.close();
  return c.json({ favorited: !!fav });
});

// GET /users/:userId/favorites — get user's favorites
simulationsRouter.get('/user/:userId/favorites', (c) => {
  const db = getDb();
  const userId = c.req.param('userId');

  const favs = db.prepare(`
    SELECT s.name, s.slug, s.category, s.plays, s.rating_sum, s.rating_count
    FROM favorites f JOIN simulations s ON f.simulation_id = s.id
    WHERE f.user_id = ? ORDER BY f.created_at DESC
  `).all(userId);

  db.close();
  return c.json({ favorites: favs });
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

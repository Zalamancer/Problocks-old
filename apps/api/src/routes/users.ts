import { Hono } from 'hono';
import { getDb } from '../db/schema.js';

export const usersRouter = new Hono();

// GET /users/:username — public profile
usersRouter.get('/:username', (c) => {
  const db = getDb();
  const username = c.req.param('username');

  const user: any = db.prepare(`
    SELECT id, username, display_name, bio, is_educator, created_at
    FROM users WHERE username = ?
  `).get(username);

  if (!user) {
    db.close();
    return c.json({ error: 'User not found' }, 404);
  }

  // Get their simulations
  const simulations = db.prepare(`
    SELECT id, name, slug, description, category, version, plays,
           rating_sum, rating_count, created_at
    FROM simulations
    WHERE user_id = ? AND status = 'published'
    ORDER BY plays DESC
  `).all(user.id);

  // Stats
  const stats: any = db.prepare(`
    SELECT
      COUNT(*) as total_sims,
      COALESCE(SUM(plays), 0) as total_plays,
      COALESCE(AVG(CASE WHEN rating_count > 0 THEN rating_sum / rating_count END), 0) as avg_rating
    FROM simulations
    WHERE user_id = ? AND status = 'published'
  `).get(user.id);

  db.close();

  return c.json({
    user: {
      ...user,
      is_educator: !!user.is_educator,
    },
    simulations: simulations.map((s: any) => ({
      ...s,
      rating: s.rating_count > 0 ? (s.rating_sum / s.rating_count).toFixed(1) : null,
    })),
    stats: {
      totalSimulations: stats.total_sims,
      totalPlays: stats.total_plays,
      avgRating: stats.avg_rating ? parseFloat(stats.avg_rating.toFixed(1)) : null,
    },
  });
});

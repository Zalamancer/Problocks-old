import { Hono } from 'hono';
import { getDb } from '../db/schema.js';
import { nanoid } from 'nanoid';
import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? 'problocks-dev-secret-change-in-prod';

export const authRouter = new Hono();

// POST /auth/register
authRouter.post('/register', async (c) => {
  const { username, email, password, display_name } = await c.req.json();

  if (!username || !email || !password) {
    return c.json({ error: 'username, email, and password required' }, 400);
  }

  const db = getDb();
  const existing = db.prepare(`SELECT id FROM users WHERE username = ? OR email = ?`).get(username, email);
  if (existing) {
    db.close();
    return c.json({ error: 'Username or email already taken' }, 409);
  }

  const id = nanoid();
  const passwordHash = bcryptjs.hashSync(password, 10);

  db.prepare(`
    INSERT INTO users (id, username, email, password_hash, display_name) VALUES (?, ?, ?, ?, ?)
  `).run(id, username, email, passwordHash, display_name ?? username);

  db.close();

  const token = jwt.sign({ userId: id, username }, JWT_SECRET, { expiresIn: '7d' });

  return c.json({ token, user: { id, username, display_name: display_name ?? username } }, 201);
});

// POST /auth/login
authRouter.post('/login', async (c) => {
  const { username, password } = await c.req.json();

  if (!username || !password) {
    return c.json({ error: 'username and password required' }, 400);
  }

  const db = getDb();
  const user: any = db.prepare(`SELECT * FROM users WHERE username = ? OR email = ?`).get(username, username);
  db.close();

  if (!user || !bcryptjs.compareSync(password, user.password_hash)) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      is_educator: !!user.is_educator,
    },
  });
});

// GET /auth/me — get current user from token
authRouter.get('/me', (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const decoded = jwt.verify(authHeader.slice(7), JWT_SECRET) as any;
    const db = getDb();
    const user: any = db.prepare(`SELECT id, username, display_name, email, is_educator, bio FROM users WHERE id = ?`).get(decoded.userId);
    db.close();

    if (!user) return c.json({ error: 'User not found' }, 404);
    return c.json({ user });
  } catch {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

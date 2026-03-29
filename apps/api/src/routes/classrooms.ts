import { Hono } from 'hono';
import { getDb } from '../db/schema.js';
import { nanoid } from 'nanoid';

export const classroomsRouter = new Hono();

// POST /classrooms — create classroom (educator only)
classroomsRouter.post('/', async (c) => {
  const { educator_id, name, description } = await c.req.json();
  if (!educator_id || !name) return c.json({ error: 'educator_id and name required' }, 400);

  const db = getDb();
  const id = nanoid();
  const code = nanoid(6).toUpperCase(); // short join code like "A3X9K2"

  db.prepare(`INSERT INTO classrooms (id, educator_id, name, code, description) VALUES (?, ?, ?, ?, ?)`)
    .run(id, educator_id, name, code, description ?? '');

  db.close();
  return c.json({ id, code, name }, 201);
});

// POST /classrooms/join — student joins with code
classroomsRouter.post('/join', async (c) => {
  const { code, student_id } = await c.req.json();
  if (!code || !student_id) return c.json({ error: 'code and student_id required' }, 400);

  const db = getDb();
  const classroom: any = db.prepare(`SELECT id, name FROM classrooms WHERE code = ?`).get(code);
  if (!classroom) { db.close(); return c.json({ error: 'Invalid classroom code' }, 404); }

  db.prepare(`INSERT OR IGNORE INTO classroom_members (classroom_id, student_id) VALUES (?, ?)`)
    .run(classroom.id, student_id);

  db.close();
  return c.json({ classroom_id: classroom.id, name: classroom.name });
});

// GET /classrooms/:id — get classroom with members and assignments
classroomsRouter.get('/:id', (c) => {
  const db = getDb();
  const id = c.req.param('id');

  const classroom: any = db.prepare(`
    SELECT c.*, u.display_name as educator_name
    FROM classrooms c JOIN users u ON c.educator_id = u.id
    WHERE c.id = ?
  `).get(id);

  if (!classroom) { db.close(); return c.json({ error: 'Not found' }, 404); }

  const members = db.prepare(`
    SELECT u.id, u.username, u.display_name
    FROM classroom_members cm JOIN users u ON cm.student_id = u.id
    WHERE cm.classroom_id = ?
  `).all(id);

  const assignments = db.prepare(`
    SELECT a.*, (SELECT COUNT(*) FROM assignment_completions ac WHERE ac.assignment_id = a.id) as completions
    FROM assignments a WHERE a.classroom_id = ?
    ORDER BY a.created_at DESC
  `).all(id);

  db.close();
  return c.json({ classroom, members, assignments });
});

// POST /classrooms/:id/assignments — assign a simulation
classroomsRouter.post('/:id/assignments', async (c) => {
  const classroomId = c.req.param('id');
  const { simulation_slug, simulation_version, title, due_date } = await c.req.json();
  if (!simulation_slug || !title) return c.json({ error: 'simulation_slug and title required' }, 400);

  const db = getDb();
  const id = nanoid();

  db.prepare(`INSERT INTO assignments (id, classroom_id, simulation_slug, simulation_version, title, due_date) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, classroomId, simulation_slug, simulation_version ?? null, title, due_date ?? null);

  db.close();
  return c.json({ id, title }, 201);
});

// POST /classrooms/assignments/:id/complete — mark assignment completed
classroomsRouter.post('/assignments/:id/complete', async (c) => {
  const assignmentId = c.req.param('id');
  const { student_id } = await c.req.json();
  if (!student_id) return c.json({ error: 'student_id required' }, 400);

  const db = getDb();
  db.prepare(`INSERT OR REPLACE INTO assignment_completions (assignment_id, student_id, play_count)
    VALUES (?, ?, COALESCE((SELECT play_count FROM assignment_completions WHERE assignment_id = ? AND student_id = ?), 0) + 1)`)
    .run(assignmentId, student_id, assignmentId, student_id);

  db.close();
  return c.json({ ok: true });
});

// GET /classrooms/my/:userId — get classrooms for a user (educator or student)
classroomsRouter.get('/my/:userId', (c) => {
  const db = getDb();
  const userId = c.req.param('userId');

  const asEducator = db.prepare(`SELECT * FROM classrooms WHERE educator_id = ?`).all(userId);
  const asStudent = db.prepare(`
    SELECT c.* FROM classrooms c
    JOIN classroom_members cm ON c.id = cm.classroom_id
    WHERE cm.student_id = ?
  `).all(userId);

  db.close();
  return c.json({ teaching: asEducator, enrolled: asStudent });
});

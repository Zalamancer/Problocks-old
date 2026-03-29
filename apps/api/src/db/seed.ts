import { initDb, getDb } from './schema.js';
import { nanoid } from 'nanoid';
import bcryptjs from 'bcryptjs';

console.log('Initializing database...');
initDb();

const db = getDb();

// Create demo users
const demoPassword = bcryptjs.hashSync('demo123', 10);

const users = [
  { id: nanoid(), username: 'problocks_team', email: 'team@problocks.com', display_name: 'Problocks Team', is_educator: 0 },
  { id: nanoid(), username: 'physics_prof', email: 'prof@university.edu', display_name: 'Dr. Physics', is_educator: 1 },
  { id: nanoid(), username: 'mech_eng_101', email: 'mech@school.edu', display_name: 'MechEng Student', is_educator: 0 },
  { id: nanoid(), username: 'chem_sarah', email: 'sarah@lab.edu', display_name: 'Sarah Chen', is_educator: 0 },
  { id: nanoid(), username: 'digital_dev', email: 'dev@circuits.io', display_name: 'Circuit Builder', is_educator: 0 },
  { id: nanoid(), username: 'algo_anna', email: 'anna@cs.edu', display_name: 'Anna K.', is_educator: 0 },
];

const insertUser = db.prepare(
  `INSERT OR IGNORE INTO users (id, username, email, password_hash, display_name, is_educator) VALUES (?, ?, ?, ?, ?, ?)`,
);

for (const u of users) {
  insertUser.run(u.id, u.username, u.email, demoPassword, u.display_name, u.is_educator);
}

// Create demo simulations
const sims = [
  {
    id: nanoid(), user_id: users[0].id, name: 'EduVision — Digital Logic Lab', slug: 'eduvision-digital-logic',
    description: 'Build and simulate digital logic circuits. AND, OR, NOT, XOR gates with real-time signal propagation.',
    category: 'circuits', version: '2.1.0', plays: 12300, rating_sum: 24.5, rating_count: 5,
    source_code: `function onStart() {\n  pb.log("EduVision Digital Logic Lab");\n  pb.createEntity("and_gate", "box", JSON.stringify({ width: 1, height: 0.5, depth: 0.5, position: { x: 0, y: 1, z: 0 }, isStatic: true, color: "#44ff44" }));\n}\nfunction onTick(dt) {}`,
  },
  {
    id: nanoid(), user_id: users[1].id, name: 'Pendulum Physics Explorer', slug: 'pendulum-physics',
    description: 'Interactive pendulum with adjustable gravity, mass, and string length. Visualize energy conservation.',
    category: 'physics', version: '1.3.0', plays: 8100, rating_sum: 23.5, rating_count: 5,
    source_code: `var time = 0;\nfunction onStart() {\n  pb.log("Pendulum Physics Explorer");\n  pb.createEntity("bob", "sphere", JSON.stringify({ radius: 0.4, position: { x: 2, y: 5, z: 0 }, mass: 1.0, color: "#ff4444", restitution: 0.2 }));\n}\nfunction onTick(dt) {\n  time += dt;\n}`,
  },
  {
    id: nanoid(), user_id: users[2].id, name: 'Gear Train Simulator', slug: 'gear-train-sim',
    description: 'Design and simulate gear trains. See how torque and speed change through connected gears.',
    category: 'engineering', version: '1.0.0', plays: 5400, rating_sum: 24.0, rating_count: 5,
    source_code: `function onStart() {\n  pb.log("Gear Train Simulator");\n  pb.createEntity("gear1", "cylinder", JSON.stringify({ radius: 1, height: 0.3, position: { x: 0, y: 1, z: 0 }, isStatic: true, color: "#888888" }));\n}\nfunction onTick(dt) {}`,
  },
  {
    id: nanoid(), user_id: users[3].id, name: 'Water Molecule Builder', slug: 'water-molecule',
    description: 'Build H2O molecule. Visualize bond angles, electron clouds, and molecular vibrations.',
    category: 'chemistry', version: '1.1.0', plays: 2800, rating_sum: 23.0, rating_count: 5,
    source_code: `function onStart() {\n  pb.log("Water Molecule Builder");\n  pb.createEntity("oxygen", "sphere", JSON.stringify({ radius: 0.4, position: { x: 0, y: 3, z: 0 }, isStatic: true, color: "#ff0000" }));\n  pb.createEntity("h1", "sphere", JSON.stringify({ radius: 0.25, position: { x: -0.8, y: 3.5, z: 0 }, isStatic: true, color: "#ffffff" }));\n  pb.createEntity("h2", "sphere", JSON.stringify({ radius: 0.25, position: { x: 0.8, y: 3.5, z: 0 }, isStatic: true, color: "#ffffff" }));\n}\nfunction onTick(dt) {}`,
  },
  {
    id: nanoid(), user_id: users[4].id, name: 'Binary Adder Circuit', slug: 'binary-adder',
    description: '4-bit binary adder with carry propagation. Toggle inputs and watch the output change.',
    category: 'circuits', version: '1.2.0', plays: 4100, rating_sum: 21.5, rating_count: 5,
    source_code: `function onStart() {\n  pb.log("Binary Adder Circuit");\n}\nfunction onTick(dt) {}`,
  },
  {
    id: nanoid(), user_id: users[1].id, name: 'Projectile Motion Lab', slug: 'projectile-motion',
    description: 'Launch projectiles at different angles and speeds. Measure range, height, and time of flight.',
    category: 'physics', version: '2.0.0', plays: 9700, rating_sum: 24.0, rating_count: 5,
    source_code: `var time = 0;\nfunction onStart() {\n  pb.log("Projectile Motion Lab");\n  pb.createEntity("ball", "sphere", JSON.stringify({ radius: 0.3, position: { x: -5, y: 1, z: 0 }, mass: 0.5, color: "#ffaa00", restitution: 0.3 }));\n}\nfunction onTick(dt) {\n  time += dt;\n}`,
  },
  {
    id: nanoid(), user_id: users[5].id, name: 'Sorting Algorithm Race', slug: 'sorting-race',
    description: 'Visualize bubble sort, merge sort, quicksort side by side. See which is fastest.',
    category: 'cs', version: '1.5.0', plays: 11200, rating_sum: 23.5, rating_count: 5,
    source_code: `function onStart() {\n  pb.log("Sorting Algorithm Race");\n}\nfunction onTick(dt) {}`,
  },
  {
    id: nanoid(), user_id: users[1].id, name: 'Spring-Mass System Lab', slug: 'spring-mass',
    description: 'Explore Hooke\'s law with adjustable spring constant and mass. See position vs time graphs.',
    category: 'physics', version: '1.0.0', plays: 3200, rating_sum: 22.5, rating_count: 5,
    source_code: `var time = 0;\nfunction onStart() {\n  pb.log("Spring-Mass System");\n  pb.createEntity("mass", "box", JSON.stringify({ width: 0.5, height: 0.5, depth: 0.5, position: { x: 0, y: 3, z: 0 }, mass: 1.0, color: "#ff4444" }));\n}\nfunction onTick(dt) {\n  time += dt;\n}`,
  },
  {
    id: nanoid(), user_id: users[2].id, name: 'Combustion Engine Viz', slug: 'combustion-engine',
    description: 'Four-stroke engine animation. See intake, compression, power, and exhaust strokes.',
    category: 'engineering', version: '1.0.0', plays: 1900, rating_sum: 22.0, rating_count: 5,
    source_code: `function onStart() {\n  pb.log("Combustion Engine Viz");\n}\nfunction onTick(dt) {}`,
  },
  {
    id: nanoid(), user_id: users[5].id, name: 'Fourier Transform Explorer', slug: 'fourier-transform',
    description: 'Decompose signals into sine waves. Build any waveform by adding harmonics.',
    category: 'math', version: '1.2.0', plays: 6500, rating_sum: 24.5, rating_count: 5,
    source_code: `function onStart() {\n  pb.log("Fourier Transform Explorer");\n}\nfunction onTick(dt) {}`,
  },
];

const insertSim = db.prepare(
  `INSERT OR IGNORE INTO simulations (id, user_id, name, slug, description, category, version, plays, rating_sum, rating_count, source_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);

for (const s of sims) {
  insertSim.run(s.id, s.user_id, s.name, s.slug, s.description, s.category, s.version, s.plays, s.rating_sum, s.rating_count, s.source_code);
}

// Add tags
const tagMap: Record<string, string[]> = {
  'eduvision-digital-logic': ['circuits', 'logic-gates', 'boolean-algebra', 'digital', 'education'],
  'pendulum-physics': ['physics', 'pendulum', 'gravity', 'energy', 'AP Physics'],
  'gear-train-sim': ['engineering', 'gears', 'torque', 'mechanical', 'mechanisms'],
  'water-molecule': ['chemistry', 'molecules', 'bonds', 'H2O', 'molecular'],
  'binary-adder': ['circuits', 'binary', 'adder', 'digital', 'computer-architecture'],
  'projectile-motion': ['physics', 'projectile', 'kinematics', 'AP Physics', 'trajectory'],
  'sorting-race': ['cs', 'algorithms', 'sorting', 'visualization', 'data-structures'],
  'spring-mass': ['physics', 'springs', 'hooke-law', 'oscillation', 'SHM'],
  'combustion-engine': ['engineering', 'thermodynamics', 'engine', 'mechanical', 'four-stroke'],
  'fourier-transform': ['math', 'fourier', 'signals', 'waves', 'harmonics'],
};

const insertTag = db.prepare(`INSERT OR IGNORE INTO simulation_tags (simulation_id, tag) VALUES (?, ?)`);
for (const s of sims) {
  const tags = tagMap[s.slug] ?? [s.category];
  for (const tag of tags) {
    insertTag.run(s.id, tag);
  }
}

db.close();
console.log(`Seeded ${users.length} users and ${sims.length} simulations.`);

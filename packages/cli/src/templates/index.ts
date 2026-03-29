interface Template {
  entryCode: string;
}

const physicsTemplate: Template = {
  entryCode: `/**
 * Physics Simulation
 *
 * Available API (runs in sandbox):
 *   pb.createEntity(id, shape, optsJSON)  — create a physics entity
 *   pb.removeEntity(id)                   — remove an entity
 *   pb.applyForce(id, fx, fy, fz)         — apply force to entity
 *   pb.applyImpulse(id, ix, iy, iz)       — apply impulse to entity
 *   pb.getPosition(id) → "x,y,z"          — get entity position
 *   pb.getVelocity(id) → "vx,vy,vz"      — get entity velocity
 *   pb.log(...)                           — log to console
 *   parseVec3(str) → {x, y, z}           — helper to parse position/velocity strings
 */

var time = 0;

function onStart() {
  pb.log("=== Physics Simulation Started ===");

  // Create a ground plane
  // (ground is usually created by the engine, but you can add obstacles)

  // Create a ball
  pb.createEntity("ball", "sphere", JSON.stringify({
    radius: 0.5,
    position: { x: 0, y: 5, z: 0 },
    mass: 1.0,
    color: "#ff4444",
    restitution: 0.6,
  }));

  // Create a ramp
  pb.createEntity("ramp", "box", JSON.stringify({
    width: 4, height: 0.2, depth: 2,
    position: { x: -2, y: 2, z: 0 },
    isStatic: true,
    color: "#4488ff",
  }));
}

function onTick(dt: number) {
  time += dt;

  // Read the ball's position
  var pos = parseVec3(pb.getPosition("ball"));

  // If ball falls below -10, reset it
  if (pos.y < -10) {
    pb.removeEntity("ball");
    pb.createEntity("ball", "sphere", JSON.stringify({
      radius: 0.5,
      position: { x: 0, y: 8, z: 0 },
      mass: 1.0,
      color: "#ff4444",
      restitution: 0.6,
    }));
    pb.log("Ball reset!");
  }
}
`,
};

const circuitsTemplate: Template = {
  entryCode: `/**
 * Circuit Simulation
 *
 * Build interactive digital logic circuits.
 * Uses @problocks/circuits module (when available).
 * For now, uses basic entities to represent gates.
 */

var gates = [];

function onStart() {
  pb.log("=== Circuit Simulation Started ===");

  // Create visual representations of logic gates
  pb.createEntity("gate_and", "box", JSON.stringify({
    width: 1, height: 0.5, depth: 0.5,
    position: { x: 0, y: 1, z: 0 },
    isStatic: true,
    color: "#44ff44",
  }));

  pb.createEntity("gate_or", "box", JSON.stringify({
    width: 1, height: 0.5, depth: 0.5,
    position: { x: 3, y: 1, z: 0 },
    isStatic: true,
    color: "#4444ff",
  }));

  pb.createEntity("led_output", "sphere", JSON.stringify({
    radius: 0.3,
    position: { x: 6, y: 1, z: 0 },
    isStatic: true,
    color: "#ff0000",
  }));

  pb.log("Gates created. Circuit module coming soon!");
}

function onTick(dt: number) {
  // Circuit evaluation logic will go here
  // when @problocks/circuits module is integrated
}
`,
};

const chemistryTemplate: Template = {
  entryCode: `/**
 * Chemistry Simulation
 *
 * Build molecular and reaction simulations.
 * Uses @problocks/chemistry module (when available).
 * For now, uses basic entities to represent atoms.
 */

function onStart() {
  pb.log("=== Chemistry Simulation Started ===");

  // Create a simple molecule visualization (H2O)
  // Oxygen
  pb.createEntity("oxygen", "sphere", JSON.stringify({
    radius: 0.4,
    position: { x: 0, y: 3, z: 0 },
    isStatic: true,
    color: "#ff0000",
  }));

  // Hydrogen 1
  pb.createEntity("hydrogen1", "sphere", JSON.stringify({
    radius: 0.25,
    position: { x: -0.8, y: 3.5, z: 0 },
    isStatic: true,
    color: "#ffffff",
  }));

  // Hydrogen 2
  pb.createEntity("hydrogen2", "sphere", JSON.stringify({
    radius: 0.25,
    position: { x: 0.8, y: 3.5, z: 0 },
    isStatic: true,
    color: "#ffffff",
  }));

  pb.log("Water molecule (H2O) created!");
}

function onTick(dt: number) {
  // Molecular dynamics logic will go here
  // when @problocks/chemistry module is integrated
}
`,
};

const blankTemplate: Template = {
  entryCode: `/**
 * Problocks Simulation
 *
 * Available API (runs in sandbox):
 *   pb.createEntity(id, shape, optsJSON)
 *   pb.removeEntity(id)
 *   pb.applyForce(id, fx, fy, fz)
 *   pb.applyImpulse(id, ix, iy, iz)
 *   pb.getPosition(id) → "x,y,z"
 *   pb.getVelocity(id) → "vx,vy,vz"
 *   pb.log(...)
 *   parseVec3(str) → {x, y, z}
 */

function onStart() {
  pb.log("Simulation started!");
  // Create your entities here
}

function onTick(dt: number) {
  // Game logic runs here every frame
}
`,
};

const templates: Record<string, Template> = {
  physics: physicsTemplate,
  circuits: circuitsTemplate,
  chemistry: chemistryTemplate,
  blank: blankTemplate,
};

export function getTemplate(name: string): Template {
  return templates[name] ?? templates.blank;
}

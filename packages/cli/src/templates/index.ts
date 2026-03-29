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

const engineeringTemplate: Template = {
  entryCode: `/**
 * Engineering Simulation — Gear Train
 *
 * Visualize meshing gears with different tooth counts.
 * See how speed and torque change through the gear train.
 */

var time = 0;
var inputRpm = 60;
var gearTeeth = [20, 40, 15, 30]; // 4 gears
var gearAngles = [0, 0, 0, 0];

function onStart() {
  pb.log("=== Gear Train Simulator ===");

  // Create gears as cylinders at different positions
  for (var i = 0; i < gearTeeth.length; i++) {
    var radius = gearTeeth[i] * 0.03;
    var x = i * 2.5 - 3.75;
    var colors = ["#888888", "#aaaaaa", "#999999", "#bbbbbb"];

    pb.createEntity("gear_" + i, "cylinder", JSON.stringify({
      radius: radius,
      height: 0.3,
      position: { x: x, y: 2, z: 0 },
      isStatic: true,
      color: colors[i],
    }));

    // Axle
    pb.createEntity("axle_" + i, "cylinder", JSON.stringify({
      radius: 0.05,
      height: 0.6,
      position: { x: x, y: 2, z: 0 },
      isStatic: true,
      color: "#ff4444",
    }));
  }

  // Base platform
  pb.createEntity("base", "box", JSON.stringify({
    width: 12, height: 0.2, depth: 4,
    position: { x: 0, y: 1, z: 0 },
    isStatic: true,
    color: "#1e293b",
  }));
}

function onTick(dt) {
  time += dt;

  // Calculate RPMs through gear train
  var rpms = [inputRpm];
  for (var i = 1; i < gearTeeth.length; i++) {
    var ratio = gearTeeth[i-1] / gearTeeth[i];
    rpms.push(-rpms[i-1] * ratio); // opposite direction
  }

  // Update gear angles
  for (var j = 0; j < gearTeeth.length; j++) {
    gearAngles[j] += (rpms[j] / 60) * Math.PI * 2 * dt;
  }

  // Log every 2 seconds
  if (Math.floor(time * 0.5) !== Math.floor((time - dt) * 0.5)) {
    pb.log("Input: " + inputRpm + " RPM → Output: " + Math.abs(rpms[rpms.length-1]).toFixed(1) + " RPM");
    pb.log("  Ratio: 1:" + (gearTeeth[0] * gearTeeth[2] / (gearTeeth[1] * gearTeeth[3])).toFixed(2));
  }
}
`,
};

const biologyTemplate: Template = {
  entryCode: `/**
 * Biology Simulation — Cell Division
 *
 * Watch a cell divide through mitosis stages.
 * Chromosomes line up, split, and two daughter cells form.
 */

var time = 0;
var stage = 0; // 0=interphase, 1=prophase, 2=metaphase, 3=anaphase, 4=telophase
var stageNames = ["Interphase", "Prophase", "Metaphase", "Anaphase", "Telophase"];
var stageDuration = 3; // seconds per stage

function onStart() {
  pb.log("=== Cell Division Simulator ===");

  // Cell membrane (large sphere)
  pb.createEntity("cell", "sphere", JSON.stringify({
    radius: 2,
    position: { x: 0, y: 3, z: 0 },
    isStatic: true,
    color: "#88ccff",
  }));

  // Nucleus
  pb.createEntity("nucleus", "sphere", JSON.stringify({
    radius: 0.8,
    position: { x: 0, y: 3, z: 0 },
    isStatic: true,
    color: "#4444ff",
  }));

  // Chromosomes (small cylinders)
  for (var i = 0; i < 4; i++) {
    var angle = (i / 4) * Math.PI * 2;
    pb.createEntity("chromo_" + i, "cylinder", JSON.stringify({
      radius: 0.08,
      height: 0.5,
      position: {
        x: Math.cos(angle) * 0.3,
        y: 3 + Math.sin(angle) * 0.3,
        z: 0,
      },
      isStatic: true,
      color: "#ff6644",
    }));
  }

  pb.log("Stage: " + stageNames[0]);
}

function onTick(dt) {
  time += dt;

  var newStage = Math.floor(time / stageDuration) % 5;
  if (newStage !== stage) {
    stage = newStage;
    pb.log("Stage: " + stageNames[stage]);
  }
}
`,
};

const mathTemplate: Template = {
  entryCode: `/**
 * Math Simulation — 3D Function Plotter
 *
 * Visualize mathematical functions as 3D point clouds.
 * Watch sine waves, spirals, and parametric curves.
 */

var time = 0;
var points = 50;

function onStart() {
  pb.log("=== 3D Function Plotter ===");
  pb.log("Plotting y = sin(x) * cos(z)");

  // Create a grid of points showing y = sin(x) * cos(z)
  for (var i = 0; i < points; i++) {
    var x = (i / points) * 10 - 5;
    var z = 0;
    var y = Math.sin(x) * 2 + 3;

    // Color based on height
    var r = Math.floor(Math.max(0, Math.min(255, (y - 1) * 60)));
    var g = Math.floor(Math.max(0, Math.min(255, 100 + (y - 1) * 30)));
    var b = Math.floor(255 - r);
    var hex = "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");

    pb.createEntity("pt_" + i, "sphere", JSON.stringify({
      radius: 0.12,
      position: { x: x, y: y, z: z },
      isStatic: true,
      color: hex,
    }));
  }

  // Axes
  pb.createEntity("x_axis", "box", JSON.stringify({
    width: 10, height: 0.02, depth: 0.02,
    position: { x: 0, y: 3, z: 0 },
    isStatic: true,
    color: "#ff0000",
  }));

  pb.createEntity("y_axis", "box", JSON.stringify({
    width: 0.02, height: 6, depth: 0.02,
    position: { x: -5, y: 3, z: 0 },
    isStatic: true,
    color: "#00ff00",
  }));
}

function onTick(dt) {
  time += dt;

  // Animate the wave
  for (var i = 0; i < points; i++) {
    var x = (i / points) * 10 - 5;
    var y = Math.sin(x + time * 2) * 2 + 3;
    // Note: updating positions requires removing and recreating entities
    // This is simplified — a real implementation would use a position update API
  }
}
`,
};

const templates: Record<string, Template> = {
  physics: physicsTemplate,
  circuits: circuitsTemplate,
  chemistry: chemistryTemplate,
  engineering: engineeringTemplate,
  biology: biologyTemplate,
  math: mathTemplate,
  blank: blankTemplate,
};

export function getTemplate(name: string): Template {
  return templates[name] ?? templates.blank;
}

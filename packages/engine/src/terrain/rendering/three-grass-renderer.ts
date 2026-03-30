/**
 * Three.js Grass Renderer
 *
 * Exact code from https://codesandbox.io/p/sandbox/webgl-grass-3rk1o6
 * adapted for per-chunk terrain. Blade vertex Y positions are stored
 * relative to blade base (0 = base, ~1.4 = tip) so vPosition.y works
 * exactly like the demo. A separate baseY attribute offsets blades to
 * the terrain surface for rendering.
 */

import * as THREE from "three";
import { type Chunk } from "../voxel/chunk.js";
import { CHUNK_SIZE, VOXEL_SIZE, MC_THRESHOLD } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";

// ── Shaders ─────────────────────────────────────────────────────────
// Identical to demo except: added `baseY` attribute so blade positions
// can be relative to y=0 (for gradient) while rendering on terrain.

const vertexShader = /* glsl */ `
  uniform float uTime;
  attribute float baseY;

  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vNormal;

  float wave(float waveSize, float tipDistance, float centerDistance) {
    bool isTip = (gl_VertexID + 1) % 5 == 0;
    float waveDistance = isTip ? tipDistance : centerDistance;
    return sin((uTime / 500.0) + waveSize) * waveDistance;
  }

  void main() {
    vPosition = position;  // y is 0 at base, ~1.4 at tip — SAME as demo
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    vec3 finalPos = position;
    finalPos.y += baseY;  // offset to terrain surface for rendering

    if (position.y < 0.0) {
      finalPos.y = baseY;
    } else {
      finalPos.x += wave(uv.x * 10.0, 0.3, 0.1);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(finalPos, 1.0);
  }
`;

// Fragment shader — EXACT copy from demo, unchanged
const fragmentShader = /* glsl */ `
  uniform sampler2D uCloud;

  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vNormal;

  vec3 green = vec3(0.2, 0.6, 0.3);

  void main() {
    vec3 color = mix(green * 0.7, green, vPosition.y);
    color = mix(color, texture2D(uCloud, vUv).rgb, 0.4);

    float lighting = normalize(dot(vNormal, vec3(10)));
    gl_FragColor = vec4(color + lighting * 0.03, 1.0);
  }
`;

// ── Parameters (from Grass.js) ──────────────────────────────────────

const BLADE_WIDTH = 0.1;
const BLADE_HEIGHT = 0.8;
const BLADE_HEIGHT_VARIATION = 0.6;
const BLADE_VERTEX_COUNT = 5;
const BLADE_TIP_OFFSET = 0.1;
const BLADES_PER_VOXEL = 24;
const SCALE = 2.0;

function interpolate(val: number, oldMin: number, oldMax: number, newMin: number, newMax: number) {
  return ((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin) + newMin;
}

function hash(x: number, y: number, z: number, seed: number): number {
  let h = (seed + x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return (h & 0x7fffffff) / 0x7fffffff;
}

const GRASS_MATERIALS = new Set<number>([
  TerrainMaterial.Grass as number,
  TerrainMaterial.LeafyGrass as number,
]);

// ── ThreeGrassRenderer ──────────────────────────────────────────────

export class ThreeGrassRenderer {
  decoration: boolean = true;
  grassLength: number = 0.5;

  private scene: THREE.Scene;
  private material: THREE.ShaderMaterial;
  private meshes: Map<string, THREE.Mesh> = new Map();

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Procedural cloud texture (same as standalone demo)
    const cloudCanvas = document.createElement("canvas");
    cloudCanvas.width = 256;
    cloudCanvas.height = 256;
    const ctx = cloudCanvas.getContext("2d")!;
    for (let py = 0; py < 256; py++) {
      for (let px = 0; px < 256; px++) {
        const v = Math.floor(
          (Math.sin(px * 0.05) * Math.cos(py * 0.05) * 0.5 + 0.5) * 200 + Math.random() * 55,
        );
        ctx.fillStyle = `rgb(${v},${v},${v})`;
        ctx.fillRect(px, py, 1, 1);
      }
    }
    const cloudTexture = new THREE.CanvasTexture(cloudCanvas);
    cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uCloud: { value: cloudTexture },
        uTime: { value: 0 },
      },
      side: THREE.DoubleSide,
      vertexShader,
      fragmentShader,
    });
  }

  update(time: number): void {
    this.material.uniforms.uTime.value = time;
  }

  // ── Per-chunk blade generation ─────────────────────────────────
  // computeBlade() logic from Grass.js, but blade Y starts at 0
  // and baseY stores the terrain surface offset.

  updateChunk(chunkKey: string, chunk: Chunk): void {
    if (!this.decoration) {
      this.disposeChunk(chunkKey);
      return;
    }

    const occ = chunk.data.occupancy;
    const mat = chunk.data.materials;

    const positions: number[] = [];
    const baseYs: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let vtx = 0;

    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let y = 0; y < CHUNK_SIZE - 1; y++) {
        for (let x = 0; x < CHUNK_SIZE; x++) {
          const idx = voxelIndex(x, y, z);
          if (!GRASS_MATERIALS.has(mat[idx])) continue;
          if (occ[idx] < MC_THRESHOLD) continue;

          const aboveIdx = voxelIndex(x, y + 1, z);
          if (occ[aboveIdx] >= MC_THRESHOLD) continue;

          const occBelow = occ[idx];
          const occAbove = occ[aboveIdx];
          const denom = occAbove - occBelow;
          const t = denom === 0 ? 0.5 : (MC_THRESHOLD - occBelow) / denom;
          const surfaceY = (y + t) * VOXEL_SIZE;

          const chunkOriginX = chunk.worldOrigin.x;
          const chunkOriginZ = chunk.worldOrigin.z;

          for (let b = 0; b < BLADES_PER_VOXEL; b++) {
            const seed = b * 7 + 13;
            const offX = hash(x, z, b, seed) * VOXEL_SIZE;
            const offZ = hash(z, x, b, seed + 37) * VOXEL_SIZE;

            const cx = x * VOXEL_SIZE + offX;
            const cz = z * VOXEL_SIZE + offZ;

            const wx = chunkOriginX + cx;
            const wz = chunkOriginZ + cz;
            const u = interpolate(wx, -128, 128, 0, 1);
            const v2 = interpolate(wz, -128, 128, 0, 1);

            // Exact computeBlade() from Grass.js
            const height = (BLADE_HEIGHT + hash(x, y, z + b, seed + 99) * BLADE_HEIGHT_VARIATION) * SCALE;

            const yaw = hash(x, y, z + b, seed + 71) * Math.PI * 2;
            const yawVec = [Math.sin(yaw), 0, -Math.cos(yaw)];
            const bend = hash(x + b, y, z, seed + 53) * Math.PI * 2;
            const bendVec = [Math.sin(bend), 0, -Math.cos(bend)];

            const w2 = (BLADE_WIDTH * SCALE) / 2;
            const w4 = (BLADE_WIDTH * SCALE) / 4;
            const tipOff = BLADE_TIP_OFFSET * SCALE;

            // Blade positions with Y relative to base (0 = ground)
            // This makes vPosition.y work exactly like the demo

            // bl (base left) — y=0
            positions.push(cx + yawVec[0] * w2, 0, cz + yawVec[2] * w2);
            baseYs.push(surfaceY);
            uvs.push(u, v2);

            // br (base right) — y=0
            positions.push(cx - yawVec[0] * w2, 0, cz - yawVec[2] * w2);
            baseYs.push(surfaceY);
            uvs.push(u, v2);

            // tr (mid right) — y=height/2
            positions.push(cx - yawVec[0] * w4, height / 2, cz - yawVec[2] * w4);
            baseYs.push(surfaceY);
            uvs.push(u, v2);

            // tl (mid left) — y=height/2
            positions.push(cx + yawVec[0] * w4, height / 2, cz + yawVec[2] * w4);
            baseYs.push(surfaceY);
            uvs.push(u, v2);

            // tc (tip) — y=height
            positions.push(cx + bendVec[0] * tipOff, height, cz + bendVec[2] * tipOff);
            baseYs.push(surfaceY);
            uvs.push(u, v2);

            // Exact indices from demo
            indices.push(vtx, vtx + 1, vtx + 2);
            indices.push(vtx + 2, vtx + 4, vtx + 3);
            indices.push(vtx + 3, vtx, vtx + 2);

            vtx += BLADE_VERTEX_COUNT;
          }
        }
      }
    }

    if (vtx === 0) {
      this.disposeChunk(chunkKey);
      return;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.BufferAttribute(new Float32Array(positions), 3));
    geom.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(uvs), 2));
    geom.setAttribute("baseY", new THREE.BufferAttribute(new Float32Array(baseYs), 1));
    geom.setIndex(indices);
    geom.computeVertexNormals();

    let mesh = this.meshes.get(chunkKey);
    if (mesh) {
      mesh.geometry.dispose();
      mesh.geometry = geom;
    } else {
      mesh = new THREE.Mesh(geom, this.material);
      mesh.name = `terrain_grass_${chunkKey}`;
      this.scene.add(mesh);
      this.meshes.set(chunkKey, mesh);
    }

    mesh.position.set(chunk.worldOrigin.x, chunk.worldOrigin.y, chunk.worldOrigin.z);
  }

  disposeChunk(chunkKey: string): void {
    const m = this.meshes.get(chunkKey);
    if (m) { this.scene.remove(m); m.geometry.dispose(); this.meshes.delete(chunkKey); }
  }

  disposeAll(): void {
    for (const m of this.meshes.values()) { this.scene.remove(m); m.geometry.dispose(); }
    this.meshes.clear();
  }

  dispose(): void {
    this.disposeAll();
    this.material.dispose();
  }
}

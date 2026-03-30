/**
 * Three.js Grass Renderer — exact replica of
 * https://codesandbox.io/p/sandbox/webgl-grass-3rk1o6
 *
 * ONLY change from the demo: blade base Y is offset to terrain
 * surface via `baseY` attribute. Everything else is untouched.
 */

import * as THREE from "three";
import { type Chunk } from "../voxel/chunk.js";
import { CHUNK_SIZE, VOXEL_SIZE, MC_THRESHOLD } from "../voxel/constants.js";
import { TerrainMaterial } from "../voxel/terrain-materials.js";
import { voxelIndex } from "../voxel/voxel.js";

// ── Shaders (from src/shaders.js) ───────────────────────────────────
// ONLY addition: `attribute float baseY` and `finalPos.y += baseY`

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
    vPosition = position;
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    if (vPosition.y < 0.0) {
      vPosition.y = 0.0;
    } else {
      vPosition.x += wave(uv.x * 10.0, 0.3, 0.1);
    }

    // ONLY terrain addition: offset Y to terrain surface
    vec3 renderPos = vPosition;
    renderPos.y += baseY;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(renderPos, 1.0);
  }
`;

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

// ── Parameters (EXACT from Grass.js — NO scaling) ───────────────────

const BLADE_WIDTH = 0.1;
const BLADE_HEIGHT = 0.8;
const BLADE_HEIGHT_VARIATION = 0.6;
const BLADE_VERTEX_COUNT = 5;
const BLADE_TIP_OFFSET = 0.1;
const BLADES_PER_VOXEL = 60; // ~100k blades / ~1600 surface voxels

function interpolate(val: number, oldMin: number, oldMax: number, newMin: number, newMax: number) {
  return ((val - oldMin) * (newMax - newMin)) / (oldMax - oldMin) + newMin;
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

    // Procedural cloud texture (same as GrassDemo.tsx)
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

    // Exact same ShaderMaterial as demo
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
  // Exact computeBlade() from Grass.js + Math.random()
  // ONLY terrain addition: baseY attribute for surface offset

  updateChunk(chunkKey: string, chunk: Chunk): void {
    if (!this.decoration) {
      this.disposeChunk(chunkKey);
      return;
    }

    const occ = chunk.data.occupancy;
    const mat = chunk.data.materials;
    const chunkOriginX = chunk.worldOrigin.x;
    const chunkOriginZ = chunk.worldOrigin.z;

    const positions: number[] = [];
    const baseYs: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];
    let bladeIndex = 0;

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

          for (let b = 0; b < BLADES_PER_VOXEL; b++) {
            // Random position within voxel (Math.random like demo)
            const rx = Math.random() * VOXEL_SIZE;
            const rz = Math.random() * VOXEL_SIZE;
            const cx = x * VOXEL_SIZE + rx;
            const cz = z * VOXEL_SIZE + rz;

            // UV — same interpolate() as demo
            const wx = chunkOriginX + cx;
            const wz = chunkOriginZ + cz;
            const surfaceMin = -128;
            const surfaceMax = 128;
            const bladeUv: [number, number] = [
              interpolate(wx, surfaceMin, surfaceMax, 0, 1),
              interpolate(wz, surfaceMin, surfaceMax, 0, 1),
            ];

            // ── Exact computeBlade() from Grass.js ──────────────
            const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;
            const vIndex = bladeIndex * BLADE_VERTEX_COUNT;

            const yaw = Math.random() * Math.PI * 2;
            const yawVec = [Math.sin(yaw), 0, -Math.cos(yaw)];
            const bend = Math.random() * Math.PI * 2;
            const bendVec = [Math.sin(bend), 0, -Math.cos(bend)];

            const center = [cx, 0, cz];

            const bl = yawVec.map((n, i) => n * (BLADE_WIDTH / 2) * 1 + center[i]);
            const br = yawVec.map((n, i) => n * (BLADE_WIDTH / 2) * -1 + center[i]);
            const tl = yawVec.map((n, i) => n * (BLADE_WIDTH / 4) * 1 + center[i]);
            const tr = yawVec.map((n, i) => n * (BLADE_WIDTH / 4) * -1 + center[i]);
            const tc = bendVec.map((n, i) => n * BLADE_TIP_OFFSET + center[i]);

            tl[1] += height / 2;
            tr[1] += height / 2;
            tc[1] += height;

            // Push positions (y=0 at base, same as demo)
            positions.push(...bl, ...br, ...tr, ...tl, ...tc);

            // baseY for all 5 verts (terrain surface offset)
            for (let v = 0; v < BLADE_VERTEX_COUNT; v++) {
              baseYs.push(surfaceY);
            }

            // UV for all 5 verts (same UV per blade, like demo)
            for (let v = 0; v < BLADE_VERTEX_COUNT; v++) {
              uvs.push(bladeUv[0], bladeUv[1]);
            }

            // Indices — exact from demo
            indices.push(
              vIndex, vIndex + 1, vIndex + 2,
              vIndex + 2, vIndex + 4, vIndex + 3,
              vIndex + 3, vIndex, vIndex + 2,
            );

            bladeIndex++;
          }
        }
      }
    }

    if (bladeIndex === 0) {
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

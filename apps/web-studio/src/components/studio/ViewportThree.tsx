import { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useStudio } from '@/store/studio-store';
import { ScalarField, generateMesh } from './MarchingCubes';
import { sculptState } from './sculpt-state';

// ── Terrain top-surface shaders ──────────────────────────────────────

const terrainVS = /* glsl */ `
  varying float vHeight;
  varying vec3 vNormal;
  void main() {
    vHeight = position.y;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const terrainFS = /* glsl */ `
  varying float vHeight;
  varying vec3 vNormal;
  void main() {
    vec3 col = vec3(0.22, 0.42, 0.20);

    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float diff = max(dot(vNormal, lightDir), 0.0) * 0.6 + 0.4;
    gl_FragColor = vec4(col * diff, 1.0);
  }
`;

// ── Skirt (dirt sides) shaders ───────────────────────────────────────

const skirtVS = /* glsl */ `
  varying float vY;
  varying vec3 vNormal;
  void main() {
    vY = position.y;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const skirtFS = /* glsl */ `
  varying float vY;
  varying vec3 vNormal;
  void main() {
    vec3 topSoil = vec3(0.40, 0.28, 0.15);
    vec3 dirt    = vec3(0.55, 0.40, 0.25);
    vec3 clay    = vec3(0.62, 0.52, 0.32);
    vec3 stone   = vec3(0.45, 0.43, 0.40);

    float depth = 1.0 - smoothstep(-3.0, 1.0, vY);
    vec3 col;
    if (depth < 0.15) col = topSoil;
    else if (depth < 0.4) col = mix(topSoil, dirt, smoothstep(0.15, 0.4, depth));
    else if (depth < 0.7) col = mix(dirt, clay, smoothstep(0.4, 0.7, depth));
    else col = mix(clay, stone, smoothstep(0.7, 1.0, depth));

    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.3));
    float diff = max(dot(vNormal, lightDir), 0.0) * 0.5 + 0.5;
    gl_FragColor = vec4(col * diff, 1.0);
  }
`;

// ── Grass shaders (EXACT from codesandbox webgl-grass) ──────────────

const grassVertexShader = /* glsl */ `
  uniform float uTime;

  // uv.x = blade height (0=base, 1=tip), stored in attribute
  // uv.y = random seed

  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vNormal;

  float wave(float waveSize, float tipDistance, float centerDistance) {
    bool isTip = uv.x > 0.8;
    float waveDistance = isTip ? tipDistance : centerDistance;
    return sin((uTime / 500.0) + waveSize) * waveDistance;
  }

  void main() {
    vPosition = position;
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);

    // Wind: sway upper vertices along surface tangent
    vec3 pos = position;
    if (uv.x > 0.01) {
      vec3 tangent = normalize(cross(normal, vec3(0.0, 0.0, 1.0)));
      if (length(tangent) < 0.01) tangent = normalize(cross(normal, vec3(1.0, 0.0, 0.0)));
      pos += tangent * wave(uv.y * 10.0, 0.3, 0.1);
    }

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const grassFragmentShader = /* glsl */ `
  uniform sampler2D uCloud;

  varying vec3 vPosition;
  varying vec2 vUv;
  varying vec3 vNormal;

  vec3 green = vec3(0.2, 0.6, 0.3);

  void main() {
    // Height-based gradient: dark at base, bright at tip (original look)
    vec3 color = mix(green * 0.7, green, vUv.x);
    // Cloud texture variation using world position (matches original)
    vec2 cloudUV = vPosition.xz * 0.033 + 0.5;
    color = mix(color, texture2D(uCloud, cloudUV).rgb, 0.4);

    float lighting = normalize(dot(vNormal, vec3(10)));
    gl_FragColor = vec4(color + lighting * 0.03, 1.0);
  }
`;

// ── Constants ────────────────────────────────────────────────────────

const TERRAIN_SIZE = 40;
const BOTTOM_Y = -3;
const RES_PRESETS = [32, 64, 128, 256];
const GRASS_SIZE = 36;   // covers [-18, 18] — inside terrain bounds

/** Compute total surface area of a non-indexed triangle mesh (m²) */
function meshSurfaceArea(geo: THREE.BufferGeometry): number {
  const pos = geo.attributes.position.array as Float32Array;
  const triCount = pos.length / 9;
  let area = 0;
  for (let i = 0; i < triCount; i++) {
    const o = i * 9;
    const ax = pos[o+3]-pos[o], ay = pos[o+4]-pos[o+1], az = pos[o+5]-pos[o+2];
    const bx = pos[o+6]-pos[o], by = pos[o+7]-pos[o+1], bz = pos[o+8]-pos[o+2];
    const cx = ay*bz - az*by, cy = az*bx - ax*bz, cz = ax*by - ay*bx;
    area += Math.sqrt(cx*cx + cy*cy + cz*cz) * 0.5;
  }
  return area;
}

/** Blade count from density (blades/m²) and mesh surface area */
function grassBladeCount(geo: THREE.BufferGeometry): number {
  const area = meshSurfaceArea(geo);
  return Math.min(500000, Math.max(100, Math.round(area * sculptState.grassDensity)));
}

// ── Grass blade generation (surface-scattered) ─────────────────────

const BLADE_WIDTH = 0.1;
const BLADE_HEIGHT = 0.8;
const BLADE_HEIGHT_VARIATION = 0.6;
const VERTS_PER_BLADE = 5;

/** Build a tangent frame from a normal vector */
function tangentFrame(nx: number, ny: number, nz: number): { t: [number,number,number]; b: [number,number,number] } {
  // Pick a non-parallel vector to cross with
  let tx: number, ty: number, tz: number;
  if (Math.abs(ny) < 0.9) {
    tx = 0; ty = 1; tz = 0;
  } else {
    tx = 1; ty = 0; tz = 0;
  }
  // tangent = cross(n, up)
  const t0 = ny * tz - nz * ty, t1 = nz * tx - nx * tz, t2 = nx * ty - ny * tx;
  const tl = Math.sqrt(t0*t0 + t1*t1 + t2*t2) || 1;
  const t: [number,number,number] = [t0/tl, t1/tl, t2/tl];
  // bitangent = cross(n, tangent)
  const b0 = ny*t[2] - nz*t[1], b1 = nz*t[0] - nx*t[2], b2 = nx*t[1] - ny*t[0];
  return { t, b: [b0, b1, b2] };
}

/** Scatter grass blades on a mesh's triangles. Returns grass geometry. */
function scatterGrassOnMesh(terrainGeo: THREE.BufferGeometry, count: number): THREE.BufferGeometry {
  const tPos = terrainGeo.attributes.position.array as Float32Array;
  const triCount = tPos.length / 9; // non-indexed, 3 verts per tri, 3 floats per vert
  if (triCount === 0) return new THREE.BufferGeometry();

  // Compute triangle areas for weighted sampling
  const areas = new Float32Array(triCount);
  let totalArea = 0;
  for (let i = 0; i < triCount; i++) {
    const o = i * 9;
    const ax = tPos[o+3]-tPos[o], ay = tPos[o+4]-tPos[o+1], az = tPos[o+5]-tPos[o+2];
    const bx = tPos[o+6]-tPos[o], by = tPos[o+7]-tPos[o+1], bz = tPos[o+8]-tPos[o+2];
    const cx = ay*bz - az*by, cy = az*bx - ax*bz, cz = ax*by - ay*bx;
    areas[i] = Math.sqrt(cx*cx + cy*cy + cz*cz) * 0.5;
    totalArea += areas[i];
  }

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let blade = 0; blade < count; blade++) {
    // Pick a triangle weighted by area
    let r = Math.random() * totalArea;
    let tri = 0;
    for (let i = 0; i < triCount; i++) {
      r -= areas[i];
      if (r <= 0) { tri = i; break; }
    }

    const o = tri * 9;
    // Random point on triangle (barycentric)
    let u = Math.random(), v = Math.random();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    const w = 1 - u - v;
    const px = tPos[o]*w + tPos[o+3]*u + tPos[o+6]*v;
    const py = tPos[o+1]*w + tPos[o+4]*u + tPos[o+7]*v;
    const pz = tPos[o+2]*w + tPos[o+5]*u + tPos[o+8]*v;

    // Face normal
    const ax = tPos[o+3]-tPos[o], ay = tPos[o+4]-tPos[o+1], az = tPos[o+5]-tPos[o+2];
    const bx = tPos[o+6]-tPos[o], by = tPos[o+7]-tPos[o+1], bz = tPos[o+8]-tPos[o+2];
    let nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx;
    const nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
    nx /= nl; ny /= nl; nz /= nl;

    // Tangent frame
    const { t, b } = tangentFrame(nx, ny, nz);

    const height = BLADE_HEIGHT + Math.random() * BLADE_HEIGHT_VARIATION;
    const yaw = Math.random() * Math.PI * 2;
    const cosY = Math.cos(yaw), sinY = Math.sin(yaw);
    const seed = Math.random();

    // Local directions in tangent plane
    const widthX = (t[0]*cosY + b[0]*sinY) * BLADE_WIDTH * 0.5;
    const widthY = (t[1]*cosY + b[1]*sinY) * BLADE_WIDTH * 0.5;
    const widthZ = (t[2]*cosY + b[2]*sinY) * BLADE_WIDTH * 0.5;

    const vi = blade * VERTS_PER_BLADE;
    // 5 vertices: bl, br, mr, ml, tip
    // Base left
    positions.push(px - widthX, py - widthY, pz - widthZ);
    normals.push(nx, ny, nz); uvs.push(0, seed);
    // Base right
    positions.push(px + widthX, py + widthY, pz + widthZ);
    normals.push(nx, ny, nz); uvs.push(0, seed);
    // Mid right
    positions.push(
      px + widthX*0.5 + nx*height*0.5,
      py + widthY*0.5 + ny*height*0.5,
      pz + widthZ*0.5 + nz*height*0.5,
    );
    normals.push(nx, ny, nz); uvs.push(0.5, seed);
    // Mid left
    positions.push(
      px - widthX*0.5 + nx*height*0.5,
      py - widthY*0.5 + ny*height*0.5,
      pz - widthZ*0.5 + nz*height*0.5,
    );
    normals.push(nx, ny, nz); uvs.push(0.5, seed);
    // Tip
    positions.push(
      px + nx*height,
      py + ny*height,
      pz + nz*height,
    );
    normals.push(nx, ny, nz); uvs.push(1.0, seed);

    indices.push(
      vi, vi+1, vi+2,
      vi+2, vi+4, vi+3,
      vi+3, vi, vi+2,
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  return geo;
}

function createGrassMaterial(): THREE.ShaderMaterial {
  // Generate cloud noise texture (same as original)
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = 256;
  cloudCanvas.height = 256;
  const ctx = cloudCanvas.getContext('2d')!;
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

  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uCloud: { value: cloudTexture },
    },
    side: THREE.DoubleSide,
    vertexShader: grassVertexShader,
    fragmentShader: grassFragmentShader,
  });
}

// ── Terrain geometry ─────────────────────────────────────────────────

function makeTerrainGeo(res: number, oldPos?: Float32Array, oldRes?: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, res, res);
  geo.rotateX(-Math.PI / 2);
  if (oldPos && oldRes !== undefined) {
    const p = geo.attributes.position.array as Float32Array;
    const half = TERRAIN_SIZE / 2;
    const s = oldRes + 1;
    for (let i = 0; i < geo.attributes.position.count; i++) {
      const x = p[i * 3], z = p[i * 3 + 2];
      const u = ((x + half) / TERRAIN_SIZE) * oldRes;
      const v = ((z + half) / TERRAIN_SIZE) * oldRes;
      const u0 = Math.floor(Math.max(0, Math.min(oldRes - 1, u)));
      const v0 = Math.floor(Math.max(0, Math.min(oldRes - 1, v)));
      const u1 = Math.min(oldRes, u0 + 1);
      const v1 = Math.min(oldRes, v0 + 1);
      const fu = u - u0, fv = v - v0;
      p[i * 3 + 1] =
        oldPos[(v0 * s + u0) * 3 + 1] * (1 - fu) * (1 - fv) +
        oldPos[(v0 * s + u1) * 3 + 1] * fu * (1 - fv) +
        oldPos[(v1 * s + u0) * 3 + 1] * (1 - fu) * fv +
        oldPos[(v1 * s + u1) * 3 + 1] * fu * fv;
    }
    geo.computeVertexNormals();
  }
  return geo;
}

// ── Perimeter & Skirt ────────────────────────────────────────────────

function getPerimIndices(res: number): number[] {
  const stride = res + 1;
  const perim: number[] = [];
  for (let i = 0; i <= res; i++) perim.push(i);
  for (let j = 1; j <= res; j++) perim.push(j * stride + res);
  for (let i = res - 1; i >= 0; i--) perim.push(res * stride + i);
  for (let j = res - 1; j >= 1; j--) perim.push(j * stride);
  return perim;
}

function makeSkirtGeo(terrainGeo: THREE.BufferGeometry, res: number): THREE.BufferGeometry {
  const tPos = terrainGeo.attributes.position.array as Float32Array;
  const perim = getPerimIndices(res);
  const count = perim.length;
  const positions = new Float32Array(count * 2 * 3);
  const indices: number[] = [];
  for (let k = 0; k < count; k++) {
    const vi = perim[k];
    positions[k * 6] = tPos[vi * 3];
    positions[k * 6 + 1] = tPos[vi * 3 + 1];
    positions[k * 6 + 2] = tPos[vi * 3 + 2];
    positions[k * 6 + 3] = tPos[vi * 3];
    positions[k * 6 + 4] = BOTTOM_Y;
    positions[k * 6 + 5] = tPos[vi * 3 + 2];
  }
  for (let k = 0; k < count; k++) {
    const next = (k + 1) % count;
    indices.push(k * 2, k * 2 + 1, next * 2, next * 2, k * 2 + 1, next * 2 + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function updateSkirt(skirtGeo: THREE.BufferGeometry, terrainGeo: THREE.BufferGeometry, res: number) {
  const tPos = terrainGeo.attributes.position.array as Float32Array;
  const sPos = skirtGeo.attributes.position.array as Float32Array;
  const perim = getPerimIndices(res);
  for (let k = 0; k < perim.length; k++) {
    sPos[k * 6 + 1] = tPos[perim[k] * 3 + 1];
  }
  skirtGeo.attributes.position.needsUpdate = true;
  skirtGeo.computeVertexNormals();
}

// ── Height texture ───────────────────────────────────────────────────

function makeHeightTex(res: number): { tex: THREE.DataTexture; data: Float32Array } {
  const s = res + 1;
  const data = new Float32Array(s * s * 4);
  const tex = new THREE.DataTexture(data, s, s, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, data };
}

/** Sample surface height from voxel field by finding where field crosses zero (top-down) */
function syncHeightTexFromField(data: Float32Array, tex: THREE.DataTexture, field: ScalarField, texRes: number) {
  const s = texRes + 1;
  const half = TERRAIN_SIZE / 2;
  const step = TERRAIN_SIZE / texRes;
  for (let iz = 0; iz < s; iz++) {
    for (let ix = 0; ix < s; ix++) {
      const wx = -half + ix * step;
      const wz = -half + iz * step;
      // Cast downward through the voxel field to find surface
      let h = 0;
      for (let iy = field.ny; iy >= 0; iy--) {
        const wy = field.minY + iy * field.cellSize;
        const [gx,,gz] = field.gridIdx(wx, wy, wz);
        const val = field.get(gx, iy, gz);
        if (val > 0) { h = wy; break; }
      }
      data[(iz * s + ix) * 4] = h;
    }
  }
  tex.needsUpdate = true;
}

// ── Sculpt brush ─────────────────────────────────────────────────────

import type { SculptTool } from './sculpt-state';

/** Axis-aware distance: only count enabled axes */
function axisDist(dx: number, dy: number, dz: number, ax: boolean, ay: boolean, az: boolean): number {
  return Math.sqrt((ax ? dx * dx : 0) + (ay ? dy * dy : 0) + (az ? dz * dz : 0));
}

/** Sculpt into a voxel field and regenerate the mesh */
function voxelSculpt(
  field: ScalarField, mesh: THREE.Mesh,
  pt: THREE.Vector3, radius: number, strength: number, tool: SculptTool,
) {
  const amount = strength * 0.15;
  const { x: ax, y: ay, z: az } = sculptState.axes;

  // Axis-aware add/remove: extends infinitely along disabled axes
  const addAxis = (wx: number, wy: number, wz: number, r: number, amt: number) => {
    const gr = r / field.cellSize;
    const [cx, cy, cz] = field.gridIdx(wx, wy, wz);
    const ri = Math.ceil(gr);
    for (let dz = -ri; dz <= ri; dz++) {
      for (let dy = -ri; dy <= ri; dy++) {
        for (let dx = -ri; dx <= ri; dx++) {
          const ix = cx + dx, iy = cy + dy, iz = cz + dz;
          if (ix < 0 || ix > field.nx || iy < 0 || iy > field.ny || iz < 0 || iz > field.nz) continue;
          const d = axisDist(dx, dy, dz, ax, ay, az);
          if (d > gr) continue;
          const falloff = (1 - d / gr);
          field.data[field.idx(ix, iy, iz)] += falloff * falloff * amt;
        }
      }
    }
  };

  switch (tool) {
    case 'raise':
      addAxis(pt.x, pt.y, pt.z, radius, amount);
      break;
    case 'lower':
      addAxis(pt.x, pt.y, pt.z, radius, -amount);
      break;
    case 'smooth': {
      const r = radius / field.cellSize;
      const [cx, cy, cz] = field.gridIdx(pt.x, pt.y, pt.z);
      const ri = Math.ceil(r);
      for (let dz = -ri; dz <= ri; dz++) {
        for (let dy = -ri; dy <= ri; dy++) {
          for (let dx = -ri; dx <= ri; dx++) {
            const ix = cx + dx, iy = cy + dy, iz = cz + dz;
            if (ix < 1 || ix >= field.nx || iy < 1 || iy >= field.ny || iz < 1 || iz >= field.nz) continue;
            const d = axisDist(dx, dy, dz, ax, ay, az);
            if (d > r) continue;
            const f = (1 - d / r) * amount;
            const avg = (
              field.get(ix-1,iy,iz) + field.get(ix+1,iy,iz) +
              field.get(ix,iy-1,iz) + field.get(ix,iy+1,iz) +
              field.get(ix,iy,iz-1) + field.get(ix,iy,iz+1)
            ) / 6;
            const cur = field.get(ix, iy, iz);
            field.set(ix, iy, iz, cur + (avg - cur) * f);
          }
        }
      }
      break;
    }
    case 'flatten':
      // Flatten: push voxels toward the surface (value → 0) near the point
      field.addSphere(pt.x, pt.y, pt.z, radius, amount * 0.5);
      break;
  }
  // Regenerate mesh
  const newGeo = generateMesh(field);
  mesh.geometry.dispose();
  mesh.geometry = newGeo;
}

// ── Viewport Component ───────────────────────────────────────────────

export function ViewportThree() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fps, setFps] = useState(0);
  const [ready, setReady] = useState(false);
  const { selectEntity, entities } = useStudio();
  const terrainEntity = entities.find(e => e.id === '__terrain');

  const [panMode, setPanMode] = useState(false);

  const threeRef = useRef<{
    terrain: THREE.Mesh;
    skirt: THREE.Mesh;
    bottom: THREE.Mesh;
    terrainGroup: THREE.Group;
    tMat: THREE.ShaderMaterial;
    wMat: THREE.MeshBasicMaterial;
    cursor: THREE.Mesh;
    controls: OrbitControls;
    grassMat: THREE.ShaderMaterial;
    grassMesh: THREE.Mesh;
    field: ScalarField;
  } | null>(null);

  const selectEntityRef = useRef(selectEntity);
  selectEntityRef.current = selectEntity;

  const st = useRef({
    painting: false, flatTarget: 0,
    panMode: false,
  });

  // Sync sculptState → Three.js
  useEffect(() => {
    let prevRes = sculptState.voxelRes;
    let prevDensity = sculptState.grassDensity;
    const unsub = sculptState.subscribe(() => {
      if (!threeRef.current) return;
      const tr = threeRef.current;
      tr.terrain.material = sculptState.wireframe ? tr.wMat : tr.tMat;

      // Rebuild grass if density changed
      if (sculptState.grassDensity !== prevDensity) {
        prevDensity = sculptState.grassDensity;
        const geo = tr.terrain.geometry;
        const newGrassGeo = scatterGrassOnMesh(geo, grassBladeCount(geo));
        tr.grassMesh.geometry.dispose();
        tr.grassMesh.geometry = newGrassGeo;
      }

      // Rebuild voxel field if resolution changed
      if (sculptState.voxelRes !== prevRes) {
        prevRes = sculptState.voxelRes;
        const half = TERRAIN_SIZE / 2;
        const res = sculptState.voxelRes;
        const resY = Math.round(res / 2);
        const cellSize = TERRAIN_SIZE / res;
        const newField = new ScalarField(res, resY, res, -half, BOTTOM_Y, -half, cellSize);
        // Copy data from old field by sampling world positions
        const oldField = tr.field;
        for (let iz = 0; iz <= res; iz++) {
          for (let iy = 0; iy <= resY; iy++) {
            for (let ix = 0; ix <= res; ix++) {
              const [wx, wy, wz] = newField.worldPos(ix, iy, iz);
              // Sample from old field via nearest grid point
              const [ox, oy, oz] = oldField.gridIdx(wx, wy, wz);
              if (ox >= 0 && ox <= oldField.nx && oy >= 0 && oy <= oldField.ny && oz >= 0 && oz <= oldField.nz) {
                newField.set(ix, iy, iz, oldField.get(ox, oy, oz));
              }
            }
          }
        }
        tr.field = newField;
        const newGeo = generateMesh(newField);
        tr.terrain.geometry.dispose();
        tr.terrain.geometry = newGeo;
        const newGrassGeo = scatterGrassOnMesh(newGeo, grassBladeCount(newGeo));
        tr.grassMesh.geometry.dispose();
        tr.grassMesh.geometry = newGrassGeo;
      }
    });
    return unsub;
  }, []);

  // Sync terrain entity transform → Three.js group
  useEffect(() => {
    if (!threeRef.current || !terrainEntity) return;
    const g = threeRef.current.terrainGroup;
    g.position.set(terrainEntity.position.x, terrainEntity.position.y, terrainEntity.position.z);
    g.rotation.set(
      THREE.MathUtils.degToRad(terrainEntity.rotation.x),
      THREE.MathUtils.degToRad(terrainEntity.rotation.y),
      THREE.MathUtils.degToRad(terrainEntity.rotation.z),
    );
    g.scale.set(terrainEntity.scale.x, terrainEntity.scale.y, terrainEntity.scale.z);
  }, [terrainEntity?.position, terrainEntity?.rotation, terrainEntity?.scale]);

  // ── Main setup ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let disposed = false;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0.53, 0.72, 0.9);

    const cam = new THREE.PerspectiveCamera(75, canvas.clientWidth / canvas.clientHeight);
    cam.position.set(-12, 8, 12);
    cam.lookAt(0, 0, 0);

    // ── OrbitControls: right-drag orbits, we handle everything else ──
    const controls = new OrbitControls(cam, canvas);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false; // we handle scroll/pinch manually
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.maxDistance = 40;
    controls.minDistance = 3;
    controls.mouseButtons = {
      LEFT: -1 as unknown as THREE.MOUSE,   // sculpt, not orbit
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,            // right-drag = orbit
    };

    // Prevent context menu on right-click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // ── Terrain group ──
    const terrainGroup = new THREE.Group();
    scene.add(terrainGroup);

    // ── Voxel field ──
    const half = TERRAIN_SIZE / 2;
    const voxelRes = 48; // cells per axis (X/Z)
    const voxelResY = 24; // cells in Y
    const cellSize = TERRAIN_SIZE / voxelRes;
    const field = new ScalarField(voxelRes, voxelResY, voxelRes, -half, BOTTOM_Y, -half, cellSize);
    // Initialize: flat terrain at y=0 (thin slab from BOTTOM_Y to 0)
    field.initFromHeightmap(() => 0);

    // ── Terrain mesh (marching cubes) ──
    const tGeo = generateMesh(field);
    const tMat = new THREE.ShaderMaterial({ vertexShader: terrainVS, fragmentShader: terrainFS, side: THREE.DoubleSide });
    const wMat = new THREE.MeshBasicMaterial({ color: 0x44ff44, wireframe: true });
    const terrain = new THREE.Mesh(tGeo, tMat);
    terrainGroup.add(terrain);

    // ── Skirt ── (placeholder, voxels handle sides)
    const sGeo = new THREE.BufferGeometry();
    const skirt = new THREE.Mesh(sGeo);

    // ── Bottom cap ──
    const bGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE);
    bGeo.rotateX(Math.PI / 2);
    const bottom = new THREE.Mesh(bGeo, new THREE.ShaderMaterial({ vertexShader: skirtVS, fragmentShader: skirtFS, side: THREE.DoubleSide }));
    bottom.position.y = BOTTOM_Y;
    terrainGroup.add(bottom);

    // ── Grass (scattered on mesh faces) ──
    const grassMat = createGrassMaterial();
    const grassGeo = scatterGrassOnMesh(tGeo, grassBladeCount(tGeo));
    const grassMesh = new THREE.Mesh(grassGeo, grassMat);
    terrainGroup.add(grassMesh);

    // ── Brush cursor ──
    const cGeo = new THREE.RingGeometry(0.95, 1.0, 64);
    cGeo.rotateX(-Math.PI / 2);
    const cMat = new THREE.MeshBasicMaterial({ color: 0xffdd00, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthTest: false });
    const cursor = new THREE.Mesh(cGeo, cMat);
    cursor.renderOrder = 999;
    cursor.visible = false;
    scene.add(cursor);

    threeRef.current = { terrain, skirt, bottom, terrainGroup, tMat, wMat, cursor, controls, grassMat, grassMesh, field };
    setReady(true);

    // ── Raycaster ──
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function hitTerrain(e: PointerEvent | MouseEvent) {
      const r = canvas!.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
      ray.setFromCamera(mouse, cam);
      const hits = ray.intersectObject(terrain);
      return hits.length ? hits[0] : null;
    }

    function doSculpt(point: THREE.Vector3) {
      voxelSculpt(field, terrain, point, sculptState.size, sculptState.strength, sculptState.tool);
    }

    function rebuildGrass() {
      const tr = threeRef.current!;
      const newGrassGeo = scatterGrassOnMesh(terrain.geometry, grassBladeCount(terrain.geometry));
      tr.grassMesh.geometry.dispose();
      tr.grassMesh.geometry = newGrassGeo;
    }

    // ── Pointer events (sculpt) ──
    function onDown(e: PointerEvent) {
      if (e.button !== 0) return;
      const h = hitTerrain(e);
      if (h) {
        selectEntityRef.current('__terrain');
        st.current.painting = true;
        st.current.flatTarget = h.point.y;
        doSculpt(h.point);
      }
    }
    function onMove(e: PointerEvent) {
      const h = hitTerrain(e);
      if (h) {
        cursor.visible = true;
        cursor.position.set(h.point.x, h.point.y + 0.05, h.point.z);
        cursor.scale.setScalar(sculptState.size);
        if (st.current.painting) doSculpt(h.point);
      } else {
        cursor.visible = false;
      }
    }
    function onUp(e: PointerEvent) {
      if (e.button === 0) {
        if (st.current.painting) rebuildGrass();
        st.current.painting = false;
      }
    }
    function onLeave() { cursor.visible = false; st.current.painting = false; }

    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointerleave', onLeave);

    // ── Double-click toggles pan mode ──
    canvas.addEventListener('dblclick', () => {
      st.current.panMode = !st.current.panMode;
      setPanMode(st.current.panMode);
    });

    // ── Wheel: orbit / pinch-zoom / pan / brush-size ──
    let bHeld = false;
    function onKeyDown(e: KeyboardEvent) { if (e.key === 'b' || e.key === 'B') bHeld = true; }
    function onKeyUp(e: KeyboardEvent) { if (e.key === 'b' || e.key === 'B') bHeld = false; }

    function onWheel(e: WheelEvent) {
      // Only act when canvas is the target
      if (!canvas!.contains(e.target as Node)) return;

      // B + scroll → brush size
      if (bHeld) {
        e.preventDefault();
        e.stopPropagation();
        const next = Math.max(0.5, Math.min(8, sculptState.size + (e.deltaY > 0 ? -0.5 : 0.5)));
        sculptState.setSize(next);
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      // Pinch = ctrl+scroll → zoom (inverted)
      if (e.ctrlKey || e.metaKey) {
        if (e.deltaY > 0) controls.dollyIn(1.04);
        else controls.dollyOut(1.04);
        controls.update();
        return;
      }

      // Pan mode (double-click activated) → pan (inverted)
      if (st.current.panMode) {
        (controls as any)._pan(-e.deltaX, e.deltaY);
        controls.update();
        return;
      }

      // Default scroll → orbit (inverted)
      controls.rotateLeft(-e.deltaX * 0.003);
      controls.rotateUp(-e.deltaY * 0.003);
      controls.update();
    }

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('wheel', onWheel, { capture: true, passive: false });

    // ── Render loop ──
    let fc = 0, fa = 0, lt = performance.now();
    function animate(time: number) {
      if (disposed) return;
      const now = performance.now();
      fc++; fa += now - lt; lt = now;
      if (fa >= 500) { setFps(Math.round(fc / (fa / 1000))); fc = 0; fa = 0; }
      grassMat.uniforms.uTime.value = time;
      controls.update();

      renderer.render(scene, cam);
      requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);

    const ro = new ResizeObserver(() => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth, h = containerRef.current.clientHeight;
      renderer.setSize(w, h);
      cam.aspect = w / h;
      cam.updateProjectionMatrix();
    });
    if (containerRef.current) ro.observe(containerRef.current);

    return () => {
      disposed = true;
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('wheel', onWheel, { capture: true } as EventListenerOptions);
      ro.disconnect();
      renderer.dispose();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-black">
      <canvas ref={canvasRef} className="h-full w-full" />

      {/* Pan mode indicator */}
      {panMode && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 rounded-lg bg-amber-600/90 px-3 py-1 text-xs text-white select-none">
          PAN MODE — double-click to exit
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-2 left-2 flex gap-2">
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">FPS: {ready ? fps : '--'}</span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">Three.js</span>
        <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-gray-400">
          Left click: sculpt &bull; Right drag: orbit &bull; Scroll: orbit &bull; Pinch: zoom &bull; Dbl-click: pan mode
        </span>
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <span className="text-sm text-gray-400">Loading...</span>
        </div>
      )}
    </div>
  );
}

/**
 * Phase 8 -- Terrain Scripting API
 *
 * Registers the `pb.terrain` namespace in the QuickJS sandbox so student
 * scripts can create, read, and modify voxel terrain programmatically.
 *
 * Fill operations: ball, block, cylinder, region, wedge.
 * Read/write: readVoxels, writeVoxels, getHeight, getMaterial, setVoxel, clear.
 * Properties: water, decoration, material color overrides.
 * Safety: per-fill voxel cap, per-frame write budget, script timeout.
 */

import { VOXEL_SIZE } from "../voxel/constants.js";
import {
  TerrainMaterial,
  MATERIAL_DEFS,
  materialNameToEnum,
  materialEnumToName,
} from "../voxel/terrain-materials.js";
import type { VoxelGrid } from "../voxel/voxel-grid.js";
import type { WaterProperties } from "../rendering/water-voxel-renderer.js";
import type { QuickJSRuntime } from "../../scripting/quickjs-runtime.js";

// ── Safety Limits ──────────────────────────────────────────────────────

/** Maximum voxels a single fill operation may write. */
export const MAX_VOXELS_PER_FILL = 100_000;

/** Maximum total voxel writes allowed per frame across all script calls. */
export const MAX_VOXELS_PER_FRAME = 500_000;

/** Script execution timeout in milliseconds. */
export const SCRIPT_TIMEOUT_MS = 5_000;

// ── Frame budget tracker ───────────────────────────────────────────────

let _frameWriteCount = 0;

/** Call at the start of each frame to reset the per-frame voxel budget. */
export function resetFrameBudget(): void {
  _frameWriteCount = 0;
}

function consumeBudget(count: number): void {
  _frameWriteCount += count;
  if (_frameWriteCount > MAX_VOXELS_PER_FRAME) {
    throw new Error(
      `Terrain script exceeded per-frame voxel write limit ` +
        `(${MAX_VOXELS_PER_FRAME.toLocaleString()} voxels). ` +
        `Wrote ${_frameWriteCount.toLocaleString()} this frame.`,
    );
  }
}

function checkFillLimit(count: number): void {
  if (count > MAX_VOXELS_PER_FILL) {
    throw new Error(
      `Fill operation would write ${count.toLocaleString()} voxels, ` +
        `exceeding the per-fill limit of ${MAX_VOXELS_PER_FILL.toLocaleString()}.`,
    );
  }
}

// ── Material resolution ────────────────────────────────────────────────

function resolveMaterial(nameOrId: string | number): TerrainMaterial {
  if (typeof nameOrId === "number") return nameOrId as TerrainMaterial;
  return materialNameToEnum(nameOrId);
}

// ── Fill geometry helpers ──────────────────────────────────────────────

/**
 * Fill a sphere of voxels.
 * Center and radius are in world units; voxels are snapped to the grid.
 */
export function fillBall(
  grid: VoxelGrid,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  material: TerrainMaterial,
): number {
  const r = Math.ceil(radius / VOXEL_SIZE);
  const rSq = (radius * radius) / (VOXEL_SIZE * VOXEL_SIZE);

  // Pre-count to check limit
  let count = 0;
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dy * dy + dz * dz <= rSq) count++;
      }
    }
  }
  checkFillLimit(count);
  consumeBudget(count);

  // Write voxels
  const baseX = Math.floor(cx / VOXEL_SIZE) * VOXEL_SIZE;
  const baseY = Math.floor(cy / VOXEL_SIZE) * VOXEL_SIZE;
  const baseZ = Math.floor(cz / VOXEL_SIZE) * VOXEL_SIZE;

  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dz = -r; dz <= r; dz++) {
        if (dx * dx + dy * dy + dz * dz <= rSq) {
          grid.setVoxel(
            baseX + dx * VOXEL_SIZE,
            baseY + dy * VOXEL_SIZE,
            baseZ + dz * VOXEL_SIZE,
            1.0,
            material,
          );
        }
      }
    }
  }
  return count;
}

/**
 * Fill a box of voxels.
 * Position is the corner; size is extent in world units along each axis.
 */
export function fillBlock(
  grid: VoxelGrid,
  px: number,
  py: number,
  pz: number,
  sx: number,
  sy: number,
  sz: number,
  material: TerrainMaterial,
): number {
  const nx = Math.ceil(Math.abs(sx) / VOXEL_SIZE);
  const ny = Math.ceil(Math.abs(sy) / VOXEL_SIZE);
  const nz = Math.ceil(Math.abs(sz) / VOXEL_SIZE);
  const count = nx * ny * nz;
  checkFillLimit(count);
  consumeBudget(count);

  const startX = Math.floor(px / VOXEL_SIZE) * VOXEL_SIZE;
  const startY = Math.floor(py / VOXEL_SIZE) * VOXEL_SIZE;
  const startZ = Math.floor(pz / VOXEL_SIZE) * VOXEL_SIZE;

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        grid.setVoxel(
          startX + ix * VOXEL_SIZE,
          startY + iy * VOXEL_SIZE,
          startZ + iz * VOXEL_SIZE,
          1.0,
          material,
        );
      }
    }
  }
  return count;
}

/**
 * Fill a cylinder of voxels.
 * Position is the base center; height extends upward (+Y).
 */
export function fillCylinder(
  grid: VoxelGrid,
  px: number,
  py: number,
  pz: number,
  height: number,
  radius: number,
  material: TerrainMaterial,
): number {
  const r = Math.ceil(radius / VOXEL_SIZE);
  const h = Math.ceil(height / VOXEL_SIZE);
  const rSq = (radius * radius) / (VOXEL_SIZE * VOXEL_SIZE);

  // Pre-count
  let count = 0;
  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz <= rSq) count += h;
    }
  }
  checkFillLimit(count);
  consumeBudget(count);

  const baseX = Math.floor(px / VOXEL_SIZE) * VOXEL_SIZE;
  const baseY = Math.floor(py / VOXEL_SIZE) * VOXEL_SIZE;
  const baseZ = Math.floor(pz / VOXEL_SIZE) * VOXEL_SIZE;

  for (let dx = -r; dx <= r; dx++) {
    for (let dz = -r; dz <= r; dz++) {
      if (dx * dx + dz * dz <= rSq) {
        for (let iy = 0; iy < h; iy++) {
          grid.setVoxel(
            baseX + dx * VOXEL_SIZE,
            baseY + iy * VOXEL_SIZE,
            baseZ + dz * VOXEL_SIZE,
            1.0,
            material,
          );
        }
      }
    }
  }
  return count;
}

/**
 * Fill a rectangular region (min → max, inclusive, in world units).
 */
export function fillRegionAPI(
  grid: VoxelGrid,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
  material: TerrainMaterial,
): number {
  const nx = Math.ceil(Math.abs(maxX - minX) / VOXEL_SIZE) || 1;
  const ny = Math.ceil(Math.abs(maxY - minY) / VOXEL_SIZE) || 1;
  const nz = Math.ceil(Math.abs(maxZ - minZ) / VOXEL_SIZE) || 1;
  const count = nx * ny * nz;
  checkFillLimit(count);
  consumeBudget(count);

  const sX = Math.min(minX, maxX);
  const sY = Math.min(minY, maxY);
  const sZ = Math.min(minZ, maxZ);
  const startX = Math.floor(sX / VOXEL_SIZE) * VOXEL_SIZE;
  const startY = Math.floor(sY / VOXEL_SIZE) * VOXEL_SIZE;
  const startZ = Math.floor(sZ / VOXEL_SIZE) * VOXEL_SIZE;

  for (let ix = 0; ix < nx; ix++) {
    for (let iy = 0; iy < ny; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        grid.setVoxel(
          startX + ix * VOXEL_SIZE,
          startY + iy * VOXEL_SIZE,
          startZ + iz * VOXEL_SIZE,
          1.0,
          material,
        );
      }
    }
  }
  return count;
}

/**
 * Fill a wedge (ramp) of voxels.
 * Position is the corner; size is the extent. The wedge slopes along +X,
 * with full height at x=0 tapering to zero at x=sx.
 */
export function fillWedge(
  grid: VoxelGrid,
  px: number,
  py: number,
  pz: number,
  sx: number,
  sy: number,
  sz: number,
  material: TerrainMaterial,
): number {
  const nx = Math.ceil(Math.abs(sx) / VOXEL_SIZE);
  const ny = Math.ceil(Math.abs(sy) / VOXEL_SIZE);
  const nz = Math.ceil(Math.abs(sz) / VOXEL_SIZE);

  // Pre-count: wedge is a right triangle in XY profile
  let count = 0;
  for (let ix = 0; ix < nx; ix++) {
    const maxY = Math.ceil(ny * (1 - ix / nx));
    count += maxY * nz;
  }
  checkFillLimit(count);
  consumeBudget(count);

  const startX = Math.floor(px / VOXEL_SIZE) * VOXEL_SIZE;
  const startY = Math.floor(py / VOXEL_SIZE) * VOXEL_SIZE;
  const startZ = Math.floor(pz / VOXEL_SIZE) * VOXEL_SIZE;

  for (let ix = 0; ix < nx; ix++) {
    const maxYForSlice = Math.ceil(ny * (1 - ix / nx));
    for (let iy = 0; iy < maxYForSlice; iy++) {
      for (let iz = 0; iz < nz; iz++) {
        grid.setVoxel(
          startX + ix * VOXEL_SIZE,
          startY + iy * VOXEL_SIZE,
          startZ + iz * VOXEL_SIZE,
          1.0,
          material,
        );
      }
    }
  }
  return count;
}

// ── Read helpers ───────────────────────────────────────────────────────

/**
 * Read a 3D region of voxels as flat arrays.
 * Returns { materials: number[], occupancy: number[], sizeX, sizeY, sizeZ }.
 */
export function readVoxels(
  grid: VoxelGrid,
  minX: number,
  minY: number,
  minZ: number,
  maxX: number,
  maxY: number,
  maxZ: number,
): {
  materials: number[];
  occupancy: number[];
  sizeX: number;
  sizeY: number;
  sizeZ: number;
} {
  const sX = Math.min(minX, maxX);
  const sY = Math.min(minY, maxY);
  const sZ = Math.min(minZ, maxZ);
  const sizeX = Math.ceil(Math.abs(maxX - minX) / VOXEL_SIZE) || 1;
  const sizeY = Math.ceil(Math.abs(maxY - minY) / VOXEL_SIZE) || 1;
  const sizeZ = Math.ceil(Math.abs(maxZ - minZ) / VOXEL_SIZE) || 1;

  const total = sizeX * sizeY * sizeZ;
  const materials: number[] = new Array(total);
  const occupancy: number[] = new Array(total);

  let idx = 0;
  const startX = Math.floor(sX / VOXEL_SIZE) * VOXEL_SIZE;
  const startY = Math.floor(sY / VOXEL_SIZE) * VOXEL_SIZE;
  const startZ = Math.floor(sZ / VOXEL_SIZE) * VOXEL_SIZE;

  for (let ix = 0; ix < sizeX; ix++) {
    for (let iy = 0; iy < sizeY; iy++) {
      for (let iz = 0; iz < sizeZ; iz++) {
        const v = grid.getVoxel(
          startX + ix * VOXEL_SIZE,
          startY + iy * VOXEL_SIZE,
          startZ + iz * VOXEL_SIZE,
        );
        materials[idx] = v.material;
        occupancy[idx] = v.occupancy;
        idx++;
      }
    }
  }

  return { materials, occupancy, sizeX, sizeY, sizeZ };
}

/**
 * Write a 3D region of voxels from flat arrays.
 */
export function writeVoxels(
  grid: VoxelGrid,
  minX: number,
  minY: number,
  minZ: number,
  sizeX: number,
  sizeY: number,
  sizeZ: number,
  materials: number[],
  occupancy: number[],
): number {
  const count = sizeX * sizeY * sizeZ;
  checkFillLimit(count);
  consumeBudget(count);

  const startX = Math.floor(minX / VOXEL_SIZE) * VOXEL_SIZE;
  const startY = Math.floor(minY / VOXEL_SIZE) * VOXEL_SIZE;
  const startZ = Math.floor(minZ / VOXEL_SIZE) * VOXEL_SIZE;

  let idx = 0;
  for (let ix = 0; ix < sizeX; ix++) {
    for (let iy = 0; iy < sizeY; iy++) {
      for (let iz = 0; iz < sizeZ; iz++) {
        grid.setVoxel(
          startX + ix * VOXEL_SIZE,
          startY + iy * VOXEL_SIZE,
          startZ + iz * VOXEL_SIZE,
          occupancy[idx] ?? 0,
          (materials[idx] ?? 0) as TerrainMaterial,
        );
        idx++;
      }
    }
  }
  return count;
}

/**
 * Scan downward from Y=maxY to find the first solid voxel at (x, z).
 * Returns the world Y of the top surface, or 0 if no terrain found.
 */
export function getHeight(
  grid: VoxelGrid,
  x: number,
  z: number,
  maxScanY = 1024,
): number {
  const wx = Math.floor(x / VOXEL_SIZE) * VOXEL_SIZE;
  const wz = Math.floor(z / VOXEL_SIZE) * VOXEL_SIZE;
  for (let wy = maxScanY; wy >= -maxScanY; wy -= VOXEL_SIZE) {
    const v = grid.getVoxel(wx, wy, wz);
    if (v.occupancy > 0 && v.material !== TerrainMaterial.Air) {
      return wy + VOXEL_SIZE; // top of the voxel
    }
  }
  return 0;
}

// ── Water + decoration property state ──────────────────────────────────

export interface TerrainAPIState {
  grid: VoxelGrid;
  waterProps: WaterProperties;
  decoration: boolean;
  grassLength: number;
  materialColorOverrides: Map<TerrainMaterial, { r: number; g: number; b: number }>;
}

// ── QuickJS registration ───────────────────────────────────────────────

/**
 * Register all `pb.terrain.*` functions into the QuickJS runtime.
 *
 * Call this once after `QuickJSRuntime.init()` and before loading
 * student code. The runtime's `registerHostFunction` puts functions
 * under the existing `pb` global namespace, but we need a sub-object
 * (`pb.terrain`), so we inject a small JS shim to create the
 * namespace and delegate to flat host functions.
 */
export function registerTerrainBindings(
  runtime: QuickJSRuntime,
  state: TerrainAPIState,
): void {
  const { grid } = state;

  // ── Fill operations (8.1) ──────────────────────────────────────────

  runtime.registerHostFunction("__terrain_fillBall", (...args: unknown[]) => {
    const [cx, cy, cz, radius, matName] = args as [number, number, number, number, string];
    return fillBall(grid, cx, cy, cz, radius, resolveMaterial(matName));
  });

  runtime.registerHostFunction("__terrain_fillBlock", (...args: unknown[]) => {
    const [px, py, pz, sx, sy, sz, matName] = args as [number, number, number, number, number, number, string];
    return fillBlock(grid, px, py, pz, sx, sy, sz, resolveMaterial(matName));
  });

  runtime.registerHostFunction("__terrain_fillCylinder", (...args: unknown[]) => {
    const [px, py, pz, height, radius, matName] = args as [number, number, number, number, number, string];
    return fillCylinder(grid, px, py, pz, height, radius, resolveMaterial(matName));
  });

  runtime.registerHostFunction("__terrain_fillRegion", (...args: unknown[]) => {
    const [minX, minY, minZ, maxX, maxY, maxZ, matName] = args as [number, number, number, number, number, number, string];
    return fillRegionAPI(grid, minX, minY, minZ, maxX, maxY, maxZ, resolveMaterial(matName));
  });

  runtime.registerHostFunction("__terrain_fillWedge", (...args: unknown[]) => {
    const [px, py, pz, sx, sy, sz, matName] = args as [number, number, number, number, number, number, string];
    return fillWedge(grid, px, py, pz, sx, sy, sz, resolveMaterial(matName));
  });

  // ── Read/write methods (8.2) ───────────────────────────────────────

  runtime.registerHostFunction("__terrain_setVoxel", (...args: unknown[]) => {
    const [x, y, z, occ, matName] = args as [number, number, number, number, string];
    consumeBudget(1);
    grid.setVoxel(x, y, z, occ, resolveMaterial(matName));
    return 0;
  });

  runtime.registerHostFunction("__terrain_getMaterial", (...args: unknown[]) => {
    const [x, y, z] = args as [number, number, number];
    const v = grid.getVoxel(x, y, z);
    return materialEnumToName(v.material);
  });

  runtime.registerHostFunction("__terrain_getHeight", (...args: unknown[]) => {
    const [x, z] = args as [number, number];
    return getHeight(grid, x, z);
  });

  runtime.registerHostFunction("__terrain_readVoxels", (...args: unknown[]) => {
    const [minX, minY, minZ, maxX, maxY, maxZ] = args as [number, number, number, number, number, number];
    const result = readVoxels(grid, minX, minY, minZ, maxX, maxY, maxZ);
    // Return as JSON string — QuickJS host functions can only return number|string
    return JSON.stringify(result);
  });

  runtime.registerHostFunction("__terrain_writeVoxels", (...args: unknown[]) => {
    const [minX, minY, minZ, dataJson] = args as [number, number, number, string];
    const data = JSON.parse(dataJson) as {
      sizeX: number;
      sizeY: number;
      sizeZ: number;
      materials: number[];
      occupancy: number[];
    };
    return writeVoxels(
      grid,
      minX,
      minY,
      minZ,
      data.sizeX,
      data.sizeY,
      data.sizeZ,
      data.materials,
      data.occupancy,
    );
  });

  runtime.registerHostFunction("__terrain_clear", () => {
    grid.clearAll();
    return 0;
  });

  // ── Properties (8.3) ───────────────────────────────────────────────

  runtime.registerHostFunction("__terrain_getWaterColor", () => {
    const c = state.waterProps.color;
    return JSON.stringify({ r: c.r, g: c.g, b: c.b });
  });

  runtime.registerHostFunction("__terrain_setWaterColor", (...args: unknown[]) => {
    const [r, g, b] = args as [number, number, number];
    state.waterProps.color = { r, g, b };
    return 0;
  });

  runtime.registerHostFunction("__terrain_getWaterProp", (...args: unknown[]) => {
    const [prop] = args as [string];
    switch (prop) {
      case "reflectance":
        return state.waterProps.reflectance;
      case "transparency":
        return state.waterProps.transparency;
      case "waveSize":
        return state.waterProps.waveSize;
      case "waveSpeed":
        return state.waterProps.waveSpeed;
      default:
        return 0;
    }
  });

  runtime.registerHostFunction("__terrain_setWaterProp", (...args: unknown[]) => {
    const [prop, value] = args as [string, number];
    switch (prop) {
      case "reflectance":
        state.waterProps.reflectance = value;
        break;
      case "transparency":
        state.waterProps.transparency = value;
        break;
      case "waveSize":
        state.waterProps.waveSize = value;
        break;
      case "waveSpeed":
        state.waterProps.waveSpeed = value;
        break;
    }
    return 0;
  });

  runtime.registerHostFunction("__terrain_getDecoration", () => {
    return state.decoration ? 1 : 0;
  });

  runtime.registerHostFunction("__terrain_setDecoration", (...args: unknown[]) => {
    const [val] = args as [number];
    state.decoration = val !== 0;
    return 0;
  });

  runtime.registerHostFunction("__terrain_getGrassLength", () => {
    return state.grassLength;
  });

  runtime.registerHostFunction("__terrain_setGrassLength", (...args: unknown[]) => {
    const [val] = args as [number];
    state.grassLength = Math.max(0.1, Math.min(1.0, val));
    return 0;
  });

  runtime.registerHostFunction("__terrain_setMaterialColor", (...args: unknown[]) => {
    const [matName, r, g, b] = args as [string, number, number, number];
    const mat = resolveMaterial(matName);
    state.materialColorOverrides.set(mat, { r, g, b });
    return 0;
  });

  runtime.registerHostFunction("__terrain_getMaterialColor", (...args: unknown[]) => {
    const [matName] = args as [string];
    const mat = resolveMaterial(matName);
    const override = state.materialColorOverrides.get(mat);
    if (override) {
      return JSON.stringify(override);
    }
    const def = MATERIAL_DEFS[mat];
    return JSON.stringify({ r: def.color[0], g: def.color[1], b: def.color[2] });
  });

  runtime.registerHostFunction("__terrain_resetMaterialColor", (...args: unknown[]) => {
    const [matName] = args as [string];
    const mat = resolveMaterial(matName);
    state.materialColorOverrides.delete(mat);
    return 0;
  });
}

// ── JS shim injected into QuickJS after host functions are registered ──

/**
 * Returns the JavaScript code to execute inside QuickJS that creates the
 * `pb.terrain` namespace, delegating each method to the flat host functions.
 */
export function getTerrainNamespaceShim(): string {
  return `
(function() {
  if (!pb) throw new Error("pb namespace not found");

  pb.terrain = {
    // ── Fill operations ──
    fillBall: function(center, radius, material) {
      return pb.__terrain_fillBall(center.x, center.y, center.z, radius, material);
    },
    fillBlock: function(position, size, material) {
      return pb.__terrain_fillBlock(position.x, position.y, position.z, size.x, size.y, size.z, material);
    },
    fillCylinder: function(position, height, radius, material) {
      return pb.__terrain_fillCylinder(position.x, position.y, position.z, height, radius, material);
    },
    fillRegion: function(min, max, material) {
      return pb.__terrain_fillRegion(min.x, min.y, min.z, max.x, max.y, max.z, material);
    },
    fillWedge: function(position, size, material) {
      return pb.__terrain_fillWedge(position.x, position.y, position.z, size.x, size.y, size.z, material);
    },

    // ── Read/write ──
    setVoxel: function(x, y, z, occupancy, material) {
      return pb.__terrain_setVoxel(x, y, z, occupancy, material);
    },
    getMaterial: function(x, y, z) {
      return pb.__terrain_getMaterial(x, y, z);
    },
    getHeight: function(x, z) {
      return pb.__terrain_getHeight(x, z);
    },
    readVoxels: function(min, max) {
      return JSON.parse(pb.__terrain_readVoxels(min.x, min.y, min.z, max.x, max.y, max.z));
    },
    writeVoxels: function(min, data) {
      return pb.__terrain_writeVoxels(min.x, min.y, min.z, JSON.stringify(data));
    },
    clear: function() {
      return pb.__terrain_clear();
    },

    // ── Properties ──
    get waterColor() {
      return JSON.parse(pb.__terrain_getWaterColor());
    },
    set waterColor(c) {
      pb.__terrain_setWaterColor(c.r, c.g, c.b);
    },
    get waterReflectance() { return pb.__terrain_getWaterProp("reflectance"); },
    set waterReflectance(v) { pb.__terrain_setWaterProp("reflectance", v); },
    get waterTransparency() { return pb.__terrain_getWaterProp("transparency"); },
    set waterTransparency(v) { pb.__terrain_setWaterProp("transparency", v); },
    get waterWaveSize() { return pb.__terrain_getWaterProp("waveSize"); },
    set waterWaveSize(v) { pb.__terrain_setWaterProp("waveSize", v); },
    get waterWaveSpeed() { return pb.__terrain_getWaterProp("waveSpeed"); },
    set waterWaveSpeed(v) { pb.__terrain_setWaterProp("waveSpeed", v); },
    get decoration() { return pb.__terrain_getDecoration() !== 0; },
    set decoration(v) { pb.__terrain_setDecoration(v ? 1 : 0); },
    get grassLength() { return pb.__terrain_getGrassLength(); },
    set grassLength(v) { pb.__terrain_setGrassLength(v); },

    setMaterialColor: function(name, color) {
      return pb.__terrain_setMaterialColor(name, color.r, color.g, color.b);
    },
    getMaterialColor: function(name) {
      return JSON.parse(pb.__terrain_getMaterialColor(name));
    },
    resetMaterialColor: function(name) {
      return pb.__terrain_resetMaterialColor(name);
    },
  };
})();
`;
}

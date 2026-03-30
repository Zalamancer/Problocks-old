/**
 * Section 1.1 -- Voxel Terrain Material Definitions
 *
 * Defines all terrain material types, their visual properties, and
 * physics characteristics. RGB values match Roblox material palette.
 */

// ── Enum ─────────────────────────────────────────────────────────────

export const enum TerrainMaterial {
  Air          = 0,
  Grass        = 1,
  Sand         = 2,
  Rock         = 3,
  Snow         = 4,
  Water        = 5,
  Mud          = 6,
  Ground       = 7,
  Ice          = 8,
  Sandstone    = 9,
  Slate        = 10,
  Concrete     = 11,
  Limestone    = 12,
  Basalt       = 13,
  Brick        = 14,
  Cobblestone  = 15,
  Asphalt      = 16,
  Pavement     = 17,
  Salt         = 18,
  CrackedLava  = 19,
  Glacier      = 20,
  LeafyGrass   = 21,
  WoodPlanks   = 22,
}

// ── Interface ────────────────────────────────────────────────────────

export interface TerrainMaterialDef {
  id: TerrainMaterial;
  name: string;
  color: [number, number, number];
  hex: string;
  friction: number;
  restitution: number;
  isTransparent: boolean;
  isEmissive: boolean;
  isAnimated: boolean;
  textureScale: number;
}

// ── Material count ───────────────────────────────────────────────────

export const MATERIAL_COUNT = 23;

// ── Material definitions ─────────────────────────────────────────────

export const MATERIAL_DEFS: Record<TerrainMaterial, TerrainMaterialDef> = {
  [TerrainMaterial.Air]: {
    id: TerrainMaterial.Air,
    name: "Air",
    color: [255, 255, 255],
    hex: "#FFFFFF",
    friction: 0.0,
    restitution: 0.0,
    isTransparent: true,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Grass]: {
    id: TerrainMaterial.Grass,
    name: "Grass",
    color: [106, 127, 63],
    hex: "#6A7F3F",
    friction: 0.6,
    restitution: 0.1,
    isTransparent: false,
    isEmissive: false,
    isAnimated: true,
    textureScale: 1.0,
  },
  [TerrainMaterial.Sand]: {
    id: TerrainMaterial.Sand,
    name: "Sand",
    color: [143, 126, 95],
    hex: "#8F7E5F",
    friction: 0.45,
    restitution: 0.05,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Rock]: {
    id: TerrainMaterial.Rock,
    name: "Rock",
    color: [102, 108, 111],
    hex: "#666C6F",
    friction: 0.7,
    restitution: 0.2,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Snow]: {
    id: TerrainMaterial.Snow,
    name: "Snow",
    color: [195, 199, 218],
    hex: "#C3C7DA",
    friction: 0.3,
    restitution: 0.05,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Water]: {
    id: TerrainMaterial.Water,
    name: "Water",
    color: [12, 84, 92],
    hex: "#0C545C",
    friction: 0.1,
    restitution: 0.0,
    isTransparent: true,
    isEmissive: false,
    isAnimated: true,
    textureScale: 1.0,
  },
  [TerrainMaterial.Mud]: {
    id: TerrainMaterial.Mud,
    name: "Mud",
    color: [58, 46, 36],
    hex: "#3A2E24",
    friction: 0.35,
    restitution: 0.02,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Ground]: {
    id: TerrainMaterial.Ground,
    name: "Ground",
    color: [102, 92, 59],
    hex: "#665C3B",
    friction: 0.55,
    restitution: 0.1,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Ice]: {
    id: TerrainMaterial.Ice,
    name: "Ice",
    color: [129, 194, 224],
    hex: "#81C2E0",
    friction: 0.05,
    restitution: 0.3,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Sandstone]: {
    id: TerrainMaterial.Sandstone,
    name: "Sandstone",
    color: [137, 90, 71],
    hex: "#895A47",
    friction: 0.65,
    restitution: 0.15,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Slate]: {
    id: TerrainMaterial.Slate,
    name: "Slate",
    color: [63, 127, 107],
    hex: "#3F7F6B",
    friction: 0.55,
    restitution: 0.2,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Concrete]: {
    id: TerrainMaterial.Concrete,
    name: "Concrete",
    color: [127, 102, 63],
    hex: "#7F663F",
    friction: 0.75,
    restitution: 0.15,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Limestone]: {
    id: TerrainMaterial.Limestone,
    name: "Limestone",
    color: [206, 173, 148],
    hex: "#CEAD94",
    friction: 0.6,
    restitution: 0.15,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Basalt]: {
    id: TerrainMaterial.Basalt,
    name: "Basalt",
    color: [30, 30, 37],
    hex: "#1E1E25",
    friction: 0.7,
    restitution: 0.25,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Brick]: {
    id: TerrainMaterial.Brick,
    name: "Brick",
    color: [138, 86, 62],
    hex: "#8A563E",
    friction: 0.7,
    restitution: 0.15,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Cobblestone]: {
    id: TerrainMaterial.Cobblestone,
    name: "Cobblestone",
    color: [132, 123, 90],
    hex: "#847B5A",
    friction: 0.75,
    restitution: 0.2,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Asphalt]: {
    id: TerrainMaterial.Asphalt,
    name: "Asphalt",
    color: [115, 123, 107],
    hex: "#737B6B",
    friction: 0.8,
    restitution: 0.1,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Pavement]: {
    id: TerrainMaterial.Pavement,
    name: "Pavement",
    color: [148, 148, 140],
    hex: "#94948C",
    friction: 0.75,
    restitution: 0.1,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Salt]: {
    id: TerrainMaterial.Salt,
    name: "Salt",
    color: [198, 189, 181],
    hex: "#C6BDB5",
    friction: 0.5,
    restitution: 0.1,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.CrackedLava]: {
    id: TerrainMaterial.CrackedLava,
    name: "CrackedLava",
    color: [232, 156, 74],
    hex: "#E89C4A",
    friction: 0.7,
    restitution: 0.1,
    isTransparent: false,
    isEmissive: true,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.Glacier]: {
    id: TerrainMaterial.Glacier,
    name: "Glacier",
    color: [101, 176, 234],
    hex: "#65B0EA",
    friction: 0.08,
    restitution: 0.25,
    isTransparent: true,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
  [TerrainMaterial.LeafyGrass]: {
    id: TerrainMaterial.LeafyGrass,
    name: "LeafyGrass",
    color: [115, 132, 74],
    hex: "#73844A",
    friction: 0.55,
    restitution: 0.1,
    isTransparent: false,
    isEmissive: false,
    isAnimated: true,
    textureScale: 1.0,
  },
  [TerrainMaterial.WoodPlanks]: {
    id: TerrainMaterial.WoodPlanks,
    name: "WoodPlanks",
    color: [139, 109, 79],
    hex: "#8B6D4F",
    friction: 0.6,
    restitution: 0.15,
    isTransparent: false,
    isEmissive: false,
    isAnimated: false,
    textureScale: 1.0,
  },
};

// ── Lookup helpers ───────────────────────────────────────────────────

/** Build a case-insensitive name -> enum map at module load. */
const _nameToEnum = new Map<string, TerrainMaterial>();
const _enumToName = new Map<TerrainMaterial, string>();

for (let i = 0; i < MATERIAL_COUNT; i++) {
  const def = MATERIAL_DEFS[i as TerrainMaterial];
  _nameToEnum.set(def.name.toLowerCase(), def.id);
  _enumToName.set(def.id, def.name);
}

/**
 * Case-insensitive lookup of a terrain material by name.
 * @throws Error if the name is not a known material.
 */
export function materialNameToEnum(name: string): TerrainMaterial {
  const result = _nameToEnum.get(name.toLowerCase());
  if (result === undefined) {
    throw new Error(`Unknown terrain material name: "${name}"`);
  }
  return result;
}

/**
 * Get the display name for a terrain material enum value.
 * @throws Error if the id is not a known material.
 */
export function materialEnumToName(id: TerrainMaterial): string {
  const result = _enumToName.get(id);
  if (result === undefined) {
    throw new Error(`Unknown terrain material id: ${id}`);
  }
  return result;
}

// ── Color overrides & presets ───────────────────────────────────────

export type ColorOverrideMap = Map<number, [number, number, number]>;
export type TerrainColorPreset = 'default' | 'fantasy' | 'tundra';

export const TERRAIN_COLOR_PRESETS: Record<TerrainColorPreset, ColorOverrideMap | null> = {
  default: null,
  fantasy: new Map<number, [number, number, number]>([
    [TerrainMaterial.Grass,      [128, 60, 180]],
    [TerrainMaterial.Rock,       [200, 120, 50]],
    [TerrainMaterial.Sand,       [255, 200, 100]],
    [TerrainMaterial.Snow,       [200, 180, 255]],
    [TerrainMaterial.LeafyGrass, [100, 40, 160]],
    [TerrainMaterial.Ground,     [140, 80, 40]],
  ]),
  tundra: new Map<number, [number, number, number]>([
    [TerrainMaterial.Grass,      [140, 160, 170]],
    [TerrainMaterial.Rock,       [100, 110, 120]],
    [TerrainMaterial.Sand,       [170, 170, 165]],
    [TerrainMaterial.Ground,     [110, 115, 120]],
    [TerrainMaterial.LeafyGrass, [130, 150, 155]],
    [TerrainMaterial.Mud,        [70, 70, 75]],
    [TerrainMaterial.Limestone,  [180, 180, 185]],
  ]),
};

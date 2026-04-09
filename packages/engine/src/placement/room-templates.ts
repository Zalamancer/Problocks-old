/**
 * Built-in room templates with realistic furniture and constraints.
 *
 * Each template defines required/optional/decoration objects with
 * placement rules that produce believable room layouts.
 */

import type { RoomType, RoomTemplate, PlaceableObject } from './types.js';

// ── Helper: create a placeable object ───────────────────────────

function obj(
  assetId: string,
  name: string,
  category: string,
  width: number,
  height: number,
  rules: PlaceableObject['rules'],
  extra?: Partial<PlaceableObject>,
): PlaceableObject {
  return {
    assetId,
    name,
    category,
    size: { width, height },
    rules,
    ...extra,
  };
}

// ── Kitchen ─────────────────────────────────────────────────────

const kitchenTemplate: RoomTemplate = {
  roomType: 'kitchen',
  requiredObjects: [
    obj('kitchen-stove', 'Stove', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'away-from-door', params: { distance: 2 } },
    ], { required: true, minCount: 1, maxCount: 1 }),
    obj('kitchen-sink', 'Sink', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'near', params: { tag: 'stove', distance: 4 } },
    ], { required: true, minCount: 1, maxCount: 1 }),
  ],
  optionalObjects: [
    obj('kitchen-table', 'Kitchen Table', 'furniture', 2, 2, [
      { type: 'center-room' },
      { type: 'min-spacing', params: { distance: 1, tag: 'furniture' } },
    ], { maxCount: 1, weight: 0.8 }),
    obj('kitchen-chair', 'Chair', 'furniture', 1, 1, [
      { type: 'near', params: { tag: 'table', distance: 2 } },
      { type: 'min-spacing', params: { distance: 1, tag: 'chair' } },
    ], { maxCount: 4, weight: 0.7 }),
    obj('kitchen-shelf', 'Kitchen Shelf', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 2, tag: 'shelf' } },
    ], { maxCount: 2, weight: 0.5 }),
    obj('kitchen-barrel', 'Barrel', 'furniture', 1, 1, [
      { type: 'near-wall', params: { wallDistance: 2 } },
      { type: 'corner' },
    ], { maxCount: 2, weight: 0.4 }),
  ],
  decorations: [
    obj('kitchen-pot', 'Cooking Pot', 'decoration', 1, 1, [
      { type: 'near', params: { tag: 'stove', distance: 2 } },
    ], { maxCount: 2, weight: 0.6 }),
    obj('kitchen-plate', 'Plate', 'decoration', 1, 1, [
      { type: 'near', params: { tag: 'table', distance: 2 } },
    ], { maxCount: 3, weight: 0.5 }),
    obj('kitchen-knife-rack', 'Knife Rack', 'decoration', 1, 1, [
      { type: 'against-wall' },
      { type: 'near', params: { tag: 'stove', distance: 3 } },
    ], { maxCount: 1, weight: 0.4 }),
  ],
  floorStyle: 'stone-tile',
  maxFillPercent: 0.55,
};

// ── Bedroom ─────────────────────────────────────────────────────

const bedroomTemplate: RoomTemplate = {
  roomType: 'bedroom',
  requiredObjects: [
    obj('bedroom-bed', 'Bed', 'furniture', 2, 3, [
      { type: 'against-wall' },
      { type: 'away-from-door', params: { distance: 2 } },
    ], { required: true, minCount: 1, maxCount: 1 }),
  ],
  optionalObjects: [
    obj('bedroom-nightstand', 'Nightstand', 'furniture', 1, 1, [
      { type: 'near', params: { tag: 'bed', distance: 2 } },
      { type: 'against-wall' },
    ], { maxCount: 2, weight: 0.7 }),
    obj('bedroom-wardrobe', 'Wardrobe', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'avoid', params: { tag: 'bed', distance: 3 } },
    ], { maxCount: 1, weight: 0.6 }),
    obj('bedroom-desk', 'Desk', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'avoid', params: { tag: 'bed', distance: 2 } },
    ], { maxCount: 1, weight: 0.5 }),
    obj('bedroom-chair', 'Chair', 'furniture', 1, 1, [
      { type: 'near', params: { tag: 'desk', distance: 2 } },
    ], { maxCount: 1, weight: 0.4 }),
  ],
  decorations: [
    obj('bedroom-candle', 'Candle', 'decoration', 1, 1, [
      { type: 'near', params: { tag: 'nightstand', distance: 1 } },
    ], { maxCount: 2, weight: 0.6 }),
    obj('bedroom-rug', 'Rug', 'decoration', 2, 2, [
      { type: 'center-room' },
    ], { maxCount: 1, weight: 0.5 }),
    obj('bedroom-painting', 'Painting', 'decoration', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 3, tag: 'painting' } },
    ], { maxCount: 2, weight: 0.4 }),
  ],
  floorStyle: 'wood-plank',
  maxFillPercent: 0.5,
};

// ── Tavern ──────────────────────────────────────────────────────

const tavernTemplate: RoomTemplate = {
  roomType: 'tavern',
  requiredObjects: [
    obj('tavern-bar', 'Bar Counter', 'furniture', 4, 1, [
      { type: 'against-wall' },
      { type: 'away-from-door', params: { distance: 3 } },
    ], { required: true, minCount: 1, maxCount: 1 }),
    obj('tavern-stool', 'Bar Stool', 'furniture', 1, 1, [
      { type: 'near', params: { tag: 'bar', distance: 2 } },
      { type: 'min-spacing', params: { distance: 1, tag: 'stool' } },
    ], { required: true, minCount: 3, maxCount: 5 }),
  ],
  optionalObjects: [
    obj('tavern-table', 'Tavern Table', 'furniture', 2, 2, [
      { type: 'center-room' },
      { type: 'min-spacing', params: { distance: 2, tag: 'table' } },
      { type: 'avoid', params: { tag: 'bar', distance: 3 } },
    ], { maxCount: 4, weight: 0.8 }),
    obj('tavern-chair', 'Tavern Chair', 'furniture', 1, 1, [
      { type: 'near', params: { tag: 'table', distance: 2 } },
      { type: 'min-spacing', params: { distance: 1, tag: 'chair' } },
    ], { maxCount: 8, weight: 0.7 }),
    obj('tavern-fireplace', 'Fireplace', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'avoid', params: { tag: 'bar', distance: 4 } },
    ], { maxCount: 1, weight: 0.6 }),
  ],
  decorations: [
    obj('tavern-barrel', 'Barrel', 'decoration', 1, 1, [
      { type: 'near', params: { tag: 'bar', distance: 3 } },
      { type: 'corner' },
    ], { maxCount: 3, weight: 0.6 }),
    obj('tavern-chandelier', 'Chandelier', 'decoration', 1, 1, [
      { type: 'center-room' },
    ], { maxCount: 1, weight: 0.5 }),
    obj('tavern-mug', 'Mug', 'decoration', 1, 1, [
      { type: 'near', params: { tag: 'table', distance: 1 } },
    ], { maxCount: 4, weight: 0.4 }),
  ],
  floorStyle: 'wood-plank',
  maxFillPercent: 0.6,
};

// ── Library ─────────────────────────────────────────────────────

const libraryTemplate: RoomTemplate = {
  roomType: 'library',
  requiredObjects: [
    obj('library-bookshelf', 'Bookshelf', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 1, tag: 'bookshelf' } },
    ], { required: true, minCount: 3, maxCount: 6 }),
  ],
  optionalObjects: [
    obj('library-desk', 'Reading Desk', 'furniture', 2, 1, [
      { type: 'center-room' },
      { type: 'min-spacing', params: { distance: 2, tag: 'desk' } },
    ], { maxCount: 2, weight: 0.7 }),
    obj('library-chair', 'Chair', 'furniture', 1, 1, [
      { type: 'near', params: { tag: 'desk', distance: 2 } },
    ], { maxCount: 2, weight: 0.6 }),
    obj('library-table', 'Study Table', 'furniture', 2, 2, [
      { type: 'center-room' },
    ], { maxCount: 1, weight: 0.5 }),
    obj('library-ladder', 'Ladder', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'near', params: { tag: 'bookshelf', distance: 2 } },
    ], { maxCount: 1, weight: 0.4 }),
  ],
  decorations: [
    obj('library-candle', 'Candle', 'decoration', 1, 1, [
      { type: 'near', params: { tag: 'desk', distance: 2 } },
    ], { maxCount: 3, weight: 0.6 }),
    obj('library-globe', 'Globe', 'decoration', 1, 1, [
      { type: 'near', params: { tag: 'desk', distance: 2 } },
    ], { maxCount: 1, weight: 0.4 }),
    obj('library-scroll', 'Scroll', 'decoration', 1, 1, [
      { type: 'near', params: { tag: 'desk', distance: 1 } },
    ], { maxCount: 3, weight: 0.3 }),
  ],
  floorStyle: 'wood-plank',
  maxFillPercent: 0.6,
};

// ── Armory ──────────────────────────────────────────────────────

const armoryTemplate: RoomTemplate = {
  roomType: 'armory',
  requiredObjects: [
    obj('armory-weapon-rack', 'Weapon Rack', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 2, tag: 'weapon-rack' } },
    ], { required: true, minCount: 2, maxCount: 4 }),
  ],
  optionalObjects: [
    obj('armory-armor-stand', 'Armor Stand', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 2, tag: 'armor-stand' } },
    ], { maxCount: 3, weight: 0.7 }),
    obj('armory-chest', 'Chest', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'away-from-door', params: { distance: 2 } },
    ], { maxCount: 2, weight: 0.6 }),
    obj('armory-workbench', 'Workbench', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'avoid', params: { tag: 'weapon-rack', distance: 2 } },
    ], { maxCount: 1, weight: 0.5 }),
  ],
  decorations: [
    obj('armory-shield', 'Shield Mount', 'decoration', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 3, tag: 'shield' } },
    ], { maxCount: 2, weight: 0.5 }),
    obj('armory-torch', 'Torch', 'decoration', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 4, tag: 'torch' } },
    ], { maxCount: 3, weight: 0.6 }),
  ],
  floorStyle: 'stone-tile',
  maxFillPercent: 0.55,
};

// ── Dungeon Cell ────────────────────────────────────────────────

const dungeonCellTemplate: RoomTemplate = {
  roomType: 'dungeon-cell',
  requiredObjects: [
    obj('cell-cot', 'Cot', 'furniture', 2, 1, [
      { type: 'against-wall' },
      { type: 'corner' },
    ], { required: true, minCount: 1, maxCount: 1 }),
  ],
  optionalObjects: [
    obj('cell-bucket', 'Bucket', 'furniture', 1, 1, [
      { type: 'corner' },
      { type: 'avoid', params: { tag: 'cot', distance: 2 } },
    ], { maxCount: 1, weight: 0.6 }),
    obj('cell-chain', 'Chain', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'avoid', params: { tag: 'cot', distance: 2 } },
    ], { maxCount: 2, weight: 0.4 }),
  ],
  decorations: [
    obj('cell-skull', 'Skull', 'decoration', 1, 1, [
      { type: 'corner' },
    ], { maxCount: 1, weight: 0.3 }),
    obj('cell-bones', 'Bones', 'decoration', 1, 1, [
      { type: 'near-wall', params: { wallDistance: 2 } },
    ], { maxCount: 2, weight: 0.3 }),
    obj('cell-rat', 'Rat', 'decoration', 1, 1, [
      { type: 'near-wall', params: { wallDistance: 2 } },
    ], { maxCount: 1, weight: 0.2 }),
  ],
  floorStyle: 'stone-tile',
  maxFillPercent: 0.35,
};

// ── Storage ─────────────────────────────────────────────────────

const storageTemplate: RoomTemplate = {
  roomType: 'storage',
  requiredObjects: [
    obj('storage-crate', 'Crate', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 0, tag: 'crate' } },
    ], { required: true, minCount: 2, maxCount: 5 }),
  ],
  optionalObjects: [
    obj('storage-barrel', 'Barrel', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 0, tag: 'barrel' } },
    ], { maxCount: 3, weight: 0.7 }),
    obj('storage-shelf', 'Shelf', 'furniture', 2, 1, [
      { type: 'against-wall' },
    ], { maxCount: 2, weight: 0.5 }),
    obj('storage-sack', 'Sack', 'furniture', 1, 1, [
      { type: 'near-wall', params: { wallDistance: 2 } },
    ], { maxCount: 3, weight: 0.5 }),
  ],
  decorations: [
    obj('storage-cobweb', 'Cobweb', 'decoration', 1, 1, [
      { type: 'corner' },
    ], { maxCount: 2, weight: 0.4 }),
    obj('storage-lantern', 'Lantern', 'decoration', 1, 1, [
      { type: 'against-wall' },
    ], { maxCount: 1, weight: 0.3 }),
  ],
  floorStyle: 'dirt',
  maxFillPercent: 0.65,
};

// ── Throne Room ─────────────────────────────────────────────────

const throneRoomTemplate: RoomTemplate = {
  roomType: 'throne-room',
  requiredObjects: [
    obj('throne-throne', 'Throne', 'furniture', 2, 2, [
      { type: 'against-wall' },
      { type: 'center-room' }, // centered on the far wall
      { type: 'facing', params: { direction: 'south' } },
    ], { required: true, minCount: 1, maxCount: 1 }),
  ],
  optionalObjects: [
    obj('throne-carpet', 'Carpet Runner', 'furniture', 2, 4, [
      { type: 'center-room' },
      { type: 'facing', params: { direction: 'south' } },
    ], { maxCount: 1, weight: 0.8 }),
    obj('throne-pillar', 'Pillar', 'furniture', 1, 1, [
      { type: 'near-wall', params: { wallDistance: 3 } },
      { type: 'min-spacing', params: { distance: 3, tag: 'pillar' } },
      { type: 'grid-align' },
    ], { maxCount: 4, weight: 0.7 }),
    obj('throne-banner', 'Banner', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 3, tag: 'banner' } },
    ], { maxCount: 2, weight: 0.6 }),
  ],
  decorations: [
    obj('throne-chandelier', 'Chandelier', 'decoration', 1, 1, [
      { type: 'center-room' },
    ], { maxCount: 1, weight: 0.7 }),
    obj('throne-torch', 'Torch', 'decoration', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 4, tag: 'torch' } },
    ], { maxCount: 4, weight: 0.6 }),
  ],
  floorStyle: 'marble',
  maxFillPercent: 0.4,
};

// ── Bathroom ────────────────────────────────────────────────────

const bathroomTemplate: RoomTemplate = {
  roomType: 'bathroom',
  requiredObjects: [
    obj('bathroom-tub', 'Bathtub', 'furniture', 2, 1, [
      { type: 'against-wall' },
    ], { required: true, minCount: 1, maxCount: 1 }),
  ],
  optionalObjects: [
    obj('bathroom-basin', 'Basin', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'avoid', params: { tag: 'tub', distance: 2 } },
    ], { maxCount: 1, weight: 0.7 }),
    obj('bathroom-stool', 'Stool', 'furniture', 1, 1, [
      { type: 'near', params: { tag: 'tub', distance: 2 } },
    ], { maxCount: 1, weight: 0.4 }),
  ],
  decorations: [
    obj('bathroom-towel', 'Towel Rack', 'decoration', 1, 1, [
      { type: 'against-wall' },
    ], { maxCount: 1, weight: 0.5 }),
    obj('bathroom-candle', 'Candle', 'decoration', 1, 1, [
      { type: 'against-wall' },
    ], { maxCount: 2, weight: 0.3 }),
  ],
  floorStyle: 'stone-tile',
  maxFillPercent: 0.4,
};

// ── Corridor ────────────────────────────────────────────────────

const corridorTemplate: RoomTemplate = {
  roomType: 'corridor',
  requiredObjects: [],
  optionalObjects: [],
  decorations: [
    obj('corridor-torch', 'Torch', 'decoration', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 4, tag: 'torch' } },
    ], { maxCount: 4, weight: 0.7 }),
    obj('corridor-rug', 'Rug', 'decoration', 1, 2, [
      { type: 'center-room' },
    ], { maxCount: 1, weight: 0.3 }),
  ],
  floorStyle: 'stone-tile',
  maxFillPercent: 0.15,
};

// ── Entrance ────────────────────────────────────────────────────

const entranceTemplate: RoomTemplate = {
  roomType: 'entrance',
  requiredObjects: [],
  optionalObjects: [
    obj('entrance-bench', 'Bench', 'furniture', 2, 1, [
      { type: 'against-wall' },
    ], { maxCount: 1, weight: 0.5 }),
    obj('entrance-chest', 'Chest', 'furniture', 1, 1, [
      { type: 'against-wall' },
      { type: 'away-from-door', params: { distance: 2 } },
    ], { maxCount: 1, weight: 0.4 }),
  ],
  decorations: [
    obj('entrance-torch', 'Torch', 'decoration', 1, 1, [
      { type: 'against-wall' },
      { type: 'min-spacing', params: { distance: 3, tag: 'torch' } },
    ], { maxCount: 2, weight: 0.7 }),
    obj('entrance-rug', 'Welcome Rug', 'decoration', 2, 2, [
      { type: 'center-room' },
    ], { maxCount: 1, weight: 0.5 }),
  ],
  floorStyle: 'stone-tile',
  maxFillPercent: 0.3,
};

// ── Template registry ───────────────────────────────────────────

export const ROOM_TEMPLATES: Map<RoomType, RoomTemplate> = new Map([
  ['kitchen', kitchenTemplate],
  ['bedroom', bedroomTemplate],
  ['bathroom', bathroomTemplate],
  ['tavern', tavernTemplate],
  ['library', libraryTemplate],
  ['armory', armoryTemplate],
  ['dungeon-cell', dungeonCellTemplate],
  ['storage', storageTemplate],
  ['throne-room', throneRoomTemplate],
  ['corridor', corridorTemplate],
  ['entrance', entranceTemplate],
]);

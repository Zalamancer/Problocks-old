/**
 * Rule-based placement system — barrel exports.
 */

// Types
export type {
  RoomType,
  RoomDefinition,
  PlaceableObject,
  PlacementConstraint,
  ConstraintType,
  PlacedObject,
  FurnishResult,
  RoomTemplate,
} from './types.js';

// Room templates
export { ROOM_TEMPLATES } from './room-templates.js';

// Constraint solver
export { ConstraintSolver } from './constraint-solver.js';

// Auto-furnisher (high-level API)
export { AutoFurnisher } from './auto-furnisher.js';

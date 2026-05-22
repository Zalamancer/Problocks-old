/**
 * NPC system types.
 */

/** NPC configuration for spawning. */
export interface NPCConfig {
  /** Unique NPC identifier. */
  id: string;
  /** Display name shown in dialogue. */
  name: string;
  /** Sprite asset key. */
  sprite: string;
  /** Tile X position. */
  x: number;
  /** Tile Y position. */
  y: number;
  /** Interaction radius in tiles. Default: 2. */
  interactionRadius?: number;
}

/** A single dialogue choice. */
export interface DialogueChoice {
  /** Display text for this choice. */
  text: string;
  /** ID of the next dialogue node (or null to end). */
  next: string | null;
}

/** A node in a dialogue tree. */
export interface DialogueNode {
  /** Unique node ID. */
  id: string;
  /** Speaker text. */
  text: string;
  /** Available choices. If empty, dialogue ends after showing text. */
  choices: DialogueChoice[];
}

/** A complete dialogue tree for an NPC. */
export interface DialogueTree {
  /** Starting node ID. */
  startNode: string;
  /** All nodes keyed by ID. */
  nodes: Record<string, DialogueNode>;
}

/** Callback when an NPC is interacted with. */
export type NPCInteractCallback = (npcId: string) => void;

/** NPC runtime state. */
export interface NPCState {
  config: NPCConfig;
  dialogue?: DialogueTree;
  onInteract?: NPCInteractCallback;
}

/**
 * @problocks/engine — NPC subsystem
 *
 * NPC spawning, proximity detection, dialogue trees, and interaction.
 */

export type {
  NPCConfig,
  NPCState,
  DialogueTree,
  DialogueNode,
  DialogueChoice,
  NPCInteractCallback,
} from './npc-types.js';

export { NPCManager } from './npc-manager.js';

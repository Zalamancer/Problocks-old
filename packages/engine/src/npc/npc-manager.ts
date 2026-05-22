/**
 * NPC manager — spawning, proximity detection, dialogue, interaction.
 *
 * Renderer-agnostic: manages NPC state and logic. Rendering is handled
 * by the consuming application (PixiJS sprites, etc.).
 */

import type {
  NPCConfig,
  NPCState,
  DialogueTree,
  NPCInteractCallback,
} from './npc-types.js';

export class NPCManager {
  private readonly npcs: Map<string, NPCState> = new Map();

  /** Spawn an NPC. */
  spawn(config: NPCConfig): void {
    this.npcs.set(config.id, {
      config: { interactionRadius: 2, ...config },
    });
  }

  /** Remove an NPC. */
  remove(id: string): void {
    this.npcs.delete(id);
  }

  /** Get NPC state by ID. */
  get(id: string): NPCState | undefined {
    return this.npcs.get(id);
  }

  /** Get all NPC states. */
  getAll(): NPCState[] {
    return [...this.npcs.values()];
  }

  /** Set a dialogue tree for an NPC. */
  setDialogue(npcId: string, dialogue: DialogueTree): void {
    const npc = this.npcs.get(npcId);
    if (npc) npc.dialogue = dialogue;
  }

  /** Register an interaction callback for an NPC. */
  onInteract(npcId: string, callback: NPCInteractCallback): void {
    const npc = this.npcs.get(npcId);
    if (npc) npc.onInteract = callback;
  }

  /**
   * Find the nearest NPC within interaction radius of a tile position.
   * Returns null if no NPC is close enough.
   */
  getNearby(tileX: number, tileY: number): NPCState | null {
    let nearest: NPCState | null = null;
    let nearestDist = Infinity;

    for (const npc of this.npcs.values()) {
      const dx = npc.config.x - tileX;
      const dy = npc.config.y - tileY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const radius = npc.config.interactionRadius ?? 2;
      if (dist <= radius && dist < nearestDist) {
        nearest = npc;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  /**
   * Trigger interaction with the nearest NPC.
   * Returns the NPC state if an interaction was triggered, null otherwise.
   */
  interact(tileX: number, tileY: number): NPCState | null {
    const npc = this.getNearby(tileX, tileY);
    if (npc) {
      npc.onInteract?.(npc.config.id);
      return npc;
    }
    return null;
  }

  /** Update NPC positions (e.g. for patrol behavior). */
  setPosition(npcId: string, x: number, y: number): void {
    const npc = this.npcs.get(npcId);
    if (npc) {
      npc.config.x = x;
      npc.config.y = y;
    }
  }

  /** Remove all NPCs. */
  clear(): void {
    this.npcs.clear();
  }
}

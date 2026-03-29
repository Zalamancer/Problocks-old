import type { World } from './world.js';
import { Entity } from './entity.js';

/**
 * Scene — contains the entity hierarchy for a simulation.
 * Analogous to Roblox's Workspace.
 */
export class Scene {
  readonly id: string;
  readonly world: World;
  private entities: Map<string, Entity> = new Map();
  private nextEntityId = 1;

  constructor(id: string, world: World) {
    this.id = id;
    this.world = world;
  }

  createEntity(name: string): Entity {
    const id = `entity_${this.nextEntityId++}`;
    const entity = new Entity(id, name);
    this.entities.set(id, entity);
    return entity;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  /**
   * Find all entities that have a specific component type.
   */
  getEntitiesWithComponent(componentType: string): Entity[] {
    return this.getAllEntities().filter(e => e.hasComponent(componentType));
  }

  /**
   * Advance the scene by one tick.
   * In the future this will run physics, scripts, etc.
   */
  tick(_deltaTime: number): void {
    // Phase 1: Run scripts (sandboxed)
    // Phase 2: Step physics
    // Phase 3: Sync transforms
    // Phase 4: Emit events
  }
}

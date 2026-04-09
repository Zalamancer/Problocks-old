import { Entity } from '../core/entity.js';
import type {
  PrefabComponentData,
  PrefabDefinition,
  PrefabEntityData,
} from './types.js';

/**
 * Registry for storing, searching, and serializing prefab definitions.
 */
export class PrefabRegistry {
  private prefabs: Map<string, PrefabDefinition> = new Map();

  // ── Registration ──────────────────────────────────────────

  register(prefab: PrefabDefinition): void {
    this.prefabs.set(prefab.id, prefab);
  }

  unregister(id: string): void {
    this.prefabs.delete(id);
  }

  get(id: string): PrefabDefinition | undefined {
    return this.prefabs.get(id);
  }

  getAll(): PrefabDefinition[] {
    return Array.from(this.prefabs.values());
  }

  // ── Search ────────────────────────────────────────────────

  search(query: string): PrefabDefinition[] {
    const lower = query.toLowerCase();
    return this.getAll().filter(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        (p.description && p.description.toLowerCase().includes(lower)) ||
        p.tags.some((t) => t.toLowerCase().includes(lower)),
    );
  }

  filterByTags(tags: string[]): PrefabDefinition[] {
    const tagSet = new Set(tags.map((t) => t.toLowerCase()));
    return this.getAll().filter((p) =>
      p.tags.some((t) => tagSet.has(t.toLowerCase())),
    );
  }

  // ── Create from entity ────────────────────────────────────

  createFromEntity(
    entity: Entity,
    name: string,
    tags: string[] = [],
  ): PrefabDefinition {
    const prefab: PrefabDefinition = {
      id: crypto.randomUUID(),
      name,
      tags,
      rootEntity: this.serializeEntity(entity),
      createdAt: Date.now(),
      version: 1,
    };
    this.register(prefab);
    return prefab;
  }

  // ── Serialization ─────────────────────────────────────────

  serialize(): string {
    return JSON.stringify(this.getAll());
  }

  deserialize(json: string): void {
    const prefabs: PrefabDefinition[] = JSON.parse(json);
    for (const prefab of prefabs) {
      this.register(prefab);
    }
  }

  // ── Export / Import ───────────────────────────────────────

  exportPrefab(id: string): string {
    const prefab = this.prefabs.get(id);
    if (!prefab) {
      throw new Error(`Prefab not found: ${id}`);
    }
    return JSON.stringify(prefab);
  }

  importPrefab(json: string): string {
    const prefab: PrefabDefinition = JSON.parse(json);
    // Assign a fresh ID to avoid collisions
    prefab.id = crypto.randomUUID();
    this.register(prefab);
    return prefab.id;
  }

  // ── Internal helpers ──────────────────────────────────────

  private serializeEntity(entity: Entity): PrefabEntityData {
    const components: PrefabComponentData[] = [];
    for (const comp of entity.getAllComponents()) {
      const properties: Record<string, any> = {};
      for (const key of Object.keys(comp)) {
        if (key === 'type') continue;
        properties[key] = structuredClone((comp as any)[key]);
      }
      components.push({ type: comp.type, properties });
    }

    const children = entity.getChildren();
    const childData: PrefabEntityData[] | undefined =
      children.length > 0
        ? children.map((c) => this.serializeEntity(c))
        : undefined;

    return {
      name: entity.name,
      components,
      children: childData,
    };
  }
}

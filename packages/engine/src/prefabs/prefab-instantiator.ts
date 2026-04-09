import { Entity } from '../core/entity.js';
import { Scene } from '../core/scene.js';
import { Component, TransformComponent } from '../core/component.js';
import type { PrefabRegistry } from './prefab-registry.js';
import type {
  PrefabDefinition,
  PrefabEntityData,
  PrefabInstance,
} from './types.js';

/**
 * Instantiates prefabs into scenes and tracks live instances.
 */
export class PrefabInstantiator {
  private registry: PrefabRegistry;
  private instances: Map<string, PrefabInstance> = new Map();

  constructor(registry: PrefabRegistry) {
    this.registry = registry;
  }

  // ── Instantiation ─────────────────────────────────────────

  instantiate(
    prefabId: string,
    scene: Scene,
    position?: { x: number; y: number; z: number },
    overrides?: Record<string, any>,
  ): Entity {
    const prefab = this.registry.get(prefabId);
    if (!prefab) {
      throw new Error(`Prefab not found: ${prefabId}`);
    }

    const root = this.buildEntityTree(prefab.rootEntity, scene);

    // Apply position offset to root entity
    if (position) {
      let transform = root.getComponent<TransformComponent>('transform');
      if (!transform) {
        transform = root.addComponent(new TransformComponent());
      }
      transform.position.x += position.x;
      transform.position.y += position.y;
      transform.position.z += position.z;
    }

    // Apply parameter overrides
    if (overrides && prefab.parameters) {
      for (const param of prefab.parameters) {
        if (param.name in overrides) {
          this.applyOverride(root, prefab, param.path, overrides[param.name]);
        }
      }
    }

    // Track instance
    const instance: PrefabInstance = {
      prefabId,
      entityId: root.id,
      overrides: overrides ? { ...overrides } : {},
    };
    this.instances.set(root.id, instance);

    return root;
  }

  instantiateBatch(
    prefabId: string,
    scene: Scene,
    positions: Array<{ x: number; y: number; z: number }>,
    overrides?: Record<string, any>,
  ): Entity[] {
    const entities: Entity[] = [];
    for (const pos of positions) {
      entities.push(this.instantiate(prefabId, scene, pos, overrides));
    }
    return entities;
  }

  // ── Instance tracking ─────────────────────────────────────

  getInstance(entityId: string): PrefabInstance | undefined {
    return this.instances.get(entityId);
  }

  getInstancesOf(prefabId: string): PrefabInstance[] {
    const result: PrefabInstance[] = [];
    for (const inst of this.instances.values()) {
      if (inst.prefabId === prefabId) {
        result.push(inst);
      }
    }
    return result;
  }

  // ── Update instance ───────────────────────────────────────

  setOverride(entityId: string, paramName: string, value: any): void {
    const instance = this.instances.get(entityId);
    if (!instance) {
      throw new Error(`No prefab instance for entity: ${entityId}`);
    }
    instance.overrides[paramName] = value;
  }

  resetOverrides(entityId: string): void {
    const instance = this.instances.get(entityId);
    if (!instance) {
      throw new Error(`No prefab instance for entity: ${entityId}`);
    }
    instance.overrides = {};
  }

  // ── Destroy ───────────────────────────────────────────────

  destroyInstance(entityId: string, scene: Scene): void {
    const instance = this.instances.get(entityId);
    if (!instance) return;

    // Remove from scene (and all children via the scene)
    this.removeEntityTree(entityId, scene);
    this.instances.delete(entityId);
  }

  // ── Internal helpers ──────────────────────────────────────

  private buildEntityTree(data: PrefabEntityData, scene: Scene): Entity {
    const entity = scene.createEntity(data.name);

    // Rebuild components
    for (const compData of data.components) {
      const comp = this.createComponentFromData(compData.type, compData.properties);
      if (comp) {
        entity.addComponent(comp);
      }
    }

    // Build children recursively
    if (data.children) {
      for (const childData of data.children) {
        const child = this.buildEntityTree(childData, scene);
        entity.addChild(child);
      }
    }

    return entity;
  }

  private createComponentFromData(
    type: string,
    properties: Record<string, any>,
  ): Component | null {
    // Create a lightweight dynamic component that carries the serialized data.
    // This works with the engine's component system because Entity.addComponent
    // stores by the `type` key, and all properties are restored.
    const comp = Object.create(Component.prototype) as Component;
    Object.defineProperty(comp, 'type', { value: type, writable: false, enumerable: true });
    for (const [key, value] of Object.entries(properties)) {
      (comp as any)[key] = structuredClone(value);
    }
    return comp;
  }

  /**
   * Resolve a dot-path like "root.components.0.properties.color" against
   * the live entity tree and set the value.
   */
  private applyOverride(
    root: Entity,
    prefab: PrefabDefinition,
    path: string,
    value: any,
  ): void {
    const parts = path.split('.');
    if (parts[0] !== 'root') return;

    // Navigate the entity tree: root.components.<index>.properties.<key>
    let cursor: any = { root: this.entityToAccessor(root) };
    for (let i = 0; i < parts.length - 1; i++) {
      if (cursor == null) return;
      cursor = cursor[parts[i]];
    }
    if (cursor != null) {
      cursor[parts[parts.length - 1]] = value;
    }
  }

  /**
   * Build a accessor object that mirrors the PrefabEntityData shape so
   * dot-path resolution works against the live entity.
   */
  private entityToAccessor(entity: Entity): any {
    const components = entity.getAllComponents();
    const componentAccessors = components.map((comp) => {
      const properties: Record<string, any> = {};
      for (const key of Object.keys(comp)) {
        if (key === 'type') continue;
        Object.defineProperty(properties, key, {
          get: () => (comp as any)[key],
          set: (v: any) => {
            (comp as any)[key] = v;
          },
          enumerable: true,
        });
      }
      return { type: comp.type, properties };
    });

    const children = entity.getChildren();
    const childAccessors = children.map((c) => this.entityToAccessor(c));

    return {
      name: entity.name,
      components: componentAccessors,
      children: childAccessors,
    };
  }

  private removeEntityTree(entityId: string, scene: Scene): void {
    const entity = scene.getEntity(entityId);
    if (!entity) return;

    // Recursively remove children first
    for (const child of entity.getChildren()) {
      this.removeEntityTree(child.id, scene);
    }

    // Detach from parent
    if (entity.parent) {
      entity.parent.removeChild(entityId);
    }

    scene.removeEntity(entityId);
  }
}

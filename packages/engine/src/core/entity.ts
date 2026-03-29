import { Component } from './component.js';

/**
 * Entity — a container for components in the ECS.
 * Each entity has a unique ID and a collection of components.
 */
export class Entity {
  readonly id: string;
  readonly name: string;
  private components: Map<string, Component> = new Map();
  private children: Map<string, Entity> = new Map();
  parent: Entity | null = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
  }

  addComponent<T extends Component>(component: T): T {
    this.components.set(component.type, component);
    return component;
  }

  getComponent<T extends Component>(type: string): T | undefined {
    return this.components.get(type) as T | undefined;
  }

  hasComponent(type: string): boolean {
    return this.components.has(type);
  }

  removeComponent(type: string): void {
    this.components.delete(type);
  }

  getAllComponents(): Component[] {
    return Array.from(this.components.values());
  }

  addChild(entity: Entity): void {
    entity.parent = this;
    this.children.set(entity.id, entity);
  }

  removeChild(id: string): void {
    const child = this.children.get(id);
    if (child) {
      child.parent = null;
      this.children.delete(id);
    }
  }

  getChildren(): Entity[] {
    return Array.from(this.children.values());
  }
}

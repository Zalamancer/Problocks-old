import { describe, it, expect } from 'vitest';
import { Entity } from '../core/entity.js';
import { TransformComponent, MeshComponent, RigidBodyComponent } from '../core/component.js';

describe('Entity', () => {
  it('creates with id and name', () => {
    const entity = new Entity('e1', 'Ball');
    expect(entity.id).toBe('e1');
    expect(entity.name).toBe('Ball');
  });

  it('adds and retrieves components', () => {
    const entity = new Entity('e1', 'Ball');
    const transform = new TransformComponent();
    transform.position = { x: 1, y: 2, z: 3 };
    entity.addComponent(transform);

    expect(entity.hasComponent('transform')).toBe(true);
    const retrieved = entity.getComponent<TransformComponent>('transform');
    expect(retrieved?.position).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('removes components', () => {
    const entity = new Entity('e1', 'Ball');
    entity.addComponent(new TransformComponent());
    entity.removeComponent('transform');
    expect(entity.hasComponent('transform')).toBe(false);
  });

  it('manages children', () => {
    const parent = new Entity('p', 'Parent');
    const child = new Entity('c', 'Child');
    parent.addChild(child);

    expect(parent.getChildren()).toHaveLength(1);
    expect(child.parent).toBe(parent);

    parent.removeChild('c');
    expect(parent.getChildren()).toHaveLength(0);
    expect(child.parent).toBeNull();
  });

  it('lists all components', () => {
    const entity = new Entity('e1', 'Ball');
    entity.addComponent(new TransformComponent());
    entity.addComponent(new MeshComponent());
    entity.addComponent(new RigidBodyComponent());
    expect(entity.getAllComponents()).toHaveLength(3);
  });
});

describe('Components', () => {
  it('TransformComponent has defaults', () => {
    const t = new TransformComponent();
    expect(t.type).toBe('transform');
    expect(t.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(t.scale).toEqual({ x: 1, y: 1, z: 1 });
  });

  it('MeshComponent has defaults', () => {
    const m = new MeshComponent();
    expect(m.type).toBe('mesh');
    expect(m.shape).toBe('box');
    expect(m.color).toBe('#ffffff');
  });

  it('RigidBodyComponent has defaults', () => {
    const r = new RigidBodyComponent();
    expect(r.type).toBe('rigidbody');
    expect(r.mass).toBe(1.0);
    expect(r.isStatic).toBe(false);
  });
});

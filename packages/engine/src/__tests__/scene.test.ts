import { describe, it, expect } from 'vitest';
import { World } from '../core/world.js';
import { TransformComponent } from '../core/component.js';

describe('Scene', () => {
  it('creates entities', () => {
    const world = new World('test');
    const scene = world.createScene('main');
    const entity = scene.createEntity('Ball');
    expect(entity.name).toBe('Ball');
    expect(entity.id).toMatch(/^entity_/);
  });

  it('retrieves entities by id', () => {
    const world = new World('test');
    const scene = world.createScene('main');
    const entity = scene.createEntity('Ball');
    expect(scene.getEntity(entity.id)).toBe(entity);
  });

  it('removes entities', () => {
    const world = new World('test');
    const scene = world.createScene('main');
    const entity = scene.createEntity('Ball');
    scene.removeEntity(entity.id);
    expect(scene.getEntity(entity.id)).toBeUndefined();
  });

  it('finds entities with specific components', () => {
    const world = new World('test');
    const scene = world.createScene('main');

    const e1 = scene.createEntity('Ball');
    e1.addComponent(new TransformComponent());

    const e2 = scene.createEntity('Light');
    // No transform

    const e3 = scene.createEntity('Box');
    e3.addComponent(new TransformComponent());

    const withTransform = scene.getEntitiesWithComponent('transform');
    expect(withTransform).toHaveLength(2);
  });

  it('lists all entities', () => {
    const world = new World('test');
    const scene = world.createScene('main');
    scene.createEntity('A');
    scene.createEntity('B');
    scene.createEntity('C');
    expect(scene.getAllEntities()).toHaveLength(3);
  });
});

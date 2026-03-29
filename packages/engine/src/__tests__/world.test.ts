import { describe, it, expect } from 'vitest';
import { World } from '../core/world.js';

describe('World', () => {
  it('creates with a name', () => {
    const world = new World('test');
    expect(world.name).toBe('test');
  });

  it('creates and retrieves scenes', () => {
    const world = new World('test');
    const scene = world.createScene('main');
    expect(scene.id).toBe('main');
    expect(world.getScene('main')).toBe(scene);
  });

  it('sets first scene as active by default', () => {
    const world = new World('test');
    const scene = world.createScene('main');
    expect(world.getActiveScene()).toBe(scene);
  });

  it('switches active scene', () => {
    const world = new World('test');
    world.createScene('scene1');
    const scene2 = world.createScene('scene2');
    world.setActiveScene('scene2');
    expect(world.getActiveScene()).toBe(scene2);
  });

  it('throws when setting non-existent active scene', () => {
    const world = new World('test');
    expect(() => world.setActiveScene('nope')).toThrow();
  });

  it('manages gravity', () => {
    const world = new World('test');
    world.setGravity(0, -20, 0);
    expect(world.getGravity()).toEqual({ x: 0, y: -20, z: 0 });
  });

  it('starts and stops', () => {
    const world = new World('test');
    expect(world.isRunning()).toBe(false);
    world.start();
    expect(world.isRunning()).toBe(true);
    world.stop();
    expect(world.isRunning()).toBe(false);
  });
});

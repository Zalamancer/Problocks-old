import { Scene } from './scene.js';

/**
 * World is the top-level container for a Problocks simulation.
 * It owns the scene graph, physics, and script runtime.
 */
export class World {
  readonly name: string;
  private scenes: Map<string, Scene> = new Map();
  private activeSceneId: string | null = null;
  private gravity: { x: number; y: number; z: number } = { x: 0, y: -9.81, z: 0 };
  private running = false;

  constructor(name: string) {
    this.name = name;
  }

  createScene(id: string): Scene {
    const scene = new Scene(id, this);
    this.scenes.set(id, scene);
    if (!this.activeSceneId) {
      this.activeSceneId = id;
    }
    return scene;
  }

  getScene(id: string): Scene | undefined {
    return this.scenes.get(id);
  }

  getActiveScene(): Scene | undefined {
    return this.activeSceneId ? this.scenes.get(this.activeSceneId) : undefined;
  }

  setActiveScene(id: string): void {
    if (!this.scenes.has(id)) {
      throw new Error(`Scene "${id}" does not exist`);
    }
    this.activeSceneId = id;
  }

  setGravity(x: number, y: number, z: number): void {
    this.gravity = { x, y, z };
  }

  getGravity(): { x: number; y: number; z: number } {
    return { ...this.gravity };
  }

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Advance the simulation by one tick.
   * Called by the game loop at a fixed timestep.
   */
  tick(deltaTime: number): void {
    if (!this.running) return;
    const scene = this.getActiveScene();
    if (scene) {
      scene.tick(deltaTime);
    }
  }
}

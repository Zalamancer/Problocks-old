import { Application, Container, Graphics, Sprite, Texture, TilingSprite } from 'pixi.js';
import { Renderer, type RendererOptions } from './renderer.js';

/**
 * PixiJS 2D renderer implementation.
 * Handles sprites, tilemaps, shapes, and 2D scene graph.
 */
export class PixiRenderer extends Renderer {
  readonly mode = '2d' as const;

  private app!: Application;
  private stage!: Container;
  private objects: Map<string, Container> = new Map();
  private nextId = 1;
  private _canvas!: HTMLCanvasElement;

  async init(options: RendererOptions): Promise<void> {
    this._canvas = options.canvas;
    this.app = new Application();
    await this.app.init({
      canvas: options.canvas,
      width: options.width,
      height: options.height,
      backgroundColor: 0x1a1a2e,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1,
    });
    this.stage = this.app.stage;
  }

  render(): void {
    this.app.render();
  }

  resize(width: number, height: number): void {
    this.app.renderer.resize(width, height);
  }

  dispose(): void {
    for (const [, obj] of this.objects) {
      obj.destroy({ children: true });
    }
    this.objects.clear();
    this.app.destroy(true, { children: true });
  }

  /** Get the PixiJS stage for direct manipulation. */
  getStage(): Container {
    return this.stage;
  }

  /** Get the PixiJS Application instance. */
  getApp(): Application {
    return this.app;
  }

  // ── Object management ─────────────────────────────────────

  /** Add a colored rectangle. */
  addRect(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    color: number;
    isStatic?: boolean;
  }): string {
    const id = `obj_${this.nextId++}`;
    const g = new Graphics();
    g.rect(-options.width / 2, -options.height / 2, options.width, options.height);
    g.fill(options.color);
    g.position.set(options.x, options.y);
    this.stage.addChild(g);
    this.objects.set(id, g);
    return id;
  }

  /** Add a colored circle. */
  addCircle(options: {
    x: number;
    y: number;
    radius: number;
    color: number;
  }): string {
    const id = `obj_${this.nextId++}`;
    const g = new Graphics();
    g.circle(0, 0, options.radius);
    g.fill(options.color);
    g.position.set(options.x, options.y);
    this.stage.addChild(g);
    this.objects.set(id, g);
    return id;
  }

  /** Add a sprite from a texture URL. */
  addSprite(options: {
    x: number;
    y: number;
    textureUrl: string;
    width?: number;
    height?: number;
    anchor?: { x: number; y: number };
  }): string {
    const id = `obj_${this.nextId++}`;
    const texture = Texture.from(options.textureUrl);
    const sprite = new Sprite(texture);
    sprite.anchor.set(options.anchor?.x ?? 0.5, options.anchor?.y ?? 0.5);
    sprite.position.set(options.x, options.y);
    if (options.width) sprite.width = options.width;
    if (options.height) sprite.height = options.height;
    this.stage.addChild(sprite);
    this.objects.set(id, sprite);
    return id;
  }

  /** Add a tiling sprite (for tilemap-style backgrounds). */
  addTilingSprite(options: {
    x: number;
    y: number;
    textureUrl: string;
    width: number;
    height: number;
    tileScale?: { x: number; y: number };
  }): string {
    const id = `obj_${this.nextId++}`;
    const texture = Texture.from(options.textureUrl);
    const ts = new TilingSprite({
      texture,
      width: options.width,
      height: options.height,
    });
    ts.position.set(options.x, options.y);
    if (options.tileScale) {
      ts.tileScale.set(options.tileScale.x, options.tileScale.y);
    }
    this.stage.addChild(ts);
    this.objects.set(id, ts);
    return id;
  }

  /** Add an arbitrary Container (for custom objects). */
  addContainer(x: number, y: number): string {
    const id = `obj_${this.nextId++}`;
    const c = new Container();
    c.position.set(x, y);
    this.stage.addChild(c);
    this.objects.set(id, c);
    return id;
  }

  // ── Transform ─────────────────────────────────────────────

  setPosition(id: string, x: number, y: number): void {
    const obj = this.objects.get(id);
    if (obj) obj.position.set(x, y);
  }

  setRotation(id: string, radians: number): void {
    const obj = this.objects.get(id);
    if (obj) obj.rotation = radians;
  }

  setScale(id: string, x: number, y: number): void {
    const obj = this.objects.get(id);
    if (obj) obj.scale.set(x, y);
  }

  getObject(id: string): Container | undefined {
    return this.objects.get(id);
  }

  removeObject(id: string): void {
    const obj = this.objects.get(id);
    if (obj) {
      obj.destroy({ children: true });
      this.objects.delete(id);
    }
  }
}

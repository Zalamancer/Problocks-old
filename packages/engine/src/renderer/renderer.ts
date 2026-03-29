/**
 * Renderer abstraction layer.
 * Simulations target this interface, not Babylon.js/Canvas directly.
 * This allows swapping the rendering backend without breaking student code.
 */
export interface RendererOptions {
  mode: '2d' | '3d';
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export abstract class Renderer {
  abstract readonly mode: '2d' | '3d';

  abstract init(options: RendererOptions): Promise<void>;
  abstract render(): void;
  abstract resize(width: number, height: number): void;
  abstract dispose(): void;
}

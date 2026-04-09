import { Component } from '../core/component.js';

/**
 * ECS component that stores 2D camera state.
 * Pure data container — the CameraController drives the logic.
 */
export class Camera2DComponent extends Component {
  readonly type = 'camera-2d';

  /** Camera position in world space. */
  position: { x: number; y: number } = { x: 0, y: 0 };
  /** Zoom level. 1.0 = 100%, 2.0 = 200% (closer), 0.5 = 50% (further). */
  zoom: number = 1.0;
  /** Camera rotation in radians. */
  rotation: number = 0;
  /** Optional world bounds to clamp the camera position. */
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };
  /** Viewport width in pixels. */
  viewportWidth: number = 800;
  /** Viewport height in pixels. */
  viewportHeight: number = 600;
}

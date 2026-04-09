import type { Container } from 'pixi.js';
import type { Camera2DComponent } from './camera-component.js';
import type { EasingFunction } from '../animation/tween.js';
import { Easing } from '../animation/tween.js';

/** Configuration for camera follow behavior. */
export interface FollowConfig {
  /** Lerp factor 0-1. Lower = smoother, higher = snappier. Default 0.1. */
  smoothing?: number;
  /** Pixels to look ahead in the target's movement direction. */
  lookahead?: number;
  /** Camera won't move until the target exits this rectangular deadzone. */
  deadzone?: { width: number; height: number };
  /** Constant pixel offset from the follow target. */
  offset?: { x: number; y: number };
}

/** Internal state for screen-shake effect. */
interface ShakeState {
  intensity: number;
  duration: number;
  elapsed: number;
  decay: number;
  offsetX: number;
  offsetY: number;
}

/** Internal state for animated zoom transitions. */
interface ZoomTransition {
  startZoom: number;
  targetZoom: number;
  duration: number;
  elapsed: number;
  easing: EasingFunction;
}

/**
 * 2D camera controller with follow, shake, zoom transitions,
 * and coordinate conversion utilities.
 *
 * Call `update(deltaTime)` once per frame, then `applyToContainer(stage)`.
 */
export class CameraController {
  private camera: Camera2DComponent;
  private followTarget: { x: number; y: number } | null = null;
  private followConfig: FollowConfig = {};
  private shakeState: ShakeState | null = null;
  private zoomTransition: ZoomTransition | null = null;

  /** Previous follow target position for lookahead calculation. */
  private prevTargetX: number = 0;
  private prevTargetY: number = 0;
  private hasMovedOnce: boolean = false;

  constructor(camera: Camera2DComponent) {
    this.camera = camera;
  }

  // ── Following ───────────────────────────────────────────────

  /** Start following a position object (e.g. an entity's transform). */
  follow(target: { x: number; y: number }, config?: FollowConfig): void {
    this.followTarget = target;
    this.followConfig = config ?? {};
    this.prevTargetX = target.x;
    this.prevTargetY = target.y;
    this.hasMovedOnce = false;
  }

  /** Stop following. Camera stays at its current position. */
  unfollow(): void {
    this.followTarget = null;
    this.hasMovedOnce = false;
  }

  // ── Direct control ──────────────────────────────────────────

  setPosition(x: number, y: number): void {
    this.camera.position.x = x;
    this.camera.position.y = y;
    this.clampToBounds();
  }

  /**
   * Set zoom level, optionally animated.
   * @param zoom Target zoom value.
   * @param duration Transition duration in milliseconds. 0 = instant.
   * @param easing Easing function for the transition.
   */
  setZoom(zoom: number, duration?: number, easing?: EasingFunction): void {
    if (!duration || duration <= 0) {
      this.camera.zoom = zoom;
      this.zoomTransition = null;
      return;
    }
    this.zoomTransition = {
      startZoom: this.camera.zoom,
      targetZoom: zoom,
      duration: duration / 1000, // ms → seconds
      elapsed: 0,
      easing: easing ?? Easing.easeInOutQuad,
    };
  }

  setRotation(rotation: number): void {
    this.camera.rotation = rotation;
  }

  // ── Effects ─────────────────────────────────────────────────

  /**
   * Shake the camera.
   * @param intensity Maximum pixel displacement.
   * @param duration Duration in milliseconds.
   * @param decay Decay factor per second (default 1 = linear decay over duration).
   */
  shake(intensity: number, duration: number, decay?: number): void {
    this.shakeState = {
      intensity,
      duration: duration / 1000,
      elapsed: 0,
      decay: decay ?? 1,
      offsetX: 0,
      offsetY: 0,
    };
  }

  // ── Viewport queries ────────────────────────────────────────

  /** Convert world coordinates to screen pixel coordinates. */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    const cam = this.camera;
    const cos = Math.cos(-cam.rotation);
    const sin = Math.sin(-cam.rotation);
    const dx = worldX - cam.position.x;
    const dy = worldY - cam.position.y;
    return {
      x: (dx * cos - dy * sin) * cam.zoom + cam.viewportWidth * 0.5,
      y: (dx * sin + dy * cos) * cam.zoom + cam.viewportHeight * 0.5,
    };
  }

  /** Convert screen pixel coordinates to world coordinates. */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const cam = this.camera;
    const sx = (screenX - cam.viewportWidth * 0.5) / cam.zoom;
    const sy = (screenY - cam.viewportHeight * 0.5) / cam.zoom;
    const cos = Math.cos(cam.rotation);
    const sin = Math.sin(cam.rotation);
    return {
      x: sx * cos - sy * sin + cam.position.x,
      y: sx * sin + sy * cos + cam.position.y,
    };
  }

  /** Check if a world point is within the visible viewport (with optional margin). */
  isInView(worldX: number, worldY: number, margin: number = 0): boolean {
    const screen = this.worldToScreen(worldX, worldY);
    return (
      screen.x >= -margin &&
      screen.x <= this.camera.viewportWidth + margin &&
      screen.y >= -margin &&
      screen.y <= this.camera.viewportHeight + margin
    );
  }

  /** Get the visible world-space rectangle. */
  getVisibleBounds(): { minX: number; minY: number; maxX: number; maxY: number } {
    const topLeft = this.screenToWorld(0, 0);
    const topRight = this.screenToWorld(this.camera.viewportWidth, 0);
    const bottomLeft = this.screenToWorld(0, this.camera.viewportHeight);
    const bottomRight = this.screenToWorld(this.camera.viewportWidth, this.camera.viewportHeight);

    return {
      minX: Math.min(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
      minY: Math.min(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
      maxX: Math.max(topLeft.x, topRight.x, bottomLeft.x, bottomRight.x),
      maxY: Math.max(topLeft.y, topRight.y, bottomLeft.y, bottomRight.y),
    };
  }

  // ── Per-frame update ────────────────────────────────────────

  /**
   * Advance camera logic.
   * @param deltaTime Time since last frame in **seconds**.
   */
  update(deltaTime: number): void {
    this.updateFollow(deltaTime);
    this.updateShake(deltaTime);
    this.updateZoomTransition(deltaTime);
    this.clampToBounds();
  }

  // ── Apply to PixiJS ─────────────────────────────────────────

  /**
   * Set a PixiJS container's transform to reflect the camera.
   * Typically called on the game world's root container.
   *
   * Moving the camera right → the world container shifts left, etc.
   */
  applyToContainer(container: Container): void {
    const cam = this.camera;
    const shakeX = this.shakeState ? this.shakeState.offsetX : 0;
    const shakeY = this.shakeState ? this.shakeState.offsetY : 0;

    // The container is the inverse of the camera transform:
    //   container.position = viewport center - camera.position * zoom
    container.position.set(
      cam.viewportWidth * 0.5 - (cam.position.x + shakeX) * cam.zoom,
      cam.viewportHeight * 0.5 - (cam.position.y + shakeY) * cam.zoom,
    );
    container.scale.set(cam.zoom, cam.zoom);
    container.rotation = -cam.rotation;

    // Set pivot to (0,0) so rotation/scale apply around the container origin
    // and position handles the centering.
    container.pivot.set(0, 0);
  }

  // ── Private helpers ─────────────────────────────────────────

  private updateFollow(deltaTime: number): void {
    if (!this.followTarget) return;

    const cfg = this.followConfig;
    const smoothing = cfg.smoothing ?? 0.1;
    const offsetX = cfg.offset?.x ?? 0;
    const offsetY = cfg.offset?.y ?? 0;

    let targetX = this.followTarget.x + offsetX;
    let targetY = this.followTarget.y + offsetY;

    // Lookahead: project ahead in the target's movement direction
    if (cfg.lookahead && cfg.lookahead > 0 && this.hasMovedOnce) {
      const velX = this.followTarget.x - this.prevTargetX;
      const velY = this.followTarget.y - this.prevTargetY;
      const mag = Math.sqrt(velX * velX + velY * velY);
      if (mag > 0.001) {
        targetX += (velX / mag) * cfg.lookahead;
        targetY += (velY / mag) * cfg.lookahead;
      }
    }

    this.prevTargetX = this.followTarget.x;
    this.prevTargetY = this.followTarget.y;
    this.hasMovedOnce = true;

    // Deadzone: don't move camera unless target escapes the center rectangle
    if (cfg.deadzone) {
      const hw = cfg.deadzone.width * 0.5;
      const hh = cfg.deadzone.height * 0.5;
      const dx = targetX - this.camera.position.x;
      const dy = targetY - this.camera.position.y;

      if (Math.abs(dx) < hw) targetX = this.camera.position.x;
      else targetX = this.camera.position.x + (dx > 0 ? dx - hw : dx + hw);

      if (Math.abs(dy) < hh) targetY = this.camera.position.y;
      else targetY = this.camera.position.y + (dy > 0 ? dy - hh : dy + hh);
    }

    // Lerp toward target
    // Use frame-rate-independent smoothing: 1 - (1 - smoothing)^(dt * 60)
    // This normalizes the feel regardless of frame rate.
    const factor = 1 - Math.pow(1 - smoothing, deltaTime * 60);
    this.camera.position.x += (targetX - this.camera.position.x) * factor;
    this.camera.position.y += (targetY - this.camera.position.y) * factor;
  }

  private updateShake(deltaTime: number): void {
    if (!this.shakeState) return;

    this.shakeState.elapsed += deltaTime;

    if (this.shakeState.elapsed >= this.shakeState.duration) {
      this.shakeState = null;
      return;
    }

    const progress = this.shakeState.elapsed / this.shakeState.duration;
    const decayFactor = Math.pow(1 - progress, this.shakeState.decay);
    const currentIntensity = this.shakeState.intensity * decayFactor;

    this.shakeState.offsetX = (Math.random() * 2 - 1) * currentIntensity;
    this.shakeState.offsetY = (Math.random() * 2 - 1) * currentIntensity;
  }

  private updateZoomTransition(deltaTime: number): void {
    if (!this.zoomTransition) return;

    this.zoomTransition.elapsed += deltaTime;

    if (this.zoomTransition.elapsed >= this.zoomTransition.duration) {
      this.camera.zoom = this.zoomTransition.targetZoom;
      this.zoomTransition = null;
      return;
    }

    const rawProgress = this.zoomTransition.elapsed / this.zoomTransition.duration;
    const easedProgress = this.zoomTransition.easing(rawProgress);
    this.camera.zoom =
      this.zoomTransition.startZoom +
      (this.zoomTransition.targetZoom - this.zoomTransition.startZoom) * easedProgress;
  }

  private clampToBounds(): void {
    const bounds = this.camera.bounds;
    if (!bounds) return;

    // Clamp so the camera center stays within bounds
    this.camera.position.x = Math.max(bounds.minX, Math.min(bounds.maxX, this.camera.position.x));
    this.camera.position.y = Math.max(bounds.minY, Math.min(bounds.maxY, this.camera.position.y));
  }
}

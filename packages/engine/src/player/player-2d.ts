/**
 * 2D player controller with hitbox-based tile collision.
 *
 * Renderer-agnostic: manages position, direction, animation state.
 * The consuming application handles sprite rendering.
 */

// ── Types ────────────────────────────────────────────────────────────

/** Player direction for sprite selection. */
export type PlayerDirection = 'up' | 'down' | 'left' | 'right';

/** 8-direction name for idle sprite rotations. */
export type SpriteDirection =
  | 'north' | 'south' | 'east' | 'west'
  | 'north-east' | 'north-west' | 'south-east' | 'south-west';

/** Axis-aligned hitbox relative to player position. */
export interface Hitbox {
  /** X offset from player position. */
  ox: number;
  /** Y offset from player position. */
  oy: number;
  /** Hitbox width in pixels. */
  w: number;
  /** Hitbox height in pixels. */
  h: number;
}

/** Walkability check function — returns true if tile is walkable. */
export type WalkableCheck = (tileX: number, tileY: number) => boolean;

/** Player configuration. */
export interface Player2DConfig {
  /** Movement speed in pixels per second. Default: 80. */
  speed?: number;
  /** Tile size in pixels. */
  tileSize: number;
  /** Hitbox definition. */
  hitbox?: Hitbox;
  /** Walk animation frame count. Default: 6. */
  walkFrames?: number;
  /** Seconds per animation frame. Default: 0.1. */
  animInterval?: number;
}

// ── Direction mapping ────────────────────────────────────────────────

const DIR_MAP: Record<PlayerDirection, SpriteDirection> = {
  up: 'north',
  down: 'south',
  left: 'west',
  right: 'east',
};

// ── Player controller ────────────────────────────────────────────────

export class Player2D {
  /** World X position in pixels. */
  x: number;
  /** World Y position in pixels. */
  y: number;

  readonly tileSize: number;
  readonly speed: number;
  readonly hitbox: Hitbox;
  readonly walkFrames: number;
  readonly animInterval: number;

  direction: PlayerDirection = 'down';
  animFrame = 0;
  animTimer = 0;
  moving = false;

  constructor(startTileX: number, startTileY: number, config: Player2DConfig) {
    this.tileSize = config.tileSize;
    this.speed = config.speed ?? 80;
    this.hitbox = config.hitbox ?? { ox: 3, oy: 10, w: 10, h: 5 };
    this.walkFrames = config.walkFrames ?? 6;
    this.animInterval = config.animInterval ?? 0.1;
    this.x = startTileX * this.tileSize;
    this.y = startTileY * this.tileSize;
  }

  /** Current tile X (centered). */
  get tileX(): number {
    return Math.floor((this.x + this.tileSize / 2) / this.tileSize);
  }

  /** Current tile Y (centered). */
  get tileY(): number {
    return Math.floor((this.y + this.tileSize / 2) / this.tileSize);
  }

  /** Sprite direction name for the current facing. */
  get spriteDirection(): SpriteDirection {
    return DIR_MAP[this.direction];
  }

  /** Current animation key (e.g. 'walk_south_3' or 'idle_south'). */
  get animationKey(): string {
    if (this.moving) {
      return `walk_${this.spriteDirection}_${this.animFrame % this.walkFrames}`;
    }
    return `idle_${this.spriteDirection}`;
  }

  /**
   * Update player position from input.
   *
   * @param dx — Horizontal input (-1, 0, or 1).
   * @param dy — Vertical input (-1, 0, or 1).
   * @param dt — Delta time in seconds.
   * @param isWalkable — Tile walkability check function.
   */
  update(dx: number, dy: number, dt: number, isWalkable: WalkableCheck): void {
    this.moving = dx !== 0 || dy !== 0;

    if (!this.moving) {
      this.animTimer = 0;
      return;
    }

    // Determine facing direction
    if (Math.abs(dx) >= Math.abs(dy)) {
      this.direction = dx < 0 ? 'left' : 'right';
    } else {
      this.direction = dy < 0 ? 'up' : 'down';
    }

    // Normalize diagonal movement
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len > 0) { dx /= len; dy /= len; }

    const moveX = dx * this.speed * dt;
    const moveY = dy * this.speed * dt;

    // Per-axis collision
    const newX = this.x + moveX;
    if (!this.collides(newX, this.y, isWalkable)) this.x = newX;

    const newY = this.y + moveY;
    if (!this.collides(this.x, newY, isWalkable)) this.y = newY;

    // Animation
    this.animTimer += dt;
    if (this.animTimer >= this.animInterval) {
      this.animTimer = 0;
      this.animFrame++;
    }
  }

  /** Set position from tile coordinates. */
  setPosition(tileX: number, tileY: number): void {
    this.x = tileX * this.tileSize;
    this.y = tileY * this.tileSize;
  }

  /** Check if position collides with non-walkable tiles. */
  private collides(px: number, py: number, isWalkable: WalkableCheck): boolean {
    const hb = this.hitbox;
    const ts = this.tileSize;
    const left = px + hb.ox;
    const right = px + hb.ox + hb.w - 1;
    const top = py + hb.oy;
    const bottom = py + hb.oy + hb.h - 1;

    // Check all four corners of the hitbox
    const corners: [number, number][] = [
      [Math.floor(left / ts), Math.floor(top / ts)],
      [Math.floor(right / ts), Math.floor(top / ts)],
      [Math.floor(left / ts), Math.floor(bottom / ts)],
      [Math.floor(right / ts), Math.floor(bottom / ts)],
    ];

    for (const [tx, ty] of corners) {
      if (!isWalkable(tx, ty)) return true;
    }
    return false;
  }
}

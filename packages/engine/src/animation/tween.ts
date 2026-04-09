/**
 * Lightweight tween / property interpolation system.
 * Zero external dependencies, designed for per-frame updates on low-end hardware.
 */

// ── Easing functions ──────────────────────────────────────────

export type EasingFunction = (t: number) => number;

export const Easing = {
  linear(t: number): number {
    return t;
  },

  easeInQuad(t: number): number {
    return t * t;
  },
  easeOutQuad(t: number): number {
    return t * (2 - t);
  },
  easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },

  easeInCubic(t: number): number {
    return t * t * t;
  },
  easeOutCubic(t: number): number {
    const t1 = t - 1;
    return t1 * t1 * t1 + 1;
  },
  easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },

  easeInBack(t: number): number {
    const s = 1.70158;
    return t * t * ((s + 1) * t - s);
  },
  easeOutBack(t: number): number {
    const s = 1.70158;
    const t1 = t - 1;
    return t1 * t1 * ((s + 1) * t1 + s) + 1;
  },

  easeOutBounce(t: number): number {
    if (t < 1 / 2.75) {
      return 7.5625 * t * t;
    } else if (t < 2 / 2.75) {
      const t1 = t - 1.5 / 2.75;
      return 7.5625 * t1 * t1 + 0.75;
    } else if (t < 2.5 / 2.75) {
      const t1 = t - 2.25 / 2.75;
      return 7.5625 * t1 * t1 + 0.9375;
    } else {
      const t1 = t - 2.625 / 2.75;
      return 7.5625 * t1 * t1 + 0.984375;
    }
  },

  easeOutElastic(t: number): number {
    if (t === 0 || t === 1) return t;
    return Math.pow(2, -10 * t) * Math.sin((t - 0.075) * (2 * Math.PI) / 0.3) + 1;
  },
} as const;

// ── Tween config ──────────────────────────────────────────────

export interface TweenConfig {
  /** The object whose properties will be interpolated. */
  target: Record<string, any>;
  /** Map of property name to target numeric value. */
  properties: Record<string, number>;
  /** Duration in milliseconds. */
  duration: number;
  /** Easing function (default: linear). */
  easing?: EasingFunction;
  /** Delay before the tween starts, in milliseconds. */
  delay?: number;
  /** Called when the tween finishes. */
  onComplete?: () => void;
  /** Called every frame with normalized progress [0,1]. */
  onUpdate?: (progress: number) => void;
}

// ── Tween ─────────────────────────────────────────────────────

export class Tween {
  private target: Record<string, any>;
  private properties: Record<string, number>;
  private startValues: Record<string, number> = {};
  private duration: number; // seconds
  private delay: number;    // seconds
  private easing: EasingFunction;
  private onCompleteCb: (() => void) | undefined;
  private onUpdateCb: ((progress: number) => void) | undefined;

  private elapsed: number = 0;
  private delayRemaining: number;
  private _active: boolean = false;
  private _paused: boolean = false;
  private _started: boolean = false;
  private chainedTween: Tween | null = null;
  private manager: TweenManager | null = null;

  constructor(config: TweenConfig, manager?: TweenManager) {
    this.target = config.target;
    this.properties = config.properties;
    this.duration = config.duration / 1000; // convert ms → seconds
    this.delay = (config.delay ?? 0) / 1000;
    this.delayRemaining = this.delay;
    this.easing = config.easing ?? Easing.linear;
    this.onCompleteCb = config.onComplete;
    this.onUpdateCb = config.onUpdate;
    this.manager = manager ?? null;
  }

  /** Begin the tween. Captures start values from the target. */
  start(): Tween {
    this._active = true;
    this._paused = false;
    this._started = true;
    this.elapsed = 0;
    this.delayRemaining = this.delay;

    // Snapshot current values as start
    for (const key of Object.keys(this.properties)) {
      this.startValues[key] = (typeof this.target[key] === 'number') ? this.target[key] : 0;
    }

    return this;
  }

  pause(): Tween {
    this._paused = true;
    return this;
  }

  resume(): Tween {
    this._paused = false;
    return this;
  }

  kill(): void {
    this._active = false;
    this._paused = false;
    this.chainedTween = null;
  }

  /** Chain another tween to play after this one completes. */
  chain(next: Tween): Tween {
    this.chainedTween = next;
    return this;
  }

  /** Whether this tween is still active (started and not finished/killed). */
  get active(): boolean {
    return this._active;
  }

  /** Whether this tween has been paused. */
  get paused(): boolean {
    return this._paused;
  }

  /**
   * Advance the tween by deltaTime seconds.
   * Returns true if the tween is still active, false if it completed or was killed.
   */
  _update(deltaTime: number): boolean {
    if (!this._active || this._paused) return this._active;

    // Handle delay
    if (this.delayRemaining > 0) {
      this.delayRemaining -= deltaTime;
      if (this.delayRemaining > 0) return true;
      // Carry over leftover time past the delay
      deltaTime = -this.delayRemaining;
      this.delayRemaining = 0;
    }

    this.elapsed += deltaTime;
    const rawProgress = this.duration > 0 ? Math.min(this.elapsed / this.duration, 1) : 1;
    const easedProgress = this.easing(rawProgress);

    // Interpolate all properties
    for (const key of Object.keys(this.properties)) {
      const start = this.startValues[key];
      const end = this.properties[key];
      this.target[key] = start + (end - start) * easedProgress;
    }

    if (this.onUpdateCb) {
      this.onUpdateCb(rawProgress);
    }

    if (rawProgress >= 1) {
      this._active = false;
      if (this.onCompleteCb) this.onCompleteCb();

      // Start chained tween
      if (this.chainedTween && this.manager) {
        this.manager._addActive(this.chainedTween);
        this.chainedTween.start();
      }

      return false;
    }

    return true;
  }
}

// ── TweenManager ──────────────────────────────────────────────

/**
 * Manages a set of active tweens. Call `update(deltaTime)` every frame.
 */
export class TweenManager {
  private tweens: Tween[] = [];

  /** Create a new Tween (does not auto-start). */
  create(config: TweenConfig): Tween {
    const tween = new Tween(config, this);
    return tween;
  }

  /**
   * Advance all active tweens.
   * @param deltaTime Seconds since last frame.
   */
  update(deltaTime: number): void {
    // Iterate backwards so splice doesn't shift indices
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const alive = this.tweens[i]._update(deltaTime);
      if (!alive) {
        this.tweens.splice(i, 1);
      }
    }
  }

  /** Kill every active tween. */
  killAll(): void {
    for (const tween of this.tweens) {
      tween.kill();
    }
    this.tweens.length = 0;
  }

  /** Kill all tweens targeting a specific object. */
  killTweensOf(target: object): void {
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      // Access private target via the config snapshot
      const t = this.tweens[i] as any;
      if (t.target === target) {
        this.tweens[i].kill();
        this.tweens.splice(i, 1);
      }
    }
  }

  /** @internal Called by Tween to add a chained tween to the active list. */
  _addActive(tween: Tween): void {
    this.tweens.push(tween);
  }
}

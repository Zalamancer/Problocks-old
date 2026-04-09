import type { SpriteAnimationComponent } from './animation-component.js';
import type { AnimationEvent, FrameSequence } from './types.js';

type EventCallback = (data: AnimationEventData) => void;

/** Data passed to animation event callbacks. */
export interface AnimationEventData {
  entityId: string;
  animationName: string;
  frameIndex: number;
  /** The actual sprite-sheet frame number (from FrameSequence.frames). */
  sheetFrame: number;
}

/** Internal per-entity animation state tracked by the controller. */
interface AnimationState {
  component: SpriteAnimationComponent;
  /** Accumulated time in seconds since the last frame advance. */
  elapsed: number;
  /** Current direction for pingPong: 1 = forward, -1 = backward. */
  direction: 1 | -1;
}

/**
 * Drives sprite animation playback for all registered entities.
 * Call `update(deltaTime)` once per frame from your simulation loop.
 */
export class AnimationController {
  private states: Map<string, AnimationState> = new Map();
  private listeners: Map<string, Map<AnimationEvent, Set<EventCallback>>> = new Map();

  // ── Registration ────────────────────────────────────────────

  /** Register an entity's animation component for per-frame updates. */
  register(entityId: string, component: SpriteAnimationComponent): void {
    this.states.set(entityId, {
      component,
      elapsed: 0,
      direction: 1,
    });

    // Auto-play the default animation if one is configured
    if (component.config.defaultAnimation && component.config.animations[component.config.defaultAnimation]) {
      this.play(entityId, component.config.defaultAnimation);
    }
  }

  /** Remove an entity from the controller. */
  unregister(entityId: string): void {
    this.states.delete(entityId);
    this.listeners.delete(entityId);
  }

  // ── Control ─────────────────────────────────────────────────

  /** Start playing a named animation on the entity. Resets to frame 0. */
  play(entityId: string, animationName: string): void {
    const state = this.states.get(entityId);
    if (!state) return;

    const seq = state.component.config.animations[animationName];
    if (!seq) return;

    state.component.currentAnimation = animationName;
    state.component.currentFrame = 0;
    state.component.playing = true;
    state.elapsed = 0;
    state.direction = 1;
  }

  /** Stop playback and reset to frame 0. */
  stop(entityId: string): void {
    const state = this.states.get(entityId);
    if (!state) return;

    state.component.playing = false;
    state.component.currentFrame = 0;
    state.elapsed = 0;
    state.direction = 1;
  }

  /** Pause playback at the current frame. */
  pause(entityId: string): void {
    const state = this.states.get(entityId);
    if (state) state.component.playing = false;
  }

  /** Resume playback from the current frame. */
  resume(entityId: string): void {
    const state = this.states.get(entityId);
    if (state) state.component.playing = true;
  }

  /** Set playback speed multiplier. */
  setSpeed(entityId: string, speed: number): void {
    const state = this.states.get(entityId);
    if (state) state.component.speed = speed;
  }

  // ── State queries ───────────────────────────────────────────

  isPlaying(entityId: string): boolean {
    const state = this.states.get(entityId);
    return state ? state.component.playing : false;
  }

  getCurrentAnimation(entityId: string): string | undefined {
    const state = this.states.get(entityId);
    return state ? state.component.currentAnimation : undefined;
  }

  getCurrentFrame(entityId: string): number {
    const state = this.states.get(entityId);
    return state ? state.component.currentFrame : 0;
  }

  // ── Events ──────────────────────────────────────────────────

  on(entityId: string, event: AnimationEvent, callback: EventCallback): void {
    let entityMap = this.listeners.get(entityId);
    if (!entityMap) {
      entityMap = new Map();
      this.listeners.set(entityId, entityMap);
    }
    let set = entityMap.get(event);
    if (!set) {
      set = new Set();
      entityMap.set(event, set);
    }
    set.add(callback);
  }

  off(entityId: string, event: AnimationEvent, callback: EventCallback): void {
    const set = this.listeners.get(entityId)?.get(event);
    if (set) set.delete(callback);
  }

  // ── Per-frame update ────────────────────────────────────────

  /**
   * Advance all registered animations.
   * @param deltaTime Time since last frame in **seconds**.
   */
  update(deltaTime: number): void {
    for (const [entityId, state] of this.states) {
      if (!state.component.playing) continue;

      const { component } = state;
      const seq = component.config.animations[component.currentAnimation];
      if (!seq || seq.frames.length === 0) continue;

      const frameCount = seq.frames.length;
      const frameDuration = 1 / (seq.frameRate * component.speed);

      state.elapsed += deltaTime;

      // Advance as many frames as accumulated time allows
      while (state.elapsed >= frameDuration) {
        state.elapsed -= frameDuration;

        const prevFrame = component.currentFrame;
        const nextFrame = prevFrame + state.direction;

        if (seq.pingPong) {
          this.advancePingPong(entityId, state, seq, nextFrame, frameCount);
        } else {
          this.advanceNormal(entityId, state, seq, nextFrame, frameCount);
        }

        // Emit frame event
        this.emit(entityId, 'frame', {
          entityId,
          animationName: component.currentAnimation,
          frameIndex: component.currentFrame,
          sheetFrame: seq.frames[component.currentFrame],
        });

        // Guard against infinite loops when speed is extremely high
        if (state.elapsed < frameDuration) break;
      }
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────

  dispose(): void {
    this.states.clear();
    this.listeners.clear();
  }

  // ── Private helpers ─────────────────────────────────────────

  private advanceNormal(
    entityId: string,
    state: AnimationState,
    seq: FrameSequence,
    nextFrame: number,
    frameCount: number,
  ): void {
    if (nextFrame >= frameCount) {
      if (seq.loop) {
        state.component.currentFrame = 0;
        this.emit(entityId, 'loop', {
          entityId,
          animationName: state.component.currentAnimation,
          frameIndex: 0,
          sheetFrame: seq.frames[0],
        });
      } else {
        state.component.currentFrame = frameCount - 1;
        state.component.playing = false;
        this.emit(entityId, 'complete', {
          entityId,
          animationName: state.component.currentAnimation,
          frameIndex: frameCount - 1,
          sheetFrame: seq.frames[frameCount - 1],
        });
      }
    } else {
      state.component.currentFrame = nextFrame;
    }
  }

  private advancePingPong(
    entityId: string,
    state: AnimationState,
    seq: FrameSequence,
    nextFrame: number,
    frameCount: number,
  ): void {
    if (nextFrame >= frameCount) {
      // Reverse direction
      state.direction = -1;
      state.component.currentFrame = frameCount - 2 >= 0 ? frameCount - 2 : 0;
    } else if (nextFrame < 0) {
      // Back to start
      if (seq.loop) {
        state.direction = 1;
        state.component.currentFrame = 1 < frameCount ? 1 : 0;
        this.emit(entityId, 'loop', {
          entityId,
          animationName: state.component.currentAnimation,
          frameIndex: state.component.currentFrame,
          sheetFrame: seq.frames[state.component.currentFrame],
        });
      } else {
        state.component.currentFrame = 0;
        state.component.playing = false;
        this.emit(entityId, 'complete', {
          entityId,
          animationName: state.component.currentAnimation,
          frameIndex: 0,
          sheetFrame: seq.frames[0],
        });
      }
    } else {
      state.component.currentFrame = nextFrame;
    }
  }

  private emit(entityId: string, event: AnimationEvent, data: AnimationEventData): void {
    const set = this.listeners.get(entityId)?.get(event);
    if (!set) return;
    for (const cb of set) {
      cb(data);
    }
  }
}

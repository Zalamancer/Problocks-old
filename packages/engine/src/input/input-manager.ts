/**
 * InputManager — unified keyboard, mouse, and touch input with action bindings.
 *
 * Edge detection:
 *   - keysPressed / mouseButtonsPressed: only true on the frame the input went down
 *   - keysReleased / mouseButtonsReleased: only true on the frame the input went up
 *   - Call update() at the END of each frame to clear per-frame sets
 *
 * Action system:
 *   - Bind named actions to sets of keys/mouse buttons
 *   - Query actions instead of raw keys for remappable controls
 *   - Register callbacks for action press/release events
 */
import type { InputAction, InputState, KeyBinding } from './types.js';

export class InputManager {
  private state: InputState;
  private bindings: Map<InputAction, KeyBinding> = new Map();
  private actionCallbacks: Map<InputAction, Array<(pressed: boolean) => void>> = new Map();
  private element: HTMLElement;
  private boundKeys: Set<string> = new Set(); // keys that should preventDefault

  // Event handler references for cleanup
  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseDown: (e: MouseEvent) => void;
  private onMouseUp: (e: MouseEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onWheel: (e: WheelEvent) => void;
  private onTouchStart: (e: TouchEvent) => void;
  private onTouchMove: (e: TouchEvent) => void;
  private onTouchEnd: (e: TouchEvent) => void;
  private onContextMenu: (e: MouseEvent) => void;

  constructor(element: HTMLElement) {
    this.element = element;

    this.state = this.createEmptyState();

    // ── Keyboard ──────────────────────────────────────────────
    this.onKeyDown = (e: KeyboardEvent) => {
      const code = e.code;

      // Prevent browser defaults for bound keys (e.g. Space scrolling)
      if (this.boundKeys.has(code)) {
        e.preventDefault();
      }

      // Skip auto-repeat: key is already down
      if (this.state.keysDown.has(code)) return;

      this.state.keysDown.add(code);
      this.state.keysPressed.add(code);

      // Fire action callbacks
      this.fireActionCallbacks(code, true);
    };

    this.onKeyUp = (e: KeyboardEvent) => {
      const code = e.code;

      if (this.boundKeys.has(code)) {
        e.preventDefault();
      }

      this.state.keysDown.delete(code);
      this.state.keysReleased.add(code);

      // Fire action callbacks
      this.fireActionCallbacks(code, false);
    };

    // ── Mouse ─────────────────────────────────────────────────
    this.onMouseDown = (e: MouseEvent) => {
      const btn = e.button;
      this.state.mouseButtons.add(btn);
      this.state.mouseButtonsPressed.add(btn);

      // Fire action callbacks for mouse buttons
      this.fireMouseActionCallbacks(btn, true);
    };

    this.onMouseUp = (e: MouseEvent) => {
      const btn = e.button;
      this.state.mouseButtons.delete(btn);
      this.state.mouseButtonsReleased.add(btn);

      this.fireMouseActionCallbacks(btn, false);
    };

    this.onMouseMove = (e: MouseEvent) => {
      const rect = this.element.getBoundingClientRect();
      this.state.mouseX = e.clientX - rect.left;
      this.state.mouseY = e.clientY - rect.top;
    };

    this.onWheel = (e: WheelEvent) => {
      // Accumulate delta within the frame
      this.state.mouseWheelDelta += e.deltaY;
    };

    // ── Touch ─────────────────────────────────────────────────
    this.onTouchStart = (e: TouchEvent) => {
      this.syncTouches(e);
    };

    this.onTouchMove = (e: TouchEvent) => {
      this.syncTouches(e);
    };

    this.onTouchEnd = (e: TouchEvent) => {
      this.syncTouches(e);
    };

    // Prevent context menu on right-click within the game area
    this.onContextMenu = (e: MouseEvent) => {
      // Only prevent if right-click is bound to an action
      if (this.isMouseButtonBound(2)) {
        e.preventDefault();
      }
    };

    // ── Attach listeners ──────────────────────────────────────
    // Keyboard events on window (so they work even if element isn't focused)
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);

    // Mouse/touch on the target element
    this.element.addEventListener('mousedown', this.onMouseDown);
    this.element.addEventListener('mouseup', this.onMouseUp);
    this.element.addEventListener('mousemove', this.onMouseMove);
    this.element.addEventListener('wheel', this.onWheel, { passive: true });
    this.element.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.onTouchEnd, { passive: false });
    this.element.addEventListener('contextmenu', this.onContextMenu);
  }

  // ── Action bindings ───────────────────────────────────────────

  bindAction(action: InputAction, keys: string[], mouseButtons?: number[]): void {
    this.bindings.set(action, { action, keys, mouseButtons });
    // Track which keys should preventDefault
    for (const key of keys) {
      this.boundKeys.add(key);
    }
  }

  unbindAction(action: InputAction): void {
    const binding = this.bindings.get(action);
    if (binding) {
      // Rebuild boundKeys from remaining bindings
      this.bindings.delete(action);
      this.rebuildBoundKeys();
    }
  }

  getBindings(): Map<InputAction, KeyBinding> {
    return this.bindings;
  }

  // ── Action queries ────────────────────────────────────────────

  isActionDown(action: InputAction): boolean {
    const binding = this.bindings.get(action);
    if (!binding) return false;
    for (const key of binding.keys) {
      if (this.state.keysDown.has(key)) return true;
    }
    if (binding.mouseButtons) {
      for (const btn of binding.mouseButtons) {
        if (this.state.mouseButtons.has(btn)) return true;
      }
    }
    return false;
  }

  isActionPressed(action: InputAction): boolean {
    const binding = this.bindings.get(action);
    if (!binding) return false;
    for (const key of binding.keys) {
      if (this.state.keysPressed.has(key)) return true;
    }
    if (binding.mouseButtons) {
      for (const btn of binding.mouseButtons) {
        if (this.state.mouseButtonsPressed.has(btn)) return true;
      }
    }
    return false;
  }

  isActionReleased(action: InputAction): boolean {
    const binding = this.bindings.get(action);
    if (!binding) return false;
    for (const key of binding.keys) {
      if (this.state.keysReleased.has(key)) return true;
    }
    if (binding.mouseButtons) {
      for (const btn of binding.mouseButtons) {
        if (this.state.mouseButtonsReleased.has(btn)) return true;
      }
    }
    return false;
  }

  // ── Raw key queries ───────────────────────────────────────────

  isKeyDown(key: string): boolean {
    return this.state.keysDown.has(key);
  }

  isKeyPressed(key: string): boolean {
    return this.state.keysPressed.has(key);
  }

  isKeyReleased(key: string): boolean {
    return this.state.keysReleased.has(key);
  }

  // ── Mouse queries ─────────────────────────────────────────────

  getMousePosition(): { x: number; y: number } {
    return { x: this.state.mouseX, y: this.state.mouseY };
  }

  isMouseButtonDown(button: number): boolean {
    return this.state.mouseButtons.has(button);
  }

  isMouseButtonPressed(button: number): boolean {
    return this.state.mouseButtonsPressed.has(button);
  }

  getMouseWheelDelta(): number {
    return this.state.mouseWheelDelta;
  }

  // ── Touch queries ─────────────────────────────────────────────

  getTouches(): Array<{ id: number; x: number; y: number }> {
    return this.state.touches;
  }

  getTouchCount(): number {
    return this.state.touchCount;
  }

  // ── Action events ─────────────────────────────────────────────

  onAction(action: InputAction, callback: (pressed: boolean) => void): void {
    let callbacks = this.actionCallbacks.get(action);
    if (!callbacks) {
      callbacks = [];
      this.actionCallbacks.set(action, callbacks);
    }
    callbacks.push(callback);
  }

  offAction(action: InputAction, callback: (pressed: boolean) => void): void {
    const callbacks = this.actionCallbacks.get(action);
    if (!callbacks) return;
    const idx = callbacks.indexOf(callback);
    if (idx !== -1) {
      callbacks.splice(idx, 1);
    }
  }

  // ── Frame lifecycle ───────────────────────────────────────────

  /**
   * Call at the END of each frame to clear per-frame edge-detection sets.
   */
  update(): void {
    this.state.keysPressed.clear();
    this.state.keysReleased.clear();
    this.state.mouseButtonsPressed.clear();
    this.state.mouseButtonsReleased.clear();
    this.state.mouseWheelDelta = 0;
  }

  // ── Cleanup ───────────────────────────────────────────────────

  /**
   * Remove all event listeners. Call when the game shuts down or the input
   * target element is removed from the DOM.
   */
  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);

    this.element.removeEventListener('mousedown', this.onMouseDown);
    this.element.removeEventListener('mouseup', this.onMouseUp);
    this.element.removeEventListener('mousemove', this.onMouseMove);
    this.element.removeEventListener('wheel', this.onWheel);
    this.element.removeEventListener('touchstart', this.onTouchStart);
    this.element.removeEventListener('touchmove', this.onTouchMove);
    this.element.removeEventListener('touchend', this.onTouchEnd);
    this.element.removeEventListener('contextmenu', this.onContextMenu);

    this.bindings.clear();
    this.actionCallbacks.clear();
    this.boundKeys.clear();
  }

  // ── Internal helpers ──────────────────────────────────────────

  private createEmptyState(): InputState {
    return {
      keysDown: new Set(),
      keysPressed: new Set(),
      keysReleased: new Set(),
      mouseX: 0,
      mouseY: 0,
      mouseButtons: new Set(),
      mouseButtonsPressed: new Set(),
      mouseButtonsReleased: new Set(),
      mouseWheelDelta: 0,
      touches: [],
      touchCount: 0,
    };
  }

  private syncTouches(e: TouchEvent): void {
    const rect = this.element.getBoundingClientRect();
    this.state.touches = [];
    for (let i = 0; i < e.touches.length; i++) {
      const t = e.touches[i];
      this.state.touches.push({
        id: t.identifier,
        x: t.clientX - rect.left,
        y: t.clientY - rect.top,
      });
    }
    this.state.touchCount = this.state.touches.length;
  }

  private rebuildBoundKeys(): void {
    this.boundKeys.clear();
    for (const binding of this.bindings.values()) {
      for (const key of binding.keys) {
        this.boundKeys.add(key);
      }
    }
  }

  private fireActionCallbacks(keyCode: string, pressed: boolean): void {
    for (const [action, binding] of this.bindings) {
      if (binding.keys.includes(keyCode)) {
        const callbacks = this.actionCallbacks.get(action);
        if (callbacks) {
          for (const cb of callbacks) {
            cb(pressed);
          }
        }
      }
    }
  }

  private fireMouseActionCallbacks(button: number, pressed: boolean): void {
    for (const [action, binding] of this.bindings) {
      if (binding.mouseButtons?.includes(button)) {
        const callbacks = this.actionCallbacks.get(action);
        if (callbacks) {
          for (const cb of callbacks) {
            cb(pressed);
          }
        }
      }
    }
  }

  private isMouseButtonBound(button: number): boolean {
    for (const binding of this.bindings.values()) {
      if (binding.mouseButtons?.includes(button)) return true;
    }
    return false;
  }
}

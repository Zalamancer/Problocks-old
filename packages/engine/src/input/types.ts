/**
 * Input system type definitions.
 */

export type InputAction = string; // e.g. "jump", "moveLeft", "attack"

export interface KeyBinding {
  action: InputAction;
  keys: string[];           // KeyboardEvent.code values: "Space", "KeyW", etc.
  mouseButtons?: number[];  // 0=left, 1=middle, 2=right
}

export interface InputState {
  // Keyboard
  keysDown: Set<string>;       // currently held keys
  keysPressed: Set<string>;    // pressed THIS frame (down edge)
  keysReleased: Set<string>;   // released THIS frame (up edge)

  // Mouse
  mouseX: number;
  mouseY: number;
  mouseButtons: Set<number>;
  mouseButtonsPressed: Set<number>;
  mouseButtonsReleased: Set<number>;
  mouseWheelDelta: number;

  // Touch
  touches: Array<{ id: number; x: number; y: number }>;
  touchCount: number;
}

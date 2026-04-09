/**
 * InputReceiver component — declares which input bindings an entity responds to.
 */
import { Component } from '../core/component.js';
import type { KeyBinding } from './types.js';

export class InputReceiverComponent extends Component {
  readonly type = 'input-receiver';

  /** Key/mouse bindings this entity listens to. */
  bindings: KeyBinding[] = [];
}

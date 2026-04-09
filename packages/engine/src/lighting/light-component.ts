/**
 * LightComponent — pure data container for a 2D light source.
 */

import { Component } from '../core/component.js';
import type { LightConfig } from './types.js';

export class LightComponent extends Component {
  readonly type = 'light-2d';

  config: LightConfig;
  position: { x: number; y: number };
  enabled: boolean;

  /** 0-1, random intensity variation */
  flickerAmount: number;
  /** Flicker frequency in Hz */
  flickerSpeed: number;

  constructor(config: LightConfig, x = 0, y = 0) {
    super();
    this.config = { ...config };
    this.position = { x, y };
    this.enabled = true;
    this.flickerAmount = 0;
    this.flickerSpeed = 0;
  }
}

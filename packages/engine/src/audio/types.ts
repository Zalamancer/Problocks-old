/**
 * Audio system type definitions.
 */

export interface SoundConfig {
  url: string;
  volume?: number;       // 0-1, default 1
  loop?: boolean;
  spatial?: boolean;      // enable 2D spatial audio
  maxDistance?: number;    // pixels, for spatial falloff
  refDistance?: number;    // pixels, where volume starts to drop
}

export interface MusicConfig {
  url: string;
  volume?: number;
  loop?: boolean;         // default true for music
  fadeIn?: number;        // ms
  fadeOut?: number;       // ms
}

export type AudioChannel = 'master' | 'music' | 'sfx' | 'ambient';

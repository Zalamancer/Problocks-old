/**
 * AudioEngine — Web Audio API wrapper for sound effects, music, and spatial audio.
 *
 * Channel routing:
 *   music ──┐
 *   sfx ────┤── master ── destination (speakers)
 *   ambient ─┘
 *
 * Spatial audio uses StereoPannerNode for left/right panning and GainNode
 * for distance-based attenuation (linear falloff between refDistance and maxDistance).
 */
import type { AudioChannel, MusicConfig, SoundConfig } from './types.js';

interface ActiveSource {
  source: AudioBufferSourceNode;
  gain: GainNode;
}

interface ActiveMusic {
  source: AudioBufferSourceNode;
  gain: GainNode;
  url: string;
}

let idCounter = 0;
function nextId(): string {
  return `pb_audio_${++idCounter}`;
}

export class AudioEngine {
  private context: AudioContext;
  private masterGain: GainNode;
  private channels: Map<AudioChannel, GainNode>;
  private channelMuted: Map<AudioChannel, boolean> = new Map();
  private channelVolumes: Map<AudioChannel, number> = new Map();
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, ActiveSource> = new Map();
  private currentMusic: ActiveMusic | null = null;
  private listenerPosition: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    this.context = new AudioContext();

    // Master gain → destination
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    // Sub-channels → master
    this.channels = new Map<AudioChannel, GainNode>();
    const channelNames: AudioChannel[] = ['master', 'music', 'sfx', 'ambient'];
    for (const name of channelNames) {
      if (name === 'master') {
        this.channels.set(name, this.masterGain);
      } else {
        const gain = this.context.createGain();
        gain.connect(this.masterGain);
        this.channels.set(name, gain);
      }
      this.channelVolumes.set(name, 1);
      this.channelMuted.set(name, false);
    }
  }

  // ── Initialization ────────────────────────────────────────────

  /**
   * Resume the AudioContext after a user gesture (required by Chrome autoplay policy).
   */
  async resume(): Promise<void> {
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }
  }

  // ── Channel volumes ───────────────────────────────────────────

  setVolume(channel: AudioChannel, volume: number): void {
    const v = Math.max(0, Math.min(1, volume));
    this.channelVolumes.set(channel, v);
    const node = this.channels.get(channel);
    if (node && !this.channelMuted.get(channel)) {
      node.gain.setValueAtTime(v, this.context.currentTime);
    }
  }

  getVolume(channel: AudioChannel): number {
    return this.channelVolumes.get(channel) ?? 1;
  }

  mute(channel: AudioChannel): void {
    this.channelMuted.set(channel, true);
    const node = this.channels.get(channel);
    if (node) {
      node.gain.setValueAtTime(0, this.context.currentTime);
    }
  }

  unmute(channel: AudioChannel): void {
    this.channelMuted.set(channel, false);
    const node = this.channels.get(channel);
    if (node) {
      const v = this.channelVolumes.get(channel) ?? 1;
      node.gain.setValueAtTime(v, this.context.currentTime);
    }
  }

  // ── Buffer loading ────────────────────────────────────────────

  private async loadBuffer(url: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;

    const response = await fetch(url);
    const arrayBuf = await response.arrayBuffer();
    const audioBuffer = await this.context.decodeAudioData(arrayBuf);
    this.bufferCache.set(url, audioBuffer);
    return audioBuffer;
  }

  // ── Sound effects ─────────────────────────────────────────────

  /**
   * Play a one-shot or looping sound effect.
   * Returns a playback ID that can be used to stop the sound.
   */
  playSound(
    url: string,
    options?: { volume?: number; channel?: AudioChannel; loop?: boolean },
  ): string {
    const id = nextId();
    const channel = options?.channel ?? 'sfx';
    const volume = options?.volume ?? 1;
    const loop = options?.loop ?? false;

    // Fire-and-forget: load the buffer, then play once ready.
    // We register the id synchronously so callers can stop it later.
    this.activeSources.set(id, null!); // placeholder

    this.loadBuffer(url).then((buffer) => {
      // If the sound was already stopped before the buffer loaded, bail.
      if (!this.activeSources.has(id)) return;

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(volume, this.context.currentTime);

      const channelNode = this.channels.get(channel) ?? this.masterGain;
      source.connect(gain);
      gain.connect(channelNode);

      this.activeSources.set(id, { source, gain });

      source.onended = () => {
        this.activeSources.delete(id);
      };

      source.start(0);
    });

    return id;
  }

  /**
   * Play a sound at a specific world position with spatial panning and distance attenuation.
   */
  playSoundAt(url: string, x: number, y: number, config?: SoundConfig): string {
    const id = nextId();
    const volume = config?.volume ?? 1;
    const loop = config?.loop ?? false;
    const maxDistance = config?.maxDistance ?? 500;
    const refDistance = config?.refDistance ?? 50;

    this.activeSources.set(id, null!); // placeholder

    this.loadBuffer(url).then((buffer) => {
      if (!this.activeSources.has(id)) return;

      const source = this.context.createBufferSource();
      source.buffer = buffer;
      source.loop = loop;

      // Distance attenuation
      const { attenuation, pan } = this.computeSpatial(
        x, y, refDistance, maxDistance,
      );

      const gain = this.context.createGain();
      gain.gain.setValueAtTime(volume * attenuation, this.context.currentTime);

      const panner = this.context.createStereoPanner();
      panner.pan.setValueAtTime(pan, this.context.currentTime);

      const channelNode = this.channels.get('sfx') ?? this.masterGain;
      source.connect(gain);
      gain.connect(panner);
      panner.connect(channelNode);

      this.activeSources.set(id, { source, gain });

      source.onended = () => {
        this.activeSources.delete(id);
      };

      source.start(0);
    });

    return id;
  }

  stopSound(playbackId: string): void {
    const active = this.activeSources.get(playbackId);
    if (active?.source) {
      try {
        active.source.stop();
      } catch {
        // Already stopped — ignore.
      }
    }
    this.activeSources.delete(playbackId);
  }

  // ── Music ─────────────────────────────────────────────────────

  /**
   * Play a music track. Stops any currently playing music first.
   * Supports optional fade-in.
   */
  async playMusic(config: MusicConfig): Promise<void> {
    // Stop current music immediately (or with its own fade)
    if (this.currentMusic) {
      this.stopMusicInternal(0);
    }

    const buffer = await this.loadBuffer(config.url);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = config.loop ?? true;

    const gain = this.context.createGain();
    const targetVolume = config.volume ?? 1;
    const fadeIn = config.fadeIn ?? 0;

    const channelNode = this.channels.get('music') ?? this.masterGain;
    source.connect(gain);
    gain.connect(channelNode);

    if (fadeIn > 0) {
      gain.gain.setValueAtTime(0, this.context.currentTime);
      gain.gain.linearRampToValueAtTime(
        targetVolume,
        this.context.currentTime + fadeIn / 1000,
      );
    } else {
      gain.gain.setValueAtTime(targetVolume, this.context.currentTime);
    }

    this.currentMusic = { source, gain, url: config.url };

    source.onended = () => {
      if (this.currentMusic?.source === source) {
        this.currentMusic = null;
      }
    };

    source.start(0);
  }

  /**
   * Stop the current music track, optionally fading out over `fadeOut` ms.
   */
  stopMusic(fadeOut?: number): void {
    this.stopMusicInternal(fadeOut ?? 0);
  }

  private stopMusicInternal(fadeOutMs: number): void {
    if (!this.currentMusic) return;
    const { source, gain } = this.currentMusic;
    this.currentMusic = null;

    if (fadeOutMs > 0) {
      gain.gain.linearRampToValueAtTime(
        0,
        this.context.currentTime + fadeOutMs / 1000,
      );
      // Schedule stop after fade completes
      source.stop(this.context.currentTime + fadeOutMs / 1000);
    } else {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
    }
  }

  /**
   * Crossfade from the current music to a new track.
   * Simultaneously fades out the old track and fades in the new one.
   */
  async crossfadeTo(config: MusicConfig, duration: number = 1000): Promise<void> {
    // Fade out current music
    if (this.currentMusic) {
      const { source: oldSource, gain: oldGain } = this.currentMusic;
      this.currentMusic = null;
      oldGain.gain.linearRampToValueAtTime(
        0,
        this.context.currentTime + duration / 1000,
      );
      oldSource.stop(this.context.currentTime + duration / 1000);
    }

    // Fade in new music
    const buffer = await this.loadBuffer(config.url);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = config.loop ?? true;

    const gain = this.context.createGain();
    const targetVolume = config.volume ?? 1;

    const channelNode = this.channels.get('music') ?? this.masterGain;
    source.connect(gain);
    gain.connect(channelNode);

    gain.gain.setValueAtTime(0, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(
      targetVolume,
      this.context.currentTime + duration / 1000,
    );

    this.currentMusic = { source, gain, url: config.url };

    source.onended = () => {
      if (this.currentMusic?.source === source) {
        this.currentMusic = null;
      }
    };

    source.start(0);
  }

  // ── Spatial ───────────────────────────────────────────────────

  /**
   * Set the listener's world-space position (camera/player position).
   */
  setListenerPosition(x: number, y: number): void {
    this.listenerPosition.x = x;
    this.listenerPosition.y = y;
  }

  /**
   * Compute spatial audio parameters: stereo pan (-1..1) and distance attenuation (0..1).
   * Uses linear falloff between refDistance and maxDistance.
   */
  private computeSpatial(
    sourceX: number,
    sourceY: number,
    refDistance: number,
    maxDistance: number,
  ): { attenuation: number; pan: number } {
    const dx = sourceX - this.listenerPosition.x;
    const dy = sourceY - this.listenerPosition.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Attenuation: full volume up to refDistance, linear falloff to maxDistance, then 0
    let attenuation: number;
    if (distance <= refDistance) {
      attenuation = 1;
    } else if (distance >= maxDistance) {
      attenuation = 0;
    } else {
      attenuation = 1 - (distance - refDistance) / (maxDistance - refDistance);
    }

    // Pan: -1 (left) to 1 (right) based on X offset, clamped
    let pan: number;
    if (maxDistance <= 0) {
      pan = 0;
    } else {
      pan = Math.max(-1, Math.min(1, dx / maxDistance));
    }

    return { attenuation, pan };
  }

  // ── Preloading ────────────────────────────────────────────────

  /**
   * Preload audio files into the buffer cache.
   * Call during loading screens to avoid playback latency.
   */
  async preload(urls: string[]): Promise<void> {
    await Promise.all(urls.map((url) => this.loadBuffer(url)));
  }

  // ── Cleanup ───────────────────────────────────────────────────

  /**
   * Stop all audio, clear caches, and close the AudioContext.
   */
  dispose(): void {
    // Stop all active sound effects
    for (const [id, active] of this.activeSources) {
      if (active?.source) {
        try {
          active.source.stop();
        } catch {
          // Already stopped.
        }
      }
    }
    this.activeSources.clear();

    // Stop music
    if (this.currentMusic) {
      try {
        this.currentMusic.source.stop();
      } catch {
        // Already stopped.
      }
      this.currentMusic = null;
    }

    // Clear buffer cache
    this.bufferCache.clear();

    // Close context
    this.context.close();
  }
}

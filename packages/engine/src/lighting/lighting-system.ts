/**
 * 2D Lighting System.
 *
 * Renders all lights to an offscreen RenderTexture (the "lightmap"), then
 * composites it over the scene using MULTIPLY blend mode.
 *
 * Performance budget (Celeron N4000 / Intel UHD 600 12 EU):
 *   - Max 8 active lights rendered per frame
 *   - Max 50 occluders considered per light
 *   - Shadow geometry: simple trapezoid projection, no GPU raycasting
 */

import {
  Container,
  Graphics,
  RenderTexture,
  Sprite,
  BLEND_MODES,
  type Renderer,
} from 'pixi.js';
import { LightComponent } from './light-component.js';
import type { AmbientConfig, DayNightConfig, OccluderRect } from './types.js';

// ── Helpers ─────────────────────────────────────────────────────────────────

const MAX_LIGHTS_PER_FRAME = 8;
const MAX_OCCLUDERS_PER_LIGHT = 50;

/** Extract R (0-255) from 24-bit hex. */
function hexR(c: number): number {
  return (c >> 16) & 0xff;
}
/** Extract G (0-255) from 24-bit hex. */
function hexG(c: number): number {
  return (c >> 8) & 0xff;
}
/** Extract B (0-255) from 24-bit hex. */
function hexB(c: number): number {
  return c & 0xff;
}
/** Combine R, G, B (0-255 each) into 24-bit hex. */
function rgbHex(r: number, g: number, b: number): number {
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}
/** Lerp two hex colours by t (0-1). */
function lerpColor(a: number, b: number, t: number): number {
  const r = Math.round(hexR(a) + (hexR(b) - hexR(a)) * t);
  const g = Math.round(hexG(a) + (hexG(b) - hexG(a)) * t);
  const bl = Math.round(hexB(a) + (hexB(b) - hexB(a)) * t);
  return rgbHex(r, g, bl);
}
/** Clamp v to [lo, hi]. */
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ── LightingSystem ──────────────────────────────────────────────────────────

export class LightingSystem {
  // ── State ───────────────────────────────────────────────────
  private lights: Map<string, LightComponent> = new Map();
  private occluders: Map<string, OccluderRect> = new Map();

  // ── PixiJS objects ──────────────────────────────────────────
  private renderer: Renderer;
  private lightmapTexture: RenderTexture;
  private lightmapSprite: Sprite;
  private lightContainer: Container; // offscreen: lights are drawn here
  private bgGraphics: Graphics;      // ambient fill
  private lightGraphicsPool: Graphics[] = [];

  // ── Ambient / Day-night ─────────────────────────────────────
  private ambient: AmbientConfig = { color: 0x333344, intensity: 1 };
  private dayNight: DayNightConfig | null = null;
  private dayNightTime = 0; // normalised 0-1 (0 = midnight, 0.5 = noon)
  private elapsedCycle = 0;

  // ── Flicker noise seed (cheap deterministic) ────────────────
  private flickerSeed = 0;

  constructor(renderer: Renderer, width: number, height: number) {
    this.renderer = renderer;

    // Offscreen container that lights are drawn into
    this.lightContainer = new Container();

    // Background graphics: ambient fill covers the entire lightmap
    this.bgGraphics = new Graphics();
    this.lightContainer.addChild(this.bgGraphics);

    // Pre-allocate a pool of Graphics objects (one per max light)
    for (let i = 0; i < MAX_LIGHTS_PER_FRAME; i++) {
      const g = new Graphics();
      g.blendMode = 'add' as BLEND_MODES;
      this.lightContainer.addChild(g);
      this.lightGraphicsPool.push(g);
    }

    // RenderTexture sized to the viewport
    this.lightmapTexture = RenderTexture.create({
      width,
      height,
      antialias: false,
      resolution: 1,
    });

    // Sprite that displays the lightmap on top of the scene
    this.lightmapSprite = new Sprite(this.lightmapTexture);
    this.lightmapSprite.blendMode = 'multiply' as BLEND_MODES;
  }

  // ── Public: get the sprite to add to stage ──────────────────

  /** Returns the Sprite that should be added on top of the scene container. */
  getLightmapSprite(): Sprite {
    return this.lightmapSprite;
  }

  // ── Light management ────────────────────────────────────────

  addLight(id: string, light: LightComponent): void {
    this.lights.set(id, light);
  }

  removeLight(id: string): void {
    this.lights.delete(id);
  }

  getLight(id: string): LightComponent | undefined {
    return this.lights.get(id);
  }

  // ── Ambient ─────────────────────────────────────────────────

  setAmbient(config: AmbientConfig): void {
    this.ambient = { ...config };
  }

  // ── Day / night cycle ───────────────────────────────────────

  enableDayNight(config: DayNightConfig): void {
    this.dayNight = { ...config };
    this.elapsedCycle = 0;
  }

  disableDayNight(): void {
    this.dayNight = null;
  }

  /** Manually set time of day. 0 = midnight, 0.25 = dawn, 0.5 = noon, 0.75 = dusk. */
  setTimeOfDay(normalized: number): void {
    this.dayNightTime = clamp(normalized, 0, 1);
    this.elapsedCycle = normalized * (this.dayNight?.cycleDuration ?? 1);
  }

  getTimeOfDay(): number {
    return this.dayNightTime;
  }

  // ── Shadow occluders ────────────────────────────────────────

  addOccluder(id: string, rect: OccluderRect): void {
    this.occluders.set(id, { ...rect });
  }

  removeOccluder(id: string): void {
    this.occluders.delete(id);
  }

  // ── Per-frame update ────────────────────────────────────────

  update(deltaTime: number, _camera: { x: number; y: number; zoom: number }): void {
    this.flickerSeed += deltaTime;

    // Advance day/night cycle
    if (this.dayNight) {
      this.elapsedCycle += deltaTime;
      if (this.elapsedCycle >= this.dayNight.cycleDuration) {
        this.elapsedCycle -= this.dayNight.cycleDuration;
      }
      this.dayNightTime = this.elapsedCycle / this.dayNight.cycleDuration;
    }
  }

  // ── Render ──────────────────────────────────────────────────

  render(renderer: Renderer): void {
    const w = this.lightmapTexture.width;
    const h = this.lightmapTexture.height;

    // 1. Compute effective ambient
    const ambient = this.computeAmbient();
    const ambR = hexR(ambient.color) * ambient.intensity;
    const ambG = hexG(ambient.color) * ambient.intensity;
    const ambB = hexB(ambient.color) * ambient.intensity;
    const ambientHex = rgbHex(
      Math.round(clamp(ambR, 0, 255)),
      Math.round(clamp(ambG, 0, 255)),
      Math.round(clamp(ambB, 0, 255)),
    );

    // 2. Fill background with ambient
    this.bgGraphics.clear();
    this.bgGraphics.rect(0, 0, w, h);
    this.bgGraphics.fill(ambientHex);

    // 3. Collect enabled lights, limit to MAX_LIGHTS_PER_FRAME
    const activeLights: LightComponent[] = [];
    for (const light of this.lights.values()) {
      if (light.enabled && activeLights.length < MAX_LIGHTS_PER_FRAME) {
        activeLights.push(light);
      }
    }

    // 4. Draw each light
    for (let i = 0; i < MAX_LIGHTS_PER_FRAME; i++) {
      const g = this.lightGraphicsPool[i];
      g.clear();
      g.visible = false;
    }

    for (let i = 0; i < activeLights.length; i++) {
      const light = activeLights[i];
      const g = this.lightGraphicsPool[i];
      g.visible = true;
      this.drawLight(g, light, w, h);
    }

    // 5. Render the light container into the offscreen texture
    renderer.render({
      container: this.lightContainer,
      target: this.lightmapTexture,
      clear: true,
    });
  }

  // ── Resize ──────────────────────────────────────────────────

  resize(width: number, height: number): void {
    this.lightmapTexture.resize(width, height);
  }

  // ── Dispose ─────────────────────────────────────────────────

  dispose(): void {
    this.lightmapTexture.destroy(true);
    this.lightmapSprite.destroy({ children: true });
    this.lightContainer.destroy({ children: true });
    this.lights.clear();
    this.occluders.clear();
    this.lightGraphicsPool.length = 0;
  }

  // ── Private: draw a single light ───────────────────────────

  private drawLight(g: Graphics, light: LightComponent, _vpW: number, _vpH: number): void {
    const cfg = light.config;
    const lx = light.position.x;
    const ly = light.position.y;
    const baseIntensity = cfg.intensity;
    const radius = cfg.radius;

    // Flicker
    let intensity = baseIntensity;
    if (light.flickerAmount > 0 && light.flickerSpeed > 0) {
      const flicker =
        Math.sin(this.flickerSeed * light.flickerSpeed * Math.PI * 2) * 0.6 +
        Math.sin(this.flickerSeed * light.flickerSpeed * 3.7) * 0.4; // cheap pseudo-noise
      intensity = clamp(
        baseIntensity + flicker * light.flickerAmount * baseIntensity,
        0,
        1,
      );
    }

    const r = hexR(cfg.color);
    const gCol = hexG(cfg.color);
    const b = hexB(cfg.color);

    // Draw radial gradient as concentric circles (8 steps — cheap on fill-rate-limited GPUs)
    const steps = 8;
    g.position.set(0, 0);

    if (cfg.type === 'spot' && cfg.angle !== undefined && cfg.coneAngle !== undefined) {
      // Spot light: draw arc segments instead of full circles
      this.drawSpotLight(g, lx, ly, radius, intensity, r, gCol, b, cfg.falloff, cfg.angle, cfg.coneAngle, steps);
    } else {
      // Point light: full radial gradient
      this.drawPointLight(g, lx, ly, radius, intensity, r, gCol, b, cfg.falloff, steps);
    }

    // Shadows
    if (cfg.castShadows) {
      this.drawShadows(g, lx, ly, radius);
    }
  }

  private drawPointLight(
    g: Graphics,
    lx: number,
    ly: number,
    radius: number,
    intensity: number,
    r: number,
    gc: number,
    b: number,
    falloff: number,
    steps: number,
  ): void {
    // Draw from outer (transparent) to inner (bright) so inner overwrites outer
    for (let i = steps; i >= 1; i--) {
      const t = i / steps; // 1 = edge, 0 = centre
      // Falloff curve: pow(1-t, 1/falloff) gives linear at falloff=1, quadratic feel at 0.5
      const f = falloff > 0 ? Math.pow(1 - t, 1 / falloff) : 1;
      const alpha = clamp(intensity * f, 0, 1);
      const stepRadius = radius * t;
      const color = rgbHex(
        Math.round(r * alpha),
        Math.round(gc * alpha),
        Math.round(b * alpha),
      );
      g.circle(lx, ly, stepRadius);
      g.fill({ color, alpha });
    }
  }

  private drawSpotLight(
    g: Graphics,
    lx: number,
    ly: number,
    radius: number,
    intensity: number,
    r: number,
    gc: number,
    b: number,
    falloff: number,
    angle: number,
    coneAngle: number,
    steps: number,
  ): void {
    const halfCone = coneAngle / 2;
    const startAngle = angle - halfCone;
    const endAngle = angle + halfCone;

    for (let i = steps; i >= 1; i--) {
      const t = i / steps;
      const f = falloff > 0 ? Math.pow(1 - t, 1 / falloff) : 1;
      const alpha = clamp(intensity * f, 0, 1);
      const stepRadius = radius * t;
      const color = rgbHex(
        Math.round(r * alpha),
        Math.round(gc * alpha),
        Math.round(b * alpha),
      );

      // Draw arc segment: move to light centre, arc, close
      g.moveTo(lx, ly);
      g.arc(lx, ly, stepRadius, startAngle, endAngle);
      g.closePath();
      g.fill({ color, alpha });
    }
  }

  private drawShadows(g: Graphics, lx: number, ly: number, lightRadius: number): void {
    // Collect nearby occluders (up to limit)
    const nearby: OccluderRect[] = [];
    const rSq = lightRadius * lightRadius * 4; // generous range

    for (const occ of this.occluders.values()) {
      if (nearby.length >= MAX_OCCLUDERS_PER_LIGHT) break;
      // Quick distance check (centre of occluder to light)
      const cx = occ.x + occ.width / 2;
      const cy = occ.y + occ.height / 2;
      const dx = cx - lx;
      const dy = cy - ly;
      if (dx * dx + dy * dy < rSq) {
        nearby.push(occ);
      }
    }

    if (nearby.length === 0) return;

    // For each occluder, project a shadow trapezoid away from the light
    const shadowLength = lightRadius * 1.5;

    for (const occ of nearby) {
      // Get the four corners of the occluder
      const corners = [
        { x: occ.x, y: occ.y },
        { x: occ.x + occ.width, y: occ.y },
        { x: occ.x + occ.width, y: occ.y + occ.height },
        { x: occ.x, y: occ.y + occ.height },
      ];

      // Find the two silhouette edges (the corners most extreme from light's perspective)
      // Sort corners by angle from light
      const withAngle = corners.map((c) => ({
        ...c,
        a: Math.atan2(c.y - ly, c.x - lx),
      }));
      withAngle.sort((a, b) => a.a - b.a);

      // The first and last in sorted order are the silhouette vertices
      const left = withAngle[0];
      const right = withAngle[withAngle.length - 1];

      // Project these two vertices away from the light
      const project = (px: number, py: number) => {
        const dx = px - lx;
        const dy = py - ly;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        return {
          x: px + (dx / dist) * shadowLength,
          y: py + (dy / dist) * shadowLength,
        };
      };

      const pLeft = project(left.x, left.y);
      const pRight = project(right.x, right.y);

      // Draw shadow trapezoid (dark, blocks light)
      g.moveTo(left.x, left.y);
      g.lineTo(pLeft.x, pLeft.y);
      g.lineTo(pRight.x, pRight.y);
      g.lineTo(right.x, right.y);
      g.closePath();
      g.fill({ color: 0x000000, alpha: 0.85 });
    }
  }

  // ── Private: compute current ambient from day/night cycle ──

  private computeAmbient(): AmbientConfig {
    if (!this.dayNight) return this.ambient;

    const t = this.dayNightTime; // 0=midnight, 0.25=dawn, 0.5=noon, 0.75=dusk
    const dn = this.dayNight;

    // Interpolate between four keyframes
    if (t < 0.25) {
      // night → dawn (0.0 → 0.25)
      const f = t / 0.25;
      return this.lerpAmbient(dn.night, dn.dawn, f);
    } else if (t < 0.5) {
      // dawn → noon (0.25 → 0.5)
      const f = (t - 0.25) / 0.25;
      return this.lerpAmbient(dn.dawn, dn.noon, f);
    } else if (t < 0.75) {
      // noon → dusk (0.5 → 0.75)
      const f = (t - 0.5) / 0.25;
      return this.lerpAmbient(dn.noon, dn.dusk, f);
    } else {
      // dusk → night (0.75 → 1.0)
      const f = (t - 0.75) / 0.25;
      return this.lerpAmbient(dn.dusk, dn.night, f);
    }
  }

  private lerpAmbient(a: AmbientConfig, b: AmbientConfig, t: number): AmbientConfig {
    return {
      color: lerpColor(a.color, b.color, t),
      intensity: a.intensity + (b.intensity - a.intensity) * t,
    };
  }
}

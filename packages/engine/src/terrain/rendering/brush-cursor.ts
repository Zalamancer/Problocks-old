/**
 * Section 4.3 -- Brush Cursor
 *
 * Translucent wireframe preview that follows the terrain raycast
 * hit point, showing where the brush will apply.
 */

import * as BABYLON from "@babylonjs/core";
import type { BrushConfig } from "../editor/brush.js";

// ── Color constants ────────────────────────────────────────────────

const COLOR_ADD = new BABYLON.Color3(0.2, 0.5, 1.0);       // blue
const COLOR_SUBTRACT = new BABYLON.Color3(1.0, 0.25, 0.25); // red
const COLOR_SMOOTH = new BABYLON.Color3(0.25, 0.9, 0.4);    // green
const COLOR_PAINT = new BABYLON.Color3(1.0, 0.8, 0.2);      // yellow
const CURSOR_ALPHA = 0.35;

// ── BrushCursor ────────────────────────────────────────────────────

export type CursorMode = "add" | "subtract" | "smooth" | "paint";

export class BrushCursor {
  private scene: BABYLON.Scene;
  private mesh: BABYLON.Mesh | null = null;
  private material: BABYLON.StandardMaterial;
  private currentShape: string = "";
  private currentSize: number = 0;
  private currentHeight: number = 0;

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    this.material = new BABYLON.StandardMaterial("brush_cursor_mat", scene);
    this.material.wireframe = true;
    this.material.alpha = CURSOR_ALPHA;
    this.material.disableLighting = true;
    this.material.backFaceCulling = false;
  }

  // ── Update each frame ──────────────────────────────────────────

  /**
   * Move the cursor to the hit point and rebuild the mesh if
   * shape/size changed.
   */
  update(
    hitPoint: { x: number; y: number; z: number },
    config: BrushConfig,
    mode: CursorMode,
  ): void {
    const height = config.shape === "sphere" ? config.size : config.height;

    // Rebuild mesh if shape or dimensions changed
    if (
      config.shape !== this.currentShape ||
      config.size !== this.currentSize ||
      height !== this.currentHeight
    ) {
      this.rebuildMesh(config.shape, config.size, height);
      this.currentShape = config.shape;
      this.currentSize = config.size;
      this.currentHeight = height;
    }

    if (!this.mesh) return;

    // Position with pivot offset
    const pivotY = this.pivotOffsetY(config.pivot, height);
    this.mesh.position.set(hitPoint.x, hitPoint.y + pivotY, hitPoint.z);

    // Color by mode
    this.setColor(mode);
  }

  /** Hide the cursor (e.g. when pointer leaves terrain). */
  hide(): void {
    if (this.mesh) {
      this.mesh.isVisible = false;
    }
  }

  /** Show the cursor. */
  show(): void {
    if (this.mesh) {
      this.mesh.isVisible = true;
    }
  }

  /** Dispose all resources. */
  dispose(): void {
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }
    this.material.dispose();
  }

  // ── Private ────────────────────────────────────────────────────

  private rebuildMesh(shape: string, size: number, height: number): void {
    if (this.mesh) {
      this.mesh.dispose();
      this.mesh = null;
    }

    const radius = size / 2;
    const halfH = height / 2;

    switch (shape) {
      case "sphere":
        this.mesh = BABYLON.MeshBuilder.CreateSphere(
          "brush_cursor",
          { diameter: size, segments: 16 },
          this.scene,
        );
        break;

      case "box":
        this.mesh = BABYLON.MeshBuilder.CreateBox(
          "brush_cursor",
          { width: size, height, depth: size },
          this.scene,
        );
        break;

      case "cylinder":
        this.mesh = BABYLON.MeshBuilder.CreateCylinder(
          "brush_cursor",
          { diameter: size, height, tessellation: 24 },
          this.scene,
        );
        break;

      default:
        return;
    }

    this.mesh.material = this.material;
    this.mesh.isPickable = false;
    this.mesh.renderingGroupId = 1; // render on top
  }

  private pivotOffsetY(pivot: string, height: number): number {
    const halfH = height / 2;
    switch (pivot) {
      case "bottom":
        return halfH;
      case "top":
        return -halfH;
      default:
        return 0;
    }
  }

  private setColor(mode: CursorMode): void {
    switch (mode) {
      case "add":
        this.material.emissiveColor = COLOR_ADD;
        break;
      case "subtract":
        this.material.emissiveColor = COLOR_SUBTRACT;
        break;
      case "smooth":
        this.material.emissiveColor = COLOR_SMOOTH;
        break;
      case "paint":
        this.material.emissiveColor = COLOR_PAINT;
        break;
    }
  }
}

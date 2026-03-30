/**
 * Three.js implementation of the renderer abstraction.
 * Replaces BabylonRenderer with Three.js for better shader
 * compatibility and community support.
 */

import * as THREE from "three";
import { Renderer, type RendererOptions } from "./renderer.js";

export class ThreeRenderer extends Renderer {
  readonly mode = "3d" as const;

  private renderer!: THREE.WebGLRenderer;
  private _scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private meshes: Map<string, THREE.Mesh> = new Map();
  private gridGround: THREE.Mesh | null = null;
  private animFrameId: number | null = null;

  async init(options: RendererOptions): Promise<void> {
    const canvas = options.canvas;

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
    });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0.53, 0.72, 0.9); // sky blue

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      canvas.clientWidth / canvas.clientHeight,
      0.5,
      2000,
    );
    this.camera.position.set(40, 60, 80);
    this.camera.lookAt(0, 10, 0);

    // Lights
    const hemi = new THREE.HemisphereLight(0xffffff, 0x444466, 0.9);
    this._scene.add(hemi);

    const dir = new THREE.DirectionalLight(0xffffff, 0.7);
    dir.position.set(-50, 100, 50);
    this._scene.add(dir);

    // Grid ground (hidden when voxel terrain is active)
    const gridHelper = new THREE.GridHelper(30, 30, 0x4a4a5a, 0x333344);
    this.gridGround = gridHelper as unknown as THREE.Mesh;
    this._scene.add(gridHelper);
  }

  getScene(): THREE.Scene {
    return this._scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getWebGLRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getCameraPosition(): { x: number; y: number; z: number } {
    return { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
  }

  hideGridGround(): void {
    if (this.gridGround) this.gridGround.visible = false;
  }

  showGridGround(): void {
    if (this.gridGround) this.gridGround.visible = true;
  }

  render(): void {
    this.renderer.render(this._scene, this.camera);
  }

  startRenderLoop(): void {
    const loop = () => {
      this.render();
      this.animFrameId = requestAnimationFrame(loop);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  stopRenderLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  handleResize(): void {
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  resize(width: number, height: number): void {
    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  // ── Entity meshes ──────────────────────────────────────────────

  createMesh(
    entityId: string,
    shape: "box" | "sphere" | "cylinder" | "plane",
    options: {
      width?: number; height?: number; depth?: number; radius?: number;
      color?: string;
      position?: { x: number; y: number; z: number };
    } = {},
  ): void {
    let geom: THREE.BufferGeometry;
    switch (shape) {
      case "box":
        geom = new THREE.BoxGeometry(options.width ?? 1, options.height ?? 1, options.depth ?? 1);
        break;
      case "sphere":
        geom = new THREE.SphereGeometry((options.radius ?? 0.5), 32, 32);
        break;
      case "cylinder":
        geom = new THREE.CylinderGeometry(options.radius ?? 0.5, options.radius ?? 0.5, options.height ?? 1, 16);
        break;
      case "plane":
        geom = new THREE.PlaneGeometry(options.width ?? 10, options.height ?? 10);
        break;
    }

    const mat = new THREE.MeshStandardMaterial({
      color: options.color ? new THREE.Color(options.color) : 0x888888,
    });
    const mesh = new THREE.Mesh(geom, mat);

    if (options.position) {
      mesh.position.set(options.position.x, options.position.y, options.position.z);
    }
    mesh.name = entityId;
    this._scene.add(mesh);
    this.meshes.set(entityId, mesh);
  }

  removeMesh(entityId: string): void {
    const mesh = this.meshes.get(entityId);
    if (mesh) {
      this._scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.meshes.delete(entityId);
    }
  }

  updateMeshTransform(
    entityId: string,
    position: { x: number; y: number; z: number },
    rotation?: { x: number; y: number; z: number; w: number },
  ): void {
    const mesh = this.meshes.get(entityId);
    if (!mesh) return;
    mesh.position.set(position.x, position.y, position.z);
    if (rotation) {
      mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
  }

  // ── Stubs for features to port later ──────────────────────────

  createTerrain(_opts: any): void { /* legacy heightmap — not used with voxel */ }
  getTerrainMeshData(): any { return null; }
  createWater(_opts: any): void { /* TODO: port water */ }
  setTerrainTransform(_pos: any, _rot: any, _scale: any): void {}
  getWaterHeightAt(_x: number, _z: number): number { return 0; }
  addWaterDrop(_x: number, _z: number, _r: number, _s: number): void {}
  attachGizmo(_id: string): void { /* TODO: port gizmos */ }
  detachGizmo(): void {}

  dispose(): void {
    this.stopRenderLoop();
    for (const mesh of this.meshes.values()) {
      this._scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.meshes.clear();
    this.renderer.dispose();
  }
}

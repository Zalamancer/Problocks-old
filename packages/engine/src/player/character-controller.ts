/**
 * Character Controller — Mockup player character with WASD movement,
 * jump, gravity, and third-person camera follow.
 *
 * Uses a Babylon.js capsule mesh + simple kinematic physics (no Rapier body).
 * Raycasts against terrain for ground detection.
 */

import * as BABYLON from "@babylonjs/core";

// ── Config ──────────────────────────────────────────────────────────

const MOVE_SPEED = 24;
const JUMP_FORCE = 18;
const GRAVITY = -40;
const GROUND_RAY_OFFSET = 0.1;
const CAPSULE_HEIGHT = 6;
const CAPSULE_RADIUS = 1.2;
const CAMERA_DISTANCE = 20;
const CAMERA_HEIGHT_OFFSET = 8;
const CAMERA_LERP = 0.08;

// ── CharacterController ─────────────────────────────────────────────

export class CharacterController {
  private scene: BABYLON.Scene;
  private mesh: BABYLON.Mesh;
  private headMesh: BABYLON.Mesh;
  private velocity = new BABYLON.Vector3(0, 0, 0);
  private grounded = false;
  private keys: Record<string, boolean> = {};
  private disposed = false;

  /** The camera that follows the character. */
  camera: BABYLON.ArcRotateCamera;

  /** Spawn position. */
  spawnPoint = new BABYLON.Vector3(0, 40, 0);

  constructor(scene: BABYLON.Scene) {
    this.scene = scene;

    // ── Character mesh (body + head) ──────────────────────────────
    // Body: cylinder
    this.mesh = BABYLON.MeshBuilder.CreateCylinder(
      "__player_body",
      { height: CAPSULE_HEIGHT, diameterTop: CAPSULE_RADIUS * 2, diameterBottom: CAPSULE_RADIUS * 2, tessellation: 16 },
      scene,
    );
    const bodyMat = new BABYLON.StandardMaterial("__player_body_mat", scene);
    bodyMat.diffuseColor = new BABYLON.Color3(0.2, 0.5, 0.9);
    bodyMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    this.mesh.material = bodyMat;
    this.mesh.isPickable = false;

    // Head: sphere on top
    this.headMesh = BABYLON.MeshBuilder.CreateSphere(
      "__player_head",
      { diameter: CAPSULE_RADIUS * 2.2, segments: 16 },
      scene,
    );
    const headMat = new BABYLON.StandardMaterial("__player_head_mat", scene);
    headMat.diffuseColor = new BABYLON.Color3(0.9, 0.7, 0.5);
    headMat.specularColor = new BABYLON.Color3(0.1, 0.1, 0.1);
    this.headMesh.material = headMat;
    this.headMesh.parent = this.mesh;
    this.headMesh.position.y = CAPSULE_HEIGHT / 2 + CAPSULE_RADIUS * 0.6;
    this.headMesh.isPickable = false;

    // Start at spawn
    this.mesh.position.copyFrom(this.spawnPoint);

    // ── Third-person camera ─────────────────────────────────────────
    this.camera = new BABYLON.ArcRotateCamera(
      "__player_camera",
      -Math.PI / 2,
      Math.PI / 3,
      CAMERA_DISTANCE,
      this.mesh.position.clone(),
      scene,
    );
    this.camera.lowerRadiusLimit = 5;
    this.camera.upperRadiusLimit = 50;
    this.camera.lowerBetaLimit = 0.2;
    this.camera.upperBetaLimit = Math.PI / 2 - 0.05;

    // ── Input ───────────────────────────────────────────────────────
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    window.addEventListener("keydown", this._onKeyDown);
    window.addEventListener("keyup", this._onKeyUp);
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Activate the character controller: switch to third-person camera,
   * spawn character, start update loop.
   */
  activate(canvas: HTMLCanvasElement): void {
    // Switch scene camera
    this.scene.activeCamera?.detachControl();
    this.scene.activeCamera = this.camera;
    this.camera.attachControl(canvas, true);

    // Disable default mouse wheel (Viewport handles orbit/zoom)
    const wheelInput = this.camera.inputs.attached["mousewheel"];
    if (wheelInput) this.camera.inputs.remove(wheelInput);

    this.mesh.position.copyFrom(this.spawnPoint);
    this.velocity.set(0, 0, 0);
  }

  /**
   * Deactivate: remove character, restore original camera.
   */
  deactivate(originalCamera: BABYLON.Camera, canvas: HTMLCanvasElement): void {
    this.camera.detachControl();
    this.scene.activeCamera = originalCamera;
    originalCamera.attachControl(canvas, true);
  }

  /**
   * Call every frame (from onBeforeRenderObservable). Handles movement,
   * gravity, ground detection, and camera follow.
   */
  update(): void {
    if (this.disposed) return;

    const dt = this.scene.getEngine().getDeltaTime() / 1000;
    if (dt <= 0 || dt > 0.1) return;

    // ── Movement direction relative to camera ─────────────────────
    const forward = this.getCameraForwardXZ();
    const right = new BABYLON.Vector3(-forward.z, 0, forward.x);

    const moveDir = new BABYLON.Vector3(0, 0, 0);
    if (this.keys["w"] || this.keys["arrowup"]) moveDir.addInPlace(forward);
    if (this.keys["s"] || this.keys["arrowdown"]) moveDir.subtractInPlace(forward);
    if (this.keys["a"] || this.keys["arrowleft"]) moveDir.subtractInPlace(right);
    if (this.keys["d"] || this.keys["arrowright"]) moveDir.addInPlace(right);

    if (moveDir.length() > 0.01) {
      moveDir.normalize();
      this.velocity.x = moveDir.x * MOVE_SPEED;
      this.velocity.z = moveDir.z * MOVE_SPEED;

      // Face movement direction
      const angle = Math.atan2(moveDir.x, moveDir.z);
      this.mesh.rotation.y = angle;
    } else {
      // Decelerate
      this.velocity.x *= 0.85;
      this.velocity.z *= 0.85;
    }

    // ── Jump ─────────────────────────────────────────────────────
    if ((this.keys[" "] || this.keys["space"]) && this.grounded) {
      this.velocity.y = JUMP_FORCE;
      this.grounded = false;
    }

    // ── Gravity ──────────────────────────────────────────────────
    this.velocity.y += GRAVITY * dt;

    // ── Apply velocity ───────────────────────────────────────────
    this.mesh.position.x += this.velocity.x * dt;
    this.mesh.position.y += this.velocity.y * dt;
    this.mesh.position.z += this.velocity.z * dt;

    // ── Ground raycast ───────────────────────────────────────────
    const rayOrigin = this.mesh.position.clone();
    rayOrigin.y += GROUND_RAY_OFFSET;
    const ray = new BABYLON.Ray(rayOrigin, BABYLON.Vector3.Down(), CAPSULE_HEIGHT / 2 + 2);
    const hit = this.scene.pickWithRay(ray, (m) => {
      // Only hit terrain meshes, not the player or UI meshes
      return !m.name.startsWith("__player") && !m.name.startsWith("__") || m.name.startsWith("terrain_");
    });

    if (hit?.hit && hit.pickedPoint) {
      const groundY = hit.pickedPoint.y + CAPSULE_HEIGHT / 2;
      if (this.mesh.position.y <= groundY) {
        this.mesh.position.y = groundY;
        this.velocity.y = 0;
        this.grounded = true;
      }
    }

    // ── Respawn if fallen too far ────────────────────────────────
    if (this.mesh.position.y < -100) {
      this.mesh.position.copyFrom(this.spawnPoint);
      this.velocity.set(0, 0, 0);
    }

    // ── Camera follow ────────────────────────────────────────────
    const targetPos = this.mesh.position.clone();
    targetPos.y += CAMERA_HEIGHT_OFFSET;
    BABYLON.Vector3.LerpToRef(this.camera.target, targetPos, CAMERA_LERP, this.camera.target);
  }

  // ── Cleanup ───────────────────────────────────────────────────────

  dispose(): void {
    this.disposed = true;
    window.removeEventListener("keydown", this._onKeyDown);
    window.removeEventListener("keyup", this._onKeyUp);
    this.headMesh.dispose();
    this.mesh.dispose();
    this.camera.dispose();
  }

  // ── Internals ─────────────────────────────────────────────────────

  private getCameraForwardXZ(): BABYLON.Vector3 {
    const dir = this.camera.getForwardRay().direction;
    dir.y = 0;
    dir.normalize();
    return dir;
  }

  private _onKeyDown(e: KeyboardEvent): void {
    this.keys[e.key.toLowerCase()] = true;
  }

  private _onKeyUp(e: KeyboardEvent): void {
    this.keys[e.key.toLowerCase()] = false;
  }
}

/**
 * Unified translate + rotate + scale gizmo for Babylon.js.
 * Ported from AutoAnimation's UnifiedGizmo3D (R3F) — same octant visual style.
 *
 * Visual design:
 *  • Quarter arcs — Tube meshes (XY=cyan, XZ=red, YZ=blue) → rotation
 *  • Axis arrows — Cylinder shafts + Cone tips (Y=red, X=blue, Z=cyan) → translation
 *  • Cube nodes — Box at arc endpoints with invisible hitboxes → per-axis scale
 *  • Gray circle discs — at plane intersection points → uniform scale
 *  • Ghost rings — Torus with low opacity
 *  • Gold hover highlight (0xf0c030)
 *
 * Interaction:
 *  • Pointer-down on a handle → pointer-move computes delta → pointer-up commits.
 *  • All changes via `onChange` callback.
 */
import * as BABYLON from '@babylonjs/core';

// ─── Types ──────────────────────────────────────────────────────────────────

export type GizmoHandle =
  | 'translate-x' | 'translate-y' | 'translate-z'
  | 'rotate-x' | 'rotate-y' | 'rotate-z'
  | 'scale-x' | 'scale-y' | 'scale-z'
  | 'scale-uniform'
  | null;

// ─── Constants ──────────────────────────────────────────────────────────────

const RED   = new BABYLON.Color3(0xea / 255, 0x40 / 255, 0x50 / 255);
const BLUE  = new BABYLON.Color3(0x38 / 255, 0x88 / 255, 0xf0 / 255);
const CYAN  = new BABYLON.Color3(0x10 / 255, 0xd0 / 255, 0xa0 / 255);
const GRAY  = new BABYLON.Color3(0.5, 0.5, 0.5);
const GOLD  = new BABYLON.Color3(0xf0 / 255, 0xc0 / 255, 0x30 / 255);

const ARC_R    = 1.45;
const ARC_TUBE = 0.032;
const AXIS_LEN = 2.2;
const CUBE_SIZE = 0.13;
const CUBE_HIT  = 0.4;
const DISC_R   = 0.1;
const DISC_IN  = 0.45;
const GHOST_R  = 1.75;

const AXIS_DIR: Record<string, BABYLON.Vector3> = {
  x: new BABYLON.Vector3(1, 0, 0),
  y: new BABYLON.Vector3(0, 1, 0),
  z: new BABYLON.Vector3(0, 0, 1),
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMat(scene: BABYLON.Scene, color: BABYLON.Color3, alpha = 1): BABYLON.StandardMaterial {
  const mat = new BABYLON.StandardMaterial('gizmo_mat_' + Math.random().toString(36).slice(2), scene);
  mat.emissiveColor = color;
  mat.diffuseColor = BABYLON.Color3.Black();
  mat.specularColor = BABYLON.Color3.Black();
  mat.alpha = alpha;
  mat.disableLighting = true;
  mat.backFaceCulling = false;
  return mat;
}

function buildQuarterArcPoints(plane: 'xy' | 'xz' | 'yz'): BABYLON.Vector3[] {
  const N = 36;
  const pts: BABYLON.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * (Math.PI / 2);
    const c = Math.cos(t);
    const s = Math.sin(t);
    if (plane === 'xy') pts.push(new BABYLON.Vector3(ARC_R * c, ARC_R * s, 0));
    else if (plane === 'xz') pts.push(new BABYLON.Vector3(ARC_R * s, 0, ARC_R * c));
    else pts.push(new BABYLON.Vector3(0, ARC_R * s, ARC_R * c));
  }
  return pts;
}

function createTubeFromPoints(
  name: string,
  points: BABYLON.Vector3[],
  radius: number,
  scene: BABYLON.Scene,
): BABYLON.Mesh {
  return BABYLON.MeshBuilder.CreateTube(name, {
    path: points,
    radius,
    tessellation: 8,
    updatable: false,
  }, scene);
}

function projectOnAxis(
  ray: BABYLON.Ray,
  origin: BABYLON.Vector3,
  axisDir: BABYLON.Vector3,
  camDir: BABYLON.Vector3,
): BABYLON.Vector3 | null {
  const camCross = BABYLON.Vector3.Cross(camDir, axisDir);
  let planeNormal = BABYLON.Vector3.Cross(axisDir, camCross);
  if (planeNormal.lengthSquared() < 0.0001) {
    planeNormal = camDir.clone();
  }
  planeNormal.normalize();

  const plane = BABYLON.Plane.FromPositionAndNormal(origin, planeNormal);
  const dist = ray.intersectsPlane(plane);
  if (dist === null) return null;

  const hitPoint = ray.origin.add(ray.direction.scale(dist));
  const t = BABYLON.Vector3.Dot(hitPoint.subtract(origin), axisDir);
  return origin.add(axisDir.scale(t));
}

function projectOnRotationPlane(
  ray: BABYLON.Ray,
  origin: BABYLON.Vector3,
  axisDir: BABYLON.Vector3,
): BABYLON.Vector3 | null {
  const plane = BABYLON.Plane.FromPositionAndNormal(origin, axisDir);
  const dist = ray.intersectsPlane(plane);
  if (dist === null) return null;
  return ray.origin.add(ray.direction.scale(dist));
}

// ═══════════════════════════════════════════════════════════════════════════

export class UnifiedGizmo {
  private scene: BABYLON.Scene;
  private root: BABYLON.TransformNode;
  private target: BABYLON.AbstractMesh | null = null;
  private onChange: (() => void) | null = null;
  private size: number;

  private hovered: GizmoHandle = null;
  private dragging: GizmoHandle = null;

  private handleMeshes: Map<string, { visual: BABYLON.Mesh[]; hitbox: BABYLON.Mesh[]; color: BABYLON.Color3 }> = new Map();
  private materials: Map<string, BABYLON.StandardMaterial> = new Map();
  private goldMat: BABYLON.StandardMaterial;

  private dragState: {
    handle: GizmoHandle;
    startPos: BABYLON.Vector3;
    startRot: BABYLON.Quaternion;
    startScale: BABYLON.Vector3;
    startAxisPoint: BABYLON.Vector3;
    origin: BABYLON.Vector3;
    axisWorld: BABYLON.Vector3;
  } | null = null;

  private observer: BABYLON.Nullable<BABYLON.Observer<BABYLON.Scene>> = null;
  private pointerObserver: BABYLON.Nullable<BABYLON.Observer<BABYLON.PointerInfo>> = null;

  constructor(scene: BABYLON.Scene, size = 1) {
    this.scene = scene;
    this.size = size;
    this.root = new BABYLON.TransformNode('__gizmo_root', scene);

    this.goldMat = makeMat(scene, GOLD);

    this.buildVisuals();
    this.setupPointerEvents();
    this.setupBeforeRender();

    this.root.setEnabled(false);
  }

  // ── Public API ──────────────────────────────────────────────────────────

  attach(mesh: BABYLON.AbstractMesh, onChange?: () => void): void {
    this.target = mesh;
    this.onChange = onChange ?? null;
    this.root.setEnabled(true);
  }

  detach(): void {
    this.target = null;
    this.onChange = null;
    this.root.setEnabled(false);
    this.hovered = null;
    this.dragging = null;
    this.updateHighlights();
  }

  dispose(): void {
    if (this.observer) this.scene.onBeforeRenderObservable.remove(this.observer);
    if (this.pointerObserver) this.scene.onPointerObservable.remove(this.pointerObserver);
    this.root.dispose(false, true);
  }

  // ── Build all visual meshes ─────────────────────────────────────────────

  private buildVisuals(): void {
    const s = this.scene;
    const renderGroup = 1;

    // Utility to configure a mesh for always-on-top gizmo rendering
    const configureMesh = (mesh: BABYLON.Mesh, mat: BABYLON.StandardMaterial, isHitbox = false) => {
      mesh.material = mat;
      mesh.renderingGroupId = renderGroup;
      mesh.isPickable = isHitbox;
      mesh.parent = this.root;
      if (isHitbox) {
        mesh.visibility = 0;
      }
    };

    // ── Quarter arcs (rotation) ──────────────────────────────────────────

    // XY arc → rotate-z (cyan)
    this.createHandlePair('rotate-z', CYAN, () => {
      const pts = buildQuarterArcPoints('xy');
      const visual = createTubeFromPoints('__gizmo_arc_xy', pts, ARC_TUBE, s);
      const hitbox = createTubeFromPoints('__gizmo_arc_xy_hit', pts, 0.12, s);
      return { visual: [visual], hitbox: [hitbox] };
    });

    // XZ arc → rotate-y (red)
    this.createHandlePair('rotate-y', RED, () => {
      const pts = buildQuarterArcPoints('xz');
      const visual = createTubeFromPoints('__gizmo_arc_xz', pts, ARC_TUBE, s);
      const hitbox = createTubeFromPoints('__gizmo_arc_xz_hit', pts, 0.12, s);
      return { visual: [visual], hitbox: [hitbox] };
    });

    // YZ arc → rotate-x (blue)
    this.createHandlePair('rotate-x', BLUE, () => {
      const pts = buildQuarterArcPoints('yz');
      const visual = createTubeFromPoints('__gizmo_arc_yz', pts, ARC_TUBE, s);
      const hitbox = createTubeFromPoints('__gizmo_arc_yz_hit', pts, 0.12, s);
      return { visual: [visual], hitbox: [hitbox] };
    });

    // ── Axis arrows (translate) ──────────────────────────────────────────

    // Y axis (red)
    this.createHandlePair('translate-y', RED, () => {
      const shaft = BABYLON.MeshBuilder.CreateCylinder('__gizmo_shaft_y', {
        diameter: 0.036, height: AXIS_LEN, tessellation: 6,
      }, s);
      shaft.position.y = AXIS_LEN / 2;

      const cone = BABYLON.MeshBuilder.CreateCylinder('__gizmo_cone_y', {
        diameterTop: 0, diameterBottom: 0.14, height: 0.22, tessellation: 6,
      }, s);
      cone.position.y = AXIS_LEN + 0.09;

      const shaftHit = BABYLON.MeshBuilder.CreateCylinder('__gizmo_shaft_y_hit', {
        diameter: 0.16, height: AXIS_LEN, tessellation: 6,
      }, s);
      shaftHit.position.y = AXIS_LEN / 2;

      const coneHit = BABYLON.MeshBuilder.CreateCylinder('__gizmo_cone_y_hit', {
        diameterTop: 0, diameterBottom: 0.3, height: 0.3, tessellation: 6,
      }, s);
      coneHit.position.y = AXIS_LEN + 0.09;

      return { visual: [shaft, cone], hitbox: [shaftHit, coneHit] };
    });

    // X axis (blue) — rotate shaft to point along X
    this.createHandlePair('translate-x', BLUE, () => {
      const shaft = BABYLON.MeshBuilder.CreateCylinder('__gizmo_shaft_x', {
        diameter: 0.036, height: AXIS_LEN, tessellation: 6,
      }, s);
      shaft.rotation.z = -Math.PI / 2;
      shaft.position.x = AXIS_LEN / 2;

      const cone = BABYLON.MeshBuilder.CreateCylinder('__gizmo_cone_x', {
        diameterTop: 0, diameterBottom: 0.14, height: 0.22, tessellation: 6,
      }, s);
      cone.rotation.z = -Math.PI / 2;
      cone.position.x = AXIS_LEN + 0.09;

      const shaftHit = BABYLON.MeshBuilder.CreateCylinder('__gizmo_shaft_x_hit', {
        diameter: 0.16, height: AXIS_LEN, tessellation: 6,
      }, s);
      shaftHit.rotation.z = -Math.PI / 2;
      shaftHit.position.x = AXIS_LEN / 2;

      const coneHit = BABYLON.MeshBuilder.CreateCylinder('__gizmo_cone_x_hit', {
        diameterTop: 0, diameterBottom: 0.3, height: 0.3, tessellation: 6,
      }, s);
      coneHit.rotation.z = -Math.PI / 2;
      coneHit.position.x = AXIS_LEN + 0.09;

      return { visual: [shaft, cone], hitbox: [shaftHit, coneHit] };
    });

    // Z axis (cyan) — rotate shaft to point along Z
    this.createHandlePair('translate-z', CYAN, () => {
      const shaft = BABYLON.MeshBuilder.CreateCylinder('__gizmo_shaft_z', {
        diameter: 0.036, height: AXIS_LEN, tessellation: 6,
      }, s);
      shaft.rotation.x = Math.PI / 2;
      shaft.position.z = AXIS_LEN / 2;

      const cone = BABYLON.MeshBuilder.CreateCylinder('__gizmo_cone_z', {
        diameterTop: 0, diameterBottom: 0.14, height: 0.22, tessellation: 6,
      }, s);
      cone.rotation.x = Math.PI / 2;
      cone.position.z = AXIS_LEN + 0.09;

      const shaftHit = BABYLON.MeshBuilder.CreateCylinder('__gizmo_shaft_z_hit', {
        diameter: 0.16, height: AXIS_LEN, tessellation: 6,
      }, s);
      shaftHit.rotation.x = Math.PI / 2;
      shaftHit.position.z = AXIS_LEN / 2;

      const coneHit = BABYLON.MeshBuilder.CreateCylinder('__gizmo_cone_z_hit', {
        diameterTop: 0, diameterBottom: 0.3, height: 0.3, tessellation: 6,
      }, s);
      coneHit.rotation.x = Math.PI / 2;
      coneHit.position.z = AXIS_LEN + 0.09;

      return { visual: [shaft, cone], hitbox: [shaftHit, coneHit] };
    });

    // ── Cube nodes (scale) at arc endpoints ──────────────────────────────

    // Y cube (red)
    this.createHandlePair('scale-y', RED, () => {
      const cube = BABYLON.MeshBuilder.CreateBox('__gizmo_cube_y', { size: CUBE_SIZE }, s);
      cube.position.y = ARC_R;
      const hit = BABYLON.MeshBuilder.CreateBox('__gizmo_cube_y_hit', { size: CUBE_HIT }, s);
      hit.position.y = ARC_R;
      return { visual: [cube], hitbox: [hit] };
    });

    // X cube (blue)
    this.createHandlePair('scale-x', BLUE, () => {
      const cube = BABYLON.MeshBuilder.CreateBox('__gizmo_cube_x', { size: CUBE_SIZE }, s);
      cube.position.x = ARC_R;
      const hit = BABYLON.MeshBuilder.CreateBox('__gizmo_cube_x_hit', { size: CUBE_HIT }, s);
      hit.position.x = ARC_R;
      return { visual: [cube], hitbox: [hit] };
    });

    // Z cube (cyan)
    this.createHandlePair('scale-z', CYAN, () => {
      const cube = BABYLON.MeshBuilder.CreateBox('__gizmo_cube_z', { size: CUBE_SIZE }, s);
      cube.position.z = ARC_R;
      const hit = BABYLON.MeshBuilder.CreateBox('__gizmo_cube_z_hit', { size: CUBE_HIT }, s);
      hit.position.z = ARC_R;
      return { visual: [cube], hitbox: [hit] };
    });

    // ── Gray discs (uniform scale) ───────────────────────────────────────

    this.createHandlePair('scale-uniform', GRAY, () => {
      // XY disc
      const d1 = BABYLON.MeshBuilder.CreateDisc('__gizmo_disc_xy', { radius: DISC_R, tessellation: 16 }, s);
      d1.position.set(DISC_IN, DISC_IN, 0);
      const d1h = BABYLON.MeshBuilder.CreateDisc('__gizmo_disc_xy_hit', { radius: DISC_R * 2, tessellation: 16 }, s);
      d1h.position.set(DISC_IN, DISC_IN, 0);

      // XZ disc
      const d2 = BABYLON.MeshBuilder.CreateDisc('__gizmo_disc_xz', { radius: DISC_R, tessellation: 16 }, s);
      d2.position.set(DISC_IN, 0, DISC_IN);
      d2.rotation.x = Math.PI / 2;
      const d2h = BABYLON.MeshBuilder.CreateDisc('__gizmo_disc_xz_hit', { radius: DISC_R * 2, tessellation: 16 }, s);
      d2h.position.set(DISC_IN, 0, DISC_IN);
      d2h.rotation.x = Math.PI / 2;

      // YZ disc
      const d3 = BABYLON.MeshBuilder.CreateDisc('__gizmo_disc_yz', { radius: DISC_R, tessellation: 16 }, s);
      d3.position.set(0, DISC_IN, DISC_IN);
      d3.rotation.y = Math.PI / 2;
      const d3h = BABYLON.MeshBuilder.CreateDisc('__gizmo_disc_yz_hit', { radius: DISC_R * 2, tessellation: 16 }, s);
      d3h.position.set(0, DISC_IN, DISC_IN);
      d3h.rotation.y = Math.PI / 2;

      return { visual: [d1, d2, d3], hitbox: [d1h, d2h, d3h] };
    });

    // ── Ghost rings (visual reference, no interaction) ───────────────────

    const ghostMat = makeMat(s, new BABYLON.Color3(0.31, 0.31, 0.35), 0.12);

    const ghostXY = BABYLON.MeshBuilder.CreateTorus('__gizmo_ghost_xy', {
      diameter: GHOST_R * 2, thickness: 0.01, tessellation: 80,
    }, s);
    ghostXY.material = ghostMat;
    ghostXY.renderingGroupId = renderGroup;
    ghostXY.isPickable = false;
    ghostXY.parent = this.root;

    const ghostXZ = BABYLON.MeshBuilder.CreateTorus('__gizmo_ghost_xz', {
      diameter: GHOST_R * 2, thickness: 0.01, tessellation: 80,
    }, s);
    ghostXZ.rotation.x = Math.PI / 2;
    ghostXZ.material = ghostMat;
    ghostXZ.renderingGroupId = renderGroup;
    ghostXZ.isPickable = false;
    ghostXZ.parent = this.root;

    const ghostYZ = BABYLON.MeshBuilder.CreateTorus('__gizmo_ghost_yz', {
      diameter: GHOST_R * 2, thickness: 0.01, tessellation: 80,
    }, s);
    ghostYZ.rotation.z = Math.PI / 2;
    ghostYZ.material = ghostMat;
    ghostYZ.renderingGroupId = renderGroup;
    ghostYZ.isPickable = false;
    ghostYZ.parent = this.root;

    // Configure rendering group to render on top
    this.scene.setRenderingAutoClearDepthStencil(renderGroup, true, true, false);
  }

  private createHandlePair(
    handle: string,
    color: BABYLON.Color3,
    builder: () => { visual: BABYLON.Mesh[]; hitbox: BABYLON.Mesh[] },
  ): void {
    const mat = makeMat(this.scene, color);
    this.materials.set(handle, mat);

    const { visual, hitbox } = builder();

    for (const m of visual) {
      m.material = mat;
      m.renderingGroupId = 1;
      m.isPickable = false;
      m.parent = this.root;
    }

    for (const m of hitbox) {
      m.material = mat;
      m.renderingGroupId = 1;
      m.isPickable = true;
      m.visibility = 0;
      m.parent = this.root;
      // Tag for identification
      m.metadata = { gizmoHandle: handle };
    }

    this.handleMeshes.set(handle, { visual, hitbox, color });
  }

  // ── Pointer events ────────────────────────────────────────────────────

  private setupPointerEvents(): void {
    this.pointerObserver = this.scene.onPointerObservable.add((pointerInfo) => {
      if (!this.target || !this.root.isEnabled()) return;

      switch (pointerInfo.type) {
        case BABYLON.PointerEventTypes.POINTERMOVE: {
          if (this.dragging) {
            this.handleDrag(pointerInfo.event as PointerEvent);
          } else {
            // Hover detection
            const pick = this.scene.pick(
              this.scene.pointerX,
              this.scene.pointerY,
              (mesh) => mesh.metadata?.gizmoHandle != null,
            );
            const newHovered = pick?.hit ? (pick.pickedMesh?.metadata?.gizmoHandle as GizmoHandle) : null;
            if (newHovered !== this.hovered) {
              this.hovered = newHovered;
              this.updateHighlights();
              const canvas = this.scene.getEngine().getRenderingCanvas();
              if (canvas) canvas.style.cursor = newHovered ? 'pointer' : '';
            }
          }
          break;
        }

        case BABYLON.PointerEventTypes.POINTERDOWN: {
          const pick = this.scene.pick(
            this.scene.pointerX,
            this.scene.pointerY,
            (mesh) => mesh.metadata?.gizmoHandle != null,
          );
          if (pick?.hit && pick.pickedMesh?.metadata?.gizmoHandle) {
            const handle = pick.pickedMesh.metadata.gizmoHandle as GizmoHandle;
            this.startDrag(handle, pointerInfo.event as PointerEvent);
          }
          break;
        }

        case BABYLON.PointerEventTypes.POINTERUP: {
          if (this.dragging) {
            this.endDrag();
          }
          break;
        }
      }
    });
  }

  private startDrag(handle: GizmoHandle, _evt: PointerEvent): void {
    if (!handle || !this.target) return;

    this.dragging = handle;
    this.updateHighlights();

    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (canvas) canvas.style.cursor = 'grabbing';

    // Disable camera controls
    const camera = this.scene.activeCamera;
    if (camera) {
      camera.detachControl();
    }

    const origin = this.target.getAbsolutePosition().clone();
    const axisKey = handle.split('-')[1] as 'x' | 'y' | 'z' | 'uniform';
    let axisWorld = BABYLON.Vector3.Up();

    if (axisKey !== 'uniform') {
      axisWorld = AXIS_DIR[axisKey].clone();
    }

    const ray = this.scene.createPickingRay(
      this.scene.pointerX,
      this.scene.pointerY,
      BABYLON.Matrix.Identity(),
      this.scene.activeCamera!,
    );

    const type = handle.split('-')[0] as 'translate' | 'rotate' | 'scale';
    let startAxisPoint = origin.clone();

    const camDir = this.scene.activeCamera!.getForwardRay().direction;

    if (type === 'rotate') {
      const pt = projectOnRotationPlane(ray, origin, axisWorld);
      if (pt) startAxisPoint = pt;
    } else {
      const pt = projectOnAxis(ray, origin, axisWorld, camDir);
      if (pt) startAxisPoint = pt;
    }

    this.dragState = {
      handle,
      startPos: this.target.position.clone(),
      startRot: this.target.rotationQuaternion?.clone() ?? BABYLON.Quaternion.FromEulerAngles(
        this.target.rotation.x, this.target.rotation.y, this.target.rotation.z,
      ),
      startScale: this.target.scaling.clone(),
      startAxisPoint,
      origin,
      axisWorld,
    };
  }

  private handleDrag(_evt: PointerEvent): void {
    if (!this.dragState || !this.target) return;

    const { handle, startPos, startRot, startScale, startAxisPoint, origin, axisWorld } = this.dragState;
    const type = handle!.split('-')[0] as 'translate' | 'rotate' | 'scale';
    const axisKey = handle!.split('-')[1] as 'x' | 'y' | 'z' | 'uniform';

    const ray = this.scene.createPickingRay(
      this.scene.pointerX,
      this.scene.pointerY,
      BABYLON.Matrix.Identity(),
      this.scene.activeCamera!,
    );

    const camDir = this.scene.activeCamera!.getForwardRay().direction;

    if (type === 'translate') {
      const currentPoint = projectOnAxis(ray, origin, axisWorld, camDir);
      if (!currentPoint) return;

      const delta = currentPoint.subtract(startAxisPoint);
      this.target.position = startPos.add(delta);
      this.onChange?.();
    } else if (type === 'rotate') {
      const currentPoint = projectOnRotationPlane(ray, origin, axisWorld);
      if (!currentPoint) return;

      const startVec = startAxisPoint.subtract(origin).normalize();
      const currentVec = currentPoint.subtract(origin).normalize();

      let angle = Math.acos(BABYLON.Scalar.Clamp(BABYLON.Vector3.Dot(startVec, currentVec), -1, 1));
      const cross = BABYLON.Vector3.Cross(startVec, currentVec);
      if (BABYLON.Vector3.Dot(cross, axisWorld) < 0) angle = -angle;

      const rotDelta = BABYLON.Quaternion.RotationAxis(axisWorld, angle);
      this.target.rotationQuaternion = rotDelta.multiply(startRot);
      this.onChange?.();
    } else if (type === 'scale') {
      if (axisKey === 'uniform') {
        const currentPoint = projectOnAxis(ray, origin, BABYLON.Vector3.Up(), camDir);
        if (!currentPoint) return;
        const delta = currentPoint.y - startAxisPoint.y;
        const factor = Math.max(0.01, 1 + delta * 2);
        this.target.scaling = startScale.scale(factor);
        this.onChange?.();
      } else {
        const currentPoint = projectOnAxis(ray, origin, axisWorld, camDir);
        if (!currentPoint) return;

        const startDist = BABYLON.Vector3.Dot(startAxisPoint.subtract(origin), axisWorld);
        const currentDist = BABYLON.Vector3.Dot(currentPoint.subtract(origin), axisWorld);
        const factor = startDist !== 0 ? currentDist / startDist : 1;

        const newScale = startScale.clone();
        if (axisKey === 'x') newScale.x *= Math.max(0.01, factor);
        else if (axisKey === 'y') newScale.y *= Math.max(0.01, factor);
        else if (axisKey === 'z') newScale.z *= Math.max(0.01, factor);
        this.target.scaling = newScale;
        this.onChange?.();
      }
    }
  }

  private endDrag(): void {
    this.dragState = null;
    this.dragging = null;
    this.updateHighlights();

    const canvas = this.scene.getEngine().getRenderingCanvas();
    if (canvas) canvas.style.cursor = this.hovered ? 'pointer' : '';

    // Re-enable camera controls
    const camera = this.scene.activeCamera;
    if (camera) {
      const canvasEl = this.scene.getEngine().getRenderingCanvas();
      if (canvasEl) camera.attachControl(canvasEl, true);
    }
  }

  // ── Highlight ─────────────────────────────────────────────────────────

  private updateHighlights(): void {
    for (const [handle, entry] of this.handleMeshes) {
      const isActive = handle === this.hovered || handle === this.dragging;
      const mat = isActive ? this.goldMat : this.materials.get(handle)!;
      for (const m of entry.visual) {
        m.material = mat;
      }
    }
  }

  // ── Before render: follow target + constant screen size ───────────────

  private setupBeforeRender(): void {
    this.observer = this.scene.onBeforeRenderObservable.add(() => {
      if (!this.target || !this.root.isEnabled()) return;

      const worldPos = this.target.getAbsolutePosition();
      this.root.position.copyFrom(worldPos);

      const camera = this.scene.activeCamera;
      if (camera) {
        const dist = BABYLON.Vector3.Distance(camera.position, worldPos);
        const s = dist * 0.18 * this.size;
        this.root.scaling.setAll(s);
      }
    });
  }
}

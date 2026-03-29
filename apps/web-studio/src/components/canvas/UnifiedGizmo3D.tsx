/**
 * Unified translate + rotate + scale gizmo rendered as a single R3F component.
 *
 * Visual design — octant style:
 *  • Quarter arcs — CatmullRomCurve3 → TubeGeometry (XY=cyan, XZ=red, YZ=blue)
 *  • Axis arrows — CylinderGeometry shafts + ConeGeometry tips (R=Y, B=X, C=Z)
 *  • Cube nodes — BoxGeometry at axis endpoints with invisible hitboxes
 *  • Gray circle discs — CircleGeometry at plane intersection points
 *  • Ghost rings — TorusGeometry with low opacity
 *  • Gold hover highlight (0xf0c030)
 *
 * Interaction (unchanged from original):
 *  • Pointer-down on a handle → pointer-move computes delta → pointer-up commits.
 *  • translate-x/y/z, rotate-x/y/z, scale-x/y/z, scale-uniform via center discs
 *  • All changes via `onChange` callback.
 */
import { useRef, useState, useCallback, useMemo, useEffect, memo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─── Types ──────────────────────────────────────────────────────────────────

export type GizmoHandle =
  | 'translate-x' | 'translate-y' | 'translate-z'
  | 'rotate-x' | 'rotate-y' | 'rotate-z'
  | 'scale-x' | 'scale-y' | 'scale-z'
  | 'scale-uniform'
  | null

export interface UnifiedGizmoProps {
  /** The Object3D the gizmo is attached to (e.g. a bone) */
  target: THREE.Object3D
  /** Callback fired continuously while dragging. Receives the LIVE target transforms. */
  onChange: () => void
  /** Gizmo size multiplier (default 1) */
  size?: number
  /** Whether the gizmo is visible */
  visible?: boolean
}

// ─── Constants ──────────────────────────────────────────────────────────────

// Octant color palette
const RED   = 0xea4050
const BLUE  = 0x3888f0
const CYAN  = 0x10d0a0
const GRAY  = 0x808080
const GOLD  = 0xf0c030

// Dimensions
const ARC_R    = 1.45      // Quarter arc radius
const ARC_TUBE = 0.032     // Arc tube thickness
const AXIS_LEN = 2.2       // Arrow shaft length
const CUBE_SIZE = 0.13     // Cube visual size
const CUBE_HIT  = 0.4      // Cube invisible hitbox size
const DISC_R   = 0.1       // Gray disc radius
const DISC_IN  = 0.45      // Disc inset from origin
const GHOST_R  = 1.75      // Ghost ring radius

// ─── Axis directions ────────────────────────────────────────────────────────

const AXIS_DIR: Record<string, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
}

// ─── Shared materials helper ────────────────────────────────────────────────

function makeMat(color: number, opacity = 1): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  })
}

// ─── Helper: project a world-space drag to an axis ──────────────────────────

const _plane = new THREE.Plane()
const _intersection = new THREE.Vector3()

function projectOnAxis(
  ray: THREE.Raycaster,
  origin: THREE.Vector3,
  axisDir: THREE.Vector3,
  camera: THREE.Camera
): THREE.Vector3 | null {
  const camDir = new THREE.Vector3()
  camera.getWorldDirection(camDir)

  const camCross = new THREE.Vector3().crossVectors(camDir, axisDir)
  const planeNormal = new THREE.Vector3().crossVectors(axisDir, camCross).normalize()

  if (planeNormal.lengthSq() < 0.0001) {
    planeNormal.copy(camDir)
  }

  _plane.setFromNormalAndCoplanarPoint(planeNormal, origin)

  if (!ray.ray.intersectPlane(_plane, _intersection)) return null

  const t = _intersection.clone().sub(origin).dot(axisDir)
  return origin.clone().add(axisDir.clone().multiplyScalar(t))
}

function projectOnRotationPlane(
  ray: THREE.Raycaster,
  origin: THREE.Vector3,
  axisDir: THREE.Vector3
): THREE.Vector3 | null {
  _plane.setFromNormalAndCoplanarPoint(axisDir, origin)
  if (!ray.ray.intersectPlane(_plane, _intersection)) return null
  return _intersection.clone()
}

// ─── Quarter arc geometry builder ───────────────────────────────────────────

function buildQuarterArcPoints(plane: 'xy' | 'xz' | 'yz'): THREE.Vector3[] {
  const N = 36
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * (Math.PI / 2)
    const c = Math.cos(t)
    const s = Math.sin(t)
    if (plane === 'xy') pts.push(new THREE.Vector3(ARC_R * c, ARC_R * s, 0))
    else if (plane === 'xz') pts.push(new THREE.Vector3(ARC_R * s, 0, ARC_R * c))
    else pts.push(new THREE.Vector3(0, ARC_R * s, ARC_R * c))
  }
  return pts
}

function buildQuarterArcGeometry(plane: 'xy' | 'xz' | 'yz'): THREE.TubeGeometry {
  const pts = buildQuarterArcPoints(plane)
  const curve = new THREE.CatmullRomCurve3(pts)
  return new THREE.TubeGeometry(curve, 36, ARC_TUBE, 8, false)
}

/** Thicker invisible tube for easier raycasting on arcs */
function buildQuarterArcHitGeometry(plane: 'xy' | 'xz' | 'yz'): THREE.TubeGeometry {
  const pts = buildQuarterArcPoints(plane)
  const curve = new THREE.CatmullRomCurve3(pts)
  return new THREE.TubeGeometry(curve, 36, 0.12, 8, false) // 4× thicker hit area
}

// ═══════════════════════════════════════════════════════════════════════════

export const UnifiedGizmo3D = memo(function UnifiedGizmo3D({
  target,
  onChange,
  size = 1,
  visible = true,
}: UnifiedGizmoProps) {
  const groupRef = useRef<THREE.Group>(null!)
  const { camera, gl, raycaster, controls } = useThree()

  const [hovered, setHovered] = useState<GizmoHandle>(null)
  const [dragging, setDragging] = useState<GizmoHandle>(null)

  // Refs for drag state
  const dragStartRef = useRef<{
    handle: GizmoHandle
    startPos: THREE.Vector3
    startQuat: THREE.Quaternion
    startScale: THREE.Vector3
    startAngle: number
    startAxisPoint: THREE.Vector3
    origin: THREE.Vector3
    axisWorld: THREE.Vector3
  } | null>(null)

  // ── Materials (memoized) ──────────────────────────────────────────────

  const materials = useMemo(() => ({
    red:      makeMat(RED),
    blue:     makeMat(BLUE),
    cyan:     makeMat(CYAN),
    gray:     makeMat(GRAY),
    gold:     makeMat(GOLD),
    ghost:    makeMat(0x505058, 0.12),
    invisible: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthTest: false, depthWrite: false, side: THREE.DoubleSide }),
  }), [])

  // ── Geometries (memoized) ─────────────────────────────────────────────

  const geom = useMemo(() => ({
    // Quarter arcs (visual)
    arcXY: buildQuarterArcGeometry('xy'),
    arcXZ: buildQuarterArcGeometry('xz'),
    arcYZ: buildQuarterArcGeometry('yz'),
    // Quarter arcs (invisible thicker hitbox for easy clicking)
    arcHitXY: buildQuarterArcHitGeometry('xy'),
    arcHitXZ: buildQuarterArcHitGeometry('xz'),
    arcHitYZ: buildQuarterArcHitGeometry('yz'),
    // Arrow shafts
    shaft: new THREE.CylinderGeometry(0.018, 0.018, AXIS_LEN, 6),
    // Arrow shaft hitbox (wider for easier clicking)
    shaftHit: new THREE.CylinderGeometry(0.08, 0.08, AXIS_LEN, 6),
    // Arrow cone tips
    cone: new THREE.ConeGeometry(0.07, 0.22, 6),
    // Cube nodes
    cube: new THREE.BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE),
    cubeHit: new THREE.BoxGeometry(CUBE_HIT, CUBE_HIT, CUBE_HIT),
    // Gray circle discs
    disc: new THREE.CircleGeometry(DISC_R, 16),
    // Disc hitbox (double-sided larger circle)
    discHit: new THREE.CircleGeometry(DISC_R * 2, 16),
    // Ghost rings
    ghostRing: new THREE.TorusGeometry(GHOST_R, 0.005, 4, 80),
  }), [])

  // Temp vectors for position computation
  const _worldPos = useMemo(() => new THREE.Vector3(), [])
  const _localPos = useMemo(() => new THREE.Vector3(), [])
  const _parentInv = useMemo(() => new THREE.Matrix4(), [])

  // ── Keep gizmo at target position, scale by camera distance ──────────

  useFrame(() => {
    if (!groupRef.current || !target) return

    // Get bone world position
    target.getWorldPosition(_worldPos)

    // Convert to local position relative to gizmo's parent
    // (since gizmo is inside the character group, we need local coords)
    if (groupRef.current.parent) {
      _parentInv.copy(groupRef.current.parent.matrixWorld).invert()
      _localPos.copy(_worldPos).applyMatrix4(_parentInv)
      groupRef.current.position.copy(_localPos)
    } else {
      groupRef.current.position.copy(_worldPos)
    }

    // Scale gizmo based on camera distance for consistent screen size
    const dist = camera.position.distanceTo(_worldPos)
    const s = dist * 0.18 * size
    groupRef.current.scale.setScalar(s)
  })

  // ── Raycast helpers ─────────────────────────────────────────────────

  const getHandle = useCallback(
    (e: THREE.Event | any): GizmoHandle => {
      const obj = e?.object
      if (!obj) return null
      return (obj.userData?.gizmoHandle as GizmoHandle) ?? null
    },
    []
  )

  // ── Pointer handlers ──────────────────────────────────────────────────

  const onPointerOver = useCallback(
    (e: any) => {
      e.stopPropagation()
      const handle = getHandle(e)
      if (handle) {
        setHovered(handle)
        gl.domElement.style.cursor = 'pointer'
      }
    },
    [getHandle, gl]
  )

  const onPointerOut = useCallback(
    (e: any) => {
      e.stopPropagation()
      setHovered(null)
      if (!dragging) gl.domElement.style.cursor = 'auto'
    },
    [dragging, gl]
  )

  const onPointerDown = useCallback(
    (e: any) => {
      e.stopPropagation()
      const handle = getHandle(e)
      if (!handle || !target) return

      console.log('[UnifiedGizmo3D] pointerDown handle:', handle, 'target:', target.name)
      setDragging(handle)
      gl.domElement.style.cursor = 'grabbing'

      const origin = new THREE.Vector3()
      target.getWorldPosition(origin)

      const axisKey = handle.split('-')[1] as 'x' | 'y' | 'z' | 'uniform'
      let axisWorld = new THREE.Vector3(0, 1, 0)

      if (axisKey !== 'uniform') {
        // Global coordinate space — axis directions are world-aligned, not bone-local
        axisWorld = AXIS_DIR[axisKey].clone()
      }

      // Disable orbit controls while dragging gizmo
      if (controls) {
        (controls as any).enabled = false
      }

      let startAxisPoint = origin.clone()
      const type = handle.split('-')[0] as 'translate' | 'rotate' | 'scale'

      if (type === 'rotate') {
        const pt = projectOnRotationPlane(raycaster, origin, axisWorld)
        if (pt) startAxisPoint = pt
      } else if (type === 'translate' || type === 'scale') {
        const pt = projectOnAxis(raycaster, origin, axisWorld, camera)
        if (pt) startAxisPoint = pt
      }

      let startAngle = 0
      if (type === 'rotate') {
        const fromCenter = startAxisPoint.clone().sub(origin)
        startAngle = Math.atan2(
          fromCenter.dot(new THREE.Vector3().crossVectors(axisWorld, fromCenter.clone().normalize()).normalize()),
          fromCenter.length()
        )
      }

      dragStartRef.current = {
        handle,
        startPos: target.position.clone(),
        startQuat: target.quaternion.clone(),
        startScale: target.scale.clone(),
        startAngle,
        startAxisPoint,
        origin,
        axisWorld,
      }
    },
    [getHandle, target, camera, raycaster, gl, controls]
  )

  // ── Pointer move (drag) via window event ──────────────────────────────

  useEffect(() => {
    const domElement = gl.domElement

    const handlePointerMove = (e: PointerEvent) => {
      if (!dragStartRef.current || !target) return

      const { handle, startPos, startQuat, startScale, startAxisPoint, origin, axisWorld } = dragStartRef.current
      const type = handle!.split('-')[0] as 'translate' | 'rotate' | 'scale'
      const axisKey = handle!.split('-')[1] as 'x' | 'y' | 'z' | 'uniform'

      const rect = domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(mouse, camera)

      if (type === 'translate') {
        const currentPoint = projectOnAxis(raycaster, origin, axisWorld, camera)
        if (!currentPoint) return

        const delta = currentPoint.clone().sub(startAxisPoint)

        // Convert world-space delta to bone-local space.
        // Must account for the full parent transform (rotation + scale)
        // so that models with autoScale (e.g. cm → meters) move correctly.
        if (target.parent) {
          const parentInv = new THREE.Matrix4().copy(target.parent.matrixWorld).invert()
          // Zero out the translation component — we only want rotation+scale transform on the delta
          parentInv.setPosition(0, 0, 0)
          delta.applyMatrix4(parentInv)
        }

        target.position.copy(startPos).add(delta)
        onChange()
      } else if (type === 'rotate') {
        const currentPoint = projectOnRotationPlane(raycaster, origin, axisWorld)
        if (!currentPoint) return

        const startVec = startAxisPoint.clone().sub(origin).normalize()
        const currentVec = currentPoint.clone().sub(origin).normalize()

        let angle = Math.acos(THREE.MathUtils.clamp(startVec.dot(currentVec), -1, 1))
        const cross = new THREE.Vector3().crossVectors(startVec, currentVec)
        if (cross.dot(axisWorld) < 0) angle = -angle

        const worldQuat = new THREE.Quaternion()
        if (target.parent) {
          target.parent.getWorldQuaternion(worldQuat)
        }
        const localAxis = axisWorld.clone().applyQuaternion(worldQuat.clone().invert())

        const rotDelta = new THREE.Quaternion().setFromAxisAngle(localAxis, angle)
        target.quaternion.copy(rotDelta).multiply(startQuat)
        onChange()
      } else if (type === 'scale') {
        if (axisKey === 'uniform') {
          const currentPoint = projectOnAxis(
            raycaster,
            origin,
            new THREE.Vector3(0, 1, 0),
            camera
          )
          if (!currentPoint) return
          const delta = currentPoint.y - startAxisPoint.y
          const factor = 1 + delta * 2
          target.scale.copy(startScale).multiplyScalar(Math.max(0.01, factor))
          onChange()
        } else {
          const currentPoint = projectOnAxis(raycaster, origin, axisWorld, camera)
          if (!currentPoint) return

          const startDist = startAxisPoint.clone().sub(origin).dot(axisWorld)
          const currentDist = currentPoint.clone().sub(origin).dot(axisWorld)
          const factor = startDist !== 0 ? currentDist / startDist : 1

          const newScale = startScale.clone()
          if (axisKey === 'x') newScale.x *= Math.max(0.01, factor)
          else if (axisKey === 'y') newScale.y *= Math.max(0.01, factor)
          else if (axisKey === 'z') newScale.z *= Math.max(0.01, factor)
          target.scale.copy(newScale)
          onChange()
        }
      }
    }

    const handlePointerUp = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null
        setDragging(null)
        gl.domElement.style.cursor = hovered ? 'pointer' : 'auto'

        // Re-enable orbit controls after drag ends
        if (controls) {
          (controls as any).enabled = true
        }
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [target, camera, raycaster, gl, onChange, hovered, controls])

  // ── Get material for a handle (gold on hover) ─────────────────────────

  const getMaterial = useCallback(
    (handle: GizmoHandle, baseColor: 'red' | 'blue' | 'cyan' | 'gray') => {
      const isHov = hovered === handle || dragging === handle
      if (isHov) return materials.gold
      return materials[baseColor]
    },
    [hovered, dragging, materials]
  )

  if (!visible || !target) return null

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <group ref={groupRef} renderOrder={999}>
      {/* ── QUARTER ARCS (rotation handles) ── */}
      {/* XY arc — cyan — rotate around Z */}
      <mesh geometry={geom.arcXY} material={getMaterial('rotate-z', 'cyan')} renderOrder={999} />
      <mesh
        geometry={geom.arcHitXY}
        material={materials.invisible}
        userData={{ gizmoHandle: 'rotate-z' as GizmoHandle }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        renderOrder={999}
      />
      {/* XZ arc — red — rotate around Y */}
      <mesh geometry={geom.arcXZ} material={getMaterial('rotate-y', 'red')} renderOrder={999} />
      <mesh
        geometry={geom.arcHitXZ}
        material={materials.invisible}
        userData={{ gizmoHandle: 'rotate-y' as GizmoHandle }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        renderOrder={999}
      />
      {/* YZ arc — blue — rotate around X */}
      <mesh geometry={geom.arcYZ} material={getMaterial('rotate-x', 'blue')} renderOrder={999} />
      <mesh
        geometry={geom.arcHitYZ}
        material={materials.invisible}
        userData={{ gizmoHandle: 'rotate-x' as GizmoHandle }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        renderOrder={999}
      />

      {/* ── AXIS ARROWS (translate handles) ── */}
      {/* Y axis — RED — translate-y */}
      <group>
        {/* Visual */}
        <mesh position={[0, AXIS_LEN / 2, 0]} geometry={geom.shaft} material={getMaterial('translate-y', 'red')} renderOrder={1000} />
        <mesh position={[0, AXIS_LEN + 0.09, 0]} geometry={geom.cone} material={getMaterial('translate-y', 'red')} renderOrder={1000} />
        {/* Hitbox */}
        <mesh
          position={[0, AXIS_LEN / 2, 0]}
          geometry={geom.shaftHit}
          material={materials.invisible}
          userData={{ gizmoHandle: 'translate-y' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1000}
        />
        <mesh
          position={[0, AXIS_LEN + 0.09, 0]}
          geometry={geom.cone}
          material={materials.invisible}
          userData={{ gizmoHandle: 'translate-y' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1000}
        />
      </group>
      {/* X axis — BLUE — translate-x */}
      <group quaternion={new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(1, 0, 0)
      )}>
        {/* Visual */}
        <mesh position={[0, AXIS_LEN / 2, 0]} geometry={geom.shaft} material={getMaterial('translate-x', 'blue')} renderOrder={1000} />
        <mesh position={[0, AXIS_LEN + 0.09, 0]} geometry={geom.cone} material={getMaterial('translate-x', 'blue')} renderOrder={1000} />
        {/* Hitbox */}
        <mesh
          position={[0, AXIS_LEN / 2, 0]}
          geometry={geom.shaftHit}
          material={materials.invisible}
          userData={{ gizmoHandle: 'translate-x' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1000}
        />
        <mesh
          position={[0, AXIS_LEN + 0.09, 0]}
          geometry={geom.cone}
          material={materials.invisible}
          userData={{ gizmoHandle: 'translate-x' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1000}
        />
      </group>
      {/* Z axis — CYAN — translate-z */}
      <group quaternion={new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(0, 0, 1)
      )}>
        {/* Visual */}
        <mesh position={[0, AXIS_LEN / 2, 0]} geometry={geom.shaft} material={getMaterial('translate-z', 'cyan')} renderOrder={1000} />
        <mesh position={[0, AXIS_LEN + 0.09, 0]} geometry={geom.cone} material={getMaterial('translate-z', 'cyan')} renderOrder={1000} />
        {/* Hitbox */}
        <mesh
          position={[0, AXIS_LEN / 2, 0]}
          geometry={geom.shaftHit}
          material={materials.invisible}
          userData={{ gizmoHandle: 'translate-z' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1000}
        />
        <mesh
          position={[0, AXIS_LEN + 0.09, 0]}
          geometry={geom.cone}
          material={materials.invisible}
          userData={{ gizmoHandle: 'translate-z' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1000}
        />
      </group>

      {/* ── CUBE NODES (scale handles at axis endpoints) ── */}
      {/* Y cube — RED — scale-y */}
      <group>
        <mesh
          position={[0, ARC_R, 0]}
          geometry={geom.cube}
          material={getMaterial('scale-y', 'red')}
          userData={{ gizmoHandle: 'scale-y' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1001}
        />
        {/* Invisible hitbox */}
        <mesh
          position={[0, ARC_R, 0]}
          geometry={geom.cubeHit}
          material={materials.invisible}
          userData={{ gizmoHandle: 'scale-y' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1001}
        />
      </group>
      {/* X cube — BLUE — scale-x */}
      <group>
        <mesh
          position={[ARC_R, 0, 0]}
          geometry={geom.cube}
          material={getMaterial('scale-x', 'blue')}
          userData={{ gizmoHandle: 'scale-x' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1001}
        />
        <mesh
          position={[ARC_R, 0, 0]}
          geometry={geom.cubeHit}
          material={materials.invisible}
          userData={{ gizmoHandle: 'scale-x' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1001}
        />
      </group>
      {/* Z cube — CYAN — scale-z */}
      <group>
        <mesh
          position={[0, 0, ARC_R]}
          geometry={geom.cube}
          material={getMaterial('scale-z', 'cyan')}
          userData={{ gizmoHandle: 'scale-z' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1001}
        />
        <mesh
          position={[0, 0, ARC_R]}
          geometry={geom.cubeHit}
          material={materials.invisible}
          userData={{ gizmoHandle: 'scale-z' as GizmoHandle }}
          onPointerOver={onPointerOver}
          onPointerOut={onPointerOut}
          onPointerDown={onPointerDown}
          renderOrder={1001}
        />
      </group>

      {/* ── GRAY CIRCLE DISCS (uniform scale / plane handles) ── */}
      {/* XY disc */}
      <mesh position={[DISC_IN, DISC_IN, 0]} geometry={geom.disc} material={getMaterial('scale-uniform', 'gray')} renderOrder={1001} />
      <mesh
        position={[DISC_IN, DISC_IN, 0]}
        geometry={geom.discHit}
        material={materials.invisible}
        userData={{ gizmoHandle: 'scale-uniform' as GizmoHandle }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        renderOrder={1001}
      />
      {/* XZ disc */}
      <mesh position={[DISC_IN, 0, DISC_IN]} rotation={[-Math.PI / 2, 0, 0]} geometry={geom.disc} material={getMaterial('scale-uniform', 'gray')} renderOrder={1001} />
      <mesh
        position={[DISC_IN, 0, DISC_IN]}
        rotation={[-Math.PI / 2, 0, 0]}
        geometry={geom.discHit}
        material={materials.invisible}
        userData={{ gizmoHandle: 'scale-uniform' as GizmoHandle }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        renderOrder={1001}
      />
      {/* YZ disc */}
      <mesh position={[0, DISC_IN, DISC_IN]} rotation={[0, Math.PI / 2, 0]} geometry={geom.disc} material={getMaterial('scale-uniform', 'gray')} renderOrder={1001} />
      <mesh
        position={[0, DISC_IN, DISC_IN]}
        rotation={[0, Math.PI / 2, 0]}
        geometry={geom.discHit}
        material={materials.invisible}
        userData={{ gizmoHandle: 'scale-uniform' as GizmoHandle }}
        onPointerOver={onPointerOver}
        onPointerOut={onPointerOut}
        onPointerDown={onPointerDown}
        renderOrder={1001}
      />

      {/* ── GHOST RINGS (visual reference) ── */}
      {/* XY ghost ring */}
      <mesh
        geometry={geom.ghostRing}
        material={materials.ghost}
        renderOrder={998}
      />
      {/* XZ ghost ring */}
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        geometry={geom.ghostRing}
        material={materials.ghost}
        renderOrder={998}
      />
      {/* YZ ghost ring */}
      <mesh
        rotation={[0, Math.PI / 2, 0]}
        geometry={geom.ghostRing}
        material={materials.ghost}
        renderOrder={998}
      />
    </group>
  )
})

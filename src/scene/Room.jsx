import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { applyReplacements } from './replaceObjects';
import { ExhibitPanel } from './exhibits/ExhibitPanel';
import { HoloPanel, StandPanel } from './exhibits/HoloPanel';
import { BoxRoom } from './BoxRoom';

// ─── GLTF room ───────────────────────────────────────────────────────────────

function ReplacementLoader({ name, modelPath, scene }) {
  const { scene: model } = useGLTF(modelPath);
  useEffect(() => {
    applyReplacements(scene, [{ name, model }]);
  }, [scene, model, name]);
  return null;
}

function GltfRoomContent({ config }) {
  const { scene: gltfScene } = useGLTF(config.model);
  const scene = useMemo(() => gltfScene.clone(), [gltfScene]);

  return (
    <>
      <RigidBody type="fixed" colliders="trimesh">
        <primitive object={scene} />
      </RigidBody>

      {/* Fallback floor in case the GLB has no walkable surface */}
      <RigidBody type="fixed">
        <CuboidCollider args={[50, 0.1, 50]} position={[0, -0.1, 0]} />
      </RigidBody>

      {(config.replacements ?? []).map(r => (
        <Suspense key={r.name} fallback={null}>
          <ReplacementLoader name={r.name} modelPath={r.model} scene={scene} />
        </Suspense>
      ))}
    </>
  );
}

// ─── Particles ───────────────────────────────────────────────────────────────

function Particles({ count = 55, spread = 5, maxH = 3.6 }) {
  const ref = useRef();
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * spread * 2;
      arr[i * 3 + 1] = Math.random() * maxH;
      arr[i * 3 + 2] = (Math.random() - 0.5) * spread * 2;
    }
    return arr;
  }, [count, spread, maxH]);

  useFrame((_, dt) => {
    if (!ref.current) return;
    const pos = ref.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += dt * (0.025 + Math.sin(i * 1.3) * 0.012);
      pos[i * 3]     += dt * Math.sin(i * 2.1) * 0.008;
      if (pos[i * 3 + 1] > maxH) {
        pos[i * 3]     = (Math.random() - 0.5) * spread * 2;
        pos[i * 3 + 1] = 0.05;
        pos[i * 3 + 2] = (Math.random() - 0.5) * spread * 2;
      }
    }
    ref.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.022} color="#b0b8d8" transparent opacity={0.35} sizeAttenuation />
    </points>
  );
}

// ─── Portal marker ────────────────────────────────────────────────────────────
// Small decorative arch with proximity teleport. No wall opening required.

const TRIGGER_DIST = 1.6;
const PILLAR_H = 1.85;
const ARCH_SPAN = 0.58;   // half-width (arch radius)
const ARCH_C = '#00cfff';

function PortalMarker({ config, scene, onTeleport }) {
  const position = useMemo(() => {
    if (config.meshName && scene) {
      const mesh = scene.getObjectByName(config.meshName);
      if (mesh) {
        const wp = new THREE.Vector3();
        mesh.getWorldPosition(wp);
        return wp.toArray();
      }
    }
    return config.position ?? [0, 1.5, 2];
  }, [config, scene]);

  const portalVec  = useMemo(() => new THREE.Vector3(...position), [position]);
  const triggered  = useRef(false);
  const { camera } = useThree();

  useFrame(() => {
    const dist = camera.position.distanceTo(portalVec);
    if (dist < TRIGGER_DIST) {
      if (!triggered.current) {
        triggered.current = true;
        onTeleport(config.targetRoom);
      }
    } else {
      triggered.current = false;
    }
  });

  const [px, , pz] = position;

  return (
    <group position={[px, 0, pz]}>
      {/* Left pillar */}
      <mesh position={[0, PILLAR_H / 2, -ARCH_SPAN]}>
        <cylinderGeometry args={[0.09, 0.11, PILLAR_H, 8]} />
        <meshStandardMaterial color={ARCH_C} emissive={ARCH_C} emissiveIntensity={0.45} />
      </mesh>
      {/* Right pillar */}
      <mesh position={[0, PILLAR_H / 2, ARCH_SPAN]}>
        <cylinderGeometry args={[0.09, 0.11, PILLAR_H, 8]} />
        <meshStandardMaterial color={ARCH_C} emissive={ARCH_C} emissiveIntensity={0.45} />
      </mesh>
      {/* Arch ring in YZ plane — spans z±ARCH_SPAN, peaks at y=PILLAR_H+ARCH_SPAN */}
      <mesh position={[0, PILLAR_H, 0]} rotation={[0, Math.PI / 2, 0]}>
        <torusGeometry args={[ARCH_SPAN, 0.065, 8, 20, Math.PI]} />
        <meshStandardMaterial color={ARCH_C} emissive={ARCH_C} emissiveIntensity={0.65} />
      </mesh>
      {/* Subtle glow plane (DoubleSide so visible from both walls) */}
      <mesh position={[0, PILLAR_H / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ARCH_SPAN * 2, PILLAR_H]} />
        <meshStandardMaterial color={ARCH_C} emissive={ARCH_C} emissiveIntensity={0.1} transparent opacity={0.18} side={2} />
      </mesh>
      {/* Label */}
      <Html center distanceFactor={5} position={[0, PILLAR_H + ARCH_SPAN + 0.22, 0]}>
        <div style={{
          color: '#fff', background: 'rgba(0,0,0,0.78)',
          border: '1px solid #00cfff', borderRadius: 4,
          padding: '4px 12px', fontSize: 13,
          whiteSpace: 'nowrap', pointerEvents: 'none',
        }}>
          {config.label}
        </div>
      </Html>
    </group>
  );
}

// ─── Room ─────────────────────────────────────────────────────────────────────

/**
 * Renders one room entry from rooms.json.
 * If config.model is present → loads GLTF with trimesh collider.
 * If absent → renders a BoxRoom (primitive walls/floor/ceiling).
 *
 * Always mount with key={roomId} so React fully remounts on room change.
 */
export function Room({ config, onTeleport }) {
  return (
    <>
      {config.model
        ? (
          <Suspense fallback={null}>
            <GltfRoomContent config={config} />
          </Suspense>
        )
        : (
          <BoxRoom
            wallColor={config.wallColor}
            accentColor={config.accentColor}
            big={config.big ?? false}
          />
        )
      }

      {config.portals.map(p => (
        <PortalMarker key={p.targetRoom} config={p} scene={null} onTeleport={onTeleport} />
      ))}

      {(config.exhibits ?? []).map((ex, i) => {
        if (ex.displayType === 'hologram') return <HoloPanel  key={i} {...ex} />;
        if (ex.displayType === 'stand')    return <StandPanel key={i} {...ex} />;
        return <ExhibitPanel key={i} {...ex} />;
      })}

      <Particles />
    </>
  );
}

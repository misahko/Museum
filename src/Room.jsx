import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useGLTF, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';
import { applyReplacements } from './replaceObjects';
import { ExhibitPanel } from './ExhibitPanel';
import { HoloPanel, StandPanel } from './HoloPanel';
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

// ─── Portal marker ────────────────────────────────────────────────────────────
// Proximity-based: automatically teleports when camera gets within TRIGGER_DIST.
// onClick kept as fallback when pointer lock is not active.

const TRIGGER_DIST = 1.6;

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

  return (
    <mesh position={position} onClick={() => onTeleport(config.targetRoom)}>
      <boxGeometry args={[0.8, 1.8, 0.05]} />
      <meshStandardMaterial color="#00cfff" emissive="#00cfff" emissiveIntensity={0.8} transparent opacity={0.55} />
      <Html center distanceFactor={5}>
        <div style={{
          color: '#fff',
          background: 'rgba(0,0,0,0.75)',
          border: '1px solid #00cfff',
          borderRadius: 4,
          padding: '4px 12px',
          fontSize: 13,
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {config.label}
        </div>
      </Html>
    </mesh>
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
    </>
  );
}

import { Suspense, useEffect, useMemo } from 'react';
import { useGLTF, Html } from '@react-three/drei';
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

      {config.replacements.map(r => (
        <Suspense key={r.name} fallback={null}>
          <ReplacementLoader name={r.name} modelPath={r.model} scene={scene} />
        </Suspense>
      ))}
    </>
  );
}

// ─── Portal marker ────────────────────────────────────────────────────────────
// Look at the glowing panel and click to teleport.
// Accepts an optional `scene` for meshName-based positioning (GLTF rooms only).

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

  return (
    <mesh position={position} onClick={() => onTeleport(config.targetRoom)}>
      <boxGeometry args={[0.6, 0.6, 0.05]} />
      <meshStandardMaterial color="#00cfff" emissive="#00cfff" emissiveIntensity={0.6} />
      <Html center distanceFactor={4}>
        <div style={{
          color: '#fff',
          background: 'rgba(0,0,0,0.8)',
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

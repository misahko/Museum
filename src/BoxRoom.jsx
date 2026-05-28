import { useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

export const ROOM_W = 12;
export const ROOM_H = 4;
export const ROOM_D = 12;

export const BIG_ROOM_W = 24;
export const BIG_ROOM_H = 5;
export const BIG_ROOM_D = 24;

function makeFloorTexture(big) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tiles = big ? 16 : 8;
  const tile = 512 / tiles;
  for (let x = 0; x < tiles; x++) {
    for (let y = 0; y < tiles; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#16161a' : '#1e1e26';
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(big ? 5 : 3, big ? 5 : 3);
  return tex;
}

/**
 * A simple box room built from Three.js primitives.
 * Props:
 *   wallColor   – hex for wall surfaces
 *   accentColor – emissive top-trim colour
 *   big         – if true, uses 24×5×24 with 4 section zones
 */
export function BoxRoom({ wallColor = '#252530', accentColor = '#4a3f6b', big = false }) {
  const floorTex = useMemo(() => makeFloorTexture(big), [big]);

  const W = big ? BIG_ROOM_W : ROOM_W;
  const H = big ? BIG_ROOM_H : ROOM_H;
  const D = big ? BIG_ROOM_D : ROOM_D;
  const hw = W / 2, hh = H / 2, hd = D / 2;

  return (
    <>
      {/* Colliders */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[hw, 0.1, hd]} position={[0, -0.1, 0]} />
        <CuboidCollider args={[hw, hh, 0.2]} position={[0, hh, -hd]} />
        <CuboidCollider args={[hw, hh, 0.2]} position={[0, hh,  hd]} />
        <CuboidCollider args={[0.2, hh, hd]} position={[-hw, hh, 0]} />
        <CuboidCollider args={[0.2, hh, hd]} position={[ hw, hh, 0]} />
      </RigidBody>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial map={floorTex} roughness={0.45} metalness={0.15} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[W, D]} />
        <meshStandardMaterial color="#0e0e12" />
      </mesh>

      {/* Back wall (north) */}
      <mesh position={[0, hh, -hd]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Front wall (south) */}
      <mesh position={[0, hh, hd]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[W, H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Left wall (west) */}
      <mesh position={[-hw, hh, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Right wall (east) */}
      <mesh position={[hw, hh, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[D, H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Accent strip — top of back (north) wall */}
      <mesh position={[0, H - 0.05, -hd + 0.01]}>
        <planeGeometry args={[W, 0.08]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.8} />
      </mesh>

      {/* Zone dividers — big room only */}
      {big && <>
        {/* N–S floor line (runs along Z at x=0) */}
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.12, D]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
        </mesh>
        {/* E–W floor line (runs along X at z=0) */}
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[W, 0.12]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
        </mesh>
        {/* Corner accent strips on top of each zone's walls */}
        <mesh position={[-hw / 2, H - 0.05, -hd + 0.01]}>
          <planeGeometry args={[hw - 0.4, 0.06]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[ hw / 2, H - 0.05, -hd + 0.01]}>
          <planeGeometry args={[hw - 0.4, 0.06]} />
          <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.5} />
        </mesh>
      </>}

      {/* Ceiling lights */}
      {big ? <>
        <pointLight position={[-8, H - 0.5, -8]} intensity={14} distance={14} color="#fff8ee" />
        <pointLight position={[ 0, H - 0.5, -8]} intensity={14} distance={14} color="#fff8ee" />
        <pointLight position={[ 8, H - 0.5, -8]} intensity={14} distance={14} color="#fff8ee" />
        <pointLight position={[-8, H - 0.5,  0]} intensity={14} distance={14} color="#fff8ee" />
        <pointLight position={[ 0, H - 0.5,  0]} intensity={14} distance={14} color="#fff8ee" />
        <pointLight position={[ 8, H - 0.5,  0]} intensity={14} distance={14} color="#fff8ee" />
        <pointLight position={[-8, H - 0.5,  8]} intensity={14} distance={14} color="#fff8ee" />
        <pointLight position={[ 0, H - 0.5,  8]} intensity={14} distance={14} color="#fff8ee" />
        <pointLight position={[ 8, H - 0.5,  8]} intensity={14} distance={14} color="#fff8ee" />
      </> : <>
        <pointLight position={[-3, 3.6, -3]} intensity={12} distance={9} color="#fff8ee" castShadow />
        <pointLight position={[ 3, 3.6,  3]} intensity={12} distance={9} color="#fff8ee" castShadow />
        <pointLight position={[-3, 3.6,  3]} intensity={6}  distance={8} color="#fff8ee" />
        <pointLight position={[ 3, 3.6, -3]} intensity={6}  distance={8} color="#fff8ee" />
      </>}
    </>
  );
}

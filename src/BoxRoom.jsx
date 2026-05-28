import { useMemo } from 'react';
import { RigidBody, CuboidCollider } from '@react-three/rapier';
import * as THREE from 'three';

export const ROOM_W = 12;
export const ROOM_H = 4;
export const ROOM_D = 12;

function makeFloorTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const tile = 64;
  for (let x = 0; x < 8; x++) {
    for (let y = 0; y < 8; y++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? '#16161a' : '#1e1e26';
      ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * A simple box room built from Three.js primitives.
 * Used when a room config has no "model" field.
 *
 * Props (all optional, come from rooms.json):
 *   wallColor   – hex string for wall surfaces
 *   accentColor – emissive color for the top trim strip
 */
export function BoxRoom({ wallColor = '#252530', accentColor = '#4a3f6b' }) {
  const floorTex = useMemo(makeFloorTexture, []);

  const hw = ROOM_W / 2;
  const hh = ROOM_H / 2;
  const hd = ROOM_D / 2;

  return (
    <>
      {/* All wall/floor colliders in one compound RigidBody */}
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider args={[hw, 0.1, hd]} position={[0, -0.1, 0]} />
        <CuboidCollider args={[hw, hh, 0.2]} position={[0, hh, -hd]} />
        <CuboidCollider args={[hw, hh, 0.2]} position={[0, hh, hd]} />
        <CuboidCollider args={[0.2, hh, hd]} position={[-hw, hh, 0]} />
        <CuboidCollider args={[0.2, hh, hd]} position={[hw, hh, 0]} />
      </RigidBody>

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial map={floorTex} roughness={0.45} metalness={0.15} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, ROOM_H, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshStandardMaterial color="#0e0e12" />
      </mesh>

      {/* Back wall */}
      <mesh position={[0, hh, -hd]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Front wall */}
      <mesh position={[0, hh, hd]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[ROOM_W, ROOM_H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Left wall */}
      <mesh position={[-hw, hh, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Right wall */}
      <mesh position={[hw, hh, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[ROOM_D, ROOM_H]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Accent strip along top of back wall */}
      <mesh position={[0, ROOM_H - 0.05, -hd + 0.01]}>
        <planeGeometry args={[ROOM_W, 0.08]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={0.8} />
      </mesh>

      {/* Ceiling lights */}
      <pointLight position={[-3, 3.6, -3]} intensity={12} distance={9} color="#fff8ee" castShadow />
      <pointLight position={[3, 3.6, 3]}  intensity={12} distance={9} color="#fff8ee" castShadow />
      <pointLight position={[-3, 3.6, 3]} intensity={6}  distance={8} color="#fff8ee" />
      <pointLight position={[3, 3.6, -3]} intensity={6}  distance={8} color="#fff8ee" />
    </>
  );
}

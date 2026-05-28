import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { RigidBody, CapsuleCollider } from '@react-three/rapier';
import * as THREE from 'three';

const SPEED = 5;

// Pre-allocated to avoid GC pressure in useFrame
const _forward = new THREE.Vector3();
const _right   = new THREE.Vector3();
const _up      = new THREE.Vector3(0, 1, 0);
const _vel     = new THREE.Vector3();
const _euler   = new THREE.Euler(0, 0, 0, 'YXZ');

export function Player({ spawnPosition = [0, 1, 3] }) {
  const body     = useRef();
  const { camera, gl } = useThree();
  const yaw      = useRef(0);
  const pitch    = useRef(0);
  const isLocked = useRef(false);
  const keys     = useRef({});

  // Teleport to new spawn when room changes
  useEffect(() => {
    if (!body.current) return;
    body.current.setTranslation(
      { x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] },
      true
    );
    body.current.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }, [spawnPosition]);

  // Pointer lock: click canvas to capture mouse, ESC to release
  useEffect(() => {
    const canvas = gl.domElement;

    const onMove = (e) => {
      if (!isLocked.current) return;
      yaw.current   -= e.movementX * 0.002;
      pitch.current -= e.movementY * 0.002;
      pitch.current  = Math.max(-Math.PI / 2.2, Math.min(Math.PI / 2.2, pitch.current));
    };
    const onLockChange = () => {
      isLocked.current = document.pointerLockElement === canvas;
    };
    const onClick = () => canvas.requestPointerLock();

    canvas.addEventListener('click', onClick);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('pointerlockchange', onLockChange);
    return () => {
      canvas.removeEventListener('click', onClick);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('pointerlockchange', onLockChange);
    };
  }, [gl]);

  // Keyboard
  useEffect(() => {
    const dn = (e) => { keys.current[e.code] = true; };
    const up = (e) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame(() => {
    if (!body.current) return;

    // Rotate camera
    _euler.set(pitch.current, yaw.current, 0);
    camera.quaternion.setFromEuler(_euler);

    // Build movement vector from camera look direction
    camera.getWorldDirection(_forward);
    _forward.y = 0;
    if (_forward.lengthSq() > 0) _forward.normalize();
    _right.crossVectors(_forward, _up);

    _vel.set(0, 0, 0);
    const k = keys.current;
    if (k['KeyW'] || k['ArrowUp'])    _vel.add(_forward);
    if (k['KeyS'] || k['ArrowDown'])  _vel.sub(_forward);
    if (k['KeyD'] || k['ArrowRight']) _vel.add(_right);
    if (k['KeyA'] || k['ArrowLeft'])  _vel.sub(_right);

    if (_vel.lengthSq() > 0) _vel.normalize().multiplyScalar(SPEED);

    // Keep vertical velocity (gravity / falling), replace only horizontal
    const cur = body.current.linvel();
    body.current.setLinvel({ x: _vel.x, y: cur.y, z: _vel.z }, true);

    // Pin camera to player's head
    const pos = body.current.translation();
    camera.position.set(pos.x, pos.y + 0.8, pos.z);
  });

  return (
    <RigidBody
      ref={body}
      colliders={false}
      mass={1}
      type="dynamic"
      position={spawnPosition}
      enabledRotations={[false, false, false]}
    >
      {/* half-height 0.5, radius 0.3 → total ~1.6 units tall */}
      <CapsuleCollider args={[0.5, 0.3]} />
    </RigidBody>
  );
}

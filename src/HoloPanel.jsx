import { useRef, useMemo, useState, useEffect, Suspense } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Text, Line, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const CYAN  = '#00ffcc';
const W     = 1.4;
const PAD   = 0.08;
const GAP   = 0.06;
const IMG_W = W - PAD * 2;
const IMG_H = IMG_W * 0.7;

let _scanTex = null;
function getScanTex() {
  if (_scanTex) return _scanTex;
  const c = document.createElement('canvas');
  c.width = 2; c.height = 8;
  c.getContext('2d').fillStyle = 'white';
  c.getContext('2d').fillRect(0, 0, 2, 2);
  _scanTex = new THREE.CanvasTexture(c);
  _scanTex.wrapS = _scanTex.wrapT = THREE.RepeatWrapping;
  _scanTex.repeat.set(1, 50);
  return _scanTex;
}

// ── Shared frame: glow layers + bg + L-corner accents + scanlines ─────────────

function HoloFrame({ width, height }) {
  const hw = width / 2, hh = height / 2, cs = 0.1;
  const corners = [
    [[-hw, -hh+cs, 0], [-hw, -hh, 0], [-hw+cs, -hh, 0]],
    [[ hw-cs, -hh, 0], [ hw, -hh, 0], [ hw, -hh+cs, 0]],
    [[-hw,  hh-cs, 0], [-hw,  hh, 0], [-hw+cs,  hh, 0]],
    [[ hw-cs,  hh, 0], [ hw,  hh, 0], [ hw,  hh-cs, 0]],
  ];
  const tex = useMemo(getScanTex, []);
  return (
    <>
      {[1.6, 1.28, 1.1].map((s, i) => (
        <mesh key={i} scale={[width * s, height * s, 1]} position={[0, 0, -(i + 1) * 0.012]}>
          <planeGeometry />
          <meshBasicMaterial color={CYAN} transparent opacity={0.018}
            blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ))}
      <mesh scale={[width, height, 1]} position={[0, 0, -0.005]}>
        <planeGeometry />
        <meshBasicMaterial color="#001510" transparent opacity={0.72} />
      </mesh>
      {corners.map((pts, i) => <Line key={i} points={pts} color={CYAN} lineWidth={2.5} />)}
      <mesh scale={[width, height, 1]} position={[0, 0, 0.006]}>
        <planeGeometry />
        <meshBasicMaterial map={tex} color={CYAN} transparent opacity={0.1} depthWrite={false} />
      </mesh>
    </>
  );
}

// ── Image with hologram tint ──────────────────────────────────────────────────

function HoloImageLoader({ url, y }) {
  const tex = useTexture(url);
  return (
    <group position={[0, y, 0.01]}>
      <mesh scale={[IMG_W, IMG_H, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={tex} transparent />
      </mesh>
      <mesh scale={[IMG_W, IMG_H, 1]} position={[0, 0, 0.002]}>
        <planeGeometry />
        <meshBasicMaterial color={CYAN} transparent opacity={0.2}
          blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ── Layout + rendering ────────────────────────────────────────────────────────
//
// Two-phase render:
//   Phase 1 (dims=null): text is invisible (fillOpacity=0); onSync measures
//                        actual rendered height and stores it in a ref.
//                        Frame is not shown yet.
//   Phase 2 (dims set):  frame appears at the exact measured size; text
//                        becomes visible at correct positions.
//
// Using a ref to accumulate measurements avoids a re-render loop: we only
// call setDims once, when every needed measurement is ready.

function HologramDisplay({ title, body, image }) {
  const [dims, setDims] = useState(null);

  // Pending measurements: null = not yet measured, number = measured height.
  // Initialized once; stable across re-renders via useRef.
  const meas = useRef({ title: title ? null : 0, body: body ? null : 0 });

  function tryCommit() {
    const { title: th, body: bh } = meas.current;
    if (th !== null && bh !== null) setDims({ titleH: th, bodyH: bh });
  }

  // If there is nothing to measure (e.g. image-only panel), commit immediately.
  useEffect(tryCommit, []); // eslint-disable-line react-hooks/exhaustive-deps

  const titleH = dims?.titleH ?? 0.13;
  const bodyH  = dims?.bodyH  ?? 0;

  let cursor = PAD;
  const blocks = [];
  if (title) { blocks.push({ type: 'title', y: -cursor });               cursor += titleH; }
  if (image) { if (blocks.length) cursor += GAP; blocks.push({ type: 'image', y: -(cursor + IMG_H / 2) }); cursor += IMG_H; }
  if (body)  { if (blocks.length) cursor += GAP; blocks.push({ type: 'body',  y: -cursor });               cursor += bodyH; }

  const totalH = cursor + PAD;
  const shift  = totalH / 2;

  return (
    <>
      {/* Frame is shown only after measurement so it always fits the content */}
      {dims && <HoloFrame width={W} height={totalH} />}

      <group position={[0, shift, 0]}>
        {blocks.map(b => {
          if (b.type === 'title') return (
            <Text key="title"
              position={[0, b.y, 0.01]}
              fontSize={0.1} color={CYAN} maxWidth={IMG_W}
              textAlign="center" anchorX="center" anchorY="top"
              outlineWidth={0.006} outlineColor="#002210"
              fillOpacity={dims ? 1 : 0}
              onSync={m => {
                if (dims || meas.current.title !== null) return;
                const bb = m.textRenderInfo?.blockBounds;
                const h = bb ? (bb[3] - bb[1]) : 0;
                if (h > 0) { meas.current.title = h; tryCommit(); }
              }}
            >{title}</Text>
          );
          if (b.type === 'image') return dims ? (
            <Suspense key="image" fallback={null}>
              <HoloImageLoader url={image} y={b.y} />
            </Suspense>
          ) : null;
          if (b.type === 'body') return (
            <Text key="body"
              position={[0, b.y, 0.01]}
              fontSize={0.065} color="#88ffdd" maxWidth={IMG_W}
              textAlign="left" anchorX="center" anchorY="top" lineHeight={1.45}
              fillOpacity={dims ? 1 : 0}
              onSync={m => {
                if (dims || meas.current.body !== null) return;
                const bb = m.textRenderInfo?.blockBounds;
                const h = bb ? (bb[3] - bb[1]) : 0;
                if (h > 0) { meas.current.body = h; tryCommit(); }
              }}
            >{body}</Text>
          );
          return null;
        })}
      </group>
    </>
  );
}

// ── Public exports ─────────────────────────────────────────────────────────────

/**
 * Type 1 — Floating hologram.
 * JSON: { "displayType": "hologram", "title": "...", "body": "...", "image": "/...", "position": [x,y,z] }
 */
export function HoloPanel({ title, body, image, position = [0, 2, 0], rotation = [0, 0, 0] }) {
  const floatRef = useRef();
  useFrame(({ clock }) => {
    if (!floatRef.current) return;
    const t = clock.elapsedTime;
    floatRef.current.position.y = Math.sin(t * 0.75) * 0.07;
    floatRef.current.rotation.y = Math.sin(t * 0.38) * 0.02;
  });
  return (
    <group position={position} rotation={rotation}>
      <group ref={floatRef}>
        <HologramDisplay title={title} body={body} image={image} />
      </group>
    </group>
  );
}

/**
 * Type 2 — Stand hologram.
 * JSON: {
 *   "displayType": "stand",
 *   "standModel": "/R2.glb",
 *   "standHeight": 1.2,
 *   "title": "...", "body": "...", "image": "/...",
 *   "position": [x, 0, z]
 * }
 */
export function StandPanel({
  standModel  = '/R2.glb',
  standHeight = 1.2,
  title, body, image,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}) {
  const { scene } = useGLTF(standModel);
  const standScene = useMemo(() => scene.clone(), [scene]);
  const floatRef = useRef();
  useFrame(({ clock }) => {
    if (!floatRef.current) return;
    floatRef.current.position.y = Math.sin(clock.elapsedTime * 0.85) * 0.04;
  });
  return (
    <group position={position} rotation={rotation}>
      <primitive object={standScene} />
      <group position={[0, standHeight, 0]}>
        <group ref={floatRef}>
          <HologramDisplay title={title} body={body} image={image} />
        </group>
      </group>
    </group>
  );
}

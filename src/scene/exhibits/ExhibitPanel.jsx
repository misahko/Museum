import { useState } from 'react';
import { Text, Image } from '@react-three/drei';
import { Suspense } from 'react';

const W   = 1.6;
const PAD = 0.1;
const GAP = 0.07;
const IMG_W = W - PAD * 2;
const IMG_H = IMG_W * 0.6;

export function ExhibitPanel({ title, body, image, position = [0, 1.5, 0], rotation = [0, 0, 0] }) {
  const [titleH, setTitleH] = useState(title ? 0.13 : 0);
  const [bodyH,  setBodyH]  = useState(body  ? estimateBodyH(body) : 0);

  let cursor = PAD;
  const blocks = [];

  if (title) { blocks.push({ type: 'title', y: -cursor }); cursor += titleH; }
  if (image)  { if (blocks.length) cursor += GAP; blocks.push({ type: 'image', y: -(cursor + IMG_H / 2) }); cursor += IMG_H; }
  if (body)   { if (blocks.length) cursor += GAP; blocks.push({ type: 'body',  y: -cursor }); cursor += bodyH; }

  const totalH = cursor + PAD;
  const shift  = totalH / 2;

  function onTitleSync(mesh) { const bb = mesh.textRenderInfo?.blockBounds; if (bb) setTitleH(bb[3] - bb[1]); }
  function onBodySync(mesh)  { const bb = mesh.textRenderInfo?.blockBounds; if (bb) setBodyH(bb[3]  - bb[1]); }

  return (
    <group position={position} rotation={rotation}>
      <mesh scale={[W + 0.07, totalH + 0.07, 1]} position={[0, 0, -0.008]}>
        <planeGeometry />
        <meshStandardMaterial color="#1e1e26" />
      </mesh>
      <mesh scale={[W, totalH, 1]}>
        <planeGeometry />
        <meshStandardMaterial color="#2a2a36" />
      </mesh>

      <group position={[0, shift, 0]}>
        {blocks.map((b) => {
          if (b.type === 'title') return (
            <Text key="title" position={[0, b.y, 0.01]}
              fontSize={0.11} color="#ffffff" maxWidth={IMG_W}
              textAlign="center" anchorX="center" anchorY="top"
              outlineWidth={0.004} outlineColor="#000000" onSync={onTitleSync}
            >{title}</Text>
          );
          if (b.type === 'image') return (
            <Suspense key="image" fallback={null}>
              <Image url={image} position={[0, b.y, 0.01]} scale={[IMG_W, IMG_H]} transparent />
            </Suspense>
          );
          if (b.type === 'body') return (
            <Text key="body" position={[0, b.y, 0.01]}
              fontSize={0.068} color="#cccccc" maxWidth={IMG_W}
              textAlign="left" anchorX="center" anchorY="top"
              lineHeight={1.45} onSync={onBodySync}
            >{body}</Text>
          );
          return null;
        })}
      </group>
    </group>
  );
}

function estimateBodyH(text) {
  const charsPerLine = Math.floor(IMG_W / (0.068 * 0.55));
  const lines = text.split('\n').reduce((acc, row) => acc + Math.max(1, Math.ceil(row.length / charsPerLine)), 0);
  return lines * 0.068 * 1.45;
}

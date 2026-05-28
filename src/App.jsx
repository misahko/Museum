import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Room } from './Room';
import { Player } from './Player';
import { Lobby } from './Lobby';

export default function App() {
  const [generatedRooms, setGeneratedRooms] = useState(null);
  const [currentRoomId, setCurrentRoomId] = useState(null);

  function handleMuseumReady({ rooms }) {
    if (!rooms?.length) return; // pipeline returned nothing — stay in lobby
    setGeneratedRooms(rooms);
    setCurrentRoomId(rooms[0].id);
  }

  function handleTeleport(targetId) {
    if (targetId === 'lobby') {
      setGeneratedRooms(null);
      setCurrentRoomId(null);
      return;
    }
    setCurrentRoomId(targetId);
  }

  // Show lobby when no museum has been generated yet
  if (!generatedRooms) {
    return <Lobby onMuseumReady={handleMuseumReady} />;
  }

  // Fall back to first room if the id is stale or a portal pointed somewhere invalid
  const roomConfig = generatedRooms.find(r => r.id === currentRoomId) ?? generatedRooms[0];

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#202020' }}>
      <Canvas camera={{ position: [0, 2, 5], fov: 75 }}>
        <Physics gravity={[0, -9.81, 0]}>
          <ambientLight intensity={1} />
          <directionalLight color="white" position={[10, 10, 10]} intensity={5.5} />

          <Suspense fallback={null}>
            <Room key={currentRoomId} config={roomConfig} onTeleport={handleTeleport} />
          </Suspense>

          <Player spawnPosition={roomConfig.spawn ?? [0, 1, 3]} />
        </Physics>
      </Canvas>

      {/* HUD */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          color: '#fff', fontSize: 20, userSelect: 'none',
        }}>·</div>
        <div style={{
          position: 'absolute', bottom: 20, left: '50%',
          transform: 'translateX(-50%)',
          color: 'rgba(255,255,255,0.5)', fontSize: 12, userSelect: 'none',
        }}>
          Click to enter · WASD to move · ESC to release mouse
        </div>
      </div>
    </div>
  );
}

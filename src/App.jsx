import { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Room } from './Room';
import { Player } from './Player';
import { Lobby } from './Lobby';
import { HUD } from './HUD';

export default function App() {
  const [generatedRooms, setGeneratedRooms] = useState(null);
  const [currentRoomId, setCurrentRoomId]   = useState(null);
  const [museumMeta, setMuseumMeta]         = useState(null); // { name, id }

  function handleMuseumReady({ rooms, name, id }) {
    if (!rooms?.length) return;
    setGeneratedRooms(rooms);
    setCurrentRoomId(rooms[0].id);
    setMuseumMeta({ name: name ?? 'Museum', id: id ?? rooms[0].id });
  }

  function handleTeleport(targetId) {
    if (targetId === 'lobby') {
      setGeneratedRooms(null);
      setCurrentRoomId(null);
      setMuseumMeta(null);
      return;
    }
    setCurrentRoomId(targetId);
  }

  if (!generatedRooms) {
    return <Lobby onMuseumReady={handleMuseumReady} />;
  }

  const roomConfig = generatedRooms.find(r => r.id === currentRoomId) ?? generatedRooms[0];

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#080808' }}>
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

      <HUD
        rooms={generatedRooms}
        currentRoomId={currentRoomId}
        onTeleport={handleTeleport}
        museumName={museumMeta?.name ?? 'Museum'}
        museumId={museumMeta?.id ?? 'default'}
        onExit={() => handleTeleport('lobby')}
      />
    </div>
  );
}

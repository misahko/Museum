import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Room } from './Room';
import { Player } from './Player';
import { Lobby } from './Lobby';
import { HUD } from './HUD';

const STORAGE_KEY = 'museum_app_v1';

export default function App() {
  const [generatedRooms, setGeneratedRooms] = useState(null);
  const [currentRoomId, setCurrentRoomId]   = useState(null);
  const [museumMeta, setMuseumMeta]         = useState(null);
  const [urlError, setUrlError]             = useState('');

  function handleMuseumReady({ rooms, name, id }) {
    if (!rooms?.length) return;
    setGeneratedRooms(rooms);
    setCurrentRoomId(rooms[0].id);
    setMuseumMeta({ name: name ?? 'Museum', id: id ?? rooms[0].id });
    if (window.location.search) history.replaceState({}, '', window.location.pathname);
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

  // Open museum from QR link (?m=id)
  useEffect(() => {
    const mid = new URLSearchParams(window.location.search).get('m');
    if (!mid) return;

    // 1. Try localStorage
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      const m = saved.find(m => m.id === mid);
      if (m) { handleMuseumReady({ rooms: m.rooms, name: m.name, id: m.id }); return; }
    } catch {}

    // 2. Try gallery API
    fetch('/api/museums')
      .then(r => r.ok ? r.json() : [])
      .then(list => {
        const m = Array.isArray(list) && list.find(m => m.id === mid);
        if (m) handleMuseumReady({ rooms: m.rooms, name: m.name, id: m.id });
        else setUrlError(`Museum not found on this device. The QR code may belong to a different browser or device.`);
      })
      .catch(() => setUrlError(`Museum not found on this device.`));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!generatedRooms) {
    return (
      <>
        {urlError && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000,
            background: 'rgba(120,20,40,0.92)', backdropFilter: 'blur(8px)',
            color: '#f0c0c8', padding: '11px 20px', fontSize: 13,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            borderBottom: '1px solid rgba(200,50,70,0.4)',
          }}>
            <span>⚠ {urlError}</span>
            <button
              onClick={() => setUrlError('')}
              style={{ background: 'none', border: 'none', color: '#f0c0c8', cursor: 'pointer', fontSize: 16, padding: '0 4px' }}
            >✕</button>
          </div>
        )}
        <Lobby onMuseumReady={handleMuseumReady} />
      </>
    );
  }

  const roomConfig = generatedRooms.find(r => r.id === currentRoomId) ?? generatedRooms[0];
  const museumId   = museumMeta?.id ?? 'default';

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
        museumId={museumId}
        onExit={() => handleTeleport('lobby')}
      />
    </div>
  );
}

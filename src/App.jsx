import { Suspense, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { Physics } from '@react-three/rapier';
import { Room } from './scene/Room';
import { Player } from './scene/Player';
import { Lobby } from './ui/Lobby';
import { Auth } from './auth/Auth';
import { HUD } from './ui/HUD';
import { authService } from './auth/authService';
import { museumService } from './services/museumService';


export default function App() {
  const [user, setUser]                     = useState(() => authService.getUser());
  const [generatedRooms, setGeneratedRooms] = useState(null);
  const [currentRoomId, setCurrentRoomId]   = useState(null);
  const [museumMeta, setMuseumMeta]         = useState(null);
  const [urlError, setUrlError]             = useState('');

  function handleAuth(u)    { setUser(u); }
  function handleLogout()   { authService.logout(); setUser(null); }

  function handleMuseumReady({ rooms, name, id, fromGallery = false }) {
    if (!rooms?.length) return;
    setGeneratedRooms(rooms);
    setCurrentRoomId(rooms[0].id);
    setMuseumMeta({ name: name ?? 'Museum', id: id ?? rooms[0].id, fromGallery });
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

    museumService.getMuseumById(mid).then(m => {
      if (m) handleMuseumReady({ rooms: m.rooms, name: m.name, id: m.id });
      else setUrlError('Museum not found on this device. The QR code may belong to a different browser or device.');
    });
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
        <Lobby onMuseumReady={handleMuseumReady} user={user} onAuth={handleAuth} onLogout={handleLogout} />
      </>
    );
  }

  const roomConfig = generatedRooms.find(r => r.id === currentRoomId) ?? generatedRooms[0];
  const museumId   = museumMeta?.id ?? 'default';

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#080810' }}>
      <Canvas camera={{ position: [0, 2, 5], fov: 75 }}>
        <Physics gravity={[0, -9.81, 0]}>
          <ambientLight intensity={1.6} />
          <directionalLight color="white" position={[10, 10, 10]} intensity={6.5} />
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
        fromGallery={museumMeta?.fromGallery ?? false}
        onExit={() => handleTeleport('lobby')}
      />
    </div>
  );
}

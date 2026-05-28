export const SKINS = [
  { id: 'classic',  label: 'Classic',  wallColor: '#1a1a2e', accentColor: '#5a3f9a' },
  { id: 'scifi',    label: 'Sci-Fi',   wallColor: '#080e20', accentColor: '#1a4a8a' },
  { id: 'minimal',  label: 'Minimal',  wallColor: '#111111', accentColor: '#2a2a2a' },
  { id: 'warm',     label: 'Warm',     wallColor: '#1a1208', accentColor: '#6a3a10' },
  { id: 'verdant',  label: 'Verdant',  wallColor: '#081208', accentColor: '#1a5a22' },
];

export function getSkin(id) {
  return SKINS.find(s => s.id === id) ?? SKINS[0];
}

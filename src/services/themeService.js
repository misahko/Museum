const THEME_KEY = 'museum_theme_v1';

export const THEMES = [
  {
    id: 'purple',
    label: 'Purple',
    accent: '#9060e0',
    accentDim: 'rgba(134,95,212,0.7)',
    accentGlow: 'rgba(100,60,220,0.2)',
    border: 'rgba(112,76,196,0.55)',
    borderHover: 'rgba(142,105,222,0.75)',
    borderFocus: 'rgba(148,112,224,0.85)',
    swatch: '#9060e0',
  },
  {
    id: 'blue',
    label: 'Blue',
    accent: '#3b82f6',
    accentDim: 'rgba(59,130,246,0.7)',
    accentGlow: 'rgba(37,99,235,0.2)',
    border: 'rgba(59,130,246,0.5)',
    borderHover: 'rgba(96,165,250,0.75)',
    borderFocus: 'rgba(96,165,250,0.88)',
    swatch: '#3b82f6',
  },
  {
    id: 'teal',
    label: 'Teal',
    accent: '#14b8a6',
    accentDim: 'rgba(20,184,166,0.7)',
    accentGlow: 'rgba(13,148,136,0.2)',
    border: 'rgba(20,184,166,0.5)',
    borderHover: 'rgba(45,212,191,0.75)',
    borderFocus: 'rgba(45,212,191,0.88)',
    swatch: '#14b8a6',
  },
];

export const themeService = {
  getTheme() {
    const id = localStorage.getItem(THEME_KEY) ?? 'purple';
    return THEMES.find(t => t.id === id) ?? THEMES[0];
  },
  setTheme(id) {
    localStorage.setItem(THEME_KEY, id);
    applyTheme(THEMES.find(t => t.id === id) ?? THEMES[0]);
  },
};

export function applyTheme(theme) {
  const r = document.documentElement;
  r.style.setProperty('--accent',       theme.accent);
  r.style.setProperty('--accent-dim',   theme.accentDim);
  r.style.setProperty('--accent-glow',  theme.accentGlow);
  r.style.setProperty('--border',       theme.border);
  r.style.setProperty('--border-hover', theme.borderHover);
  r.style.setProperty('--border-focus', theme.borderFocus);
}

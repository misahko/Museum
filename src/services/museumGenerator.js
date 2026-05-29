import { getSkin } from './skins.js';

const P = Math.PI;

// ── Normal room (12×4×12) exhibit slots ───────────────────────────────────────

const SLOTS = [
  { position: [-3.5, 1.8, -5.9], rotation: [0, 0, 0] },
  { position: [ 0,   1.8, -5.9], rotation: [0, 0, 0] },
  { position: [ 3.5, 1.8, -5.9], rotation: [0, 0, 0] },
  { position: [-5.9, 1.8, -2],   rotation: [0,  P / 2, 0] },
  { position: [ 5.9, 1.8, -2],   rotation: [0, -P / 2, 0] },
];

const IMAGE_POSITIONS = [
  [2.5, 2.4, 0],
  [-2.5, 2.4, 0],
];

// ── Big room (24×5×24) sector zones ──────────────────────────────────────────
// Four quadrants: NW / NE / SW / SE.  Each has 6 wall slots + a hologram label.

const BIG_SECTOR_ZONES = [
  {
    // NW quadrant: north wall left section + west wall north section
    label: [-7, 4, -7],
    slots: [
      { position: [-10,  2.2, -11.9], rotation: [0,      0, 0] },
      { position: [ -7,  2.2, -11.9], rotation: [0,      0, 0] },
      { position: [ -4,  2.2, -11.9], rotation: [0,      0, 0] },
      { position: [-11.9, 2.2,  -8],  rotation: [0,  P/2, 0] },
      { position: [-11.9, 2.2,  -4],  rotation: [0,  P/2, 0] },
      { position: [-11.9, 2.2,  -1],  rotation: [0,  P/2, 0] },
    ],
  },
  {
    // NE quadrant: north wall right section + east wall north section
    label: [7, 4, -7],
    slots: [
      { position: [  4,  2.2, -11.9], rotation: [0,      0, 0] },
      { position: [  7,  2.2, -11.9], rotation: [0,      0, 0] },
      { position: [ 10,  2.2, -11.9], rotation: [0,      0, 0] },
      { position: [11.9, 2.2,  -8],   rotation: [0, -P/2, 0] },
      { position: [11.9, 2.2,  -4],   rotation: [0, -P/2, 0] },
      { position: [11.9, 2.2,  -1],   rotation: [0, -P/2, 0] },
    ],
  },
  {
    // SW quadrant: west wall south section + south wall left section
    label: [-7, 4, 7],
    slots: [
      { position: [-11.9, 2.2,  1],   rotation: [0,  P/2, 0] },
      { position: [-11.9, 2.2,  4],   rotation: [0,  P/2, 0] },
      { position: [-11.9, 2.2,  8],   rotation: [0,  P/2, 0] },
      { position: [-10,  2.2,  11.9], rotation: [0,    P, 0] },
      { position: [ -7,  2.2,  11.9], rotation: [0,    P, 0] },
      { position: [ -4,  2.2,  11.9], rotation: [0,    P, 0] },
    ],
  },
  {
    // SE quadrant: east wall south section + south wall right section
    label: [7, 4, 7],
    slots: [
      { position: [11.9, 2.2,  1],   rotation: [0, -P/2, 0] },
      { position: [11.9, 2.2,  4],   rotation: [0, -P/2, 0] },
      { position: [11.9, 2.2,  8],   rotation: [0, -P/2, 0] },
      { position: [  4,  2.2, 11.9], rotation: [0,    P, 0] },
      { position: [  7,  2.2, 11.9], rotation: [0,    P, 0] },
      { position: [ 10,  2.2, 11.9], rotation: [0,    P, 0] },
    ],
  },
];

const BIG_IMAGE_POSITIONS = [
  [4, 3, 0], [-4, 3, 0], [0, 3, 4], [0, 3, -4],
];

// ── Theme rotation (used when no skin is chosen) ───────────────────────────────

const THEMES = [
  { wallColor: '#1a1a2e', accentColor: '#5a3f9a' },
  { wallColor: '#1a2a1a', accentColor: '#3a8a4a' },
  { wallColor: '#2a1a1a', accentColor: '#9a3a3a' },
  { wallColor: '#1a2a2a', accentColor: '#2a8a8a' },
  { wallColor: '#2a1e10', accentColor: '#9a6a2a' },
];

const CONFIDENCE_SUFFIX = {
  inferred_certain: ' (inferred)',
  inferred_range:   ' (estimated)',
  unknown:          ' (date unknown)',
};

function eventToExhibit(event, slot) {
  const text = event.event;
  const title = text.length > 58 ? text.slice(0, 55) + '…' : text;
  const dateStr = typeof event.date === 'number'
    ? String(event.date)
    : (event.date ?? 'unknown');
  const suffix = CONFIDENCE_SUFFIX[event.date_confidence] ?? '';

  return {
    title,
    body: `${dateStr}${suffix}\n\n${text}`,
    position: slot.position,
    rotation: slot.rotation,
  };
}

function distributeImages(images, numRooms) {
  if (!images?.length || !numRooms) return Array.from({ length: numRooms }, () => []);
  const buckets = Array.from({ length: numRooms }, () => []);
  images.forEach((img, i) => { buckets[i % numRooms].push(img); });
  return buckets;
}

/**
 * @param {object} llmOutput
 * @param {object} [opts]
 * @param {string} [opts.skinId]      skin preset id
 * @param {string|null} [opts.sceneModel]  GLB path for entrance room
 */
export function generateMuseumRooms(llmOutput, opts = {}) {
  const yearRooms = llmOutput.rooms ?? [];
  const imageBuckets = distributeImages(llmOutput.images, yearRooms.length);
  const skin = opts.skinId ? getSkin(opts.skinId) : null;

  return yearRooms.map((room, idx) => {
    const id     = `gen-${idx}`;
    const prevId = idx === 0 ? 'lobby' : `gen-${idx - 1}`;
    const nextId = idx < yearRooms.length - 1 ? `gen-${idx + 1}` : null;

    // Use big room for multi-sector (thematic_clusters) years
    const isBig = room.layout === 'thematic_clusters' && room.sectors.length > 1;

    // ── Portals ────────────────────────────────────────────────────────────────
    const portals = [
      {
        targetRoom: prevId,
        label: idx === 0 ? '← Exit' : '← Back',
        position: isBig ? [11.5, 2, 0] : [5.5, 1.5, 0],
      },
    ];
    if (nextId) {
      portals.push({
        targetRoom: nextId,
        label: 'Next →',
        position: isBig ? [-11.5, 2, 0] : [-5.5, 1.5, 0],
      });
    }

    // ── Exhibits ────────────────────────────────────────────────────────────────
    let wallExhibits, sectorHolos;

    if (isBig) {
      wallExhibits = [];
      sectorHolos  = [];
      room.sectors.forEach((sector, si) => {
        const zone = BIG_SECTOR_ZONES[si % BIG_SECTOR_ZONES.length];
        sector.events.slice(0, zone.slots.length).forEach((ev, ei) => {
          wallExhibits.push(eventToExhibit(ev, zone.slots[ei]));
        });
        if (sector.name) {
          sectorHolos.push({
            displayType: 'hologram',
            title: sector.name,
            body: sector.description?.slice(0, 200),
            position: zone.label,
          });
        }
      });
    } else {
      const allEvents = room.sectors.flatMap(s => s.events);
      wallExhibits = allEvents.slice(0, SLOTS.length).map((ev, i) => eventToExhibit(ev, SLOTS[i]));
      sectorHolos  = [];
      if (room.layout === 'thematic_clusters') {
        room.sectors.slice(0, 3).forEach((sector, si) => {
          if (sector.name) {
            sectorHolos.push({
              displayType: 'hologram',
              title: sector.name,
              body: sector.description?.slice(0, 150),
              position: [-3 + si * 3, 2.2, -1],
            });
          }
        });
      }
    }

    // ── Year hologram ──────────────────────────────────────────────────────────
    const firstDesc = room.sectors[0]?.description ?? '';
    const holoBody = firstDesc.length > 220 ? firstDesc.slice(0, 217) + '…' : firstDesc || undefined;
    const yearHologram = {
      displayType: 'hologram',
      title: room.year === 'unknown' ? 'Undated Events' : String(room.year),
      body: holoBody,
      position: isBig ? [0, 4.3, 0] : [0, 2.9, -3],
    };

    // ── Image holograms ────────────────────────────────────────────────────────
    const imgPositions = isBig ? BIG_IMAGE_POSITIONS : IMAGE_POSITIONS;
    const imageHolos = imageBuckets[idx]
      .slice(0, imgPositions.length)
      .map((img, i) => ({
        displayType: 'hologram',
        image: img.data_url,
        title: `p.${img.page}`,
        position: imgPositions[i],
      }));

    const colours = skin
      ? { wallColor: skin.wallColor, accentColor: skin.accentColor }
      : THEMES[idx % THEMES.length];

    const isEntrance = idx === 0 && opts.sceneModel;

    return {
      id,
      year: room.year,
      big: isBig,
      spawn: isBig ? [0, 1, 8] : [0, 1, 4],
      ...(isEntrance ? { model: opts.sceneModel } : {}),
      portals,
      exhibits: [...wallExhibits, yearHologram, ...sectorHolos, ...imageHolos],
      ...colours,
    };
  });
}

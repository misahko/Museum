/**
 * Converts LLMSorting pipeline output into 3D room configs for the museum.
 *
 * Input schema (from LLMSorting server):
 *   {
 *     rooms:  [{year, layout, sectors: [{name, description, events: [{event, date, date_confidence, semi_transparent}]}]}],
 *     images: [{file_id, page, width, height, data_url}]   // optional
 *   }
 *
 * Output: array of BoxRoom-compatible room configs (rooms.json schema).
 */

// Five wall slots in a 12×4×12 BoxRoom
const SLOTS = [
  { position: [-3.5, 1.8, -5.9], rotation: [0, 0, 0] },
  { position: [ 0,   1.8, -5.9], rotation: [0, 0, 0] },
  { position: [ 3.5, 1.8, -5.9], rotation: [0, 0, 0] },
  { position: [-5.9, 1.8, -2],   rotation: [0,  Math.PI / 2, 0] },
  { position: [ 5.9, 1.8, -2],   rotation: [0, -Math.PI / 2, 0] },
];

// Image hologram positions — floating in free space, not on walls
const IMAGE_POSITIONS = [
  [2.5, 2.4, 0],
  [-2.5, 2.4, 0],
];

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

/**
 * Distributes extracted images across rooms.
 * Returns an array where index i contains the images for room i.
 */
function distributeImages(images, numRooms) {
  if (!images?.length || !numRooms) return Array.from({ length: numRooms }, () => []);

  const buckets = Array.from({ length: numRooms }, () => []);
  images.forEach((img, i) => {
    buckets[i % numRooms].push(img);
  });
  return buckets;
}

/**
 * Converts LLMSorting museum JSON to an array of BoxRoom configs.
 * Each year-bucket becomes one 3D room; rooms are linked in sequence.
 */
export function generateMuseumRooms(llmOutput) {
  const yearRooms = llmOutput.rooms ?? [];
  const imageBuckets = distributeImages(llmOutput.images, yearRooms.length);

  return yearRooms.map((room, idx) => {
    const id = `gen-${idx}`;
    const prevId = idx === 0 ? 'lobby' : `gen-${idx - 1}`;
    const nextId = idx < yearRooms.length - 1 ? `gen-${idx + 1}` : null;

    const portals = [
      {
        targetRoom: prevId,
        label: idx === 0 ? '← Exit' : '← Back',
        position: [4.5, 1.5, 0],
      },
    ];
    if (nextId) {
      portals.push({ targetRoom: nextId, label: 'Next →', position: [-4.5, 1.5, 0] });
    }

    // ── Text exhibits from events ──────────────────────────────────────────────
    const allEvents = room.sectors.flatMap(s => s.events);
    const wallExhibits = allEvents
      .slice(0, SLOTS.length)
      .map((ev, i) => eventToExhibit(ev, SLOTS[i]));

    // ── Year hologram (year label + first sector description) ──────────────────
    const firstDesc = room.sectors[0]?.description ?? '';
    const holoBody = firstDesc.length > 220
      ? firstDesc.slice(0, 217) + '…'
      : firstDesc || undefined;

    const yearHologram = {
      displayType: 'hologram',
      title: room.year === 'unknown' ? 'Undated Events' : String(room.year),
      body: holoBody,
      position: [0, 2.9, -3],
    };

    // ── Sector-name holograms for thematic_clusters rooms ─────────────────────
    const sectorHolos = [];
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

    // ── Image holograms from PDF extraction ────────────────────────────────────
    const imageHolos = imageBuckets[idx]
      .slice(0, IMAGE_POSITIONS.length)
      .map((img, i) => ({
        displayType: 'hologram',
        image: img.data_url,
        title: `p.${img.page}`,
        position: IMAGE_POSITIONS[i],
      }));

    return {
      id,
      spawn: [0, 1, 4],
      portals,
      exhibits: [...wallExhibits, yearHologram, ...sectorHolos, ...imageHolos],
      ...THEMES[idx % THEMES.length],
    };
  });
}

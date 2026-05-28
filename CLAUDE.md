# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
bun run dev       # start dev server with HMR
bun run build     # production build
bun run preview   # preview production build locally
bun run lint      # run ESLint
```

There are no tests configured.

## Architecture

React + Vite app. A procedurally-configured 3D museum rendered with `@react-three/fiber` (R3F), `@react-three/drei`, and `@react-three/rapier` for physics.

**Entry point:** `src/main.jsx` → `src/App.jsx`

### Room system (`src/rooms.json`)

All museum content is driven by `rooms.json`. Each room entry has:

```jsonc
{
  "id": "main-hall",
  "model": "/ReplaceT.glb",       // omit for a procedural BoxRoom
  "spawn": [0, 1, 3],             // player start position
  "wallColor": "#252530",         // BoxRoom only
  "accentColor": "#4a3f6b",       // BoxRoom only — emissive top-trim strip
  "replacements": [               // GLTF rooms only — swap named objects
    { "name": "Icosphere", "model": "/R2.glb" }
  ],
  "portals": [],                  // REQUIRED (empty array is fine)
  "exhibits": []
}
```

**`portals` is required** — `Room.jsx` calls `config.portals.map(...)` directly, so omitting it crashes the render. `exhibits` defaults to `[]` via `?? []`.

Portal shape:
```jsonc
{ "targetRoom": "annex", "label": "Annex →", "position": [2, 1.5, 0] }
// OR (GLTF rooms only):
{ "targetRoom": "annex", "label": "Annex →", "meshName": "DoorMesh" }
```

`meshName`-based portals look up world position from the GLTF scene. They silently fall back to `[0, 1.5, 2]` in BoxRoom rooms because `scene` is passed as `null` there.

### Exhibit display types

Three display types are available for `exhibits` entries:

```jsonc
// 1. Standard wall placard (default, no displayType field)
{ "title": "...", "body": "...", "image": "/fig.png", "position": [x,y,z], "rotation": [x,y,z] }

// 2. Floating hologram (bobs/sways, cyan glow frame)
{ "displayType": "hologram", "title": "...", "body": "...", "image": "/fig.png", "position": [x,y,z] }

// 3. Hologram on a 3D pedestal
{ "displayType": "stand", "standModel": "/R2.glb", "standHeight": 1.2,
  "title": "...", "body": "...", "image": "/fig.png", "position": [x, 0, z] }
```

All content fields (`title`, `body`, `image`) are optional in every type — any combination works. Text heights are measured post-render via troika's `onSync` callback so panels auto-size.

### Key components

**`src/App.jsx`** — top-level. Holds `currentRoomId` state, wraps everything in `<Physics>`, renders `<Room key={roomId}>` (remounts on room change) and `<Player>` (persists across rooms, teleports via `spawnPosition` prop).

**`src/Room.jsx`** — if `config.model` is present, loads the GLTF, clones the scene (`gltfScene.clone()` so cached GLTFs aren't mutated), wraps it in a trimesh `<RigidBody>`, and adds a flat floor `<CuboidCollider>`. If absent, renders `<BoxRoom>` instead. Then mounts `ReplacementLoader`, `PortalMarker`, and exhibit components.

**`src/BoxRoom.jsx`** — procedural box room: 12 × 4 × 12 units (W × H × D). Exports `ROOM_W`, `ROOM_H`, `ROOM_D` constants. Has four ceiling point lights and a checkerboard floor texture generated on a canvas.

**`src/Player.jsx`** — first-person controller. Click canvas to capture pointer lock; WASD/arrows to move (speed 5 u/s); mouse to look (pitch clamped to ±π/2.2). Uses a `<RigidBody>` + `<CapsuleCollider>` (half-height 0.5, radius 0.3 → ~1.6 units tall). Camera is pinned to `body.translation() + {y: 0.8}` every frame; only horizontal velocity is set each frame, preserving gravity.

**`src/replaceObjects.js`** — pure utility. `applyReplacements(scene, [{name, model}])` hides named objects and clones replacements in their place. Idempotent via `userData.__replaced` flag.

**`src/ExhibitPanel.jsx`** — standard wall placard (`displayType` absent). Dark backing plate with SDF `<Text>` and drei `<Image>`.

**`src/HoloPanel.jsx`** — exports `HoloPanel` (floating hologram) and `StandPanel` (pedestal hologram). Both use a shared `HologramDisplay` + `HoloFrame` that draws fake bloom quads, scanlines, and L-bracket corner accents.

### Adding content

**New room:** add an entry to `rooms.json` with a unique `id`, a `.glb` model in `public/` (or omit for BoxRoom), spawn point, `portals: []`, and optional exhibits.

**New exhibit panel:**
```json
{ "title": "Paper Title", "body": "Author et al. Abstract...", "image": "/figures/fig.png", "position": [0, 1.5, -2] }
```

**New portal:** reference the `id` of any other room in `portals[].targetRoom`.

### 3D assets

`.glb` files go in `public/` and are referenced by root-relative path (`/model.glb`). `useGLTF` caches all loads — `gltfScene.clone()` is called in `Room.jsx` so each room instance gets its own mutable copy.

**Key dependency versions:** React 19, Three.js 0.184, R3F 9, Drei 10, Rapier 2.

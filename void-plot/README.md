# Void-Plot: The Last Acre

Void-Plot is a compact survival strategy game about maintaining humanity's last colony on a finite 32×32 plot. Build a sustainable settlement, reveal territory through expeditions, complete the research tree, and activate the Genesis Beacon.

## Requirements and installation

- Node.js 20 or newer
- npm

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open the local address printed by Vite. To run without the template's anonymous build log, use `npm run dev-nolog`.

## Production build

```bash
npx tsc --noEmit
npm run build
```

The deployable files are written to `dist/`. Upload the complete contents of that directory to a static web host.

## Controls

- Mouse: select tiles, place buildings, choose expedition sectors, and interact with panels
- WASD or arrow keys: move the world camera
- Mouse wheel: zoom around the pointer
- 2, 4, or 6: choose expedition sector size
- Esc: pause; while placing a building, cancel placement

## Basic gameplay

The initial 8×8 center is revealed. Place buildings only on revealed vacant tiles. Power Plants supply staffed production buildings; Farms produce Food; Forests provide renewable Materials; Labs generate Research Points. Homes raise population capacity and Food recruits additional workers.

Expeditions are the only standard way to reveal hidden territory. Select a valid sector on the revealed frontier and explicitly start the expedition from its panel. Materials and workers are committed only when it starts, and tiles reveal only after successful completion.

The Genesis Beacon advances automatically through five phases, increasing colony pressure every five minutes. During Final Transmission, reach Population 20, Food 250, Materials 300, Power Generation 12, and complete Tier 4 research to activate the Beacon and win.

## Accessibility

The Settings screen provides:

- UI scale: 90%, 100%, or 115%
- Screen-shake toggle
- Particle toggle
- Colorblind-friendly resource colors
- Reduced-motion mode

## Onboarding

A contextual first-run objective appears during play. It observes actual colony state and never blocks normal actions. Progress survives scene transitions for the current browser session, and the tutorial can be skipped at any time.

## Known limitations

- Continue/save persistence is not implemented.
- Game Over remains a placeholder; colony pressure exposes risk without ending the run.
- Expedition success is temporarily guaranteed until the risk system is implemented.
- Audio event hooks exist, but no audio assets are included.
- The first playable implements Homes, Farms, Forests, Power Plants, and Labs; the remaining design-authority building categories are deferred.
- Settings and tutorial progress are session-scoped rather than persisted across browser reloads.

## Release validation

See [docs/release-checklist.md](docs/release-checklist.md) for the release-candidate verification matrix and manual checks.

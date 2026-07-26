# Void-Plot Release-Candidate Checklist

## Automated gates

- [x] TypeScript check passes with `npx tsc --noEmit`
- [x] Production build passes with `npm run build`
- [x] Whitespace validation passes with `git diff --check`
- [x] Dependency-free simulation validators pass
- [x] Responsive layout validator covers 1280×720, 1366×768, 1440×900, and 1920×1080 at 90%, 100%, and 115% UI scale

## Run flow

- [ ] New Game starts without console errors
- [ ] Pause and Resume preserve the run
- [ ] Restart Run creates one clean scene instance
- [ ] Return to Menu works, and a subsequent New Game is clean
- [ ] Settings can be opened from Main Menu and Pause
- [ ] Victory freezes simulation and opens the Victory screen
- [ ] Continue opens Results

## Gameplay

- [ ] Tutorial can be completed sequentially
- [ ] Tutorial can be skipped
- [ ] Event modal choices resolve and do not click through
- [ ] Research selection, production, prerequisites, and completion work
- [ ] Expeditions start, count down, return workers, and reveal exactly once
- [ ] Beacon reaches Final Transmission and can be activated when requirements are met
- [ ] Renewable-Materials reserve prevents construction or expeditions from causing a permanent Materials deadlock

## UI matrix

Manually inspect each target at 90%, 100%, and 115% UI scale:

- [ ] 1280×720
- [ ] 1366×768
- [ ] 1440×900
- [ ] 1920×1080

At every target verify Beacon, Research, Resources, Build, Selected Tile, Expedition, tutorial, notifications, tooltips, event modal, Pause, Settings, Victory, and Results. Confirm no overlap, clipping, unreadable disabled state, click-through, or off-screen tooltip.

## Submission

- [ ] Version and credits are correct
- [ ] README instructions work from a clean checkout
- [ ] `dist/` contains the complete submission build
- [ ] No external links or unavailable assets are required
- [ ] Known limitations match the submitted build

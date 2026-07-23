# Void-Plot Development Rules

## Design authority

`docs/game-design.md` is the single source of truth.

The implementation must follow it. Do not silently redesign the game to make implementation easier.

## Non-negotiable design rules

- The world is exactly 32×32 tiles.
- The initial revealed area is an 8×8 region centered on the plot.
- Expeditions are the only standard way to reveal terrain.
- Research modifies expedition range, safety, chunk size, and special-site access.
- Do not create scout units or a second reveal system.
- Reveal sizes progress through 2×2, 4×4, and 6×6 stages.
- The game uses exactly six core resources:
  - Population
  - Food
  - Power
  - Water
  - Materials
  - Research
- The approved building categories are:
  - Homes
  - Farms
  - Power Plants
  - Defenses
  - Water Extractors
  - Forests
  - Labs
- The Genesis Beacon completes the campaign.
- Endless Mode unlocks as a separate optional challenge.
- Permanent meta-progression unlocks choices only.
- Do not add permanent numerical production bonuses or immunity.
- Every expedition needs a cost, risk, reward, and competing alternative.
- Every feature must strengthen meaningful trade-offs under finite space.

## Technical rules

- Use Phaser with TypeScript and Vite.
- Phaser handles input and rendering.
- Simulation logic must remain independent from Phaser.
- Avoid global mutable state.
- Store building, event, expedition, research, and balance values in data files.
- Do not introduce React.
- Do not introduce a backend, authentication, or multiplayer.
- Do not add a dependency unless it is necessary for the current task.
- Do not modify unrelated files.
- Implement one small task at a time.

## Workflow for every task

1. Read the relevant sections of `docs/game-design.md`.
2. Inspect the existing implementation.
3. Explain the implementation plan before making large changes.
4. State any assumptions.
5. Implement only the requested scope.
6. Run type checking.
7. Run tests when tests exist.
8. Run the production build.
9. Report changed files and unresolved issues.

If a requested implementation conflicts with the design document, stop and report the conflict.

//

Read:

docs/game-design.md

AGENTS.md

Do not write code yet.

Summarize the game.

Summarize the architecture.

List every major gameplay system.

List implementation phases.

Do not invent mechanics.

Wait for my next task.

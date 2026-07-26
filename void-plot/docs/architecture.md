# Void-Plot Architecture

## Core principle

Rendering and simulation must remain separate.

Phaser displays the game and receives player input.

Plain TypeScript modules decide game rules and update game state.

## Layers

### Rendering layer

Responsibilities:

- Phaser scenes
- Grid rendering
- Fog rendering
- Building sprites
- Camera controls
- Mouse and keyboard input
- Interface panels
- Visual and audio feedback

The rendering layer must not own economy, event, research, or expedition rules.

### Simulation layer

Responsibilities:

- World state
- Tile and building state
- Resources
- Cycle progression
- Economy
- Population consequences
- Expeditions
- Research
- State-weighted events
- Genesis Beacon progression
- Win and failure conditions

The simulation layer must not require Phaser objects.

### Expedition domain boundary

The expedition domain is a plain TypeScript part of the simulation layer. It owns expedition records, lifecycle transitions, immutable sector snapshots, start validation, concurrency enforcement, duplicate-target checks, and timing data. It must not import Phaser or depend on scenes, cameras, display objects, or real-time Phaser timers.

The world layer remains the authority for tile reveal state and sector geometry. Expedition validation must call the existing world expedition-sector APIs rather than duplicate adjacency, bounds, or hidden-tile rules. The expedition domain may request a reveal only after successful completion; world reveal functions perform the actual safe tile-state change.

Resource availability and worker availability are separate simulation states. The expedition domain reads them during start validation and returns the required state transition. Materials are deducted and workers are assigned only when a planned expedition becomes active. Completing, failing, or cancelling an active expedition releases its assigned workers. Once an expedition becomes active, its spent materials are not refunded.

UI and rendering code may read expedition state and issue explicit plan, start, or cancel requests. UI objects must not own expedition records, perform validation, deduct materials, assign workers, advance timing, decide outcomes, or reveal tiles. Sector selection remains preview/input state and does not create an expedition automatically.

### Expedition state ownership and snapshots

Expedition state owns the collection of expedition records and the deterministic next-ID source or injected ID factory. Each record uses only the authoritative statuses `planned`, `active`, `completed`, `failed`, and `cancelled`.

Planning creates an immutable sector snapshot of size, origin, inclusive bounds, covered coordinates, and hidden coordinates at planning time. Starting revalidates the fixed geometry against the current world and captures an immutable hidden-coordinate list for start time. The original geometry never changes. Timing is stored as plain data in seconds; the simulation advances it, while Phaser may only display it.

The first playable allows one active expedition. Planned expeditions do not consume that slot. Exact duplicate inclusive bounds are forbidden across planned and active records. Terminal records (`completed`, `failed`, and `cancelled`) do not block later targeting.

### Data layer

Responsibilities:

- Building definitions
- Research definitions
- Expedition definitions
- Event definitions
- Balance values

Gameplay values should not be scattered through scene code.

First-playable expedition worker counts, durations in seconds, and materials costs belong in expedition definitions or balance data. Their mechanics are authoritative; numeric tuning must be documented rather than embedded in UI or scene code.

### Persistence layer

Responsibilities:

- Current campaign save
- Permanent meta-progression save
- Save schema versioning
- Recovery from invalid save data

The jam build will use browser localStorage.

## Initial source structure

```text
src/
├── main.ts
├── game/
├── scenes/
├── simulation/
├── world/
├── data/
├── rendering/
├── ui/
├── persistence/
└── tests/
```

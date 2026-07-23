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

### Data layer

Responsibilities:

- Building definitions
- Research definitions
- Expedition definitions
- Event definitions
- Balance values

Gameplay values should not be scattered through scene code.

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

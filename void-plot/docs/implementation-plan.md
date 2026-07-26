## Step 6: Fill `docs/implementation-plan.md`

```md
# Void-Plot Implementation Plan

## Phase 1 — World foundation

- Fixed 32×32 logical grid
- Isometric coordinate conversion
- Centered 8×8 initial reveal
- Fog of war
- Tile hover and selection
- Camera zoom
- Camera constrained to the plot

## Phase 2 — Building placement

- Data-driven building definitions
- Placement preview
- Valid and invalid placement feedback
- Occupancy validation
- Seven approved building categories
- No economy processing yet

## Phase 3 — Economy and cycles

- Six resources
- Building costs, upkeep, and production
- Population consumption
- End Cycle action
- Cycle report
- Shortage consequences
- Economy tests

## Phase 4 — Expeditions

Implement the first-playable expedition path in this order:

1. **Phaser-independent expedition domain state and validation**
   - Statuses: planned, active, completed, failed, and cancelled
   - Immutable planning and start-time sector snapshots
   - Existing sector API reuse
   - Duplicate planned/active target rejection
   - One-active-expedition limit
   - Deterministic or injected ID generation
2. **Minimal materials resource state**
   - Materials-only first-playable expedition costs: 20 / 60 / 140
   - No deduction before transition to active
3. **Minimal worker availability state**
   - Worker requirements: 1 / 2 / 3
   - Assignment on activation
   - Release when an active expedition completes, fails, or is cancelled
4. **Start Expedition button integration**
   - Sector selection alone creates no expedition
   - Explicit request creates a planned record and attempts start validation
   - Failed start validation leaves the record planned without committing resources or workers
5. **Active expedition timing**
   - Base durations stored in seconds: 30 / 90 / 180
   - Timing begins only when active
6. **Successful completion and sector reveal**
   - Temporary guaranteed-success rule
   - Reveal only on successful completion
   - Reveal start-time hidden coordinates safely
   - Territory reveal is the initial reward; no additional loot
7. **Failure/risk support**
   - Failed status reveals no tiles
   - Replace temporary guaranteed success when safety/risk rules are implemented
   - Special-site outcomes remain deferred
8. **Persistence later**
   - Persist expedition state only after lifecycle behavior is stable
   - Preserve immutable snapshots and timing data in seconds

## Phase 5 — State-weighted events

- Event eligibility
- Weight modifiers
- Cooldowns
- Player responses
- Recoverable crises
- Catastrophic outcomes
- Seeded randomness

## Phase 6 — Research

- Small prerequisite tree
- Expedition improvements
- Infrastructure options
- Event-response unlocks
- Beacon prerequisites

## Phase 7 — Genesis Beacon

- Beacon requirements
- Visible progress
- Campaign completion
- Victory screen
- Endless Mode unlock

## Phase 8 — Persistence and meta-progression

- Current campaign save
- Permanent unlock save
- Choice-only unlock enforcement
- Save schema versioning

## Phase 9 — Validation

- Economy simulation
- Beacon pacing simulation
- Event-weight simulation
- Sector reveal cadence testing
- Fun Gate playtests

## Phase 10 — Polish

- Tutorial
- Audio
- Visual effects
- Improved art
- Accessibility
- Performance
- Submission build
```

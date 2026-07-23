# Void-Plot: The Last Acre - v3 LOCKED Concept Brief

# Void-Plot: The Last Acre — v3.1 Locked Concept Brief

**Status: LOCKED**

This document is the final design authority for Void-Plot: The Last Acre.
Any implementation that conflicts with this document is incorrect unless
approved through a formal change request.

**Status: LOCKED**

**Amendment Log:**

- **v3.1 (2026-07-21):** Framing language updated in the Endless Mode section per steward direction. Fun Gate elevated from pre-ship validation gate to **release gate** (cannot ship without it). Mechanics unchanged.

This document is the final design authority for _Void-Plot: The Last Acre_. All open questions from v2 are resolved with explicit designer calls. No further design iteration is permitted without a formal change request. Development is to proceed immediately based on these specifications.

---

## Summary of Deltas (v2 → v3)

| Feature            | v2 Status                | v3 Status                                                            | Rationale                                                                                                                                                                              |
| ------------------ | ------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reveal system      | Open (scouts + research) | **LOCKED: Single expedition ladder**                                 | Eliminates fragmented cognitive load; one path, two steps.                                                                                                                             |
| Reveal granularity | Open (tile-by-tile)      | **LOCKED: Sector-based (2×2 → 4×4 → 6×6)**                           | Solves the 240-batch arithmetic problem; preserves pacing milestones.                                                                                                                  |
| Beacon pacing      | Open                     | **LOCKED: 5–8 cycles**                                               | Hard target; validate via simulation pre-ship.                                                                                                                                         |
| Endless framing    | Implicit                 | **LOCKED: Beacon = completion, Endless = unlocked challenge** (v3.1) | The Genesis Beacon marks the successful completion of the campaign. Endless Mode unlocks as an optional challenge. First beacon run is a complete game; endless is the long-tail hook. |
| Meta-progression   | Confirmed choice-only    | **LOCKED: Choice unlocks only, hard ban on raw power**               | Non-negotiable guardrail against dread-leakage.                                                                                                                                        |
| Platform           | Open                     | **LOCKED: PC-first (Steam); mobile-port out of scope v1**            | Focuses v1 resources.                                                                                                                                                                  |
| Audience           | Reference set noted      | **LOCKED: Strategy players (Frostpunk / Banished / RimWorld / ONI)** | Clear target persona for art, UX, and tuning decisions.                                                                                                                                |

---

## Section A - High-Level / Design

### **LOCKED: Player Fantasy**

**Primary fantasy:** omniscient overseer of humanity's last habitable plot + determined engineer racing toward the Genesis Beacon. A blend of _Cosy Builder Dread_ and _Cosmically Meaningful Build Project_.

Secondary hooks (locked):

- Claustrophobic intensity - the void is permanent; there is nowhere else to go.
- Decision-driven world evolution - events are state-aware; the build writes the next crisis.
- Beacon-as-obsession - long-term research arc with visible progress.

### **LOCKED: Genre & Category**

- Primary: survival strategy / city-builder hybrid
- Secondary: roguelike (run structure) + meta-progression layer
- **Platform:** PC-first (Steam). Mobile-port explicitly deferred post-v1.
- **Audience:** strategy players who enjoyed Frostpunk (decisions + failure), Banished (resource micro), RimWorld (storytelling through systems), Oxygen Not Included (systems mastery).

### **LOCKED: Core Loop**

**Assess → Act → React → Evolve**

- **Assess (1–2 min):** survey plot state (population, resources, threats, recent events).
- **Act (5–10 min):** place/modify buildings, allocate workers, queue expeditions, queue research.
- **React (event-driven):** state-aware events fire; player chooses response.
- **Evolve (between runs):** meta-progression unlocks carry forward.

**Run length:** 30–60 minutes. **Cycle length:** ~5 minutes. **Beacon construction:** 5–8 cycles. After beacon: endless mode opens.

### **LOCKED: Three USPs**

1. **The Finite Constraint** - there is nowhere else to go. Every tile is permanent and irreplaceable. The 32×32 grid is the player's true antagonist through scarcity.
2. **Decision-Driven World Evolution** - events are state-aware, not pure RNG. High population → plague; high power → alien visitors; forest-heavy → drought-resistant but meteor-vulnerable; lab-heavy → research unlocks but contact pressure. The build literally writes the next crisis.
3. **Beacon Quest + Endless Aftermath** - primary goal gives players a finish line; the void's response after the beacon lights creates an endless mode that respects the fantasy instead of repeating it.

### **LOCKED: Tone & Feel**

- **Visual:** top-down isometric, muted palette (charcoal, ash-white, single warm accent for player assets), void rendered as absence not terrain.
- **Audio:** ambient void drone (low, persistent), single-note event fanfares, no music during normal play — silence is the canvas.

---

## Section B — Product Design

### **LOCKED: Camera & View**

- **Top-down isometric, 3/4 perspective, ~30° tilt**
- Camera locks to plot center; cannot pan outside the 32×32 grid
- Three zoom levels: tight (individual plots), standard (working zoom), overview (whole grid)
- Fog of war on unrevealed tiles, integrated with the reveal mechanic
- Tile size: ~64×64 px at standard zoom

### **LOCKED: Input & Controls**

- Click-and-drag to select buildings
- Right-click for context (demolish, info, upgrade)
- Hotkeys for building categories (1–7) and expedition (E)
- Pause always available — the game punishes only when you act without thinking

### **LOCKED: UI Surface**

- **Top bar:** population, power, food, water, research progress, cycle counter, beacon progress
- **Right panel:** building palette + research tree
- **Bottom:** event log (last 5 events)
- **Left:** active crisis indicator (lights up when state-keyed event fires)
- Minimal chrome, icon-first feedback. The grid is the canvas — UI serves it.

---

## Section C — Detailed & Game Systems

### **LOCKED: Resource Set (6)**

- **Population** (housing capacity vs. population)
- **Food** (farms, water-dependent)
- **Power** (generation vs. consumption)
- **Water** (source buildings, drought-sensitive)
- **Materials** (construction, defenses, beacon components)
- **Research** (labs produce, beacon consumes)

### **LOCKED: Building Set (7)**

Homes, Farms, Power Plants, Defenses, Water Extractors, Forests, Labs

### **LOCKED: Reveal System — Single Expedition Ladder**

**Rationale:** Two systems doing reveal work fragment the strategic loop. Consolidate to a single path: expeditions reveal terrain; research modifies expedition parameters.

- **Starting visibility:** 8×8 centered on plot.
- **Reveal action:** Expedition is the ONLY action that reveals new terrain.
- **Expedition parameters** (modified by research):
  - **Range** — how far from the frontier expeditions can push.
  - **Safety** — risk of expedition failure or void-attractor events.
  - **Chunk size** — sector dimensions revealed per expedition.
  - **Special sites** — research-gated access to ruins, alien artifacts, beacon precursors.
- **Sector chunk sizes by stage:**

| Stage | Chunk size | Cumulative visible (approx) |
| ----- | ---------- | --------------------------- |
| Start | —          | 8×8 (given)                 |
| Early | 2×2        | ~12×12                      |
| Mid   | 4×4        | ~20×20                      |
| Late  | 6×6        | 32×32 (full)                |

- **Strategic implication:** some buildings (especially beacon-related) may require revealed-tile placement — exploration is part of the strategic loop, not cosmetic.

**Risk addressed:** the 240-batch arithmetic of literal 2×2 tile reveals. Sectors preserve cadence.

### **LOCKED: State-Keyed Event Engine**

Events fire probabilistically, weighted by current plot state. Event tables and exact weights are deferred to development within the design constraints below.

| State condition            | Likely event                                   |
| -------------------------- | ---------------------------------------------- |
| High population            | Plague, refugee wave                           |
| High power draw            | Alien visitors, void storm                     |
| Forest-heavy               | Drought resistance bonus, meteor vulnerability |
| Lab-heavy                  | Research unlocks, "contact pressure"           |
| High defense, low research | Mysterious ruins appear                        |
| Any state, low morale      | Drought, civil unrest                          |

### **LOCKED: Punishment Curve (Q1)**

- **Recoverable crises (~70%):** damage to buildings, population loss, resource drain, temporary debuffs. Recoverable through action.
- **Run-ending collapse (~5–10%):** full-intensity meteor strike, plague with no hospital, void breach. Run ends.
- **Permanent meta-progression (100% of runs):** every run earns unlocks — **choices only**. Never raw power.

**Hard guardrail:** meta unlocks must not trivialize early-game threats. If a player can make the first meteor trivial through unlocks, the dread has leaked.

### **LOCKED: Long-Term Goal (Q2) — Genesis Beacon + Endless Mode**

- **Primary objective:** research and construct the Genesis Beacon.
  - Requires threshold research (lab count + materials + event triggers).
  - Visible beacon progress bar in UI.
  - **Construction window: 5–8 cycles (LOCKED).** Hard target, validated via simulation.
- **Beacon completion:** run ends. Victory screen. Meta unlocks granted.
- **Endless mode (post-beacon):** new run with beacon already lit. The void responds — events escalate **qualitatively** (new event types, new state combinations, new collapse conditions), not just numerically. Higher-tier meta unlocks (cosmetic + lore only).
- **No fixed "win state" beyond the first beacon.** The fantasy is endless, not conclusive.

**Framing call (explicit — v3.1 wording):** The Genesis Beacon marks the successful completion of the campaign. Upon completion, Endless Mode unlocks as an optional challenge where the Void continues to evolve, offering long-term replayability through new event combinations, strategic pressures, and mastery rather than a continuation of the completed settlement. The first beacon run is a complete game — finishers get a satisfying arc. Endless mode is the unlocked challenge that serves as the long-tail hook for endless seekers. Same design, two audiences served by the same beat.

### **LOCKED: Meta-Progression — Choice-Only**

Permanent unlocks between runs, gated by achievements. **Hard ban on raw power.**

Allowed unlock categories:

- New starting conditions (more population, more materials, one pre-revealed sector)
- New building tiers (advanced homes, lab extensions)
- New event response options (negotiation, sacrifice, technology counter)
- New starting events (mysterious visitor on cycle 1)
- Lore fragments (story breadcrumbs across runs)
- Cosmetic-only infinite-tier unlocks (post-beacon)

**Banned forever:** "+X% production," "meteor immunity," "skip first crisis," or any unlock that flatly reduces void pressure.

### **LOCKED: Fail State**

- **Run-ending collapse:** plot uninhabitable (population = 0, all buildings destroyed, void breach).
- **No "game over" screen** — meta-progression screen appears directly; run summary shown as lore.
- **Permadeath-style:** run progress lost, unlocks persist.
- **Manual surrender:** player can end run early; partial meta-progression earned.

### **LOCKED: Success Metrics (Player Experience)**

- **Primary:** player completes beacon construction in 60–80% of runs.
- **Secondary:** player engages endless mode in 50%+ of post-beacon runs.
- **Tertiary:** player completes 5+ runs in first session (meta-progression loop works).

---

## Locked Risk Register

| Risk                                   | Impact                                                          | Mitigation                                                                                                        |
| -------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Beacon pacing**                      | High — too easy = no meta motivation; too slow = disengagement  | 5–8 cycle target is LOCKED; validate via simulation pre-ship.                                                     |
| **Endless mode design**                | High — escalation must be qualitatively new, not larger numbers | New event types, new state combos, new collapse conditions required. Otherwise endless dies after one beacon run. |
| **Sector reveal pacing**               | Medium — sector transitions must feel like milestones           | Iterative testing of 2×2 / 4×2 / 6×6 cadence against cycle budget.                                                |
| **Meta-progression bloat**             | Medium — risk of choice overload                                | Strict choice-only policy; curatorial gate on unlock count per run.                                               |
| **Isometric scope**                    | Medium — doubles art surface vs. flat top-down                  | Lock art budget before building-detail design. Defer detailed art to development.                                 |
| **Event-weight fairness**              | Medium — 5–10% run-ending events must not feel arbitrary        | State-weighted engine; pre-ship statistical simulation.                                                           |
| **Fun Gate failure (release blocker)** | High — empty activity loop = churn                              | Fun Gate elevated to release gate (see below). Tradeoff density must be designed in, not polished in.             |

---

## What v3 Defers to Development (Out of Design Scope)

The following items are explicitly **OUT OF SCOPE** for design. Development owns implementation within these constraints:

1. **Concrete event tables with state weights** — design defines the engine and ratios; dev fills the tables.
2. **Beacon research tree (specific nodes + thresholds)** — design defines the 5–8 cycle target; dev authors nodes.
3. **Meta-progression unlock catalog** — design defines the choice-only policy and banned categories; dev curates the unlock set.
4. **Tile / sector reveal cost schedule** — design defines sector sizes by stage; dev tunes exact material/research costs.
5. **Economy faucets / drains simulation** — design requires the sim pre-ship; dev runs it.
6. **UI / UX asset pipeline** — design defines layout and chrome philosophy; dev owns assets and interaction polish.
7. **Save / load architecture** — design defines state-reset semantics on beacon; dev owns the technical structure.
8. **Audio implementation** — design defines the "silence + drone + single-note fanfare" feel; dev owns the library.
9. **Art style exploration** — design locks isometric + muted palette; dev explores within that frame against the art budget.

---

## Release Gates (Cannot Ship Without)

These are binding ship-blockers. A build **cannot ship** if any release gate fails, independent of the pre-ship simulation gates below.

- [ ] **Fun Gate (elevated to release gate in v3.1).** A build cannot ship if players cannot clearly describe a difficult tradeoff after 30 minutes of play.
  - **Pass condition:** player names a specific decision without hesitation, describes the tradeoff, and remembers the stakes. Example: _"I had to choose between burning food to fuel the beacon early, or holding food and risking an expedition into the unknown sector during a meteor window."_
  - **Fail condition:** hesitation, generic answers, or "I don't know." Signals the core loop is producing _activity_, not _decisions_.
  - **Design implication:** tradeoff density is a release requirement, not polish. The expedition system is where this gate lives or dies — every expedition needs a cost, a risk, and a competing alternative. Bake tradeoff density into expedition design as a gate requirement.

---

## Pre-Ship Validation Gates

These simulation gates MUST close before ship:

- [ ] **Economy simulation** — verify all 6 resources sustain a 30–60 minute run with the 5–8 cycle beacon target.
- [ ] **Beacon pacing simulation** — verify the construction window is achievable but challenging.
- [ ] **Meta-gating simulation** — verify choice-unlocks provide meaningful variety without trivializing early-game threats.
- [ ] **Event-weight simulation** — verify 5–10% run-ending events are statistically distributed and not arbitrarily punishing.
- [ ] **Sector reveal cadence test** — verify 2×2 / 4×4 / 6×6 transitions land on the cycle budget and feel like milestones.

---

## Sign-off

**Lead Designer:** wale (game designer mind)
**For:** ayeola05@gmail.com
**Document:** v3 LOCKED, v3.1 amendments applied; supersedes v2 (artifact 491A4D3E-F36B-1410-8465-00039CE7DF11)
**Next action:** development handoff.

_This document is the single source of truth for the v1 build. Proceed to development._

# Release-Candidate Balance Audit

One small onboarding-safety value changed during final QA. All other findings use centralized first-playable definitions and deterministic production intervals.

## Timing benchmarks

| Milestone | Deterministic or optimistic time | Evidence |
| --- | ---: | --- |
| First Farm | Immediate after placement input | Starting Materials can cover it. |
| First Power Plant | Immediate after placement input | Starting Materials can cover the opening infrastructure path. |
| First renewable Materials | 10 seconds after a staffed, powered Forest begins operating | Forest output is 5 Materials per 10 seconds. |
| First Lab | Approximately 70 seconds after the Home + Farm + Forest + Power opening | That opening leaves 45 Materials; seven Forest cycles recover the 35 needed for the 80-Material Lab. |
| First completed Tier 1 research | Approximately 110 seconds on the same benchmark path | The cheapest Tier 1 costs 8 RP; one Lab produces 1 RP per 5 seconds. |
| Population 20 | Eight-minute mathematical floor; approximately 12–20 minutes in play | Sixteen growth steps require at least 480 seconds, before housing, Food, and staffing delays. |
| Final Transmission | 20 minutes | Four five-minute phase transitions. |

## Final Transmission benchmark

A late-game benchmark with eight powered Farms, three early Forests, four staffed Power Plants, eight Homes, one Lab, and completed research can satisfy the Beacon between 20 and 40 minutes.

- Eight Farms approximately cover Population 20 consumption under the Final Transmission production and Food-use penalties.
- Fully researched Power Plants generate 5 Power each during Final Transmission. Four provide 20 generation and allow Farm priority to remain supplied under increased production-building demand.
- Three Forests operating from early game have enough gross production capacity to repay benchmark construction and leave the 300-Material Beacon reserve. Expeditions and event downtime extend the schedule.
- Gross Food and Materials near 20 minutes are highly build-order dependent. At roughly 50% of ideal uptime, the benchmark produces about 900 Food and 850 Materials before consumption, recruitment, construction, events, and expeditions. Holding 250 Food and 300 Materials is demanding but realistic rather than automatic.

## Risks and recovery

- **Resource deadlock:** Spending below the first-Forest cost was permanently unwinnable because Materials have no other guaranteed renewable source. The release candidate reserves the current Forest cost until one Forest exists. This changes no numeric value and awards no resources.
- **Worker pressure:** Farm + Forest + Power uses three of four initial workers; the fourth can temporarily run an expedition or Lab. The player can release workers at any time, and contextual help explains this recovery path.
- **Power pressure:** Late Beacon phases require additional staffed Power Plants. Allocation remains deterministic and Farm-prioritized; UI warnings now explain how to add supply or reduce demand.
- **Research bottleneck:** Research selected without an active Lab waits safely without losing RP or progress. The panel explains staffing and Power requirements.
- **Dominant opening:** Early Power, Farm, and Forest remain strongly favored because the Food buffer is deliberately small and Materials must become renewable. This is an intentional consequence of existing balance, but it should be observed in playtesting.

## Balance changes

| Value | Previous | New | Reason | Evidence |
| --- | ---: | ---: | --- | --- |
| Initial Food | 0 | 8 | Prevent an unavoidable first-run shortage while the player reads onboarding and establishes powered Food production. | Population 4 consumes 4 Food every 20 seconds. The previous state had no time buffer; 8 Food supplies two opening cycles. |

No costs, output rates, timers, Beacon requirements, expedition values, or phase modifiers changed.

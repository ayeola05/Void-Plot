export type GameSoundEvent =
  | "buttonClick"
  | "menuOpened"
  | "gamePaused"
  | "gameResumed"
  | "buildingPlaced"
  | "buildingSelected"
  | "researchComplete"
  | "researchSelected"
  | "beaconAdvance"
  | "beaconReady"
  | "beaconActivated"
  | "eventOpened"
  | "eventChoiceSelected"
  | "foodProduced"
  | "materialsProduced"
  | "victory"
  | "workerAssigned"
  | "workerReleased"
  | "workerRecruited"
  | "expeditionStarted"
  | "expeditionReturned"
  | "warning"
  | "notification";

export type SoundEventListener = (event: GameSoundEvent) => void;

export class SoundEventBus {
  private readonly listeners = new Set<SoundEventListener>();
  public emit(event: GameSoundEvent): void { this.listeners.forEach((listener) => listener(event)); }
  public subscribe(listener: SoundEventListener): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}

export function getSoundEventBus(registry: { get(key: string): unknown; set(key: string, value: unknown): unknown }): SoundEventBus {
  const existing = registry.get("soundEventBus");
  if (existing instanceof SoundEventBus) return existing;
  const bus = new SoundEventBus();
  registry.set("soundEventBus", bus);
  return bus;
}

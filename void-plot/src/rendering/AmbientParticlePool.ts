import type { GameObjects, Scene } from "phaser";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";

export type AmbientParticleKind = "home" | "farm" | "forest" | "power" | "lab" | "water" | "beacon";
interface Source { readonly x: number; readonly y: number; readonly kind: AmbientParticleKind; }
interface Particle { readonly view: GameObjects.Rectangle; active: boolean; life: number; vx: number; vy: number; }

export class AmbientParticlePool {
  private readonly sources: Source[] = [];
  private readonly particles: readonly Particle[];
  private accumulated = 0;
  private sourceIndex = 0;
  private enabled = true;
  public constructor(scene: Scene, capacity = 28) {
    this.particles = Array.from({ length: capacity }, () => ({ view: scene.add.rectangle(0, 0, 2, 2, THEME_COLORS.accent).setDepth(RENDER_DEPTHS.productionPopup - 1).setVisible(false), active: false, life: 0, vx: 0, vy: 0 }));
  }
  public addSource(x: number, y: number, kind: AmbientParticleKind): void { this.sources.push({ x, y, kind }); }
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) for (const particle of this.particles) particle.view.setVisible(false);
  }
  public destroy(): void {
    for (const particle of this.particles) particle.view.destroy();
    this.sources.length = 0;
  }
  public update(delta: number): void {
    if (!this.enabled) return;
    this.accumulated += delta;
    if (this.sources.length > 0 && this.accumulated >= 420) { this.accumulated %= 420; this.spawn(this.sources[this.sourceIndex++ % this.sources.length]); }
    for (const particle of this.particles) {
      if (!particle.active) continue;
      particle.life -= delta;
      if (particle.life <= 0) { particle.active = false; particle.view.setVisible(false); continue; }
      particle.view.x += particle.vx * delta;
      particle.view.y += particle.vy * delta;
      particle.view.setAlpha(Math.min(1, particle.life / 350));
    }
  }
  private spawn(source: Source): void {
    const particle = this.particles.find((candidate) => !candidate.active);
    if (particle === undefined) return;
    const colors = { home: 0xaab2ad, farm: THEME_COLORS.farmActive, forest: THEME_COLORS.forestTrunk, power: THEME_COLORS.powerCoil, lab: THEME_COLORS.labActive, water: 0x56b4e9, beacon: THEME_COLORS.beaconGlow };
    particle.active = true; particle.life = source.kind === "beacon" ? 1_300 : 850;
    particle.vx = source.kind === "power" || source.kind === "water" ? 0.012 : (this.sourceIndex % 3 - 1) * 0.006;
    particle.vy = source.kind === "water" ? 0 : source.kind === "forest" ? 0.008 : source.kind === "home" ? -0.008 : -0.014;
    particle.view.setPosition(source.x, source.y).setFillStyle(colors[source.kind]).setScale(source.kind === "beacon" ? 1.7 : 1).setAlpha(1).setVisible(true);
  }
}

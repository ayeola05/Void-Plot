import type { GameObjects, Scene } from "phaser";
import { BuildingVisualFoundation, getBuildingVisualVariation, type WorldBuildingVisualMode } from "./BuildingVisualFoundation";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";
export type PowerPlantVisualMode = WorldBuildingVisualMode;
export interface PowerPlantVisualMetrics { readonly tileSize: number; readonly footprint: number; readonly bodyWidth: number; readonly bodyHeight: number; readonly turbineRadius: number; }
export function getPowerPlantVisualMetrics(tileSize: number): PowerPlantVisualMetrics { const footprint = tileSize - 2; return { tileSize, footprint, bodyWidth: footprint * 0.72, bodyHeight: footprint * 0.56, turbineRadius: Math.max(3, Math.floor(footprint * 0.22)) }; }

export class PowerPlantVisual {
  public readonly container: GameObjects.Container;
  private readonly foundation: BuildingVisualFoundation; private readonly bodySide: GameObjects.Polygon; private readonly body: GameObjects.Rectangle; private readonly top: GameObjects.Polygon;
  private readonly tower: GameObjects.Rectangle; private readonly exhaust: GameObjects.Rectangle; private readonly transformer: GameObjects.Rectangle; private readonly pipes: readonly GameObjects.Rectangle[]; private readonly cables: readonly GameObjects.Rectangle[];
  private readonly turbine: GameObjects.Arc; private readonly core: GameObjects.Arc; private readonly rotor: readonly GameObjects.Rectangle[]; private readonly warningStripes: readonly GameObjects.Rectangle[]; private readonly indicator: GameObjects.Arc; private readonly crosses: readonly GameObjects.Rectangle[];
  private staffed = false; private mode: PowerPlantVisualMode = "placed";
  public constructor(scene: Scene, tileSize: number, mode: PowerPlantVisualMode = "placed", variationSeed: string | number = 0) {
    const m = getPowerPlantVisualMetrics(tileSize); this.foundation = new BuildingVisualFoundation(scene, tileSize);
    this.cables = [-1, 1].map((direction) => scene.add.rectangle(direction * 5, 6, 10, 1.5, THEME_COLORS.structureCable).setRotation(direction * 0.42));
    this.bodySide = scene.add.polygon(0, 0, [m.bodyWidth / 2 - 2, -4, m.bodyWidth / 2 + 2, -6, m.bodyWidth / 2 + 2, 5, m.bodyWidth / 2 - 2, 6], THEME_COLORS.structureMetalDark);
    this.body = scene.add.rectangle(-1, 0, m.bodyWidth, m.bodyHeight, THEME_COLORS.powerBody).setStrokeStyle(1, THEME_COLORS.powerFrame);
    this.top = scene.add.polygon(-1, -5, [-m.bodyWidth / 2, 2, -m.bodyWidth / 2 + 3, -2, m.bodyWidth / 2 + 1, -2, m.bodyWidth / 2 - 2, 2], THEME_COLORS.structureMetalLight);
    this.tower = scene.add.rectangle(3, -9, 5, 14, THEME_COLORS.structureMetalMid).setStrokeStyle(1, THEME_COLORS.powerFrame);
    this.exhaust = scene.add.rectangle(5, -15, 2.5, 8, THEME_COLORS.structureMetalDark).setStrokeStyle(1, THEME_COLORS.structureRimLight, 0.5);
    this.transformer = scene.add.rectangle(-7, 3, 5, 7, THEME_COLORS.structureMetalDark).setStrokeStyle(1, THEME_COLORS.powerCoil, 0.55);
    this.pipes = [scene.add.rectangle(-6, -2, 8, 1.5, 0x687276), scene.add.rectangle(-9, 1, 1.5, 7, 0x687276)];
    this.turbine = scene.add.circle(-1, 0, m.turbineRadius, THEME_COLORS.powerFrame).setStrokeStyle(1.5, THEME_COLORS.powerCoil, 0.9);
    this.core = scene.add.circle(-1, 0, 2, THEME_COLORS.powerCore);
    this.rotor = [0, Math.PI / 2].map((rotation) => scene.add.rectangle(-1, 0, m.turbineRadius * 2 - 1, 1, THEME_COLORS.powerCoil).setRotation(rotation));
    this.warningStripes = [-3, 0, 3].map((x) => scene.add.rectangle(x, 5, 2, 1, THEME_COLORS.structureWarningStripe).setRotation(-0.35));
    this.indicator = scene.add.circle(7, -7, 1.7, THEME_COLORS.powerActive).setVisible(false);
    this.crosses = [Math.PI / 4, -Math.PI / 4].map((rotation) => scene.add.rectangle(0, -1, m.footprint - 2, 2, THEME_COLORS.invalid).setRotation(rotation).setVisible(false));
    this.container = scene.add.container(0, 0, [...this.foundation.objects, ...this.cables, this.bodySide, this.body, this.top, this.transformer, ...this.pipes, this.tower, this.exhaust, this.turbine, ...this.rotor, this.core, ...this.warningStripes, this.indicator, ...this.crosses]).setDepth(RENDER_DEPTHS.building);
    this.foundation.finalize(this.container);
    this.setVariation(variationSeed).setMode(mode);
  }
  public setVariation(seed: string | number): this { const mirror = getBuildingVisualVariation(seed) & 1 ? -1 : 1; this.tower.setX(3 * mirror); this.exhaust.setX(5 * mirror); this.transformer.setX(-7 * mirror); this.pipes[0].setX(-6 * mirror); this.pipes[1].setX(-9 * mirror); return this; }
  public setMode(mode: PowerPlantVisualMode): this { this.mode = mode; this.foundation.setMode(mode); this.container.setAlpha(mode === "placed" ? 1 : 0.78); this.crosses.forEach((cross) => cross.setVisible(mode === "invalid-preview")); this.refresh(); return this; }
  public setSelected(selected: boolean): this { this.foundation.setSelected(this.mode === "placed" && selected); return this; }
  public setStaffed(staffed: boolean): this { this.staffed = staffed; this.refresh(); return this; }
  public updateActivity(time: number, reducedMotion = false): this { if (this.staffed) { const phase = reducedMotion ? 0 : time / 520; this.rotor.forEach((rotor, index) => rotor.setRotation(index * Math.PI / 2 + phase)); this.core.setAlpha(reducedMotion ? 0.82 : 0.62 + Math.sin(time / 230) * 0.28); this.indicator.setAlpha(reducedMotion ? 0.78 : 0.55 + Math.sin(time / 420) * 0.22); } return this; }
  public setPosition(x: number, y: number): this { this.container.setPosition(x, y); return this; } public setVisible(v: boolean): this { this.container.setVisible(v); return this; } public setDepth(d: number): this { this.container.setDepth(d); return this; } public destroy(): void { this.container.destroy(true); }
  private refresh(): void { const active = this.mode === "placed" && this.staffed; this.indicator.setVisible(active); this.core.setAlpha(active ? 0.9 : 0.2); this.rotor.forEach((rotor) => rotor.setAlpha(active ? 0.9 : 0.28)); }
}
export function validatePowerPlantVisualFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } { const m = getPowerPlantVisualMetrics(20); const valid = m.footprint === 18 && m.bodyWidth >= 12 && m.turbineRadius * 2 <= m.bodyWidth; return { valid, errors: valid ? Object.freeze([]) : Object.freeze(["Power Plant industrial silhouette must remain anchored inside one tile."]) }; }

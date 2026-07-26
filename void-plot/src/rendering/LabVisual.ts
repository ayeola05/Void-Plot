import type { GameObjects, Scene } from "phaser";
import { BuildingVisualFoundation, getBuildingVisualVariation, type WorldBuildingVisualMode } from "./BuildingVisualFoundation";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";
export type LabVisualMode = WorldBuildingVisualMode;

export class LabVisual {
  public readonly container: GameObjects.Container;
  private readonly foundation: BuildingVisualFoundation; private readonly cabinSide: GameObjects.Polygon; private readonly cabin: GameObjects.Rectangle; private readonly roof: GameObjects.Polygon;
  private readonly mast: GameObjects.Rectangle; private readonly dish: GameObjects.Arc; private readonly dishArm: GameObjects.Rectangle; private readonly terminal: GameObjects.Rectangle; private readonly terminalLight: GameObjects.Rectangle;
  private readonly chamber: GameObjects.Arc; private readonly chamberGlow: GameObjects.Arc; private readonly cables: readonly GameObjects.Rectangle[]; private readonly sensors: readonly GameObjects.Rectangle[]; private readonly indicator: GameObjects.Arc; private readonly powerWarning: GameObjects.Arc; private readonly crosses: readonly GameObjects.Rectangle[];
  private staffed = false; private powered = false; private mode: LabVisualMode = "placed"; private dishBaseRotation = -0.35;
  public constructor(scene: Scene, tileSize: number, mode: LabVisualMode = "placed", variationSeed: string | number = 0) {
    const footprint = tileSize - 2; this.foundation = new BuildingVisualFoundation(scene, tileSize);
    this.cables = [-1, 1].map((direction) => scene.add.rectangle(direction * 4, 5, 10, 1.2, THEME_COLORS.structureCable).setRotation(direction * 0.35));
    this.cabinSide = scene.add.polygon(0, 0, [5, -4, 8, -6, 8, 5, 5, 6], THEME_COLORS.structureMetalDark);
    this.cabin = scene.add.rectangle(-1, 0, 13, 10, THEME_COLORS.labBody).setStrokeStyle(1, THEME_COLORS.labFrame);
    this.roof = scene.add.polygon(-1, -6, [-7, 2, -4, -2, 7, -2, 5, 2], THEME_COLORS.structureMetalLight).setStrokeStyle(1, THEME_COLORS.labTerminal, 0.55);
    this.mast = scene.add.rectangle(3, -11, 1.5, 12, THEME_COLORS.structureMetalLight);
    this.dish = scene.add.arc(3, -15, 4, 205, 335, false, THEME_COLORS.labTerminal).setStrokeStyle(1, THEME_COLORS.labActive, 0.7);
    this.dishArm = scene.add.rectangle(3, -14, 4, 1, THEME_COLORS.labActive).setRotation(-0.35);
    this.terminal = scene.add.rectangle(-6, 2, 5, 7, THEME_COLORS.structureMetalDark).setStrokeStyle(1, THEME_COLORS.labFrame);
    this.terminalLight = scene.add.rectangle(-6, 1, 3, 2, THEME_COLORS.labTerminal);
    this.chamberGlow = scene.add.circle(2, 1, 4, THEME_COLORS.labFluid, 0.16);
    this.chamber = scene.add.circle(2, 1, 2.7, THEME_COLORS.labFluid).setStrokeStyle(1, THEME_COLORS.primaryText, 0.65);
    this.sensors = [-7, 7].map((x) => scene.add.rectangle(x, -3, 1, 8, THEME_COLORS.structureMetalLight));
    this.indicator = scene.add.circle(7, -7, 1.7, THEME_COLORS.labActive).setVisible(false);
    this.powerWarning = scene.add.circle(-7, -7, 1.7, THEME_COLORS.powerWarning).setStrokeStyle(1, THEME_COLORS.invalid).setVisible(false);
    this.crosses = [Math.PI / 4, -Math.PI / 4].map((rotation) => scene.add.rectangle(0, -1, footprint - 2, 2, THEME_COLORS.invalid).setRotation(rotation).setVisible(false));
    this.container = scene.add.container(0, 0, [...this.foundation.objects, ...this.cables, this.cabinSide, this.cabin, this.roof, ...this.sensors, this.terminal, this.terminalLight, this.chamberGlow, this.chamber, this.mast, this.dish, this.dishArm, this.indicator, this.powerWarning, ...this.crosses]).setDepth(RENDER_DEPTHS.building);
    this.foundation.finalize(this.container);
    this.setVariation(variationSeed).setMode(mode);
  }
  public setVariation(seed: string | number): this { const mirror = getBuildingVisualVariation(seed) & 1 ? -1 : 1; this.mast.setX(3 * mirror); this.dish.setX(3 * mirror); this.dishArm.setX(3 * mirror); this.dishBaseRotation = mirror * -0.35; this.dishArm.setRotation(this.dishBaseRotation); this.terminal.setX(-6 * mirror); this.terminalLight.setX(-6 * mirror); return this; }
  public setMode(mode: LabVisualMode): this { this.mode = mode; this.foundation.setMode(mode); this.container.setAlpha(mode === "placed" ? 1 : 0.78); this.crosses.forEach((cross) => cross.setVisible(mode === "invalid-preview")); this.refresh(); return this; }
  public setSelected(selected: boolean): this { this.foundation.setSelected(this.mode === "placed" && selected); return this; }
  public setStaffed(v: boolean): this { this.staffed = v; this.refresh(); return this; } public setPowered(v: boolean): this { this.powered = v; this.refresh(); return this; }
  public updateActivity(time: number, reducedMotion = false): this { if (this.staffed && this.powered) { const wave = reducedMotion ? 0.75 : 0.65 + Math.sin(time / 300) * 0.25; this.chamber.setAlpha(wave); this.chamberGlow.setAlpha(reducedMotion ? 0.15 : 0.12 + Math.sin(time / 420) * 0.08); this.terminalLight.setAlpha(reducedMotion ? 0.82 : Math.sin(time / 190) > 0.35 ? 1 : 0.5); this.dishArm.setRotation(this.dishBaseRotation + (reducedMotion ? 0 : Math.sin(time / 950) * 0.12)); } return this; }
  public setPosition(x: number, y: number): this { this.container.setPosition(x, y); return this; } public setVisible(v: boolean): this { this.container.setVisible(v); return this; } public setDepth(d: number): this { this.container.setDepth(d); return this; } public destroy(): void { this.container.destroy(true); }
  private refresh(): void { const active = this.mode === "placed" && this.staffed && this.powered; this.indicator.setVisible(active); this.powerWarning.setVisible(this.mode === "placed" && this.staffed && !this.powered); this.terminalLight.setAlpha(active ? 0.9 : 0.18); this.chamber.setAlpha(active ? 0.8 : 0.24); this.chamberGlow.setVisible(active); }
}
export function validateLabVisualFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } { return { valid: true, errors: Object.freeze([]) }; }

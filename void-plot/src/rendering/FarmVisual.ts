import type { GameObjects, Scene } from "phaser";
import { BuildingVisualFoundation, getBuildingVisualVariation, type WorldBuildingVisualMode } from "./BuildingVisualFoundation";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";
export type FarmVisualMode = WorldBuildingVisualMode;
export const FARM_PERSISTENT_ACTIVITY_OBJECT_COUNT = 4;
export const FARM_FIELD_ROW_COUNT = 4;
export interface FarmVisualMetrics { readonly tileSize: number; readonly footprint: number; readonly rowWidth: number; readonly rowHeight: number; readonly progressWidth: number; }
export function getFarmVisualMetrics(tileSize: number): FarmVisualMetrics { const footprint = tileSize - 2; return { tileSize, footprint, rowWidth: footprint - 3, rowHeight: 2, progressWidth: footprint - 4 }; }

export class FarmVisual {
  public readonly container: GameObjects.Container;
  private readonly foundation: BuildingVisualFoundation;
  private readonly bed: GameObjects.Rectangle;
  private readonly furrows: readonly GameObjects.Rectangle[];
  private readonly crops: readonly GameObjects.Triangle[];
  private readonly cropBaseX: readonly number[]; private readonly cropBaseY: readonly number[];
  private readonly irrigation: readonly GameObjects.Rectangle[];
  private readonly stakes: readonly GameObjects.Rectangle[];
  private readonly barrel: GameObjects.Arc;
  private readonly storage: GameObjects.Rectangle;
  private readonly indicator: GameObjects.Arc;
  private readonly powerWarning: GameObjects.Arc;
  private readonly progressTrack: GameObjects.Rectangle;
  private readonly progressFill: GameObjects.Rectangle;
  private readonly crosses: readonly GameObjects.Rectangle[];
  private readonly progressWidth: number;
  private staffed = false; private powered = true; private mode: FarmVisualMode = "placed";
  public constructor(scene: Scene, tileSize: number, mode: FarmVisualMode = "placed", variationSeed: string | number = 0) {
    const m = getFarmVisualMetrics(tileSize); this.progressWidth = m.progressWidth; this.foundation = new BuildingVisualFoundation(scene, tileSize);
    this.bed = scene.add.rectangle(0, 1, m.footprint, m.footprint - 3, THEME_COLORS.farmSoil).setStrokeStyle(1, THEME_COLORS.farmBorder, 0.95);
    const rowY = [-5, -1.5, 2, 5.5];
    this.furrows = rowY.map((y, index) => scene.add.rectangle(0, y, m.rowWidth, m.rowHeight, index % 2 ? 0x71583a : THEME_COLORS.farmRows).setStrokeStyle(1, THEME_COLORS.farmBorder, 0.35));
    const cropData = rowY.flatMap((y, row) => [-5, 0, 5].map((x) => ({ x, y, row })));
    this.cropBaseX = Object.freeze(cropData.map(({ x }) => x));
    this.cropBaseY = Object.freeze(cropData.map(({ y }) => y - 1));
    this.crops = cropData.map(({ x, y, row }) => scene.add.triangle(x, y - 1, -2, 2, 0, -3, 2, 2, row % 2 ? 0x81925e : THEME_COLORS.farmActive));
    this.irrigation = [scene.add.rectangle(0, -7, m.rowWidth, 1, 0x627b7d), scene.add.rectangle(-7, 0, 1, 14, 0x4b6062)];
    this.stakes = [[-8, -7], [8, -7], [-8, 7], [8, 7]].map(([x, y]) => scene.add.rectangle(x, y, 1.5, 4, THEME_COLORS.structureMetalLight));
    this.barrel = scene.add.circle(7, 5, 2.5, 0x4c686a).setStrokeStyle(1, THEME_COLORS.structureRimLight, 0.45);
    this.storage = scene.add.rectangle(-6, 6, 4, 3, THEME_COLORS.forestTrunk).setStrokeStyle(1, THEME_COLORS.structureDeepEdge);
    this.indicator = scene.add.circle(7, -7, 1.7, THEME_COLORS.farmActive).setVisible(false);
    this.powerWarning = scene.add.circle(-7, -7, 1.7, THEME_COLORS.powerWarning).setStrokeStyle(1, THEME_COLORS.invalid).setVisible(false);
    this.progressTrack = scene.add.rectangle(-m.progressWidth / 2, 8, m.progressWidth, 1.5, THEME_COLORS.farmProgressTrack).setOrigin(0, 0.5).setVisible(false);
    this.progressFill = scene.add.rectangle(-m.progressWidth / 2, 8, 0, 1.5, THEME_COLORS.farmProgressFill).setOrigin(0, 0.5).setVisible(false);
    this.crosses = [Math.PI / 4, -Math.PI / 4].map((rotation) => scene.add.rectangle(0, 0, m.footprint - 2, 2, THEME_COLORS.invalid).setRotation(rotation).setVisible(false));
    this.container = scene.add.container(0, 0, [...this.foundation.objects, this.bed, ...this.furrows, ...this.irrigation, ...this.crops, ...this.stakes, this.barrel, this.storage, this.indicator, this.powerWarning, this.progressTrack, this.progressFill, ...this.crosses]).setDepth(RENDER_DEPTHS.building);
    this.foundation.finalize(this.container);
    this.setVariation(variationSeed).setMode(mode);
  }
  public setVariation(seed: string | number): this { const hash = getBuildingVisualVariation(seed); const side = (hash & 1) ? 1 : -1; this.barrel.setX(7 * side); this.storage.setX(-6 * side); this.irrigation[1].setX(-7 * side); this.furrows.forEach((row, index) => row.setY([-5, -1.5, 2, 5.5][index] + (((hash >>> (index * 2 + 2)) & 1) ? 0.35 : -0.35))); this.crops.forEach((crop, index) => crop.setY(this.cropBaseY[index] + (((hash >>> (Math.floor(index / 3) + 10)) & 1) ? 0.35 : -0.35))); return this; }
  public setMode(mode: FarmVisualMode): this { this.mode = mode; this.foundation.setMode(mode); this.container.setAlpha(mode === "placed" ? 1 : 0.78); this.crosses.forEach((cross) => cross.setVisible(mode === "invalid-preview")); this.refresh(); return this; }
  public setSelected(selected: boolean): this { this.foundation.setSelected(this.mode === "placed" && selected); return this; }
  public setStaffed(staffed: boolean): this { this.staffed = staffed; this.refresh(); return this; }
  public setPowered(powered: boolean): this { this.powered = powered; this.refresh(); return this; }
  public setProductionProgress(progress: number): this { const value = Math.max(0, Math.min(1, progress)); this.progressFill.setSize(this.progressWidth * value, 1.5); this.refresh(); return this; }
  public updateProductionIndicator(time: number, reducedMotion = false): this { if (this.staffed && this.powered) { const breeze = reducedMotion ? 0 : Math.sin(time / 650 + this.container.x) * 0.45; this.crops.forEach((crop, index) => crop.setX(this.cropBaseX[index] + breeze * (index % 2 ? 1 : -1)).setAlpha(0.9)); this.indicator.setAlpha(reducedMotion ? 0.8 : 0.55 + Math.sin(time / 350) * 0.25); } return this; }
  public setPosition(x: number, y: number): this { this.container.setPosition(x, y); return this; } public setVisible(v: boolean): this { this.container.setVisible(v); return this; } public setDepth(d: number): this { this.container.setDepth(d); return this; } public destroy(): void { this.container.destroy(true); }
  private refresh(): void { const active = this.mode === "placed" && this.staffed; this.crops.forEach((crop) => crop.setAlpha(this.staffed ? (this.powered ? 0.95 : 0.58) : 0.38)); this.irrigation.forEach((pipe) => pipe.setAlpha(active && this.powered ? 0.9 : 0.35)); this.indicator.setVisible(active && this.powered); this.powerWarning.setVisible(active && !this.powered); this.progressTrack.setVisible(active); this.progressFill.setVisible(active && this.progressFill.width > 0); }
}
export function validateFarmVisualFoundation(): { valid: boolean; errors: string[] } { const m = getFarmVisualMetrics(20); const errors: string[] = []; if (m.footprint !== 18 || m.rowWidth < 14 || FARM_FIELD_ROW_COUNT !== 4) errors.push("Farm must fill one tile with four distinct crop rows."); return { valid: errors.length === 0, errors }; }

import type { GameObjects, Scene } from "phaser";
import { BuildingVisualFoundation, getBuildingVisualVariation, type WorldBuildingVisualMode } from "./BuildingVisualFoundation";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";
export type ForestVisualMode = WorldBuildingVisualMode;
export const FOREST_CANOPY_COUNT = 8;
export const FOREST_PERSISTENT_ACTIVITY_OBJECT_COUNT = 4;
export interface ForestVisualMetrics { readonly tileSize: number; readonly footprint: number; readonly canopyRadius: number; readonly progressWidth: number; }
export function getForestVisualMetrics(tileSize: number): ForestVisualMetrics { const footprint = tileSize - 2; return { tileSize, footprint, canopyRadius: Math.max(2, Math.floor(footprint * 0.2)), progressWidth: footprint - 4 }; }
const FOREST_TREE_POSITIONS = [[-6, 1], [-2, -4], [3, -2], [6, 3]] as const;

export class ForestVisual {
  public readonly container: GameObjects.Container;
  private readonly foundation: BuildingVisualFoundation;
  private readonly soil: GameObjects.Ellipse; private readonly path: GameObjects.Rectangle;
  private readonly treeShadows: readonly GameObjects.Ellipse[]; private readonly trunks: readonly GameObjects.Rectangle[]; private readonly canopies: readonly GameObjects.Ellipse[];
  private readonly baseTreeX: number[] = []; private readonly logs: readonly GameObjects.Rectangle[]; private readonly stump: GameObjects.Arc;
  private readonly workLight: GameObjects.Arc; private readonly powerWarning: GameObjects.Arc; private readonly progressTrack: GameObjects.Rectangle; private readonly progressFill: GameObjects.Rectangle; private readonly crosses: readonly GameObjects.Rectangle[];
  private readonly progressWidth: number; private staffed = false; private powered = true; private mode: ForestVisualMode = "placed";
  public constructor(scene: Scene, tileSize: number, mode: ForestVisualMode = "placed", variationSeed: string | number = 0) {
    const m = getForestVisualMetrics(tileSize); this.progressWidth = m.progressWidth; this.foundation = new BuildingVisualFoundation(scene, tileSize);
    this.soil = scene.add.ellipse(0, 1, m.footprint, m.footprint - 3, THEME_COLORS.forestGround, 0.95);
    this.path = scene.add.rectangle(2, 3, 13, 2.5, 0x645845, 0.75).setRotation(-0.38);
    this.treeShadows = FOREST_TREE_POSITIONS.map(([x, y]) => scene.add.ellipse(x + 1.5, y + 4, 7, 3, 0x080c0a, 0.45));
    this.trunks = FOREST_TREE_POSITIONS.map(([x, y], index) => scene.add.rectangle(x, y + 2, index % 2 ? 2 : 2.5, 7 + (index % 2), THEME_COLORS.forestTrunk).setStrokeStyle(1, THEME_COLORS.structureDeepEdge, 0.6));
    this.canopies = FOREST_TREE_POSITIONS.flatMap(([x, y], index) => { this.baseTreeX.push(x, x + (index % 2 ? 1.5 : -1)); return [scene.add.ellipse(x, y - 3 - (index % 2), 8, 7, index % 2 ? THEME_COLORS.forestCanopyLight : THEME_COLORS.forestCanopyDark), scene.add.ellipse(x + (index % 2 ? 1.5 : -1), y - 5 - (index % 2), 5, 5, index % 2 ? 0x67815b : 0x416047)]; });
    this.logs = [-1, 1, 3].map((offset) => scene.add.rectangle(-5 + offset, 6 + offset * 0.4, 6, 1.8, THEME_COLORS.forestTrunk).setRotation(0.08));
    this.stump = scene.add.circle(6, 6, 2, 0x7b6246).setStrokeStyle(1, THEME_COLORS.structureDeepEdge);
    this.workLight = scene.add.circle(7, -7, 1.7, THEME_COLORS.forestActive).setVisible(false);
    this.powerWarning = scene.add.circle(-7, -7, 1.7, THEME_COLORS.powerWarning).setStrokeStyle(1, THEME_COLORS.invalid).setVisible(false);
    this.progressTrack = scene.add.rectangle(-m.progressWidth / 2, 8, m.progressWidth, 1.5, THEME_COLORS.forestProgressTrack).setOrigin(0, 0.5).setVisible(false);
    this.progressFill = scene.add.rectangle(-m.progressWidth / 2, 8, 0, 1.5, THEME_COLORS.forestProgressFill).setOrigin(0, 0.5).setVisible(false);
    this.crosses = [Math.PI / 4, -Math.PI / 4].map((rotation) => scene.add.rectangle(0, 0, m.footprint - 2, 2, THEME_COLORS.invalid).setRotation(rotation).setVisible(false));
    this.container = scene.add.container(0, 0, [...this.foundation.objects, this.soil, this.path, ...this.treeShadows, ...this.trunks, ...this.canopies, ...this.logs, this.stump, this.workLight, this.powerWarning, this.progressTrack, this.progressFill, ...this.crosses]).setDepth(RENDER_DEPTHS.building);
    this.foundation.finalize(this.container);
    this.setVariation(variationSeed).setMode(mode);
  }
  public setVariation(seed: string | number): this { const hash = getBuildingVisualVariation(seed); const mirror = hash & 1 ? -1 : 1; this.path.setRotation(mirror * 0.38); this.logs.forEach((log, index) => log.setX(mirror * (-4 + index)).setRotation(mirror * 0.08)); this.stump.setX(mirror * 6); FOREST_TREE_POSITIONS.forEach(([baseX, baseY], index) => { const dx = ((hash >>> (index * 3 + 2)) % 3) - 1; const dy = ((hash >>> (index * 3 + 4)) & 1) ? 0.5 : -0.5; const height = 6 + ((hash >>> (index * 2 + 16)) % 3); this.trunks[index].setPosition(baseX + dx, baseY + 2 + dy).setSize(index % 2 ? 2 : 2.5, height); this.treeShadows[index].setPosition(baseX + dx + 1.5, baseY + 4 + dy); const first = index * 2; const second = first + 1; this.baseTreeX[first] = baseX + dx; this.baseTreeX[second] = baseX + dx + (index % 2 ? 1.5 : -1); this.canopies[first].setPosition(this.baseTreeX[first], baseY - 3 - (index % 2) + dy); this.canopies[second].setPosition(this.baseTreeX[second], baseY - 5 - (index % 2) + dy); }); return this; }
  public setMode(mode: ForestVisualMode): this { this.mode = mode; this.foundation.setMode(mode); this.container.setAlpha(mode === "placed" ? 1 : 0.78); this.crosses.forEach((cross) => cross.setVisible(mode === "invalid-preview")); this.refresh(); return this; }
  public setSelected(selected: boolean): this { this.foundation.setSelected(this.mode === "placed" && selected); return this; }
  public setStaffed(v: boolean): this { this.staffed = v; this.refresh(); return this; } public setPowered(v: boolean): this { this.powered = v; this.refresh(); return this; }
  public setProductionProgress(p: number): this { const value = Math.max(0, Math.min(1, p)); this.progressFill.setSize(this.progressWidth * value, 1.5); this.refresh(); return this; }
  public updateProductionIndicator(time: number, reducedMotion = false): this { if (this.staffed && this.powered) { const sway = reducedMotion ? 0 : Math.sin(time / 720 + this.container.y) * 0.4; this.canopies.forEach((canopy, index) => canopy.setX(this.baseTreeX[index] + sway * ((index % 2) ? -1 : 1))); this.workLight.setAlpha(reducedMotion ? 0.78 : 0.55 + Math.sin(time / 420) * 0.2); } return this; }
  public setPosition(x: number, y: number): this { this.container.setPosition(x, y); return this; } public setVisible(v: boolean): this { this.container.setVisible(v); return this; } public setDepth(d: number): this { this.container.setDepth(d); return this; } public destroy(): void { this.container.destroy(true); }
  private refresh(): void { const active = this.mode === "placed" && this.staffed; this.workLight.setVisible(active && this.powered); this.powerWarning.setVisible(active && !this.powered); this.progressTrack.setVisible(active); this.progressFill.setVisible(active && this.progressFill.width > 0); this.canopies.forEach((c) => c.setAlpha(this.staffed ? (this.powered ? 0.96 : 0.68) : 0.78)); }
}
export function validateForestVisualFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } { const m = getForestVisualMetrics(20); const valid = m.footprint === 18 && FOREST_CANOPY_COUNT === 8; return { valid, errors: valid ? Object.freeze([]) : Object.freeze(["Forest must use four layered trees inside one tile."]) }; }

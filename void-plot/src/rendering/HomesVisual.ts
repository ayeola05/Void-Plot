import type { GameObjects, Scene } from "phaser";
import { BuildingVisualFoundation, getBuildingVisualVariation, type WorldBuildingVisualMode } from "./BuildingVisualFoundation";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";

export type HomesVisualMode = WorldBuildingVisualMode;
export interface HomesVisualMetrics { readonly tileSize: number; readonly footprint: number; readonly bodyWidth: number; readonly bodyHeight: number; }
export interface HomesVisualValidationResult { readonly valid: boolean; readonly errors: string[]; }
export function getHomesVisualMetrics(tileSize: number): HomesVisualMetrics { const footprint = tileSize - 2; return { tileSize, footprint, bodyWidth: footprint * 0.78, bodyHeight: footprint * 0.5 }; }

export class HomesVisual {
  public readonly container: GameObjects.Container;
  private readonly foundation: BuildingVisualFoundation;
  private readonly bodySide: GameObjects.Polygon;
  private readonly body: GameObjects.Rectangle;
  private readonly roof: GameObjects.Polygon;
  private readonly roofPanel: GameObjects.Rectangle;
  private readonly door: GameObjects.Rectangle;
  private readonly windows: readonly GameObjects.Rectangle[];
  private readonly chimney: GameObjects.Rectangle;
  private readonly vent: GameObjects.Arc;
  private readonly crate: GameObjects.Rectangle;
  private readonly pipe: GameObjects.Rectangle;
  private readonly crosses: readonly GameObjects.Rectangle[];
  private mode: HomesVisualMode = "placed";

  public constructor(scene: Scene, tileSize: number, mode: HomesVisualMode = "placed", variationSeed: string | number = 0) {
    const m = getHomesVisualMetrics(tileSize);
    this.foundation = new BuildingVisualFoundation(scene, tileSize);
    this.bodySide = scene.add.polygon(0, 0, [m.bodyWidth / 2 - 3, -4, m.bodyWidth / 2 + 2, -6, m.bodyWidth / 2 + 2, 4, m.bodyWidth / 2 - 3, 6], THEME_COLORS.structureMetalDark);
    this.body = scene.add.rectangle(-1, 0, m.bodyWidth, m.bodyHeight, THEME_COLORS.homeBody).setStrokeStyle(1, THEME_COLORS.homeTrim, 0.95);
    this.roof = scene.add.polygon(-1, -5, [-m.bodyWidth / 2 - 1, 2, -m.bodyWidth / 2 + 3, -3, m.bodyWidth / 2 + 1, -3, m.bodyWidth / 2 - 2, 2], THEME_COLORS.homeRoof).setStrokeStyle(1, THEME_COLORS.structureRimLight, 0.55);
    this.roofPanel = scene.add.rectangle(0, -6, Math.max(4, m.bodyWidth * 0.35), 2, THEME_COLORS.structureMetalMid).setRotation(-0.08);
    this.door = scene.add.rectangle(-3, 2, 3, 6, THEME_COLORS.homeTrim).setStrokeStyle(1, THEME_COLORS.structureMetalLight, 0.45);
    this.windows = [-1, 1].map(() => scene.add.rectangle(3, 0, 3, 2.5, THEME_COLORS.homeWindow).setStrokeStyle(1, THEME_COLORS.homeTrim, 0.9));
    this.chimney = scene.add.rectangle(5, -9, 2.2, 7, THEME_COLORS.structureMetalDark).setStrokeStyle(1, THEME_COLORS.structureMetalLight, 0.6);
    this.vent = scene.add.circle(5, -12, 1.4, THEME_COLORS.structureMetalLight);
    this.crate = scene.add.rectangle(-7, 5, 4, 3, THEME_COLORS.forestTrunk).setStrokeStyle(1, THEME_COLORS.structureDeepEdge);
    this.pipe = scene.add.rectangle(7, 4, 5, 1.5, THEME_COLORS.structureMetalLight).setRotation(Math.PI / 2);
    this.crosses = [Math.PI / 4, -Math.PI / 4].map((rotation) => scene.add.rectangle(0, -1, m.footprint - 2, 2, THEME_COLORS.invalid).setRotation(rotation).setVisible(false));
    this.container = scene.add.container(0, 0, [...this.foundation.objects, this.bodySide, this.body, this.roof, this.roofPanel, this.door, ...this.windows, this.chimney, this.vent, this.crate, this.pipe, ...this.crosses]).setDepth(RENDER_DEPTHS.building);
    this.foundation.finalize(this.container);
    this.setVariation(variationSeed).setMode(mode);
  }
  public setVariation(seed: string | number): this { const hash = getBuildingVisualVariation(seed); const right = (hash & 1) === 0; this.chimney.setX(right ? 5 : -6); this.vent.setX(right ? 5 : -6); this.crate.setX(right ? -7 : 7); this.pipe.setX(right ? 7 : -7); this.roofPanel.setX(((hash >>> 3) % 5) - 2); this.windows[0].setPosition(right ? 3 : -1, 0); this.windows[1].setPosition(right ? 0 : 3, 0); return this; }
  public setMode(mode: HomesVisualMode): this { this.mode = mode; this.foundation.setMode(mode); this.container.setAlpha(mode === "placed" ? 1 : 0.78); this.crosses.forEach((cross) => cross.setVisible(mode === "invalid-preview")); return this; }
  public setSelected(selected: boolean): this { this.foundation.setSelected(this.mode === "placed" && selected); return this; }
  public setOccupied(occupied: boolean): this { this.windows.forEach((window) => window.setAlpha(occupied ? 0.9 : 0.32)); return this; }
  public updateActivity(time: number, reducedMotion = false): this { if (this.mode === "placed") this.windows.forEach((window, index) => window.setAlpha(reducedMotion ? 0.82 : 0.72 + Math.sin(time / 760 + index * 1.7 + this.container.x) * 0.18)); return this; }
  public setPosition(x: number, y: number): this { this.container.setPosition(x, y); return this; }
  public setVisible(visible: boolean): this { this.container.setVisible(visible); return this; }
  public setDepth(depth: number): this { this.container.setDepth(depth); return this; }
  public destroy(): void { this.container.destroy(true); }
}

export function validateHomesVisualFoundation(): HomesVisualValidationResult { const m = getHomesVisualMetrics(20); const errors: string[] = []; if (m.footprint !== 18 || m.bodyWidth < m.tileSize * 0.7 || m.bodyWidth > m.tileSize) errors.push("Home must use 70–90% of its logical tile."); return { valid: errors.length === 0, errors }; }

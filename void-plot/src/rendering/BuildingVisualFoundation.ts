import type { GameObjects, Scene } from "phaser";
import { THEME_COLORS } from "./VisualTheme";

export type WorldBuildingVisualMode = "placed" | "valid-preview" | "invalid-preview";

export class BuildingVisualFoundation {
  public readonly objects: readonly GameObjects.GameObject[];
  private readonly shadow: GameObjects.Ellipse;
  private readonly lowerFace: GameObjects.Rectangle;
  private readonly pad: GameObjects.Rectangle;
  private readonly topPlane: GameObjects.Polygon;
  private readonly rim: GameObjects.Rectangle;
  private readonly selection: GameObjects.Rectangle;

  public constructor(scene: Scene, tileSize: number) {
    const footprint = tileSize - 2;
    this.shadow = scene.add.ellipse(1.5, 5, footprint + 2, Math.max(5, footprint * 0.35), 0x020405, 0.48);
    this.lowerFace = scene.add.rectangle(1, 3, footprint, Math.max(4, footprint * 0.3), THEME_COLORS.structureFoundationDark, 0.96).setStrokeStyle(1, THEME_COLORS.structureDeepEdge, 0.9);
    this.pad = scene.add.rectangle(0, 0, footprint, Math.max(10, footprint * 0.66), THEME_COLORS.structureFoundation).setStrokeStyle(1, THEME_COLORS.structureDeepEdge, 0.95);
    this.topPlane = scene.add.polygon(0, -3, [-footprint / 2, 2, -footprint / 2 + 3, -3, footprint / 2, -3, footprint / 2 - 3, 2], THEME_COLORS.structureTopPlane, 0.95);
    this.rim = scene.add.rectangle(-footprint / 2 + 1, -3, footprint - 3, 1, THEME_COLORS.structureRimLight, 0.65).setOrigin(0, 0.5);
    this.selection = scene.add.rectangle(0, -1, footprint + 3, footprint + 5, 0, 0).setStrokeStyle(2, THEME_COLORS.selection, 1).setVisible(false);
    this.objects = Object.freeze([this.shadow, this.lowerFace, this.pad, this.topPlane, this.rim, this.selection]);
  }

  public setMode(mode: WorldBuildingVisualMode): void {
    const preview = mode !== "placed";
    const accent = mode === "valid-preview" ? THEME_COLORS.validBright : THEME_COLORS.invalid;
    this.pad.setStrokeStyle(preview ? 2 : 1, preview ? accent : THEME_COLORS.structureDeepEdge, preview ? 0.9 : 0.95);
    this.topPlane.setFillStyle(preview ? accent : THEME_COLORS.structureTopPlane, preview ? 0.22 : 0.95);
    this.rim.setFillStyle(preview ? accent : THEME_COLORS.structureRimLight, preview ? 0.9 : 0.65);
    this.selection.setVisible(false);
  }

  public setSelected(selected: boolean): void {
    this.selection.setVisible(selected).setAlpha(selected ? 0.95 : 0);
  }

  public finalize(container: GameObjects.Container): void {
    container.bringToTop(this.selection);
  }
}

export function getBuildingVisualVariation(seed: string | number): number {
  if (typeof seed === "number") return (Math.trunc(seed) >>> 0);
  let hash = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) hash = Math.imul(hash ^ seed.charCodeAt(index), 16_777_619);
  return hash >>> 0;
}

export function validateBuildingVisualFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const first = getBuildingVisualVariation("building-7@12,14");
  const repeated = getBuildingVisualVariation("building-7@12,14");
  const other = getBuildingVisualVariation("building-8@12,14");
  const valid = first === repeated && first !== other;
  return { valid, errors: valid ? Object.freeze([]) : Object.freeze(["Building visual variation must be deterministic and seed-sensitive."]) };
}

import type { GameObjects, Scene } from "phaser";

import type {
  ExpeditionSectorOrigin,
  ExpeditionSectorSize,
} from "../world";
import type { WorldRenderBounds } from "./WorldRenderer";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";

const PREVIEW_FILL_ALPHA = 0.12;

export type ExpeditionSectorPreviewValidity = "valid" | "invalid";

export class ExpeditionSectorPreview {
  private readonly preview: GameObjects.Rectangle;
  private readonly selection: GameObjects.Rectangle;
  private readonly active: GameObjects.Rectangle;
  private readonly activeProgressTrack: GameObjects.Rectangle;
  private readonly activeProgressFill: GameObjects.Rectangle;

  public constructor(
    scene: Scene,
    private readonly worldBounds: WorldRenderBounds,
  ) {
    this.selection = scene.add
      .rectangle(0, 0, 1, 1, 0, 0)
      .setStrokeStyle(2, THEME_COLORS.sector, 0.9)
      .setDepth(RENDER_DEPTHS.sectorSelection)
      .setVisible(false);
    this.preview = scene.add
      .rectangle(0, 0, 1, 1, THEME_COLORS.valid, PREVIEW_FILL_ALPHA)
      .setStrokeStyle(1, THEME_COLORS.valid, 0.85)
      .setDepth(RENDER_DEPTHS.sectorPreview)
      .setVisible(false);
    this.active = scene.add.rectangle(0, 0, 1, 1, THEME_COLORS.sector, 0.04).setStrokeStyle(2, THEME_COLORS.sector, 0.95).setDepth(RENDER_DEPTHS.sectorSelection + 1).setVisible(false);
    this.activeProgressTrack = scene.add.rectangle(0, 0, 1, 3, THEME_COLORS.progressTrack, 0.9).setOrigin(0, 0.5).setDepth(RENDER_DEPTHS.sectorSelection + 2).setVisible(false);
    this.activeProgressFill = scene.add.rectangle(0, 0, 1, 3, THEME_COLORS.validBright, 0.95).setOrigin(0, 0.5).setDepth(RENDER_DEPTHS.sectorSelection + 3).setVisible(false);
  }

  public showPreview(
    origin: ExpeditionSectorOrigin,
    size: ExpeditionSectorSize,
    validity: ExpeditionSectorPreviewValidity,
  ): void {
    const color =
      validity === "valid" ? THEME_COLORS.valid : THEME_COLORS.invalid;

    this.positionOverlay(this.preview, origin, size);
    this.preview
      .setFillStyle(color, PREVIEW_FILL_ALPHA)
      .setStrokeStyle(1, color, 0.85)
      .setVisible(true);
  }

  public clearPreview(): void {
    this.preview.setVisible(false);
  }

  public showSelection(
    origin: ExpeditionSectorOrigin,
    size: ExpeditionSectorSize,
  ): void {
    this.positionOverlay(this.selection, origin, size);
    this.selection.setVisible(true);
  }

  public clearSelection(): void {
    this.selection.setVisible(false);
  }

  public showActiveSector(origin: ExpeditionSectorOrigin, size: ExpeditionSectorSize, progress: number): void {
    this.positionOverlay(this.active, origin, size);
    const pixelSize = size * this.worldBounds.tileSize;
    const left = this.worldBounds.x + origin.x * this.worldBounds.tileSize;
    const bottom = this.worldBounds.y + (origin.y + size) * this.worldBounds.tileSize - 2;
    this.active.setVisible(true);
    this.activeProgressTrack.setPosition(left, bottom).setSize(pixelSize, 3).setVisible(true);
    this.activeProgressFill.setPosition(left, bottom).setSize(Math.max(1, pixelSize * Math.min(1, Math.max(0, progress))), 3).setVisible(true);
  }

  public clearActiveSector(): void {
    this.active.setVisible(false);
    this.activeProgressTrack.setVisible(false);
    this.activeProgressFill.setVisible(false);
  }

  private positionOverlay(
    overlay: GameObjects.Rectangle,
    origin: ExpeditionSectorOrigin,
    size: ExpeditionSectorSize,
  ): void {
    const pixelSize = size * this.worldBounds.tileSize;

    overlay
      .setSize(pixelSize, pixelSize)
      .setPosition(
        this.worldBounds.x +
          origin.x * this.worldBounds.tileSize +
          pixelSize / 2,
        this.worldBounds.y +
          origin.y * this.worldBounds.tileSize +
          pixelSize / 2,
      );
  }
}

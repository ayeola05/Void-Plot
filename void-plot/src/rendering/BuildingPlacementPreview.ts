import type { Scene } from "phaser";

import type { TileCoordinate } from "../world";
import type { BuildingType } from "../simulation";
import type { WorldRenderBounds } from "./WorldRenderer";
import { FarmVisual } from "./FarmVisual";
import { ForestVisual } from "./ForestVisual";
import { HomesVisual } from "./HomesVisual";
import { PowerPlantVisual } from "./PowerPlantVisual";
import { LabVisual } from "./LabVisual";
import { RENDER_DEPTHS } from "./VisualTheme";

export type BuildingPlacementPreviewValidity = "valid" | "invalid";

export class BuildingPlacementPreview {
  private readonly homesVisual: HomesVisual;
  private readonly farmVisual: FarmVisual;
  private readonly forestVisual: ForestVisual;
  private readonly powerPlantVisual: PowerPlantVisual;
  private readonly labVisual: LabVisual;

  public constructor(
    scene: Scene,
    private readonly worldBounds: WorldRenderBounds,
  ) {
    this.homesVisual = new HomesVisual(
      scene,
      worldBounds.tileSize,
      "valid-preview",
    )
      .setDepth(RENDER_DEPTHS.buildingPreview)
      .setVisible(false);
    this.farmVisual = new FarmVisual(
      scene,
      worldBounds.tileSize,
      "valid-preview",
    )
      .setDepth(RENDER_DEPTHS.buildingPreview)
      .setVisible(false);
    this.forestVisual = new ForestVisual(
      scene,
      worldBounds.tileSize,
      "valid-preview",
    )
      .setDepth(RENDER_DEPTHS.buildingPreview)
      .setVisible(false);
    this.powerPlantVisual = new PowerPlantVisual(
      scene,
      worldBounds.tileSize,
      "valid-preview",
    )
      .setDepth(RENDER_DEPTHS.buildingPreview)
      .setVisible(false);
    this.labVisual = new LabVisual(scene, worldBounds.tileSize, "valid-preview")
      .setDepth(RENDER_DEPTHS.buildingPreview)
      .setVisible(false);
  }

  public show(
    coordinate: TileCoordinate,
    type: BuildingType,
    validity: BuildingPlacementPreviewValidity,
  ): void {
    const visual =
      type === "farm"
        ? this.farmVisual
        : type === "forest"
          ? this.forestVisual
          : type === "powerPlant"
            ? this.powerPlantVisual
          : type === "lab"
            ? this.labVisual
          : this.homesVisual;
    this.homesVisual.setVisible(type === "homes");
    this.farmVisual.setVisible(type === "farm");
    this.forestVisual.setVisible(type === "forest");
    this.powerPlantVisual.setVisible(type === "powerPlant");
    this.labVisual.setVisible(type === "lab");
    visual
      .setVariation(`${type}@${coordinate.x},${coordinate.y}`)
      .setMode(
        validity === "valid" ? "valid-preview" : "invalid-preview",
      )
      .setPosition(
        this.worldBounds.x +
          coordinate.x * this.worldBounds.tileSize +
          this.worldBounds.tileSize / 2,
        this.worldBounds.y +
          coordinate.y * this.worldBounds.tileSize +
          this.worldBounds.tileSize / 2,
      )
      .setVisible(true);
  }

  public clear(): void {
    this.homesVisual.setVisible(false);
    this.farmVisual.setVisible(false);
    this.forestVisual.setVisible(false);
    this.powerPlantVisual.setVisible(false);
    this.labVisual.setVisible(false);
  }
}

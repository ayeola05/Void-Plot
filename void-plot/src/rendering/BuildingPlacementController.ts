import { Input } from "phaser";
import type { Scene } from "phaser";

import type {
  BuildingPlacementOperationResult,
  BuildingPlacementValidationResult,
  BuildingType,
} from "../simulation";
import type { TileCoordinate } from "../world";
import type { BuildingPlacementPreview } from "./BuildingPlacementPreview";
import type { WorldTileInteractionController } from "./WorldTileInteractionController";
import { POINTER_TAP_MAX_DISTANCE } from "./WorldCameraController";

export type BuildingPlacementFeedbackStatus =
  | "inactive"
  | "choose-tile"
  | BuildingPlacementValidationResult["status"]
  | BuildingPlacementOperationResult["status"];

export interface BuildingPlacementControllerSource {
  validatePlacement(
    coordinate: TileCoordinate,
    type: BuildingType,
  ): BuildingPlacementValidationResult;
  requestPlacement(
    coordinate: TileCoordinate,
    type: BuildingType,
  ): BuildingPlacementOperationResult;
  canContinuePlacement(type: BuildingType): boolean;
  placementModeChanged(active: boolean): void;
}

export class BuildingPlacementController {
  private selectedType?: BuildingType;
  private feedbackStatus: BuildingPlacementFeedbackStatus = "inactive";

  public constructor(
    scene: Scene,
    private readonly tileInteraction: WorldTileInteractionController,
    private readonly preview: BuildingPlacementPreview,
    private readonly source: BuildingPlacementControllerSource,
  ) {
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.events.once("shutdown", () => {
      scene.input.off("pointerup", this.handlePointerUp, this);
    });
  }

  public selectHomes(): void {
    this.selectBuilding("homes");
  }

  public selectFarm(): void {
    this.selectBuilding("farm");
  }

  public selectBuilding(type: BuildingType): void {
    this.selectedType = type;
    this.feedbackStatus = "choose-tile";
    this.source.placementModeChanged(true);
    this.update();
  }

  public cancelPlacementMode(): void {
    if (this.selectedType === undefined) {
      return;
    }

    this.selectedType = undefined;
    this.feedbackStatus = "inactive";
    this.preview.clear();
    this.source.placementModeChanged(false);
  }

  public update(): void {
    if (this.selectedType === undefined) {
      this.preview.clear();
      return;
    }

    const coordinate = this.tileInteraction.getHoveredTileCoordinate();

    if (coordinate === undefined) {
      this.preview.clear();
      this.feedbackStatus = "choose-tile";
      return;
    }

    const validation = this.source.validatePlacement(
      coordinate,
      this.selectedType,
    );

    this.feedbackStatus = validation.status;
    this.preview.show(
      coordinate,
      this.selectedType,
      validation.status === "valid" ? "valid" : "invalid",
    );
  }

  public isPlacementModeActive(): boolean {
    return this.selectedType !== undefined;
  }

  public getSelectedBuildingType(): BuildingType | undefined {
    return this.selectedType;
  }

  public getFeedbackStatus(): BuildingPlacementFeedbackStatus {
    return this.feedbackStatus;
  }

  private handlePointerUp(pointer: Input.Pointer): void {
    if (
      pointer.button !== 0 ||
      pointer.getDistance() > POINTER_TAP_MAX_DISTANCE ||
      this.selectedType === undefined
    ) {
      return;
    }

    const coordinate = this.tileInteraction.getHoveredTileCoordinate();

    if (coordinate === undefined) {
      return;
    }

    const result = this.source.requestPlacement(coordinate, this.selectedType);
    this.feedbackStatus = result.status;

    if (
      result.status === "placed" &&
      !this.source.canContinuePlacement(this.selectedType)
    ) {
      this.cancelPlacementMode();
      return;
    }

    this.update();
  }
}

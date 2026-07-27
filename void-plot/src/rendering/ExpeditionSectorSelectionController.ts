import { Input } from "phaser";
import type { Scene } from "phaser";

import {
  validateExpeditionSectorSelection,
  type ExpeditionSectorSelectionResult,
  type ExpeditionSectorSize,
  type WorldState,
} from "../world";
import type { ExpeditionSectorPreview } from "./ExpeditionSectorPreview";
import type { WorldTileInteractionController } from "./WorldTileInteractionController";
import { POINTER_TAP_MAX_DISTANCE } from "./WorldCameraController";

export type SelectedExpeditionSector = Extract<
  ExpeditionSectorSelectionResult,
  { status: "valid" }
>;

export class ExpeditionSectorSelectionController {
  private enabled = true;
  private selectedSize: ExpeditionSectorSize = 2;
  private selectedSector?: SelectedExpeditionSector;
  private readonly sizeKeys: readonly Input.Keyboard.Key[];

  public constructor(
    scene: Scene,
    private readonly world: WorldState,
    private readonly tileInteraction: WorldTileInteractionController,
    private readonly preview: ExpeditionSectorPreview,
  ) {
    const keyboard = scene.input.keyboard;

    this.sizeKeys = keyboard === null
      ? []
      : [keyboard.addKey(Input.Keyboard.KeyCodes.TWO), keyboard.addKey(Input.Keyboard.KeyCodes.FOUR), keyboard.addKey(Input.Keyboard.KeyCodes.SIX)];
    this.sizeKeys[0]?.on("down", this.selectTwo, this);
    this.sizeKeys[1]?.on("down", this.selectFour, this);
    this.sizeKeys[2]?.on("down", this.selectSix, this);

    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.events.once("shutdown", () => {
      this.sizeKeys[0]?.off("down", this.selectTwo, this);
      this.sizeKeys[1]?.off("down", this.selectFour, this);
      this.sizeKeys[2]?.off("down", this.selectSix, this);
      scene.input.off("pointerup", this.handlePointerUp, this);
    });
    this.update();
  }

  public update(): void {
    if (!this.enabled) {
      this.preview.clearPreview();
      return;
    }

    const origin = this.tileInteraction.getHoveredTileCoordinate();

    if (origin === undefined) {
      this.preview.clearPreview();
      return;
    }

    const result = validateExpeditionSectorSelection(
      this.world,
      origin,
      this.selectedSize,
    );

    this.preview.showPreview(
      origin,
      this.selectedSize,
      result.status === "valid" ? "valid" : "invalid",
    );
  }

  public getSelectedSize(): ExpeditionSectorSize {
    return this.selectedSize;
  }

  public selectSectorSize(size: ExpeditionSectorSize): void {
    this.setSectorSize(size);
  }

  public getSelectedSector(): SelectedExpeditionSector | undefined {
    if (this.selectedSector === undefined) {
      return undefined;
    }

    return {
      ...this.selectedSector,
      origin: { ...this.selectedSector.origin },
      bounds: { ...this.selectedSector.bounds },
      coordinates: this.selectedSector.coordinates.map((coordinate) => ({
        ...coordinate,
      })),
      hiddenCoordinates: this.selectedSector.hiddenCoordinates.map(
        (coordinate) => ({ ...coordinate }),
      ),
    };
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.update();
  }

  private setSectorSize(size: ExpeditionSectorSize): void {
    this.selectedSize = size;
    this.update();
  }

  private selectTwo(): void { this.setSectorSize(2); }
  private selectFour(): void { this.setSectorSize(4); }
  private selectSix(): void { this.setSectorSize(6); }

  private handlePointerUp(pointer: Input.Pointer): void {
    if (
      !this.enabled ||
      pointer.button !== 0 ||
      pointer.getDistance() > POINTER_TAP_MAX_DISTANCE
    ) {
      return;
    }

    const origin = this.tileInteraction.getHoveredTileCoordinate();

    if (origin === undefined) {
      return;
    }

    const result = validateExpeditionSectorSelection(
      this.world,
      origin,
      this.selectedSize,
    );

    if (result.status !== "valid") {
      return;
    }

    this.selectedSector = result;
    this.preview.showSelection(result.origin, result.size);
  }
}

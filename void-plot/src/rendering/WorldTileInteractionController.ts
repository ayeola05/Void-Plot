import type { Cameras, Input, Scene } from "phaser";

import {
  createWorld,
  getTile,
  type TileCoordinate,
  type WorldState,
} from "../world";
import type { WorldRenderBounds, WorldRenderer } from "./WorldRenderer";
import { screenPointIsInsideRectangle } from "./ResponsiveGameLayout";
import { POINTER_TAP_MAX_DISTANCE } from "./WorldCameraController";

export type TileHitResult =
  | {
      status: "tile";
      coordinate: TileCoordinate;
    }
  | {
      status: "outside-world";
    };

export interface TileInteractionValidationResult {
  valid: boolean;
  errors: string[];
}

class TileInteractionState {
  private hoveredTile?: TileCoordinate;
  private selectedTile?: TileCoordinate;

  public applyHover(hit: TileHitResult): void {
    this.hoveredTile = hit.status === "tile" ? { ...hit.coordinate } : undefined;
  }

  public applySelection(hit: TileHitResult): void {
    this.selectedTile = hit.status === "tile" ? { ...hit.coordinate } : undefined;
  }

  public getHoveredTile(): TileCoordinate | undefined {
    return this.hoveredTile === undefined ? undefined : { ...this.hoveredTile };
  }

  public getSelectedTile(): TileCoordinate | undefined {
    return this.selectedTile === undefined ? undefined : { ...this.selectedTile };
  }
}

export function worldPointToTile(
  world: WorldState,
  worldBounds: WorldRenderBounds,
  worldX: number,
  worldY: number,
): TileHitResult {
  if (
    !Number.isFinite(worldX) ||
    !Number.isFinite(worldY) ||
    worldBounds.tileSize <= 0
  ) {
    return { status: "outside-world" };
  }

  const localX = worldX - worldBounds.x;
  const localY = worldY - worldBounds.y;

  if (
    localX < 0 ||
    localY < 0 ||
    localX >= worldBounds.width ||
    localY >= worldBounds.height
  ) {
    return { status: "outside-world" };
  }

  const coordinate = {
    x: Math.floor(localX / worldBounds.tileSize),
    y: Math.floor(localY / worldBounds.tileSize),
  };

  return getTile(world, coordinate.x, coordinate.y) === undefined
    ? { status: "outside-world" }
    : { status: "tile", coordinate };
}

export class WorldTileInteractionController {
  private readonly camera: Cameras.Scene2D.Camera;
  private readonly state = new TileInteractionState();

  public constructor(
    scene: Scene,
    private readonly world: WorldState,
    private readonly renderer: WorldRenderer,
    private readonly worldBounds: WorldRenderBounds,
  ) {
    this.camera = scene.cameras.main;
    scene.input.on("pointerup", this.handlePointerUp, this);
    scene.events.once("shutdown", () => scene.input.off("pointerup", this.handlePointerUp, this));
    this.updateHover(scene.input.activePointer);
  }

  public update(pointer: Input.Pointer): void {
    this.updateHover(pointer);
  }

  public getHoveredTileCoordinate(): TileCoordinate | undefined {
    return this.state.getHoveredTile();
  }

  public getSelectedTileCoordinate(): TileCoordinate | undefined {
    return this.state.getSelectedTile();
  }

  private handlePointerUp(pointer: Input.Pointer): void {
    if (pointer.button !== 0 || pointer.getDistance() > POINTER_TAP_MAX_DISTANCE) {
      return;
    }

    const hit = this.getTileHit(pointer);
    this.state.applySelection(hit);
    this.renderer.setSelectedTile(this.state.getSelectedTile());
  }

  private updateHover(pointer: Input.Pointer): void {
    const hit = this.getTileHit(pointer);
    this.state.applyHover(hit);
    this.renderer.setHoveredTile(this.state.getHoveredTile());
  }

  private getTileHit(pointer: Input.Pointer): TileHitResult {
    if (
      !screenPointIsInsideRectangle(
        {
          x: this.camera.x,
          y: this.camera.y,
          width: this.camera.width,
          height: this.camera.height,
        },
        pointer.x,
        pointer.y,
      )
    ) {
      return { status: "outside-world" };
    }

    const worldPoint = this.camera.getWorldPoint(pointer.x, pointer.y);

    return worldPointToTile(
      this.world,
      this.worldBounds,
      worldPoint.x,
      worldPoint.y,
    );
  }
}

export function validateTileInteractionFoundation(): TileInteractionValidationResult {
  const world = createWorld();
  const worldBounds: WorldRenderBounds = {
    x: 100,
    y: 50,
    width: 640,
    height: 640,
    tileSize: 20,
  };
  const errors: string[] = [];

  const topLeft = worldPointToTile(world, worldBounds, 100, 50);
  const bottomRight = worldPointToTile(world, worldBounds, 739.999, 689.999);
  const rightEdge = worldPointToTile(world, worldBounds, 740, 50);
  const aboveWorld = worldPointToTile(world, worldBounds, 100, 49.999);

  if (
    topLeft.status !== "tile" ||
    topLeft.coordinate.x !== 0 ||
    topLeft.coordinate.y !== 0
  ) {
    errors.push("The top-left world point must resolve to tile (0, 0).");
  }

  if (
    bottomRight.status !== "tile" ||
    bottomRight.coordinate.x !== 31 ||
    bottomRight.coordinate.y !== 31
  ) {
    errors.push("The final in-bounds point must resolve to tile (31, 31).");
  }

  if (rightEdge.status !== "outside-world" || aboveWorld.status !== "outside-world") {
    errors.push("Points outside the half-open world bounds must be rejected.");
  }

  const state = new TileInteractionState();
  state.applyHover(topLeft);
  state.applySelection(topLeft);

  const secondTile: TileHitResult = {
    status: "tile",
    coordinate: { x: 1, y: 2 },
  };
  state.applySelection(secondTile);

  const selectedTile = state.getSelectedTile();

  if (selectedTile?.x !== 1 || selectedTile.y !== 2) {
    errors.push("A new selection must replace the previous tile selection.");
  }

  state.applyHover({ status: "outside-world" });
  state.applySelection({ status: "outside-world" });

  if (
    state.getHoveredTile() !== undefined ||
    state.getSelectedTile() !== undefined
  ) {
    errors.push("Outside-world hits must clear hover and selection state.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

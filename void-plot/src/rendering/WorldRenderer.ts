import type { GameObjects, Scene } from "phaser";

import { getTile, toTileIndex, type TileCoordinate, type WorldState } from "../world";
import {
  getFarmProductionProgress,
  getForestProductionProgress,
  isBuildingPowered,
  type BuildingState,
  type FarmProductionEvent,
  type ForestProductionEvent,
  type LabResearchProductionEvent,
  type PowerAllocationSnapshot,
} from "../simulation";
import { FarmVisual } from "./FarmVisual";
import { ForestVisual } from "./ForestVisual";
import { ResourceProductionPopupPool } from "./FoodProductionPopupPool";
import { HomesVisual } from "./HomesVisual";
import { PowerPlantVisual } from "./PowerPlantVisual";
import { LabVisual } from "./LabVisual";
import { BeaconVisual } from "./BeaconVisual";
import type { BeaconPhase } from "../data";
import { AmbientParticlePool } from "./AmbientParticlePool";
import { WorldDecorationLayer } from "./WorldDecorationLayer";
import {
  RENDER_DEPTHS,
  THEME_COLORS,
  getTerrainVisualDescriptor,
} from "./VisualTheme";

export const WORLD_TILE_SIZE = 20;

const TILE_GAP = 1;

interface TileVisual {
  readonly base: GameObjects.Rectangle;
  readonly inset: GameObjects.Rectangle;
  readonly mark: GameObjects.Rectangle;
}

export interface WorldRenderBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  tileSize: number;
}

export class WorldRenderer {
  private readonly buildingViews = new Map<
    string,
    HomesVisual | FarmVisual | ForestVisual | PowerPlantVisual | LabVisual
  >();
  private readonly buildingCoordinates = new Map<string, Readonly<TileCoordinate>>();
  private readonly tileViews: TileVisual[] = [];
  private renderBounds?: WorldRenderBounds;
  private worldFrame?: GameObjects.Rectangle;
  private worldShadow?: GameObjects.Rectangle;
  private hoveredTileView?: GameObjects.Rectangle;
  private selectedTileView?: GameObjects.Rectangle;
  private productionPopupPool?: ResourceProductionPopupPool;
  private beaconVisual?: BeaconVisual;
  private particlePool?: AmbientParticlePool;
  private decorationLayer?: WorldDecorationLayer;
  private tutorialTileView?: GameObjects.Rectangle;
  private selectedCoordinate?: Readonly<TileCoordinate>;

  public constructor(
    private readonly scene: Scene,
    private readonly tileSize = WORLD_TILE_SIZE,
  ) {}

  public render(world: WorldState): WorldRenderBounds {
    this.clear();

    const gridWidth = world.width * this.tileSize;
    const gridHeight = world.height * this.tileSize;
    const originX = 0;
    const originY = 0;
    const visibleTileSize = this.tileSize - TILE_GAP;

    this.renderBounds = {
      x: originX,
      y: originY,
      width: gridWidth,
      height: gridHeight,
      tileSize: this.tileSize,
    };
    this.productionPopupPool = new ResourceProductionPopupPool(
      this.scene,
      this.renderBounds,
    );
    this.beaconVisual = new BeaconVisual(
      this.scene,
      originX + gridWidth / 2,
      originY + gridHeight / 2,
    );
    this.particlePool = new AmbientParticlePool(this.scene);
    this.particlePool.addSource(originX + gridWidth / 2, originY + gridHeight / 2, "beacon");

    this.worldShadow = this.scene.add
      .rectangle(
        originX + gridWidth / 2,
        originY + gridHeight / 2 + 3,
        gridWidth + 12,
        gridHeight + 12,
        THEME_COLORS.canvasBackground,
        0.72,
      )
      .setDepth(RENDER_DEPTHS.worldFrame - 1);
    this.worldFrame = this.scene.add
      .rectangle(
        originX + gridWidth / 2,
        originY + gridHeight / 2,
        gridWidth,
        gridHeight,
        THEME_COLORS.gridLines,
      )
      .setStrokeStyle(2, THEME_COLORS.worldFrame, 0.8)
      .setDepth(RENDER_DEPTHS.worldFrame);

    for (const tile of world.tiles) {
      const centreX = originX + tile.x * this.tileSize + this.tileSize / 2;
      const centreY = originY + tile.y * this.tileSize + this.tileSize / 2;
      const tileView: TileVisual = {
        base: this.scene.add
          .rectangle(centreX, centreY, visibleTileSize, visibleTileSize)
          .setDepth(RENDER_DEPTHS.terrain),
        inset: this.scene.add
          .rectangle(
            centreX,
            centreY,
            visibleTileSize - 4,
            visibleTileSize - 4,
          )
          .setDepth(RENDER_DEPTHS.terrainDetail),
        mark: this.scene.add
          .rectangle(centreX, centreY, 3, 1)
          .setDepth(RENDER_DEPTHS.terrainDetail),
      };

      this.tileViews.push(tileView);
      this.applyTileAppearance(tileView, tile.x, tile.y, tile.revealState);
    }
    this.decorationLayer = new WorldDecorationLayer(this.scene, world, this.renderBounds);

    this.selectedTileView = this.createOutline(
      visibleTileSize + 2,
      THEME_COLORS.selection,
      2,
      RENDER_DEPTHS.selection,
    );
    this.hoveredTileView = this.createOutline(
      visibleTileSize - 4,
      THEME_COLORS.hover,
      1,
      RENDER_DEPTHS.hover,
    );
    this.tutorialTileView = this.createOutline(visibleTileSize + 5, THEME_COLORS.validBright, 2, RENDER_DEPTHS.selection + 1);

    return { ...this.renderBounds };
  }

  public setHoveredTile(coordinate?: TileCoordinate): boolean {
    return this.positionOutline(this.hoveredTileView, coordinate);
  }

  public setSelectedTile(coordinate?: TileCoordinate): boolean {
    this.selectedCoordinate = coordinate === undefined ? undefined : { x: coordinate.x, y: coordinate.y };
    for (const [id, view] of this.buildingViews) {
      const buildingCoordinate = this.buildingCoordinates.get(id);
      view.setSelected(buildingCoordinate !== undefined && coordinate !== undefined && buildingCoordinate.x === coordinate.x && buildingCoordinate.y === coordinate.y);
    }
    return this.positionOutline(this.selectedTileView, coordinate);
  }

  public setTutorialTile(coordinate?: TileCoordinate): boolean { return this.positionOutline(this.tutorialTileView, coordinate); }

  public updateTutorialHighlight(time: number, reducedMotion = false): void {
    if (this.tutorialTileView?.visible) this.tutorialTileView.setAlpha(reducedMotion ? 0.8 : 0.55 + Math.sin(time / 420) * 0.25);
  }

  public updateBeacon(phase: BeaconPhase, sceneTimeMilliseconds: number): void {
    this.beaconVisual?.setPhase(phase).update(sceneTimeMilliseconds);
  }

  public pulseBeaconActivation(): void { this.beaconVisual?.pulseActivation(); }

  public refreshTile(world: WorldState, coordinate: TileCoordinate): boolean {
    const index = toTileIndex(coordinate.x, coordinate.y);
    const tile = getTile(world, coordinate.x, coordinate.y);

    if (index === undefined || tile === undefined) {
      return false;
    }

    const tileView = this.tileViews[index];

    if (tileView === undefined) {
      return false;
    }

    this.applyTileAppearance(
      tileView,
      tile.x,
      tile.y,
      tile.revealState,
    );
    return true;
  }

  public refreshTiles(
    world: WorldState,
    coordinates: readonly TileCoordinate[],
  ): number {
    return coordinates.reduce(
      (refreshedCount, coordinate) =>
        refreshedCount + Number(this.refreshTile(world, coordinate)),
      0,
    );
  }

  public renderHomesBuilding(
    buildingId: string,
    coordinate: TileCoordinate,
  ): GameObjects.Container | undefined {
    if (this.renderBounds === undefined || this.buildingViews.has(buildingId)) {
      return undefined;
    }

    const columnCount = this.renderBounds.width / this.renderBounds.tileSize;
    const rowCount = this.renderBounds.height / this.renderBounds.tileSize;

    if (
      coordinate.x < 0 ||
      coordinate.x >= columnCount ||
      coordinate.y < 0 ||
      coordinate.y >= rowCount
    ) {
      return undefined;
    }

    const view = new HomesVisual(this.scene, this.tileSize, "placed", `homes@${coordinate.x},${coordinate.y}`)
      .setPosition(
        this.renderBounds.x +
          coordinate.x * this.renderBounds.tileSize +
          this.renderBounds.tileSize / 2,
        this.renderBounds.y +
          coordinate.y * this.renderBounds.tileSize +
          this.renderBounds.tileSize / 2,
      )
      .setDepth(this.getBuildingDepth(coordinate));

    this.buildingViews.set(buildingId, view);
    this.registerBuildingCoordinate(buildingId, coordinate, view);
    this.particlePool?.addSource(...this.getTileCentre(coordinate), "home");
    return view.container;
  }

  public renderFarmBuilding(
    buildingId: string,
    coordinate: TileCoordinate,
    staffed = false,
  ): GameObjects.Container | undefined {
    if (!this.canRenderBuilding(buildingId, coordinate)) {
      return undefined;
    }

    const view = new FarmVisual(this.scene, this.tileSize, "placed", `farm@${coordinate.x},${coordinate.y}`)
      .setPosition(...this.getTileCentre(coordinate))
      .setDepth(this.getBuildingDepth(coordinate))
      .setStaffed(staffed);

    this.buildingViews.set(buildingId, view);
    this.registerBuildingCoordinate(buildingId, coordinate, view);
    this.particlePool?.addSource(...this.getTileCentre(coordinate), "farm");
    return view.container;
  }

  public setFarmStaffed(buildingId: string, staffed: boolean): boolean {
    const view = this.buildingViews.get(buildingId);

    if (!(view instanceof FarmVisual)) {
      return false;
    }

    view.setStaffed(staffed);
    return true;
  }

  public renderForestBuilding(
    buildingId: string,
    coordinate: TileCoordinate,
    staffed = false,
  ): GameObjects.Container | undefined {
    if (!this.canRenderBuilding(buildingId, coordinate)) {
      return undefined;
    }

    const view = new ForestVisual(this.scene, this.tileSize, "placed", `forest@${coordinate.x},${coordinate.y}`)
      .setPosition(...this.getTileCentre(coordinate))
      .setDepth(this.getBuildingDepth(coordinate))
      .setStaffed(staffed);

    this.buildingViews.set(buildingId, view);
    this.registerBuildingCoordinate(buildingId, coordinate, view);
    this.particlePool?.addSource(...this.getTileCentre(coordinate), "forest");
    return view.container;
  }

  public setForestStaffed(buildingId: string, staffed: boolean): boolean {
    const view = this.buildingViews.get(buildingId);

    if (!(view instanceof ForestVisual)) {
      return false;
    }

    view.setStaffed(staffed);
    return true;
  }

  public updateFarmProductionIndicators(
    buildingState: BuildingState,
    powerSnapshot: PowerAllocationSnapshot,
    sceneTimeMilliseconds: number,
    productionRateMultiplier = 1,
    reducedMotion = false,
  ): void {
    for (const building of buildingState.buildings) {
      if (building.type !== "farm") {
        continue;
      }

      const view = this.buildingViews.get(building.id);
      if (view instanceof FarmVisual) {
        const powered = isBuildingPowered(powerSnapshot, building.id);
        const progress = getFarmProductionProgress(
          building,
          powered,
          productionRateMultiplier,
        );
        view
          .setStaffed(building.assignedWorkers === 1)
          .setPowered(powered)
          .setProductionProgress(progress.progress)
          .updateProductionIndicator(sceneTimeMilliseconds, reducedMotion);
      }
    }
  }

  public updateForestProductionIndicators(
    buildingState: BuildingState,
    powerSnapshot: PowerAllocationSnapshot,
    sceneTimeMilliseconds: number,
    productionRateMultiplier = 1,
    reducedMotion = false,
  ): void {
    for (const building of buildingState.buildings) {
      if (building.type !== "forest") {
        continue;
      }

      const view = this.buildingViews.get(building.id);
      if (view instanceof ForestVisual) {
        const powered = isBuildingPowered(powerSnapshot, building.id);
        const progress = getForestProductionProgress(building, powered, productionRateMultiplier);
        view
          .setStaffed(building.assignedWorkers === 1)
          .setPowered(powered)
          .setProductionProgress(progress.progress)
          .updateProductionIndicator(sceneTimeMilliseconds, reducedMotion);
      }
    }
  }

  public renderPowerPlantBuilding(
    buildingId: string,
    coordinate: TileCoordinate,
    staffed = false,
  ): GameObjects.Container | undefined {
    if (!this.canRenderBuilding(buildingId, coordinate)) {
      return undefined;
    }

    const view = new PowerPlantVisual(this.scene, this.tileSize, "placed", `powerPlant@${coordinate.x},${coordinate.y}`)
      .setPosition(...this.getTileCentre(coordinate))
      .setDepth(this.getBuildingDepth(coordinate))
      .setStaffed(staffed);

    this.buildingViews.set(buildingId, view);
    this.registerBuildingCoordinate(buildingId, coordinate, view);
    this.particlePool?.addSource(...this.getTileCentre(coordinate), "power");
    return view.container;
  }

  public renderLabBuilding(buildingId: string, coordinate: TileCoordinate, staffed = false): GameObjects.Container | undefined {
    if (!this.canRenderBuilding(buildingId, coordinate)) return undefined;
    const view = new LabVisual(this.scene, this.tileSize, "placed", `lab@${coordinate.x},${coordinate.y}`)
      .setPosition(...this.getTileCentre(coordinate))
      .setDepth(this.getBuildingDepth(coordinate))
      .setStaffed(staffed);
    this.buildingViews.set(buildingId, view);
    this.registerBuildingCoordinate(buildingId, coordinate, view);
    this.particlePool?.addSource(...this.getTileCentre(coordinate), "lab");
    return view.container;
  }

  public setLabStaffed(buildingId: string, staffed: boolean): boolean {
    const view = this.buildingViews.get(buildingId);
    if (!(view instanceof LabVisual)) return false;
    view.setStaffed(staffed);
    return true;
  }

  public updateLabIndicators(buildingState: BuildingState, powerSnapshot: PowerAllocationSnapshot, sceneTimeMilliseconds: number, reducedMotion = false): void {
    for (const building of buildingState.buildings) {
      if (building.type !== "lab") continue;
      const view = this.buildingViews.get(building.id);
      if (view instanceof LabVisual) view.setStaffed(building.assignedWorkers === 1).setPowered(isBuildingPowered(powerSnapshot, building.id)).updateActivity(sceneTimeMilliseconds, reducedMotion);
    }
  }

  public setPowerPlantStaffed(buildingId: string, staffed: boolean): boolean {
    const view = this.buildingViews.get(buildingId);
    if (!(view instanceof PowerPlantVisual)) {
      return false;
    }
    view.setStaffed(staffed);
    return true;
  }

  public updatePowerPlantIndicators(
    buildingState: BuildingState,
    sceneTimeMilliseconds: number,
    reducedMotion = false,
  ): void {
    for (const building of buildingState.buildings) {
      if (building.type !== "powerPlant") {
        continue;
      }
      const view = this.buildingViews.get(building.id);
      if (view instanceof PowerPlantVisual) {
        view
          .setStaffed(building.assignedWorkers === 1)
          .updateActivity(sceneTimeMilliseconds, reducedMotion);
      }
    }
  }

  public showFoodProduction(
    events: readonly FarmProductionEvent[],
    sceneTimeMilliseconds: number,
  ): readonly GameObjects.GameObject[] {
    return (
      this.productionPopupPool?.show(events, sceneTimeMilliseconds) ?? []
    );
  }

  public showMaterialsProduction(
    events: readonly ForestProductionEvent[],
    sceneTimeMilliseconds: number,
  ): readonly GameObjects.GameObject[] {
    return (
      this.productionPopupPool?.showMaterials(
        events,
        sceneTimeMilliseconds,
      ) ?? []
    );
  }

  public showResearchProduction(
    events: readonly LabResearchProductionEvent[],
    buildings: BuildingState,
    sceneTimeMilliseconds: number,
  ): readonly GameObjects.GameObject[] {
    return this.productionPopupPool?.showResearch(events, buildings, sceneTimeMilliseconds) ?? [];
  }

  public updateProductionPopups(sceneTimeMilliseconds: number): void {
    this.productionPopupPool?.update(sceneTimeMilliseconds);
  }

  public updateAmbientParticles(deltaMilliseconds: number): void { this.particlePool?.update(deltaMilliseconds); }

  public setParticlesEnabled(enabled: boolean): void { this.particlePool?.setEnabled(enabled); }

  public configureDecorations(particles: boolean, reducedMotion: boolean): void { this.decorationLayer?.configure(particles, reducedMotion); }

  public updateDecorations(time: number): void { this.decorationLayer?.update(time); }

  public updateBuildingLife(sceneTimeMilliseconds: number, reducedMotion = false): void {
    for (const view of this.buildingViews.values()) {
      if (view instanceof HomesVisual) view.updateActivity(sceneTimeMilliseconds, reducedMotion);
    }
  }

  public updateFoodProductionPopups(sceneTimeMilliseconds: number): void {
    this.updateProductionPopups(sceneTimeMilliseconds);
  }

  public hasBuildingView(buildingId: string): boolean {
    return this.buildingViews.has(buildingId);
  }

  private canRenderBuilding(
    buildingId: string,
    coordinate: TileCoordinate,
  ): boolean {
    if (this.renderBounds === undefined || this.buildingViews.has(buildingId)) {
      return false;
    }

    const columnCount = this.renderBounds.width / this.renderBounds.tileSize;
    const rowCount = this.renderBounds.height / this.renderBounds.tileSize;
    return (
      coordinate.x >= 0 &&
      coordinate.x < columnCount &&
      coordinate.y >= 0 &&
      coordinate.y < rowCount
    );
  }

  private getTileCentre(coordinate: TileCoordinate): [number, number] {
    return [
      (this.renderBounds?.x ?? 0) + coordinate.x * this.tileSize + this.tileSize / 2,
      (this.renderBounds?.y ?? 0) + coordinate.y * this.tileSize + this.tileSize / 2,
    ];
  }

  private getBuildingDepth(coordinate: TileCoordinate): number {
    return RENDER_DEPTHS.building + coordinate.y * 0.01;
  }

  private registerBuildingCoordinate(
    buildingId: string,
    coordinate: TileCoordinate,
    view: HomesVisual | FarmVisual | ForestVisual | PowerPlantVisual | LabVisual,
  ): void {
    this.buildingCoordinates.set(buildingId, Object.freeze({ x: coordinate.x, y: coordinate.y }));
    const selected = this.selectedCoordinate;
    view.setSelected(selected !== undefined && selected.x === coordinate.x && selected.y === coordinate.y);
  }

  private createOutline(
    size: number,
    color: number,
    lineWidth: number,
    depth: number,
  ): GameObjects.Rectangle {
    return this.scene.add
      .rectangle(0, 0, size, size, 0, 0)
      .setStrokeStyle(lineWidth, color)
      .setDepth(depth)
      .setVisible(false);
  }

  private applyTileAppearance(
    visual: TileVisual,
    x: number,
    y: number,
    revealState: "hidden" | "revealed",
  ): void {
    const descriptor = getTerrainVisualDescriptor(x, y, revealState);
    const centreX =
      (this.renderBounds?.x ?? 0) + x * this.tileSize + this.tileSize / 2;
    const centreY =
      (this.renderBounds?.y ?? 0) + y * this.tileSize + this.tileSize / 2;

    visual.base.setFillStyle(descriptor.baseColor);
    visual.inset
      .setFillStyle(
        descriptor.insetColor,
        revealState === "hidden" ? 0.58 : 0.2,
      )
      .setStrokeStyle(
        1,
        revealState === "hidden"
          ? THEME_COLORS.hiddenMark
          : THEME_COLORS.gridLines,
        revealState === "hidden" ? 0.16 : 0.1,
      );
    visual.mark
      .setPosition(
        centreX + descriptor.markOffsetX,
        centreY + descriptor.markOffsetY,
      )
      .setSize(descriptor.markWidth, 1)
      .setRotation(descriptor.markRotation)
      .setFillStyle(descriptor.markColor, descriptor.markAlpha);
  }

  private positionOutline(
    outline: GameObjects.Rectangle | undefined,
    coordinate: TileCoordinate | undefined,
  ): boolean {
    if (outline === undefined || this.renderBounds === undefined) {
      return false;
    }

    if (coordinate === undefined) {
      outline.setVisible(false);
      return true;
    }

    const columnCount = this.renderBounds.width / this.renderBounds.tileSize;
    const rowCount = this.renderBounds.height / this.renderBounds.tileSize;

    if (
      !Number.isInteger(coordinate.x) ||
      !Number.isInteger(coordinate.y) ||
      coordinate.x < 0 ||
      coordinate.x >= columnCount ||
      coordinate.y < 0 ||
      coordinate.y >= rowCount
    ) {
      outline.setVisible(false);
      return false;
    }

    outline
      .setPosition(
        this.renderBounds.x +
          coordinate.x * this.renderBounds.tileSize +
          this.renderBounds.tileSize / 2,
        this.renderBounds.y +
          coordinate.y * this.renderBounds.tileSize +
          this.renderBounds.tileSize / 2,
      )
      .setVisible(true);

    return true;
  }

  private clear(): void {
    for (const tileView of this.tileViews) {
      tileView.base.destroy();
      tileView.inset.destroy();
      tileView.mark.destroy();
    }

    this.tileViews.length = 0;
    for (const buildingView of this.buildingViews.values()) {
      buildingView.destroy();
    }
    this.buildingViews.clear();
    this.buildingCoordinates.clear();
    this.selectedCoordinate = undefined;
    this.beaconVisual?.destroy();
    this.beaconVisual = undefined;
    this.productionPopupPool?.destroy();
    this.productionPopupPool = undefined;
    this.particlePool?.destroy();
    this.particlePool = undefined;
    this.decorationLayer?.destroy();
    this.decorationLayer = undefined;
    this.worldFrame?.destroy();
    this.worldShadow?.destroy();
    this.hoveredTileView?.destroy();
    this.selectedTileView?.destroy();
    this.tutorialTileView?.destroy();
    this.hoveredTileView = undefined;
    this.selectedTileView = undefined;
    this.tutorialTileView = undefined;
    this.worldFrame = undefined;
    this.worldShadow = undefined;
    this.renderBounds = undefined;
  }
}

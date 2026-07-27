import type { Cameras, GameObjects, Scene } from "phaser";

import {
  findBuildingAt,
  calculatePowerAllocation,
  createEmptyPowerSnapshot,
  getFarmProductionProgress,
  getForestProductionProgress,
  getLabProductionProgress,
  getBuildingDefinition,
  getPopulationGrowthEligibility,
  isBuildingPowered,
  type BuildingState,
  type FoodState,
  type PopulationState,
  type PowerAllocationSnapshot,
  type WorkersState,
} from "../simulation";
import {
  RENDER_DEPTHS,
  THEME_COLORS,
  THEME_SPACING,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "../rendering";

import {
  createWorld,
  getTile,
  occupyTile,
  type TileCoordinate,
  type WorldState,
} from "../world";
import { ThemedButton } from "./ThemedButton";

export interface SelectedTilePanelSource {
  getBuildingState(): BuildingState;
  getWorkersState(): WorkersState;
  getPopulationState(): PopulationState;
  getFoodState(): FoodState;
  requestAssignFarmWorker(buildingId: string): void;
  requestReleaseFarmWorker(buildingId: string): void;
  requestAssignForestWorker(buildingId: string): void;
  requestReleaseForestWorker(buildingId: string): void;
  requestAssignPowerPlantWorker(buildingId: string): void;
  requestReleasePowerPlantWorker(buildingId: string): void;
  requestAssignLabWorker(buildingId: string): void;
  requestReleaseLabWorker(buildingId: string): void;
  getPowerSnapshot(): PowerAllocationSnapshot;
}

export interface SelectedTilePanelLayout {
  viewportWidth: number;
  viewportHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
  reservedUiWidth: number;
}

export interface SelectedTilePanelValidationResult {
  valid: boolean;
  errors: string[];
}

export interface WorkerAssignmentButtonViewModel {
  readonly enabled: boolean;
  readonly label: string;
  readonly tooltip: string;
}

export function createWorkerAssignmentButtonViewModel(
  assignedWorkers: number,
  availableWorkers: number,
): WorkerAssignmentButtonViewModel {
  if (assignedWorkers > 0) {
    return {
      enabled: true,
      label: "Release Worker",
      tooltip: "Return this building's worker to the available worker pool.",
    };
  }

  if (availableWorkers < 1) {
    return {
      enabled: false,
      label: "No Worker Available",
      tooltip: "Recruit a worker or release one from another staffed building.",
    };
  }

  return {
    enabled: true,
    label: "Assign Worker",
    tooltip: "Assign one available worker to this building.",
  };
}

export function formatSelectedTilePanelText(
  world: WorldState,
  coordinate?: TileCoordinate,
  buildingState?: BuildingState,
  populationState?: PopulationState,
  foodState?: FoodState,
  suppliedPowerSnapshot?: PowerAllocationSnapshot,
  workersState?: WorkersState,
): string {
  if (coordinate === undefined) {
    return "No tile selected";
  }

  const tile = getTile(world, coordinate.x, coordinate.y);

  if (tile === undefined) {
    return "No tile selected";
  }

  const lines = [
    `Tile: ${tile.x}, ${tile.y}`,
    `State: ${tile.revealState} • ${tile.occupancyState}`,
  ];
  const building =
    buildingState === undefined ? undefined : findBuildingAt(buildingState, coordinate);
  const derivedPower =
    buildingState === undefined
      ? undefined
      : calculatePowerAllocation(buildingState);
  const calculatedPower =
    suppliedPowerSnapshot ??
    (derivedPower?.status === "calculated"
      ? derivedPower.snapshot
      : createEmptyPowerSnapshot());

  if (building?.type === "homes") {
    lines.push(
      "Building: Homes",
      `Capacity provided: +${getBuildingDefinition("homes").populationCapacity}`,
    );

    if (populationState !== undefined && foodState !== undefined) {
      lines.push(
        `Colony population: ${populationState.currentPopulation}`,
        `Colony capacity: ${populationState.populationCapacity}`,
        `Growth: ${formatHomesGrowthState(populationState, foodState)}`,
      );
    }
  } else if (building?.type === "farm") {
    const definition = getBuildingDefinition("farm");
    const powered = isBuildingPowered(calculatedPower, building.id);
    const progress = getFarmProductionProgress(building, powered);
    lines.push(
      "Building: Farm",
      `Assigned workers: ${building.assignedWorkers} / ${definition.maxAssignedWorkers}`,
      `Power: ${powered ? "Powered" : "No Power"}`,
      `Rate: ${definition.foodPerProductionInterval} Food / ${definition.productionIntervalSeconds}s`,
      `Progress: ${progress.progressPercent}% • ${progress.remainingSeconds.toFixed(1)}s left`,
      `Status: ${formatProducerStatus(progress.status)}`,
    );
    if (!powered) lines.push("Next: build and staff a Power Plant, or reduce Power demand.");
    if (building.assignedWorkers === 0 && workersState?.availableWorkers === 0) lines.push("Next: recruit a worker or release one from another building.");
  } else if (building?.type === "forest") {
    const definition = getBuildingDefinition("forest");
    const powered = isBuildingPowered(calculatedPower, building.id);
    const progress = getForestProductionProgress(building, powered);
    lines.push(
      "Building: Forest",
      `Assigned workers: ${building.assignedWorkers} / ${definition.maxAssignedWorkers}`,
      `Power: ${powered ? "Powered" : "No Power"}`,
      `Production: ${definition.materialsPerProductionInterval} Materials / ${definition.productionIntervalSeconds}s`,
      `Progress: ${progress.progressPercent}% • ${progress.remainingSeconds.toFixed(1)}s left`,
      `Status: ${formatProducerStatus(progress.status)}`,
    );
    if (!powered) lines.push("Next: build and staff a Power Plant, or reduce Power demand.");
    if (building.assignedWorkers === 0 && workersState?.availableWorkers === 0) lines.push("Next: recruit a worker or release one from another building.");
  } else if (building?.type === "powerPlant") {
    const definition = getBuildingDefinition("powerPlant");
    const output =
      building.assignedWorkers === 1 ? definition.powerOutput : 0;
    lines.push(
      "Building: Power Plant",
      `Assigned workers: ${building.assignedWorkers} / ${definition.maxAssignedWorkers}`,
      `Output: ${output} / ${definition.powerOutput} Power`,
      `Status: ${building.assignedWorkers === 1 ? "Generating" : "Unstaffed"}`,
    );
    if (building.assignedWorkers === 0 && workersState?.availableWorkers === 0) lines.push("Next: recruit a worker or release one from another building.");
  } else if (building?.type === "lab") {
    const definition = getBuildingDefinition("lab");
    const powered = isBuildingPowered(calculatedPower, building.id);
    const progress = getLabProductionProgress(building, powered);
    lines.push(
      "Building: Lab",
      `Assigned workers: ${building.assignedWorkers} / 1`,
      `Power: ${powered ? "Powered" : "No Power"}`,
      `Output: ${definition.researchPerProductionInterval} RP / ${definition.productionIntervalSeconds}s`,
      `Progress: ${Math.round(progress.progress * 100)}% • ${progress.remainingSeconds.toFixed(1)}s left`,
      `Status: ${progress.status === "producing" ? "Researching" : progress.status === "no-power" ? "No Power" : "Unstaffed"}`,
    );
    if (!powered) lines.push("Next: build and staff a Power Plant, or release Power demand elsewhere.");
    if (building.assignedWorkers === 0 && workersState?.availableWorkers === 0) lines.push("Next: recruit a worker or release one from another building.");
  }

  return lines.join("\n");
}

export class SelectedTilePanel {
  private readonly background: GameObjects.Rectangle;
  private readonly container: GameObjects.Container;
  private readonly text: GameObjects.Text;
  private readonly workerButton: ThemedButton;
  private readonly uiCamera: Cameras.Scene2D.Camera;
  private readonly uiRail: GameObjects.Rectangle;
  private selectedCoordinate?: TileCoordinate;
  private layoutHeight = 1;

  public constructor(
    scene: Scene,
    private readonly world: WorldState,
    private readonly source?: SelectedTilePanelSource,
  ) {
    const worldDisplayObjects = [...scene.children.list];
    this.uiRail = scene.add
      .rectangle(0, 0, 1, 1, THEME_COLORS.sidebarBackground)
      .setOrigin(0)
      .setDepth(RENDER_DEPTHS.uiRail)
      .setVisible(false);
    this.background = scene.add
      .rectangle(
        0,
        0,
        1,
        1,
        THEME_COLORS.panelBackground,
        0.96,
      )
      .setOrigin(0)
      .setStrokeStyle(1, THEME_COLORS.panelBorder, 0.85);

    const heading = scene.add.text(
      THEME_SPACING.panelPadding,
      8,
      "SELECTED TILE",
      {
        color: colorToCss(THEME_COLORS.accent),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.headingSize,
        fontStyle: "bold",
      },
    );

    this.text = scene.add.text(
      THEME_SPACING.panelPadding,
      26,
      formatSelectedTilePanelText(world),
      {
        color: colorToCss(THEME_COLORS.primaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.helperSize,
        lineSpacing: -1,
      },
    );
    this.workerButton = new ThemedButton(scene, "Assign Worker", () => {
      const building = this.getSelectedBuilding();

      if (
        (building?.type !== "farm" &&
          building?.type !== "forest" &&
          building?.type !== "powerPlant" &&
          building?.type !== "lab") ||
        this.source === undefined
      ) {
        return;
      }

      if (building.type === "farm" && building.assignedWorkers === 0) {
        this.source.requestAssignFarmWorker(building.id);
      } else if (building.type === "farm") {
        this.source.requestReleaseFarmWorker(building.id);
      } else if (building.type === "lab" && building.assignedWorkers === 0) {
        this.source.requestAssignLabWorker(building.id);
      } else if (building.type === "lab") {
        this.source.requestReleaseLabWorker(building.id);
      } else if (building.assignedWorkers === 0) {
        if (building.type === "forest") {
          this.source.requestAssignForestWorker(building.id);
        } else {
          this.source.requestAssignPowerPlantWorker(building.id);
        }
      } else if (building.type === "forest") {
        this.source.requestReleaseForestWorker(building.id);
      } else {
        this.source.requestReleasePowerPlantWorker(building.id);
      }
      this.refresh();
    })
      .setVisible(false)
      .setStopsPointerPropagation();

    this.container = scene.add
      .container(0, 0, [
        this.background,
        heading,
        this.text,
        this.workerButton.container,
      ])
      .setDepth(RENDER_DEPTHS.ui)
      .setScrollFactor(0);

    scene.cameras.main.ignore([this.uiRail, this.container]);

    this.uiCamera = scene.cameras.add(
      0,
      0,
      scene.scale.width,
      scene.scale.height,
    );
    this.uiCamera.ignore(worldDisplayObjects);
  }

  public setLayout(layout: SelectedTilePanelLayout): void {
    this.layoutHeight = layout.height;
    this.container.setPosition(layout.x, layout.y);
    this.background.setSize(layout.width, this.selectedCoordinate === undefined ? 54 : layout.height);
    this.text.setWordWrapWidth(
      Math.max(1, layout.width - THEME_SPACING.panelPadding * 2),
    );
    this.workerButton.setLayout(
      THEME_SPACING.panelPadding,
      Math.max(91, layout.height - THEME_SPACING.panelPadding - THEME_SPACING.buttonHeight),
      Math.max(1, layout.width - THEME_SPACING.panelPadding * 2),
      THEME_SPACING.buttonHeight,
    );
    this.uiCamera.setViewport(
      0,
      0,
      layout.viewportWidth,
      layout.viewportHeight,
    );

    if (layout.reservedUiWidth > 0) {
      this.uiRail
        .setSize(layout.reservedUiWidth, layout.viewportHeight)
        .setStrokeStyle(1, THEME_COLORS.panelBorder, 0.8)
        .setVisible(true);
    } else {
      this.uiRail.setVisible(false);
    }
  }

  public setSelection(coordinate?: TileCoordinate): void {
    const tile =
      coordinate === undefined
        ? undefined
        : getTile(this.world, coordinate.x, coordinate.y);
    const nextCoordinate =
      tile === undefined ? undefined : { x: tile.x, y: tile.y };

    const nextText = formatSelectedTilePanelText(
      this.world,
      nextCoordinate,
      this.source?.getBuildingState(),
      this.source?.getPopulationState(),
      this.source?.getFoodState(),
      this.source?.getPowerSnapshot(),
      this.source?.getWorkersState(),
    );

    if (
      this.coordinatesMatch(this.selectedCoordinate, nextCoordinate) &&
      this.text.text === nextText
    ) {
      this.updateWorkerButton();
      return;
    }

    this.selectedCoordinate = nextCoordinate;
    this.text.setText(nextText);
    this.background.setSize(this.background.width, nextCoordinate === undefined ? 54 : this.layoutHeight);
    this.updateWorkerButton();
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  public refresh(): void {
    this.setSelection(this.selectedCoordinate);
    this.updateWorkerButton();
  }

  public setTutorialHighlighted(highlighted: boolean): void {
    this.workerButton.setAttention(highlighted);
    this.background.setStrokeStyle(
      highlighted ? 2 : 1,
      highlighted ? THEME_COLORS.validBright : THEME_COLORS.panelBorder,
      highlighted ? 1 : 0.85,
    );
  }

  public ignoreWorldObjects(
    objects: GameObjects.GameObject | readonly GameObjects.GameObject[],
  ): void {
    this.uiCamera.ignore(objects as GameObjects.GameObject | GameObjects.GameObject[]);
  }

  private coordinatesMatch(
    first: TileCoordinate | undefined,
    second: TileCoordinate | undefined,
  ): boolean {
    if (first === undefined || second === undefined) {
      return first === second;
    }

    return first.x === second.x && first.y === second.y;
  }

  private getSelectedBuilding() {
    if (this.selectedCoordinate === undefined || this.source === undefined) {
      return undefined;
    }

    return findBuildingAt(this.source.getBuildingState(), this.selectedCoordinate);
  }

  private updateWorkerButton(): void {
    const building = this.getSelectedBuilding();

    if (
      (building?.type !== "farm" &&
        building?.type !== "forest" &&
        building?.type !== "powerPlant" &&
        building?.type !== "lab") ||
      this.source === undefined
    ) {
      this.workerButton.setVisible(false);
      return;
    }

    const buttonView = createWorkerAssignmentButtonViewModel(
      building.assignedWorkers,
      this.source.getWorkersState().availableWorkers,
    );
    this.workerButton
      .setVisible(true)
      .setText(buttonView.label)
      .setTooltip(buttonView.tooltip)
      .setEnabled(buttonView.enabled);
  }
}

export function validateSelectedTilePanelFoundation(): SelectedTilePanelValidationResult {
  const world = createWorld();
  const errors: string[] = [];
  const noSelectionText = formatSelectedTilePanelText(world);
  const hiddenTileText = formatSelectedTilePanelText(world, { x: 0, y: 0 });
  const revealedTileText = formatSelectedTilePanelText(world, { x: 12, y: 12 });
  const invalidTileText = formatSelectedTilePanelText(world, { x: 32, y: 0 });
  occupyTile(world, 13, 12);
  const farmState: BuildingState = {
    buildings: [
      {
        id: "farm-panel-validation",
        type: "farm",
        status: "constructed",
        coordinate: { x: 13, y: 12 },
        assignedWorkers: 0,
        productionTiming: { accumulatedMilliseconds: 0 },
      },
    ],
  };
  const farmText = formatSelectedTilePanelText(
    world,
    { x: 13, y: 12 },
    farmState,
  );
  const producingFarmState: BuildingState = {
    buildings: [
      {
        ...farmState.buildings[0],
        type: "farm",
        assignedWorkers: 1,
        productionTiming: { accumulatedMilliseconds: 3_200 },
      },
    ],
  };
  const producingFarmText = formatSelectedTilePanelText(
    world,
    { x: 13, y: 12 },
    producingFarmState,
    undefined,
    undefined,
    createSelectedTileValidationPowerSnapshot(["farm-panel-validation"]),
  );
  const unpoweredFarmText = formatSelectedTilePanelText(
    world,
    { x: 13, y: 12 },
    producingFarmState,
  );
  occupyTile(world, 14, 12);
  const forestText = formatSelectedTilePanelText(
    world,
    { x: 14, y: 12 },
    {
      buildings: [
        {
          id: "forest-panel-validation",
          type: "forest",
          status: "constructed",
          coordinate: { x: 14, y: 12 },
          assignedWorkers: 1,
          productionTiming: { accumulatedMilliseconds: 4_000 },
        },
      ],
    },
    undefined,
    undefined,
    createSelectedTileValidationPowerSnapshot(["forest-panel-validation"]),
  );
  occupyTile(world, 15, 12);
  const powerPlantText = formatSelectedTilePanelText(
    world,
    { x: 15, y: 12 },
    {
      buildings: [
        {
          id: "power-panel-validation",
          type: "powerPlant",
          status: "constructed",
          coordinate: { x: 15, y: 12 },
          assignedWorkers: 1,
        },
      ],
    },
  );
  occupyTile(world, 12, 12);
  const homesText = formatSelectedTilePanelText(
    world,
    { x: 12, y: 12 },
    {
      buildings: [
        {
          id: "homes-panel-validation",
          type: "homes",
          status: "constructed",
          coordinate: { x: 12, y: 12 },
        },
      ],
    },
    {
      currentPopulation: 4,
      populationCapacity: 6,
      accumulatedConsumptionMilliseconds: 0,
      accumulatedGrowthMilliseconds: 0,
      latestSupplyStatus: "supplied",
      totalSuppliedCycles: 1,
      totalUnsuppliedCycles: 0,
    },
    { food: 2 },
  );
  const assignButton = createWorkerAssignmentButtonViewModel(0, 1);
  const unavailableButton = createWorkerAssignmentButtonViewModel(0, 0);
  const releaseButton = createWorkerAssignmentButtonViewModel(1, 0);

  if (noSelectionText !== "No tile selected") {
    errors.push("Cleared selection must display the empty-selection message.");
  }

  if (!assignButton.enabled || assignButton.label !== "Assign Worker") {
    errors.push("An unstaffed building with an available worker must allow assignment.");
  }

  if (unavailableButton.enabled || unavailableButton.label !== "No Worker Available") {
    errors.push("An exhausted worker pool must visibly explain why assignment is disabled.");
  }

  if (!releaseButton.enabled || releaseButton.label !== "Release Worker") {
    errors.push("A staffed building must always allow its worker to be released.");
  }

  if (
    !hiddenTileText.includes("Tile: 0, 0") ||
    !hiddenTileText.includes("State: hidden • vacant")
  ) {
    errors.push("Hidden tile details must include all four logical fields.");
  }

  if (!revealedTileText.includes("State: revealed • vacant")) {
    errors.push("Revealed tile details must display revealed state.");
  }

  if (invalidTileText !== "No tile selected") {
    errors.push("Invalid coordinates must display the empty-selection message.");
  }

  if (
    !farmText.includes("Building: Farm") ||
    !farmText.includes("Assigned workers: 0 / 1") ||
    !farmText.includes("Rate: 1 Food / 5s") ||
    !farmText.includes("Progress: 0% • 5.0s left") ||
    !farmText.includes("Status: Unstaffed")
  ) {
    errors.push("Selected Farm details must expose staffing and production.");
  }

  if (
    !producingFarmText.includes("Progress: 64% • 1.8s left") ||
    !producingFarmText.includes("Power: Powered") ||
    !producingFarmText.includes("Status: Producing")
  ) {
    errors.push("Selected Farm progress text must match its timing state.");
  }

  if (
    !unpoweredFarmText.includes("Power: No Power") ||
    !unpoweredFarmText.includes("Status: No Power")
  ) {
    errors.push("A staffed unpowered producer must be distinct from unstaffed.");
  }

  if (
    !forestText.includes("Building: Forest") ||
    !forestText.includes("Assigned workers: 1 / 1") ||
    !forestText.includes("Power: Powered") ||
    !forestText.includes("Production: 5 Materials / 10s") ||
    !forestText.includes("Progress: 40% • 6.0s left") ||
    !forestText.includes("Status: Producing")
  ) {
    errors.push("Selected Forest details must expose staffing and production.");
  }

  if (
    !powerPlantText.includes("Building: Power Plant") ||
    !powerPlantText.includes("Assigned workers: 1 / 1") ||
    !powerPlantText.includes("Output: 4 / 4 Power") ||
    !powerPlantText.includes("Status: Generating")
  ) {
    errors.push("Selected Power Plant details must expose staffing and output.");
  }

  if (
    !homesText.includes("Building: Homes") ||
    !homesText.includes("Capacity provided: +2") ||
    !homesText.includes("Colony population: 4") ||
    !homesText.includes("Colony capacity: 6") ||
    !homesText.includes("Growth: Eligible to grow")
  ) {
    errors.push("Selected Homes details must derive colony growth state.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function formatProducerStatus(
  status: "unstaffed" | "producing" | "no-power",
): "Unstaffed" | "Producing" | "No Power" {
  switch (status) {
    case "unstaffed":
      return "Unstaffed";
    case "producing":
      return "Producing";
    case "no-power":
      return "No Power";
  }
}

function createSelectedTileValidationPowerSnapshot(
  poweredBuildingIds: readonly string[],
): PowerAllocationSnapshot {
  return Object.freeze({
    totalPowerGenerated: poweredBuildingIds.length,
    totalPowerDemand: poweredBuildingIds.length,
    totalPowerAllocated: poweredBuildingIds.length,
    availablePower: 0,
    poweredBuildingIds: Object.freeze([...poweredBuildingIds]),
    unpoweredBuildingIds: Object.freeze([]),
    allocations: Object.freeze([]),
  });
}

function formatHomesGrowthState(
  populationState: PopulationState,
  foodState: FoodState,
):
  | "At capacity"
  | "Waiting for supplied cycle"
  | "Waiting for Food"
  | "Eligible to grow" {
  const eligibility = getPopulationGrowthEligibility(
    populationState,
    foodState,
  );

  switch (eligibility.status) {
    case "at-capacity":
      return "At capacity";
    case "colony-unsupplied":
    case "invalid-state":
      return "Waiting for supplied cycle";
    case "insufficient-food":
      return "Waiting for Food";
    case "eligible":
      return "Eligible to grow";
  }
}

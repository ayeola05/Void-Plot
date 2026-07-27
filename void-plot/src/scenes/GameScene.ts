import { Input, Scene } from "phaser";
import { createRunStatistics, type RunStatistics } from "../game/runStatistics";
import { getSoundEventBus, type SoundEventBus, type GameSoundEvent } from "../game/soundEvents";

import {
  BuildingPlacementController,
  BuildingPlacementPreview,
  ExpeditionSectorPreview,
  ExpeditionSectorSelectionController,
  WorldCameraController,
  WorldRenderer,
  WorldAtmosphere,
  WorldTileInteractionController,
  calculateResponsiveGameLayout,
  THEME_COLORS,
} from "../rendering";
import {
  advanceActiveExpedition,
  activateBeacon,
  advanceBeaconProgression,
  advanceEventTiming,
  advanceFarmProduction,
  advanceForestProduction,
  advanceModifiers,
  advanceLabResearchProduction,
  advanceResearchProgression,
  advancePopulationCycles as processPopulationCycles,
  assignWorkerToFarm,
  assignWorkerToForest,
  assignWorkerToPowerPlant,
  assignWorkerToLab,
  canAffordMaterials,
  createBuildingState,
  createBeaconState,
  createDynamicEventState,
  createExpeditionState,
  createFoodState,
  createMaterialsState,
  createModifierState,
  createResearchState,
  createPopulationState,
  createWorkersState,
  calculatePowerAllocation,
  createEmptyPowerSnapshot,
  getBuildingDefinition,
  getActiveExpedition,
  getExpeditionCountdown,
  getActiveEvent,
  getFarmProductionMultiplier,
  getForestProductionBonus,
  hasActiveResearchLab,
  hasPowerShortage,
  getPowerPlantOutputAdjustment,
  calculateResearchModifiers,
  refreshBeaconDerivedState,
  placeBuilding,
  increasePopulationCapacity,
  releaseWorkerFromFarm,
  releaseWorkerFromForest,
  releaseWorkerFromPowerPlant,
  releaseWorkerFromLab,
  recruitWorker,
  resolveEventChoice,
  startExpeditionFromSector,
  validateBuildingPlacement,
  validateEventChoice,
  validateRuntimeInvariants,
  selectTechnology,
  type BuildingPlacementOperationResult,
  type BuildingPlacementValidationResult,
  type BeaconDerivationContext,
  type BeaconState,
  type BuildingState,
  type BuildingType,
  type ExpeditionState,
  type DynamicEventState,
  type EventChoiceAvailability,
  type FarmProductionEvent,
  type ForestProductionEvent,
  type FoodState,
  type MaterialsState,
  type ModifierState,
  type ResearchState,
  type ResearchModifierSnapshot,
  type TechnologyId,
  type PopulationState,
  type PopulationConsumptionEvent,
  type PopulationGrowthEvent,
  type PowerAllocationSnapshot,
  type WorkersState,
} from "../simulation";
import {
  BuildPanel,
  getConstructionCardIdentity,
  BeaconPanel,
  EventDilemmaModal,
  ExpeditionPlanningPanel,
  ResourcePanel,
  ResearchPanel,
  SelectedTilePanel,
  NotificationStack,
  type NotificationPriority,
  OnboardingPanel,
  MobileGameplayNavigation,
  type MobileGameplayPanel,
  type ConstructionCardViewModel,
} from "../ui";
import { createWorld, type TileCoordinate, type WorldState } from "../world";
import {
  DEFAULT_ACCESSIBILITY_SETTINGS,
  getAccessibilitySettings,
  type AccessibilitySettings,
} from "../game/accessibility";

const EMPTY_FARM_PRODUCTION_EVENTS = Object.freeze(
  [],
) as readonly FarmProductionEvent[];
const EMPTY_CONSUMPTION_EVENTS = Object.freeze(
  [],
) as readonly PopulationConsumptionEvent[];
const EMPTY_GROWTH_EVENTS = Object.freeze(
  [],
) as readonly PopulationGrowthEvent[];
const EMPTY_FOREST_PRODUCTION_EVENTS = Object.freeze(
  [],
) as readonly ForestProductionEvent[];
const EXPEDITION_TUTORIAL_ORIGIN = Object.freeze({ x: 10, y: 12 });

export const GAMEPLAY_UPDATE_ORDER = Object.freeze([
  "beacon-progression",
  "temporary-modifiers",
  "power-allocation",
  "farm-food-production",
  "forest-materials-production",
  "research-production",
  "research-progression",
  "colony-food-consumption",
  "population-growth",
  "dynamic-events",
  "ui-and-rendering-feedback",
] as const);

export class Game extends Scene {
  private world!: WorldState;
  private worldRenderer!: WorldRenderer;
  private worldAtmosphere!: WorldAtmosphere;
  private worldCameraController!: WorldCameraController;
  private worldTileInteractionController!: WorldTileInteractionController;
  private expeditionSectorPreview!: ExpeditionSectorPreview;
  private expeditionSectorSelectionController!: ExpeditionSectorSelectionController;
  private selectedTilePanel!: SelectedTilePanel;
  private expeditionPlanningPanel!: ExpeditionPlanningPanel;
  private buildingPlacementController!: BuildingPlacementController;
  private buildingPlacementPreview!: BuildingPlacementPreview;
  private buildPanel!: BuildPanel;
  private resourcePanel!: ResourcePanel;
  private eventDilemmaModal!: EventDilemmaModal;
  private researchPanel!: ResearchPanel;
  private beaconPanel!: BeaconPanel;
  private notificationStack!: NotificationStack;
  private onboardingPanel!: OnboardingPanel;
  private mobileGameplayNavigation!: MobileGameplayNavigation;
  private mobileLayoutActive = false;
  private soundEvents!: SoundEventBus;
  private statistics: RunStatistics = createRunStatistics();
  private simulationFrozen = false;
  private powerShortageNotified = false;
  private victoryAvailableNotified = false;
  private buildingState: BuildingState = createBuildingState();
  private populationState!: PopulationState;
  private expeditionState: ExpeditionState = createExpeditionState();
  private materialsState!: MaterialsState;
  private workersState!: WorkersState;
  private foodState!: FoodState;
  private powerSnapshot: PowerAllocationSnapshot = createEmptyPowerSnapshot();
  private dynamicEventState: DynamicEventState = createDynamicEventState();
  private modifierState: ModifierState = createModifierState();
  private researchState: ResearchState = createResearchState();
  private researchModifiers: ResearchModifierSnapshot = calculateResearchModifiers(
    this.researchState,
  );
  private beaconState: BeaconState = createBeaconState();
  private expeditionIdSequence = 1;
  private buildingIdSequence = 1;
  private currentTimeMilliseconds = 0;
  private accessibility: AccessibilitySettings = DEFAULT_ACCESSIBILITY_SETTINGS;
  private nextInvariantCheckMilliseconds = 0;
  private pauseKey?: Input.Keyboard.Key;

  public constructor() {
    super("Game");
  }

  public create(): void {
    this.buildingState = createBuildingState();
    this.expeditionState = createExpeditionState();
    this.modifierState = createModifierState();
    this.researchState = createResearchState();
    this.researchModifiers = calculateResearchModifiers(this.researchState);
    this.beaconState = createBeaconState();
    this.dynamicEventState = createDynamicEventState();
    this.statistics = createRunStatistics();
    this.simulationFrozen = false;
    this.powerShortageNotified = false;
    this.victoryAvailableNotified = false;
    this.nextInvariantCheckMilliseconds = 0;
    this.input.enabled = true;
    const materials = createMaterialsState();
    const workers = createWorkersState();
    const population = createPopulationState();
    const food = createFoodState();

    if (
      materials.status !== "created" ||
      workers.status !== "created" ||
      population.status !== "created" ||
      food.status !== "created"
    ) {
      throw new Error("Default playable states must be valid.");
    }

    this.materialsState = materials.state;
    this.workersState = workers.state;
    this.populationState = population.state;
    this.foodState = food.state;
    this.statistics.populationPeak = this.populationState.currentPopulation;
    this.soundEvents = getSoundEventBus(this.registry);
    this.recalculatePower();
    this.currentTimeMilliseconds = this.time.now;
    this.world = createWorld();
    this.worldRenderer = new WorldRenderer(this);
    const worldBounds = this.worldRenderer.render(this.world);
    this.worldAtmosphere = new WorldAtmosphere(this, worldBounds);
    this.worldAtmosphere.setPhase(this.beaconState.currentPhase);
    this.worldCameraController = new WorldCameraController(this, worldBounds);
    this.worldTileInteractionController = new WorldTileInteractionController(
      this,
      this.world,
      this.worldRenderer,
      worldBounds,
    );
    this.expeditionSectorPreview = new ExpeditionSectorPreview(
      this,
      worldBounds,
    );
    this.expeditionSectorSelectionController =
      new ExpeditionSectorSelectionController(
        this,
        this.world,
        this.worldTileInteractionController,
        this.expeditionSectorPreview,
      );
    this.buildingPlacementPreview = new BuildingPlacementPreview(
      this,
      worldBounds,
    );
    this.buildingPlacementController = new BuildingPlacementController(
      this,
      this.worldTileInteractionController,
      this.buildingPlacementPreview,
      {
        validatePlacement: (coordinate, type) =>
          this.validateBuildingPlacementWithRecoveryReserve(coordinate, type),
        requestPlacement: (coordinate, type) =>
          this.requestBuildingPlacement(coordinate, type),
        canContinuePlacement: (type) =>
          canAffordMaterials(
            this.materialsState,
            Math.ceil(getBuildingDefinition(type).materialCost * this.getResearchModifiers().buildingCostMultiplier),
          ).status === "affordable",
        placementModeChanged: (active) =>
          this.expeditionSectorSelectionController.setEnabled(!active),
      },
    );
    this.selectedTilePanel = new SelectedTilePanel(this, this.world, {
      getBuildingState: () => this.buildingState,
      getWorkersState: () => this.workersState,
      getPopulationState: () => this.populationState,
      getFoodState: () => this.foodState,
      getPowerSnapshot: () => this.powerSnapshot,
      requestAssignFarmWorker: (buildingId) =>
        this.requestAssignFarmWorker(buildingId),
      requestReleaseFarmWorker: (buildingId) =>
        this.requestReleaseFarmWorker(buildingId),
      requestAssignForestWorker: (buildingId) =>
        this.requestAssignForestWorker(buildingId),
      requestReleaseForestWorker: (buildingId) =>
        this.requestReleaseForestWorker(buildingId),
      requestAssignPowerPlantWorker: (buildingId) =>
        this.requestAssignPowerPlantWorker(buildingId),
      requestReleasePowerPlantWorker: (buildingId) =>
        this.requestReleasePowerPlantWorker(buildingId),
      requestAssignLabWorker: (buildingId) => this.requestAssignLabWorker(buildingId),
      requestReleaseLabWorker: (buildingId) => this.requestReleaseLabWorker(buildingId),
    });
    this.resourcePanel = new ResourcePanel(this, {
      getMaterialsState: () => this.materialsState,
      getWorkersState: () => this.workersState,
      getPopulationState: () => this.populationState,
      getFoodState: () => this.foodState,
      getPowerSnapshot: () => this.powerSnapshot,
      getModifierState: () => this.modifierState,
      getResearchState: () => this.researchState,
      requestRecruitWorker: () => this.requestRecruitWorker(),
    });
    this.buildPanel = new BuildPanel(this, {
      getFeedbackStatus: () =>
        this.buildingPlacementController.getFeedbackStatus(),
      isPlacementModeActive: () =>
        this.buildingPlacementController.isPlacementModeActive(),
      getSelectedBuildingType: () =>
        this.buildingPlacementController.getSelectedBuildingType(),
      getPresentationRevision: () => this.getBuildingPresentationRevision(),
      selectBuilding: (type) => {
        this.buildingPlacementController.selectBuilding(type);
        this.soundEvents.emit("buildingSelected");
      },
      cancelPlacement: () =>
        this.buildingPlacementController.cancelPlacementMode(),
      getBuildingCardView: (type) => this.getBuildingCardView(type),
    });
    this.expeditionPlanningPanel = new ExpeditionPlanningPanel(
      this,
      this.world,
      this.expeditionSectorSelectionController,
      {
        getExpeditionState: () => this.expeditionState,
        getMaterialsState: () => this.materialsState,
        getWorkersState: () => this.workersState,
        getCurrentTimeMilliseconds: () => this.currentTimeMilliseconds,
        requestStartExpedition: () => this.requestStartExpedition(),
        getResearchModifiers: () => this.getResearchModifiers(),
        getMaterialRecoveryWarning: (cost) => this.getMaterialRecoveryWarning(cost),
      },
    );
    this.mobileGameplayNavigation = new MobileGameplayNavigation(this, {
      selectPanel: (panel) => this.showMobileGameplayPanel(panel),
      zoomIn: () => this.worldCameraController.zoomIn(),
      zoomOut: () => this.worldCameraController.zoomOut(),
    });
    this.researchPanel = new ResearchPanel(this, {
      getResearchState: () => this.researchState,
      selectTechnology: (id) => this.requestSelectTechnology(id),
      isLabProducing: () => hasActiveResearchLab(this.buildingState, this.powerSnapshot),
    });
    this.beaconPanel = new BeaconPanel(this, {
      getBeaconState: () => this.beaconState,
      activateBeacon: () => this.requestActivateBeacon(),
    });
    this.eventDilemmaModal = new EventDilemmaModal(this, {
      getActiveEvent: () => getActiveEvent(this.dynamicEventState),
      getChoiceAvailability: (choiceId) =>
        this.getEventChoiceAvailability(choiceId),
      resolveChoice: (choiceId) => this.requestResolveEventChoice(choiceId),
    });
    this.notificationStack = new NotificationStack(this);
    this.onboardingPanel = new OnboardingPanel(this, {
      getSelectedTile: () => this.worldTileInteractionController.getSelectedTileCoordinate(),
      getBuildingState: () => this.buildingState,
      getExpeditionState: () => this.expeditionState,
      getResearchState: () => this.researchState,
      getStatistics: () => this.statistics,
    });
    this.applyAccessibility();
    if (!this.accessibility.reducedMotion) this.cameras.cameras[1]?.fadeIn(260, 7, 10, 12);
    this.pauseKey = this.input.keyboard?.addKey(Input.Keyboard.KeyCodes.ESC);
    this.pauseKey?.on("down", this.requestPause, this);
    this.applyResponsiveLayout(this.scale.width, this.scale.height);
    this.scale.on("resize", this.handleResize, this);
    this.events.once("shutdown", () => {
      this.scale.off("resize", this.handleResize, this);
      this.events.off("resume", this.applyAccessibility, this);
      this.pauseKey?.off("down", this.requestPause, this);
      this.pauseKey = undefined;
      this.worldAtmosphere.destroy();
    });
    this.events.on("resume", this.applyAccessibility, this);
  }

  public update(_time: number, delta: number): void {
    const sceneTime = this.time.now;

    if (this.simulationFrozen) {
      this.worldRenderer.updateBeacon(this.beaconState.currentPhase, this.accessibility.reducedMotion ? 0 : sceneTime);
      this.worldRenderer.updateDecorations(sceneTime);
      this.notificationStack.update(sceneTime);
      return;
    }

    this.currentTimeMilliseconds = sceneTime;
    this.statistics.runTimeMilliseconds += delta;
    this.statistics.populationPeak = Math.max(this.statistics.populationPeak, this.populationState.currentPopulation);
    const beaconProgression = advanceBeaconProgression(
      this.beaconState,
      delta,
      this.getBeaconContext(),
    );
    if (beaconProgression !== undefined) {
      if (beaconProgression.phaseNumber > this.beaconState.phaseNumber) {
        this.statistics.beaconPhaseReached = beaconProgression.phaseNumber;
        this.notify(`Beacon Phase Advanced — ${beaconProgression.currentPhase}`, "beaconAdvance");
        this.worldAtmosphere.setPhase(beaconProgression.currentPhase);
      }
      this.beaconState = beaconProgression;
    }
    const modifierResult = advanceModifiers(this.modifierState, delta);
    if (modifierResult.status === "advanced") {
      this.modifierState = modifierResult.state;
    }
    this.recalculatePower();
    const powerShortage = hasPowerShortage(this.powerSnapshot);
    if (powerShortage && !this.powerShortageNotified) {
      this.notify("Power Shortage", "warning");
    }
    this.powerShortageNotified = powerShortage;
    const farmProductionEvents = this.advanceFarmProduction(sceneTime);
    const forestProductionEvents = this.advanceForestProduction(delta);
    this.advanceResearch(delta);
    const populationCycleEvents = this.advancePopulationCycles(delta);
    this.advanceDynamicEvents(delta);
    this.advanceExpeditionCountdown(sceneTime);
    this.worldCameraController.update(delta);
    this.worldTileInteractionController.update(this.input.activePointer);
    this.buildingPlacementController.update();
    this.expeditionSectorSelectionController.update();
    this.updateActiveExpeditionWorldMarker(sceneTime);
    this.beaconState = refreshBeaconDerivedState(this.beaconState, this.getBeaconContext());
    this.runDevelopmentInvariantCheck(sceneTime);
    if (this.beaconState.victoryAvailability.status === "available" && !this.victoryAvailableNotified) {
      this.victoryAvailableNotified = true;
      this.notify("Victory Available — Activate the Beacon", "notification");
      this.soundEvents.emit("beaconReady");
    }
    this.applyFarmProductionFeedback(farmProductionEvents, sceneTime);
    this.applyForestProductionFeedback(forestProductionEvents, sceneTime);
    this.applyPopulationFeedback(populationCycleEvents, sceneTime);
    this.selectedTilePanel.setSelection(
      this.worldTileInteractionController.getSelectedTileCoordinate(),
    );
    this.expeditionPlanningPanel.update();
    this.buildPanel.update();
    this.resourcePanel.update(sceneTime);
    this.eventDilemmaModal.update();
    this.researchPanel.update();
    this.beaconPanel.update();
    this.notificationStack.update(sceneTime);
    this.onboardingPanel.update(sceneTime);
    this.updateOnboardingGuidance(sceneTime);
    this.worldRenderer.updateFarmProductionIndicators(
      this.buildingState,
      this.powerSnapshot,
      sceneTime,
      getFarmProductionMultiplier(this.modifierState) *
        this.getResearchModifiers().farmProductionMultiplier *
        this.beaconState.modifiers.farmProductionMultiplier,
      this.accessibility.reducedMotion,
    );
    this.worldRenderer.updateForestProductionIndicators(
      this.buildingState,
      this.powerSnapshot,
      sceneTime,
      this.getResearchModifiers().forestProductionMultiplier *
        this.beaconState.modifiers.forestProductionMultiplier,
      this.accessibility.reducedMotion,
    );
    this.worldRenderer.updateProductionPopups(sceneTime);
    this.worldRenderer.updateAmbientParticles(delta);
    this.worldRenderer.updateBuildingLife(sceneTime, this.accessibility.reducedMotion);
    this.worldAtmosphere.update(sceneTime);
    this.worldRenderer.updateDecorations(sceneTime);
    this.worldRenderer.updatePowerPlantIndicators(
      this.buildingState,
      sceneTime,
      this.accessibility.reducedMotion,
    );
    this.worldRenderer.updateLabIndicators(this.buildingState, this.powerSnapshot, sceneTime, this.accessibility.reducedMotion);
    this.worldRenderer.updateBeacon(this.beaconState.currentPhase, this.accessibility.reducedMotion ? 0 : sceneTime);
  }

  private requestBuildingPlacement(
    coordinate: TileCoordinate,
    type: BuildingType,
  ): BuildingPlacementOperationResult {
    const recoveryValidation = this.validateBuildingPlacementWithRecoveryReserve(coordinate, type);
    if (recoveryValidation.status !== "valid") return recoveryValidation;
    const result = placeBuilding(
      this.world,
      this.materialsState,
      this.buildingState,
      this.populationState,
      coordinate,
      type,
      () => `building-${this.buildingIdSequence++}`,
      {
        costMultiplier: this.getResearchModifiers().buildingCostMultiplier,
        homesCapacityAddition: this.getResearchModifiers().homesCapacityAddition,
      },
    );

    if (result.status !== "placed") {
      return result;
    }

    this.materialsState = result.materialsState;
    this.buildingState = result.buildingState;
    this.populationState = result.populationState;
    this.statistics.buildingsBuilt += 1;
    this.notify(`${getBuildingDefinition(type).label} Constructed`, "buildingPlaced");
    this.recalculatePower();
    this.worldRenderer.refreshTile(this.world, coordinate);
    const buildingView =
      result.building.type === "farm"
        ? this.worldRenderer.renderFarmBuilding(
            result.building.id,
            coordinate,
            false,
          )
        : result.building.type === "forest"
          ? this.worldRenderer.renderForestBuilding(
              result.building.id,
              coordinate,
              false,
            )
          : result.building.type === "powerPlant"
            ? this.worldRenderer.renderPowerPlantBuilding(
                result.building.id,
                coordinate,
                false,
              )
          : result.building.type === "lab"
            ? this.worldRenderer.renderLabBuilding(result.building.id, coordinate, false)
          : this.worldRenderer.renderHomesBuilding(
              result.building.id,
              coordinate,
            );

    if (buildingView !== undefined) {
      this.selectedTilePanel.ignoreWorldObjects(buildingView);
      buildingView.setScale(0.25).setAlpha(0.35);
      this.tweens.add({
        targets: buildingView,
        scaleX: 1,
        scaleY: 1,
        alpha: 1,
        duration: 260,
        ease: "Back.Out",
      });
      this.giveCameraImpact(115, 0.0022);
      this.worldAtmosphere.flash(this, THEME_COLORS.accent, 120);
    }
    this.selectedTilePanel.setSelection(
      this.worldTileInteractionController.getSelectedTileCoordinate(),
    );
    this.expeditionPlanningPanel.update();
    this.buildPanel.update();
    this.resourcePanel.update();
    return result;
  }

  private requestAssignFarmWorker(buildingId: string): void {
    const result = assignWorkerToFarm(
      this.buildingState,
      this.workersState,
      buildingId,
      this.time.now,
    );

    if (result.status !== "assigned") {
      this.notify(
        result.status === "insufficient-workers"
          ? "No worker available — recruit one or release a staffed worker"
          : "Farm worker assignment could not be completed",
        "warning",
      );
      this.selectedTilePanel.refresh();
      return;
    }

    this.buildingState = result.buildingState;
    this.workersState = result.workersState;
    this.soundEvents.emit("workerAssigned");
    this.recalculatePower();
    this.worldRenderer.setFarmStaffed(buildingId, true);
    this.selectedTilePanel.refresh();
    this.resourcePanel.update();
    this.expeditionPlanningPanel.update();
  }

  private requestReleaseFarmWorker(buildingId: string): void {
    const result = releaseWorkerFromFarm(
      this.buildingState,
      this.workersState,
      buildingId,
      this.time.now,
    );

    if (result.status !== "released") {
      return;
    }

    this.buildingState = result.buildingState;
    this.workersState = result.workersState;
    this.soundEvents.emit("workerReleased");
    this.recalculatePower();
    this.worldRenderer.setFarmStaffed(buildingId, false);
    this.selectedTilePanel.refresh();
    this.resourcePanel.update();
    this.expeditionPlanningPanel.update();
  }

  private requestAssignForestWorker(buildingId: string): void {
    const result = assignWorkerToForest(
      this.buildingState,
      this.workersState,
      buildingId,
    );

    if (result.status !== "assigned") {
      return;
    }

    this.buildingState = result.buildingState;
    this.workersState = result.workersState;
    this.soundEvents.emit("workerAssigned");
    this.recalculatePower();
    this.worldRenderer.setForestStaffed(buildingId, true);
    this.selectedTilePanel.refresh();
    this.resourcePanel.update();
    this.expeditionPlanningPanel.update();
  }

  private requestReleaseForestWorker(buildingId: string): void {
    const result = releaseWorkerFromForest(
      this.buildingState,
      this.workersState,
      buildingId,
    );

    if (result.status !== "released") {
      return;
    }

    this.buildingState = result.buildingState;
    this.workersState = result.workersState;
    this.soundEvents.emit("workerReleased");
    this.recalculatePower();
    this.worldRenderer.setForestStaffed(buildingId, false);
    this.selectedTilePanel.refresh();
    this.resourcePanel.update();
    this.expeditionPlanningPanel.update();
  }

  private requestAssignPowerPlantWorker(buildingId: string): void {
    const result = assignWorkerToPowerPlant(
      this.buildingState,
      this.workersState,
      buildingId,
    );

    if (result.status !== "assigned") {
      return;
    }

    this.buildingState = result.buildingState;
    this.workersState = result.workersState;
    this.soundEvents.emit("workerAssigned");
    this.recalculatePower();
    this.worldRenderer.setPowerPlantStaffed(buildingId, true);
    this.selectedTilePanel.refresh();
    this.resourcePanel.update();
    this.expeditionPlanningPanel.update();
  }

  private requestReleasePowerPlantWorker(buildingId: string): void {
    const result = releaseWorkerFromPowerPlant(
      this.buildingState,
      this.workersState,
      buildingId,
    );

    if (result.status !== "released") {
      return;
    }

    this.buildingState = result.buildingState;
    this.workersState = result.workersState;
    this.soundEvents.emit("workerReleased");
    this.recalculatePower();
    this.worldRenderer.setPowerPlantStaffed(buildingId, false);
    this.selectedTilePanel.refresh();
    this.resourcePanel.update();
    this.expeditionPlanningPanel.update();
  }

  private requestAssignLabWorker(buildingId: string): void {
    const result = assignWorkerToLab(this.buildingState, this.workersState, buildingId);
    if (result.status !== "assigned") return;
    this.buildingState = result.buildingState;
    this.workersState = result.workersState;
    this.soundEvents.emit("workerAssigned");
    this.recalculatePower();
    this.worldRenderer.setLabStaffed(buildingId, true);
    this.selectedTilePanel.refresh();
    this.resourcePanel.update();
  }

  private requestReleaseLabWorker(buildingId: string): void {
    const result = releaseWorkerFromLab(this.buildingState, this.workersState, buildingId);
    if (result.status !== "released") return;
    this.buildingState = result.buildingState;
    this.workersState = result.workersState;
    this.soundEvents.emit("workerReleased");
    this.recalculatePower();
    this.worldRenderer.setLabStaffed(buildingId, false);
    this.selectedTilePanel.refresh();
    this.resourcePanel.update();
  }

  private requestRecruitWorker(): void {
    const result = recruitWorker(
      this.populationState,
      this.workersState,
      this.foodState,
      this.getResearchModifiers().recruitmentFoodCost,
    );

    if (result.status !== "recruited") {
      return;
    }

    this.foodState = result.foodState;
    this.workersState = result.workersState;
    this.statistics.workersRecruited += 1;
    this.soundEvents.emit("workerRecruited");
    this.notify("Worker Recruited", "notification");
    this.resourcePanel.notifyWorkerRecruited(this.time.now);
    this.selectedTilePanel.refresh();
    this.expeditionPlanningPanel.update();
  }

  private advanceFarmProduction(
    time: number,
  ): readonly FarmProductionEvent[] {
    const result = advanceFarmProduction(
      this.buildingState,
      this.foodState,
      time,
      this.powerSnapshot,
      { productionRateMultiplier: getFarmProductionMultiplier(this.modifierState) * this.getResearchModifiers().farmProductionMultiplier * this.beaconState.modifiers.farmProductionMultiplier },
    );

    if (result.status !== "advanced") {
      return EMPTY_FARM_PRODUCTION_EVENTS;
    }

    this.buildingState = result.buildingState;
    this.foodState = result.foodState;

    return result.productionEvents;
  }

  private advanceForestProduction(
    elapsedMilliseconds: number,
  ): readonly ForestProductionEvent[] {
    const result = advanceForestProduction(
      this.buildingState,
      this.materialsState,
      elapsedMilliseconds,
      this.powerSnapshot,
      { bonusMaterialsPerInterval: getForestProductionBonus(this.modifierState), productionRateMultiplier: this.getResearchModifiers().forestProductionMultiplier * this.beaconState.modifiers.forestProductionMultiplier },
    );

    if (result.status !== "advanced") {
      return EMPTY_FOREST_PRODUCTION_EVENTS;
    }

    this.buildingState = result.buildingState;
    this.materialsState = result.materialsState;
    return result.productionEvents;
  }

  private requestStartExpedition(): void {
    const selectedSector =
      this.expeditionSectorSelectionController.getSelectedSector();

    if (selectedSector === undefined) {
      return;
    }

    const baseCost = selectedSector.size === 2 ? 20 : selectedSector.size === 4 ? 60 : 140;
    const expeditionCost = Math.ceil(baseCost * this.getResearchModifiers().expeditionCostMultiplier);
    const recoveryWarning = this.getMaterialRecoveryWarning(expeditionCost);
    if (recoveryWarning !== undefined) {
      this.notify(recoveryWarning, "warning");
      return;
    }

    const result = startExpeditionFromSector(
      this.world,
      this.expeditionState,
      this.materialsState,
      this.workersState,
      selectedSector,
      () => `expedition-${this.expeditionIdSequence++}`,
      { now: () => this.time.now },
      {
        materialCostMultiplier: this.getResearchModifiers().expeditionCostMultiplier,
        durationMultiplier: this.getResearchModifiers().expeditionDurationMultiplier,
      },
    );

    if (result.status === "activated") {
      this.expeditionState = result.expeditionState;
      this.materialsState = result.materialsState;
      this.workersState = result.workersState;
      this.soundEvents.emit("workerAssigned");
      this.soundEvents.emit("expeditionStarted");
      this.expeditionPlanningPanel.update();
      this.resourcePanel.update();
      return;
    }

    if (result.status === "activation-failed") {
      this.expeditionState = result.expeditionState;
    }
  }

  private advancePopulationCycles(elapsedMilliseconds: number): {
    consumptionEvents: readonly PopulationConsumptionEvent[];
    growthEvents: readonly PopulationGrowthEvent[];
  } {
    const result = processPopulationCycles(
      this.populationState,
      this.foodState,
      elapsedMilliseconds,
      this.getResearchModifiers().populationGrowthIntervalMultiplier,
      this.beaconState.modifiers.populationFoodConsumptionMultiplier,
    );

    if (result.status !== "processed") {
      return {
        consumptionEvents: EMPTY_CONSUMPTION_EVENTS,
        growthEvents: EMPTY_GROWTH_EVENTS,
      };
    }

    this.populationState = result.populationState;
    this.foodState = result.foodState;
    return {
      consumptionEvents: result.consumptionEvents,
      growthEvents: result.growthEvents,
    };
  }

  private applyFarmProductionFeedback(
    events: readonly FarmProductionEvent[],
    sceneTimeMilliseconds: number,
  ): void {
    if (events.length === 0) {
      return;
    }

    const newPopupObjects = this.worldRenderer.showFoodProduction(
      events,
      sceneTimeMilliseconds,
    );

    if (newPopupObjects.length > 0) {
      this.selectedTilePanel.ignoreWorldObjects(newPopupObjects);
    }

    this.resourcePanel.notifyFoodProduced(
      events[events.length - 1].newFoodBalance,
    );
    this.statistics.foodProduced += events.reduce((total, event) => total + event.foodProduced, 0);
    this.soundEvents.emit("foodProduced");
  }

  private applyPopulationFeedback(
    events: {
      consumptionEvents: readonly PopulationConsumptionEvent[];
      growthEvents: readonly PopulationGrowthEvent[];
    },
    sceneTimeMilliseconds: number,
  ): void {
    this.resourcePanel.update(sceneTimeMilliseconds);
    this.resourcePanel.notifyConsumptionEvents(
      events.consumptionEvents,
      sceneTimeMilliseconds,
    );
    this.resourcePanel.notifyGrowthEvents(
      events.growthEvents,
      sceneTimeMilliseconds,
    );
    if (events.consumptionEvents.some((event) => event.supplyStatus === "unsupplied")) {
      this.notify("Food Shortage", "warning");
    }
  }

  private applyForestProductionFeedback(
    events: readonly ForestProductionEvent[],
    sceneTimeMilliseconds: number,
  ): void {
    if (events.length === 0) {
      return;
    }

    const newPopupObjects = this.worldRenderer.showMaterialsProduction(
      events,
      sceneTimeMilliseconds,
    );

    if (newPopupObjects.length > 0) {
      this.selectedTilePanel.ignoreWorldObjects(newPopupObjects);
    }

    this.resourcePanel.notifyMaterialsProduced(
      events,
      sceneTimeMilliseconds,
    );
    this.statistics.materialsProduced += events.reduce((total, event) => total + event.materialsProduced, 0);
    this.soundEvents.emit("materialsProduced");
  }

  private advanceExpeditionCountdown(time: number): void {
    const result = advanceActiveExpedition(
      this.world,
      this.expeditionState,
      this.workersState,
      time,
    );

    if (result.status !== "completed") {
      return;
    }

    this.expeditionState = result.expeditionState;
    this.workersState = result.workersState;
    this.statistics.expeditionsCompleted += 1;
    this.soundEvents.emit("workerReleased");
    this.notify("Expedition Returned", "expeditionReturned");
    this.worldAtmosphere.flash(this, THEME_COLORS.validBright, 180);
    this.worldRenderer.refreshTiles(this.world, result.revealedCoordinates);
    this.expeditionSectorSelectionController.update();
    this.buildingPlacementController.update();
    this.selectedTilePanel.setSelection(
      this.worldTileInteractionController.getSelectedTileCoordinate(),
    );
    this.expeditionPlanningPanel.showCompletionMessage(
      `Expedition complete — ${result.newlyRevealedCount} tiles revealed`,
    );
    this.resourcePanel.update();
  }

  private handleResize(gameSize: { width: number; height: number }): void {
    this.applyResponsiveLayout(gameSize.width, gameSize.height);
  }

  private recalculatePower(): void {
    const result = calculatePowerAllocation(this.buildingState, {
      powerPlantOutputAdjustment: getPowerPlantOutputAdjustment(this.modifierState) + this.getResearchModifiers().powerPlantOutputAddition + this.beaconState.modifiers.powerPlantOutputAdjustment,
      staffedProductionDemandAddition: this.beaconState.modifiers.staffedProductionPowerDemandAddition,
    });
    this.powerSnapshot =
      result.status === "calculated"
        ? result.snapshot
        : createEmptyPowerSnapshot();
  }

  private applyResponsiveLayout(width: number, height: number): void {
    const layout = calculateResponsiveGameLayout(width, height, this.accessibility.uiScale);
    this.mobileLayoutActive = layout.mobile;

    this.worldCameraController.setViewport(layout.gameplay);
    this.selectedTilePanel.setLayout({
      viewportWidth: layout.viewportWidth,
      viewportHeight: layout.viewportHeight,
      x: layout.selectedTilePanel.x,
      y: layout.selectedTilePanel.y,
      width: layout.selectedTilePanel.width,
      height: layout.selectedTilePanel.height,
      reservedUiWidth: layout.uiReservedWidth,
    });
    this.resourcePanel.setLayout(layout.resourcesPanel);
    this.expeditionPlanningPanel.setLayout(layout.expeditionPanel);
    this.buildPanel.setLayout(layout.buildPanel);
    this.mobileGameplayNavigation.setLayout(
      layout.mobileNavigation,
      layout.mobile,
    );
    this.showMobileGameplayPanel(
      this.mobileGameplayNavigation.getActivePanel(),
    );
    this.eventDilemmaModal.setLayout(layout.uiViewportWidth, layout.uiViewportHeight);
    this.researchPanel.setLayout(
      layout.uiViewportWidth,
      layout.mobile
        ? layout.gameplay.height / this.accessibility.uiScale
        : layout.uiViewportHeight,
    );
    this.beaconPanel.setLayout(layout.uiViewportWidth);
    this.onboardingPanel.setLayout(
      layout.uiViewportWidth,
      layout.mobile
        ? layout.gameplay.height / this.accessibility.uiScale
        : layout.uiViewportHeight,
      layout.uiReservedWidth,
    );
  }

  private showMobileGameplayPanel(panel: MobileGameplayPanel): void {
    this.resourcePanel.setVisible(!this.mobileLayoutActive || panel === "resources");
    this.buildPanel.setVisible(!this.mobileLayoutActive || panel === "build");
    this.selectedTilePanel.setVisible(!this.mobileLayoutActive || panel === "tile");
    this.expeditionPlanningPanel.setVisible(
      !this.mobileLayoutActive || panel === "expedition",
    );
  }

  private advanceDynamicEvents(elapsedMilliseconds: number): void {
    const result = advanceEventTiming(this.dynamicEventState, elapsedMilliseconds);
    if (result.status === "advanced" || result.status === "event-opened") {
      this.dynamicEventState = result.state;
      if (result.status === "event-opened") {
        this.statistics.eventsTriggered += 1;
        this.notify(`Event — ${result.event.title}`, "eventOpened");
        this.giveCameraImpact(210, 0.0032);
        this.worldAtmosphere.flash(this, THEME_COLORS.warning, 170);
      }
    }
  }

  private getEventChoiceAvailability(choiceId: string): EventChoiceAvailability {
    const event = getActiveEvent(this.dynamicEventState);
    const choice = event?.choices.find((candidate) => candidate.id === choiceId);
    if (choice === undefined) return { status: "invalid-state" };
    return validateEventChoice(choice, {
      modifiers: this.modifierState,
      food: this.foodState,
      materials: this.materialsState,
      population: this.populationState,
    });
  }

  private requestResolveEventChoice(choiceId: string): void {
    const result = resolveEventChoice(
      {
        events: this.dynamicEventState,
        modifiers: this.modifierState,
        food: this.foodState,
        materials: this.materialsState,
        population: this.populationState,
      },
      choiceId,
    );
    if (result.status !== "resolved") return;
    this.dynamicEventState = result.state.events;
    this.modifierState = result.state.modifiers;
    this.foodState = result.state.food;
    this.materialsState = result.state.materials;
    this.populationState = result.state.population;
    this.statistics.eventsResolved += 1;
    this.soundEvents.emit("eventChoiceSelected");
    this.recalculatePower();
    this.resourcePanel.update(this.time.now);
    this.selectedTilePanel.refresh();
    this.expeditionPlanningPanel.update();
    this.eventDilemmaModal.update();
  }

  private getResearchModifiers(): ResearchModifierSnapshot {
    return this.researchModifiers;
  }

  private advanceResearch(elapsedMilliseconds: number): void {
    const production = advanceLabResearchProduction(this.buildingState, this.researchState, elapsedMilliseconds, this.powerSnapshot);
    if (production.status === "advanced") {
      this.buildingState = production.buildingState;
      this.researchState = production.researchState;
      this.statistics.researchPointsProduced += production.researchPointsProduced;
      if (production.productionEvents.length > 0) {
        const newPopupObjects = this.worldRenderer.showResearchProduction(production.productionEvents, this.buildingState, this.time.now);
        if (newPopupObjects.length > 0) this.selectedTilePanel.ignoreWorldObjects(newPopupObjects);
      }
    }
    const progression = advanceResearchProgression(
      this.researchState,
      hasActiveResearchLab(this.buildingState, this.powerSnapshot),
    );
    if (progression.status === "completed" && progression.technologyId === "improved-housing") {
      const existingHomes = this.buildingState.buildings.filter((building) => building.type === "homes").length;
      if (existingHomes > 0) {
        const capacity = increasePopulationCapacity(this.populationState, existingHomes);
        if (capacity.status === "increased") this.populationState = capacity.state;
      }
    }
    if (progression.status === "completed") {
      this.statistics.researchCompleted += 1;
      this.notify("Research Completed", "researchComplete");
      this.worldAtmosphere.flash(this, THEME_COLORS.labActive, 150);
    }
    if (progression.status !== "invalid-state") {
      this.researchState = progression.state;
      if (progression.status === "completed") {
        this.researchModifiers = calculateResearchModifiers(this.researchState);
      }
    }
    this.selectedTilePanel.refresh();
  }

  private requestSelectTechnology(id: TechnologyId): void {
    const result = selectTechnology(this.researchState, id);
    if (result.status === "selected") this.researchState = result.state;
    if (result.status === "selected") this.soundEvents.emit("researchSelected");
    this.researchPanel.update();
    this.resourcePanel.update();
  }

  private getBeaconContext(): BeaconDerivationContext {
    return {
      population: this.populationState.currentPopulation,
      food: this.foodState.food,
      materials: this.materialsState.materials,
      powerGeneration: this.powerSnapshot.totalPowerGenerated,
      powerShortage: hasPowerShortage(this.powerSnapshot),
      latestPopulationSupplied: this.populationState.latestSupplyStatus !== "unsupplied",
      totalUnsuppliedCycles: this.populationState.totalUnsuppliedCycles,
      completedTechnologies: this.researchState.completedTechnologies,
    };
  }

  private requestActivateBeacon(): void {
    const result = activateBeacon(this.beaconState);
    if (result.status !== "activated") return;
    this.beaconState = result.state;
    this.worldRenderer.pulseBeaconActivation();
    this.worldAtmosphere.flash(this, THEME_COLORS.beaconCore, 520);
    this.beaconPanel.update();
    this.simulationFrozen = true;
    this.input.enabled = false;
    this.soundEvents.emit("victory");
    this.soundEvents.emit("beaconActivated");
    this.giveCameraImpact(700, 0.0065);
    this.cameras.main.pan(320, 320, 1_200, "Quad.easeInOut");
    this.cameras.main.zoomTo(1.55, 1_200, "Quad.easeInOut");
    this.registry.set("lastRunStatistics", this.statistics);
    this.time.delayedCall(900, () => this.scene.launch("Victory", {
      statistics: this.statistics,
      population: this.populationState.currentPopulation,
      food: this.foodState.food,
      materials: this.materialsState.materials,
      researchCompleted: this.researchState.completedTechnologies.length,
      buildingsConstructed: this.buildingState.buildings.length,
      expeditionsCompleted: this.statistics.expeditionsCompleted,
      eventsSurvived: this.statistics.eventsResolved,
    }));
  }

  private requestPause(): void {
    if (this.buildingPlacementController.isPlacementModeActive()) {
      this.buildingPlacementController.cancelPlacementMode();
      return;
    }
    if (this.simulationFrozen || this.scene.isActive("Pause")) return;
    this.scene.pause();
    this.soundEvents.emit("gamePaused");
    this.scene.launch("Pause");
  }

  private notify(message: string, sound: GameSoundEvent): void {
    this.notificationStack.push(message, this.time.now, getNotificationPriority(sound));
    this.soundEvents.emit(sound);
  }

  private applyAccessibility(): void {
    this.accessibility = getAccessibilitySettings(this.registry);
    this.worldRenderer?.setParticlesEnabled(this.accessibility.particles && !this.accessibility.reducedMotion);
    this.worldRenderer?.configureDecorations(this.accessibility.particles, this.accessibility.reducedMotion);
    this.worldAtmosphere?.configure(this.accessibility.particles, this.accessibility.reducedMotion);
    this.worldCameraController?.setReducedMotion(this.accessibility.reducedMotion);
    this.resourcePanel?.setAccessibility(this.accessibility.reducedMotion, this.accessibility.colorblindResourceColors);
    const uiCamera = this.cameras.cameras[1];
    if (uiCamera !== undefined) uiCamera.setZoom(this.accessibility.uiScale);
    if (this.worldCameraController !== undefined && this.onboardingPanel !== undefined) {
      this.applyResponsiveLayout(this.scale.width, this.scale.height);
    }
  }

  private updateOnboardingGuidance(sceneTime: number): void {
    const target = this.onboardingPanel.getCurrentTarget();
    const placementGuidance = target.kind === "building" && this.buildingPlacementController.getSelectedBuildingType() === target.buildingType;
    const placementTile = placementGuidance
      ? this.world.tiles.find((tile) => tile.revealState === "revealed" && tile.occupancyState === "vacant")
      : undefined;
    const expeditionOrigin = target.kind === "expedition-panel" && this.expeditionSectorSelectionController.getSelectedSector() === undefined
      ? EXPEDITION_TUTORIAL_ORIGIN
      : undefined;
    this.worldRenderer.setTutorialTile(target.kind === "world-tile" ? target.coordinate : placementTile ?? expeditionOrigin);
    this.buildPanel.setTutorialTarget(target.kind === "building" && !placementGuidance ? target.buildingType : undefined);
    this.selectedTilePanel.setTutorialHighlighted(target.kind === "selected-panel");
    this.expeditionPlanningPanel.setTutorialHighlighted(target.kind === "expedition-panel" && expeditionOrigin === undefined);
    this.researchPanel.setTutorialHighlighted(target.kind === "research-panel");
    this.beaconPanel.setTutorialHighlighted(target.kind === "beacon-panel");
    this.worldRenderer.updateTutorialHighlight(sceneTime, this.accessibility.reducedMotion);
  }

  private updateActiveExpeditionWorldMarker(sceneTime: number): void {
    const expedition = getActiveExpedition(this.expeditionState);
    if (expedition === undefined) {
      this.expeditionSectorPreview.clearActiveSector();
      return;
    }
    const countdown = getExpeditionCountdown(expedition, sceneTime);
    this.expeditionSectorPreview.showActiveSector(expedition.sector.origin, expedition.sector.size, countdown?.progress ?? 0);
  }

  private giveCameraImpact(duration: number, intensity: number): void {
    if (this.accessibility.screenShake && !this.accessibility.reducedMotion) {
      this.cameras.main.shake(duration, intensity, true);
    }
  }

  private getMaterialRecoveryWarning(plannedSpend: number): string | undefined {
    if (this.buildingState.buildings.some((building) => building.type === "forest")) return undefined;
    const forestCost = Math.ceil(getBuildingDefinition("forest").materialCost * this.getResearchModifiers().buildingCostMultiplier);
    return this.materialsState.materials - plannedSpend < forestCost
      ? `Build a Forest first. Keep ${forestCost} Materials reserved to prevent a resource deadlock.`
      : undefined;
  }

  private getBuildingCardView(type: BuildingType): ConstructionCardViewModel {
    const definition = getBuildingDefinition(type);
    const research = this.getResearchModifiers();
    const cost = Math.ceil(definition.materialCost * research.buildingCostMultiplier);
    const currentMaterials = this.materialsState.materials;
    const affordable = canAffordMaterials(this.materialsState, cost).status === "affordable";
    const reserveWarning = affordable && type !== "forest"
      ? this.getMaterialRecoveryWarning(cost)
      : undefined;
    const availability = !affordable
      ? "unaffordable"
      : reserveWarning !== undefined
        ? "reserve-blocked"
        : "available";
    const identity = getConstructionCardIdentity(type);
    const beaconDemand = definition.maxAssignedWorkers > 0
      ? this.beaconState.modifiers.staffedProductionPowerDemandAddition
      : 0;
    const powerDemand = definition.powerDemand + beaconDemand;
    let functionLine: string;

    switch (type) {
      case "homes":
        functionLine = `Housing capacity: +${definition.populationCapacity + research.homesCapacityAddition}`;
        break;
      case "farm": {
        const output = definition.foodPerProductionInterval * getFarmProductionMultiplier(this.modifierState) * research.farmProductionMultiplier * this.beaconState.modifiers.farmProductionMultiplier;
        functionLine = `Production: ${formatBuildDisplayNumber(output)} Food / ${definition.productionIntervalSeconds}s`;
        break;
      }
      case "forest": {
        const output = (definition.materialsPerProductionInterval + getForestProductionBonus(this.modifierState)) * research.forestProductionMultiplier * this.beaconState.modifiers.forestProductionMultiplier;
        functionLine = `Production: ${formatBuildDisplayNumber(output)} Materials / ${definition.productionIntervalSeconds}s`;
        break;
      }
      case "powerPlant": {
        const output = definition.powerOutput + getPowerPlantOutputAdjustment(this.modifierState) + research.powerPlantOutputAddition + this.beaconState.modifiers.powerPlantOutputAdjustment;
        functionLine = `Generation: ${formatBuildDisplayNumber(output)} Power`;
        break;
      }
      case "lab":
        functionLine = `Production: ${definition.researchPerProductionInterval} RP / ${definition.productionIntervalSeconds}s`;
        break;
    }

    const workerLine = definition.maxAssignedWorkers === 0
      ? "Workers: none"
      : `Workers: ${definition.maxAssignedWorkers} when operating`;
    const powerLine = type === "powerPlant"
      ? "Power demand: none"
      : `Power demand: ${powerDemand}`;
    const shortageLine = availability === "unaffordable"
      ? `\nShortage: ${currentMaterials} / ${cost} Materials.`
      : reserveWarning !== undefined
        ? `\n${reserveWarning}`
        : "";

    return Object.freeze({
      type,
      ...identity,
      cost,
      currentMaterials,
      availability,
      visibleReason: reserveWarning,
      tooltip: `${definition.description}\nCosts ${cost} Materials.\n${functionLine}\n${workerLine} • ${powerLine}${shortageLine}`,
    });
  }

  private getBuildingPresentationRevision(): number {
    const research = this.getResearchModifiers();
    let hash = 2_166_136_261;
    hash = mixBuildingPresentationHash(hash, this.materialsState.materials);
    hash = mixBuildingPresentationHash(hash, research.buildingCostMultiplier);
    hash = mixBuildingPresentationHash(hash, research.homesCapacityAddition);
    hash = mixBuildingPresentationHash(hash, research.farmProductionMultiplier);
    hash = mixBuildingPresentationHash(hash, research.forestProductionMultiplier);
    hash = mixBuildingPresentationHash(hash, research.powerPlantOutputAddition);
    hash = mixBuildingPresentationHash(hash, this.beaconState.modifiers.farmProductionMultiplier);
    hash = mixBuildingPresentationHash(hash, this.beaconState.modifiers.forestProductionMultiplier);
    hash = mixBuildingPresentationHash(hash, this.beaconState.modifiers.staffedProductionPowerDemandAddition);
    hash = mixBuildingPresentationHash(hash, this.beaconState.modifiers.powerPlantOutputAdjustment);
    hash = mixBuildingPresentationHash(hash, getFarmProductionMultiplier(this.modifierState));
    hash = mixBuildingPresentationHash(hash, getForestProductionBonus(this.modifierState));
    hash = mixBuildingPresentationHash(hash, getPowerPlantOutputAdjustment(this.modifierState));
    let hasForest = 0;
    for (const building of this.buildingState.buildings) {
      if (building.type === "forest") { hasForest = 1; break; }
    }
    return mixBuildingPresentationHash(hash, hasForest);
  }

  private validateBuildingPlacementWithRecoveryReserve(coordinate: TileCoordinate, type: BuildingType): BuildingPlacementValidationResult {
    const validation = validateBuildingPlacement(
      this.world,
      this.materialsState,
      this.buildingState,
      this.populationState,
      coordinate,
      type,
      {
        costMultiplier: this.getResearchModifiers().buildingCostMultiplier,
        homesCapacityAddition: this.getResearchModifiers().homesCapacityAddition,
      },
    );
    if (validation.status !== "valid" || type === "forest") return validation;
    const cost = Math.ceil(validation.definition.materialCost * this.getResearchModifiers().buildingCostMultiplier);
    const warning = this.getMaterialRecoveryWarning(cost);
    const forestCost = Math.ceil(getBuildingDefinition("forest").materialCost * this.getResearchModifiers().buildingCostMultiplier);
    return warning === undefined
      ? validation
      : { status: "insufficient-materials", required: cost + forestCost, available: this.materialsState.materials };
  }

  private runDevelopmentInvariantCheck(now: number): void {
    if (!import.meta.env.DEV || now < this.nextInvariantCheckMilliseconds) return;
    this.nextInvariantCheckMilliseconds = now + 1_000;
    const result = validateRuntimeInvariants({
      world: this.world,
      buildings: this.buildingState,
      food: this.foodState,
      materials: this.materialsState,
      population: this.populationState,
      workers: this.workersState,
      research: this.researchState,
      events: this.dynamicEventState,
      modifiers: this.modifierState,
      beacon: this.beaconState,
    });
    if (!result.valid) console.warn("Void-Plot invariant warning", result.errors);
  }
}

function getNotificationPriority(sound: GameSoundEvent): NotificationPriority {
  switch (sound) {
    case "warning":
    case "beaconAdvance":
    case "beaconReady":
      return "critical";
    case "researchComplete":
    case "eventOpened":
    case "expeditionReturned":
      return "important";
    default:
      return "routine";
  }
}

function formatBuildDisplayNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, "");
}

function mixBuildingPresentationHash(hash: number, value: number): number {
  return Math.imul(hash ^ Math.round(value * 1_000), 16_777_619) >>> 0;
}

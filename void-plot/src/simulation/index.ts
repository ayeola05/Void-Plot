export {
  EXPEDITION_NON_REVEAL_STATUSES,
  EXPEDITION_REVEAL_STATUS,
  TEMPORARY_EXPEDITION_SUCCESS_IS_GUARANTEED,
  applyExpeditionStatusTransition,
  countActiveExpeditions,
  countExpeditionsByStatus,
  createExpeditionState,
  createPlannedExpedition,
  expeditionBoundsMatch,
  findDuplicatePlannedOrActiveSector,
  findExpeditionById,
  getExpeditionRequirements,
  hasDuplicatePlannedOrActiveSector,
  isExpeditionStatusTerminal,
  isExpeditionStatusTransitionAllowed,
  validateExpeditionDomainFoundation,
  validateExpeditionPlanning,
  validateExpeditionStatusTransition,
} from "./expedition";
export type {
  ApplyExpeditionTransitionResult,
  CreatePlannedExpeditionResult,
  ExpeditionDomainValidationResult,
  ExpeditionId,
  ExpeditionIdFactory,
  ExpeditionPlanningValidationResult,
  ExpeditionRecord,
  ExpeditionRequirements,
  ExpeditionSectorSnapshot,
  ExpeditionState,
  ExpeditionStatus,
  ExpeditionTiming,
  ExpeditionTransitionValidationResult,
} from "./expedition";
export {
  addMaterials,
  canAffordMaterials,
  createMaterialsState,
  getMaterialsBalance,
  isMaterialsStateValid,
  spendMaterials,
  validateMaterialAmount,
  validateMaterialsFoundation,
  validateMaterialsState,
} from "./materials";
export {
  addFood,
  createFoodState,
  getFoodBalance,
  validateFoodFoundation,
  validateFoodState,
} from "./food";
export type {
  CreateFoodStateResult,
  FoodAmount,
  FoodCreditResult,
  FoodFoundationValidationResult,
  FoodState,
  FoodValidationResult,
} from "./food";
export type {
  CreateMaterialsStateResult,
  MaterialAmount,
  MaterialAmountValidationResult,
  MaterialsAffordabilityResult,
  MaterialsCreditResult,
  MaterialsDebitResult,
  MaterialsFoundationValidationResult,
  MaterialsState,
  MaterialsStateValidationResult,
} from "./materials";
export {
  assignWorkers,
  canAssignWorkers,
  createWorkersState,
  getAssignedWorkers,
  getAvailableWorkers,
  getTotalWorkers,
  increaseTotalWorkers,
  isWorkersStateValid,
  releaseWorkers,
  validateWorkerCount,
  validateWorkersFoundation,
  validateWorkersState,
} from "./workers";
export type {
  CreateWorkersStateResult,
  WorkerAssignmentResult,
  WorkerAvailabilityResult,
  WorkerCount,
  WorkerCountValidationResult,
  WorkerReleaseResult,
  WorkerTotalIncreaseResult,
  WorkersFoundationValidationResult,
  WorkersState,
  WorkersStateValidationResult,
} from "./workers";
export {
  getRecruitableWorkerCount,
  recruitWorker,
  validateRecruitmentFoundation,
  validateWorkerRecruitment,
} from "./recruitment";
export type {
  RecruitmentFailureStatus,
  RecruitmentFoundationValidationResult,
  RecruitmentOperationResult,
  RecruitmentStatus,
  RecruitmentValidationResult,
} from "./recruitment";
export {
  activateExpedition,
  calculateExpectedCompletionTimestamp,
  isValidActivationClockValue,
  validateExpeditionActivation,
  validateExpeditionActivationFoundation,
} from "./expeditionActivation";
export type {
  ExpeditionActivationClock,
  ExpeditionActivationFailure,
  ExpeditionActivationFoundationValidationResult,
  ExpeditionActivationOperationResult,
  ExpeditionActivationPlan,
  ExpeditionActivationSnapshot,
  ExpeditionActivationStatus,
  ExpeditionActivationValidationResult,
} from "./expeditionActivation";
export {
  advanceActiveExpedition,
  completeExpeditionSuccessfully,
  getActiveExpedition,
  getExpeditionCountdown,
  startExpeditionFromSector,
  validateExpeditionGameplayFoundation,
  validateExpeditionLaunchAvailability,
} from "./expeditionGameplay";
export type {
  AdvanceExpeditionResult,
  ExpeditionCountdownSnapshot,
  ExpeditionGameplayFoundationValidationResult,
  ExpeditionLaunchAvailabilityResult,
  ExpeditionLaunchSector,
  StartExpeditionFromSectorResult,
} from "./expeditionGameplay";
export {
  advancePopulationCycles,
  createPopulationState,
  getPopulationGrowthEligibility,
  increasePopulationCapacity,
  processPopulationFoodConsumption,
  processPopulationGrowth,
  validatePopulationFoundation,
  validatePopulationState,
} from "./population";
export type {
  CreatePopulationStateResult,
  IncreasePopulationCapacityResult,
  PopulationConsumptionEvent,
  PopulationConsumptionResult,
  PopulationCycleResult,
  PopulationFoundationValidationResult,
  PopulationGrowthBlockedReason,
  PopulationGrowthEligibility,
  PopulationGrowthEvent,
  PopulationGrowthResult,
  PopulationState,
  PopulationSupplyStatus,
  PopulationValidationResult,
} from "./population";
export {
  createBuildingState,
  findBuildingAt,
  getBuildingDefinition,
  placeBuilding,
  validateBuildingFoundation,
  validateBuildingPlacement,
  validateBuildingState,
} from "./buildings";
export type {
  BuildingDefinition,
  BuildingFoundationValidationResult,
  BuildingId,
  BuildingIdFactory,
  BuildingPlacementOperationResult,
  BuildingPlacementValidationResult,
  BuildingRecord,
  BuildingState,
  BuildingStatus,
  BuildingType,
  FarmBuildingRecord,
  FarmProductionTiming,
  ForestBuildingRecord,
  ForestProductionTiming,
  HomesBuildingRecord,
  PowerPlantBuildingRecord,
  LabBuildingRecord,
  BuildingResearchModifiers,
} from "./buildings";
export {
  advanceFarmProduction,
  assignWorkerToFarm,
  findFarmById,
  getFarmProductionProgress,
  releaseWorkerFromFarm,
  validateFarmFoundation,
} from "./farms";
export {
  advanceEventTiming,
  calculateNextEventDelayMilliseconds,
  createDynamicEventState,
  getActiveEvent,
  resolveEventChoice,
  validateEventChoice,
  validateEventSystemFoundation,
} from "./events";
export type {
  AdvanceEventTimingResult,
  DynamicEventState,
  EventChoiceAvailability,
  EventGameplayState,
  EventSystemValidationResult,
  ResolveEventChoiceResult,
} from "./events";
export type {
  EventChoiceDefinition,
  EventChoiceEffect,
  EventDefinition,
  EventId,
} from "../data/eventDefinitions";
export {
  addOrRefreshModifier,
  advanceModifiers,
  createModifierState,
  getFarmProductionMultiplier,
  getForestProductionBonus,
  getPowerPlantOutputAdjustment,
  validateEventModifierFoundation,
} from "./eventModifiers";
export type {
  AdvanceModifiersResult,
  ModifierAffectedSystem,
  ModifierState,
  TemporaryModifier,
  EventModifierFoundationValidationResult,
} from "./eventModifiers";
export { validateEventIntegrationFoundation } from "./eventIntegrationValidation";
export type { EventIntegrationValidationResult } from "./eventIntegrationValidation";
export type { FarmProductionModifiers } from "./farms";
export type { ForestProductionModifiers } from "./forests";
export type { PowerAllocationModifiers } from "./power";
export type { TechnologyDefinition, TechnologyEffect, TechnologyId } from "../data/researchDefinitions";
export {
  addResearchPoints,
  advanceResearchProgression,
  createResearchState,
  prerequisitesMet,
  selectTechnology,
  validateResearchFoundation,
  validateResearchState,
} from "./research";
export type {
  ResearchProgressionResult,
  ResearchSelectionResult,
  ResearchState,
} from "./research";
export {
  applyCostMultiplier,
  calculateResearchModifiers,
  validateResearchModifierFoundation,
} from "./researchModifiers";
export type { ResearchModifierSnapshot } from "./researchModifiers";
export { validateResearchIntegrationFoundation } from "./researchIntegrationValidation";
export {
  advanceLabResearchProduction,
  assignWorkerToLab,
  findLabById,
  getLabProductionProgress,
  hasActiveResearchLab,
  releaseWorkerFromLab,
  validateLabFoundation,
} from "./labs";
export {
  activateBeacon,
  advanceBeaconProgression,
  calculateBeaconFailureRisk,
  createBeaconState,
  getBeaconModifiers,
  refreshBeaconDerivedState,
  validateBeaconFoundation,
} from "./beacon";
export { validateBeaconIntegrationFoundation } from "./beaconIntegrationValidation";
export { validateRuntimeInvariants } from "./runtimeInvariants";
export type { RuntimeInvariantResult, RuntimeInvariantSnapshot } from "./runtimeInvariants";
export { createReleaseCandidateBalanceAudit, validateReleaseCandidateScenarios } from "./releaseCandidateValidation";
export type { ReleaseCandidateBalanceAudit, ReleaseCandidateValidationResult } from "./releaseCandidateValidation";
export type {
  BeaconDerivationContext,
  BeaconFailureRisk,
  BeaconModifiers,
  BeaconRequirementProgress,
  BeaconState,
  BeaconVictoryAvailability,
} from "./beacon";
export type {
  LabProductionResult,
  LabResearchProductionEvent,
  LabStaffingResult,
} from "./labs";
export {
  advanceForestProduction,
  assignWorkerToForest,
  findForestById,
  getForestProductionProgress,
  releaseWorkerFromForest,
  validateForestFoundation,
} from "./forests";
export {
  assignWorkerToPowerPlant,
  calculatePowerAllocation,
  createEmptyPowerSnapshot,
  findPowerPlantById,
  hasPowerShortage,
  isBuildingPowered,
  releaseWorkerFromPowerPlant,
  validatePowerFoundation,
} from "./power";
export type {
  PowerAllocationResult,
  PowerAllocationSnapshot,
  PowerAllocationStatus,
  PowerConsumerAllocation,
  PowerConsumerType,
  PowerFoundationValidationResult,
  PowerPlantAssignmentResult,
  PowerPlantReleaseResult,
} from "./power";
export type {
  ForestAssignmentResult,
  ForestFoundationValidationResult,
  ForestProductionEvent,
  ForestProductionProgress,
  ForestProductionResult,
  ForestReleaseResult,
} from "./forests";
export type {
  FarmAssignmentResult,
  FarmFoundationValidationResult,
  FarmProductionEvent,
  FarmProductionProgress,
  FarmProductionResult,
  FarmReleaseResult,
} from "./farms";

import {
  validateBeaconFoundation,
  validateBeaconIntegrationFoundation,
  validateBuildingFoundation,
  validateEventIntegrationFoundation,
  validateEventModifierFoundation,
  validateEventSystemFoundation,
  validateExpeditionActivationFoundation,
  validateExpeditionDomainFoundation,
  validateExpeditionGameplayFoundation,
  validateFarmFoundation,
  validateFoodFoundation,
  validateForestFoundation,
  validateLabFoundation,
  validateMaterialsFoundation,
  validatePopulationFoundation,
  validatePowerFoundation,
  validateRecruitmentFoundation,
  validateReleaseCandidateScenarios,
  validateResearchFoundation,
  validateResearchIntegrationFoundation,
  validateResearchModifierFoundation,
  validateWorkersFoundation,
} from "../src/simulation";

const validators = Object.freeze({
  materials: validateMaterialsFoundation,
  food: validateFoodFoundation,
  workers: validateWorkersFoundation,
  recruitment: validateRecruitmentFoundation,
  population: validatePopulationFoundation,
  buildings: validateBuildingFoundation,
  farms: validateFarmFoundation,
  forests: validateForestFoundation,
  power: validatePowerFoundation,
  labs: validateLabFoundation,
  expeditions: validateExpeditionDomainFoundation,
  expeditionActivation: validateExpeditionActivationFoundation,
  expeditionGameplay: validateExpeditionGameplayFoundation,
  events: validateEventSystemFoundation,
  eventModifiers: validateEventModifierFoundation,
  eventIntegration: validateEventIntegrationFoundation,
  research: validateResearchFoundation,
  researchModifiers: validateResearchModifierFoundation,
  researchIntegration: validateResearchIntegrationFoundation,
  beacon: validateBeaconFoundation,
  beaconIntegration: validateBeaconIntegrationFoundation,
  releaseCandidate: validateReleaseCandidateScenarios,
});

const failures: string[] = [];
for (const [name, validate] of Object.entries(validators)) {
  const result = validate();
  if (!result.valid) failures.push(`${name}: ${result.errors.join("; ")}`);
}

if (failures.length > 0) throw new Error(`Simulation validation failed:\n${failures.join("\n")}`);
console.log(`Simulation validators passed: ${Object.keys(validators).length}`);

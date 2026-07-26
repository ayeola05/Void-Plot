import type { GameObjects, Scene } from "phaser";
import type { RunStatistics } from "../game/runStatistics";
import type { BuildingState, BuildingType, ExpeditionState, ResearchState } from "../simulation";
import type { TileCoordinate } from "../world";
import {
  RENDER_DEPTHS,
  THEME_COLORS,
  THEME_SPACING,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "../rendering";
import { getAccessibilitySettings } from "../game/accessibility";
import { ThemedButton } from "./ThemedButton";

export interface OnboardingSource {
  getSelectedTile(): TileCoordinate | undefined;
  getBuildingState(): BuildingState;
  getExpeditionState(): ExpeditionState;
  getResearchState(): ResearchState;
  getStatistics(): RunStatistics;
}

export interface OnboardingProgress {
  readonly objectiveIndex: number;
  readonly skipped: boolean;
  readonly completed: boolean;
}

export type OnboardingTarget =
  | { readonly kind: "world-tile"; readonly coordinate: TileCoordinate }
  | { readonly kind: "building"; readonly buildingType: BuildingType }
  | { readonly kind: "selected-panel" }
  | { readonly kind: "expedition-panel" }
  | { readonly kind: "research-panel" }
  | { readonly kind: "beacon-panel" }
  | { readonly kind: "none" };

const ONBOARDING_TARGETS = Object.freeze({
  none: Object.freeze({ kind: "none" } as const),
  tile: Object.freeze({ kind: "world-tile", coordinate: Object.freeze({ x: 12, y: 12 }) } as const),
  homes: Object.freeze({ kind: "building", buildingType: "homes" } as const),
  farm: Object.freeze({ kind: "building", buildingType: "farm" } as const),
  forest: Object.freeze({ kind: "building", buildingType: "forest" } as const),
  powerPlant: Object.freeze({ kind: "building", buildingType: "powerPlant" } as const),
  lab: Object.freeze({ kind: "building", buildingType: "lab" } as const),
  selected: Object.freeze({ kind: "selected-panel" } as const),
  expedition: Object.freeze({ kind: "expedition-panel" } as const),
  research: Object.freeze({ kind: "research-panel" } as const),
  beacon: Object.freeze({ kind: "beacon-panel" } as const),
});

interface Objective {
  readonly title: string;
  readonly instruction: string;
  readonly hint: string;
  readonly isComplete: (source: OnboardingSource) => boolean;
}

const ONBOARDING_KEY = "onboardingProgress";

const hasBuilding = (source: OnboardingSource, type: "homes" | "farm" | "forest" | "powerPlant" | "lab", staffed = false): boolean =>
  source.getBuildingState().buildings.some((building) =>
    building.type === type && (!staffed || ("assignedWorkers" in building && building.assignedWorkers > 0)),
  );

export const ONBOARDING_OBJECTIVES: readonly Objective[] = Object.freeze([
  { title: "Survey the Acre", instruction: "Select any revealed tile to inspect it.", hint: "Left-click a lighter tile", isComplete: (s) => s.getSelectedTile() !== undefined },
  { title: "Make Room", instruction: "Build one Home to increase population capacity.", hint: "Build panel → Homes → revealed vacant tile", isComplete: (s) => hasBuilding(s, "homes") },
  { title: "Prepare Food", instruction: "Build one Farm; it will need a worker and Power before producing.", hint: "Build panel → Farm", isComplete: (s) => hasBuilding(s, "farm") },
  { title: "Bring Power Online", instruction: "Build a Power Plant and assign a worker to it.", hint: "Select the plant after building it → Assign Worker", isComplete: (s) => hasBuilding(s, "powerPlant", true) },
  { title: "Staff the Farm", instruction: "Assign an available worker to your Farm.", hint: "Select the Farm → Assign Worker", isComplete: (s) => hasBuilding(s, "farm", true) },
  { title: "First Harvest", instruction: "Keep the staffed, powered Farm running until it produces Food.", hint: "Farm progress appears in Selected Tile", isComplete: (s) => s.getStatistics().foodProduced > 0 },
  { title: "Renewable Materials", instruction: "Build and staff a Forest to establish renewable Materials.", hint: "Build panel → Forest → Assign Worker", isComplete: (s) => hasBuilding(s, "forest", true) },
  { title: "First Timber", instruction: "Keep the staffed, powered Forest running until it produces Materials.", hint: "Forest progress appears in Selected Tile", isComplete: (s) => s.getStatistics().materialsProduced > 0 },
  { title: "Push the Frontier", instruction: "Select a valid frontier sector and start an expedition.", hint: "Press 2, 4, or 6 → click green sector → Start Expedition", isComplete: (s) => s.getExpeditionState().expeditions.length > 0 },
  { title: "Build a Lab", instruction: "Build and staff a powered Lab.", hint: "Build panel → Lab → Assign Worker", isComplete: (s) => hasBuilding(s, "lab", true) },
  { title: "Choose Research", instruction: "Select an available technology and begin research.", hint: "Research panel → available Tier 1 technology", isComplete: (s) => s.getResearchState().activeTechnology !== undefined || s.getResearchState().completedTechnologies.length > 0 },
  { title: "The Genesis Beacon", instruction: "Reach Final Transmission and satisfy every Beacon requirement to win the run.", hint: "Track Population, Food, Materials, Power, and Tier 4 Research in the Beacon panel", isComplete: () => false },
]);

export class OnboardingPanel {
  private readonly container: GameObjects.Container;
  private readonly background: GameObjects.Rectangle;
  private readonly title: GameObjects.Text;
  private readonly instruction: GameObjects.Text;
  private readonly hint: GameObjects.Text;
  private readonly skipButton: ThemedButton;
  private transitionAt?: number;
  private renderedIndex = -1;

  public constructor(private readonly scene: Scene, private readonly source: OnboardingSource) {
    this.background = scene.add.rectangle(0, 0, 1, 1, THEME_COLORS.panelRaised, 0.98).setOrigin(0).setStrokeStyle(1, THEME_COLORS.accentMuted);
    this.title = scene.add.text(THEME_SPACING.panelPadding, 9, "", { color: colorToCss(THEME_COLORS.accent), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "12px", fontStyle: "bold" });
    this.instruction = scene.add.text(THEME_SPACING.panelPadding, 29, "", { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.bodySize });
    this.hint = scene.add.text(THEME_SPACING.panelPadding, 68, "", { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.statusSize });
    this.skipButton = new ThemedButton(scene, "Skip Tutorial", () => this.skip()).setTooltip("Hide onboarding for this session. Normal gameplay remains available.").setStopsPointerPropagation();
    this.container = scene.add.container(0, 0, [this.background, this.title, this.instruction, this.hint, this.skipButton.container]).setDepth(RENDER_DEPTHS.ui + 80).setScrollFactor(0);
    scene.cameras.main.ignore(this.container);
  }

  public setLayout(viewportWidth: number, viewportHeight: number, reservedUiWidth: number): void {
    const width = Math.min(310, Math.max(280, viewportWidth - reservedUiWidth - 24));
    const x = reservedUiWidth + 12;
    const y = Math.max(12, viewportHeight - 106);
    this.container.setPosition(x, y);
    this.background.setSize(width, 94);
    this.instruction.setWordWrapWidth(width - 130);
    this.hint.setWordWrapWidth(width - 130);
    this.skipButton.setLayout(width - 116, 34, 106, 30);
  }

  public update(now: number): void {
    const progress = getOnboardingProgress(this.scene);
    if (progress.skipped || progress.completed) { this.container.setVisible(false); return; }
    const objective = ONBOARDING_OBJECTIVES[progress.objectiveIndex];
    if (objective === undefined) { this.finish(); return; }
    this.container.setVisible(true);
    if (this.renderedIndex !== progress.objectiveIndex) this.renderObjective(progress.objectiveIndex, objective);

    if (progress.objectiveIndex === ONBOARDING_OBJECTIVES.length - 1) {
      this.skipButton.setText("Got It");
      return;
    }
    if (this.transitionAt === undefined && objective.isComplete(this.source)) {
      this.title.setText(`✓ ${objective.title}`);
      this.hint.setText("Objective complete").setColor(colorToCss(THEME_COLORS.validBright));
      this.transitionAt = now + (getAccessibilitySettings(this.scene.registry).reducedMotion ? 80 : 650);
    }
    if (this.transitionAt !== undefined && now >= this.transitionAt) this.advance(progress.objectiveIndex + 1);
  }

  public getCurrentTarget(): OnboardingTarget {
    const progress = getOnboardingProgress(this.scene);
    if (progress.skipped || progress.completed) return ONBOARDING_TARGETS.none;
    switch (progress.objectiveIndex) {
      case 0: return ONBOARDING_TARGETS.tile;
      case 1: return ONBOARDING_TARGETS.homes;
      case 2:
      case 4:
      case 5: return progress.objectiveIndex === 2 ? ONBOARDING_TARGETS.farm : ONBOARDING_TARGETS.selected;
      case 3: return ONBOARDING_TARGETS.powerPlant;
      case 6: return ONBOARDING_TARGETS.forest;
      case 7: return ONBOARDING_TARGETS.selected;
      case 8: return ONBOARDING_TARGETS.expedition;
      case 9: return ONBOARDING_TARGETS.lab;
      case 10: return ONBOARDING_TARGETS.research;
      case 11: return ONBOARDING_TARGETS.beacon;
      default: return ONBOARDING_TARGETS.none;
    }
  }

  private renderObjective(index: number, objective: Objective): void {
    this.renderedIndex = index;
    this.transitionAt = undefined;
    this.title.setText(`${index + 1}/${ONBOARDING_OBJECTIVES.length}  ${objective.title}`);
    this.instruction.setText(objective.instruction);
    this.hint.setText(objective.hint).setColor(colorToCss(THEME_COLORS.secondaryText));
    this.skipButton.setText(index === ONBOARDING_OBJECTIVES.length - 1 ? "Got It" : "Skip Tutorial");
    if (!getAccessibilitySettings(this.scene.registry).reducedMotion) {
      this.container.setAlpha(0).setY(this.container.y + 5);
      this.scene.tweens.add({ targets: this.container, alpha: 1, y: this.container.y - 5, duration: 180, ease: "Quad.Out" });
    }
  }

  private advance(objectiveIndex: number): void {
    this.scene.registry.set(ONBOARDING_KEY, Object.freeze({ objectiveIndex, skipped: false, completed: false } satisfies OnboardingProgress));
    this.renderedIndex = -1;
    this.transitionAt = undefined;
  }

  private skip(): void {
    const progress = getOnboardingProgress(this.scene);
    if (progress.objectiveIndex === ONBOARDING_OBJECTIVES.length - 1) this.finish();
    else this.scene.registry.set(ONBOARDING_KEY, Object.freeze({ ...progress, skipped: true }));
  }

  private finish(): void {
    this.scene.registry.set(ONBOARDING_KEY, Object.freeze({ objectiveIndex: ONBOARDING_OBJECTIVES.length, skipped: false, completed: true } satisfies OnboardingProgress));
    this.container.setVisible(false);
  }
}

export function getOnboardingProgress(scene: Scene): OnboardingProgress {
  const stored = scene.registry.get(ONBOARDING_KEY) as Partial<OnboardingProgress> | undefined;
  if (stored !== undefined && Number.isInteger(stored.objectiveIndex) && (stored.objectiveIndex ?? -1) >= 0 && typeof stored.skipped === "boolean" && typeof stored.completed === "boolean") return stored as OnboardingProgress;
  const initial = Object.freeze({ objectiveIndex: 0, skipped: false, completed: false });
  scene.registry.set(ONBOARDING_KEY, initial);
  return initial;
}

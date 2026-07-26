import type { GameObjects, Scene } from "phaser";
import {
  RENDER_DEPTHS,
  THEME_COLORS,
  THEME_SPACING,
  THEME_TYPOGRAPHY,
  calculateBuildPanelCardLayout,
  colorToCss,
  type BuildingPlacementFeedbackStatus,
} from "../rendering";
import { applyCostMultiplier, getBuildingDefinition, type BuildingType } from "../simulation";
import { getAccessibilitySettings } from "../game/accessibility";
import { ConstructionCard, type ConstructionCardViewModel } from "./ConstructionCard";
import { ThemedButton } from "./ThemedButton";

const BUILDING_TYPES = Object.freeze(["homes", "farm", "forest", "powerPlant", "lab"] as const);

export interface BuildPanelSource {
  getFeedbackStatus(): BuildingPlacementFeedbackStatus;
  isPlacementModeActive(): boolean;
  getSelectedBuildingType(): BuildingType | undefined;
  getPresentationRevision(): number;
  getBuildingCardView(type: BuildingType): ConstructionCardViewModel;
  selectBuilding(type: BuildingType): void;
  cancelPlacement(): void;
}

export interface BuildPanelLayout { x: number; y: number; width: number; height: number; }
export interface BuildPanelValidationResult { readonly valid: boolean; readonly errors: string[]; }

export function formatBuildingPlacementReason(status: BuildingPlacementFeedbackStatus): string {
  switch (status) {
    case "inactive": return "Select a building to begin placement";
    case "choose-tile": return "Choose a revealed vacant tile";
    case "valid": return "Valid site — click to construct";
    case "placed": return "Building constructed";
    case "out-of-bounds": return "Outside the colony boundary";
    case "hidden-tile": return "Expedition required — tile is hidden";
    case "occupied-tile": return "Tile is already occupied";
    case "insufficient-materials": return "Not enough Materials — staff a powered Forest";
    case "invalid-materials-state": return "Materials state is invalid";
    case "invalid-building-state":
    case "invalid-population-state":
    case "invalid-building-id":
    case "duplicate-building-id": return "Placement cannot be completed safely";
  }
}

export function getConstructionCardIdentity(type: BuildingType): Pick<ConstructionCardViewModel, "name" | "role" | "roleSymbol" | "roleColor"> {
  switch (type) {
    case "homes": return { name: "Home", role: "Housing", roleSymbol: "H", roleColor: THEME_COLORS.constructionHousing };
    case "farm": return { name: "Farm", role: "Food", roleSymbol: "F", roleColor: THEME_COLORS.constructionFood };
    case "forest": return { name: "Forest", role: "Materials", roleSymbol: "M", roleColor: THEME_COLORS.constructionMaterials };
    case "powerPlant": return { name: "Power Plant", role: "Power", roleSymbol: "P", roleColor: THEME_COLORS.constructionPower };
    case "lab": return { name: "Lab", role: "Research", roleSymbol: "R", roleColor: THEME_COLORS.constructionResearch };
  }
}

export class BuildPanel {
  private readonly scene: Scene;
  private readonly background: GameObjects.Rectangle;
  private readonly container: GameObjects.Container;
  private readonly cards: Readonly<Record<BuildingType, ConstructionCard>>;
  private readonly materialsText: GameObjects.Text;
  private readonly statusText: GameObjects.Text;
  private readonly actionBackground: GameObjects.Rectangle;
  private readonly actionText: GameObjects.Text;
  private readonly cancelButton: ThemedButton;
  private renderedRevision = -1;
  private renderedActive = false;
  private renderedSelectedType?: BuildingType;
  private renderedStatus?: BuildingPlacementFeedbackStatus;
  private previousStatus: BuildingPlacementFeedbackStatus = "inactive";

  public constructor(scene: Scene, private readonly source: BuildPanelSource) {
    this.scene = scene;
    this.background = scene.add.rectangle(0, 0, 1, 1, THEME_COLORS.panelBackground, 0.97).setOrigin(0).setStrokeStyle(1, THEME_COLORS.panelBorder, 0.9);
    const heading = scene.add.text(THEME_SPACING.panelPadding, 7, "BUILD", { color: colorToCss(THEME_COLORS.accent), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.headingSize, fontStyle: "bold" });
    const subtitle = scene.add.text(THEME_SPACING.panelPadding, 22, "Choose a structure", { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.helperSize });
    this.materialsText = scene.add.text(1, 8, "", { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.statusSize, fontStyle: "bold" }).setOrigin(1, 0);
    this.statusText = scene.add.text(THEME_SPACING.panelPadding, 37, "", { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "9px" });

    const cardEntries = BUILDING_TYPES.map((type) => [type, new ConstructionCard(scene, this.source.getBuildingCardView(type), (selected) => { this.source.selectBuilding(selected); this.update(); })] as const);
    this.cards = Object.freeze(Object.fromEntries(cardEntries) as Record<BuildingType, ConstructionCard>);
    this.actionBackground = scene.add.rectangle(0, 0, 1, 1, THEME_COLORS.constructionCardInset, 0.82).setOrigin(0).setStrokeStyle(1, THEME_COLORS.panelBorder, 0.75);
    this.actionText = scene.add.text(0, 0, "", { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "9px" }).setOrigin(0, 0.5);
    this.cancelButton = new ThemedButton(scene, "Cancel Placement  Esc", () => { this.source.cancelPlacement(); this.update(); }).setTooltip("Leave building placement mode without changing the world.");
    this.container = scene.add.container(0, 0, [this.background, heading, subtitle, this.materialsText, this.statusText, ...BUILDING_TYPES.map((type) => this.cards[type].container), this.actionBackground, this.actionText, this.cancelButton.container]).setDepth(RENDER_DEPTHS.ui).setScrollFactor(0);
    scene.cameras.main.ignore(this.container);
    this.update();
  }

  public setLayout(layout: BuildPanelLayout): void {
    this.container.setPosition(layout.x, layout.y);
    this.background.setSize(layout.width, layout.height);
    this.materialsText.setPosition(layout.width - THEME_SPACING.panelPadding, 8);
    this.statusText.setWordWrapWidth(Math.max(1, layout.width - THEME_SPACING.panelPadding * 2));
    const cardLayout = calculateBuildPanelCardLayout({ x: 0, y: 0, width: layout.width, height: layout.height });
    BUILDING_TYPES.forEach((type, index) => {
      const bounds = cardLayout.cards[index];
      this.cards[type].setLayout(bounds.x, bounds.y, bounds.width, bounds.height, cardLayout.mode);
    });
    const action = cardLayout.actionRow;
    this.actionBackground.setPosition(action.x, action.y).setSize(action.width, action.height);
    this.actionText.setPosition(action.x + 7, action.y + action.height / 2);
    this.cancelButton.setLayout(action.x + Math.floor(action.width * 0.48), action.y + 2, Math.ceil(action.width * 0.52) - 2, Math.max(1, action.height - 4));
  }

  public setTutorialTarget(type?: BuildingType): void {
    BUILDING_TYPES.forEach((candidate) => this.cards[candidate].setAttention(candidate === type));
  }

  public update(sceneTime = this.scene.time.now): boolean {
    const settings = getAccessibilitySettings(this.scene.registry);
    BUILDING_TYPES.forEach((type) => this.cards[type].update(sceneTime, settings.reducedMotion, settings.particles));
    const active = this.source.isPlacementModeActive();
    const selectedType = this.source.getSelectedBuildingType();
    const status = this.source.getFeedbackStatus();
    const revision = this.source.getPresentationRevision();
    const reason = formatBuildingPlacementReason(status);
    if (revision === this.renderedRevision && active === this.renderedActive && selectedType === this.renderedSelectedType && status === this.renderedStatus) return false;
    const views = BUILDING_TYPES.map((type) => this.source.getBuildingCardView(type));
    this.renderedRevision = revision;
    this.renderedActive = active;
    this.renderedSelectedType = selectedType;
    this.renderedStatus = status;
    views.forEach((view, index) => { const type = BUILDING_TYPES[index]; this.cards[type].setViewModel(view).setSelected(selectedType === type); });
    this.materialsText.setText(`◆ ${views[0].currentMaterials} Materials`);
    this.statusText.setText(reason).setColor(colorToCss(status === "valid" || status === "placed" ? THEME_COLORS.validBright : status === "inactive" || status === "choose-tile" ? THEME_COLORS.secondaryText : THEME_COLORS.invalid));
    this.actionText.setText(active && selectedType !== undefined ? `Placing: ${getConstructionCardIdentity(selectedType).name}` : "Select a card to begin");
    this.cancelButton.setVisible(active).setEnabled(active);
    if (status !== this.previousStatus && isFailedPlacementStatus(status)) this.pulseStatus(settings.reducedMotion);
    this.previousStatus = status;
    return true;
  }

  private pulseStatus(reducedMotion: boolean): void {
    if (reducedMotion) { this.statusText.setAlpha(1); return; }
    this.scene.tweens.killTweensOf(this.statusText);
    this.statusText.setAlpha(0.35);
    this.scene.tweens.add({ targets: this.statusText, alpha: 1, duration: 180, ease: "Quad.Out" });
  }
}

function isFailedPlacementStatus(status: BuildingPlacementFeedbackStatus): boolean {
  return status !== "inactive" && status !== "choose-tile" && status !== "valid" && status !== "placed";
}

export function validateBuildPanelFoundation(): BuildPanelValidationResult {
  const errors: string[] = [];
  if (BUILDING_TYPES.length !== 5 || new Set(BUILDING_TYPES.map((type) => getConstructionCardIdentity(type).role)).size !== 5) errors.push("Build panel must expose five role-distinct construction cards.");
  if (!formatBuildingPlacementReason("hidden-tile").includes("hidden")) errors.push("Hidden placement feedback must be explicit.");
  if (!formatBuildingPlacementReason("insufficient-materials").includes("Forest")) errors.push("Material recovery feedback must identify Forest production.");
  if (applyCostMultiplier(getBuildingDefinition("lab").materialCost, 0.9) !== 72) errors.push("Research-modified card costs must use the construction cost multiplier.");
  return { valid: errors.length === 0, errors };
}

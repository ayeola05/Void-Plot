import type { GameObjects, Input, Scene } from "phaser";
import { BEACON_PHASES } from "../data";
import type { BeaconState } from "../simulation";
import { RENDER_DEPTHS, THEME_COLORS, THEME_SPACING, THEME_TYPOGRAPHY, colorToCss } from "../rendering";
import { ThemedButton } from "./ThemedButton";
import { getTooltipManager } from "./TooltipManager";

export interface BeaconPanelSource {
  getBeaconState(): BeaconState;
  activateBeacon(): void;
}

export class BeaconPanel {
  private readonly container: GameObjects.Container;
  private readonly background: GameObjects.Rectangle;
  private readonly phaseText: GameObjects.Text;
  private readonly penaltyText: GameObjects.Text;
  private readonly riskText: GameObjects.Text;
  private readonly requirementTexts: readonly GameObjects.Text[];
  private readonly tracks: readonly GameObjects.Rectangle[];
  private readonly fills: readonly GameObjects.Rectangle[];
  private readonly button: ThemedButton;
  private readonly detailsButton: ThemedButton;
  private readonly reason: GameObjects.Text;
  private contentWidth = 1;
  private panelWidth = 1;
  private userExpanded = false;
  private renderedKey = "";

  public constructor(scene: Scene, private readonly source: BeaconPanelSource) {
    this.background = scene.add.rectangle(0, 0, 1, 1, THEME_COLORS.panelBackground, 0.98).setOrigin(0).setStrokeStyle(1, THEME_COLORS.beaconTrim).setInteractive();
    const heading = scene.add.text(THEME_SPACING.panelPadding, 8, "GENESIS BEACON", { color: colorToCss(THEME_COLORS.beaconCore), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.headingSize, fontStyle: "bold" });
    this.phaseText = scene.add.text(THEME_SPACING.panelPadding, 25, "", { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.valueSize, fontStyle: "bold" });
    this.penaltyText = scene.add.text(THEME_SPACING.panelPadding, 47, "", { color: colorToCss(THEME_COLORS.warning), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.statusSize, lineSpacing: 1 });
    this.penaltyText.setInteractive();
    getTooltipManager(scene).register(this.penaltyText, () => `Beacon pressure modifiers: ${this.penaltyText.text}`);
    this.riskText = scene.add.text(THEME_SPACING.panelPadding, 82, "", { color: colorToCss(THEME_COLORS.warning), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.bodySize, fontStyle: "bold" });
    this.requirementTexts = ["Population", "Food", "Materials", "Power", "Tier 4 Research"].map((label, index) => scene.add.text(THEME_SPACING.panelPadding, 105 + index * 27, label, { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.statusSize }));
    this.tracks = this.requirementTexts.map((_text, index) => scene.add.rectangle(THEME_SPACING.panelPadding, 119 + index * 27, 1, 6, THEME_COLORS.progressTrack).setOrigin(0));
    this.fills = this.requirementTexts.map((_text, index) => scene.add.rectangle(THEME_SPACING.panelPadding, 119 + index * 27, 1, 6, THEME_COLORS.beaconGlow).setOrigin(0));
    this.reason = scene.add.text(0, 236, "", { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.statusSize, align: "center" }).setOrigin(0.5, 0);
    this.button = new ThemedButton(scene, "Activate Beacon", () => { this.source.activateBeacon(); this.update(); }).setStopsPointerPropagation();
    this.detailsButton = new ThemedButton(scene, "Details", () => {
      this.userExpanded = !this.userExpanded;
      this.renderedKey = "";
      this.applyPresentation();
      this.update();
    }).setStopsPointerPropagation().setTooltip("Show or hide Beacon victory requirements.");
    this.container = scene.add.container(0, 0, [this.background, heading, this.phaseText, this.penaltyText, this.riskText, ...this.requirementTexts, ...this.tracks, ...this.fills, this.reason, this.button.container, this.detailsButton.container]).setDepth(RENDER_DEPTHS.ui + 15).setScrollFactor(0);
    this.background.on("pointerdown", (_p: Input.Pointer, _x: number, _y: number, event: { stopPropagation(): void }) => event.stopPropagation());
    scene.cameras.main.ignore(this.container);
  }

  public setLayout(viewportWidth: number): void {
    const width = viewportWidth < 560
      ? Math.max(1, viewportWidth - 24)
      : Math.min(350, viewportWidth - 288);
    this.contentWidth = width - THEME_SPACING.panelPadding * 2;
    this.panelWidth = width;
    this.container.setPosition(viewportWidth < 560 ? 12 : viewportWidth - width - 12, 4);
    this.tracks.forEach((track) => track.setSize(this.contentWidth, 6));
    this.reason.setX(width / 2).setWordWrapWidth(this.contentWidth);
    this.button.setLayout(THEME_SPACING.panelPadding, 248, this.contentWidth, 26);
    this.detailsButton.setLayout(width - 78, 5, 68, 22);
    this.applyPresentation();
    this.update();
  }

  public update(): boolean {
    const state = this.source.getBeaconState();
    const phase = BEACON_PHASES[state.phaseNumber - 1];
    const seconds = Math.ceil(state.nextPhaseCountdownMilliseconds / 1_000);
    const values = [state.requirements.population, state.requirements.food, state.requirements.materials, state.requirements.power, state.requirements.research];
    const expanded = this.userExpanded || state.phaseNumber === 5;
    const key = JSON.stringify({ phase: state.phaseNumber, seconds, risk: state.failureRisk, values, availability: state.victoryAvailability.status, victory: state.victoryAchieved, expanded });
    if (key === this.renderedKey) return false;
    this.renderedKey = key;
    this.phaseText.setText(`Phase ${state.phaseNumber}: ${phase.label}  •  ${state.phaseNumber === 5 ? "Final" : `${seconds}s`}`);
    this.penaltyText.setText(formatBeaconPenalties(state));
    this.riskText.setText(`Failure Risk: ${state.failureRisk.toUpperCase()}`).setColor(colorToCss(state.failureRisk === "critical" ? THEME_COLORS.invalid : state.failureRisk === "high" ? THEME_COLORS.warning : THEME_COLORS.secondaryText));
    const labels = ["Population", "Food", "Materials", "Power Generation", "Tier 4 Research"];
    this.requirementTexts.forEach((text, index) => text.setText(`${labels[index]}  ${values[index].current}/${values[index].required}`));
    this.fills.forEach((fill, index) => fill.setSize(Math.max(1, this.contentWidth * values[index].progress), 6).setFillStyle(values[index].met ? THEME_COLORS.validBright : THEME_COLORS.beaconGlow));
    this.button.setEnabled(state.victoryAvailability.status === "available").setText(state.victoryAchieved ? "Beacon Activated — Victory" : "Activate Beacon");
    this.reason.setText(formatBeaconActivationReason(state));
    this.button.setTooltip(`${formatBeaconActivationReason(state)}\nActivating freezes the run and begins the victory transmission.`);
    this.applyPresentation();
    return true;
  }

  public setTutorialHighlighted(highlighted: boolean): void {
    this.detailsButton.setAttention(highlighted);
    this.background.setStrokeStyle(highlighted ? 2 : 1, highlighted ? THEME_COLORS.validBright : THEME_COLORS.beaconTrim, highlighted ? 1 : 0.9);
  }

  private applyPresentation(): void {
    const state = this.source.getBeaconState();
    const expanded = this.userExpanded || state.phaseNumber === 5;
    this.background.setSize(this.panelWidth, expanded ? 282 : 92);
    this.detailsButton.setText(expanded && state.phaseNumber !== 5 ? "Hide" : "Details").setVisible(state.phaseNumber !== 5);
    this.requirementTexts.forEach((object) => object.setVisible(expanded));
    this.tracks.forEach((object) => object.setVisible(expanded));
    this.fills.forEach((object) => object.setVisible(expanded));
    this.reason.setVisible(expanded);
    this.button.setVisible(expanded);
  }
}

export function formatBeaconPenalties(state: BeaconState): string {
  const modifiers = state.modifiers;
  const penalties = [modifiers.populationFoodConsumptionMultiplier > 1 ? `Food use +${Math.round((modifiers.populationFoodConsumptionMultiplier - 1) * 100)}%` : undefined, modifiers.farmProductionMultiplier < 1 ? `Farm ${Math.round((modifiers.farmProductionMultiplier - 1) * 100)}%` : undefined, modifiers.forestProductionMultiplier < 1 ? `Forest ${Math.round((modifiers.forestProductionMultiplier - 1) * 100)}%` : undefined, modifiers.staffedProductionPowerDemandAddition > 0 ? `Production demand +${modifiers.staffedProductionPowerDemandAddition}` : undefined, modifiers.powerPlantOutputAdjustment < 0 ? `Plant output ${modifiers.powerPlantOutputAdjustment}` : undefined].filter((value): value is string => value !== undefined);
  return penalties.length === 0 ? "Penalties: None" : `Penalties: ${penalties.join(" • ")}`;
}

export function formatBeaconActivationReason(state: BeaconState): string {
  if (state.victoryAchieved) return "Transmission complete — run won";
  if (state.victoryAvailability.status === "wrong-phase") return "Activation unlocks during Final Transmission";
  if (state.victoryAvailability.status === "requirements-not-met") return "Incomplete requirements. Use the progress bars above to identify the next colony target.";
  return state.victoryAvailability.status === "available" ? "Ready for final transmission" : "Beacon already activated";
}

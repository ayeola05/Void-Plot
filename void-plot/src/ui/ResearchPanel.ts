import type { GameObjects, Input, Scene } from "phaser";
import {
  TECHNOLOGY_DEFINITIONS,
  getTechnologyDefinition,
  type TechnologyEffect,
  type TechnologyId,
} from "../data";
import { prerequisitesMet, type ResearchState } from "../simulation";
import { RENDER_DEPTHS, THEME_COLORS, THEME_SPACING, THEME_TYPOGRAPHY, colorToCss } from "../rendering";
import { ThemedButton } from "./ThemedButton";
import { getResearchPanelHeight } from "./presentationLayout";

export interface ResearchPanelSource {
  getResearchState(): ResearchState;
  selectTechnology(id: TechnologyId): void;
  isLabProducing(): boolean;
}

export class ResearchPanel {
  private readonly container: GameObjects.Container;
  private readonly background: GameObjects.Rectangle;
  private readonly summary: GameObjects.Text;
  private readonly reason: GameObjects.Text;
  private readonly progressTrack: GameObjects.Rectangle;
  private readonly progressFill: GameObjects.Rectangle;
  private readonly buttons: readonly ThemedButton[];
  private readonly toggleButton: ThemedButton;
  private readonly scene: Scene;
  private expanded = false;
  private tutorialHighlighted = false;
  private hasSeenResearchPoints = false;
  private viewportWidth = 1;
  private viewportHeight = 1;
  private renderedKey = "";

  public constructor(scene: Scene, private readonly source: ResearchPanelSource) {
    this.scene = scene;
    this.background = scene.add.rectangle(0, 0, 1, 1, THEME_COLORS.panelBackground, 0.98).setOrigin(0).setStrokeStyle(1, THEME_COLORS.panelBorder).setInteractive();
    const heading = scene.add.text(THEME_SPACING.panelPadding, 8, "RESEARCH & TECHNOLOGY", { color: colorToCss(THEME_COLORS.accent), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.headingSize, fontStyle: "bold" });
    this.summary = scene.add.text(THEME_SPACING.panelPadding, 25, "", { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.bodySize });
    this.progressTrack = scene.add.rectangle(THEME_SPACING.panelPadding, 57, 1, 7, THEME_COLORS.progressTrack).setOrigin(0);
    this.progressFill = scene.add.rectangle(THEME_SPACING.panelPadding, 57, 1, 7, THEME_COLORS.accent).setOrigin(0);
    this.reason = scene.add.text(THEME_SPACING.panelPadding, 68, "Select an unlocked technology", { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.statusSize });
    this.toggleButton = new ThemedButton(scene, "Expand", () => {
      this.expanded = !this.expanded;
      this.renderedKey = "";
      this.setLayout(this.viewportWidth, this.viewportHeight);
    }).setStopsPointerPropagation().setTooltip("Expand or collapse the technology tree.");
    this.buttons = TECHNOLOGY_DEFINITIONS.map((technology) =>
      new ThemedButton(scene, technology.label, () => {
        this.source.selectTechnology(technology.id);
        this.update();
      })
        .setStopsPointerPropagation()
        .setTooltip(
          `${technology.label} • Tier ${technology.tier}\nCost: ${technology.cost} RP\n${technology.effects.map(formatTechnologyEffect).join(" • ")}\nPrerequisite: ${formatPrerequisiteChain(technology.id) || "None"}`,
        ),
    );
    this.container = scene.add.container(0, 0, [this.background, heading, this.summary, this.progressTrack, this.progressFill, this.reason, this.toggleButton.container, ...this.buttons.map((button) => button.container)]).setDepth(RENDER_DEPTHS.ui + 20).setScrollFactor(0);
    this.background.on("pointerdown", (_p: Input.Pointer, _x: number, _y: number, event: { stopPropagation(): void }) => event.stopPropagation());
    scene.cameras.main.ignore(this.container);
  }

  public setLayout(viewportWidth: number, viewportHeight: number): void {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    const narrow = viewportWidth < 620;
    const width = narrow
      ? Math.max(1, viewportWidth - 24)
      : Math.min(500, viewportWidth - 288);
    const height = getResearchPanelHeight(this.expanded, viewportHeight);
    const x = narrow ? 12 : viewportWidth - width - 12;
    const y = Math.max(12, viewportHeight - height - 12);
    const contentWidth = width - THEME_SPACING.panelPadding * 2;
    const gap = 6;
    const columnWidth = (contentWidth - gap) / 2;
    this.container.setPosition(x, y);
    this.background.setSize(width, height);
    this.progressTrack.setSize(contentWidth, 7);
    this.toggleButton.setLayout(width - 78, 6, 68, 22).setText(this.expanded ? "Collapse" : "Expand");
    TECHNOLOGY_DEFINITIONS.forEach((_technology, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      this.buttons[index].setLayout(THEME_SPACING.panelPadding + column * (columnWidth + gap), 88 + row * 40, columnWidth, 32);
      this.buttons[index].setVisible(this.expanded);
    });
    this.reason.setWordWrapWidth(contentWidth).setVisible(this.expanded);
    this.update();
  }

  public update(): boolean {
    const state = this.source.getResearchState();
    const active = state.activeTechnology === undefined ? undefined : getTechnologyDefinition(state.activeTechnology);
    const progress = active === undefined ? 0 : state.accumulatedResearchProgress / active.cost;
    if (!this.hasSeenResearchPoints && state.researchPoints > 0) {
      this.hasSeenResearchPoints = true;
      this.background.setStrokeStyle(2, THEME_COLORS.validBright, 1);
      this.scene.time.delayedCall(1_500, () => {
        this.background.setStrokeStyle(this.tutorialHighlighted ? 2 : 1, this.tutorialHighlighted ? THEME_COLORS.validBright : THEME_COLORS.panelBorder, 0.9);
      });
    }
    const key = `${state.researchPoints}|${state.activeTechnology}|${state.accumulatedResearchProgress}|${state.completedOrder.length}|${this.source.isLabProducing()}|${this.expanded}`;
    if (key === this.renderedKey) return false;
    this.renderedKey = key;
    const statuses = TECHNOLOGY_DEFINITIONS.map((technology) => state.completedTechnologies.includes(technology.id) ? "completed" : state.activeTechnology === technology.id ? "active" : prerequisitesMet(state, technology.id) ? "available" : "locked");
    this.summary.setText(`RP ${state.researchPoints}  •  Active: ${active?.label ?? "None"}  •  ${state.completedOrder.length}/${TECHNOLOGY_DEFINITIONS.length} complete`);
    this.progressFill.setSize(Math.max(1, this.progressTrack.width * Math.min(1, progress)), 7).setVisible(active !== undefined);
    this.reason.setText(active === undefined ? "Tier rows show prerequisite chains • choose an available technology" : !this.source.isLabProducing() ? "Paused — staff and power a Lab" : state.researchPoints === 0 ? "Waiting for Lab Research Points" : "Research in progress");
    this.buttons.forEach((button, index) => {
      const technology = TECHNOLOGY_DEFINITIONS[index];
      const status = statuses[index];
      button.setText(`T${technology.tier} ${technology.label}\n${technology.cost} RP • ${status}`).setEnabled(status === "available" && state.activeTechnology === undefined).setSelected(status === "active");
    });
    return true;
  }

  public setTutorialHighlighted(highlighted: boolean): void {
    this.tutorialHighlighted = highlighted;
    this.toggleButton.setAttention(highlighted);
    this.background.setStrokeStyle(highlighted ? 2 : 1, highlighted ? THEME_COLORS.validBright : THEME_COLORS.panelBorder, highlighted ? 1 : 0.9);
  }
}

function formatTechnologyEffect(effect: TechnologyEffect): string {
  const percent = (value: number): string => `${Math.round((value - 1) * 100)}%`;
  switch (effect.type) {
    case "farm-production-multiplier": return `Farm production ${percent(effect.value)}`;
    case "forest-production-multiplier": return `Forest production ${percent(effect.value)}`;
    case "expedition-cost-multiplier": return `Expedition cost ${percent(effect.value)}`;
    case "power-plant-output-addition": return `Power Plant output +${effect.value}`;
    case "homes-capacity-addition": return `Homes capacity +${effect.value}`;
    case "recruitment-cost": return `Recruitment costs ${effect.value} Food`;
    case "building-cost-multiplier": return `Building cost ${percent(effect.value)}`;
    case "population-growth-interval-multiplier": return `Growth interval ${percent(effect.value)}`;
    case "expedition-duration-multiplier": return `Expedition duration ${percent(effect.value)}`;
  }
}

function formatPrerequisiteChain(id: TechnologyId): string {
  switch (id) {
    case "efficient-turbines": return " ← Farm OR Forest";
    case "improved-housing":
    case "worker-training":
    case "expedition-planning": return " ← Survey";
    case "industrial-tools": return " ← Turbines";
    case "advanced-agriculture": return " ← Farming";
    case "colony-optimization": return " ← ALL T3";
    default: return "";
  }
}

import type { GameObjects, Scene } from "phaser";

import {
  RENDER_DEPTHS,
  THEME_COLORS,
  THEME_SPACING,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "../rendering";
import {
  getPopulationGrowthEligibility,
  calculateResearchModifiers,
  type PopulationConsumptionEvent,
  type PopulationGrowthEvent,
  type ForestProductionEvent,
  type PowerAllocationSnapshot,
  type ModifierState,
  type ResearchState,
  MaterialsState,
  FoodState,
  PopulationState,
  WorkersState,
} from "../simulation";
import { ThemedButton } from "./ThemedButton";
import { createRecruitmentPanelViewModel } from "./recruitmentViewModel";
import { createPowerResourceViewModel } from "./powerViewModel";
import { getTooltipManager, TOOLTIP_CATALOG } from "./TooltipManager";

export interface ResourcePanelSource {
  getMaterialsState(): MaterialsState;
  getWorkersState(): WorkersState;
  getPopulationState(): PopulationState;
  getFoodState(): FoodState;
  requestRecruitWorker(): void;
  getPowerSnapshot(): PowerAllocationSnapshot;
  getModifierState(): ModifierState;
  getResearchState(): ResearchState;
}

export interface ResourcePanelLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function shouldEmphasizeFoodBalance(
  previousBalance: number,
  nextBalance: number,
): boolean {
  return (
    Number.isFinite(previousBalance) &&
    Number.isFinite(nextBalance) &&
    nextBalance > previousBalance
  );
}

export function getPopulationStatusLabel(
  population: PopulationState,
  food: FoodState,
): "Supplied" | "Unsupplied" | "At capacity" | "Growing" {
  const eligibility = getPopulationGrowthEligibility(population, food);

  if (eligibility.status === "at-capacity") {
    return "At capacity";
  }

  if (eligibility.status === "eligible") {
    return "Growing";
  }

  return population.latestSupplyStatus === "supplied"
    ? "Supplied"
    : "Unsupplied";
}

export function formatActiveModifiers(state: ModifierState): string {
  if (state.modifiers.length === 0) return "Modifiers: None";
  return state.modifiers
    .map((modifier) =>
      `${modifier.label}: ${Math.ceil(modifier.remainingDurationMilliseconds / 1_000)}s`,
    )
    .join("  •  ");
}

export function validateResourcePanelFeedbackFoundation(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!shouldEmphasizeFoodBalance(0, 1)) {
    errors.push("A Food increase must request restrained value emphasis.");
  }

  if (
    shouldEmphasizeFoodBalance(1, 1) ||
    shouldEmphasizeFoodBalance(2, 1)
  ) {
    errors.push("Unchanged or reduced Food must not trigger emphasis.");
  }

  const population = createPanelValidationPopulation();
  if (
    getPopulationStatusLabel(population, { food: 2 }) !== "At capacity" ||
    getPopulationStatusLabel(
      { ...population, populationCapacity: 6, latestSupplyStatus: "supplied" },
      { food: 2 },
    ) !== "Growing"
  ) {
    errors.push("Population status labels must be derived from simulation state.");
  }

  return { valid: errors.length === 0, errors };
}

export class ResourcePanel {
  private readonly background: GameObjects.Rectangle;
  private readonly container: GameObjects.Container;
  private readonly labels: readonly GameObjects.Text[];
  private readonly values: readonly GameObjects.Text[];
  private readonly populationStatusText: GameObjects.Text;
  private readonly feedbackText: GameObjects.Text;
  private readonly recruitableText: GameObjects.Text;
  private readonly recruitmentReasonText: GameObjects.Text;
  private readonly recruitButton: ThemedButton;
  private readonly powerStatusText: GameObjects.Text;
  private readonly modifierText: GameObjects.Text;
  private feedbackExpiresAt = 0;
  private feedbackTimestamp = -1;
  private lastFoodBalance = 0;
  private renderedKey = "";
  private reducedMotion = false;
  private cachedCompletedResearchCount = -1;
  private cachedRecruitmentFoodCost = 10;

  public constructor(
    private readonly scene: Scene,
    private readonly source: ResourcePanelSource,
  ) {
    this.background = scene.add
      .rectangle(0, 0, 1, 1, THEME_COLORS.panelBackground, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, THEME_COLORS.panelBorder, 0.85);
    const heading = scene.add.text(
      THEME_SPACING.panelPadding,
      7,
      "RESOURCES",
      {
        color: colorToCss(THEME_COLORS.accent),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.headingSize,
        fontStyle: "bold",
      },
    );
    const resourceNames = ["Materials", "Food", "Power", "Workers", "Population", "RP"] as const;
    const resourceIcons = ["◆", "●", "⚡", "◇", "⬡", "✦"] as const;
    this.labels = resourceNames.map(
      (label, index) =>
        scene.add.text(
          THEME_SPACING.panelPadding,
          26,
          `${resourceIcons[index]} ${label}`,
          {
            color: colorToCss(THEME_COLORS.secondaryText),
            fontFamily: THEME_TYPOGRAPHY.fontFamily,
            fontSize: THEME_TYPOGRAPHY.helperSize,
          },
        ),
    );
    this.values = this.labels.map(() =>
      scene.add.text(THEME_SPACING.panelPadding, 40, "", {
        color: colorToCss(THEME_COLORS.primaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.valueSize,
        fontStyle: "bold",
      }),
    );
    const tooltipManager = getTooltipManager(scene);
    this.labels.forEach((label, index) => {
      label.setInteractive();
      tooltipManager.register(
        label,
        () => TOOLTIP_CATALOG[resourceNames[index]] ?? label.text,
      );
    });
    this.populationStatusText = scene.add.text(
      THEME_SPACING.panelPadding,
      112,
      "",
      {
        color: colorToCss(THEME_COLORS.secondaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.statusSize,
        fontStyle: "bold",
      },
    );
    this.powerStatusText = scene.add.text(
      THEME_SPACING.panelPadding,
      100,
      "",
      {
        color: colorToCss(THEME_COLORS.secondaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.statusSize,
        fontStyle: "bold",
      },
    );
    this.recruitableText = scene.add.text(132, 112, "", {
      color: colorToCss(THEME_COLORS.primaryText),
      fontFamily: THEME_TYPOGRAPHY.fontFamily,
      fontSize: THEME_TYPOGRAPHY.statusSize,
      fontStyle: "bold",
    }).setVisible(false);
    this.recruitButton = new ThemedButton(scene, "Recruit Worker — 10 Food", () => {
      this.source.requestRecruitWorker();
      this.update();
    });
    this.recruitmentReasonText = scene.add
      .text(0, 0, "", {
        align: "center",
        color: colorToCss(THEME_COLORS.secondaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.statusSize,
      })
      .setOrigin(0.5, 0)
      .setVisible(false);
    this.feedbackText = scene.add.text(
      THEME_SPACING.panelPadding,
      112,
      "",
      {
        color: colorToCss(THEME_COLORS.warning),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.statusSize,
      },
    );
    this.modifierText = scene.add.text(
      THEME_SPACING.panelPadding,
      125,
      "Modifiers: None",
      {
        color: colorToCss(THEME_COLORS.secondaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.statusSize,
        lineSpacing: 1,
      },
    );
    this.container = scene.add
      .container(0, 0, [
        this.background,
        heading,
        ...this.labels,
        ...this.values,
        this.powerStatusText,
        this.populationStatusText,
        this.recruitableText,
        this.recruitButton.container,
        this.recruitmentReasonText,
        this.feedbackText,
        this.modifierText,
      ])
      .setDepth(RENDER_DEPTHS.ui)
      .setScrollFactor(0);

    scene.cameras.main.ignore(this.container);
    this.lastFoodBalance = this.source.getFoodState().food;
    this.update();
  }

  public setLayout(layout: ResourcePanelLayout): void {
    const contentWidth = Math.max(1, layout.width - THEME_SPACING.panelPadding * 2);
    const columnWidth = contentWidth / 3;

    this.container.setPosition(layout.x, layout.y);
    this.background.setSize(layout.width, layout.height);
    this.values.forEach((value, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = THEME_SPACING.panelPadding + columnWidth * column;
      this.labels[index].setX(x);
      this.labels[index].setY(25 + row * 42);
      value.setPosition(x, 39 + row * 42);
    });
    this.recruitableText.setX(THEME_SPACING.panelPadding + contentWidth * 0.52);
    this.recruitButton.setLayout(
      THEME_SPACING.panelPadding,
      141,
      contentWidth,
      24,
    );
    this.recruitmentReasonText.setX(layout.width / 2).setWordWrapWidth(contentWidth);
    this.populationStatusText.setWordWrapWidth(contentWidth);
    this.powerStatusText.setWordWrapWidth(contentWidth);
    this.feedbackText.setWordWrapWidth(contentWidth);
    this.modifierText.setWordWrapWidth(contentWidth);
  }

  public setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  public setAccessibility(reducedMotion: boolean, colorblindResourceColors: boolean): void {
    this.reducedMotion = reducedMotion;
    const palette = colorblindResourceColors
      ? [0x56b4e9, 0xe69f00, 0x00bfc4, 0xf0e442, 0xcc79a7, 0xffffff]
      : this.values.map(() => THEME_COLORS.primaryText);
    this.values.forEach((value, index) => value.setColor(colorToCss(palette[index])));
  }

  public update(currentTimeMilliseconds?: number): boolean {
    const materials = this.source.getMaterialsState();
    const workers = this.source.getWorkersState();
    const population = this.source.getPopulationState();
    const food = this.source.getFoodState();
    const power = this.source.getPowerSnapshot();
    const modifiers = this.source.getModifierState();
    const research = this.source.getResearchState();
    if (research.completedTechnologies.length !== this.cachedCompletedResearchCount) {
      this.cachedCompletedResearchCount = research.completedTechnologies.length;
      this.cachedRecruitmentFoodCost = calculateResearchModifiers(research).recruitmentFoodCost;
    }
    const powerViewModel = createPowerResourceViewModel(power);
    const nextValues = [
      `${materials.materials}`,
      `${food.food}`,
      powerViewModel.value,
      `${workers.availableWorkers}/${workers.totalWorkers}`,
      `${population.currentPopulation}/${population.populationCapacity}`,
      `${research.researchPoints}`,
    ];
    const populationStatus = getPopulationStatusLabel(population, food);
    const recruitment = createRecruitmentPanelViewModel(
      population,
      workers,
      food,
      this.cachedRecruitmentFoodCost,
    );
    const key = [
      ...nextValues,
      populationStatus,
      recruitment.recruitableWorkers,
      recruitment.enabled,
      recruitment.reason,
      powerViewModel.demand,
      powerViewModel.shortage,
      formatActiveModifiers(modifiers),
    ].join("|");

    if (
      currentTimeMilliseconds !== undefined &&
      this.feedbackText.text !== "" &&
      currentTimeMilliseconds >= this.feedbackExpiresAt
    ) {
      this.feedbackText.setText("");
      this.populationStatusText.setVisible(true);
      this.modifierText.setVisible(true);
      this.feedbackTimestamp = -1;
    }

    if (key === this.renderedKey) {
      return false;
    }

    this.renderedKey = key;
    this.values.forEach((value, index) => value.setText(nextValues[index]));
    this.populationStatusText.setText(`Colony: ${populationStatus}`);
    this.powerStatusText
      .setText(powerViewModel.statusText)
      .setColor(
        colorToCss(
          powerViewModel.shortage
            ? THEME_COLORS.warning
            : THEME_COLORS.secondaryText,
        ),
      );
    this.recruitableText.setText(
      `Recruitable: ${recruitment.recruitableWorkers}`,
    );
    this.recruitButton
      .setText(recruitment.buttonText)
      .setEnabled(recruitment.enabled)
      .setTooltip(`${recruitment.reason}\nRecruitment converts stored Food into one available worker.`);
    this.recruitmentReasonText
      .setText(recruitment.reason)
      .setColor(
        colorToCss(
          recruitment.enabled
            ? THEME_COLORS.valid
            : THEME_COLORS.secondaryText,
        ),
      );
    this.modifierText.setText(formatActiveModifiers(modifiers));
    this.lastFoodBalance = food.food;
    return true;
  }

  public notifyFoodProduced(newFoodBalance: number): boolean {
    const shouldEmphasize = shouldEmphasizeFoodBalance(
      this.lastFoodBalance,
      newFoodBalance,
    );

    this.update();

    if (!shouldEmphasize) {
      return false;
    }

    this.pulseValue(this.values[1], THEME_COLORS.validBright);
    return true;
  }

  public notifyMaterialsProduced(
    events: readonly ForestProductionEvent[],
    currentTimeMilliseconds: number,
  ): void {
    if (events.length === 0) {
      return;
    }

    const produced = events.reduce(
      (total, event) => total + event.materialsProduced,
      0,
    );
    this.update(currentTimeMilliseconds);
    this.pulseValue(this.values[0], THEME_COLORS.accent);
    this.showFeedback(
      `Materials produced: +${produced}`,
      currentTimeMilliseconds,
      THEME_COLORS.accent,
    );
  }

  public notifyConsumptionEvents(
    events: readonly PopulationConsumptionEvent[],
    currentTimeMilliseconds: number,
  ): void {
    if (events.length === 0) {
      return;
    }

    const consumed = events.reduce(
      (total, event) => total + event.foodConsumed,
      0,
    );
    const shortage = events.some(
      (event) => event.supplyStatus === "unsupplied",
    );
    const messages = [
      consumed > 0 ? `Food consumed: -${consumed}` : undefined,
      shortage ? "Food shortage" : undefined,
    ].filter((message): message is string => message !== undefined);

    if (consumed > 0) {
      this.pulseValue(this.values[1], THEME_COLORS.warning);
    }

    this.showFeedback(
      messages.join(" • "),
      currentTimeMilliseconds,
      shortage ? THEME_COLORS.warning : THEME_COLORS.secondaryText,
    );
  }

  public notifyGrowthEvents(
    events: readonly PopulationGrowthEvent[],
    currentTimeMilliseconds: number,
  ): void {
    const grownEvents = events.filter((event) => event.status === "grown");
    const latestGrowth = grownEvents[grownEvents.length - 1];

    if (latestGrowth === undefined) {
      return;
    }

    this.pulseValue(this.values[1], THEME_COLORS.warning);
    this.pulseValue(this.values[4], THEME_COLORS.validBright);
    this.showFeedback(
      `Population increased to ${latestGrowth.populationAfter}`,
      currentTimeMilliseconds,
      THEME_COLORS.validBright,
    );
  }

  public notifyWorkerRecruited(
    currentTimeMilliseconds: number,
  ): void {
    this.update(currentTimeMilliseconds);
    this.pulseValue(this.values[1], THEME_COLORS.warning);
    this.pulseValue(this.values[3], THEME_COLORS.validBright);
    this.showFeedback(
      "Worker recruited",
      currentTimeMilliseconds,
      THEME_COLORS.validBright,
    );
  }

  private showFeedback(
    message: string,
    currentTimeMilliseconds: number,
    color: number,
  ): void {
    const combinedMessage =
      this.feedbackTimestamp === currentTimeMilliseconds &&
      this.feedbackText.text !== ""
        ? `${this.feedbackText.text} • ${message}`
        : message;

    this.feedbackTimestamp = currentTimeMilliseconds;
    this.feedbackExpiresAt = currentTimeMilliseconds + 3_000;
    this.feedbackText
      .setText(combinedMessage)
      .setColor(colorToCss(color));
    this.populationStatusText.setVisible(false);
    this.modifierText.setVisible(false);
  }

  private pulseValue(value: GameObjects.Text, color: number): void {
    if (this.reducedMotion) {
      return;
    }
    const originalColor = value.style.color;
    this.scene.tweens.killTweensOf(value);
    value.setColor(colorToCss(color)).setScale(1.16);
    this.scene.tweens.add({
      targets: value,
      scaleX: 1,
      scaleY: 1,
      duration: 420,
      ease: "Quad.Out",
      onComplete: () => {
        value.setColor(originalColor);
      },
    });
  }
}

function createPanelValidationPopulation(): PopulationState {
  return {
    currentPopulation: 4,
    populationCapacity: 4,
    accumulatedConsumptionMilliseconds: 0,
    accumulatedGrowthMilliseconds: 0,
    latestSupplyStatus: "pending",
    totalSuppliedCycles: 0,
    totalUnsuppliedCycles: 0,
  };
}

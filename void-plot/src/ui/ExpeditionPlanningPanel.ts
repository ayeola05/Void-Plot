import type { GameObjects, Scene } from "phaser";

import {
  RENDER_DEPTHS,
  THEME_COLORS,
  THEME_SPACING,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "../rendering";
import {
  getActiveExpedition,
  getExpeditionCountdown,
  validateExpeditionLaunchAvailability,
  type ExpeditionCountdownSnapshot,
  type ExpeditionLaunchAvailabilityResult,
  type ExpeditionState,
  type MaterialsState,
  type WorkersState,
  type ResearchModifierSnapshot,
} from "../simulation";
import {
  validateExpeditionSectorSelection,
  type ExpeditionSectorSelectionResult,
  type WorldState,
} from "../world";
import { ThemedButton } from "./ThemedButton";

export type ValidSelectedExpeditionSector = Extract<
  ExpeditionSectorSelectionResult,
  { status: "valid" }
>;

export interface ExpeditionSectorSelectionSource {
  getSelectedSector(): ValidSelectedExpeditionSector | undefined;
}

export interface ExpeditionPlanningGameplaySource {
  getExpeditionState(): ExpeditionState;
  getMaterialsState(): MaterialsState;
  getWorkersState(): WorkersState;
  getCurrentTimeMilliseconds(): number;
  requestStartExpedition(): void;
  getResearchModifiers(): ResearchModifierSnapshot;
  getMaterialRecoveryWarning?(materialCost: number): string | undefined;
}

export interface ExpeditionPlanningPanelLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExpeditionPlanningViewModel {
  readonly selectedSectorText: readonly string[];
  readonly launchAvailability: ExpeditionLaunchAvailabilityResult;
  readonly startEnabled: boolean;
  readonly disabledReason: string;
  readonly activeCountdown?: ExpeditionCountdownSnapshot;
}

export interface ExpeditionPlanningPanelValidationResult {
  valid: boolean;
  errors: string[];
}

export function createExpeditionPlanningViewModel(
  world: WorldState,
  selectedSector: ValidSelectedExpeditionSector | undefined,
  materialsState: MaterialsState,
  workersState: WorkersState,
  expeditionState: ExpeditionState,
  currentTimeMilliseconds: number,
  researchModifiers?: ResearchModifierSnapshot,
): ExpeditionPlanningViewModel {
  const currentSelection =
    selectedSector === undefined
      ? undefined
      : validateExpeditionSectorSelection(
          world,
          selectedSector.origin,
          selectedSector.size,
        );
  const launchAvailability = validateExpeditionLaunchAvailability(
    world,
    expeditionState,
    materialsState,
    workersState,
    selectedSector,
    researchModifiers === undefined ? {} : {
      materialCostMultiplier: researchModifiers.expeditionCostMultiplier,
      durationMultiplier: researchModifiers.expeditionDurationMultiplier,
    },
  );
  const activeExpedition = getActiveExpedition(expeditionState);
  const activeCountdown =
    activeExpedition === undefined
      ? undefined
      : getExpeditionCountdown(activeExpedition, currentTimeMilliseconds);

  return {
    selectedSectorText: formatSelectedSectorDetails(currentSelection),
    launchAvailability,
    startEnabled: launchAvailability.status === "ready",
    disabledReason: formatLaunchDisabledReason(launchAvailability),
    activeCountdown,
  };
}

export function formatLaunchDisabledReason(
  availability: ExpeditionLaunchAvailabilityResult,
): string {
  if (availability.status === "ready") {
    return "Ready to launch";
  }

  if (availability.status === "no-sector-selected") {
    return "Select a frontier sector: hover a hidden edge, press 2, 4, or 6, then click green.";
  }

  if (availability.status === "planning-blocked") {
    switch (availability.reason) {
      case "out-of-bounds":
        return "Sector is outside the world. Move the preview away from the map edge.";
      case "already-fully-revealed":
        return "Sector is already revealed. Choose a sector containing hidden tiles.";
      case "not-adjacent":
        return "Invalid sector. Choose hidden tiles touching revealed territory orthogonally.";
      case "duplicate-sector":
        return "This sector already has an expedition. Choose different bounds.";
    }
  }

  switch (availability.reason) {
    case "insufficient-materials":
      return "Insufficient Materials. Staff a powered Forest or choose a smaller sector.";
    case "insufficient-workers":
      return "No available workers. Recruit one or release a worker from a building.";
    case "active-expedition-limit-reached":
      return "Another expedition is active. Wait for it to return.";
    case "sector-no-longer-has-hidden-tiles":
      return "Sector has no hidden tiles";
    case "invalid-sector":
      return "Sector is no longer valid";
    case "invalid-materials-state":
      return "Materials state is invalid";
    case "invalid-workers-state":
      return "Worker state is invalid";
    case "expedition-not-found":
    case "expedition-not-planned":
    case "invalid-transition":
    case "invalid-clock-value":
      return "Expedition cannot start safely";
  }
}

export function formatExpeditionPlanningPanelText(
  viewModel: ExpeditionPlanningViewModel,
): string {
  const requirements =
    viewModel.launchAvailability.status === "no-sector-selected"
      ? undefined
      : viewModel.launchAvailability.requirements;

  return [
    ...viewModel.selectedSectorText,
    requirements === undefined
      ? "Plan  —"
      : `Plan  ${requirements.materialCost} mat  •  ${requirements.requiredWorkers} worker${requirements.requiredWorkers === 1 ? "" : "s"}  •  ${requirements.durationSeconds}s`,
  ].join("\n");
}

function formatSelectedSectorDetails(
  selection?: ExpeditionSectorSelectionResult,
): readonly string[] {
  if (selection === undefined) {
    return ["No sector selected", "Hover • press 2, 4, or 6 • click a valid sector"];
  }

  if (selection.status === "out-of-bounds") {
    return [
      `${selection.size}×${selection.size}  Origin ${selection.origin.x},${selection.origin.y}`,
      "Outside world bounds",
    ];
  }

  return [
    `${selection.size}×${selection.size}  Origin ${selection.origin.x},${selection.origin.y}`,
    `Bounds  X ${selection.bounds.minX}–${selection.bounds.maxX}  Y ${selection.bounds.minY}–${selection.bounds.maxY}`,
    `Hidden  ${selection.hiddenCoordinates.length}/${selection.coordinates.length}  •  ${selection.status}`,
  ];
}

export class ExpeditionPlanningPanel {
  private readonly activeText: GameObjects.Text;
  private readonly background: GameObjects.Rectangle;
  private readonly completionText: GameObjects.Text;
  private readonly container: GameObjects.Container;
  private readonly detailsText: GameObjects.Text;
  private readonly disabledReasonText: GameObjects.Text;
  private readonly progressFill: GameObjects.Rectangle;
  private readonly progressTrack: GameObjects.Rectangle;
  private readonly startButton: ThemedButton;
  private completionMessage = "";
  private completionMessageExpiresAt = 0;
  private layoutWidth = 1;
  private layoutHeight = 1;
  private renderedKey = "";

  public constructor(
    scene: Scene,
    private readonly world: WorldState,
    private readonly selectionSource: ExpeditionSectorSelectionSource,
    private readonly gameplaySource: ExpeditionPlanningGameplaySource,
  ) {
    const padding = THEME_SPACING.panelPadding;

    this.background = scene.add
      .rectangle(0, 0, 1, 1, THEME_COLORS.panelBackground, 0.96)
      .setOrigin(0)
      .setStrokeStyle(1, THEME_COLORS.panelBorder, 0.85);
    const heading = scene.add.text(padding, 8, "EXPEDITION", {
      color: colorToCss(THEME_COLORS.accent),
      fontFamily: THEME_TYPOGRAPHY.fontFamily,
      fontSize: THEME_TYPOGRAPHY.headingSize,
      fontStyle: "bold",
    });
    this.detailsText = scene.add.text(padding, 27, "", {
      color: colorToCss(THEME_COLORS.primaryText),
      fontFamily: THEME_TYPOGRAPHY.fontFamily,
      fontSize: THEME_TYPOGRAPHY.bodySize,
      lineSpacing: 1,
    });
    this.activeText = scene.add.text(padding, 80, "", {
      color: colorToCss(THEME_COLORS.primaryText),
      fontFamily: THEME_TYPOGRAPHY.fontFamily,
      fontSize: THEME_TYPOGRAPHY.bodySize,
      lineSpacing: 1,
    });
    this.progressTrack = scene.add
      .rectangle(padding, 122, 1, 7, THEME_COLORS.progressTrack)
      .setOrigin(0);
    this.progressFill = scene.add
      .rectangle(padding, 122, 1, 7, THEME_COLORS.accent)
      .setOrigin(0);
    this.completionText = scene.add.text(padding, 133, "", {
      color: colorToCss(THEME_COLORS.valid),
      fontFamily: THEME_TYPOGRAPHY.fontFamily,
      fontSize: THEME_TYPOGRAPHY.statusSize,
      fontStyle: "bold",
    });
    this.disabledReasonText = scene.add
      .text(0, 0, "", {
        align: "center",
        color: colorToCss(THEME_COLORS.secondaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.statusSize,
      })
      .setOrigin(0.5, 0);
    this.startButton = new ThemedButton(scene, "Start Expedition", () => {
      this.gameplaySource.requestStartExpedition();
    });
    this.container = scene.add
      .container(0, 0, [
        this.background,
        heading,
        this.detailsText,
        this.activeText,
        this.progressTrack,
        this.progressFill,
        this.completionText,
        this.disabledReasonText,
        this.startButton.container,
      ])
      .setDepth(RENDER_DEPTHS.ui)
      .setScrollFactor(0);

    scene.cameras.main.ignore(this.container);
    this.update();
  }

  public setLayout(layout: ExpeditionPlanningPanelLayout): void {
    const padding = THEME_SPACING.panelPadding;
    const contentWidth = Math.max(1, layout.width - padding * 2);
    const buttonY = Math.max(
      140,
      layout.height - padding - THEME_SPACING.buttonHeight,
    );

    this.layoutWidth = layout.width;
    this.layoutHeight = layout.height;
    this.container.setPosition(layout.x, layout.y);
    this.background.setSize(layout.width, layout.height);
    this.detailsText.setWordWrapWidth(contentWidth);
    this.activeText.setWordWrapWidth(contentWidth);
    this.progressTrack.setSize(contentWidth, 7);
    this.disabledReasonText
      .setPosition(layout.width / 2, buttonY - 18)
      .setWordWrapWidth(contentWidth);
    this.startButton.setLayout(
      padding,
      buttonY,
      contentWidth,
      THEME_SPACING.buttonHeight,
    );
    this.renderCurrentState();
  }

  public update(): boolean {
    return this.renderCurrentState();
  }

  public showCompletionMessage(message: string, durationMilliseconds = 4_000): void {
    const now = this.gameplaySource.getCurrentTimeMilliseconds();
    this.completionMessage = message;
    this.completionMessageExpiresAt = now + durationMilliseconds;
    this.renderedKey = "";
    this.renderCurrentState();
  }

  public setTutorialHighlighted(highlighted: boolean): void {
    this.background.setStrokeStyle(
      highlighted ? 2 : 1,
      highlighted ? THEME_COLORS.validBright : THEME_COLORS.panelBorder,
      highlighted ? 1 : 0.85,
    );
    this.startButton.setAttention(highlighted);
  }

  private renderCurrentState(): boolean {
    const now = this.gameplaySource.getCurrentTimeMilliseconds();

    if (this.completionMessage !== "" && now >= this.completionMessageExpiresAt) {
      this.completionMessage = "";
    }

    const viewModel = createExpeditionPlanningViewModel(
      this.world,
      this.selectionSource.getSelectedSector(),
      this.gameplaySource.getMaterialsState(),
      this.gameplaySource.getWorkersState(),
      this.gameplaySource.getExpeditionState(),
      now,
      this.gameplaySource.getResearchModifiers(),
    );
    const details = formatExpeditionPlanningPanelText(viewModel);
    const activeText = formatActiveExpeditionText(viewModel.activeCountdown);
    const requirements = viewModel.launchAvailability.status === "no-sector-selected" ? undefined : viewModel.launchAvailability.requirements;
    const recoveryWarning = viewModel.startEnabled && requirements !== undefined
      ? this.gameplaySource.getMaterialRecoveryWarning?.(requirements.materialCost)
      : undefined;
    const startEnabled = viewModel.startEnabled && recoveryWarning === undefined;
    const disabledReason = recoveryWarning ?? viewModel.disabledReason;
    const compact = this.selectionSource.getSelectedSector() === undefined && viewModel.activeCountdown === undefined && this.completionMessage === "";
    const key = JSON.stringify({
      details,
      activeText,
      progress: viewModel.activeCountdown?.progress ?? 0,
      enabled: startEnabled,
      reason: disabledReason,
      completion: this.completionMessage,
      width: this.layoutWidth,
      height: this.layoutHeight,
      compact,
    });

    if (key === this.renderedKey) {
      return false;
    }

    this.renderedKey = key;
    this.background.setSize(this.layoutWidth, compact ? 58 : this.layoutHeight);
    this.detailsText.setText(details);
    this.activeText.setText(activeText).setVisible(!compact);
    this.progressTrack.setVisible(viewModel.activeCountdown !== undefined);
    this.progressFill
      .setVisible(viewModel.activeCountdown !== undefined)
      .setSize(
        Math.max(
          1,
          (this.layoutWidth - THEME_SPACING.panelPadding * 2) *
            (viewModel.activeCountdown?.progress ?? 0),
        ),
        7,
      );
    this.completionText.setText(this.completionMessage);
    this.disabledReasonText
      .setText(disabledReason)
      .setVisible(!compact)
      .setColor(
        colorToCss(
          startEnabled
            ? THEME_COLORS.valid
            : THEME_COLORS.secondaryText,
        ),
      );
    this.startButton.setEnabled(startEnabled).setVisible(!compact);
    return true;
  }
}

function formatActiveExpeditionText(
  countdown?: ExpeditionCountdownSnapshot,
): string {
  if (countdown === undefined) {
    return ["ACTIVE", "None"].join("\n");
  }

  const expedition = countdown.expedition;

  return [
    `ACTIVE  ${expedition.sector.size}×${expedition.sector.size}`,
    `${countdown.remainingSeconds}s remaining  •  ${Math.round(countdown.progress * 100)}%`,
    `${expedition.requirements.materialCost} materials spent  •  ${expedition.requirements.requiredWorkers} workers assigned`,
  ].join("\n");
}

export function validateExpeditionPlanningPanelFoundation(): ExpeditionPlanningPanelValidationResult {
  const errors: string[] = [];

  if (!formatLaunchDisabledReason({ status: "no-sector-selected" }).includes("sector")) {
    errors.push("Empty selection must provide a visible disabled reason.");
  }

  const requirements = Object.freeze({
    materialCost: 20,
    requiredWorkers: 1,
    durationSeconds: 30,
  });
  const insufficientMaterials: ExpeditionLaunchAvailabilityResult = {
    status: "activation-blocked",
    reason: "insufficient-materials",
    requirements,
  };
  const activeLimit: ExpeditionLaunchAvailabilityResult = {
    status: "activation-blocked",
    reason: "active-expedition-limit-reached",
    requirements,
  };

  if (!formatLaunchDisabledReason(insufficientMaterials).includes("Forest")) {
    errors.push("Insufficient materials must explain the renewable recovery path.");
  }

  if (!formatLaunchDisabledReason(activeLimit).includes("Wait")) {
    errors.push("The active limit must have a concise disabled reason.");
  }

  return { valid: errors.length === 0, errors };
}

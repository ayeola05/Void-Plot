import type { GameObjects, Input, Scene } from "phaser";

import type {
  EventChoiceAvailability,
  EventDefinition,
} from "../simulation";
import {
  RENDER_DEPTHS,
  THEME_COLORS,
  THEME_SPACING,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "../rendering";
import { ThemedButton } from "./ThemedButton";

export interface EventDilemmaModalSource {
  getActiveEvent(): EventDefinition | undefined;
  getChoiceAvailability(choiceId: string): EventChoiceAvailability;
  resolveChoice(choiceId: string): void;
}

export class EventDilemmaModal {
  private readonly dimmer: GameObjects.Rectangle;
  private readonly panel: GameObjects.Rectangle;
  private readonly title: GameObjects.Text;
  private readonly description: GameObjects.Text;
  private readonly reason: GameObjects.Text;
  private readonly buttons: readonly ThemedButton[];
  private readonly container: GameObjects.Container;
  private width = 1;
  private height = 1;
  private renderedKey = "";

  public constructor(
    scene: Scene,
    private readonly source: EventDilemmaModalSource,
  ) {
    this.dimmer = scene.add
      .rectangle(0, 0, 1, 1, 0x000000, 0.64)
      .setOrigin(0)
      .setInteractive();
    this.panel = scene.add
      .rectangle(0, 0, 440, 286, THEME_COLORS.panelBackground, 0.99)
      .setOrigin(0)
      .setStrokeStyle(2, THEME_COLORS.accentMuted, 1)
      .setInteractive();
    this.title = scene.add.text(0, 0, "", {
      color: colorToCss(THEME_COLORS.accent),
      fontFamily: THEME_TYPOGRAPHY.fontFamily,
      fontSize: "20px",
      fontStyle: "bold",
      align: "center",
    }).setOrigin(0.5, 0);
    this.description = scene.add.text(0, 0, "", {
      color: colorToCss(THEME_COLORS.primaryText),
      fontFamily: THEME_TYPOGRAPHY.fontFamily,
      fontSize: "13px",
      align: "center",
      lineSpacing: 3,
    }).setOrigin(0.5, 0);
    this.reason = scene.add.text(0, 0, "", {
      color: colorToCss(THEME_COLORS.warning),
      fontFamily: THEME_TYPOGRAPHY.fontFamily,
      fontSize: THEME_TYPOGRAPHY.statusSize,
      align: "center",
    }).setOrigin(0.5, 0);
    this.buttons = [0, 1, 2].map((index) =>
      new ThemedButton(scene, "", () => {
        const event = this.source.getActiveEvent();
        const choice = event?.choices[index];
        if (choice !== undefined) this.source.resolveChoice(choice.id);
      }).setVisible(false).setStopsPointerPropagation(),
    );
    this.container = scene.add.container(0, 0, [
      this.dimmer,
      this.panel,
      this.title,
      this.description,
      this.reason,
      ...this.buttons.map((button) => button.container),
    ]).setDepth(RENDER_DEPTHS.ui + 100).setScrollFactor(0).setVisible(false);

    const stopPropagation = (
      _pointer: Input.Pointer,
      _localX: number,
      _localY: number,
      event: { stopPropagation(): void },
    ): void => event.stopPropagation();
    this.dimmer.on("pointerdown", stopPropagation);
    this.panel.on("pointerdown", stopPropagation);
    scene.cameras.main.ignore(this.container);
  }

  public setLayout(width: number, height: number): void {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.dimmer.setSize(this.width, this.height);
    const panelWidth = Math.min(440, Math.max(280, this.width - 32));
    const panelHeight = 286;
    const panelX = (this.width - panelWidth) / 2;
    const panelY = Math.max(12, (this.height - panelHeight) / 2);
    const contentWidth = panelWidth - THEME_SPACING.panelPadding * 4;
    this.panel.setPosition(panelX, panelY).setSize(panelWidth, panelHeight);
    this.title.setPosition(this.width / 2, panelY + 20).setWordWrapWidth(contentWidth);
    this.description.setPosition(this.width / 2, panelY + 58).setWordWrapWidth(contentWidth);
    this.reason.setPosition(this.width / 2, panelY + 121).setWordWrapWidth(contentWidth);
    this.buttons.forEach((button, index) =>
      button.setLayout(panelX + 28, panelY + 148 + index * 39, panelWidth - 56, 31),
    );
  }

  public update(): boolean {
    const event = this.source.getActiveEvent();
    if (event === undefined) {
      this.container.setVisible(false);
      this.renderedKey = "";
      return false;
    }

    const availability = event.choices.map((choice) =>
      this.source.getChoiceAvailability(choice.id),
    );
    const key = `${event.id}|${event.choices.map((choice, index) => `${choice.id}:${availability[index].status}`).join("|")}`;
    this.container.setVisible(true);
    if (key === this.renderedKey) return false;
    this.renderedKey = key;
    this.title.setText(event.title);
    this.description.setText(event.description);
    const unavailable = availability.find((result) => result.status !== "available");
    this.reason.setText(unavailable === undefined ? "Choose a response" : formatEventChoiceUnavailable(unavailable));
    this.buttons.forEach((button, index) => {
      const choice = event.choices[index];
      button
        .setVisible(choice !== undefined)
        .setText(choice?.label ?? "")
        .setTooltip(
          choice === undefined
            ? "Unavailable event choice"
            : `${event.description}\nChoice: ${choice.label}`,
        )
        .setEnabled(choice !== undefined && availability[index]?.status === "available");
    });
    return true;
  }
}

export function formatEventChoiceUnavailable(result: EventChoiceAvailability): string {
  switch (result.status) {
    case "available": return "";
    case "insufficient-food": return `A response needs ${result.required} Food`;
    case "insufficient-materials": return `A response needs ${result.required} Materials`;
    case "population-at-capacity": return "No free housing capacity";
    case "invalid-state": return "Colony state is invalid";
  }
}

import type { GameObjects, Input, Scene } from "phaser";

import {
  THEME_COLORS,
  THEME_SPACING,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "../rendering";
import { getSoundEventBus } from "../game/soundEvents";
import { getAccessibilitySettings } from "../game/accessibility";
import { getTooltipManager } from "./TooltipManager";

type ButtonInteractionState = "normal" | "hovered" | "pressed";

export class ThemedButton {
  public readonly container: GameObjects.Container;
  private readonly background: GameObjects.Rectangle;
  private readonly label: GameObjects.Text;
  private enabled = true;
  private interactionState: ButtonInteractionState = "normal";
  private selected = false;
  private attention = false;
  private stopsPointerPropagation = false;
  private tooltipText?: string;

  public constructor(
    scene: Scene,
    text: string,
    private readonly onPress: () => void,
  ) {
    this.background = scene.add
      .rectangle(0, 0, 1, THEME_SPACING.buttonHeight)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true });
    this.label = scene.add
      .text(0, THEME_SPACING.buttonHeight / 2, text, {
        color: colorToCss(THEME_COLORS.primaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.buttonSize,
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.container = scene.add.container(0, 0, [this.background, this.label]);

    this.background.on("pointerover", this.handlePointerOver, this);
    this.background.on("pointerout", this.handlePointerOut, this);
    this.background.on("pointerdown", this.handlePointerDown, this);
    this.background.on("pointerup", this.handlePointerUp, this);
    getTooltipManager(scene).register(
      this.background,
      () => this.tooltipText ?? this.label.text,
    );
    this.applyStyle();
  }

  public setLayout(x: number, y: number, width: number, height: number): this {
    this.container.setPosition(x, y);
    this.background.setSize(width, height);
    this.label.setPosition(width / 2, height / 2);
    return this;
  }

  public setText(text: string): this {
    this.label.setText(text);
    return this;
  }

  public setTooltip(text: string): this {
    this.tooltipText = text;
    return this;
  }

  public setEnabled(enabled: boolean): this {
    if (this.enabled === enabled) {
      return this;
    }

    this.enabled = enabled;
    this.interactionState = "normal";
    this.applyStyle();
    return this;
  }

  public setSelected(selected: boolean): this {
    if (this.selected === selected) {
      return this;
    }

    this.selected = selected;
    this.applyStyle();
    return this;
  }

  public setAttention(attention: boolean): this {
    if (this.attention === attention) return this;
    this.attention = attention;
    this.applyStyle();
    return this;
  }

  public setVisible(visible: boolean): this {
    this.container.setVisible(visible);
    return this;
  }

  public setStopsPointerPropagation(stops = true): this {
    this.stopsPointerPropagation = stops;
    return this;
  }

  private handlePointerOver(): void {
    if (this.enabled) {
      this.interactionState = "hovered";
      this.applyStyle();
      this.animateScale(1.025, 110);
    }
  }

  private handlePointerOut(): void {
    this.interactionState = "normal";
    this.applyStyle();
    this.animateScale(1, 130);
  }

  private handlePointerDown(
    pointer: Input.Pointer,
    _localX?: number,
    _localY?: number,
    event?: { stopPropagation(): void },
  ): void {
    if (this.stopsPointerPropagation) event?.stopPropagation();
    if (this.enabled && pointer.button === 0) {
      this.interactionState = "pressed";
      this.applyStyle();
      this.animateScale(0.985, 70);
    }
  }

  private handlePointerUp(
    pointer: Input.Pointer,
    _localX?: number,
    _localY?: number,
    event?: { stopPropagation(): void },
  ): void {
    if (this.stopsPointerPropagation) event?.stopPropagation();
    if (!this.enabled || pointer.button !== 0) {
      return;
    }

    this.interactionState = "hovered";
    this.applyStyle();
    this.animateScale(1.025, 100);
    getSoundEventBus(this.container.scene.registry).emit("buttonClick");
    this.onPress();
  }

  private animateScale(scale: number, duration: number): void {
    const scene = this.container.scene;
    if (getAccessibilitySettings(scene.registry).reducedMotion) {
      this.container.setScale(1);
      return;
    }
    scene.tweens.killTweensOf(this.container);
    scene.tweens.add({ targets: this.container, scaleX: scale, scaleY: scale, duration, ease: "Sine.Out" });
  }

  private applyStyle(): void {
    const backgroundColor = !this.enabled
      ? THEME_COLORS.buttonDisabled
      : this.interactionState === "pressed"
        ? THEME_COLORS.buttonPressed
        : this.selected
          ? THEME_COLORS.buttonSelected
          : this.interactionState === "hovered"
            ? THEME_COLORS.buttonHover
            : THEME_COLORS.buttonNormal;
    const borderColor = this.selected
      ? THEME_COLORS.accent
      : this.attention
        ? THEME_COLORS.validBright
      : THEME_COLORS.panelBorder;

    this.background
      .setFillStyle(backgroundColor, this.enabled ? 1 : 0.72)
      .setStrokeStyle(this.attention ? 2 : 1, borderColor, this.enabled ? 0.9 : 0.45);
    this.label.setColor(
      colorToCss(
        this.enabled ? THEME_COLORS.primaryText : THEME_COLORS.secondaryText,
      ),
    );
  }
}

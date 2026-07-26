import type { GameObjects, Input, Scene } from "phaser";
import type { BuildingType } from "../simulation";
import {
  BuildingThumbnail,
  THEME_COLORS,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "../rendering";
import { getAccessibilitySettings } from "../game/accessibility";
import { getTooltipManager } from "./TooltipManager";

export type ConstructionCardAvailability =
  | "available"
  | "unaffordable"
  | "reserve-blocked"
  | "unavailable";

export interface ConstructionCardViewModel {
  readonly type: BuildingType;
  readonly name: string;
  readonly role: string;
  readonly roleSymbol: string;
  readonly roleColor: number;
  readonly cost: number;
  readonly currentMaterials: number;
  readonly availability: ConstructionCardAvailability;
  readonly visibleReason?: string;
  readonly tooltip: string;
}

export type ConstructionCardLayoutMode = "grid" | "compact";

export class ConstructionCard {
  public readonly container: GameObjects.Container;
  private readonly background: GameObjects.Rectangle;
  private readonly inset: GameObjects.Rectangle;
  private readonly thumbnail: BuildingThumbnail;
  private readonly nameText: GameObjects.Text;
  private readonly roleBadge: GameObjects.Rectangle;
  private readonly roleText: GameObjects.Text;
  private readonly costText: GameObjects.Text;
  private readonly stateText: GameObjects.Text;
  private selected = false;
  private hovered = false;
  private attention = false;
  private view: ConstructionCardViewModel;

  public constructor(
    private readonly scene: Scene,
    initialView: ConstructionCardViewModel,
    private readonly onPress: (type: BuildingType) => void,
  ) {
    this.view = initialView;
    this.background = scene.add.rectangle(0, 0, 1, 1, THEME_COLORS.constructionCard).setOrigin(0).setInteractive({ useHandCursor: true });
    this.inset = scene.add.rectangle(4, 4, 1, 1, THEME_COLORS.constructionCardInset, 0.72).setOrigin(0);
    this.thumbnail = new BuildingThumbnail(scene, initialView.type);
    this.nameText = scene.add.text(0, 0, initialView.name, {
      color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "11px", fontStyle: "bold",
    });
    this.roleBadge = scene.add.rectangle(0, 0, 1, 14, initialView.roleColor, 0.16).setOrigin(0).setStrokeStyle(1, initialView.roleColor, 0.55);
    this.roleText = scene.add.text(0, 0, `${initialView.roleSymbol} ${initialView.role}`, {
      color: colorToCss(initialView.roleColor), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "9px", fontStyle: "bold",
    });
    this.costText = scene.add.text(0, 0, "", {
      color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "9px", fontStyle: "bold",
    });
    this.stateText = scene.add.text(0, 0, "", {
      color: colorToCss(THEME_COLORS.accent), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "8px", fontStyle: "bold",
    }).setOrigin(1, 0);
    this.container = scene.add.container(0, 0, [
      this.background, this.inset, this.thumbnail.container, this.nameText,
      this.roleBadge, this.roleText, this.costText, this.stateText,
    ]);
    this.background.on("pointerover", this.handlePointerOver, this);
    this.background.on("pointerout", this.handlePointerOut, this);
    this.background.on("pointerdown", this.handlePointerDown, this);
    this.background.on("pointerup", this.handlePointerUp, this);
    getTooltipManager(scene).register(this.background, () => this.view.tooltip);
    this.setViewModel(initialView);
  }

  public setLayout(x: number, y: number, width: number, height: number, mode: ConstructionCardLayoutMode): this {
    this.container.setPosition(x, y);
    this.background.setSize(width, height);
    this.inset.setSize(Math.max(1, width - 8), Math.max(1, height - 8));
    if (mode === "compact") {
      const thumbnailSize = Math.min(30, height - 10);
      this.thumbnail.setLayout(7 + thumbnailSize / 2, height / 2, thumbnailSize);
      const textX = thumbnailSize + 13;
      this.nameText.setPosition(textX, 5).setFontSize(10);
      this.roleBadge.setPosition(textX, 18).setSize(Math.max(1, width - textX - 5), 11);
      this.roleText.setPosition(textX + 3, 18).setFontSize(8);
      this.costText.setPosition(textX, height - 13).setFontSize(9);
    } else {
      const thumbnailSize = Math.min(42, Math.max(30, height * 0.43));
      this.thumbnail.setLayout(width / 2, 7 + thumbnailSize / 2, thumbnailSize);
      const nameY = 9 + thumbnailSize;
      this.nameText.setPosition(7, nameY).setFontSize(11);
      this.roleBadge.setPosition(6, nameY + 15).setSize(Math.max(1, width - 12), 13);
      this.roleText.setPosition(9, nameY + 16).setFontSize(8);
      this.costText.setPosition(7, height - 14).setFontSize(9);
    }
    this.stateText.setPosition(width - 6, 5);
    return this;
  }

  public setViewModel(view: ConstructionCardViewModel): this {
    this.view = view;
    this.nameText.setText(view.name);
    this.roleText.setText(`${view.roleSymbol} ${view.role}`).setColor(colorToCss(view.roleColor));
    this.roleBadge.setFillStyle(view.roleColor, 0.16).setStrokeStyle(1, view.roleColor, 0.55);
    this.costText.setText(view.availability === "unaffordable" ? `◆ ${view.currentMaterials} / ${view.cost}` : `◆ ${view.cost}`);
    this.applyStyle();
    return this;
  }

  public setSelected(selected: boolean): this { this.selected = selected; this.applyStyle(); return this; }
  public setAttention(attention: boolean): this { this.attention = attention; this.applyStyle(); return this; }

  public update(time: number, reducedMotion: boolean, particles: boolean): void {
    this.thumbnail.update(time, reducedMotion || !particles);
  }

  private handlePointerOver(): void {
    this.hovered = true; this.applyStyle(); this.animateScale(1.018, 100);
  }
  private handlePointerOut(): void {
    this.hovered = false; this.applyStyle(); this.animateScale(1, 120);
  }
  private handlePointerDown(pointer: Input.Pointer): void {
    if (pointer.button === 0 && this.canPress()) this.animateScale(0.975, 60);
  }
  private handlePointerUp(pointer: Input.Pointer): void {
    if (pointer.button !== 0 || !this.canPress()) return;
    this.animateScale(1.018, 90);
    this.onPress(this.view.type);
  }

  private canPress(): boolean {
    return this.view.availability === "available" || this.view.availability === "reserve-blocked";
  }

  private animateScale(scale: number, duration: number): void {
    if (getAccessibilitySettings(this.scene.registry).reducedMotion) { this.container.setScale(1); return; }
    this.scene.tweens.killTweensOf(this.container);
    this.scene.tweens.add({ targets: this.container, scaleX: scale, scaleY: scale, duration, ease: "Sine.Out" });
  }

  private applyStyle(): void {
    const unavailable = this.view.availability === "unavailable";
    const unaffordable = this.view.availability === "unaffordable";
    const blocked = this.view.availability === "reserve-blocked";
    const fill = unavailable || unaffordable
      ? THEME_COLORS.constructionCardDisabled
      : this.selected
        ? THEME_COLORS.constructionCardSelected
        : this.hovered
          ? THEME_COLORS.constructionCardHover
          : THEME_COLORS.constructionCard;
    const border = this.selected
      ? THEME_COLORS.accent
      : blocked
        ? THEME_COLORS.warning
        : this.hovered || this.attention
          ? this.view.roleColor
          : THEME_COLORS.panelBorder;
    this.background.setFillStyle(fill, 1).setStrokeStyle(this.selected ? 2 : 1, border, this.attention ? 1 : 0.88);
    this.inset.setAlpha(unavailable || unaffordable ? 0.42 : 0.72);
    this.thumbnail.setState(unavailable ? "unavailable" : unaffordable ? "unaffordable" : blocked ? "reserve-blocked" : this.selected ? "selected" : this.hovered ? "hovered" : "available");
    this.costText.setColor(colorToCss(unaffordable ? THEME_COLORS.invalid : blocked ? THEME_COLORS.warning : THEME_COLORS.primaryText));
    this.stateText.setText(this.selected ? "SELECTED" : blocked ? "! RESERVE" : unavailable ? "LOCKED" : unaffordable ? "SHORT" : "");
  }
}

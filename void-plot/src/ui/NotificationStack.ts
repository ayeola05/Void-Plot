import type { GameObjects, Scene } from "phaser";
import { RESERVED_UI_WIDTH, RENDER_DEPTHS, THEME_COLORS, THEME_TYPOGRAPHY, colorToCss } from "../rendering";
import { getAccessibilitySettings } from "../game/accessibility";

export type NotificationPriority = "critical" | "important" | "routine";
interface Slot { readonly background: GameObjects.Rectangle; readonly text: GameObjects.Text; expiresAt: number; active: boolean; }

export class NotificationStack {
  private readonly slots: readonly Slot[];
  public constructor(private readonly scene: Scene, capacity = 5) {
    this.slots = Array.from({ length: capacity }, () => ({ background: scene.add.rectangle(0, 0, 280, 30, THEME_COLORS.panelRaised, 0.96).setOrigin(1, 0).setStrokeStyle(1, THEME_COLORS.panelBorder).setDepth(RENDER_DEPTHS.ui + 200).setScrollFactor(0).setVisible(false), text: scene.add.text(0, 0, "", { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: THEME_TYPOGRAPHY.bodySize }).setOrigin(1, 0).setDepth(RENDER_DEPTHS.ui + 201).setScrollFactor(0).setVisible(false), expiresAt: 0, active: false }));
    scene.cameras.main.ignore(this.slots.flatMap((slot) => [slot.background, slot.text]));
  }
  public push(message: string, now: number, priority: NotificationPriority = "routine"): void {
    const duration = priority === "critical" ? 5_200 : priority === "important" ? 4_200 : 3_200;
    const slot = this.slots.find((candidate) => !candidate.active) ?? this.slots.reduce((oldest, candidate) => candidate.expiresAt < oldest.expiresAt ? candidate : oldest);
    const border = priority === "critical" ? THEME_COLORS.warning : priority === "important" ? THEME_COLORS.accent : THEME_COLORS.panelBorder;
    slot.active = true; slot.expiresAt = now + duration; slot.text.setText(message).setAlpha(1).setVisible(true); slot.background.setStrokeStyle(priority === "critical" ? 2 : 1, border, 0.95).setAlpha(0.96).setVisible(true); this.layout();
    if (!getAccessibilitySettings(this.scene.registry).reducedMotion) {
      this.scene.tweens.killTweensOf([slot.background, slot.text]);
      const backgroundX = slot.background.x;
      const textX = slot.text.x;
      slot.background.setX(backgroundX + 22).setAlpha(0);
      slot.text.setX(textX + 22).setAlpha(0);
      this.scene.tweens.add({ targets: slot.background, x: backgroundX, alpha: 0.96, duration: 220, ease: "Quad.Out" });
      this.scene.tweens.add({ targets: slot.text, x: textX, alpha: 1, duration: 220, ease: "Quad.Out" });
    }
  }
  public update(now: number): void {
    let changed = false;
    for (const slot of this.slots) { if (slot.active && now >= slot.expiresAt) { slot.active = false; slot.text.setVisible(false); slot.background.setVisible(false); changed = true; } else if (slot.active && slot.expiresAt - now < 500) { const alpha = Math.max(0, (slot.expiresAt - now) / 500); slot.text.setAlpha(alpha); slot.background.setAlpha(alpha); } }
    if (changed) this.layout();
  }
  private layout(): void {
    const uiScale = getAccessibilitySettings(this.scene.registry).uiScale;
    const uiWidth = this.scene.scale.width / uiScale;
    let visibleIndex = 0;
    for (const slot of this.slots) {
      if (!slot.active) continue;
      const x = Math.min(uiWidth - 14, RESERVED_UI_WIDTH + 294);
      const y = 14 + visibleIndex * 36;
      slot.background.setPosition(x, y);
      slot.text.setPosition(x - 10, y + 8);
      visibleIndex += 1;
    }
  }
}

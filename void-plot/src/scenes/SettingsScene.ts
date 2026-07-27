import { Input, Scene } from "phaser";
import {
  getAccessibilitySettings,
  updateAccessibilitySettings,
  type AccessibilitySettings,
} from "../game/accessibility";
import { THEME_COLORS, THEME_TYPOGRAPHY, colorToCss } from "../rendering";
import { ThemedButton } from "../ui";

export class SettingsScene extends Scene {
  private readonly buttons: ThemedButton[] = [];

  public constructor() { super("Settings"); }

  public create(): void {
    this.buttons.length = 0;
    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.82).setOrigin(0).setInteractive();
    const panelWidth = Math.min(460, this.scale.width - 32);
    const panelHeight = Math.min(390, this.scale.height - 24);
    const panelX = (this.scale.width - panelWidth) / 2;
    const panelY = Math.max(18, (this.scale.height - panelHeight) / 2);
    this.add.rectangle(panelX, panelY, panelWidth, panelHeight, THEME_COLORS.panelBackground, 0.99).setOrigin(0).setStrokeStyle(2, THEME_COLORS.accentMuted);
    this.add.text(this.scale.width / 2, panelY + 28, "ACCESSIBILITY & DISPLAY", { color: colorToCss(THEME_COLORS.accent), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "20px", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(this.scale.width / 2, panelY + 55, "Changes apply immediately or when returning to play.", { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "11px", align: "center", wordWrap: { width: panelWidth - 32 } }).setOrigin(0.5);

    const rows: readonly { label(settings: AccessibilitySettings): string; change(settings: AccessibilitySettings): Partial<AccessibilitySettings>; tooltip: string }[] = [
      { label: (s) => `UI Scale: ${Math.round(s.uiScale * 100)}%`, change: (s) => ({ uiScale: s.uiScale === 0.9 ? 1 : s.uiScale === 1 ? 1.15 : 0.9 }), tooltip: "Cycles between compact, default, and large interface sizing." },
      { label: (s) => `Screen Shake: ${s.screenShake ? "On" : "Off"}`, change: (s) => ({ screenShake: !s.screenShake }), tooltip: "Controls camera impact feedback. Gameplay is unchanged." },
      { label: (s) => `Particles: ${s.particles ? "On" : "Off"}`, change: (s) => ({ particles: !s.particles }), tooltip: "Controls ambient and building particles." },
      { label: (s) => `Colorblind Resource Colors: ${s.colorblindResourceColors ? "On" : "Off"}`, change: (s) => ({ colorblindResourceColors: !s.colorblindResourceColors }), tooltip: "Uses a high-separation blue, orange, cyan, and white resource palette." },
      { label: (s) => `Reduced Motion: ${s.reducedMotion ? "On" : "Off"}`, change: (s) => ({ reducedMotion: !s.reducedMotion }), tooltip: "Reduces camera easing, flashes, particles, and decorative movement." },
    ];

    const rowGap = Math.min(48, Math.max(40, (panelHeight - 142) / rows.length));
    rows.forEach((row, index) => {
      const button = new ThemedButton(this, "", () => {
        const current = getAccessibilitySettings(this.registry);
        updateAccessibilitySettings(this.registry, row.change(current));
        this.refresh(rows);
      }).setTooltip(row.tooltip).setLayout(panelX + 20, panelY + 76 + index * rowGap, panelWidth - 40, Math.min(36, rowGap - 4));
      this.buttons.push(button);
    });
    this.refresh(rows);
    new ThemedButton(this, "Back", () => this.close()).setTooltip("Return to the previous screen.").setLayout(panelX + 20, panelY + panelHeight - 44, panelWidth - 40, 34);
    const escapeKey = this.input.keyboard?.addKey(Input.Keyboard.KeyCodes.ESC);
    escapeKey?.once("down", this.close, this);
    this.events.once("shutdown", () => escapeKey?.off("down", this.close, this));
    const handleResize = (): void => { this.scene.restart(); };
    this.scale.on("resize", handleResize);
    this.events.once("shutdown", () => this.scale.off("resize", handleResize));
    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  private refresh(rows: readonly { label(settings: AccessibilitySettings): string }[]): void {
    const settings = getAccessibilitySettings(this.registry);
    this.buttons.forEach((button, index) => button.setText(rows[index].label(settings)));
  }

  private close(): void {
    if (this.scene.isPaused("Game")) {
      this.scene.stop();
      return;
    }
    this.scene.start("MainMenu");
  }
}

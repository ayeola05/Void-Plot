import { Input, Scene } from "phaser";
import { THEME_COLORS, THEME_TYPOGRAPHY, colorToCss } from "../rendering";
import { ThemedButton } from "../ui";
import { getAccessibilitySettings } from "../game/accessibility";
import { getSoundEventBus } from "../game/soundEvents";

export class PauseScene extends Scene {
  public constructor() { super("Pause"); }
  public create(): void {
    const settings = getAccessibilitySettings(this.registry);
    const dimmer = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0.72).setOrigin(0).setInteractive();
    const compact = this.scale.height < 520;
    const titleY = compact ? 42 : this.scale.height / 2 - 130;
    const title = this.add.text(this.scale.width / 2, titleY, "PAUSED", { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "28px", fontStyle: "bold" }).setOrigin(0.5);
    const resume = () => { getSoundEventBus(this.registry).emit("gameResumed"); this.scene.resume("Game"); this.scene.stop(); };
    const buttons = [
      new ThemedButton(this, "Resume", resume),
      new ThemedButton(this, "Restart Run", () => { this.scene.stop("Game"); this.scene.start("Game"); }),
      new ThemedButton(this, "Main Menu", () => { this.scene.stop("Game"); this.scene.start("MainMenu"); }),
      new ThemedButton(this, "Settings", () => this.scene.launch("Settings")),
    ];
    const buttonWidth = Math.min(280, this.scale.width - 32);
    const buttonTop = compact ? 78 : this.scale.height / 2 - 70;
    buttons.forEach((button, index) => button.setLayout(this.scale.width / 2 - buttonWidth / 2, buttonTop + index * 43, buttonWidth, 36));
    if (!settings.reducedMotion) {
      dimmer.setAlpha(0);
      title.setAlpha(0).setY(title.y - 8);
      this.tweens.add({ targets: dimmer, alpha: 1, duration: 180 });
      this.tweens.add({ targets: title, alpha: 1, y: title.y + 8, duration: 260, ease: "Quad.Out" });
    }
    const escapeKey = this.input.keyboard?.addKey(Input.Keyboard.KeyCodes.ESC);
    escapeKey?.once("down", resume);
    const handleResize = (): void => { this.scene.restart(); };
    this.scale.on("resize", handleResize);
    this.events.once("shutdown", () => {
      escapeKey?.off("down", resume);
      this.scale.off("resize", handleResize);
    });
  }
}

import { Scene } from "phaser";
import { BeaconVisual, THEME_COLORS, THEME_TYPOGRAPHY, WorldAtmosphere, colorToCss } from "../rendering";
import { ThemedButton } from "../ui";
import { GAME_VERSION } from "../game/settlementRating";
import { getAccessibilitySettings } from "../game/accessibility";
import { getSoundEventBus } from "../game/soundEvents";

export class MainMenuScene extends Scene {
  private beacon!: BeaconVisual;
  private atmosphere!: WorldAtmosphere;
  private reducedMotion = false;
  public constructor() { super("MainMenu"); }
  public create(): void {
    getSoundEventBus(this.registry).emit("menuOpened");
    this.cameras.main.setBackgroundColor(THEME_COLORS.canvasBackground);
    const settings = getAccessibilitySettings(this.registry);
    this.reducedMotion = settings.reducedMotion;
    this.atmosphere = new WorldAtmosphere(this, { x: 0, y: 0, width: this.scale.width, height: this.scale.height, tileSize: 20 });
    this.atmosphere.configure(settings.particles, settings.reducedMotion);
    this.atmosphere.setPhase("final-transmission");
    const compact = this.scale.height < 600;
    const titleY = compact ? this.scale.height * 0.34 : this.scale.height * 0.5;
    this.beacon = new BeaconVisual(this, this.scale.width / 2, compact ? this.scale.height * 0.16 : this.scale.height * 0.3).setPhase("final-transmission");
    const title = this.add.text(this.scale.width / 2, titleY, "VOID-PLOT", { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: this.scale.width < 480 ? "30px" : "36px", fontStyle: "bold" }).setOrigin(0.5);
    const subtitle = this.add.text(this.scale.width / 2, titleY + (compact ? 34 : 43), "THE LAST ACRE", { color: colorToCss(THEME_COLORS.accent), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "14px", letterSpacing: this.scale.width < 420 ? 3 : 5 }).setOrigin(0.5);
    const labels = ["New Game", "Continue — Coming Soon", "Settings", "About / Credits", "Exit"];
    const buttons = labels.map((label, index) => new ThemedButton(this, label, () => {
      if (index === 0) this.scene.start("Game");
      if (index === 2) this.scene.start("Settings");
      if (index === 3) this.scene.start("About");
      if (index === 4) window.close();
    }).setEnabled(index !== 1));
    const buttonWidth = Math.min(280, this.scale.width - 32);
    const buttonHeight = compact ? 32 : 34;
    const buttonGap = compact ? 6 : 9;
    const buttonStackHeight = buttons.length * buttonHeight + (buttons.length - 1) * buttonGap;
    const preferredTop = compact ? titleY + 56 : this.scale.height * 0.64;
    const buttonTop = Math.min(preferredTop, this.scale.height - buttonStackHeight - 28);
    buttons.forEach((button, index) => button.setLayout(this.scale.width / 2 - buttonWidth / 2, buttonTop + index * (buttonHeight + buttonGap), buttonWidth, buttonHeight));
    this.add.text(14, this.scale.height - 24, `Void-Plot ${GAME_VERSION}`, { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "10px" });
    if (this.scale.width >= 560) this.add.text(this.scale.width - 14, this.scale.height - 24, "Designed in the quiet between stars", { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "10px" }).setOrigin(1, 0);
    if (!settings.reducedMotion) {
      title.setAlpha(0).setY(title.y + 10);
      subtitle.setAlpha(0);
      this.tweens.add({ targets: title, alpha: 1, y: title.y - 10, duration: 650, ease: "Quad.Out" });
      this.tweens.add({ targets: subtitle, alpha: 1, duration: 700, delay: 280 });
      buttons.forEach((button, index) => { button.container.setAlpha(0); this.tweens.add({ targets: button.container, alpha: 1, duration: 360, delay: 420 + index * 90 }); });
    }
    const handleResize = (): void => {
      this.scene.restart();
    };
    this.scale.on("resize", handleResize);
    this.events.once("shutdown", () => {
      this.scale.off("resize", handleResize);
      this.atmosphere.destroy();
    });
  }
  public update(time: number): void {
    this.beacon.update(this.reducedMotion ? 0 : time);
    this.atmosphere.update(time);
  }
}

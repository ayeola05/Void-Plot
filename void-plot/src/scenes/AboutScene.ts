import { Scene } from "phaser";
import { GAME_VERSION } from "../game/settlementRating";
import { THEME_COLORS, THEME_TYPOGRAPHY, colorToCss } from "../rendering";
import { ThemedButton } from "../ui";

export class AboutScene extends Scene {
  public constructor() { super("About"); }

  public create(): void {
    this.cameras.main.setBackgroundColor(THEME_COLORS.canvasBackground);
    const width = Math.min(660, this.scale.width - 32);
    const x = (this.scale.width - width) / 2;
    this.add.rectangle(x, 24, width, Math.max(1, this.scale.height - 48), THEME_COLORS.panelBackground, 0.98).setOrigin(0).setStrokeStyle(1, THEME_COLORS.panelBorder);
    this.add.text(this.scale.width / 2, 54, "VOID-PLOT: THE LAST ACRE", { color: colorToCss(THEME_COLORS.accent), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "23px", fontStyle: "bold" }).setOrigin(0.5);
    const copy = [
      `Version ${GAME_VERSION}`,
      "",
      "Humanity's last colony must survive a finite 32×32 plot, explore by expedition, and activate the Genesis Beacon.",
      "",
      "CONTROLS",
      "Mouse: select tiles, place buildings, choose sectors, and use panels",
      "WASD / Arrow Keys: move camera   •   Mouse Wheel: zoom",
      "2 / 4 / 6: expedition sector size   •   Esc: pause or cancel placement",
      "",
      "TECHNOLOGY",
      "Built with Phaser, TypeScript, and Vite.",
      "",
      "CREDITS",
      "Design, code, and presentation: Void-Plot development team",
      "Framework template and runtime: Phaser Studio",
      "",
      "JAM SUBMISSION",
      "Release-candidate build prepared as a compact strategy-game submission. No external assets or audio are required.",
    ].join("\n");
    this.add.text(x + 32, 92, copy, { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "13px", lineSpacing: 5, wordWrap: { width: width - 64 } });
    new ThemedButton(this, "Return to Main Menu", () => this.scene.start("MainMenu")).setTooltip("Return to the title screen.").setLayout(this.scale.width / 2 - 120, this.scale.height - 70, 240, 36);
    this.cameras.main.fadeIn(180, 0, 0, 0);
  }
}

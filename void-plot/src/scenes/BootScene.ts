import { Scene } from "phaser";
import {
  THEME_COLORS,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "../rendering";

export class BootScene extends Scene {
  public constructor() { super("Boot"); }
  public create(): void {
    this.cameras.main.setBackgroundColor(THEME_COLORS.canvasBackground);
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, "LOADING", {
        color: colorToCss(THEME_COLORS.secondaryText),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: "14px",
        letterSpacing: 3,
      })
      .setOrigin(0.5);
    this.cameras.main.fadeIn(260, 7, 10, 12);
    this.time.delayedCall(180, () => this.scene.start("MainMenu"));
  }
}

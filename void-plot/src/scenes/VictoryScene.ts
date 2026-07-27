import { Scene } from "phaser";
import type { RunStatistics } from "../game/runStatistics";
import { formatRunStatistics } from "../game/runStatistics";
import { THEME_COLORS, THEME_TYPOGRAPHY, colorToCss } from "../rendering";
import { ThemedButton } from "../ui";
import { getAccessibilitySettings } from "../game/accessibility";

export interface VictorySceneData { readonly statistics: RunStatistics; readonly population: number; readonly food: number; readonly materials: number; readonly researchCompleted: number; readonly buildingsConstructed: number; readonly expeditionsCompleted: number; readonly eventsSurvived: number; }

export class VictoryScene extends Scene {
  public constructor() { super("Victory"); }
  public create(data: VictorySceneData): void {
    const accessibility = getAccessibilitySettings(this.registry);
    const compact = this.scale.height < 560;
    const dim = this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x000000, 0).setOrigin(0);
    this.tweens.add({ targets: dim, fillAlpha: 0.74, duration: accessibility.reducedMotion ? 120 : 1_200, ease: "Sine.InOut" });
    const title = this.add.text(this.scale.width / 2, compact ? 28 : 78, "BEACON ACTIVATED", { color: colorToCss(THEME_COLORS.beaconCore), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: compact ? "24px" : "32px", fontStyle: "bold" }).setOrigin(0.5).setAlpha(0);
    const snapshot = [`Population  ${data.population}`, `Food  ${data.food}`, `Materials  ${data.materials}`, `Research Completed  ${data.researchCompleted}`, `Buildings Constructed  ${data.buildingsConstructed}`, `Expeditions Completed  ${data.expeditionsCompleted}`, `Events Survived  ${data.eventsSurvived}`];
    const text = this.add.text(this.scale.width / 2, compact ? 61 : 145, [...snapshot, "", ...formatRunStatistics(data.statistics)].join("\n"), { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: compact ? "9px" : "13px", align: "center", lineSpacing: compact ? 0 : 4 }).setOrigin(0.5, 0).setAlpha(0);
    this.tweens.add({ targets: [title, text], alpha: 1, y: accessibility.reducedMotion ? "+=0" : "+=8", duration: accessibility.reducedMotion ? 120 : 850, delay: accessibility.reducedMotion ? 0 : 700, ease: "Quad.Out" });
    if (accessibility.screenShake && !accessibility.reducedMotion) this.cameras.main.shake(900, 0.0045, true);
    const stacked = this.scale.width < 380;
    const buttonWidth = stacked ? Math.min(220, this.scale.width - 32) : 160;
    const continueButton = new ThemedButton(this, "Continue", () => { this.scene.stop("Game"); this.scene.start("Results", data); }).setLayout(stacked ? this.scale.width / 2 - buttonWidth / 2 : this.scale.width / 2 - 170, stacked ? this.scale.height - 94 : this.scale.height - 52, buttonWidth, 36).setVisible(false);
    const menuButton = new ThemedButton(this, "Return to Menu", () => { this.scene.stop("Game"); this.scene.start("MainMenu"); }).setLayout(stacked ? this.scale.width / 2 - buttonWidth / 2 : this.scale.width / 2 + 10, this.scale.height - 52, buttonWidth, 36).setVisible(false);
    this.time.delayedCall(accessibility.reducedMotion ? 100 : 1_450, () => { continueButton.setVisible(true); menuButton.setVisible(true); });
    const handleResize = (): void => { this.scene.restart(data); };
    this.scale.on("resize", handleResize);
    this.events.once("shutdown", () => this.scale.off("resize", handleResize));
  }
}

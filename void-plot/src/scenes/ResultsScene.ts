import { Scene } from "phaser";
import { formatRunStatistics } from "../game/runStatistics";
import type { VictorySceneData } from "./VictoryScene";
import { THEME_COLORS, THEME_TYPOGRAPHY, colorToCss } from "../rendering";
import { ThemedButton } from "../ui";
import { calculateSettlementRating, createSettlementNarrative } from "../game/settlementRating";

export class ResultsScene extends Scene {
  public constructor() { super("Results"); }
  public create(data: VictorySceneData): void {
    const rating = calculateSettlementRating(data.statistics);
    const narrative = createSettlementNarrative(data.statistics);
    this.add.text(this.scale.width / 2, 70, "RUN RESULTS", { color: colorToCss(THEME_COLORS.accent), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "30px", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(this.scale.width / 2, 118, `SETTLEMENT RATING: ${rating.toUpperCase()}`, { color: colorToCss(THEME_COLORS.beaconCore), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "17px", fontStyle: "bold" }).setOrigin(0.5);
    this.add.text(this.scale.width / 2, 150, narrative, { color: colorToCss(THEME_COLORS.secondaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "13px", align: "center", fontStyle: "italic", wordWrap: { width: Math.min(600, this.scale.width - 40) } }).setOrigin(0.5, 0);
    this.add.text(this.scale.width / 2, 205, formatRunStatistics(data.statistics).join("\n"), { color: colorToCss(THEME_COLORS.primaryText), fontFamily: THEME_TYPOGRAPHY.fontFamily, fontSize: "14px", align: "center", lineSpacing: 6 }).setOrigin(0.5, 0);
    new ThemedButton(this, "Return to Menu", () => this.scene.start("MainMenu")).setLayout(this.scale.width / 2 - 110, this.scale.height - 80, 220, 38);
  }
}

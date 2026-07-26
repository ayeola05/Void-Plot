import { Scene } from "phaser";
import { ThemedButton } from "../ui";

export class GameOverScene extends Scene {
  public constructor() { super("GameOver"); }
  public create(): void {
    this.add.text(this.scale.width / 2, this.scale.height / 2 - 45, "GAME OVER\nPlaceholder", { align: "center", color: "#e5ebe7" }).setOrigin(0.5);
    new ThemedButton(this, "Return to Menu", () => this.scene.start("MainMenu")).setLayout(this.scale.width / 2 - 100, this.scale.height / 2 + 30, 200, 36);
  }
}

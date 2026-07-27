import { Game as MainGame } from "../scenes/GameScene";
import { BootScene } from "../scenes/BootScene";
import { MainMenuScene } from "../scenes/MainMenuScene";
import { PauseScene } from "../scenes/PauseScene";
import { VictoryScene } from "../scenes/VictoryScene";
import { ResultsScene } from "../scenes/ResultsScene";
import { GameOverScene } from "../scenes/EndScene";
import { SettingsScene } from "../scenes/SettingsScene";
import { AboutScene } from "../scenes/AboutScene";
import { AUTO, Game, Scale, Types } from "phaser";
import { THEME_COLORS, colorToCss } from "../rendering/VisualTheme";

const canvasBackground = colorToCss(THEME_COLORS.canvasBackground);

document.documentElement.style.setProperty(
  "--canvas-background",
  canvasBackground,
);

// Find out more information about the Game Config at:
// https://docs.phaser.io/api-documentation/typedef/types-core#gameconfig
const config: Types.Core.GameConfig = {
  type: AUTO,
  width: 1024,
  height: 768,
  parent: "game-container",
  backgroundColor: canvasBackground,
  scale: {
    mode: Scale.RESIZE,
    autoCenter: Scale.CENTER_BOTH,
  },
  input: {
    activePointers: 2,
  },
  scene: [BootScene, MainMenuScene, AboutScene, MainGame, PauseScene, SettingsScene, VictoryScene, ResultsScene, GameOverScene],
};

const StartGame = (parent: string) => {
  return new Game({ ...config, parent });
};

export default StartGame;

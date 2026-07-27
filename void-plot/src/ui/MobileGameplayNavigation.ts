import type { GameObjects, Scene } from "phaser";

import {
  RENDER_DEPTHS,
  THEME_COLORS,
  type ScreenRectangle,
} from "../rendering";
import { ThemedButton } from "./ThemedButton";

export type MobileGameplayPanel = "resources" | "build" | "tile" | "expedition";

export interface MobileGameplayNavigationSource {
  selectPanel(panel: MobileGameplayPanel): void;
  zoomIn(): void;
  zoomOut(): void;
}

const PANEL_TABS = Object.freeze([
  ["resources", "Colony"],
  ["build", "Build"],
  ["tile", "Tile"],
  ["expedition", "Explore"],
] as const);

export class MobileGameplayNavigation {
  private readonly background: GameObjects.Rectangle;
  private readonly container: GameObjects.Container;
  private readonly panelButtons: Readonly<Record<MobileGameplayPanel, ThemedButton>>;
  private readonly zoomOutButton: ThemedButton;
  private readonly zoomInButton: ThemedButton;
  private activePanel: MobileGameplayPanel = "resources";

  public constructor(scene: Scene, private readonly source: MobileGameplayNavigationSource) {
    this.background = scene.add
      .rectangle(0, 0, 1, 1, THEME_COLORS.sidebarBackground, 0.99)
      .setOrigin(0)
      .setStrokeStyle(1, THEME_COLORS.panelBorder, 0.9);
    const entries = PANEL_TABS.map(([panel, label]) => [
      panel,
      new ThemedButton(scene, label, () => this.setActivePanel(panel))
        .setStopsPointerPropagation()
        .setTooltip(`Show the ${label.toLowerCase()} panel.`),
    ] as const);
    this.panelButtons = Object.freeze(
      Object.fromEntries(entries) as Record<MobileGameplayPanel, ThemedButton>,
    );
    this.zoomOutButton = new ThemedButton(scene, "−", () => source.zoomOut())
      .setStopsPointerPropagation()
      .setTooltip("Zoom the world out.");
    this.zoomInButton = new ThemedButton(scene, "+", () => source.zoomIn())
      .setStopsPointerPropagation()
      .setTooltip("Zoom the world in.");
    this.container = scene.add
      .container(0, 0, [
        this.background,
        ...PANEL_TABS.map(([panel]) => this.panelButtons[panel].container),
        this.zoomOutButton.container,
        this.zoomInButton.container,
      ])
      .setDepth(RENDER_DEPTHS.ui + 40)
      .setScrollFactor(0)
      .setVisible(false);
    scene.cameras.main.ignore(this.container);
    this.applySelection();
  }

  public setLayout(layout: ScreenRectangle, visible: boolean): void {
    this.container.setVisible(visible);
    if (!visible) return;

    this.container.setPosition(layout.x, layout.y);
    this.background.setSize(layout.width, layout.height);
    const gap = 4;
    const padding = 4;
    const zoomWidth = Math.min(42, Math.max(34, layout.width * 0.1));
    const tabAreaWidth = Math.max(1, layout.width - padding * 2 - zoomWidth * 2 - gap * 5);
    const tabWidth = tabAreaWidth / PANEL_TABS.length;
    const buttonHeight = Math.max(1, layout.height - padding * 2);
    PANEL_TABS.forEach(([panel], index) => {
      this.panelButtons[panel].setLayout(
        padding + index * (tabWidth + gap),
        padding,
        tabWidth,
        buttonHeight,
      );
    });
    const zoomStart = padding + tabAreaWidth + gap * PANEL_TABS.length;
    this.zoomOutButton.setLayout(zoomStart, padding, zoomWidth, buttonHeight);
    this.zoomInButton.setLayout(zoomStart + zoomWidth + gap, padding, zoomWidth, buttonHeight);
  }

  public setActivePanel(panel: MobileGameplayPanel): void {
    if (this.activePanel === panel) return;
    this.activePanel = panel;
    this.applySelection();
    this.source.selectPanel(panel);
  }

  public getActivePanel(): MobileGameplayPanel {
    return this.activePanel;
  }

  private applySelection(): void {
    PANEL_TABS.forEach(([panel]) => {
      this.panelButtons[panel].setSelected(panel === this.activePanel);
    });
  }
}

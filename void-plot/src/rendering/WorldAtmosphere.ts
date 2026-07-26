import type { GameObjects, Scene } from "phaser";
import type { BeaconPhase } from "../data";
import type { WorldRenderBounds } from "./WorldRenderer";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";

interface DriftingObject {
  readonly view: GameObjects.Arc | GameObjects.Ellipse;
  readonly baseX: number;
  readonly speed: number;
  readonly range: number;
}

export class WorldAtmosphere {
  private readonly stars: readonly GameObjects.Arc[];
  private readonly clouds: readonly DriftingObject[];
  private readonly fog: readonly DriftingObject[];
  private readonly vignette: readonly GameObjects.Rectangle[];
  private enabled = true;
  private reducedMotion = false;

  public constructor(scene: Scene, private readonly bounds: WorldRenderBounds) {
    this.stars = Array.from({ length: 32 }, (_unused, index) => {
      const x = bounds.x + ((index * 97) % Math.max(1, bounds.width));
      const y = bounds.y + ((index * 53) % Math.max(1, bounds.height));
      return scene.add.circle(x, y, index % 5 === 0 ? 1.2 : 0.65, THEME_COLORS.primaryText, 0.13).setDepth(RENDER_DEPTHS.worldFrame - 2);
    });
    this.clouds = Array.from({ length: 5 }, (_unused, index) => {
      const baseX = bounds.x - 90 + index * (bounds.width / 4);
      const view = scene.add.ellipse(baseX, bounds.y + 75 + index * 112, 130 + index * 9, 34, 0x71817d, 0.025).setDepth(RENDER_DEPTHS.terrainDetail + 1);
      return { view, baseX, speed: 0.004 + index * 0.0008, range: bounds.width + 220 };
    });
    this.fog = Array.from({ length: 3 }, (_unused, index) => {
      const baseX = bounds.x - 120 + index * 250;
      const view = scene.add.ellipse(baseX, bounds.y + bounds.height * (0.25 + index * 0.26), 260, 95, 0xa7b5ae, 0.022).setDepth(RENDER_DEPTHS.sectorSelection - 1);
      return { view, baseX, speed: 0.002 + index * 0.0005, range: bounds.width + 300 };
    });
    const thickness = 32;
    this.vignette = [
      scene.add.rectangle(bounds.x, bounds.y, bounds.width, thickness, 0x000000, 0.17).setOrigin(0),
      scene.add.rectangle(bounds.x, bounds.y + bounds.height - thickness, bounds.width, thickness, 0x000000, 0.17).setOrigin(0),
      scene.add.rectangle(bounds.x, bounds.y, thickness, bounds.height, 0x000000, 0.17).setOrigin(0),
      scene.add.rectangle(bounds.x + bounds.width - thickness, bounds.y, thickness, bounds.height, 0x000000, 0.17).setOrigin(0),
    ].map((view) => view.setDepth(RENDER_DEPTHS.productionPopup + 2));
  }

  public configure(particles: boolean, reducedMotion: boolean): void {
    this.enabled = particles;
    this.reducedMotion = reducedMotion;
    this.fog.forEach(({ view }) => view.setVisible(particles));
    this.clouds.forEach(({ view }) => view.setVisible(particles));
    this.stars.forEach((view) => view.setVisible(particles));
  }

  public setPhase(phase: BeaconPhase): void {
    const index = ["dormant", "awakening", "signal", "overload", "final-transmission"].indexOf(phase);
    const color = [0x71817d, 0x78847c, 0x817f72, 0x8c7864, 0x9a704f][Math.max(0, index)];
    this.clouds.forEach(({ view }) => view.setFillStyle(color, 0.025 + index * 0.006));
    this.fog.forEach(({ view }) => view.setFillStyle(color, 0.018 + index * 0.005));
  }

  public update(time: number): void {
    if (!this.enabled || this.reducedMotion) return;
    for (let index = 0; index < this.stars.length; index += 1) {
      this.stars[index].setAlpha(0.08 + ((Math.sin(time / 900 + index) + 1) / 2) * 0.12);
    }
    this.move(this.clouds, time);
    this.move(this.fog, time);
  }

  public flash(scene: Scene, color: number = THEME_COLORS.beaconGlow, duration = 180): void {
    if (this.reducedMotion) return;
    const flash = scene.add.rectangle(this.bounds.x, this.bounds.y, this.bounds.width, this.bounds.height, color, 0.12).setOrigin(0).setDepth(RENDER_DEPTHS.productionPopup + 3);
    scene.tweens.add({ targets: flash, alpha: 0, duration, ease: "Quad.Out", onComplete: () => flash.destroy() });
  }

  public destroy(): void {
    this.stars.forEach((view) => view.destroy());
    this.clouds.forEach(({ view }) => view.destroy());
    this.fog.forEach(({ view }) => view.destroy());
    this.vignette.forEach((view) => view.destroy());
  }

  private move(objects: readonly DriftingObject[], time: number): void {
    for (const object of objects) {
      const offset = (time * object.speed) % object.range;
      object.view.x = object.baseX + offset;
      object.view.setAlpha(object.view.alpha * 0.98 + (0.025 + Math.sin(time / 1_800) * 0.006) * 0.02);
    }
  }
}

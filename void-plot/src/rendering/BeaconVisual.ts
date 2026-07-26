import type { GameObjects, Scene } from "phaser";
import type { BeaconPhase } from "../data";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";

export interface BeaconVisualDescriptor {
  readonly brightness: number;
  readonly glowAlpha: number;
  readonly pulseSpeed: number;
  readonly scale: number;
}

export function getBeaconVisualDescriptor(phase: BeaconPhase): BeaconVisualDescriptor {
  const index = ["dormant", "awakening", "signal", "overload", "final-transmission"].indexOf(phase);
  return Object.freeze({ brightness: 0.35 + index * 0.15, glowAlpha: 0.1 + index * 0.13, pulseSpeed: 1 + index * 0.55, scale: 1 + index * 0.05 });
}

export class BeaconVisual {
  public readonly container: GameObjects.Container;
  private readonly glow: GameObjects.Arc;
  private readonly groundGlow: GameObjects.Arc;
  private readonly core: GameObjects.Arc;
  private readonly tower: GameObjects.Triangle;
  private readonly rings: readonly GameObjects.Arc[];
  private readonly energyLines: readonly GameObjects.Rectangle[];
  private descriptor = getBeaconVisualDescriptor("dormant");

  public constructor(private readonly scene: Scene, x: number, y: number) {
    this.groundGlow = scene.add.circle(0, 7, 56, THEME_COLORS.beaconGlow, 0.07);
    this.glow = scene.add.circle(0, 0, 46, THEME_COLORS.beaconGlow, 0.1);
    this.energyLines = [0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((rotation) => scene.add.rectangle(0, 0, 88, 1, THEME_COLORS.beaconGlow, 0.16).setRotation(rotation + Math.PI / 4));
    this.rings = [17, 30, 43].map((radius) => scene.add.circle(0, 0, radius, 0x000000, 0).setStrokeStyle(2, THEME_COLORS.beaconGlow, 0.35));
    this.tower = scene.add.triangle(0, -7, -17, 27, 17, 27, 0, -34, THEME_COLORS.beaconBody).setStrokeStyle(2, THEME_COLORS.beaconTrim, 1);
    this.core = scene.add.circle(0, -6, 8, THEME_COLORS.beaconCore);
    this.container = scene.add.container(x, y, [this.groundGlow, ...this.energyLines, this.glow, ...this.rings, this.tower, this.core]).setDepth(RENDER_DEPTHS.building + 4);
    this.setPhase("dormant");
  }

  public setPhase(phase: BeaconPhase): this {
    this.descriptor = getBeaconVisualDescriptor(phase);
    this.container.setScale(this.descriptor.scale);
    this.glow.setAlpha(this.descriptor.glowAlpha);
    this.groundGlow.setAlpha(this.descriptor.glowAlpha * 0.6).setScale(0.9 + this.descriptor.scale * 0.15);
    this.energyLines.forEach((line) => line.setAlpha(this.descriptor.glowAlpha * 0.75).setScale(this.descriptor.scale, 1));
    this.core.setAlpha(this.descriptor.brightness);
    return this;
  }

  public update(timeMilliseconds: number): this {
    const wave = (Math.sin((timeMilliseconds / 1_000) * this.descriptor.pulseSpeed * Math.PI * 2) + 1) / 2;
    this.glow.setAlpha(this.descriptor.glowAlpha * (0.7 + wave * 0.3));
    this.groundGlow.setAlpha(this.descriptor.glowAlpha * (0.38 + wave * 0.2)).setScale(1 + wave * 0.08);
    this.energyLines.forEach((line, index) => line.setAlpha(this.descriptor.glowAlpha * (0.42 + wave * 0.18)).setScale(0.85 + wave * 0.18 + index * 0.015, 1));
    this.rings.forEach((ring, index) => ring.setAlpha(this.descriptor.brightness * (0.25 + wave * 0.15)).setScale(1 + wave * 0.03 * (index + 1)));
    return this;
  }

  public pulseActivation(): void {
    this.scene.tweens.add({ targets: [this.glow, this.core], alpha: 1, scaleX: 1.65, scaleY: 1.65, duration: 420, yoyo: true, ease: "Quad.Out" });
  }

  public destroy(): void { this.container.destroy(true); }
}

export function validateBeaconVisualFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const phases: BeaconPhase[] = ["dormant", "awakening", "signal", "overload", "final-transmission"];
  const descriptors = phases.map(getBeaconVisualDescriptor);
  const valid = descriptors.every((descriptor, index) => index === 0 || descriptor.brightness > descriptors[index - 1].brightness && descriptor.glowAlpha > descriptors[index - 1].glowAlpha);
  return { valid, errors: valid ? Object.freeze([]) : Object.freeze(["Beacon intensity must increase each phase."]) };
}

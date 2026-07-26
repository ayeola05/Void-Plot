import type { GameObjects, Scene } from "phaser";
import type { BuildingType } from "../simulation";
import { FarmVisual } from "./FarmVisual";
import { ForestVisual } from "./ForestVisual";
import { HomesVisual } from "./HomesVisual";
import { LabVisual } from "./LabVisual";
import { PowerPlantVisual } from "./PowerPlantVisual";

export type BuildingThumbnailState =
  | "available"
  | "hovered"
  | "selected"
  | "unaffordable"
  | "reserve-blocked"
  | "unavailable";

interface ThumbnailVisual {
  readonly container: GameObjects.Container;
  update(time: number, reducedMotion: boolean): void;
  destroy(): void;
}

const THUMBNAIL_NATIVE_SIZE = 40;

export class BuildingThumbnail {
  public readonly container: GameObjects.Container;
  private readonly visual: ThumbnailVisual;

  public constructor(scene: Scene, type: BuildingType) {
    this.visual = createThumbnailVisual(scene, type);
    this.container = this.visual.container;
  }

  public setLayout(x: number, y: number, size: number): this {
    this.container.setPosition(x, y).setScale(size / THUMBNAIL_NATIVE_SIZE);
    return this;
  }

  public setState(state: BuildingThumbnailState): this {
    const disabled = state === "unaffordable" || state === "unavailable";
    this.container.setAlpha(disabled ? 0.34 : state === "reserve-blocked" ? 0.58 : state === "hovered" || state === "selected" ? 1 : 0.86);
    return this;
  }

  public update(time: number, reducedMotion: boolean): void {
    this.visual.update(time, reducedMotion);
  }

  public destroy(): void {
    this.visual.destroy();
  }
}

export function createBuildingThumbnail(scene: Scene, type: BuildingType): BuildingThumbnail {
  return new BuildingThumbnail(scene, type);
}

function createThumbnailVisual(scene: Scene, type: BuildingType): ThumbnailVisual {
  switch (type) {
    case "homes": {
      const visual = new HomesVisual(scene, THUMBNAIL_NATIVE_SIZE);
      return { container: visual.container, update: (time, reduced) => { visual.updateActivity(time, reduced); }, destroy: () => visual.destroy() };
    }
    case "farm": {
      const visual = new FarmVisual(scene, THUMBNAIL_NATIVE_SIZE).setStaffed(true).setPowered(true);
      return { container: visual.container, update: (time, reduced) => { visual.updateProductionIndicator(time, reduced); }, destroy: () => visual.destroy() };
    }
    case "forest": {
      const visual = new ForestVisual(scene, THUMBNAIL_NATIVE_SIZE).setStaffed(true).setPowered(true);
      return { container: visual.container, update: (time, reduced) => { visual.updateProductionIndicator(time, reduced); }, destroy: () => visual.destroy() };
    }
    case "powerPlant": {
      const visual = new PowerPlantVisual(scene, THUMBNAIL_NATIVE_SIZE).setStaffed(true);
      return { container: visual.container, update: (time, reduced) => { visual.updateActivity(time, reduced); }, destroy: () => visual.destroy() };
    }
    case "lab": {
      const visual = new LabVisual(scene, THUMBNAIL_NATIVE_SIZE).setStaffed(true).setPowered(true);
      return { container: visual.container, update: (time, reduced) => { visual.updateActivity(time, reduced); }, destroy: () => visual.destroy() };
    }
  }
}

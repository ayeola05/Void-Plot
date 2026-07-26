import type { GameObjects, Scene } from "phaser";

import type {
  BuildingState,
  FarmProductionEvent,
  ForestProductionEvent,
  LabResearchProductionEvent,
} from "../simulation";
import type { WorldRenderBounds } from "./WorldRenderer";
import {
  RENDER_DEPTHS,
  THEME_COLORS,
  THEME_TYPOGRAPHY,
  colorToCss,
} from "./VisualTheme";

const POPUP_DURATION_MILLISECONDS = 900;
const POPUP_RISE_PIXELS = 12;

interface PopupSlot {
  readonly text: GameObjects.Text;
  active: boolean;
  startTimeMilliseconds: number;
  startY: number;
}

export interface FoodProductionPopupDescriptor {
  readonly farmId: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

export interface MaterialsProductionPopupDescriptor {
  readonly forestId: string;
  readonly text: string;
  readonly x: number;
  readonly y: number;
}

type ResourceProductionPopupDescriptor =
  | FoodProductionPopupDescriptor
  | MaterialsProductionPopupDescriptor;

export function createFoodProductionPopupDescriptor(
  event: FarmProductionEvent,
  worldBounds: WorldRenderBounds,
): FoodProductionPopupDescriptor {
  return Object.freeze({
    farmId: event.farmId,
    text: `+${event.foodProduced} Food`,
    x:
      worldBounds.x +
      event.coordinate.x * worldBounds.tileSize +
      worldBounds.tileSize / 2,
    y: worldBounds.y + event.coordinate.y * worldBounds.tileSize - 1,
  });
}

export function createMaterialsProductionPopupDescriptor(
  event: ForestProductionEvent,
  worldBounds: WorldRenderBounds,
): MaterialsProductionPopupDescriptor {
  return Object.freeze({
    forestId: event.forestId,
    text: `+${event.materialsProduced} Materials`,
    x:
      worldBounds.x +
      event.coordinate.x * worldBounds.tileSize +
      worldBounds.tileSize / 2,
    y: worldBounds.y + event.coordinate.y * worldBounds.tileSize - 1,
  });
}

export class ResourceProductionPopupPool {
  private readonly slots: PopupSlot[] = [];

  public constructor(
    private readonly scene: Scene,
    private readonly worldBounds: WorldRenderBounds,
  ) {}

  public show(
    events: readonly FarmProductionEvent[],
    currentTimeMilliseconds: number,
  ): readonly GameObjects.GameObject[] {
    return this.showDescriptors(
      events.map((event) =>
        createFoodProductionPopupDescriptor(event, this.worldBounds),
      ),
      currentTimeMilliseconds,
      THEME_COLORS.validBright,
    );
  }

  public showMaterials(
    events: readonly ForestProductionEvent[],
    currentTimeMilliseconds: number,
  ): readonly GameObjects.GameObject[] {
    return this.showDescriptors(
      events.map((event) =>
        createMaterialsProductionPopupDescriptor(event, this.worldBounds),
      ),
      currentTimeMilliseconds,
      THEME_COLORS.accent,
    );
  }

  public showResearch(
    events: readonly LabResearchProductionEvent[],
    buildings: BuildingState,
    currentTimeMilliseconds: number,
  ): readonly GameObjects.GameObject[] {
    const createdObjects: GameObjects.GameObject[] = [];
    for (const event of events) {
      const lab = buildings.buildings.find((building) => building.id === event.labId && building.type === "lab");
      if (lab === undefined) continue;
      const acquired = this.acquireSlot();
      if (acquired.created) createdObjects.push(acquired.slot.text);
      acquired.slot.active = true;
      acquired.slot.startTimeMilliseconds = currentTimeMilliseconds;
      acquired.slot.startY = this.worldBounds.y + lab.coordinate.y * this.worldBounds.tileSize - 1;
      acquired.slot.text
        .setText(`+${event.researchPointsProduced} RP`)
        .setColor(colorToCss(THEME_COLORS.labActive))
        .setPosition(this.worldBounds.x + lab.coordinate.x * this.worldBounds.tileSize + this.worldBounds.tileSize / 2, acquired.slot.startY)
        .setAlpha(1)
        .setVisible(true);
    }
    return createdObjects;
  }

  private showDescriptors(
    descriptors: readonly ResourceProductionPopupDescriptor[],
    currentTimeMilliseconds: number,
    color: number,
  ): readonly GameObjects.GameObject[] {
    const createdObjects: GameObjects.GameObject[] = [];

    for (const descriptor of descriptors) {
      const acquired = this.acquireSlot();

      if (acquired.created) {
        createdObjects.push(acquired.slot.text);
      }

      acquired.slot.active = true;
      acquired.slot.startTimeMilliseconds = currentTimeMilliseconds;
      acquired.slot.startY = descriptor.y;
      acquired.slot.text
        .setText(descriptor.text)
        .setColor(colorToCss(color))
        .setPosition(descriptor.x, descriptor.y)
        .setAlpha(1)
        .setVisible(true);
    }

    return createdObjects;
  }

  public update(currentTimeMilliseconds: number): void {
    for (const slot of this.slots) {
      if (!slot.active) {
        continue;
      }

      const elapsed = Math.max(
        0,
        currentTimeMilliseconds - slot.startTimeMilliseconds,
      );
      const progress = Math.min(1, elapsed / POPUP_DURATION_MILLISECONDS);

      slot.text
        .setY(slot.startY - POPUP_RISE_PIXELS * progress)
        .setAlpha(1 - progress);

      if (progress >= 1) {
        slot.active = false;
        slot.text.setVisible(false);
      }
    }
  }

  public destroy(): void {
    for (const slot of this.slots) {
      slot.text.destroy();
    }
    this.slots.length = 0;
  }

  private acquireSlot(): { slot: PopupSlot; created: boolean } {
    const available = this.slots.find((slot) => !slot.active);

    if (available !== undefined) {
      return { slot: available, created: false };
    }

    const text = this.scene.add
      .text(0, 0, "", {
        color: colorToCss(THEME_COLORS.validBright),
        fontFamily: THEME_TYPOGRAPHY.fontFamily,
        fontSize: THEME_TYPOGRAPHY.statusSize,
        fontStyle: "bold",
        stroke: colorToCss(THEME_COLORS.canvasBackground),
        strokeThickness: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(RENDER_DEPTHS.productionPopup)
      .setVisible(false);
    const slot: PopupSlot = {
      text,
      active: false,
      startTimeMilliseconds: 0,
      startY: 0,
    };

    this.slots.push(slot);
    return { slot, created: true };
  }
}

export { ResourceProductionPopupPool as FoodProductionPopupPool };

export function validateFoodProductionPopupFoundation(): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const descriptor = createFoodProductionPopupDescriptor(
    {
      farmId: "farm-popup-validation",
      coordinate: { x: 3, y: 4 },
      foodProduced: 3,
      newFoodBalance: 8,
    },
    { x: 10, y: 20, width: 640, height: 640, tileSize: 20 },
  );

  if (
    descriptor.farmId !== "farm-popup-validation" ||
    descriptor.text !== "+3 Food" ||
    descriptor.x !== 80 ||
    descriptor.y !== 99
  ) {
    errors.push("Food popups must retain the producing Farm and world position.");
  }

  const materialsDescriptor = createMaterialsProductionPopupDescriptor(
    {
      forestId: "forest-popup-validation",
      coordinate: { x: 3, y: 4 },
      materialsProduced: 15,
      completedIntervals: 3,
      newMaterialsBalance: 20,
    },
    { x: 10, y: 20, width: 640, height: 640, tileSize: 20 },
  );

  if (
    materialsDescriptor.forestId !== "forest-popup-validation" ||
    materialsDescriptor.text !== "+15 Materials" ||
    materialsDescriptor.x !== 80 ||
    materialsDescriptor.y !== 99
  ) {
    errors.push("Materials popups must retain the producing Forest and world position.");
  }

  return { valid: errors.length === 0, errors };
}

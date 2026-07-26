import type { GameObjects, Scene } from "phaser";
import { countOccupiedTiles, createWorld, type WorldState } from "../world";
import type { WorldRenderBounds } from "./WorldRenderer";
import { RENDER_DEPTHS, THEME_COLORS } from "./VisualTheme";

export type TerrainDecorationKind = "stone" | "grass" | "crack" | "debris" | "foundation" | "none";
export interface TerrainDecorationDescriptor { readonly kind: TerrainDecorationKind; readonly offsetX: number; readonly offsetY: number; readonly rotation: number; }

export function shouldAnimateWorldDecorations(particles: boolean, reducedMotion: boolean): boolean {
  return particles && !reducedMotion;
}

export function getTerrainDecorationDescriptor(x: number, y: number, revealed: boolean): TerrainDecorationDescriptor {
  let hash = (Math.imul(x + 17, 73_856_093) ^ Math.imul(y + 31, 19_349_663)) >>> 0;
  // Bitwise operators return signed 32-bit values. Convert the mixed hash back
  // to unsigned before using it as an array index.
  hash = (hash ^ (hash >>> 13)) >>> 0;
  const kinds: readonly TerrainDecorationKind[] = revealed
    ? ["none", "stone", "none", "grass", "crack", "none", "debris", "foundation"]
    : ["none", "foundation", "none", "debris"];
  return Object.freeze({ kind: kinds[hash % kinds.length], offsetX: ((hash >>> 5) % 9) - 4, offsetY: ((hash >>> 9) % 9) - 4, rotation: ((hash >>> 13) % 8) * Math.PI / 4 });
}

interface MovingSilhouette { readonly view: GameObjects.Rectangle; readonly baseAlpha: number; readonly phase: number; }

export class WorldDecorationLayer {
  private readonly staticObjects: GameObjects.GameObject[] = [];
  private readonly silhouettes: MovingSilhouette[] = [];
  private reducedMotion = false;
  private particles = true;

  public constructor(private readonly scene: Scene, world: WorldState, private readonly bounds: WorldRenderBounds) {
    let hiddenBudget = 28;
    for (const tile of world.tiles) {
      const descriptor = getTerrainDecorationDescriptor(tile.x, tile.y, tile.revealState === "revealed");
      const x = bounds.x + tile.x * bounds.tileSize + bounds.tileSize / 2 + descriptor.offsetX;
      const y = bounds.y + tile.y * bounds.tileSize + bounds.tileSize / 2 + descriptor.offsetY;
      if (tile.revealState === "revealed") this.createRevealedDecoration(descriptor, x, y);
      else if (descriptor.kind !== "none" && hiddenBudget > 0 && ((tile.x * 17 + tile.y * 31) % 19 === 0)) {
        hiddenBudget -= 1;
        const view = scene.add.rectangle(x, y, descriptor.kind === "foundation" ? 11 : 5, descriptor.kind === "foundation" ? 7 : 3, THEME_COLORS.hiddenMark, 0.09).setRotation(descriptor.rotation).setDepth(RENDER_DEPTHS.terrainDetail + 1);
        this.staticObjects.push(view);
        this.silhouettes.push({ view, baseAlpha: 0.065 + (hiddenBudget % 3) * 0.012, phase: hiddenBudget * 0.7 });
      }
    }
    this.createBeaconGroundComposition();
  }

  public configure(particles: boolean, reducedMotion: boolean): void { this.particles = particles; this.reducedMotion = reducedMotion; }

  public update(time: number): void {
    if (!shouldAnimateWorldDecorations(this.particles, this.reducedMotion)) return;
    for (const silhouette of this.silhouettes) silhouette.view.setAlpha(silhouette.baseAlpha + Math.sin(time / 1_700 + silhouette.phase) * 0.018);
  }

  public destroy(): void { for (const object of this.staticObjects) object.destroy(); this.staticObjects.length = 0; this.silhouettes.length = 0; }

  private createRevealedDecoration(descriptor: TerrainDecorationDescriptor, x: number, y: number): void {
    if (descriptor.kind === "none") return;
    let object: GameObjects.Shape;
    switch (descriptor.kind) {
      case "stone": object = this.scene.add.circle(x, y, 1.4, 0x343c38, 0.72); break;
      case "grass": object = this.scene.add.rectangle(x, y, 1, 5, 0x68745b, 0.55).setRotation(descriptor.rotation); break;
      case "crack": object = this.scene.add.rectangle(x, y, 7, 1, 0x353d39, 0.48).setRotation(descriptor.rotation); break;
      case "debris": object = this.scene.add.rectangle(x, y, 4, 2, 0x4b514c, 0.58).setRotation(descriptor.rotation); break;
      case "foundation": object = this.scene.add.rectangle(x, y, 11, 8, 0x000000, 0).setStrokeStyle(1, 0x49534d, 0.32).setRotation(descriptor.rotation); break;
    }
    object.setDepth(RENDER_DEPTHS.terrainDetail + 1);
    this.staticObjects.push(object);
  }

  private createBeaconGroundComposition(): void {
    const centreX = this.bounds.x + this.bounds.width / 2;
    const centreY = this.bounds.y + this.bounds.height / 2;
    for (let index = 0; index < 4; index += 1) {
      const line = this.scene.add.rectangle(centreX, centreY, 74, 1, THEME_COLORS.beaconTrim, 0.18).setRotation(index * Math.PI / 2 + Math.PI / 4).setDepth(RENDER_DEPTHS.terrainDetail + 2);
      this.staticObjects.push(line);
    }
    const fragments = [[-58, -38], [55, -47], [-67, 49], [62, 56]] as const;
    for (const [offsetX, offsetY] of fragments) {
      this.staticObjects.push(this.scene.add.rectangle(centreX + offsetX, centreY + offsetY, 9, 4, 0x48514d, 0.4).setRotation((offsetX + offsetY) / 40).setDepth(RENDER_DEPTHS.terrainDetail + 2));
    }
  }
}

export function validateWorldDecorationFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const world = createWorld();
  const occupiedBefore = countOccupiedTiles(world);
  const first = getTerrainDecorationDescriptor(12, 12, true);
  const second = getTerrainDecorationDescriptor(12, 12, true);
  const hidden = getTerrainDecorationDescriptor(12, 12, false);
  const errors: string[] = [];
  if (JSON.stringify(first) !== JSON.stringify(second)) errors.push("Terrain decoration must be deterministic.");
  if (first.offsetX < -4 || first.offsetX > 4 || hidden.offsetY < -4 || hidden.offsetY > 4) errors.push("Decoration must remain inside its tile.");
  if (countOccupiedTiles(world) !== occupiedBefore) errors.push("Decoration descriptors must not mutate world occupancy.");
  if (shouldAnimateWorldDecorations(false, false) || shouldAnimateWorldDecorations(true, true) || !shouldAnimateWorldDecorations(true, false)) errors.push("Decoration movement must respect particle and reduced-motion settings.");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

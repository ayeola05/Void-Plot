import { Input, Math as PhaserMath } from "phaser";
import type { Cameras, GameObjects, Scene } from "phaser";

import type { WorldRenderBounds } from "./WorldRenderer";
import {
  screenPointIsInsideRectangle,
  type ScreenRectangle,
} from "./ResponsiveGameLayout";

export const WORLD_CAMERA_MIN_ZOOM = 0.75;
export const WORLD_CAMERA_MAX_ZOOM = 2;
export const WORLD_CAMERA_ZOOM_STEP = 0.25;
export const WORLD_CAMERA_MOVEMENT_SPEED = 320;
export const WORLD_CAMERA_START_ZOOM = 2;

export interface WorldCameraConfig {
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
  movementSpeed: number;
}

export function validateInitialCameraFraming(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  const initialRevealedAreaPixels = 8 * 20 * WORLD_CAMERA_START_ZOOM;
  if (WORLD_CAMERA_START_ZOOM < WORLD_CAMERA_MIN_ZOOM || WORLD_CAMERA_START_ZOOM > WORLD_CAMERA_MAX_ZOOM) errors.push("Initial zoom must remain within camera limits.");
  if (initialRevealedAreaPixels < 220 || initialRevealedAreaPixels > 340) errors.push("Initial framing must keep the 8×8 starting area readable without excessive empty grid.");
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

interface MovementKeys {
  up: readonly Input.Keyboard.Key[];
  down: readonly Input.Keyboard.Key[];
  left: readonly Input.Keyboard.Key[];
  right: readonly Input.Keyboard.Key[];
}

export class WorldCameraController {
  private readonly camera: Cameras.Scene2D.Camera;
  private readonly config: WorldCameraConfig;
  private readonly movementKeys?: MovementKeys;
  private viewport?: ScreenRectangle;
  private velocityX = 0;
  private velocityY = 0;
  private reducedMotion = false;
  private readonly zoomProxy = { zoom: 1 };

  public constructor(
    private readonly scene: Scene,
    private readonly worldBounds: WorldRenderBounds,
    config: Partial<WorldCameraConfig> = {},
  ) {
    this.camera = scene.cameras.main;
    this.config = {
      minZoom: config.minZoom ?? WORLD_CAMERA_MIN_ZOOM,
      maxZoom: config.maxZoom ?? WORLD_CAMERA_MAX_ZOOM,
      zoomStep: config.zoomStep ?? WORLD_CAMERA_ZOOM_STEP,
      movementSpeed: config.movementSpeed ?? WORLD_CAMERA_MOVEMENT_SPEED,
    };

    const keyboard = scene.input.keyboard;

    if (keyboard !== null) {
      this.movementKeys = {
        up: [
          keyboard.addKey(Input.Keyboard.KeyCodes.W),
          keyboard.addKey(Input.Keyboard.KeyCodes.UP),
        ],
        down: [
          keyboard.addKey(Input.Keyboard.KeyCodes.S),
          keyboard.addKey(Input.Keyboard.KeyCodes.DOWN),
        ],
        left: [
          keyboard.addKey(Input.Keyboard.KeyCodes.A),
          keyboard.addKey(Input.Keyboard.KeyCodes.LEFT),
        ],
        right: [
          keyboard.addKey(Input.Keyboard.KeyCodes.D),
          keyboard.addKey(Input.Keyboard.KeyCodes.RIGHT),
        ],
      };
    }

    this.camera.setZoom(
      PhaserMath.Clamp(WORLD_CAMERA_START_ZOOM, this.config.minZoom, this.config.maxZoom),
    );
    this.camera.centerOn(
      worldBounds.x + worldBounds.width / 2,
      worldBounds.y + worldBounds.height / 2,
    );
    this.clampToWorldBounds();

    scene.input.on("wheel", this.handleWheel, this);
    scene.events.once("shutdown", () => {
      scene.input.off("wheel", this.handleWheel, this);
      scene.tweens.killTweensOf(this.zoomProxy);
    });
  }

  public update(deltaMilliseconds: number): void {
    if (this.movementKeys === undefined) {
      return;
    }

    const horizontalDirection =
      Number(this.isAnyKeyDown(this.movementKeys.right)) -
      Number(this.isAnyKeyDown(this.movementKeys.left));
    const verticalDirection =
      Number(this.isAnyKeyDown(this.movementKeys.down)) -
      Number(this.isAnyKeyDown(this.movementKeys.up));

    const directionLength = Math.hypot(horizontalDirection, verticalDirection) || 1;
    const targetX = horizontalDirection / directionLength;
    const targetY = verticalDirection / directionLength;
    const smoothing = this.reducedMotion ? 1 : 1 - Math.exp(-deltaMilliseconds / 75);
    this.velocityX += (targetX - this.velocityX) * smoothing;
    this.velocityY += (targetY - this.velocityY) * smoothing;
    const distance = (this.config.movementSpeed * (deltaMilliseconds / 1000)) / this.camera.zoom;
    this.camera.scrollX += this.velocityX * distance;
    this.camera.scrollY += this.velocityY * distance;
    this.clampToWorldBounds();
  }

  public setReducedMotion(reduced: boolean): void { this.reducedMotion = reduced; }

  public setViewport(viewport: ScreenRectangle): void {
    const previousViewport = this.viewport ?? this.getViewport();
    const previousCentreX =
      this.camera.scrollX + previousViewport.width / (2 * this.camera.zoom);
    const previousCentreY =
      this.camera.scrollY + previousViewport.height / (2 * this.camera.zoom);

    this.camera.setViewport(
      viewport.x,
      viewport.y,
      viewport.width,
      viewport.height,
    );
    this.viewport = { ...viewport };
    this.camera.centerOn(previousCentreX, previousCentreY);
    this.clampToWorldBounds();
  }

  private handleWheel(
    pointer: Input.Pointer,
    _gameObjects: GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    const viewport = this.getViewport();

    if (
      deltaY === 0 ||
      !screenPointIsInsideRectangle(viewport, pointer.x, pointer.y)
    ) {
      return;
    }

    const localPointerX = pointer.x - viewport.x;
    const localPointerY = pointer.y - viewport.y;
    const focusedWorldX =
      this.camera.scrollX + localPointerX / this.camera.zoom;
    const focusedWorldY =
      this.camera.scrollY + localPointerY / this.camera.zoom;
    const zoomDirection = deltaY > 0 ? -1 : 1;
    const nextZoom = PhaserMath.Clamp(
      this.camera.zoom + zoomDirection * this.config.zoomStep,
      this.config.minZoom,
      this.config.maxZoom,
    );

    if (this.reducedMotion) {
      this.applyFocusedZoom(nextZoom, focusedWorldX, focusedWorldY, localPointerX, localPointerY);
      return;
    }
    this.scene.tweens.killTweensOf(this.zoomProxy);
    this.zoomProxy.zoom = this.camera.zoom;
    this.scene.tweens.add({
      targets: this.zoomProxy,
      zoom: nextZoom,
      duration: 170,
      ease: "Sine.Out",
      onUpdate: () => this.applyFocusedZoom(this.zoomProxy.zoom, focusedWorldX, focusedWorldY, localPointerX, localPointerY),
    });
  }

  private applyFocusedZoom(zoom: number, worldX: number, worldY: number, localX: number, localY: number): void {
    this.camera.setZoom(zoom).setScroll(worldX - localX / zoom, worldY - localY / zoom);
    this.clampToWorldBounds();
  }

  private isAnyKeyDown(keys: readonly Input.Keyboard.Key[]): boolean {
    return keys.some((key) => key.isDown);
  }

  private clampToWorldBounds(): void {
    const visibleWorldWidth = this.camera.width / this.camera.zoom;
    const visibleWorldHeight = this.camera.height / this.camera.zoom;
    const horizontalBoundsPadding = Math.max(
      0,
      (visibleWorldWidth - this.worldBounds.width) / 2,
    );
    const verticalBoundsPadding = Math.max(
      0,
      (visibleWorldHeight - this.worldBounds.height) / 2,
    );

    this.camera.setBounds(
      this.worldBounds.x - horizontalBoundsPadding,
      this.worldBounds.y - verticalBoundsPadding,
      this.worldBounds.width + horizontalBoundsPadding * 2,
      this.worldBounds.height + verticalBoundsPadding * 2,
    );

    const centredScrollX =
      this.worldBounds.x +
      (this.worldBounds.width - visibleWorldWidth) / 2;
    const centredScrollY =
      this.worldBounds.y +
      (this.worldBounds.height - visibleWorldHeight) / 2;
    const scrollX =
      visibleWorldWidth >= this.worldBounds.width
        ? centredScrollX
        : PhaserMath.Clamp(
            this.camera.scrollX,
            this.worldBounds.x,
            this.worldBounds.x + this.worldBounds.width - visibleWorldWidth,
          );
    const scrollY =
      visibleWorldHeight >= this.worldBounds.height
        ? centredScrollY
        : PhaserMath.Clamp(
            this.camera.scrollY,
            this.worldBounds.y,
            this.worldBounds.y + this.worldBounds.height - visibleWorldHeight,
          );

    this.camera.setScroll(scrollX, scrollY);
  }

  private getViewport(): ScreenRectangle {
    return this.viewport === undefined
      ? {
          x: this.camera.x,
          y: this.camera.y,
          width: this.camera.width,
          height: this.camera.height,
        }
      : { ...this.viewport };
  }
}

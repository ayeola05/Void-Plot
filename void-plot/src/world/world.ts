import type { Tile } from "./tile";

export const WORLD_WIDTH = 32;
export const WORLD_HEIGHT = 32;
export const WORLD_TILE_COUNT = WORLD_WIDTH * WORLD_HEIGHT;

export const INITIAL_REVEALED_SIZE = 8;
export const INITIAL_REVEALED_MIN_X =
  (WORLD_WIDTH - INITIAL_REVEALED_SIZE) / 2;
export const INITIAL_REVEALED_MAX_X =
  INITIAL_REVEALED_MIN_X + INITIAL_REVEALED_SIZE - 1;
export const INITIAL_REVEALED_MIN_Y =
  (WORLD_HEIGHT - INITIAL_REVEALED_SIZE) / 2;
export const INITIAL_REVEALED_MAX_Y =
  INITIAL_REVEALED_MIN_Y + INITIAL_REVEALED_SIZE - 1;

export interface WorldState {
  width: number;
  height: number;
  tiles: Tile[];
}

export interface WorldValidationResult {
  valid: boolean;
  errors: string[];
}

export interface TileCoordinate {
  x: number;
  y: number;
}

export type RevealTileResult =
  | {
      status: "newly-revealed";
      tile: Tile;
    }
  | {
      status: "already-revealed";
      tile: Tile;
    }
  | {
      status: "out-of-bounds";
      x: number;
      y: number;
    };

export interface RevealTilesResult {
  results: RevealTileResult[];
  newlyRevealedCount: number;
  alreadyRevealedCount: number;
  outOfBoundsCount: number;
}

export type OccupancyCheckResult =
  | {
      canOccupy: true;
      status: "available";
      tile: Tile;
    }
  | {
      canOccupy: false;
      status: "already-occupied" | "hidden";
      tile: Tile;
    }
  | {
      canOccupy: false;
      status: "out-of-bounds";
      x: number;
      y: number;
    };

export type OccupyTileResult =
  | {
      status: "occupied" | "already-occupied" | "hidden";
      tile: Tile;
    }
  | {
      status: "out-of-bounds";
      x: number;
      y: number;
    };

export type VacateTileResult =
  | {
      status: "vacated" | "already-vacant";
      tile: Tile;
    }
  | {
      status: "out-of-bounds";
      x: number;
      y: number;
    };

export interface OccupyTilesResult {
  results: OccupyTileResult[];
  occupiedCount: number;
  alreadyOccupiedCount: number;
  hiddenCount: number;
  outOfBoundsCount: number;
}

export interface VacateTilesResult {
  results: VacateTileResult[];
  vacatedCount: number;
  alreadyVacantCount: number;
  outOfBoundsCount: number;
}

export function isInBounds(x: number, y: number): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    x < WORLD_WIDTH &&
    y >= 0 &&
    y < WORLD_HEIGHT
  );
}

export function toTileIndex(x: number, y: number): number | undefined {
  if (!isInBounds(x, y)) {
    return undefined;
  }

  return y * WORLD_WIDTH + x;
}

function isInitiallyRevealed(x: number, y: number): boolean {
  return (
    x >= INITIAL_REVEALED_MIN_X &&
    x <= INITIAL_REVEALED_MAX_X &&
    y >= INITIAL_REVEALED_MIN_Y &&
    y <= INITIAL_REVEALED_MAX_Y
  );
}

export function createWorld(): WorldState {
  const tiles = Array.from({ length: WORLD_TILE_COUNT }, (_, index): Tile => {
    const x = index % WORLD_WIDTH;
    const y = Math.floor(index / WORLD_WIDTH);

    return {
      x,
      y,
      revealState: isInitiallyRevealed(x, y) ? "revealed" : "hidden",
      occupancyState: "vacant",
    };
  });

  return {
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    tiles,
  };
}

export function getTile(
  world: WorldState,
  x: number,
  y: number,
): Tile | undefined {
  const index = toTileIndex(x, y);

  return index === undefined ? undefined : world.tiles[index];
}

export function revealTile(
  world: WorldState,
  x: number,
  y: number,
): RevealTileResult {
  const tile = getTile(world, x, y);

  if (tile === undefined) {
    return {
      status: "out-of-bounds",
      x,
      y,
    };
  }

  if (tile.revealState === "revealed") {
    return {
      status: "already-revealed",
      tile,
    };
  }

  tile.revealState = "revealed";

  return {
    status: "newly-revealed",
    tile,
  };
}

export function revealTiles(
  world: WorldState,
  coordinates: readonly TileCoordinate[],
): RevealTilesResult {
  const results: RevealTileResult[] = [];
  let newlyRevealedCount = 0;
  let alreadyRevealedCount = 0;
  let outOfBoundsCount = 0;

  for (const coordinate of coordinates) {
    const result = revealTile(world, coordinate.x, coordinate.y);
    results.push(result);

    switch (result.status) {
      case "newly-revealed":
        newlyRevealedCount += 1;
        break;
      case "already-revealed":
        alreadyRevealedCount += 1;
        break;
      case "out-of-bounds":
        outOfBoundsCount += 1;
        break;
    }
  }

  return {
    results,
    newlyRevealedCount,
    alreadyRevealedCount,
    outOfBoundsCount,
  };
}

export function getOrthogonalNeighbours(
  world: WorldState,
  x: number,
  y: number,
): Tile[] {
  if (!isInBounds(x, y)) {
    return [];
  }

  const neighbourCoordinates: readonly TileCoordinate[] = [
    { x, y: y - 1 },
    { x, y: y + 1 },
    { x: x - 1, y },
    { x: x + 1, y },
  ];

  const neighbours: Tile[] = [];

  for (const coordinate of neighbourCoordinates) {
    const tile = getTile(world, coordinate.x, coordinate.y);

    if (tile !== undefined) {
      neighbours.push(tile);
    }
  }

  return neighbours;
}

export function getHiddenOrthogonalNeighbours(
  world: WorldState,
  x: number,
  y: number,
): Tile[] {
  return getOrthogonalNeighbours(world, x, y).filter(
    (tile) => tile.revealState === "hidden",
  );
}

export function canOccupyTile(
  world: WorldState,
  x: number,
  y: number,
): OccupancyCheckResult {
  const tile = getTile(world, x, y);

  if (tile === undefined) {
    return {
      canOccupy: false,
      status: "out-of-bounds",
      x,
      y,
    };
  }

  if (tile.revealState === "hidden") {
    return {
      canOccupy: false,
      status: "hidden",
      tile,
    };
  }

  if (tile.occupancyState === "occupied") {
    return {
      canOccupy: false,
      status: "already-occupied",
      tile,
    };
  }

  return {
    canOccupy: true,
    status: "available",
    tile,
  };
}

export function occupyTile(
  world: WorldState,
  x: number,
  y: number,
): OccupyTileResult {
  const check = canOccupyTile(world, x, y);

  if (check.status === "out-of-bounds") {
    return {
      status: "out-of-bounds",
      x: check.x,
      y: check.y,
    };
  }

  if (check.status === "hidden") {
    return {
      status: "hidden",
      tile: check.tile,
    };
  }

  if (check.status === "already-occupied") {
    return {
      status: "already-occupied",
      tile: check.tile,
    };
  }

  check.tile.occupancyState = "occupied";

  return {
    status: "occupied",
    tile: check.tile,
  };
}

export function vacateTile(
  world: WorldState,
  x: number,
  y: number,
): VacateTileResult {
  const tile = getTile(world, x, y);

  if (tile === undefined) {
    return {
      status: "out-of-bounds",
      x,
      y,
    };
  }

  if (tile.occupancyState === "vacant") {
    return {
      status: "already-vacant",
      tile,
    };
  }

  tile.occupancyState = "vacant";

  return {
    status: "vacated",
    tile,
  };
}

export function occupyTiles(
  world: WorldState,
  coordinates: readonly TileCoordinate[],
): OccupyTilesResult {
  const results: OccupyTileResult[] = [];
  let occupiedCount = 0;
  let alreadyOccupiedCount = 0;
  let hiddenCount = 0;
  let outOfBoundsCount = 0;

  for (const coordinate of coordinates) {
    const result = occupyTile(world, coordinate.x, coordinate.y);
    results.push(result);

    switch (result.status) {
      case "occupied":
        occupiedCount += 1;
        break;
      case "already-occupied":
        alreadyOccupiedCount += 1;
        break;
      case "hidden":
        hiddenCount += 1;
        break;
      case "out-of-bounds":
        outOfBoundsCount += 1;
        break;
    }
  }

  return {
    results,
    occupiedCount,
    alreadyOccupiedCount,
    hiddenCount,
    outOfBoundsCount,
  };
}

export function vacateTiles(
  world: WorldState,
  coordinates: readonly TileCoordinate[],
): VacateTilesResult {
  const results: VacateTileResult[] = [];
  let vacatedCount = 0;
  let alreadyVacantCount = 0;
  let outOfBoundsCount = 0;

  for (const coordinate of coordinates) {
    const result = vacateTile(world, coordinate.x, coordinate.y);
    results.push(result);

    switch (result.status) {
      case "vacated":
        vacatedCount += 1;
        break;
      case "already-vacant":
        alreadyVacantCount += 1;
        break;
      case "out-of-bounds":
        outOfBoundsCount += 1;
        break;
    }
  }

  return {
    results,
    vacatedCount,
    alreadyVacantCount,
    outOfBoundsCount,
  };
}

export function countOccupiedTiles(world: WorldState): number {
  return world.tiles.reduce(
    (count, tile) => count + (tile.occupancyState === "occupied" ? 1 : 0),
    0,
  );
}

export function countRevealedTiles(world: WorldState): number {
  return world.tiles.reduce(
    (count, tile) => count + (tile.revealState === "revealed" ? 1 : 0),
    0,
  );
}

export function validateWorld(world: WorldState): WorldValidationResult {
  const errors: string[] = [];

  if (world.width !== WORLD_WIDTH || world.height !== WORLD_HEIGHT) {
    errors.push(`World dimensions must be ${WORLD_WIDTH}×${WORLD_HEIGHT}.`);
  }

  if (world.tiles.length !== WORLD_TILE_COUNT) {
    errors.push(`World must contain exactly ${WORLD_TILE_COUNT} tiles.`);
  }

  if (countRevealedTiles(world) !== INITIAL_REVEALED_SIZE ** 2) {
    errors.push("World must begin with exactly 64 revealed tiles.");
  }

  for (let index = 0; index < world.tiles.length; index += 1) {
    const tile = world.tiles[index];
    const expectedX = index % WORLD_WIDTH;
    const expectedY = Math.floor(index / WORLD_WIDTH);

    if (tile.x !== expectedX || tile.y !== expectedY) {
      errors.push(`Tile at index ${index} has incorrect coordinates.`);
      continue;
    }

    const expectedRevealState = isInitiallyRevealed(tile.x, tile.y)
      ? "revealed"
      : "hidden";

    if (tile.revealState !== expectedRevealState) {
      errors.push(`Tile at (${tile.x}, ${tile.y}) has incorrect reveal state.`);
    }

    if (tile.occupancyState !== "vacant") {
      errors.push(`Tile at (${tile.x}, ${tile.y}) must begin vacant.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateRevealFoundation(): WorldValidationResult {
  const world = createWorld();
  const errors = [...validateWorld(world).errors];
  const initialRevealedCount = countRevealedTiles(world);

  const firstReveal = revealTile(world, 0, 0);
  const repeatedReveal = revealTile(world, 0, 0);
  const outOfBoundsReveal = revealTile(world, WORLD_WIDTH, 0);

  if (firstReveal.status !== "newly-revealed") {
    errors.push("A hidden in-bounds tile must report newly-revealed.");
  }

  if (repeatedReveal.status !== "already-revealed") {
    errors.push("A repeated reveal must report already-revealed.");
  }

  if (outOfBoundsReveal.status !== "out-of-bounds") {
    errors.push("An out-of-bounds reveal must report out-of-bounds.");
  }

  const batchResult = revealTiles(world, [
    { x: 1, y: 0 },
    { x: 1, y: 0 },
    { x: -1, y: 0 },
  ]);

  if (
    batchResult.newlyRevealedCount !== 1 ||
    batchResult.alreadyRevealedCount !== 1 ||
    batchResult.outOfBoundsCount !== 1
  ) {
    errors.push("Batch reveal counts must handle duplicates and bounds safely.");
  }

  if (countRevealedTiles(world) !== initialRevealedCount + 2) {
    errors.push("Repeated and out-of-bounds reveals must not change reveal count.");
  }

  const centreNeighbours = getOrthogonalNeighbours(
    world,
    INITIAL_REVEALED_MIN_X,
    INITIAL_REVEALED_MIN_Y,
  );

  if (
    centreNeighbours.length !== 4 ||
    centreNeighbours.some(
      (tile) =>
        Math.abs(tile.x - INITIAL_REVEALED_MIN_X) +
          Math.abs(tile.y - INITIAL_REVEALED_MIN_Y) !==
        1,
    )
  ) {
    errors.push("An interior tile must have four orthogonal neighbours only.");
  }

  const cornerNeighbours = getOrthogonalNeighbours(world, 0, 0);

  if (cornerNeighbours.length !== 2) {
    errors.push("A corner tile must have two in-bounds neighbours.");
  }

  const hiddenNeighbours = getHiddenOrthogonalNeighbours(
    world,
    INITIAL_REVEALED_MIN_X,
    INITIAL_REVEALED_MIN_Y,
  );

  if (
    hiddenNeighbours.length !== 2 ||
    hiddenNeighbours.some((tile) => tile.revealState !== "hidden")
  ) {
    errors.push("Hidden-neighbour lookup must return only hidden tiles.");
  }

  if (getOrthogonalNeighbours(world, -1, 0).length !== 0) {
    errors.push("Out-of-bounds neighbour lookup must return an empty array.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateOccupancyFoundation(): WorldValidationResult {
  const world = createWorld();
  const errors = [...validateWorld(world).errors];

  const revealedX = INITIAL_REVEALED_MIN_X;
  const revealedY = INITIAL_REVEALED_MIN_Y;

  const initialCheck = canOccupyTile(world, revealedX, revealedY);
  const firstOccupation = occupyTile(world, revealedX, revealedY);
  const repeatedOccupation = occupyTile(world, revealedX, revealedY);
  const hiddenOccupation = occupyTile(world, 0, 0);
  const outOfBoundsOccupation = occupyTile(world, WORLD_WIDTH, 0);

  if (!initialCheck.canOccupy || initialCheck.status !== "available") {
    errors.push("A revealed vacant tile must be available for occupation.");
  }

  if (firstOccupation.status !== "occupied") {
    errors.push("A revealed vacant tile must report occupied.");
  }

  if (repeatedOccupation.status !== "already-occupied") {
    errors.push("Repeated occupation must report already-occupied.");
  }

  if (hiddenOccupation.status !== "hidden") {
    errors.push("A hidden tile must reject occupation with hidden status.");
  }

  if (outOfBoundsOccupation.status !== "out-of-bounds") {
    errors.push("Out-of-bounds occupation must report out-of-bounds.");
  }

  const occupyBatchResult = occupyTiles(world, [
    { x: revealedX + 1, y: revealedY },
    { x: revealedX + 1, y: revealedY },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ]);

  if (
    occupyBatchResult.occupiedCount !== 1 ||
    occupyBatchResult.alreadyOccupiedCount !== 1 ||
    occupyBatchResult.hiddenCount !== 1 ||
    occupyBatchResult.outOfBoundsCount !== 1
  ) {
    errors.push("Batch occupation must process duplicates and failures in order.");
  }

  if (countOccupiedTiles(world) !== 2) {
    errors.push("Only two unique revealed tiles should be occupied.");
  }

  const alreadyVacant = vacateTile(world, revealedX + 2, revealedY);

  if (alreadyVacant.status !== "already-vacant") {
    errors.push("Vacating a vacant tile must report already-vacant.");
  }

  const vacateBatchResult = vacateTiles(world, [
    { x: revealedX, y: revealedY },
    { x: revealedX, y: revealedY },
    { x: revealedX + 1, y: revealedY },
    { x: revealedX + 1, y: revealedY },
    { x: WORLD_WIDTH, y: 0 },
  ]);

  if (
    vacateBatchResult.vacatedCount !== 2 ||
    vacateBatchResult.alreadyVacantCount !== 2 ||
    vacateBatchResult.outOfBoundsCount !== 1
  ) {
    errors.push("Batch vacancy must process duplicates and bounds in order.");
  }

  if (countOccupiedTiles(world) !== 0) {
    errors.push("All successfully vacated tiles must finish vacant.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

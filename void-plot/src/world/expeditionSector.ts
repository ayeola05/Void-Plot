import {
  countRevealedTiles,
  createWorld,
  getOrthogonalNeighbours,
  getTile,
  type TileCoordinate,
  type WorldState,
} from "./world";

export const EXPEDITION_SECTOR_SIZES = [2, 4, 6] as const;

export type ExpeditionSectorSize = (typeof EXPEDITION_SECTOR_SIZES)[number];

export interface ExpeditionSectorOrigin {
  x: number;
  y: number;
}

export interface ExpeditionSectorBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: ExpeditionSectorSize;
  height: ExpeditionSectorSize;
}

export type ExpeditionSectorCoordinateResult =
  | {
      status: "valid";
      origin: ExpeditionSectorOrigin;
      size: ExpeditionSectorSize;
      bounds: ExpeditionSectorBounds;
      coordinates: TileCoordinate[];
    }
  | {
      status: "out-of-bounds";
      origin: ExpeditionSectorOrigin;
      size: ExpeditionSectorSize;
      bounds: ExpeditionSectorBounds;
    };

interface ValidSectorGeometry {
  origin: ExpeditionSectorOrigin;
  size: ExpeditionSectorSize;
  bounds: ExpeditionSectorBounds;
  coordinates: TileCoordinate[];
}

export type ExpeditionSectorSelectionResult =
  | (ValidSectorGeometry & {
      status: "valid";
      hiddenCoordinates: TileCoordinate[];
    })
  | (ValidSectorGeometry & {
      status: "already-fully-revealed";
      hiddenCoordinates: [];
    })
  | (ValidSectorGeometry & {
      status: "not-adjacent";
      hiddenCoordinates: TileCoordinate[];
    })
  | {
      status: "out-of-bounds";
      origin: ExpeditionSectorOrigin;
      size: ExpeditionSectorSize;
      bounds: ExpeditionSectorBounds;
    };

export interface ExpeditionSectorValidationResult {
  valid: boolean;
  errors: string[];
}

export function getExpeditionSectorBounds(
  origin: ExpeditionSectorOrigin,
  size: ExpeditionSectorSize,
): ExpeditionSectorBounds {
  return {
    minX: origin.x,
    minY: origin.y,
    maxX: origin.x + size - 1,
    maxY: origin.y + size - 1,
    width: size,
    height: size,
  };
}

export function calculateExpeditionSectorCoordinates(
  world: WorldState,
  origin: ExpeditionSectorOrigin,
  size: ExpeditionSectorSize,
): ExpeditionSectorCoordinateResult {
  const bounds = getExpeditionSectorBounds(origin, size);

  if (
    !Number.isInteger(origin.x) ||
    !Number.isInteger(origin.y) ||
    bounds.minX < 0 ||
    bounds.minY < 0 ||
    bounds.maxX >= world.width ||
    bounds.maxY >= world.height
  ) {
    return {
      status: "out-of-bounds",
      origin: { ...origin },
      size,
      bounds,
    };
  }

  const coordinates: TileCoordinate[] = [];

  for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      coordinates.push({ x, y });
    }
  }

  return {
    status: "valid",
    origin: { ...origin },
    size,
    bounds,
    coordinates,
  };
}

export function sectorContainsHiddenTile(
  world: WorldState,
  origin: ExpeditionSectorOrigin,
  size: ExpeditionSectorSize,
): boolean {
  const calculation = calculateExpeditionSectorCoordinates(world, origin, size);

  if (calculation.status === "out-of-bounds") {
    return false;
  }

  return calculation.coordinates.some(
    (coordinate) =>
      getTile(world, coordinate.x, coordinate.y)?.revealState === "hidden",
  );
}

export function validateExpeditionSectorSelection(
  world: WorldState,
  origin: ExpeditionSectorOrigin,
  size: ExpeditionSectorSize,
): ExpeditionSectorSelectionResult {
  const calculation = calculateExpeditionSectorCoordinates(world, origin, size);

  if (calculation.status === "out-of-bounds") {
    return calculation;
  }

  const hiddenCoordinates = calculation.coordinates.filter(
    (coordinate) =>
      getTile(world, coordinate.x, coordinate.y)?.revealState === "hidden",
  );

  if (hiddenCoordinates.length === 0) {
    return {
      ...calculation,
      status: "already-fully-revealed",
      hiddenCoordinates: [],
    };
  }

  const isAdjacent = hiddenCoordinates.some((coordinate) =>
    getOrthogonalNeighbours(world, coordinate.x, coordinate.y).some(
      (neighbour) => neighbour.revealState === "revealed",
    ),
  );

  return isAdjacent
    ? {
        ...calculation,
        status: "valid",
        hiddenCoordinates,
      }
    : {
        ...calculation,
        status: "not-adjacent",
        hiddenCoordinates,
      };
}

export function getHiddenCoordinatesInValidSector(
  world: WorldState,
  origin: ExpeditionSectorOrigin,
  size: ExpeditionSectorSize,
): TileCoordinate[] {
  const result = validateExpeditionSectorSelection(world, origin, size);

  return result.status === "valid"
    ? result.hiddenCoordinates.map((coordinate) => ({ ...coordinate }))
    : [];
}

export function validateExpeditionSectorFoundation(): ExpeditionSectorValidationResult {
  const world = createWorld();
  const errors: string[] = [];
  const revealedBefore = countRevealedTiles(world);

  for (const size of EXPEDITION_SECTOR_SIZES) {
    const calculation = calculateExpeditionSectorCoordinates(
      world,
      { x: 0, y: 0 },
      size,
    );

    if (
      calculation.status !== "valid" ||
      calculation.coordinates.length !== size * size
    ) {
      errors.push(`${size}×${size} sectors must contain ${size * size} tiles.`);
    }
  }

  const validSector = validateExpeditionSectorSelection(
    world,
    { x: 10, y: 12 },
    2,
  );
  const diagonalOnlySector = validateExpeditionSectorSelection(
    world,
    { x: 10, y: 10 },
    2,
  );
  const revealedSector = validateExpeditionSectorSelection(
    world,
    { x: 12, y: 12 },
    2,
  );
  const edgeSector = validateExpeditionSectorSelection(
    world,
    { x: 31, y: 31 },
    2,
  );

  if (validSector.status !== "valid") {
    errors.push("An orthogonally adjacent hidden sector must be valid.");
  }

  if (diagonalOnlySector.status !== "not-adjacent") {
    errors.push("Diagonal-only contact must not make a sector adjacent.");
  }

  if (revealedSector.status !== "already-fully-revealed") {
    errors.push("A fully revealed sector must report already-fully-revealed.");
  }

  if (edgeSector.status !== "out-of-bounds") {
    errors.push("A sector extending beyond the world must report out-of-bounds.");
  }

  if (!sectorContainsHiddenTile(world, { x: 10, y: 12 }, 2)) {
    errors.push("A valid frontier sector must report that it contains hidden tiles.");
  }

  if (sectorContainsHiddenTile(world, { x: 12, y: 12 }, 2)) {
    errors.push("A revealed sector must not report hidden tiles.");
  }

  if (getHiddenCoordinatesInValidSector(world, { x: 10, y: 12 }, 2).length !== 4) {
    errors.push("A valid hidden 2×2 sector must return four hidden coordinates.");
  }

  if (countRevealedTiles(world) !== revealedBefore) {
    errors.push("Sector calculation and validation must not reveal tiles.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

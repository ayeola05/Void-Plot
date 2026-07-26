export type RevealState = "hidden" | "revealed";

export type OccupancyState = "vacant" | "occupied";

export interface Tile {
  x: number;
  y: number;
  revealState: RevealState;
  occupancyState: OccupancyState;
}

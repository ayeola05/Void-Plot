export const THEME_COLORS = Object.freeze({
  canvasBackground: 0x070a0c,
  sidebarBackground: 0x0a0f11,
  panelBackground: 0x11191a,
  panelRaised: 0x182223,
  panelBorder: 0x2b3a37,
  primaryText: 0xe5ebe7,
  secondaryText: 0x8f9c96,
  accent: 0xd0aa62,
  accentMuted: 0x806c49,
  valid: 0x739a72,
  validBright: 0xb7cf78,
  warning: 0xc18a50,
  invalid: 0xb65c58,
  hiddenTiles: Object.freeze([0x101619, 0x12191c, 0x0e1417]),
  hiddenInset: 0x080c0e,
  hiddenMark: 0x273033,
  revealedTerrain: Object.freeze([0x59635a, 0x626a5f, 0x515d57]),
  revealedInset: Object.freeze([0x657066, 0x6c7469, 0x5d6962]),
  terrainMark: 0x36443e,
  gridLines: 0x202a2a,
  worldFrame: 0x465550,
  hover: 0xa9c0ae,
  selection: 0xe0b566,
  sector: 0x6d9994,
  buttonNormal: 0x253130,
  buttonHover: 0x334340,
  buttonPressed: 0x1b2524,
  buttonDisabled: 0x192120,
  buttonSelected: 0x806c49,
  constructionCard: 0x151e1f,
  constructionCardInset: 0x0d1415,
  constructionCardHover: 0x21302e,
  constructionCardSelected: 0x29271f,
  constructionCardDisabled: 0x101718,
  constructionHousing: 0xb99562,
  constructionFood: 0x9b8351,
  constructionMaterials: 0x55734f,
  constructionPower: 0xd0aa62,
  constructionResearch: 0x78a99f,
  structureFoundation: 0x343b3a,
  structureFoundationDark: 0x171d1d,
  structureTopPlane: 0x4a5350,
  structureDeepEdge: 0x101516,
  structureRimLight: 0x9b9a80,
  structureMetalLight: 0x66706d,
  structureMetalMid: 0x3f4948,
  structureMetalDark: 0x242c2d,
  structureCable: 0x151b1c,
  structureWarningStripe: 0xb28a49,
  progressTrack: 0x25302f,
  homeFoundation: 0x303936,
  homeBody: 0xb99562,
  homeRoof: 0x75524a,
  homeTrim: 0x2c2522,
  homeWindow: 0xd6c786,
  farmSoil: 0x574333,
  farmRows: 0x9b8351,
  farmBorder: 0x2d2821,
  farmActive: 0xb7cf78,
  farmProgressTrack: 0x2b241e,
  farmProgressFill: 0xc2a660,
  forestGround: 0x26342c,
  forestTrunk: 0x624b36,
  forestCanopyDark: 0x34533d,
  forestCanopyLight: 0x55734f,
  forestActive: 0x9fc477,
  forestProgressTrack: 0x1c2a22,
  forestProgressFill: 0x7fa464,
  powerBody: 0x39444b,
  powerFrame: 0x20292e,
  powerCoil: 0xd0aa62,
  powerCore: 0x7fa5a8,
  powerActive: 0xd7c779,
  powerWarning: 0xd07a55,
  labBody: 0x28343c,
  labFrame: 0x151d22,
  labTerminal: 0x6c8791,
  labFluid: 0x78a99f,
  labActive: 0x9bd6c7,
  beaconBody: 0x30383d,
  beaconTrim: 0xb79a61,
  beaconCore: 0xf2d28a,
  beaconGlow: 0xe8bd6a,
});

export const THEME_TYPOGRAPHY = Object.freeze({
  fontFamily: "Arial, Helvetica, sans-serif",
  headingSize: "11px",
  valueSize: "14px",
  bodySize: "11px",
  helperSize: "10px",
  buttonSize: "11px",
  statusSize: "10px",
});

export const THEME_SPACING = Object.freeze({
  sidebarPadding: 12,
  panelPadding: 10,
  panelGap: 8,
  controlGap: 7,
  buttonHeight: 32,
});

export const RENDER_DEPTHS = Object.freeze({
  worldFrame: -10,
  terrain: 0,
  terrainDetail: 1,
  building: 10,
  buildingPreview: 20,
  sectorSelection: 25,
  sectorPreview: 30,
  hover: 40,
  selection: 50,
  productionPopup: 60,
  uiRail: 990,
  ui: 1_000,
});

export interface TerrainVisualDescriptor {
  readonly baseColor: number;
  readonly insetColor: number;
  readonly markColor: number;
  readonly markAlpha: number;
  readonly markOffsetX: number;
  readonly markOffsetY: number;
  readonly markRotation: number;
  readonly markWidth: number;
}

export interface VisualThemeValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

export function colorToCss(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export function getTerrainVariantIndex(
  x: number,
  y: number,
  variantCount: number,
): number {
  if (variantCount <= 0 || !Number.isInteger(variantCount)) {
    return 0;
  }

  return coordinateHash(x, y) % variantCount;
}

export function getTerrainVisualDescriptor(
  x: number,
  y: number,
  revealState: "hidden" | "revealed",
): TerrainVisualDescriptor {
  const hash = coordinateHash(x, y);
  const hidden = revealState === "hidden";
  const palette = hidden
    ? THEME_COLORS.hiddenTiles
    : THEME_COLORS.revealedTerrain;
  const variant = getTerrainVariantIndex(x, y, palette.length);

  return {
    baseColor: palette[variant],
    insetColor: hidden
      ? THEME_COLORS.hiddenInset
      : THEME_COLORS.revealedInset[variant],
    markColor: hidden ? THEME_COLORS.hiddenMark : THEME_COLORS.terrainMark,
    markAlpha: hidden ? 0.2 : 0.34,
    markOffsetX: ((hash >>> 4) % 7) - 3,
    markOffsetY: ((hash >>> 8) % 7) - 3,
    markRotation: ((hash >>> 12) % 4) * (Math.PI / 4),
    markWidth: 2 + ((hash >>> 16) % 3),
  };
}

export function validateVisualThemeFoundation(): VisualThemeValidationResult {
  const errors: string[] = [];
  const first = getTerrainVisualDescriptor(12, 12, "revealed");
  const repeated = getTerrainVisualDescriptor(12, 12, "revealed");
  const hidden = getTerrainVisualDescriptor(12, 12, "hidden");

  if (JSON.stringify(first) !== JSON.stringify(repeated)) {
    errors.push("Terrain variation must be deterministic for fixed coordinates.");
  }

  if (first.baseColor === hidden.baseColor || first.insetColor === hidden.insetColor) {
    errors.push("Hidden and revealed terrain must remain visually distinct.");
  }

  if (
    new Set(
      [
        getTerrainVisualDescriptor(12, 12, "revealed").baseColor,
        getTerrainVisualDescriptor(13, 12, "revealed").baseColor,
        getTerrainVisualDescriptor(14, 12, "revealed").baseColor,
        getTerrainVisualDescriptor(15, 12, "revealed").baseColor,
      ],
    ).size < 2
  ) {
    errors.push("Nearby revealed tiles must expose subtle stable variation.");
  }

  return { valid: errors.length === 0, errors };
}

function coordinateHash(x: number, y: number): number {
  const integerX = Number.isInteger(x) ? x : 0;
  const integerY = Number.isInteger(y) ? y : 0;
  let hash = Math.imul(integerX + 1, 73_856_093) ^ Math.imul(integerY + 1, 19_349_663);

  hash ^= hash >>> 13;
  return hash >>> 0;
}

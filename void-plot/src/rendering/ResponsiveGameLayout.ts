export const RESERVED_UI_WIDTH = 264;
export const MIN_GAMEPLAY_VIEWPORT_WIDTH = 1;
export const PANEL_MAX_WIDTH = 240;
export const LAYOUT_GUTTER = 12;
export const RESOURCE_PANEL_HEIGHT = 170;
export const SELECTED_TILE_PANEL_HEIGHT = 148;
export const SIDEBAR_PANEL_GAP = 8;
export const BUILD_PANEL_HEIGHT = 356;
export const BUILD_PANEL_COMPACT_HEIGHT = 230;
export const MOBILE_LAYOUT_BREAKPOINT = 760;
export const MOBILE_SHORT_VIEWPORT_HEIGHT = 560;
export const MOBILE_NAVIGATION_HEIGHT = 44;
export const MOBILE_MIN_GAMEPLAY_HEIGHT = 150;

export interface ScreenRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ResponsiveGameLayout {
  mobile: boolean;
  viewportWidth: number;
  viewportHeight: number;
  uiViewportWidth: number;
  uiViewportHeight: number;
  uiReservedWidth: number;
  gameplay: ScreenRectangle;
  resourcesPanel: ScreenRectangle;
  buildPanel: ScreenRectangle;
  selectedTilePanel: ScreenRectangle;
  expeditionPanel: ScreenRectangle;
  mobileNavigation: ScreenRectangle;
  reservedUiWidth: number;
}

export interface ResponsiveLayoutValidationResult {
  readonly valid: boolean;
  readonly errors: string[];
}

export interface BuildPanelCardLayout {
  readonly mode: "grid" | "compact";
  readonly cards: readonly ScreenRectangle[];
  readonly actionRow: ScreenRectangle;
}

export function calculateBuildPanelCardLayout(
  panel: ScreenRectangle,
): BuildPanelCardLayout {
  const padding = 10;
  const gap = 6;
  const compact = panel.height <= BUILD_PANEL_COMPACT_HEIGHT;
  const wideCompact = compact && panel.width >= 620;
  const headerHeight = compact ? 44 : 58;
  const actionHeight = compact ? 28 : 32;
  const actionY = panel.height - padding - actionHeight;
  const cardsTop = headerHeight;
  const cardsBottom = actionY - gap;
  const columns = wideCompact ? 5 : 2;
  const rows = Math.ceil(5 / columns);
  const cardWidth = Math.max(1, Math.floor((panel.width - padding * 2 - gap * (columns - 1)) / columns));
  const cardHeight = Math.max(1, Math.floor((cardsBottom - cardsTop - gap * (rows - 1)) / rows));
  const cards = Array.from({ length: 5 }, (_, index) => ({
    x: padding + (index % columns) * (cardWidth + gap),
    y: cardsTop + Math.floor(index / columns) * (cardHeight + gap),
    width: cardWidth,
    height: cardHeight,
  }));

  return Object.freeze({
    mode: compact ? "compact" : "grid",
    cards: Object.freeze(cards),
    actionRow: Object.freeze({
      x: padding,
      y: actionY,
      width: Math.max(1, panel.width - padding * 2),
      height: actionHeight,
    }),
  });
}

export function calculateResponsiveGameLayout(
  viewportWidth: number,
  viewportHeight: number,
  uiScale = 1,
): ResponsiveGameLayout {
  const width = Math.max(1, Math.floor(viewportWidth));
  const height = Math.max(1, Math.floor(viewportHeight));
  const safeUiScale = uiScale === 0.9 || uiScale === 1.15 ? uiScale : 1;
  const uiWidth = width / safeUiScale;
  const uiHeight = height / safeUiScale;
  const mobile = width < MOBILE_LAYOUT_BREAKPOINT || height < MOBILE_SHORT_VIEWPORT_HEIGHT;
  if (mobile) {
    const bottomAreaHeight = Math.min(
      Math.max(210, Math.round(height * (width > height ? 0.56 : 0.38))),
      Math.max(1, height - MOBILE_MIN_GAMEPLAY_HEIGHT),
    );
    const gameplayHeight = Math.max(1, height - bottomAreaHeight);
    const gameplayHeightUi = gameplayHeight / safeUiScale;
    const navigationHeight = MOBILE_NAVIGATION_HEIGHT;
    const panel = {
      x: LAYOUT_GUTTER,
      y: gameplayHeightUi + navigationHeight,
      width: Math.max(1, uiWidth - LAYOUT_GUTTER * 2),
      height: Math.max(1, uiHeight - gameplayHeightUi - navigationHeight - LAYOUT_GUTTER),
    };

    return {
      mobile: true,
      viewportWidth: width,
      viewportHeight: height,
      uiViewportWidth: uiWidth,
      uiViewportHeight: uiHeight,
      uiReservedWidth: 0,
      gameplay: { x: 0, y: 0, width, height: gameplayHeight },
      resourcesPanel: { ...panel },
      buildPanel: { ...panel },
      selectedTilePanel: { ...panel },
      expeditionPanel: { ...panel },
      mobileNavigation: {
        x: LAYOUT_GUTTER,
        y: gameplayHeightUi,
        width: Math.max(1, uiWidth - LAYOUT_GUTTER * 2),
        height: navigationHeight,
      },
      reservedUiWidth: 0,
    };
  }
  const reservedUiWidth = Math.min(
    Math.round(RESERVED_UI_WIDTH * safeUiScale),
    Math.max(0, width - MIN_GAMEPLAY_VIEWPORT_WIDTH),
  );
  const uiReservedWidth = reservedUiWidth / safeUiScale;
  const panelWidth = Math.min(
    PANEL_MAX_WIDTH,
    Math.max(1, uiReservedWidth - LAYOUT_GUTTER * 2),
  );
  const compact = uiHeight < 900;
  const panelGap = compact ? 6 : SIDEBAR_PANEL_GAP;
  const resourcesHeight = RESOURCE_PANEL_HEIGHT;
  const buildHeight = compact ? BUILD_PANEL_COMPACT_HEIGHT : BUILD_PANEL_HEIGHT;
  const selectedTileHeight = compact ? 128 : SELECTED_TILE_PANEL_HEIGHT;
  const resourcesY = LAYOUT_GUTTER;
  const buildY = resourcesY + resourcesHeight + panelGap;
  const selectedTileY = buildY + buildHeight + panelGap;
  const expeditionY = selectedTileY + selectedTileHeight + panelGap;
  const availableExpeditionHeight = Math.max(
    1,
    uiHeight - expeditionY - LAYOUT_GUTTER,
  );

  return {
    mobile: false,
    viewportWidth: width,
    viewportHeight: height,
    uiViewportWidth: uiWidth,
    uiViewportHeight: uiHeight,
    uiReservedWidth,
    gameplay: {
      x: reservedUiWidth,
      y: 0,
      width: width - reservedUiWidth,
      height,
    },
    resourcesPanel: {
      x: LAYOUT_GUTTER,
      y: resourcesY,
      width: panelWidth,
      height: resourcesHeight,
    },
    buildPanel: {
      x: LAYOUT_GUTTER,
      y: buildY,
      width: panelWidth,
      height: buildHeight,
    },
    selectedTilePanel: {
      x: LAYOUT_GUTTER,
      y: selectedTileY,
      width: panelWidth,
      height: selectedTileHeight,
    },
    expeditionPanel: {
      x: LAYOUT_GUTTER,
      y: expeditionY,
      width: panelWidth,
      height: Math.min(compact ? 240 : 272, availableExpeditionHeight),
    },
    mobileNavigation: { x: 0, y: 0, width: 0, height: 0 },
    reservedUiWidth,
  };
}

export function screenPointIsInsideRectangle(
  rectangle: ScreenRectangle,
  x: number,
  y: number,
): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    x >= rectangle.x &&
    x < rectangle.x + rectangle.width &&
    y >= rectangle.y &&
    y < rectangle.y + rectangle.height
  );
}

export function validateResponsiveGameLayoutFoundation(): ResponsiveLayoutValidationResult {
  const errors: string[] = [];

  for (const [width, height] of [[390, 844], [844, 390], [768, 1024], [1280, 720], [1366, 768], [1440, 900], [1920, 1080]] as const) {
    for (const scale of [0.9, 1, 1.15] as const) {
    const layout = calculateResponsiveGameLayout(width, height, scale);
    const buildCards = calculateBuildPanelCardLayout(layout.buildPanel);
    const panels = [
      layout.resourcesPanel,
      layout.buildPanel,
      layout.selectedTilePanel,
      layout.expeditionPanel,
    ];

    if (
      layout.gameplay.x !== layout.reservedUiWidth ||
      layout.gameplay.width !== width - layout.reservedUiWidth ||
      (!layout.mobile && layout.gameplay.height !== height)
    ) {
        errors.push(`${width}×${height} at ${scale} UI scale must preserve the gameplay viewport.`);
    }

    if (layout.mobile) {
      if (
        layout.reservedUiWidth !== 0 ||
        layout.gameplay.width !== width ||
        layout.gameplay.height < MOBILE_MIN_GAMEPLAY_HEIGHT ||
        layout.mobileNavigation.y * scale < layout.gameplay.height
      ) {
        errors.push(`${width}×${height} at ${scale} UI scale must preserve a usable full-width mobile world viewport.`);
      }
      for (const panel of panels) {
        if (panel.y < layout.mobileNavigation.y + layout.mobileNavigation.height || panel.y + panel.height > layout.uiViewportHeight) {
          errors.push(`${width}×${height} at ${scale} UI scale mobile panels must remain below navigation and inside the viewport.`);
        }
      }
      continue;
    }

    for (let index = 1; index < panels.length; index += 1) {
      const previous = panels[index - 1];
      const current = panels[index];

      if (previous.y + previous.height > current.y) {
        errors.push(`${width}×${height} at ${scale} UI scale sidebar panels must not overlap.`);
      }
    }

    const finalPanel = panels[panels.length - 1];

    if ((finalPanel.y + finalPanel.height) * scale > height) {
      errors.push(`${width}×${height} at ${scale} UI scale sidebar must remain inside the viewport.`);
    }

    for (const card of buildCards.cards) {
      if (
        card.x < 0 ||
        card.y < 0 ||
        card.x + card.width > layout.buildPanel.width ||
        card.y + card.height > buildCards.actionRow.y
      ) {
        errors.push(`${width}×${height} at ${scale} UI scale build cards must remain inside the card grid.`);
      }
    }
    if (
      buildCards.cards.length !== 5 ||
      buildCards.actionRow.y + buildCards.actionRow.height > layout.buildPanel.height
    ) {
      errors.push(`${width}×${height} at ${scale} UI scale must keep five cards and the action row reachable.`);
    }
    }
  }

  return { valid: errors.length === 0, errors };
}

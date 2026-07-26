export const RESEARCH_PANEL_COLLAPSED_HEIGHT = 86;
export const RESEARCH_PANEL_EXPANDED_HEIGHT = 302;

export interface ScreenPoint { readonly x: number; readonly y: number }

export function getResearchPanelHeight(expanded: boolean, viewportHeight: number): number {
  return Math.min(
    expanded ? RESEARCH_PANEL_EXPANDED_HEIGHT : RESEARCH_PANEL_COLLAPSED_HEIGHT,
    Math.max(1, viewportHeight - 24),
  );
}

export function calculateTooltipPosition(
  pointerX: number,
  pointerY: number,
  tooltipWidth: number,
  tooltipHeight: number,
  viewportWidth: number,
  viewportHeight: number,
): ScreenPoint {
  return {
    x: Math.max(6, Math.min(viewportWidth - tooltipWidth - 6, pointerX + 14)),
    y: Math.max(6, Math.min(viewportHeight - tooltipHeight - 6, pointerY + 14)),
  };
}

export function validateVisualClarityUiFoundation(): { readonly valid: boolean; readonly errors: readonly string[] } {
  const errors: string[] = [];
  if (getResearchPanelHeight(false, 720) >= getResearchPanelHeight(true, 720)) errors.push("Collapsed Research must be shorter than expanded Research.");
  if (getResearchPanelHeight(true, 280) > 256) errors.push("Research must remain inside a short viewport.");
  for (const pointer of [{ x: 0, y: 0 }, { x: 1279, y: 719 }]) {
    const point = calculateTooltipPosition(pointer.x, pointer.y, 250, 100, 1280, 720);
    if (point.x < 6 || point.y < 6 || point.x + 250 > 1274 || point.y + 100 > 714) errors.push("Tooltips must remain within the viewport.");
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

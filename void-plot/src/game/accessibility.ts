export interface AccessibilitySettings {
  readonly uiScale: 0.9 | 1 | 1.15;
  readonly screenShake: boolean;
  readonly particles: boolean;
  readonly colorblindResourceColors: boolean;
  readonly reducedMotion: boolean;
}

export const DEFAULT_ACCESSIBILITY_SETTINGS: AccessibilitySettings = Object.freeze({
  uiScale: 1,
  screenShake: true,
  particles: true,
  colorblindResourceColors: false,
  reducedMotion: false,
});

export interface RegistryLike {
  get(key: string): unknown;
  set(key: string, value: unknown): unknown;
}

const SETTINGS_KEY = "accessibilitySettings";

export function getAccessibilitySettings(registry: RegistryLike): AccessibilitySettings {
  const stored = registry.get(SETTINGS_KEY);
  if (isAccessibilitySettings(stored)) return stored;
  registry.set(SETTINGS_KEY, DEFAULT_ACCESSIBILITY_SETTINGS);
  return DEFAULT_ACCESSIBILITY_SETTINGS;
}

export function updateAccessibilitySettings(
  registry: RegistryLike,
  changes: Partial<AccessibilitySettings>,
): AccessibilitySettings {
  const next = Object.freeze({ ...getAccessibilitySettings(registry), ...changes });
  registry.set(SETTINGS_KEY, next);
  return next;
}

export function isAccessibilitySettings(value: unknown): value is AccessibilitySettings {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<AccessibilitySettings>;
  return (
    (candidate.uiScale === 0.9 || candidate.uiScale === 1 || candidate.uiScale === 1.15) &&
    typeof candidate.screenShake === "boolean" &&
    typeof candidate.particles === "boolean" &&
    typeof candidate.colorblindResourceColors === "boolean" &&
    typeof candidate.reducedMotion === "boolean"
  );
}


import type { AppSettings } from "../store/mindMapStore";

type NodeFillColors = {
  root: string;
  level1: string;
  level2: string;
  level3: string;
  level4: string;
};

const isValidColor = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const toHexChannel = (value: number) =>
  Math.max(0, Math.min(255, Math.round(value)))
    .toString(16)
    .padStart(2, "0");

const lightenHex = (hex: string, amount: number): string => {
  const normalized = hex.trim().replace("#", "");
  if (normalized.length !== 6) return hex;
  const r = parseInt(normalized.slice(0, 2), 16);
  const g = parseInt(normalized.slice(2, 4), 16);
  const b = parseInt(normalized.slice(4, 6), 16);
  if ([r, g, b].some((v) => Number.isNaN(v))) return hex;
  const mix = (channel: number) => channel + (255 - channel) * amount;
  return `#${toHexChannel(mix(r))}${toHexChannel(mix(g))}${toHexChannel(mix(b))}`;
};

export const getNodeFillColor = (
  settings: AppSettings,
  level: number | null,
  fallback: string,
  options?: { variant?: "folder" | "file" }
): string => {
  if (!settings.appearance.enableNodeFillColors) return fallback;
  const colors = settings.appearance.nodeFillColors as NodeFillColors | undefined;
  if (!colors) return fallback;

  const normalizedLevel =
    typeof level === "number" && Number.isFinite(level) ? level : 0;

  const resolved =
    normalizedLevel <= 0
      ? colors.root
      : normalizedLevel === 1
      ? colors.level1
      : normalizedLevel === 2
      ? colors.level2
      : normalizedLevel === 3
      ? colors.level3
      : colors.level4;

  const color = isValidColor(resolved) ? resolved : fallback;
  if (options?.variant === "file") {
    return lightenHex(color, 0.18);
  }
  return color;
};

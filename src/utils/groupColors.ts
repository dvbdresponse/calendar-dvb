import { Group } from "../types";

export const DEFAULT_GROUP_COLOR = "#64748b";

const HEX_COLOR_PATTERN = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface GroupPalette {
  color: string;
  bgColor: string;
  textColor: string;
  borderColor: string;
}

const normalizeHexColor = (value?: string): string => {
  const candidate = value?.trim();
  if (!candidate || !HEX_COLOR_PATTERN.test(candidate)) {
    return DEFAULT_GROUP_COLOR;
  }

  const hex = candidate.replace("#", "");
  const normalized = hex.length === 3
    ? hex.split("").map((char) => `${char}${char}`).join("")
    : hex;

  return `#${normalized.toLowerCase()}`;
};

const hexToRgb = (hexColor: string): RgbColor => {
  const hex = normalizeHexColor(hexColor).slice(1);
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  };
};

const rgbToHex = ({ r, g, b }: RgbColor): string => {
  const toHex = (value: number) => Math.round(value).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const mix = (from: RgbColor, to: RgbColor, weight: number): RgbColor => ({
  r: from.r + (to.r - from.r) * weight,
  g: from.g + (to.g - from.g) * weight,
  b: from.b + (to.b - from.b) * weight,
});

const relativeLuminance = ({ r, g, b }: RgbColor): number => {
  const channel = (value: number) => {
    const normalized = value / 255;
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const getGroupPalette = (color?: string): GroupPalette => {
  const normalizedColor = normalizeHexColor(color);
  const rgb = hexToRgb(normalizedColor);
  const white = { r: 255, g: 255, b: 255 };
  const black = { r: 15, g: 23, b: 42 };
  const isDark = relativeLuminance(rgb) < 0.2;

  return {
    color: normalizedColor,
    bgColor: rgbToHex(mix(rgb, white, 0.9)),
    textColor: rgbToHex(mix(rgb, black, isDark ? 0.05 : 0.42)),
    borderColor: rgbToHex(mix(rgb, white, 0.68)),
  };
};

export const getGroupBadgeStyle = (group?: Pick<Group, "color"> | null) => {
  const palette = getGroupPalette(group?.color);
  return {
    backgroundColor: palette.bgColor,
    color: palette.textColor,
    borderColor: palette.borderColor,
  };
};

export const withDerivedGroupColors = <T extends Pick<Group, "color">>(group: T): T & GroupPalette => {
  const palette = getGroupPalette(group.color);
  return {
    ...group,
    color: palette.color,
    bgColor: palette.bgColor,
    textColor: palette.textColor,
    borderColor: palette.borderColor,
  };
};

/**
 * colorUtils.ts
 * 
 * Generates folder/file color schemes per level.
 * Provides utilities for creating consistent color palettes based on
 * the hierarchical depth of folders and files in the mind map structure.
 * Each level gets a distinct color scheme to improve visual organization.
 */

/**
 * Converts a hex color string to RGB values
 * @param hex - Hex color string (with or without #)
 * @returns RGB object or null if invalid
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Converts RGB values to hex color string
 * @param r - Red value (0-255)
 * @param g - Green value (0-255)
 * @param b - Blue value (0-255)
 * @returns Hex color string
 */
export function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

/**
 * Generates a color for a specific folder/file level
 * Each level gets a progressively different color to create visual hierarchy.
 * 
 * @param level - The depth level (0 = root, 1 = first level, etc.)
 * @param isFolder - Whether this is a folder (true) or file (false)
 * @returns Hex color string for the level
 */
export function getColorForLevel(level: number, isFolder: boolean = true): string {
  // Base color palette - adjust these to match your theme
  const folderColors = [
    '#646cff', // Level 0 - root
    '#535bf2', // Level 1
    '#747bff', // Level 2
    '#8b8fff', // Level 3
    '#a3a5ff', // Level 4+
  ];

  const fileColors = [
    '#888',    // Level 0 files
    '#999',    // Level 1 files
    '#aaa',    // Level 2 files
    '#bbb',    // Level 3 files
    '#ccc',    // Level 4+ files
  ];

  const colors = isFolder ? folderColors : fileColors;
  const index = Math.min(level, colors.length - 1);
  return colors[index];
}

/**
 * Generates a lighter shade of a color for hover states
 * @param hex - Base hex color
 * @param percent - Lightness percentage (0-100)
 * @returns Lighter hex color
 */
export function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const factor = 1 + percent / 100;
  const r = Math.min(255, Math.round(rgb.r * factor));
  const g = Math.min(255, Math.round(rgb.g * factor));
  const b = Math.min(255, Math.round(rgb.b * factor));

  return rgbToHex(r, g, b);
}
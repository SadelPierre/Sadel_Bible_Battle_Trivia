/**
 * Theme system. The default "Royal Bible" theme is implemented; the others are
 * registered placeholders so new palettes can be added by filling in tokens
 * (each token maps to a CSS custom property set on <html data-theme=...>).
 */
export type ThemeId = "royal-bible" | "desert-journey" | "garden-of-eden" | "light-of-the-world" | "youth-night";

export type ThemeTokens = {
  bg: string;
  bgAccent: string;
  card: string;
  cardBorder: string;
  text: string;
  textMuted: string;
  gold: string;
  primary: string;
  primarySoft: string;
};

export const THEMES: Partial<Record<ThemeId, ThemeTokens>> = {
  "royal-bible": {
    bg: "#131035",
    bgAccent: "#2a1b5e",
    card: "#1e1847",
    cardBorder: "#3d2f7a",
    text: "#f5f1e6",
    textMuted: "#b6aed6",
    gold: "#e8b64c",
    primary: "#7c5cff",
    primarySoft: "#4c3a99",
  },
  // To add a theme: define its tokens here and add a [data-theme="..."] block
  // in globals.css. See ARCHITECTURE.md → "Theming".
};

export const DEFAULT_THEME: ThemeId = "royal-bible";

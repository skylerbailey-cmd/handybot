export const colors = {
  background: "#fafaf9",
  surface: "#ffffff",
  border: "#e7e5e4",
  borderStrong: "#d6d3d1",
  text: "#1c1917",
  textMuted: "#57534e",
  textSubtle: "#a8a29e",
  brand: "#ea580c",
  brandDark: "#c2410c",
  brandLight: "#ffedd5",
  brandLighter: "#fff7ed",
  danger: "#b91c1c",
  dangerBg: "#fef2f2",
  success: "#059669",
  successBg: "#d1fae5",
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const difficultyColors: Record<
  "Easy" | "Medium" | "Hard" | "Call a pro",
  { bg: string; fg: string }
> = {
  Easy: { bg: "#d1fae5", fg: "#047857" },
  Medium: { bg: "#fef3c7", fg: "#b45309" },
  Hard: { bg: "#fee2e2", fg: "#b91c1c" },
  "Call a pro": { bg: "#e0e7ff", fg: "#4338ca" },
};

export function formatDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return "—";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hours} hr`;
  return `${hours}h ${mins}m`;
}

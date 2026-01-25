// Keeps a value within the specified inclusive bounds.
export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Returns the target number of visible road lanes for the current viewport.
export const getVisibleRoads = (widthPx: number) => {
  if (widthPx < 420) return 2.2;
  if (widthPx < 560) return 2.6;
  if (widthPx < 720) return 3.2;
  if (widthPx < 900) return 4.2;
  return 5.5;
};

// Formats a numeric multiplier as a fixed two-decimal string.
export const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;

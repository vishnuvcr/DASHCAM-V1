import { lerp } from "./geometry.js";

export function lineXAtY(line, y) {
  if (!line || !Number.isFinite(line.slope) || !Number.isFinite(line.intercept)) return NaN;
  if (Math.abs(line.slope) < 1e-9) return NaN;
  return (y - line.intercept) / line.slope;
}

export function laneCenterAtY(leftLine, rightLine, y) {
  const leftX = lineXAtY(leftLine, y);
  const rightX = lineXAtY(rightLine, y);
  if (!Number.isFinite(leftX) || !Number.isFinite(rightX)) return NaN;
  return (leftX + rightX) / 2;
}

export function laneDrift({
  leftLine,
  rightLine,
  vehicleCenterX,
  referenceY,
  frameWidth
}) {
  const center = laneCenterAtY(leftLine, rightLine, referenceY);
  if (!Number.isFinite(center) || !(frameWidth > 0)) {
    return { valid: false, normalized: 0, warning: false };
  }

  const normalized = (vehicleCenterX - center) / frameWidth;
  return {
    valid: true,
    normalized,
    warning: Math.abs(normalized) >= 0.08
  };
}

export function smoothLaneValue(previous, current, alpha = 0.2) {
  if (!Number.isFinite(previous)) return current;
  return lerp(previous, current, alpha);
}

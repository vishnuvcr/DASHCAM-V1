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
  frameWidth,
  warningThreshold = 0.08
}) {
  const center = laneCenterAtY(leftLine, rightLine, referenceY);
  if (!Number.isFinite(center) || !(frameWidth > 0)) {
    return { valid: false, normalized: 0, warning: false, direction: null, laneCenterX: NaN };
  }

  const normalized = (vehicleCenterX - center) / frameWidth;
  const warning = Math.abs(normalized) >= warningThreshold;
  return {
    valid: true,
    normalized,
    warning,
    direction: warning ? (normalized < 0 ? "LEFT" : "RIGHT") : null,
    laneCenterX: center
  };
}

export function smoothLaneValue(previous, current, alpha = 0.2) {
  if (!Number.isFinite(previous)) return current;
  return lerp(previous, current, alpha);
}

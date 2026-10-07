import { lerp } from "./geometry.js";

export function lineXAtY(line, y) {
  if (!line || !Number.isFinite(line.slope) || !Number.isFinite(line.intercept)) return NaN;
  if (Math.abs(line.slope) < 1e-9) return NaN;
  return line.slope * y + line.intercept;
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
  warningThreshold = 0.08,
  previousNormalized = null,
  deltaSeconds = 0,
  predictionHorizonSeconds = 0.7,
  predictiveThreshold = 0.05
}) {
  const center = laneCenterAtY(leftLine, rightLine, referenceY);
  if (!Number.isFinite(center) || !(frameWidth > 0)) {
    return {
      valid: false,
      normalized: 0,
      driftRate: 0,
      predictedNormalized: 0,
      warning: false,
      direction: null,
      laneCenterX: NaN
    };
  }

  const normalized = (vehicleCenterX - center) / frameWidth;
  const driftRate =
    Number.isFinite(previousNormalized) && deltaSeconds > 0
      ? (normalized - previousNormalized) / deltaSeconds
      : 0;
  const predictedNormalized =
    normalized + driftRate * Math.max(0, predictionHorizonSeconds);

  // Warn either when the vehicle is already near/crossing the boundary or
  // when the current lateral trend predicts crossing it shortly.
  const directWarning = Math.abs(normalized) >= warningThreshold;
  const predictiveWarning =
    Math.abs(predictedNormalized) >= warningThreshold &&
    Math.abs(normalized) >= predictiveThreshold &&
    Math.sign(predictedNormalized) === Math.sign(normalized || predictedNormalized);
  const warning = directWarning || predictiveWarning;

  return {
    valid: true,
    normalized,
    driftRate,
    predictedNormalized,
    warning,
    direction: warning ? (normalized < 0 ? "LEFT" : "RIGHT") : null,
    laneCenterX: center
  };
}

export function smoothLaneValue(previous, current, alpha = 0.2) {
  if (!Number.isFinite(previous)) return current;
  return lerp(previous, current, alpha);
}

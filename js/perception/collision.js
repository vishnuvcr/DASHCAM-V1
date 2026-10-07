import { boxArea, boxCenter } from "./geometry.js";

export function areaExpansionTtc(previousBox, currentBox, deltaSeconds) {
  if (!(deltaSeconds > 0)) return Infinity;

  const previousArea = boxArea(previousBox);
  const currentArea = boxArea(currentBox);

  if (!(previousArea > 0) || !(currentArea > 0) || currentArea <= previousArea) {
    return Infinity;
  }

  const scale = Math.sqrt(currentArea / previousArea);
  const expansionRate = (scale - 1) / deltaSeconds;

  if (!(expansionRate > 0)) return Infinity;
  return 1 / expansionRate;
}

export function collisionWarning(ttcSeconds, thresholdSeconds = 2.0) {
  return Number.isFinite(ttcSeconds) && ttcSeconds > 0 && ttcSeconds <= thresholdSeconds;
}

export function adaptiveTtcThreshold(baseThreshold, visibilityFactor = 1) {
  if (!(baseThreshold > 0)) return 0;
  return baseThreshold * Math.max(1, visibilityFactor);
}

/**
 * FCW lead-target gate.
 *
 * Area expansion alone is not enough: a vehicle crossing the camera can grow
 * quickly while being completely irrelevant to the ego path. This gate keeps
 * only reasonably central, sufficiently large, lower-frame targets and rejects
 * large lateral image motion typical of crossing traffic.
 */
export function isLeadTarget(
  previousBox,
  currentBox,
  {
    frameWidth,
    frameHeight,
    minHeightRatio = 0.06,
    maxCenterOffsetRatio = 0.30,
    minBottomRatio = 0.52,
    maxLateralShiftRatio = 0.075,
    minHeightGrowthRatio = 0.025,
    minBottomAdvanceRatio = 0.002
  } = {}
) {
  if (!(frameWidth > 0) || !(frameHeight > 0)) return false;

  const center = boxCenter(currentBox);
  const height = Math.max(0, currentBox.y2 - currentBox.y1);
  const heightRatio = height / frameHeight;
  const centerOffsetRatio = Math.abs(center.x - frameWidth / 2) / frameWidth;
  const bottomRatio = currentBox.y2 / frameHeight;

  if (heightRatio < minHeightRatio) return false;
  if (centerOffsetRatio > maxCenterOffsetRatio) return false;
  if (bottomRatio < minBottomRatio) return false;

  if (!previousBox) return false;

  const previousCenter = boxCenter(previousBox);
  const lateralShiftRatio = Math.abs(center.x - previousCenter.x) / frameWidth;
  if (lateralShiftRatio > maxLateralShiftRatio) return false;

  const previousHeight = Math.max(0, previousBox.y2 - previousBox.y1);
  const heightGrowthRatio = previousHeight > 0
    ? (height - previousHeight) / previousHeight
    : 0;
  const bottomAdvanceRatio = (currentBox.y2 - previousBox.y2) / frameHeight;

  return (
    heightGrowthRatio >= minHeightGrowthRatio ||
    bottomAdvanceRatio >= minBottomAdvanceRatio
  );
}

import { boxArea } from "./geometry.js";

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

import { distanceFromWidth, boxWidth } from "./geometry.js";

export function estimateVehicleDistance({
  focalLengthPx,
  realVehicleWidthM = 1.8,
  vehicleBox
}) {
  return distanceFromWidth(
    focalLengthPx,
    realVehicleWidthM,
    boxWidth(vehicleBox)
  );
}

export function focalLengthFromCalibration({
  referenceDistanceM,
  realWidthM,
  observedWidthPx
}) {
  if (!(referenceDistanceM > 0) || !(realWidthM > 0) || !(observedWidthPx > 0)) {
    return NaN;
  }
  return (observedWidthPx * referenceDistanceM) / realWidthM;
}

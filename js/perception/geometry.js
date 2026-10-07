export function boxArea(box) {
  const width = Math.max(0, box.x2 - box.x1);
  const height = Math.max(0, box.y2 - box.y1);
  return width * height;
}

export function boxCenter(box) {
  return {
    x: (box.x1 + box.x2) / 2,
    y: (box.y1 + box.y2) / 2
  };
}

export function boxWidth(box) {
  return Math.max(0, box.x2 - box.x1);
}

export function iou(a, b) {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);
  const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (intersection === 0) return 0;
  return intersection / (boxArea(a) + boxArea(b) - intersection);
}

export function distanceFromWidth(focalLengthPx, realWidthM, observedWidthPx) {
  if (!(focalLengthPx > 0) || !(realWidthM > 0) || !(observedWidthPx > 0)) return Infinity;
  return (focalLengthPx * realWidthM) / observedWidthPx;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

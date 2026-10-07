import { laneDrift, smoothLaneValue, lineXAtY } from "./lanes.js";

function fitLineXByY(points) {
  if (!Array.isArray(points) || points.length < 6) return null;

  let sumY = 0;
  let sumX = 0;
  for (const point of points) {
    sumY += point.y;
    sumX += point.x;
  }
  const meanY = sumY / points.length;
  const meanX = sumX / points.length;

  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    const dy = point.y - meanY;
    numerator += dy * (point.x - meanX);
    denominator += dy * dy;
  }
  if (!(denominator > 0)) return null;

  const slope = numerator / denominator;
  const intercept = meanX - slope * meanY;
  const residual = Math.sqrt(
    points.reduce((sum, point) => {
      const error = point.x - (slope * point.y + intercept);
      return sum + error * error;
    }, 0) / points.length
  );

  return {
    slope,
    intercept,
    residual,
    points: points.length
  };
}

function isLanePixel(data, index, brightnessThreshold) {
  const r = data[index];
  const g = data[index + 1];
  const b = data[index + 2];
  const brightness = (r + g + b) / 3;
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const yellow = r > 125 && g > 105 && b < 120 && r > b * 1.2;
  return brightness >= brightnessThreshold && (chroma < 55 || yellow);
}

export function extractLanePoints(imageData, {
  roiTop = 0.42,
  roiBottom = 0.97,
  brightnessThreshold = 128,
  gradientThreshold = 16,
  xStep = 2,
  yStep = 3
} = {}) {
  const { width, height, data } = imageData;
  const points = { left: [], right: [] };
  const startY = Math.max(2, Math.floor(height * roiTop));
  const endY = Math.min(height - 2, Math.floor(height * roiBottom));
  const center = width / 2;

  // Use a per-row adaptive brightness threshold so exposure changes and
  // weather/road shading do not erase white lane paint.
  const rowMean = new Float32Array(height);
  for (let y = startY; y <= endY; y += 1) {
    let sum = 0;
    let count = 0;
    for (let x = 2; x < width - 2; x += 3) {
      const index = (y * width + x) * 4;
      sum += (data[index] + data[index + 1] + data[index + 2]) / 3;
      count += 1;
    }
    rowMean[y] = count ? sum / count : 0;
  }

  for (let y = startY; y <= endY; y += yStep) {
    const adaptiveThreshold = Math.max(
      brightnessThreshold,
      rowMean[y] + 18
    );

    for (let x = 2; x < width - 2; x += xStep) {
      const index = (y * width + x) * 4;
      if (!isLanePixel(data, index, adaptiveThreshold)) continue;

      const leftIndex = (y * width + (x - 2)) * 4;
      const rightIndex = (y * width + (x + 2)) * 4;
      const leftGray = (data[leftIndex] + data[leftIndex + 1] + data[leftIndex + 2]) / 3;
      const rightGray = (data[rightIndex] + data[rightIndex + 1] + data[rightIndex + 2]) / 3;
      if (Math.abs(rightGray - leftGray) < gradientThreshold) continue;

      if (x < center * 0.99) points.left.push({ x, y });
      if (x > center * 1.01) points.right.push({ x, y });
    }
  }

  return points;
}

function validateLine(line, side, width, height, minSlope = 0.08) {
  if (!line || line.residual > width * 0.075) return null;
  if (side === "left" && !(line.slope < -minSlope)) return null;
  if (side === "right" && !(line.slope > minSlope)) return null;

  const bottomX = line.slope * (height * 0.95) + line.intercept;
  const nearHorizonX = line.slope * (height * 0.5) + line.intercept;
  if (side === "left" && !(bottomX < width * 0.62 && nearHorizonX < width * 0.58)) return null;
  if (side === "right" && !(bottomX > width * 0.38 && nearHorizonX > width * 0.42)) return null;

  return line;
}

function validateLanePair(leftLine, rightLine, width, height) {
  if (!leftLine || !rightLine) return null;

  const bottomY = height * 0.94;
  const nearY = height * 0.56;
  const leftBottom = lineXAtY(leftLine, bottomY);
  const rightBottom = lineXAtY(rightLine, bottomY);
  const leftNear = lineXAtY(leftLine, nearY);
  const rightNear = lineXAtY(rightLine, nearY);

  if (![leftBottom, rightBottom, leftNear, rightNear].every(Number.isFinite)) return null;

  const bottomWidth = rightBottom - leftBottom;
  const nearWidth = rightNear - leftNear;
  const bottomCenter = (leftBottom + rightBottom) / 2;
  const nearCenter = (leftNear + rightNear) / 2;

  if (!(bottomWidth > width * 0.28 && bottomWidth < width * 0.95)) return null;
  if (!(nearWidth > width * 0.08 && nearWidth < width * 0.65)) return null;
  if (!(leftBottom > width * 0.01 && leftBottom < width * 0.48)) return null;
  if (!(rightBottom > width * 0.52 && rightBottom < width * 0.99)) return null;
  if (!(leftNear > width * 0.08 && leftNear < width * 0.48)) return null;
  if (!(rightNear > width * 0.52 && rightNear < width * 0.92)) return null;
  if (!(bottomCenter > width * 0.25 && bottomCenter < width * 0.75)) return null;
  if (!(nearCenter > width * 0.25 && nearCenter < width * 0.75)) return null;

  return { leftLine, rightLine };
}

export function detectLaneLines(imageData, options = {}) {
  const points = extractLanePoints(imageData, options);
  const leftRaw = fitLineXByY(points.left);
  const rightRaw = fitLineXByY(points.right);
  const leftLine = validateLine(
    leftRaw,
    "left",
    imageData.width,
    imageData.height,
    options.minSlope ?? 0.08
  );
  const rightLine = validateLine(
    rightRaw,
    "right",
    imageData.width,
    imageData.height,
    options.minSlope ?? 0.08
  );
  const pair = validateLanePair(leftLine, rightLine, imageData.width, imageData.height);

  // Preserve an individually valid boundary when the opposite boundary is
  // temporarily hidden (common during lane changes, glare, or traffic).
  if (pair) {
    return {
      leftLine: pair.leftLine,
      rightLine: pair.rightLine,
      paired: true,
      pointCounts: { left: points.left.length, right: points.right.length }
    };
  }

  if (leftLine && !rightLine) {
    return {
      leftLine,
      rightLine: null,
      paired: false,
      pointCounts: { left: points.left.length, right: points.right.length }
    };
  }

  if (rightLine && !leftLine) {
    return {
      leftLine: null,
      rightLine,
      paired: false,
      pointCounts: { left: points.left.length, right: points.right.length }
    };
  }

  // Two incompatible candidates are more dangerous than one reliable side.
  const best = (leftLine?.points || 0) >= (rightLine?.points || 0) ? leftLine : rightLine;
  return {
    leftLine: best === leftLine ? leftLine : null,
    rightLine: best === rightLine ? rightLine : null,
    paired: false,
    pointCounts: { left: points.left.length, right: points.right.length }
  };
}

export class BrowserLaneDetector {
  constructor({
    width = 320,
    height = 180,
    smoothingAlpha = 0.3,
    referenceY = 0.92,
    expectedLaneWidthRatio = 0.48
  } = {}) {
    this.width = width;
    this.height = height;
    this.smoothingAlpha = smoothingAlpha;
    this.referenceY = referenceY;
    this.canvas = typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(width, height)
      : document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    this.previousLeft = null;
    this.previousRight = null;
    this.leftMissedFrames = 0;
    this.rightMissedFrames = 0;
    this.missedFrames = 0;
    this.previousNormalized = null;
    this.previousTimestampMs = null;
    this.lastState = { leftLine: null, rightLine: null, drift: null, confidence: 0, frameWidth: width, frameHeight: height };
  }

  detect(source, timestampMs = performance.now()) {
    const sourceWidth = source.videoWidth || source.width;
    const sourceHeight = source.videoHeight || source.height;
    if (!(sourceWidth > 0) || !(sourceHeight > 0)) {
      return { leftLine: null, rightLine: null, drift: null, confidence: 0 };
    }

    this.ctx.drawImage(source, 0, 0, this.width, this.height);
    const imageData = this.ctx.getImageData(0, 0, this.width, this.height);
    const result = detectLaneLines(imageData);

    if (result.leftLine || result.rightLine) {
      this.missedFrames = 0;
    } else {
      this.missedFrames += 1;
      if (this.missedFrames > 8) {
        this.previousLeft = null;
        this.previousRight = null;
      }
    }

    if (result.leftLine) {
      this.leftMissedFrames = 0;
      this.previousLeft = this.previousLeft
        ? {
            slope: smoothLaneValue(this.previousLeft.slope, result.leftLine.slope, this.smoothingAlpha),
            intercept: smoothLaneValue(this.previousLeft.intercept, result.leftLine.intercept, this.smoothingAlpha),
            residual: result.leftLine.residual,
            points: result.leftLine.points
          }
        : result.leftLine;
    } else {
      this.leftMissedFrames += 1;
      if (this.leftMissedFrames > 3) this.previousLeft = null;
    }

    if (result.rightLine) {
      this.rightMissedFrames = 0;
      this.previousRight = this.previousRight
        ? {
            slope: smoothLaneValue(this.previousRight.slope, result.rightLine.slope, this.smoothingAlpha),
            intercept: smoothLaneValue(this.previousRight.intercept, result.rightLine.intercept, this.smoothingAlpha),
            residual: result.rightLine.residual,
            points: result.rightLine.points
          }
        : result.rightLine;
    } else {
      this.rightMissedFrames += 1;
      if (this.rightMissedFrames > 3) this.previousRight = null;
    }

    const leftLine = this.previousLeft;
    const rightLine = this.previousRight;
    const referenceY = this.height * this.referenceY;
    let estimatedLaneCenterX = null;

    if (leftLine && !rightLine) {
      const leftX = lineXAtY(leftLine, referenceY);
      estimatedLaneCenterX = Number.isFinite(leftX)
        ? leftX + this.width * this.expectedLaneWidthRatio * 0.5
        : null;
    } else if (rightLine && !leftLine) {
      const rightX = lineXAtY(rightLine, referenceY);
      estimatedLaneCenterX = Number.isFinite(rightX)
        ? rightX - this.width * this.expectedLaneWidthRatio * 0.5
        : null;
    }

    const deltaSeconds =
      this.previousTimestampMs == null
        ? 0
        : Math.max(0, timestampMs - this.previousTimestampMs) / 1000;

    const drift = leftLine || rightLine
      ? laneDrift({
          leftLine,
          rightLine,
          estimatedLaneCenterX,
          vehicleCenterX: this.width / 2,
          referenceY,
          frameWidth: this.width,
          previousNormalized: this.previousNormalized,
          deltaSeconds,
          predictionHorizonSeconds: 0.7,
          predictiveThreshold: 0.045
        })
      : null;

    const leftConfidence = leftLine ? Math.min(1, leftLine.points / 60) : 0;
    const rightConfidence = rightLine ? Math.min(1, rightLine.points / 60) : 0;
    const confidence = leftLine && rightLine
      ? Math.min(leftConfidence, rightConfidence)
      : Math.max(leftConfidence, rightConfidence) * 0.72;

    if (drift?.valid) {
      this.previousNormalized = drift.normalized;
      this.previousTimestampMs = timestampMs;
    } else {
      this.previousNormalized = null;
      this.previousTimestampMs = null;
    }
    this.lastState = {
      leftLine,
      rightLine,
      drift,
      confidence,
      frameWidth: this.width,
      frameHeight: this.height
    };
    return this.lastState;
  }

  reset() {
    this.previousLeft = null;
    this.previousRight = null;
    this.leftMissedFrames = 0;
    this.rightMissedFrames = 0;
    this.missedFrames = 0;
    this.previousNormalized = null;
    this.previousTimestampMs = null;
    this.lastState = {
      leftLine: null,
      rightLine: null,
      drift: null,
      confidence: 0,
      frameWidth: this.width,
      frameHeight: this.height
    };
  }
}

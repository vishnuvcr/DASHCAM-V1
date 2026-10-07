import { laneDrift, smoothLaneValue } from "./lanes.js";

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
  roiTop = 0.45,
  roiBottom = 0.96,
  brightnessThreshold = 155,
  gradientThreshold = 28,
  xStep = 2,
  yStep = 4
} = {}) {
  const { width, height, data } = imageData;
  const points = { left: [], right: [] };
  const startY = Math.max(2, Math.floor(height * roiTop));
  const endY = Math.min(height - 2, Math.floor(height * roiBottom));
  const center = width / 2;

  for (let y = startY; y <= endY; y += yStep) {
    for (let x = 2; x < width - 2; x += xStep) {
      const index = (y * width + x) * 4;
      if (!isLanePixel(data, index, brightnessThreshold)) continue;

      const leftIndex = (y * width + (x - 2)) * 4;
      const rightIndex = (y * width + (x + 2)) * 4;
      const leftGray = (data[leftIndex] + data[leftIndex + 1] + data[leftIndex + 2]) / 3;
      const rightGray = (data[rightIndex] + data[rightIndex + 1] + data[rightIndex + 2]) / 3;
      if (Math.abs(rightGray - leftGray) < gradientThreshold) continue;

      if (x < center * 0.98) points.left.push({ x, y });
      if (x > center * 1.02) points.right.push({ x, y });
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

export function detectLaneLines(imageData, options = {}) {
  const points = extractLanePoints(imageData, options);
  const leftRaw = fitLineXByY(points.left);
  const rightRaw = fitLineXByY(points.right);
  return {
    leftLine: validateLine(leftRaw, "left", imageData.width, imageData.height, options.minSlope ?? 0.08),
    rightLine: validateLine(rightRaw, "right", imageData.width, imageData.height, options.minSlope ?? 0.08),
    pointCounts: { left: points.left.length, right: points.right.length }
  };
}

export class BrowserLaneDetector {
  constructor({
    width = 320,
    height = 180,
    smoothingAlpha = 0.25,
    referenceY = 0.92
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
    this.missedFrames = 0;
    this.lastState = { leftLine: null, rightLine: null, drift: null, confidence: 0, frameWidth: width, frameHeight: height };
  }

  detect(source) {
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
      this.previousLeft = this.previousLeft
        ? {
            slope: smoothLaneValue(this.previousLeft.slope, result.leftLine.slope, this.smoothingAlpha),
            intercept: smoothLaneValue(this.previousLeft.intercept, result.leftLine.intercept, this.smoothingAlpha),
            residual: result.leftLine.residual,
            points: result.leftLine.points
          }
        : result.leftLine;
    }

    if (result.rightLine) {
      this.previousRight = this.previousRight
        ? {
            slope: smoothLaneValue(this.previousRight.slope, result.rightLine.slope, this.smoothingAlpha),
            intercept: smoothLaneValue(this.previousRight.intercept, result.rightLine.intercept, this.smoothingAlpha),
            residual: result.rightLine.residual,
            points: result.rightLine.points
          }
        : result.rightLine;
    }

    const leftLine = this.previousLeft;
    const rightLine = this.previousRight;
    const drift = leftLine && rightLine
      ? laneDrift({
          leftLine,
          rightLine,
          vehicleCenterX: this.width / 2,
          referenceY: this.height * this.referenceY,
          frameWidth: this.width
        })
      : null;

    const leftConfidence = leftLine ? Math.min(1, leftLine.points / 80) : 0;
    const rightConfidence = rightLine ? Math.min(1, rightLine.points / 80) : 0;
    const confidence = Math.min(leftConfidence, rightConfidence);
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
    this.missedFrames = 0;
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

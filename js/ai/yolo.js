import { createSession } from "./runtime.js";
import { canvasToNchw, letterboxCanvas, undoLetterbox } from "./preprocess.js";
import { iou } from "../perception/geometry.js";

export const COCO_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "airplane", "bus", "train", "truck",
  "boat", "traffic light", "fire hydrant", "stop sign", "parking meter", "bench",
  "bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra",
  "giraffe", "backpack", "umbrella", "handbag", "tie", "suitcase", "frisbee",
  "skis", "snowboard", "sports ball", "kite", "baseball bat", "baseball glove",
  "skateboard", "surfboard", "tennis racket", "bottle", "wine glass", "cup",
  "fork", "knife", "spoon", "bowl", "banana", "apple", "sandwich", "orange",
  "broccoli", "carrot", "hot dog", "pizza", "donut", "cake", "chair", "couch",
  "potted plant", "bed", "dining table", "toilet", "tv", "laptop", "mouse",
  "remote", "keyboard", "cell phone", "microwave", "oven", "toaster", "sink",
  "refrigerator", "book", "clock", "vase", "scissors", "teddy bear", "hair drier",
  "toothbrush"
];

const DEFAULT_TARGET_CLASS_IDS = new Set([0, 1, 2, 3, 5, 7]);

function sigmoid(value) {
  return 1 / (1 + Math.exp(-value));
}

function probability(value) {
  return value >= 0 && value <= 1 ? value : sigmoid(value);
}

function nms(detections, threshold) {
  const output = [];
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  while (sorted.length) {
    const current = sorted.shift();
    output.push(current);
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (
        sorted[i].classId === current.classId &&
        iou(sorted[i].box, current.box) >= threshold
      ) {
        sorted.splice(i, 1);
      }
    }
  }
  return output;
}

function clampBox(box, width, height) {
  return {
    x1: Math.max(0, Math.min(width, box.x1)),
    y1: Math.max(0, Math.min(height, box.y1)),
    x2: Math.max(0, Math.min(width, box.x2)),
    y2: Math.max(0, Math.min(height, box.y2))
  };
}

function detectLayout(dims) {
  if (dims.length !== 3 || dims[0] !== 1) {
    throw new Error(`Unsupported YOLO output dimensions: ${dims.join("x")}`);
  }

  const a = dims[1];
  const b = dims[2];

  if (b === 6 || b === 7) return { kind: "nms", count: a, channels: b, transposed: false };
  if (a === 6 || a === 7) return { kind: "nms", count: b, channels: a, transposed: true };

  if (a >= 6 && a <= 512 && b > a) return { kind: "raw", count: b, channels: a, transposed: false };
  if (b >= 6 && b <= 512 && a > b) return { kind: "raw", count: a, channels: b, transposed: true };

  throw new Error(`Unsupported YOLO output shape: ${dims.join("x")}`);
}

function getCell(data, index, channel, count, transposed) {
  return transposed
    ? Number(data[index * count + channel])
    : Number(data[channel * count + index]);
}

export function outputToDetections(output, options) {
  const { data, dims } = output;
  const {
    classes = COCO_CLASSES,
    targetClassIds = DEFAULT_TARGET_CLASS_IDS,
    confidenceThreshold,
    iouThreshold,
    letterbox
  } = options;

  const layout = detectLayout(dims);
  const detections = [];

  for (let i = 0; i < layout.count; i += 1) {
    const cx = getCell(data, i, 0, layout.count, layout.transposed);
    const cy = getCell(data, i, 1, layout.count, layout.transposed);
    const w = getCell(data, i, 2, layout.count, layout.transposed);
    const h = getCell(data, i, 3, layout.count, layout.transposed);

    if (!(w > 0) || !(h > 0)) continue;

    let classId = -1;
    let confidence = 0;

    if (layout.kind === "nms") {
      confidence = probability(getCell(data, i, 4, layout.count, layout.transposed));
      classId = Math.round(getCell(data, i, 5, layout.count, layout.transposed));
    } else {
      const objectnessPresent = layout.channels >= classes.length + 5;
      const classStart = objectnessPresent ? 5 : 4;
      const objectness = objectnessPresent
        ? probability(getCell(data, i, 4, layout.count, layout.transposed))
        : 1;

      const classCount = layout.channels - classStart;
      for (let c = 0; c < classCount; c += 1) {
        const score = probability(
          getCell(data, i, classStart + c, layout.count, layout.transposed)
        ) * objectness;

        if (score > confidence) {
          confidence = score;
          classId = c;
        }
      }
    }

    if (
      classId < 0 ||
      confidence < confidenceThreshold ||
      !classes[classId] ||
      !targetClassIds.has(classId)
    ) {
      continue;
    }

    const restored = undoLetterbox({
      x1: cx - w / 2,
      y1: cy - h / 2,
      x2: cx + w / 2,
      y2: cy + h / 2
    }, letterbox);

    const box = clampBox(restored, letterbox.sourceWidth, letterbox.sourceHeight);
    if (!(box.x2 > box.x1) || !(box.y2 > box.y1)) continue;

    detections.push({
      label: classes[classId],
      classId,
      confidence,
      box
    });
  }

  return nms(detections, iouThreshold);
}

function readMetadataShape(metadata, name) {
  const entry = metadata?.[name];
  if (!entry) return null;
  const dims = entry.dimensions ?? entry.dims ?? null;
  if (!Array.isArray(dims)) return null;
  return dims.map((value) => Number.isFinite(Number(value)) ? Number(value) : String(value));
}

export class YoloOnnxDetector {
  constructor({
    modelUrl = "./models/detector.onnx",
    inputWidth = 640,
    inputHeight = 640,
    classes = COCO_CLASSES,
    targetClassIds = DEFAULT_TARGET_CLASS_IDS,
    confidenceThreshold = 0.35,
    iouThreshold = 0.45
  } = {}) {
    Object.assign(this, {
      modelUrl,
      inputWidth,
      inputHeight,
      classes,
      targetClassIds,
      confidenceThreshold,
      iouThreshold
    });
    this.modelBuffer = null;
    this.modelName = null;
    this.runtime = null;
    this.inputName = null;
    this.outputName = null;
    this.modelInfo = null;
  }

  setModelBuffer(buffer, name = "local-model.onnx") {
    if (!(buffer instanceof ArrayBuffer)) {
      throw new TypeError("Model buffer must be an ArrayBuffer.");
    }
    this.modelBuffer = buffer;
    this.modelName = name;
    this.runtime = null;
    this.modelInfo = null;
    return this;
  }

  clearModelBuffer() {
    this.modelBuffer = null;
    this.modelName = null;
    this.runtime = null;
    this.modelInfo = null;
  }

  async init() {
    const source = this.modelBuffer || this.modelUrl;
    this.runtime = await createSession(source);
    const { session } = this.runtime;

    this.inputName = session.inputNames[0];
    this.outputName = session.outputNames[0];

    const inputDims = readMetadataShape(session.inputMetadata, this.inputName);
    const outputDims = readMetadataShape(session.outputMetadata, this.outputName);

    if (Array.isArray(inputDims) && inputDims.length === 4) {
      const inputWidth = Number(inputDims[3]);
      const inputHeight = Number(inputDims[2]);
      if (Number.isFinite(inputWidth) && Number.isFinite(inputHeight)) {
        if (inputWidth !== this.inputWidth || inputHeight !== this.inputHeight) {
          throw new Error(
            `Model input is ${inputWidth}x${inputHeight}; expected ${this.inputWidth}x${this.inputHeight}.`
          );
        }
      }
    }

    this.modelInfo = {
      name: this.modelName || this.modelUrl,
      runtime: this.runtime.executionProviders[0],
      inputName: this.inputName,
      outputName: this.outputName,
      inputDims,
      outputDims,
      targetClasses: [...this.targetClassIds].map((id) => this.classes[id]).filter(Boolean)
    };

    return this;
  }

  get ready() {
    return Boolean(this.runtime);
  }

  async detect(source) {
    if (!this.runtime) await this.init();

    const meta = letterboxCanvas(source, this.inputWidth, this.inputHeight);
    const ort = this.runtime.ort;
    const tensor = new ort.Tensor(
      "float32",
      canvasToNchw(meta.canvas),
      [1, 3, this.inputHeight, this.inputWidth]
    );

    const result = await this.runtime.session.run({
      [this.inputName]: tensor
    });

    const output = result[this.outputName];
    if (!output) {
      throw new Error("YOLO model returned no configured output tensor.");
    }

    return outputToDetections(output, {
      classes: this.classes,
      targetClassIds: this.targetClassIds,
      confidenceThreshold: this.confidenceThreshold,
      iouThreshold: this.iouThreshold,
      letterbox: meta
    });
  }
}

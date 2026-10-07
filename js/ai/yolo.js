import { createSession } from "./runtime.js";
import { canvasToNchw, letterboxCanvas, undoLetterbox } from "./preprocess.js";
import { iou } from "../perception/geometry.js";

const DEFAULT_CLASSES = ["person", "bicycle", "car", "motorcycle", "bus", "truck"];

function sigmoid(value) { return 1 / (1 + Math.exp(-value)); }

function nms(detections, threshold) {
  const output = [];
  const sorted = [...detections].sort((a, b) => b.confidence - a.confidence);
  while (sorted.length) {
    const current = sorted.shift();
    output.push(current);
    for (let i = sorted.length - 1; i >= 0; i -= 1) {
      if (sorted[i].classId === current.classId && iou(sorted[i].box, current.box) >= threshold) sorted.splice(i, 1);
    }
  }
  return output;
}

function outputToDetections(output, options) {
  const { data, dims } = output;
  const { classes, confidenceThreshold, iouThreshold, letterbox } = options;
  if (dims.length !== 3) throw new Error(`Unsupported YOLO output dimensions: ${dims.join("x")}`);
  const rows = dims[1];
  const values = dims[2];
  const detections = [];

  if (values >= 6 && values <= 7) {
    for (let i = 0; i < rows; i += 1) {
      const o = i * values;
      const confidence = Number(data[o + 4]);
      const classId = Math.round(Number(data[o + 5]));
      if (confidence < confidenceThreshold || !classes[classId]) continue;
      const cx = Number(data[o]), cy = Number(data[o + 1]), w = Number(data[o + 2]), h = Number(data[o + 3]);
      detections.push({ label: classes[classId], classId, confidence, box: undoLetterbox({x1: cx-w/2,y1: cy-h/2,x2: cx+w/2,y2: cy+h/2}, letterbox) });
    }
    return nms(detections, iouThreshold);
  }

  if (dims[1] >= 5 && dims[2] > 0) {
    const channels = dims[1], count = dims[2];
    for (let i = 0; i < count; i += 1) {
      const cx = Number(data[i]), cy = Number(data[count+i]), w = Number(data[count*2+i]), h = Number(data[count*3+i]);
      const objectness = sigmoid(Number(data[count*4+i]));
      let bestClass = -1, bestScore = 0;
      for (let c = 5; c < channels; c += 1) {
        const score = sigmoid(Number(data[count*c+i])) * objectness;
        if (score > bestScore) { bestScore = score; bestClass = c - 5; }
      }
      if (bestScore < confidenceThreshold || !classes[bestClass]) continue;
      detections.push({ label: classes[bestClass], classId: bestClass, confidence: bestScore, box: undoLetterbox({x1: cx-w/2,y1: cy-h/2,x2: cx+w/2,y2: cy+h/2}, letterbox) });
    }
    return nms(detections, iouThreshold);
  }
  throw new Error(`Unsupported YOLO output shape: ${dims.join("x")}`);
}

export class YoloOnnxDetector {
  constructor({ modelUrl = "./models/detector.onnx", inputWidth = 640, inputHeight = 640, classes = DEFAULT_CLASSES, confidenceThreshold = 0.35, iouThreshold = 0.45 } = {}) {
    Object.assign(this, { modelUrl, inputWidth, inputHeight, classes, confidenceThreshold, iouThreshold });
    this.runtime = null; this.inputName = null; this.outputName = null;
  }

  async init() {
    this.runtime = await createSession(this.modelUrl);
    this.inputName = this.runtime.session.inputNames[0];
    this.outputName = this.runtime.session.outputNames[0];
    return this;
  }

  get ready() { return Boolean(this.runtime); }

  async detect(source) {
    if (!this.runtime) await this.init();
    const meta = letterboxCanvas(source, this.inputWidth, this.inputHeight);
    const ort = this.runtime.ort;
    const tensor = new ort.Tensor("float32", canvasToNchw(meta.canvas), [1,3,this.inputHeight,this.inputWidth]);
    const result = await this.runtime.session.run({ [this.inputName]: tensor });
    const output = result[this.outputName];
    if (!output) throw new Error("YOLO model returned no configured output tensor.");
    return outputToDetections(output, { classes:this.classes, confidenceThreshold:this.confidenceThreshold, iouThreshold:this.iouThreshold, letterbox:meta });
  }
}

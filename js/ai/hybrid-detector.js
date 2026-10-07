import { MediaPipeObjectDetector } from "./mediapipe.js";
import { YoloOnnxDetector } from "./yolo.js";

export class HybridDetector {
  constructor(options = {}) {
    this.online = new MediaPipeObjectDetector(options.mediaPipe);
    this.offline = new YoloOnnxDetector(options.yolo);
    this.active = null;
    this.onlineError = null;
  }

  setModelBuffer(buffer, name) {
    this.offline.setModelBuffer(buffer, name);
    return this;
  }

  clearModelBuffer() {
    this.offline.clearModelBuffer();
    return this;
  }

  async init() {
    if (this.active) return this;

    try {
      await this.online.init();
      this.active = this.online;
      return this;
    } catch (error) {
      this.onlineError = error;
      if (!this.offline.modelBuffer) {
        throw new Error(
          `Online MediaPipe initialization failed: ${error.message}. No offline ONNX model is available.`
        );
      }
      await this.offline.init();
      this.active = this.offline;
      return this;
    }
  }

  get ready() {
    return Boolean(this.active?.ready ?? this.active?.readyState);
  }

  get modelInfo() {
    return this.active?.modelInfo || null;
  }

  get lastInferenceMs() {
    return this.active?.lastInferenceMs || 0;
  }

  async detect(source) {
    if (!this.active) await this.init();
    return this.active.detect(source);
  }

  dispose() {
    this.online.dispose();
    this.active = null;
  }
}

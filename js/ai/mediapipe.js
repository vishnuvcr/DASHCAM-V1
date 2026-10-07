export const MEDIAPIPE_VERSION = "0.10.35";
export const MEDIAPIPE_MODEL = "EfficientDet-Lite0 int8 · 320x320 · COCO";

export class MediaPipeObjectDetector {
  constructor({ scoreThreshold = 0.35, maxResults = 20 } = {}) {
    this.scoreThreshold = scoreThreshold;
    this.maxResults = maxResults;
    this.worker = null;
    this.ready = false;
    this.initPromise = null;
    this.pending = new Map();
    this.sequence = 0;
    this.lastTimestamp = 0;
    this.lastInferenceMs = 0;
    this.modelInfo = null;
  }

  async init() {
    if (this.ready) return this;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof Worker === "undefined" || typeof createImageBitmap !== "function") {
        reject(new Error("Browser does not support the MediaPipe worker path."));
        return;
      }

      // MediaPipe Tasks Vision internally uses importScripts() for its WASM
      // runtime. A module Worker rejects importScripts(), so the detector
      // worker must remain a classic Worker even though this controller is ESM.
      const worker = new Worker(
        new URL("./mediapipe-worker.js", import.meta.url),
        { name: "dashcam-mediapipe" }
      );
      this.worker = worker;

      const initId = ++this.sequence;
      const timeout = setTimeout(() => {
        reject(new Error("MediaPipe worker initialization timed out."));
        worker.terminate();
        this.worker = null;
      }, 30000);

      worker.onmessage = (event) => {
        const message = event.data || {};

        if (message.type === "ready") {
          clearTimeout(timeout);
          this.ready = true;
          this.modelInfo = {
            name: MEDIAPIPE_MODEL,
            runtime: message.runtime || `MediaPipe Tasks Vision ${MEDIAPIPE_VERSION} worker`,
            inputDims: [1, 320, 320, 3],
            outputDims: null,
            targetClasses: ["person", "bicycle", "car", "motorcycle", "bus", "truck"]
          };
          resolve(this);
          return;
        }

        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);

        if (message.type === "error") {
          pending.reject(new Error(message.message));
          return;
        }

        this.lastInferenceMs = Number(message.inferenceMs) || 0;
        pending.resolve(message.detections || []);
      };

      worker.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(error?.message || "MediaPipe worker failed."));
      };

      worker.postMessage({
        type: "init",
        id: initId,
        scoreThreshold: this.scoreThreshold,
        maxResults: this.maxResults
      });
    });

    try {
      return await this.initPromise;
    } finally {
      this.initPromise = null;
    }
  }

  async detect(source) {
    if (!this.ready) await this.init();
    if (!this.worker) throw new Error("MediaPipe worker is unavailable.");

    const bitmap = await createImageBitmap(source);
    const id = ++this.sequence;
    this.lastTimestamp = Math.max(
      this.lastTimestamp + 1,
      Math.round(performance.now())
    );

    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(
        { type: "detect", id, bitmap, timestamp: this.lastTimestamp },
        [bitmap]
      );
    });
  }

  get readyState() {
    return this.ready;
  }

  dispose() {
    for (const pending of this.pending.values()) {
      pending.reject(new Error("MediaPipe detector disposed."));
    }
    this.pending.clear();
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.modelInfo = null;
  }
}

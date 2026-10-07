import { YoloOnnxDetector } from "./yolo.js";

let detector = null;

self.onmessage = async (event) => {
  const { type, requestId, modelUrl, frame } = event.data || {};
  try {
    if (type === "init") {
      detector = new YoloOnnxDetector({ modelUrl });
      await detector.init();
      self.postMessage({ type: "ready", requestId });
      return;
    }
    if (type === "detect") {
      if (!detector) throw new Error("Inference worker is not initialized.");
      const detections = await detector.detect(frame);
      self.postMessage({ type: "result", requestId, detections });
      return;
    }
    throw new Error(`Unknown inference message type: ${type}`);
  } catch (error) {
    self.postMessage({ type: "error", requestId, message: error?.message || String(error) });
  }
};

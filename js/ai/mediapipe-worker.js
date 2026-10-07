const MEDIAPIPE_VERSION = "0.10.35";
const VISION_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/vision_bundle.mjs`;
const WASM_URL =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/int8/latest/efficientdet_lite0.tflite";

let detector = null;

const TARGET_CLASSES = [
  "person", "bicycle", "car", "motorcycle", "bus", "truck"
];

function normalizeDetections(result) {
  return (result?.detections || []).map((detection) => {
    const box = detection.boundingBox;
    const category = detection.categories?.[0];
    return {
      label: category?.categoryName || "unknown",
      classId: Number.isFinite(category?.index) ? category.index : -1,
      confidence: Number(category?.score || 0),
      box: {
        x1: box.originX,
        y1: box.originY,
        x2: box.originX + box.width,
        y2: box.originY + box.height
      }
    };
  }).filter((item) =>
    TARGET_CLASSES.includes(item.label) &&
    item.confidence > 0 &&
    item.box.x2 > item.box.x1 &&
    item.box.y2 > item.y1
  );
}

self.onmessage = async (event) => {
  const { type, id, bitmap, timestamp, scoreThreshold = 0.35 } = event.data || {};

  try {
    if (type === "init") {
      const { FilesetResolver, ObjectDetector } = await import(VISION_URL);
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);

      detector = await ObjectDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL },
        runningMode: "VIDEO",
        scoreThreshold,
        maxResults: 20,
        categoryAllowlist: TARGET_CLASSES
      });

      self.postMessage({
        type: "ready",
        id,
        model: "EfficientDet-Lite0 int8",
        runtime: `MediaPipe Tasks Vision ${MEDIAPIPE_VERSION} worker`
      });
      return;
    }

    if (type !== "detect" || !detector || !bitmap) {
      throw new Error("MediaPipe detector is not initialized.");
    }

    const started = performance.now();
    const result = detector.detectForVideo(bitmap, timestamp);
    const inferenceMs = performance.now() - started;
    bitmap.close();

    self.postMessage({
      type: "result",
      id,
      inferenceMs,
      detections: normalizeDetections(result)
    });
  } catch (error) {
    try { bitmap?.close(); } catch {}
    self.postMessage({
      type: "error",
      id,
      message: error?.message || String(error)
    });
  }
};

import assert from "node:assert/strict";
import { calculateLetterbox, undoLetterbox } from "../js/ai/preprocess.js";
import { COCO_CLASSES, outputToDetections } from "../js/ai/yolo.js";

const meta = calculateLetterbox(1280, 720, 640, 640);
assert.equal(meta.scale, 0.5);
assert.equal(meta.width, 640);
assert.equal(meta.height, 360);
assert.equal(meta.dx, 0);
assert.equal(meta.dy, 140);
assert.equal(meta.sourceWidth, 1280);
assert.equal(meta.sourceHeight, 720);

const restored = undoLetterbox({ x1: 100, y1: 190, x2: 300, y2: 290 }, meta);
assert.deepEqual(restored, { x1: 200, y1: 100, x2: 600, y2: 300 });

assert.equal(COCO_CLASSES.length, 80);
assert.equal(COCO_CLASSES[2], "car");
assert.equal(COCO_CLASSES[7], "truck");

{
  const data = new Float32Array([
    320, 320, 160, 120,
    0.05, 0.91, 0, 0, 0, 0, 0, 0
  ]);
  const output = {
    data,
    dims: [1, 8, 1]
  };
  const detections = outputToDetections(output, {
    classes: ["person", "bicycle"],
    targetClassIds: new Set([1]),
    confidenceThreshold: 0.35,
    iouThreshold: 0.45,
    letterbox: {
      sourceWidth: 640,
      sourceHeight: 640,
      scale: 1,
      dx: 0,
      dy: 0
    }
  });
  assert.equal(detections.length, 1);
  assert.equal(detections[0].label, "bicycle");
}

{
  const channels = 84;
  const count = 2;
  const data = new Float32Array(channels * count);
  const set = (channel, index, value) => { data[channel * count + index] = value; };

  set(0, 0, 320); set(1, 0, 320); set(2, 0, 120); set(3, 0, 80);
  set(6, 0, 0.92); // COCO class 2 = car => channel 4 + 2

  set(0, 1, 50); set(1, 1, 50); set(2, 1, 40); set(3, 1, 40);
  set(0, 1, 50);

  const detections = outputToDetections({
    data,
    dims: [1, channels, count]
  }, {
    classes: COCO_CLASSES,
    targetClassIds: new Set([2]),
    confidenceThreshold: 0.35,
    iouThreshold: 0.45,
    letterbox: {
      sourceWidth: 640,
      sourceHeight: 640,
      scale: 1,
      dx: 0,
      dy: 0
    }
  });

  assert.equal(detections.length, 1);
  assert.equal(detections[0].label, "car");
  assert.ok(Math.abs(detections[0].confidence - 0.92) < 1e-6);
}

{
  const channels = 84;
  const count = 1;
  const data = new Float32Array(channels * count);
  data[0] = 320;
  data[1] = 320;
  data[2] = 100;
  data[3] = 100;
  data[4 + 3] = 0.88;

  const detections = outputToDetections({
    data,
    dims: [1, count, channels]
  }, {
    classes: COCO_CLASSES,
    targetClassIds: new Set([3]),
    confidenceThreshold: 0.35,
    iouThreshold: 0.45,
    letterbox: {
      sourceWidth: 640,
      sourceHeight: 640,
      scale: 1,
      dx: 0,
      dy: 0
    }
  });

  assert.equal(detections.length, 1);
  assert.equal(detections[0].label, "motorcycle");
}

console.log("AI_PREPROCESS_TESTS_PASSED");

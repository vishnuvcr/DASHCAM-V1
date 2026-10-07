import assert from "node:assert/strict";
import { calculateLetterbox, undoLetterbox } from "../js/ai/preprocess.js";

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

console.log("AI_PREPROCESS_TESTS_PASSED");

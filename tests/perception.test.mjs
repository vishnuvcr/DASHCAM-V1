import assert from "node:assert/strict";
import { ByteTrackLite } from "../js/perception/tracker.js";
import { areaExpansionTtc, collisionWarning, adaptiveTtcThreshold, isLeadTarget, targetInLaneCorridor, heightExpansionTtc, robustApproachTtc, depthProxy, depthApproaching } from "../js/perception/collision.js";
import { distanceFromWidth } from "../js/perception/geometry.js";
import { estimateVehicleDistance, focalLengthFromCalibration } from "../js/perception/distance.js";
import { laneDrift, laneCenterAtY } from "../js/perception/lanes.js";
import { detectLaneLines } from "../js/perception/lane-detector.js";
import { MockDetector } from "../js/perception/detector.js";
import { PerceptionPipeline } from "../js/perception/pipeline.js";

const box = (x1, y1, x2, y2) => ({ x1, y1, x2, y2 });
const detection = (x, confidence = 0.9, label = "car") => ({
  label,
  confidence,
  box: box(x, 100, x + 100, 200)
});

{
  const tracker = new ByteTrackLite({ matchIoU: 0.25 });
  const first = tracker.update([detection(100)], 0);
  const second = tracker.update([detection(102)], 100);
  assert.equal(first.length, 1);
  assert.equal(second.length, 1);
  assert.equal(second[0].id, first[0].id, "track ID must persist across overlapping frames");
  assert.equal(second[0].missed, 0);
  assert.equal(first[0].confirmed, false, "new tracks should not be displayed before confirmation");
  assert.equal(second[0].confirmed, true, "tracks should confirm after two matching frames");
}

{
  const tracker = new ByteTrackLite({ matchIoU: 0.25 });
  const first = tracker.update([detection(100, 0.9)], 0);
  const recovered = tracker.update([detection(103, 0.3)], 100);
  assert.equal(recovered[0].id, first[0].id, "low-confidence detection should recover an existing track");
  assert.equal(recovered[0].confirmed, true);
}

{
  const tracker = new ByteTrackLite({ maxAge: 2 });
  const first = tracker.update([detection(100)], 0);
  const missing1 = tracker.update([], 100);
  const missing2 = tracker.update([], 200);
  const missing3 = tracker.update([], 300);
  assert.equal(missing1[0].id, first[0].id);
  assert.equal(missing2[0].id, first[0].id);
  assert.equal(missing3.length, 0, "expired track must be removed");
}

{
  const ttc = areaExpansionTtc(box(100, 100, 200, 200), box(90, 90, 210, 210), 0.5);
  assert.ok(ttc > 0 && ttc < 5, "expanding object should produce finite TTC");
  assert.equal(areaExpansionTtc(box(0, 0, 0, 0), box(0, 0, 10, 10), 0.5), Infinity);
  assert.equal(collisionWarning(ttc, 10), true);
  assert.equal(collisionWarning(ttc, 1), false);
  assert.equal(adaptiveTtcThreshold(2, 1.5), 3);
  assert.ok(heightExpansionTtc(box(100, 100, 200, 200), box(95, 90, 205, 210), 0.5) > 0);
  assert.ok(robustApproachTtc(box(100, 100, 200, 200), box(95, 90, 205, 210), 0.5) > 0);
  assert.equal(depthProxy(box(0, 0, 100, 180), 720), 4);
  assert.equal(depthApproaching(box(0, 0, 100, 180), box(0, 0, 100, 190), 720), true);
  assert.equal(depthApproaching(box(0, 0, 100, 180), box(0, 0, 100, 179), 720), false);
}

{
  assert.equal(distanceFromWidth(800, 2, 100), 16);
  assert.equal(estimateVehicleDistance({
    focalLengthPx: 800,
    realVehicleWidthM: 2,
    vehicleBox: box(0, 0, 100, 50)
  }), 16);
  assert.equal(focalLengthFromCalibration({
    referenceDistanceM: 20,
    realWidthM: 2,
    observedWidthPx: 80
  }), 800);
}

{
  const left = { slope: -0.4, intercept: 400 };
  const right = { slope: 0.4, intercept: 600 };
  assert.equal(laneCenterAtY(left, right, 500), 500);
  const centered = laneDrift({
    leftLine: left,
    rightLine: right,
    vehicleCenterX: 500,
    referenceY: 500,
    frameWidth: 1000
  });
  assert.equal(centered.warning, false);
  const drifting = laneDrift({
    leftLine: left,
    rightLine: right,
    vehicleCenterX: 650,
    referenceY: 500,
    frameWidth: 1000
  });
  assert.equal(drifting.warning, true);
  assert.equal(drifting.direction, "RIGHT");
}

{
  const width = 320;
  const height = 180;
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const index = (y * width + x) * 4;
    data[index] = 245;
    data[index + 1] = 245;
    data[index + 2] = 245;
    data[index + 3] = 255;
  };

  for (let y = 82; y < 174; y += 1) {
    const leftX = Math.round(198 - 0.7 * y);
    const rightX = Math.round(122 + 0.7 * y);
    for (let offset = -2; offset <= 2; offset += 1) {
      paint(leftX + offset, y);
      paint(rightX + offset, y);
    }
  }

  const lanes = detectLaneLines({ width, height, data });
  assert.ok(lanes.leftLine, "synthetic left lane should be detected");
  assert.ok(lanes.rightLine, "synthetic right lane should be detected");
  assert.ok(lanes.leftLine.slope < 0);
  assert.ok(lanes.rightLine.slope > 0);
}

{
  const detector = new MockDetector([
    [detection(100, 0.9)],
    [detection(96, 0.9)]
  ]);
  const pipeline = new PerceptionPipeline({ detector, baseTtcThreshold: 2 });
  const a = await pipeline.process({}, 0);
  const b = await pipeline.process({}, 500);
  assert.equal(a.tracks.length, 1);
  assert.equal(b.tracks[0].id, a.tracks[0].id);
  assert.equal(b.detections.length, 1);
}

{
  const detector = new MockDetector([
    [{ label: "car", confidence: 0.95, box: box(580, 300, 700, 440) }],
    [{ label: "car", confidence: 0.95, box: box(550, 260, 730, 470) }],
    [{ label: "car", confidence: 0.95, box: box(500, 210, 780, 500) }],
    [{ label: "car", confidence: 0.95, box: box(430, 150, 850, 560) }]
  ]);
  const pipeline = new PerceptionPipeline({
    detector,
    baseTtcThreshold: 2,
    warningConfirmations: 3
  });
  const source = { videoWidth: 1280, videoHeight: 720 };
  await pipeline.process(source, 0);
  await pipeline.process(source, 500);
  const confirmed = await pipeline.process(source, 1000);
  const result = await pipeline.process(source, 1500);
  assert.equal(confirmed.warnings.length, 0, "FCW must require temporal confirmation");
  assert.equal(result.warnings.length, 1, "confirmed expanding lead object should produce automatic FCW");
  assert.ok(result.warnings[0].ttcSeconds <= 2);
}

console.log("PERCEPTION_TESTS_PASSED");


{
  const previous = box(480, 360, 600, 500);
  const current = box(700, 350, 850, 525);
  assert.equal(
    isLeadTarget(previous, current, { frameWidth: 1280, frameHeight: 720 }),
    false,
    "large lateral motion must not qualify crossing traffic as a lead target"
  );
}

{
  const previous = box(600, 300, 640, 340);
  const current = box(598, 299, 645, 347);
  assert.equal(
    isLeadTarget(previous, current, { frameWidth: 1280, frameHeight: 720 }),
    false,
    "small distant targets must not trigger FCW"
  );
}


{
  const left = { slope: -0.5, intercept: 850 };
  const right = { slope: 0.5, intercept: 350 };
  const inside = box(610, 500, 690, 690);
  const outside = box(760, 500, 840, 690);
  assert.equal(
    targetInLaneCorridor(inside, {
      frameWidth: 1280,
      frameHeight: 720,
      leftLine: left,
      rightLine: right
    }),
    true
  );
  assert.equal(
    targetInLaneCorridor(outside, {
      frameWidth: 1280,
      frameHeight: 720,
      leftLine: left,
      rightLine: right
    }),
    false
  );
}

{
  const detector = new MockDetector([
    [{ label: "car", confidence: 0.95, box: box(500, 300, 780, 500) }],
    [{ label: "car", confidence: 0.95, box: box(500, 250, 780, 550) }],
    [{ label: "car", confidence: 0.95, box: box(480, 180, 800, 680) }],
    [{ label: "car", confidence: 0.95, box: box(400, 80, 880, 720) }]
  ]);
  const pipeline = new PerceptionPipeline({
    detector,
    baseTtcThreshold: 2,
    warningConfirmations: 2
  });
  const source = { videoWidth: 1280, videoHeight: 720 };
  const laneState = {
    frameWidth: 1280,
    frameHeight: 720,
    leftLine: { slope: -0.5, intercept: 850 },
    rightLine: { slope: 0.5, intercept: 350 }
  };
  await pipeline.process(source, 0, laneState);
  const firstApproach = await pipeline.process(source, 500, laneState);
  await pipeline.process(source, 1000, laneState);
  const result = await pipeline.process(source, 1500, laneState);
  assert.equal(firstApproach.warnings.length, 0);
  assert.equal(result.warnings.length, 1);
  assert.ok(result.tracks[0].ttcSeconds <= 2);
  assert.equal(result.tracks[0].laneTarget, true);
}


{
  const width = 320;
  const height = 180;
  const data = new Uint8ClampedArray(width * height * 4);
  const paint = (x, y) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const index = (y * width + x) * 4;
    data[index] = 245;
    data[index + 1] = 245;
    data[index + 2] = 245;
    data[index + 3] = 255;
  };

  for (let y = 82; y < 174; y += 1) {
    const leftX = Math.round(198 - 0.7 * y);
    const rightX = Math.round(122 + 0.7 * y);
    for (let offset = -2; offset <= 2; offset += 1) {
      paint(leftX + offset, y);
      paint(rightX + offset, y);
    }
  }

  const lanes = detectLaneLines({ width, height, data });
  assert.ok(lanes.leftLine && lanes.rightLine, "plausible paired lanes should survive validation");
}
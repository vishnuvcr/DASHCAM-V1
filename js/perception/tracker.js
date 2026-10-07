import { iou } from "./geometry.js";

function cloneBox(box) {
  return { x1: box.x1, y1: box.y1, x2: box.x2, y2: box.y2 };
}

function matchDetections(detections, tracks, threshold) {
  const matches = [];
  const usedTracks = new Set();
  const usedDetections = new Set();

  while (true) {
    let best = null;

    for (let di = 0; di < detections.length; di += 1) {
      if (usedDetections.has(di)) continue;
      for (let ti = 0; ti < tracks.length; ti += 1) {
        if (usedTracks.has(ti)) continue;
        const score = iou(detections[di].box, tracks[ti].box);
        if (score >= threshold && (!best || score > best.score)) {
          best = { di, ti, score };
        }
      }
    }

    if (!best) break;
    usedDetections.add(best.di);
    usedTracks.add(best.ti);
    matches.push(best);
  }

  return {
    matches,
    unmatchedDetections: detections.map((_, i) => i).filter((i) => !usedDetections.has(i)),
    unmatchedTracks: tracks.map((_, i) => i).filter((i) => !usedTracks.has(i))
  };
}

export class ByteTrackLite {
  constructor({
    highConfidence = 0.5,
    lowConfidence = 0.1,
    matchIoU = 0.25,
    maxAge = 20
  } = {}) {
    this.highConfidence = highConfidence;
    this.lowConfidence = lowConfidence;
    this.matchIoU = matchIoU;
    this.maxAge = maxAge;
    this.nextId = 1;
    this.tracks = [];
  }

  update(detections, timestamp = performance.now()) {
    const normalized = detections
      .filter((d) => d?.box && Number.isFinite(d.confidence))
      .map((d) => ({
        ...d,
        box: cloneBox(d.box),
        confidence: Math.max(0, Math.min(1, d.confidence))
      }));

    const high = normalized.filter((d) => d.confidence >= this.highConfidence);
    const low = normalized.filter(
      (d) => d.confidence >= this.lowConfidence && d.confidence < this.highConfidence
    );

    const active = this.tracks.filter((t) => !t.removed);
    const highMatch = matchDetections(high, active, this.matchIoU);

    for (const match of highMatch.matches) {
      const track = active[match.ti];
      track.box = cloneBox(high[match.di].box);
      track.label = high[match.di].label;
      track.confidence = high[match.di].confidence;
      track.hits += 1;
      track.missed = 0;
      track.lastTimestamp = timestamp;
    }

    const unmatchedTracks = highMatch.unmatchedTracks.map((i) => active[i]);
    const lowMatch = matchDetections(low, unmatchedTracks, Math.max(0.15, this.matchIoU * 0.7));

    for (const match of lowMatch.matches) {
      const track = unmatchedTracks[match.ti];
      track.box = cloneBox(low[match.di].box);
      track.label = low[match.di].label;
      track.confidence = low[match.di].confidence;
      track.hits += 1;
      track.missed = 0;
      track.lastTimestamp = timestamp;
    }

    const recoveredIds = new Set(lowMatch.matches.map((m) => unmatchedTracks[m.ti].id));
    for (const track of active) {
      if (recoveredIds.has(track.id)) continue;
      const wasMatchedHigh = highMatch.matches.some((m) => active[m.ti].id === track.id);
      if (!wasMatchedHigh) track.missed += 1;
    }

    const existingDetectionIndexes = new Set([
      ...highMatch.matches.map((m) => m.di),
      ...[]
    ]);

    for (const index of highMatch.unmatchedDetections) {
      const detection = high[index];
      if (!existingDetectionIndexes.has(index)) this.tracks.push(this.#createTrack(detection, timestamp));
    }

    for (const track of this.tracks) {
      if (track.missed > this.maxAge) track.removed = true;
    }

    return this.tracks
      .filter((t) => !t.removed)
      .map((t) => ({
        id: t.id,
        label: t.label,
        confidence: t.confidence,
        box: cloneBox(t.box),
        age: t.age,
        hits: t.hits,
        missed: t.missed,
        timestamp: t.lastTimestamp
      }));
  }

  #createTrack(detection, timestamp) {
    return {
      id: this.nextId++,
      label: detection.label,
      confidence: detection.confidence,
      box: cloneBox(detection.box),
      age: 1,
      hits: 1,
      missed: 0,
      removed: false,
      lastTimestamp: timestamp
    };
  }

  reset() {
    this.tracks = [];
    this.nextId = 1;
  }
}

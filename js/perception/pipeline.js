import { ByteTrackLite } from "./tracker.js";
import { areaExpansionTtc, collisionWarning, adaptiveTtcThreshold } from "./collision.js";

export class PerceptionPipeline {
  constructor({
    detector,
    tracker = new ByteTrackLite(),
    baseTtcThreshold = 2,
    visibilityFactor = 1
  }) {
    if (!detector) throw new TypeError("A detector provider is required.");
    this.detector = detector;
    this.tracker = tracker;
    this.baseTtcThreshold = baseTtcThreshold;
    this.visibilityFactor = visibilityFactor;
    this.previousById = new Map();
  }

  async process(source, timestampMs = performance.now()) {
    const detections = await this.detector.detect(source);
    const tracks = this.tracker.update(detections, timestampMs);
    const warnings = [];

    for (const track of tracks) {
      const previous = this.previousById.get(track.id);
      if (previous) {
        const dt = (timestampMs - previous.timestamp) / 1000;
        const ttc = areaExpansionTtc(previous.box, track.box, dt);
        if (collisionWarning(ttc, adaptiveTtcThreshold(this.baseTtcThreshold, this.visibilityFactor))) {
          warnings.push({
            type: "FCW",
            trackId: track.id,
            ttcSeconds: ttc
          });
        }
        track.ttcSeconds = ttc;
      }
      this.previousById.set(track.id, {
        box: { ...track.box },
        timestamp: timestampMs
      });
    }

    return {
      detections,
      tracks,
      warnings
    };
  }

  reset() {
    this.tracker.reset();
    this.previousById.clear();
  }
}

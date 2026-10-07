import { ByteTrackLite } from "./tracker.js";
import {
  areaExpansionTtc,
  collisionWarning,
  adaptiveTtcThreshold,
  isLeadTarget,
  targetInLaneCorridor
} from "./collision.js";

export class PerceptionPipeline {
  constructor({
    detector,
    tracker = new ByteTrackLite(),
    baseTtcThreshold = 2,
    visibilityFactor = 1,
    warningConfirmations = 3
  }) {
    if (!detector) throw new TypeError("A detector provider is required.");
    this.detector = detector;
    this.tracker = tracker;
    this.baseTtcThreshold = baseTtcThreshold;
    this.visibilityFactor = visibilityFactor;
    this.warningConfirmations = Math.max(1, warningConfirmations);
    this.previousById = new Map();
    this.warningStreakById = new Map();
  }

  async process(source, timestampMs = performance.now(), laneState = null) {
    const detections = await this.detector.detect(source);
    const tracks = this.tracker.update(detections, timestampMs);
    const warnings = [];

    const frameWidth = source?.videoWidth || source?.width || 0;
    const frameHeight = source?.videoHeight || source?.height || 0;
    const threshold = adaptiveTtcThreshold(
      this.baseTtcThreshold,
      this.visibilityFactor
    );
    const activeIds = new Set();

    for (const track of tracks) {
      activeIds.add(track.id);
      const previous = this.previousById.get(track.id);

      if (previous) {
        const dt = (timestampMs - previous.timestamp) / 1000;
        const ttc = areaExpansionTtc(previous.box, track.box, dt);
        track.ttcSeconds = ttc;

        const leadTarget = isLeadTarget(previous.box, track.box, {
          frameWidth,
          frameHeight
        });
        const laneGate = targetInLaneCorridor(track.box, {
          frameWidth,
          frameHeight,
          leftLine: laneState?.leftLine,
          rightLine: laneState?.rightLine
        });
        track.leadTarget = leadTarget;
        track.laneTarget = laneGate !== false;
        track.ttcSeconds = ttc;

        const qualifies = leadTarget && laneGate !== false && collisionWarning(ttc, threshold);
        const streak = qualifies
          ? (this.warningStreakById.get(track.id) || 0) + 1
          : 0;

        this.warningStreakById.set(track.id, streak);

        if (streak >= this.warningConfirmations) {
          warnings.push({
            type: "FCW",
            trackId: track.id,
            ttcSeconds: ttc,
            confidence: track.confidence
          });
        }
      } else {
        track.ttcSeconds = Infinity;
        track.leadTarget = false;
        track.laneTarget = false;
        this.warningStreakById.set(track.id, 0);
      }

      this.previousById.set(track.id, {
        box: { ...track.box },
        timestamp: timestampMs
      });
    }

    for (const id of this.previousById.keys()) {
      if (!activeIds.has(id)) {
        this.previousById.delete(id);
        this.warningStreakById.delete(id);
      }
    }

    return {
      detections,
      tracks: tracks.map((track) => ({ ...track })),
      warnings
    };
  }

  reset() {
    this.tracker.reset();
    this.previousById.clear();
    this.warningStreakById.clear();
  }
}

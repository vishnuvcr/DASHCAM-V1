export class PerformanceGovernor {
  constructor({
    minIntervalMs = 45,
    maxIntervalMs = 700,
    targetLatencyMs = 75,
    alpha = 0.25
  } = {}) {
    this.minIntervalMs = minIntervalMs;
    this.maxIntervalMs = maxIntervalMs;
    this.targetLatencyMs = targetLatencyMs;
    this.alpha = alpha;
    this.reset();
  }

  reset() {
    this.emaLatencyMs = 0;
    this.samples = 0;
    this.lastLatencyMs = 0;
  }

  record(latencyMs) {
    if (!(latencyMs > 0)) return;
    this.lastLatencyMs = latencyMs;
    this.emaLatencyMs = this.samples === 0
      ? latencyMs
      : this.emaLatencyMs + (latencyMs - this.emaLatencyMs) * this.alpha;
    this.samples += 1;
  }

  get latencyMs() {
    return this.emaLatencyMs || this.lastLatencyMs || 0;
  }

  get inferenceFps() {
    return this.latencyMs > 0 ? 1000 / this.latencyMs : 0;
  }

  nextDelayMs() {
    if (!(this.latencyMs > 0)) return this.minIntervalMs;
    const loadFactor = this.latencyMs / this.targetLatencyMs;
    const delay = loadFactor <= 1
      ? this.minIntervalMs
      : this.latencyMs * 0.15;
    return Math.round(
      Math.max(this.minIntervalMs, Math.min(this.maxIntervalMs, delay))
    );
  }

  get recommendation() {
    if (this.latencyMs >= 250) return "USE 320 MODEL";
    if (this.latencyMs >= 140) return "USE 320/416 MODEL";
    if (this.latencyMs >= 90) return "BALANCED MODEL";
    return "REAL-TIME";
  }
}

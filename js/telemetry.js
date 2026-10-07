export class Telemetry {
  constructor({ fpsEl, modeEl, eventCountEl }) {
    this.fpsEl = fpsEl;
    this.modeEl = modeEl;
    this.eventCountEl = eventCountEl;
    this.lastFrameAt = performance.now();
    this.frameCount = 0;
    this.fps = 0;
  }

  setMode(mode) {
    this.modeEl.textContent = String(mode).toUpperCase();
  }

  setEventCount(count) {
    this.eventCountEl.textContent = String(count);
  }

  frame() {
    this.frameCount += 1;
    const now = performance.now();
    if (now - this.lastFrameAt >= 1000) {
      this.fps = this.frameCount;
      this.frameCount = 0;
      this.lastFrameAt = now;
      this.fpsEl.textContent = String(this.fps);
    }
  }
}

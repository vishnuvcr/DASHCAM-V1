export class DetectorProvider {
  async detect(_source) {
    throw new Error("DetectorProvider.detect() must be implemented by a browser inference provider.");
  }
}

export class MockDetector extends DetectorProvider {
  constructor(sequence = []) {
    super();
    this.sequence = sequence;
    this.index = 0;
  }

  async detect(_source) {
    if (this.sequence.length === 0) return [];
    const result = this.sequence[Math.min(this.index++, this.sequence.length - 1)];
    return result.map((item) => ({ ...item, box: { ...item.box } }));
  }

  reset() {
    this.index = 0;
  }
}

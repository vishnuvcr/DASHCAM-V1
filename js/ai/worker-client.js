export class InferenceWorkerClient {
  constructor(workerUrl = "./js/ai/inference-worker.js") {
    this.worker = new Worker(workerUrl, { type: "module" });
    this.nextId = 1;
    this.pending = new Map();
    this.worker.addEventListener("message", (event) => this.#handle(event.data));
  }

  #handle(message) {
    const pending = this.pending.get(message.requestId);
    if (!pending) return;
    this.pending.delete(message.requestId);
    if (message.type === "error") pending.reject(new Error(message.message));
    else pending.resolve(message);
  }

  #request(message) {
    const requestId = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker.postMessage({ ...message, requestId });
    });
  }

  init(modelUrl = "./models/detector.onnx") {
    return this.#request({ type: "init", modelUrl });
  }

  detect(frame) {
    return this.#request({ type: "detect", frame });
  }

  terminate() {
    for (const pending of this.pending.values()) pending.reject(new Error("Inference worker terminated."));
    this.pending.clear();
    this.worker.terminate();
  }
}

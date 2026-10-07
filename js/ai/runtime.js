export async function createOnnxRuntime() {
  const candidates = [];
  if (globalThis.navigator?.gpu) {
    try {
      const webgpu = await import("https://esm.sh/onnxruntime-web/webgpu");
      candidates.push({ ort: webgpu, executionProviders: ["webgpu"] });
    } catch (error) { console.warn("WebGPU ONNX runtime unavailable:", error); }
  }
  try {
    const wasm = await import("https://esm.sh/onnxruntime-web");
    candidates.push({ ort: wasm, executionProviders: ["wasm"] });
  } catch (error) { console.warn("WASM ONNX runtime unavailable:", error); }
  if (!candidates.length) throw new Error("No browser ONNX runtime is available.");
  return candidates;
}

export async function createSession(modelUrl) {
  const runtimes = await createOnnxRuntime();
  let lastError;
  for (const runtime of runtimes) {
    try {
      const session = await runtime.ort.InferenceSession.create(modelUrl, {
        executionProviders: runtime.executionProviders,
        graphOptimizationLevel: "all"
      });
      return { ...runtime, session };
    } catch (error) {
      lastError = error;
      console.warn("ONNX session creation failed:", error);
    }
  }
  throw lastError || new Error("Unable to create ONNX session.");
}

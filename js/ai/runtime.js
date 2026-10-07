async function loadLocalRuntime() {
  try {
    const webgpu = await import("../../vendor/onnxruntime-web/webgpu.js");
    return { ort: webgpu, executionProviders: ["webgpu"] };
  } catch (error) { console.warn("Local WebGPU runtime unavailable:", error); }
  try {
    const wasm = await import("../../vendor/onnxruntime-web/ort-web.js");
    return { ort: wasm, executionProviders: ["wasm"] };
  } catch (error) { console.warn("Local WASM runtime unavailable:", error); }
  return null;
}

export async function createOnnxRuntime({ allowNetworkFallback = true } = {}) {
  const local = await loadLocalRuntime();
  if (local) return [local];
  if (!allowNetworkFallback) throw new Error("Local ONNX Runtime Web assets are unavailable.");

  const candidates = [];
  if (globalThis.navigator?.gpu) {
    try {
      const webgpu = await import("https://esm.sh/onnxruntime-web/webgpu");
      candidates.push({ ort: webgpu, executionProviders: ["webgpu"] });
    } catch (error) { console.warn("Network WebGPU runtime unavailable:", error); }
  }
  try {
    const wasm = await import("https://esm.sh/onnxruntime-web");
    candidates.push({ ort: wasm, executionProviders: ["wasm"] });
  } catch (error) { console.warn("Network WASM runtime unavailable:", error); }
  if (!candidates.length) throw new Error("No browser ONNX runtime is available.");
  return candidates;
}

export async function createSession(modelUrl, options = {}) {
  const runtimes = await createOnnxRuntime(options);
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

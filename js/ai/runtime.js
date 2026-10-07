export const ONNX_RUNTIME_WEB_VERSION = "1.30.0";

async function loadLocalRuntime() {
  try {
    const webgpu = await import("../../vendor/onnxruntime-web/webgpu.js");
    return { ort: webgpu, executionProviders: ["webgpu"] };
  } catch (error) {
    console.warn("Local WebGPU runtime unavailable:", error);
  }

  try {
    const wasm = await import("../../vendor/onnxruntime-web/ort-web.js");
    return { ort: wasm, executionProviders: ["wasm"] };
  } catch (error) {
    console.warn("Local WASM runtime unavailable:", error);
  }

  return null;
}

export async function createOnnxRuntime({ allowNetworkFallback = true } = {}) {
  const local = await loadLocalRuntime();
  if (local) return [local];

  if (!allowNetworkFallback) {
    throw new Error(
      "Local ONNX Runtime Web assets are unavailable. Add the vendored runtime for offline AI."
    );
  }

  const candidates = [];

  if (globalThis.navigator?.gpu) {
    try {
      const webgpu = await import(
        `https://esm.sh/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/webgpu`
      );
      candidates.push({
        ort: webgpu,
        executionProviders: ["webgpu"]
      });
    } catch (error) {
      console.warn("Network WebGPU runtime unavailable:", error);
    }
  }

  try {
    const wasm = await import(
      `https://esm.sh/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/wasm`
    );
    candidates.push({
      ort: wasm,
      executionProviders: ["wasm"]
    });
  } catch (error) {
    console.warn("Network WASM runtime unavailable:", error);
  }

  if (!candidates.length) {
    throw new Error("No browser ONNX Runtime Web provider is available.");
  }

  return candidates;
}

export async function createSession(modelSource, options = {}) {
  const runtimes = await createOnnxRuntime(options);
  let lastError;

  for (const runtime of runtimes) {
    try {
      const session = await runtime.ort.InferenceSession.create(modelSource, {
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

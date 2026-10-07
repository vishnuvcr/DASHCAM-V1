export const ONNX_RUNTIME_WEB_VERSION = "1.30.0";
const ORT_CDN_BASE =
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/`;

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

function configureWasmRuntime(ort) {
  if (ort?.env?.wasm) {
    ort.env.wasm.wasmPaths = ORT_CDN_BASE;
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = false;
  }
}

async function loadBrowserWasmRuntime() {
  const wasm = await import(
    `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/ort.wasm.min.mjs`
  );
  configureWasmRuntime(wasm);
  return {
    ort: wasm,
    executionProviders: ["wasm"]
  };
}

async function loadBrowserWebGpuRuntime() {
  const webgpu = await import(
    `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/ort.webgpu.min.mjs`
  );
  configureWasmRuntime(webgpu);
  return {
    ort: webgpu,
    executionProviders: ["webgpu"]
  };
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

  // Prefer the browser-native WASM ESM build. It is the broadest mobile fallback.
  try {
    candidates.push(await loadBrowserWasmRuntime());
  } catch (error) {
    console.warn("Network WASM browser runtime unavailable:", error);
  }

  // Try WebGPU second. It can be faster on supported Chromium devices.
  if (globalThis.navigator?.gpu) {
    try {
      candidates.push(await loadBrowserWebGpuRuntime());
    } catch (error) {
      console.warn("Network WebGPU browser runtime unavailable:", error);
    }
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
      console.warn(
        `ONNX session creation failed for ${runtime.executionProviders.join(",")}:`,
        error
      );
    }
  }

  throw lastError || new Error("Unable to create ONNX session.");
}

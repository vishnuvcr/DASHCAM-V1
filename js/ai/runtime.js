export const ONNX_RUNTIME_WEB_VERSION = "1.30.0";
const ORT_CDN_BASE =
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/`;
const ORT_WASM_SCRIPT = `${ORT_CDN_BASE}ort.wasm.min.js`;
const ORT_WEBGPU_SCRIPT = `${ORT_CDN_BASE}ort.webgpu.min.js`;

let browserRuntimePromises = new Map();

async function loadLocalRuntime() {
  try {
    const webgpu = await import("../../vendor/onnxruntime-web/webgpu.js");
    return {
      ort: webgpu,
      executionProviders: ["webgpu"],
      kind: "webgpu"
    };
  } catch (error) {
    console.warn("Local WebGPU runtime unavailable:", error);
  }

  try {
    const wasm = await import("../../vendor/onnxruntime-web/ort-web.js");
    return {
      ort: wasm,
      executionProviders: ["wasm"],
      kind: "wasm"
    };
  } catch (error) {
    console.warn("Local WASM runtime unavailable:", error);
  }

  return null;
}

function configureWasmRuntime(ort) {
  if (ort?.env?.wasm) {
    ort.env.wasm.wasmPaths = ORT_CDN_BASE;
    // Keep single-threaded WASM for GitHub Pages compatibility. The browser
    // can still use ORT's proxy worker to keep heavy CPU work off the UI thread.
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.proxy = true;
  }
}

function configureWebGpuRuntime(ort) {
  if (ort?.env?.webgpu) {
    ort.env.webgpu.powerPreference = "high-performance";
  }
}

function loadBrowserScriptRuntime(kind) {
  const existing = globalThis.ort?.InferenceSession;
  if (existing) return Promise.resolve(globalThis.ort);

  if (browserRuntimePromises.has(kind)) {
    return browserRuntimePromises.get(kind);
  }

  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("Browser ONNX Runtime requires a document context.")
    );
  }

  const scriptUrl = kind === "webgpu" ? ORT_WEBGPU_SCRIPT : ORT_WASM_SCRIPT;
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = scriptUrl;
    script.async = true;
    script.dataset.dashcamOrt = kind;
    script.onload = () => {
      if (globalThis.ort?.InferenceSession) {
        resolve(globalThis.ort);
      } else {
        reject(
          new Error(
            `ONNX Runtime Web ${kind} script loaded but did not expose the browser runtime.`
          )
        );
      }
    };
    script.onerror = () => {
      reject(new Error(`Failed to load ONNX Runtime Web ${kind} browser script.`));
    };
    document.head.appendChild(script);
  });

  browserRuntimePromises.set(kind, promise);
  return promise;
}

async function loadBrowserWebGpuRuntime() {
  const ort = await loadBrowserScriptRuntime("webgpu");
  configureWebGpuRuntime(ort);
  return {
    ort,
    executionProviders: ["webgpu"],
    kind: "webgpu"
  };
}

async function loadBrowserWasmRuntime() {
  const ort = await loadBrowserScriptRuntime("wasm");
  configureWasmRuntime(ort);
  return {
    ort,
    executionProviders: ["wasm"],
    kind: "wasm"
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

  if (globalThis.navigator?.gpu) {
    try {
      candidates.push(await loadBrowserWebGpuRuntime());
    } catch (error) {
      console.warn("Network WebGPU browser runtime unavailable:", error);
    }
  }

  try {
    candidates.push(await loadBrowserWasmRuntime());
  } catch (error) {
    console.warn("Network WASM browser runtime unavailable:", error);
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
      const sessionOptions = {
        executionProviders: runtime.executionProviders,
        graphOptimizationLevel: "all"
      };

      if (runtime.kind === "webgpu") {
        sessionOptions.enableGraphCapture = true;
      }

      const session = await runtime.ort.InferenceSession.create(
        modelSource,
        sessionOptions
      );

      return { ...runtime, session };
    } catch (error) {
      console.warn(
        `ONNX session creation failed for ${runtime.executionProviders.join(",")}:`,
        error
      );

      // Graph capture is an optimization, not a correctness dependency.
      // Retry the same WebGPU provider without it before falling back to WASM.
      if (runtime.kind === "webgpu") {
        try {
          const session = await runtime.ort.InferenceSession.create(modelSource, {
            executionProviders: runtime.executionProviders,
            graphOptimizationLevel: "all"
          });
          return { ...runtime, session };
        } catch (retryError) {
          lastError = retryError;
          continue;
        }
      }

      lastError = error;
    }
  }

  throw lastError || new Error("Unable to create ONNX session.");
}

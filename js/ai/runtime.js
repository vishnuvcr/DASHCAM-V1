export const ONNX_RUNTIME_WEB_VERSION = "1.30.0";
const ORT_CDN_BASE =
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/`;
const ORT_BROWSER_SCRIPT =
  `${ORT_CDN_BASE}ort.wasm.min.js`;

let browserRuntimePromise = null;

async function loadLocalRuntime() {
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

function loadBrowserScriptRuntime() {
  if (globalThis.ort?.InferenceSession) {
    return Promise.resolve(globalThis.ort);
  }

  if (browserRuntimePromise) {
    return browserRuntimePromise;
  }

  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("Browser ONNX Runtime requires a document context.")
    );
  }

  browserRuntimePromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = ORT_BROWSER_SCRIPT;
    script.async = true;
    script.dataset.dashcamOrt = "wasm";
    script.onload = () => {
      if (globalThis.ort?.InferenceSession) {
        resolve(globalThis.ort);
      } else {
        reject(
          new Error(
            "ONNX Runtime Web script loaded but did not expose the browser runtime."
          )
        );
      }
    };
    script.onerror = () => {
      reject(new Error("Failed to load ONNX Runtime Web browser script."));
    };
    document.head.appendChild(script);
  });

  return browserRuntimePromise;
}

async function loadBrowserWasmRuntime() {
  const ort = await loadBrowserScriptRuntime();
  configureWasmRuntime(ort);
  return {
    ort,
    executionProviders: ["wasm"]
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

  try {
    return [await loadBrowserWasmRuntime()];
  } catch (error) {
    console.warn("Network WASM browser runtime unavailable:", error);
    throw error;
  }
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

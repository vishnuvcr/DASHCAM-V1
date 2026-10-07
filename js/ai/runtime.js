export const ONNX_RUNTIME_WEB_VERSION = "1.30.0";
const ORT_CDN_BASE =
  `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ONNX_RUNTIME_WEB_VERSION}/dist/`;
const ORT_WEBGPU_SCRIPT = `${ORT_CDN_BASE}ort.webgpu.min.js`;
const ORT_WEBGL_SCRIPT = `${ORT_CDN_BASE}ort.webgl.min.js`;
const ORT_WASM_SCRIPT = `${ORT_CDN_BASE}ort.wasm.min.js`;

let browserRuntimePromise = null;

async function loadLocalRuntime() {
  // Local bundles are intentionally attempted only once. A partially loaded
  // global ORT bundle must never be mixed with another execution-provider
  // bundle on the same page.
  try {
    const webgpu = await import("../../vendor/onnxruntime-web/webgpu.js");
    return { ort: webgpu, executionProviders: ["webgpu"], kind: "webgpu" };
  } catch (error) {
    console.warn("Local WebGPU runtime unavailable:", error);
  }

  try {
    const webgl = await import("../../vendor/onnxruntime-web/webgl.js");
    return { ort: webgl, executionProviders: ["webgl"], kind: "webgl" };
  } catch (error) {
    console.warn("Local WebGL runtime unavailable:", error);
  }

  try {
    const wasm = await import("../../vendor/onnxruntime-web/ort-web.js");
    return { ort: wasm, executionProviders: ["wasm"], kind: "wasm" };
  } catch (error) {
    console.warn("Local WASM runtime unavailable:", error);
  }

  return null;
}

function hasWebGL2() {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function configureWasmRuntime(ort) {
  if (ort?.env?.wasm) {
    ort.env.wasm.wasmPaths = ORT_CDN_BASE;
    // GitHub Pages is not cross-origin isolated. Disable the proxy here because
    // Brave Android has shown duplicate initWasm() failures when the proxy
    // worker and the page initialize the same WASM backend concurrently.
    ort.env.wasm.proxy = false;
    ort.env.wasm.numThreads = 1;
  }
}

function configureWebGpuRuntime(ort) {
  if (ort?.env?.webgpu) {
    ort.env.webgpu.powerPreference = "high-performance";
  }
}

function loadBrowserScriptRuntime(kind) {
  if (browserRuntimePromise) return browserRuntimePromise;

  if (typeof document === "undefined") {
    return Promise.reject(
      new Error("Browser ONNX Runtime requires a document context.")
    );
  }

  const scriptUrl =
    kind === "webgpu"
      ? ORT_WEBGPU_SCRIPT
      : kind === "webgl"
        ? ORT_WEBGL_SCRIPT
        : ORT_WASM_SCRIPT;

  browserRuntimePromise = new Promise((resolve, reject) => {
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
      reject(
        new Error(`Failed to load ONNX Runtime Web ${kind} browser script.`)
      );
    };

    document.head.appendChild(script);
  });

  return browserRuntimePromise;
}

async function loadBrowserWebGpuRuntime() {
  const ort = await loadBrowserScriptRuntime("webgpu");
  configureWebGpuRuntime(ort);
  return { ort, executionProviders: ["webgpu"], kind: "webgpu" };
}

async function loadBrowserWebGlRuntime() {
  const ort = await loadBrowserScriptRuntime("webgl");
  return { ort, executionProviders: ["webgl"], kind: "webgl" };
}

async function loadBrowserWasmRuntime() {
  const ort = await loadBrowserScriptRuntime("wasm");
  configureWasmRuntime(ort);
  return { ort, executionProviders: ["wasm"], kind: "wasm" };
}

export async function createOnnxRuntime({ allowNetworkFallback = true } = {}) {
  if (browserRuntimePromise) {
    // A previous provider was already selected for this page. Reuse that
    // provider instead of loading a second ORT bundle.
    const ort = await browserRuntimePromise;
    const kind = ort.__dashcamRuntimeKind;
    if (!kind) throw new Error("Browser ONNX Runtime provider state is unavailable.");
    if (kind === "webgpu") return [{ ort, executionProviders: ["webgpu"], kind }];
    if (kind === "webgl") return [{ ort, executionProviders: ["webgl"], kind }];
    return [{ ort, executionProviders: ["wasm"], kind: "wasm" }];
  }

  const local = await loadLocalRuntime();
  if (local) return [local];

  if (!allowNetworkFallback) {
    throw new Error(
      "Local ONNX Runtime Web assets are unavailable. Add the vendored runtime for offline AI."
    );
  }

  if (globalThis.navigator?.gpu) {
    try {
      const runtime = await loadBrowserWebGpuRuntime();
      runtime.ort.__dashcamRuntimeKind = "webgpu";
      return [runtime];
    } catch (error) {
      console.warn("Network WebGPU browser runtime unavailable:", error);
      browserRuntimePromise = null;
    }
  }

  if (hasWebGL2()) {
    try {
      const runtime = await loadBrowserWebGlRuntime();
      runtime.ort.__dashcamRuntimeKind = "webgl";
      return [runtime];
    } catch (error) {
      console.warn("Network WebGL browser runtime unavailable:", error);
      browserRuntimePromise = null;
    }
  }

  try {
    const runtime = await loadBrowserWasmRuntime();
    runtime.ort.__dashcamRuntimeKind = "wasm";
    return [runtime];
  } catch (error) {
    browserRuntimePromise = null;
    console.warn("Network WASM browser runtime unavailable:", error);
    throw new Error(
      `No browser ONNX Runtime backend is available. Last error: ${error.message}`
    );
  }
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

      // Graph capture is intentionally disabled. The detector supplies ordinary
      // ONNX Tensor objects to session.run(); graph capture requires external
      // buffers for captured inputs/outputs and causes Android inference to fail.
      const session = await runtime.ort.InferenceSession.create(
        modelSource,
        sessionOptions
      );

      return { ...runtime, session };
    } catch (error) {
      lastError = error;
      console.warn(
        `ONNX session creation failed for ${runtime.executionProviders.join(",")}:`,
        error
      );

      if (runtime.kind === "webgpu") {
        try {
          const session = await runtime.ort.InferenceSession.create(modelSource, {
            executionProviders: runtime.executionProviders,
            graphOptimizationLevel: "all"
          });
          return { ...runtime, session };
        } catch (retryError) {
          lastError = retryError;
        }
      }
    }
  }

  throw lastError || new Error("Unable to create ONNX session.");
}

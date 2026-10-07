# Changelog

## [0.4.4] - 2026-10-07

### Fixed
- Replaced the failing ONNX Runtime Web ESM network loader with the browser-compatible `ort.wasm.min.js` script bundle.
- Load the runtime through a standard browser script element so Brave Android does not execute the incompatible ESM/unenv path.
- Keep the matching 1.30.0 WASM asset path and single-threaded execution for mobile compatibility.
- Added a regression test that prevents the broken `.mjs` runtime route from returning.

### Notes
- This specifically addresses the still-observed Brave Android error: `[unenv] module.require is not implemented yet`.
- The runtime remains network-backed until ONNX Runtime Web assets are vendored locally.
- FCW still requires a compatible YOLO ONNX model and an active video stream.

## [0.4.3] - 2026-10-07

### Fixed
- Replaced the failing `esm.sh` ONNX Runtime Web WASM fallback with the official browser-native ONNX Runtime Web ESM distribution.
- Configured the matching ONNX Runtime Web 1.30.0 WASM asset path explicitly.
- Prefer single-threaded WASM on mobile for compatibility and predictable memory use.
- WebGPU remains an optional second provider on supported Chromium devices.

### Notes
- This fixes the observed Brave Android error: `module.require is not implemented yet`.
- The runtime remains network-backed until the same ONNX Runtime Web browser assets are vendored locally.
- FCW still requires a compatible YOLO ONNX model and an active video stream.

## [0.4.2] - 2026-10-07

### Fixed
- Loading an ONNX model now immediately initializes the browser FCW engine instead of waiting for camera/replay inference.
- Restored local models are initialized automatically at application startup.
- UI now reports explicit FCW READY or FCW initialization failure states.
- Model initialization metadata is recorded in the append-only event log.

### Notes
- FCW READY means the ONNX inference engine is initialized; actual FCW warnings require an active camera/replay stream and a tracked target whose TTC crosses the warning threshold.
- Fully offline FCW still requires local ONNX Runtime Web assets in addition to the persisted model.

## [0.4.1] - 2026-10-07

### Added
- Persistent local ONNX model storage in IndexedDB.
- Automatic restoration of the previously loaded model on startup.
- Explicit Remove Stored Model control.
- 64 MB browser-side model-size guard.
- Service-worker cache version bumped to force the latest app shell.

## [0.4.0] - 2026-10-07

### Added
- Pinned ONNX Runtime Web network fallback to 1.30.0.
- Local ONNX model file loading from the browser UI.
- YOLOv8-compatible COCO 80-class decoding with target filtering for person, bicycle, car, motorcycle, bus, and truck.
- Support for common YOLO raw output layouts: `[1,84,N]` and `[1,N,84]`, plus common NMS-style outputs.
- Model input-dimension validation and runtime/model diagnostics.
- Synthetic decoder regression coverage for COCO class mapping and both raw output layouts.

### Notes
- A third-party YOLOv8 model file is not bundled automatically because its redistribution license must be reviewed before commercial distribution.
- Load a compatible local ONNX model through the UI for offline model testing.

## [0.3.1] - 2026-10-07

### Fixed
- FCW HUD activation now uses only thresholded collision warnings from the PerceptionPipeline.

## [0.3.0] - 2026-10-07

### Added
- Automatic browser-side LDW from lane marking detection.
- Automatic FCW pipeline integration using tracked-object TTC.
- Lane line overlay and lane-drift direction feedback.
- Mobile-safe overlay coordinate mapping.
- Automatic warning transition logging.

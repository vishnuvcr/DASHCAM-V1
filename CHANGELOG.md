# Changelog

## [0.7.0] - 2026-10-07

### Fixed
- Require two matching frames before a detected object is rendered as a stable track.
- Require confirmed tracks before FCW qualification.
- Reduce stale tracks by lowering tracker max age from 20 to 12 inference cycles.
- Raise the default YOLO confidence threshold from 0.45 to 0.55 to reduce false-positive vehicle/person boxes.
- Reject geometrically implausible lane pairs before LDW/FCW lane gating, reducing false lane warnings from bright structures and roadside edges.

### Tests
- Added track-confirmation regression coverage.
- Added YOLO threshold regression coverage.
- Added plausible lane-pair validation coverage.

### Notes
- This tuning favors stability over maximum recall on mobile browser inference.
- FCW/LDW remain non-safety-certified prototype functions.

## [0.6.0] - 2026-10-07

### Fixed
- Corrected lane-line evaluation to use the fitted `x = slope*y + intercept` representation.
- Scaled lane geometry from the detector's 320x180 analysis frame into the actual video frame before LDW/FCW use.
- Added a lane-corridor gate to FCW when reliable lane lines are available, rejecting objects outside the current driving corridor.
- Preserved TTC and lead/lane target state on returned tracks for HUD diagnostics.
- Added per-track TTC display to the detection overlay.

### Tests
- Added non-unit-slope lane regression coverage.
- Added lane-corridor inclusion/exclusion coverage.
- Added FCW integration coverage with lane geometry.

### Notes
- FCW falls back to the central lead-target gate when lane lines are unavailable.
- Monocular TTC remains an engineering estimate and is not safety-certified.

## [0.5.0] - 2026-10-07

### Fixed
- Fixed the ADAS overlay disappearing immediately after drawing because the canvas bitmap was being resized on every animation frame.
- Added lead-target gating for FCW so crossing traffic and peripheral objects are rejected using frame position, target size, lateral image motion, and approach cues.
- Added temporal FCW confirmation to reduce one-frame and short-lived false warnings.
- Raised the default YOLO target confidence threshold from 0.35 to 0.45.
- Added support for YOLO exports that return normalized 0..1 box coordinates.
- Added live detection count feedback to the HUD message.

### Tests
- Added regression coverage for the canvas resize bug.
- Added FCW tests for crossing traffic, distant targets, and temporal confirmation.
- Added normalized YOLO coordinate decoding coverage.

### Notes
- FCW remains an ADAS prototype and is not safety-certified.
- Distance/TTC is still monocular image-based estimation; accurate production FCW requires camera calibration, ego-motion, depth/velocity estimation, and extensive real-world validation.

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

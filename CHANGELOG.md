# Changelog

## [0.10.2] - 2026-10-07

### Fixed
- Added a WebGL fallback for Android/Brave devices where WebGPU is unavailable and WASM initialization is unstable.
- Disabled the ONNX Runtime WASM proxy worker on the affected GitHub Pages path to avoid duplicate `initWasm()` initialization.
- Ensured only one browser ONNX Runtime provider bundle is loaded per page.
- Added runtime fallback diagnostics and regression coverage.

### Notes
- WebGL is a compatibility fallback, not a replacement for WebGPU.
- If WebGPU is unavailable and WebGL is supported, object detection can run without entering the problematic WASM initialization path.
- A lightweight 320/416 model remains the next performance optimization.

## [0.10.1] - 2026-10-07

### Fixed
- Prevented concurrent ONNX Runtime initialization, which could trigger `multiple calls to initWasm()` on mobile browsers.
- Prevented WebGPU and WASM browser bundles from being loaded as simultaneous runtime candidates sharing the same global `ort` object.
- Added regression coverage for runtime initialization serialization.

### Notes
- This is a stability hotfix for browser runtime initialization; it does not by itself make a 640x640 CPU model real-time.
- FCW/LDW remain a monocular ADAS prototype and are not safety-certified.

## [0.10.0] - 2026-10-07

### Changed
- Added an adaptive inference governor that measures actual ONNX latency and automatically schedules detector work at a sustainable cadence instead of polling a slow model every 100 ms.
- Added live AI inference rate and model recommendation diagnostics to the HUD.
- Preserved independent 20 Hz lane processing so LDW remains responsive while detector inference is busy.
- Fixed lane detection to retain a single valid boundary when the opposite line is temporarily unavailable.
- Added per-side lane-track expiry so stale boundaries do not suppress lane-departure detection during lane changes.
- Added fast/balanced/quality model profile guidance for 320, 416, and 640 input sizes.

### Tests
- Added adaptive performance governor coverage.
- Added single-boundary lane detection coverage.
- Independent CI tests remain mandatory before merge.

### Notes
- Adaptive scheduling improves responsiveness but cannot make an intrinsically slow 640x640 CPU model produce high detection FPS.
- A lightweight 320/416 ONNX detector is still the preferred mobile configuration.
- FCW/LDW remain a monocular ADAS prototype and are not safety-certified.

## [0.9.0] - 2026-10-07

### Changed
- Prefer browser WebGPU inference when available, with WASM fallback for incompatible devices.
- Enable ONNX Runtime Web's WASM proxy worker for better UI responsiveness.
- Accept compatible ONNX model input sizes instead of enforcing 640x640, enabling lighter 320/416 models.
- Run lane perception independently from the slower object detector so LDW remains responsive even when AI inference is busy.
- Add adaptive lane-line brightness detection, single-boundary lane-center estimation, and predictive lane-departure detection.
- Expose per-inference latency in the HUD.

### Tests
- Added WebGPU/runtime regression checks.
- Added model-input adaptation regression coverage.
- Added predictive lane-departure regression coverage.

### Notes
- WebGPU availability and performance vary by device/browser.
- A 640x640 YOLO model on CPU WASM can still be too slow for real-time use on lower-end phones; a 320/416 lightweight model is recommended for the next field test.
- FCW/LDW remain a monocular ADAS prototype and are not safety-certified.

## [0.8.1] - 2026-10-07

### Fixed
- Capture concrete ONNX Runtime Web output tensor dimensions after inference so the HUD reports the actual model output shape instead of "shape unknown" on runtimes that omit static metadata.

### Tests
- Added regression coverage for the runtime-output diagnostic path.

### Notes
- This is a diagnostic-only refinement; FCW/LDW behavior and thresholds are unchanged.

## [0.8.0] - 2026-10-07

### Fixed
- Replaced single-frame area-expansion TTC with a robust median of area- and height-expansion TTC measurements over recent track history.
- Added a monocular depth-proxy approach check so FCW requires the apparent target depth to be consistently decreasing.
- Added TTC/approach diagnostics to detection labels.
- Added LDW confidence gating and three-frame warning confirmation to suppress transient false lane warnings.

### Tests
- Added robust TTC and depth-proxy regression coverage.
- CI execution is required before merge.
- Added browser regression coverage for multi-frame LDW confirmation.

### Notes
- The depth proxy is intentionally unitless and does not claim real-world meters without camera calibration.
- FCW remains a monocular ADAS prototype and is not safety-certified.

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

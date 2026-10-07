# Changelog

## [0.4.1] - 2026-10-07

### Added
- Persistent local ONNX model storage in IndexedDB.
- Automatic restoration of the previously loaded model on startup.
- Explicit Remove Stored Model control.
- 64 MB browser-side model-size guard.
- Service-worker cache version bumped to force the latest app shell.

### Notes
- A compatible model must still be loaded once before automatic FCW can operate.
- The stored model can then be reused without re-downloading it.
- Fully offline AI inference also requires a local ONNX Runtime Web provider.

## [0.4.0] - 2026-10-07

### Added
- Pinned ONNX Runtime Web network fallback to 1.30.0.
- Local ONNX model file loading from the browser UI.
- YOLOv8-compatible COCO 80-class decoding with target filtering for person, bicycle, car, motorcycle, bus, and truck.
- Support for common YOLO raw output layouts: `[1,84,N]` and `[1,N,84]`, plus common NMS-style outputs.
- Model input-dimension validation and runtime/model diagnostics.
- Synthetic decoder regression coverage for COCO class mapping and both raw output layouts.

### Changed
- FCW inference now uses a model contract aligned with standard YOLOv8n COCO output rather than a six-class placeholder.
- Service-worker cache version updated to 0.4.0.

### Notes
- A third-party YOLOv8 model file is not bundled automatically because its redistribution license must be reviewed before commercial distribution.
- Load a compatible local ONNX model through the UI for offline model testing.
- Fully offline AI still requires vendoring the ONNX Runtime Web JS/WASM/WebGPU assets under `vendor/onnxruntime-web/`.

## [0.3.1] - 2026-10-07

### Fixed
- FCW HUD activation now uses only thresholded collision warnings from the PerceptionPipeline, preventing early warnings for TTC values above the configured safety threshold.

## [0.3.0] - 2026-10-07

### Added
- Automatic browser-side LDW from lane marking detection on camera or local replay.
- Automatic FCW pipeline integration using tracked-object TTC.
- Lane line overlay and lane-drift direction feedback.
- Mobile-safe overlay coordinate mapping for object-fit camera rendering.
- Automatic warning event transitions in append-only telemetry storage.
- Lane detection regression coverage and automatic FCW pipeline regression coverage.

### Changed
- App now uses the shared PerceptionPipeline instead of duplicating FCW/TTC logic.
- Service worker cache updated to 0.3.0 and includes the lane detector module.
- Simulation controls are explicitly labeled as diagnostics rather than real ADAS inputs.
- The release remains a browser prototype and is not safety-certified.

### Notes
- Automatic FCW remains unavailable until a compatible ONNX detector model is installed.
- Automatic LDW does not require the object detector model, but its lane-marking heuristic must be validated against representative road/weather conditions.
- Fully offline AI inference still requires bundling a validated model and local ONNX Runtime Web assets.

## [0.2.0] - 2026-10-07

### Added
- Browser ONNX detector integration with WebGPU/WASM runtime selection.
- YOLO-compatible preprocessing, postprocessing, NMS, and letterbox coordinate restoration.
- Browser AI worker bridge for future off-main-thread inference.
- Model manifest and validated model integration contract.
- AI preprocessing regression tests and browser module syntax checks.
- Graceful AI-unavailable behavior so camera/replay remains usable without a model.

### Notes
- The repository does not include the detector ONNX binary yet.
- Local ONNX Runtime Web assets are preferred when vendored; network fallback remains available until runtime assets are bundled.
- Real-world ADAS safety validation is not implied by this release.

## [0.1.0] - 2026-10-07

### Added
- Browser-only runtime baseline.
- Responsive HUD shell.
- Camera and local-video input abstraction.
- IndexedDB event storage.
- Offline service-worker shell.
- Initial automated browser test suite.

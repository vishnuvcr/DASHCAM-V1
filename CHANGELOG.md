# Changelog

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

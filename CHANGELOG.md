# Changelog

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

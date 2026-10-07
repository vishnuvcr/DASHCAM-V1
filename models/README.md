# Browser model contract

DASHCAM-V1 accepts a local ONNX detector model through the **Load Model** control or from `models/detector.onnx`.

The first validated target is a YOLOv8n-compatible COCO detector with:

- Input: `[1,3,640,640]`, RGB, normalized 0..1.
- Raw output: commonly `[1,84,8400]` or `[1,8400,84]`.
- Target classes: person, bicycle, car, motorcycle, bus, truck.
- Confidence threshold: 0.35.
- IoU threshold: 0.45.

The detector now validates the model input dimensions and exposes runtime/model metadata in the browser.

## Model provenance

The repository does **not** silently redistribute a third-party YOLOv8n weight file. Ultralytics YOLOv8 materials are published under AGPL-3.0, so teams distributing the model should review the applicable license obligations before shipping it with this project. citeturn460469search0turn844788search3

For local testing, select a compatible ONNX file with **Load Model**. A future release may add a separately versioned, explicitly licensed model artifact once redistribution terms are settled.

## Offline requirement

The application can run from a local model file, but fully offline AI also requires the ONNX Runtime Web JavaScript/WASM/WebGPU assets to be vendored under `vendor/onnxruntime-web/`. The runtime loader is pinned to ONNX Runtime Web 1.30.0 and uses network fallback until those local assets are present. ONNX Runtime Web is MIT licensed. citeturn177892search0turn177892search1

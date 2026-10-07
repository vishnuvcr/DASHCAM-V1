# Browser model contract

DASHCAM-V1 expects a detector model executable by ONNX Runtime Web.

Recommended deployment target: a small YOLO detection model in ONNX format, preferably 640x640 for the first implementation. The repository intentionally does not commit a large model binary.

Place a validated model at `models/detector.onnx` and update `models/manifest.json`.

The model must be tested against representative dashcam frames before production use.

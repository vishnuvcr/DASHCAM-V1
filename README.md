# DASHCAM-V1

Browser-only, offline-first ADAS dashcam software.

## Runtime

- HTML5 / CSS3 / Vanilla JavaScript
- Browser camera APIs
- Web Workers
- Canvas / OffscreenCanvas
- IndexedDB
- Service Worker / Cache API
- Web Audio API
- Browser-compatible ONNX inference as the AI layer

## Design goals

DASHCAM-V1 is intended to run directly from GitHub Pages on desktop and mobile browsers without Python, Flask, a local server, or dedicated vehicle hardware.

Advanced perception modules are added incrementally and must preserve the browser-only runtime boundary.

## First milestone

The initial implementation establishes:

1. Responsive HUD shell
2. Camera/video input abstraction
3. Local persistent telemetry/event storage
4. Offline application shell
5. Runtime state model
6. Automated browser-oriented tests
7. Versioning and changelog

## Safety

This project is an open-source engineering/education platform. It is not safety-certified automotive equipment and must not be used as the sole basis for driving decisions.

## License

License to be finalized before public release.

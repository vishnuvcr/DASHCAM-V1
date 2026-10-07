import { MediaController } from "./camera.js";
import { Telemetry } from "./telemetry.js";
import { addEvent, countEvents } from "./storage.js";
import { ByteTrackLite } from "./perception/tracker.js";
import { areaExpansionTtc, collisionWarning } from "./perception/collision.js";
import { YoloOnnxDetector } from "./ai/yolo.js";

const $ = (id) => document.getElementById(id);

const elements = {
  video: $("camera"), overlay: $("overlay"), runtime: $("runtime-status"),
  fps: $("fps"), mode: $("mode"), eventCount: $("event-count"), message: $("message"),
  fcw: $("warning-fcw"), ldw: $("warning-ldw"), start: $("start-camera"),
  stop: $("stop-camera"), file: $("video-file"), testFcw: $("test-fcw"),
  testLdw: $("test-ldw"), clear: $("clear-warnings")
};

const media = new MediaController(elements.video);
const telemetry = new Telemetry({ fpsEl: elements.fps, modeEl: elements.mode, eventCountEl: elements.eventCount });
const tracker = new ByteTrackLite();
const detector = new YoloOnnxDetector();
let previousById = new Map();
let inferenceTimer = null;
let inferenceBusy = false;
let aiReady = false;

function setStatus(state, label) {
  elements.runtime.dataset.state = state;
  elements.runtime.textContent = label;
}

function setMessage(message) { elements.message.textContent = message; }

function clearWarnings() {
  elements.fcw.classList.remove("active");
  elements.ldw.classList.remove("active");
}

async function refreshEventCount() { telemetry.setEventCount(await countEvents()); }

async function record(type, payload = {}) {
  await addEvent(type, payload);
  await refreshEventCount();
}

function drawTracks(tracks) {
  const ctx = elements.overlay.getContext("2d");
  const ratio = window.devicePixelRatio || 1;
  const rect = elements.video.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const sx = (rect.width * ratio) / (elements.video.videoWidth || rect.width);
  const sy = (rect.height * ratio) / (elements.video.videoHeight || rect.height);
  ctx.clearRect(0, 0, elements.overlay.width, elements.overlay.height);
  ctx.lineWidth = 2 * ratio;
  ctx.font = `600 ${12 * ratio}px ui-monospace`;
  for (const track of tracks) {
    const b = track.box;
    const x = b.x1 * sx, y = b.y1 * sy, w = (b.x2 - b.x1) * sx, h = (b.y2 - b.y1) * sy;
    ctx.strokeStyle = "#00f0ff";
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = "#00f0ff";
    ctx.fillText(`#${track.id} ${track.label} ${Math.round(track.confidence * 100)}%`, x, Math.max(14 * ratio, y - 4 * ratio));
  }
}

async function runInference() {
  if (inferenceBusy || !elements.video.videoWidth || media.mode === "standby") return;
  inferenceBusy = true;
  try {
    if (!aiReady) {
      await detector.init();
      aiReady = true;
      setMessage("Browser AI detector ready.");
      await record("AI_READY");
    }
    const detections = await detector.detect(elements.video);
    const now = performance.now();
    const tracks = tracker.update(detections, now);
    const warnings = [];

    for (const track of tracks) {
      const previous = previousById.get(track.id);
      if (previous) {
        const dt = (now - previous.timestamp) / 1000;
        const ttc = areaExpansionTtc(previous.box, track.box, dt);
        track.ttcSeconds = ttc;
        if (collisionWarning(ttc, 2)) warnings.push({ type: "FCW", trackId: track.id, ttcSeconds: ttc });
      }
      previousById.set(track.id, { box: { ...track.box }, timestamp: now });
    }

    drawTracks(tracks);
    elements.fcw.classList.toggle("active", warnings.length > 0);
  } catch (error) {
    if (aiReady) {
      aiReady = false;
      setMessage(`AI inference stopped: ${error.message}`);
      await record("AI_ERROR", { message: error.message });
    } else {
      setMessage("AI model is not installed yet. Camera/replay remains available.");
    }
  } finally {
    inferenceBusy = false;
  }
}

function startInferenceLoop() {
  if (inferenceTimer) clearInterval(inferenceTimer);
  inferenceTimer = setInterval(runInference, 100);
}

function stopInferenceLoop() {
  if (inferenceTimer) clearInterval(inferenceTimer);
  inferenceTimer = null;
  tracker.reset();
  previousById.clear();
  drawTracks([]);
}

async function start() {
  try {
    await media.startCamera();
    telemetry.setMode("camera");
    setStatus("running", "RUNNING");
    setMessage("Live camera active. Initializing browser AI when a model is available.");
    await record("SESSION_STARTED");
    startInferenceLoop();
  } catch (error) {
    setStatus("idle", "ERROR");
    setMessage(error.message || "Unable to start camera.");
  }
}

elements.start.addEventListener("click", start);

elements.stop.addEventListener("click", async () => {
  media.stop();
  stopInferenceLoop();
  telemetry.setMode("standby");
  setStatus("idle", "READY");
  setMessage("Input stopped.");
  await record("SESSION_STOPPED");
});

elements.file.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await media.loadFile(file);
    telemetry.setMode("video");
    setStatus("running", "REPLAY");
    setMessage("Local video replay active. Initializing browser AI when a model is available.");
    await record("VIDEO_REPLAY_STARTED");
    startInferenceLoop();
  } catch (error) {
    setMessage(error.message || "Unable to load video.");
  } finally {
    event.target.value = "";
  }
});

elements.testFcw.addEventListener("click", async () => {
  clearWarnings();
  elements.fcw.classList.add("active");
  await record("FCW_TEST");
});

elements.testLdw.addEventListener("click", async () => {
  clearWarnings();
  elements.ldw.classList.add("active");
  await record("LDW_TEST");
});

elements.clear.addEventListener("click", clearWarnings);

function resizeOverlay() {
  const rect = elements.video.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const ratio = window.devicePixelRatio || 1;
  elements.overlay.width = Math.round(rect.width * ratio);
  elements.overlay.height = Math.round(rect.height * ratio);
}

function renderLoop() {
  resizeOverlay();
  telemetry.frame();
  requestAnimationFrame(renderLoop);
}

async function init() {
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("./sw.js"); }
    catch (error) { console.warn("Service worker registration failed:", error); }
  }
  if (!window.isSecureContext) {
    setMessage("Camera access usually requires HTTPS. GitHub Pages supplies HTTPS.");
  } else if (!media.supportsCamera) {
    setMessage("Camera API unavailable. Local video replay remains available.");
  }
  await refreshEventCount();
  renderLoop();
}

init();

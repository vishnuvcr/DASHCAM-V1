import { MediaController } from "./camera.js";
import { Telemetry } from "./telemetry.js";
import { addEvent, countEvents, saveModel, loadModel, deleteModel } from "./storage.js";
import { ByteTrackLite } from "./perception/tracker.js";
import { PerceptionPipeline } from "./perception/pipeline.js";
import { BrowserLaneDetector } from "./perception/lane-detector.js";
import { YoloOnnxDetector } from "./ai/yolo.js";

const $ = (id) => document.getElementById(id);

const elements = {
  video: $("camera"), overlay: $("overlay"), runtime: $("runtime-status"),
  fps: $("fps"), mode: $("mode"), eventCount: $("event-count"), message: $("message"),
  fcw: $("warning-fcw"), ldw: $("warning-ldw"), start: $("start-camera"),
  stop: $("stop-camera"), file: $("video-file"), model: $("model-file"), forgetModel: $("forget-model"), testFcw: $("test-fcw"),
  testLdw: $("test-ldw"), clear: $("clear-warnings")
};

const media = new MediaController(elements.video);
const telemetry = new Telemetry({ fpsEl: elements.fps, modeEl: elements.mode, eventCountEl: elements.eventCount });
const detector = new YoloOnnxDetector();
const pipeline = new PerceptionPipeline({
  detector,
  tracker: new ByteTrackLite(),
  baseTtcThreshold: 2
});
const laneDetector = new BrowserLaneDetector();

let inferenceTimer = null;
let inferenceBusy = false;
let aiReady = false;
let aiUnavailable = false;
let lastLaneRunMs = 0;
let fcwActive = false;
let ldwActive = false;

function setStatus(state, label) {
  elements.runtime.dataset.state = state;
  elements.runtime.textContent = label;
}

function setMessage(message) { elements.message.textContent = message; }

function clearWarnings() {
  elements.fcw.classList.remove("active");
  elements.ldw.classList.remove("active");
  elements.fcw.textContent = "FCW";
  elements.ldw.textContent = "LDW";
  fcwActive = false;
  ldwActive = false;
}

async function refreshEventCount() {
  telemetry.setEventCount(await countEvents());
}

async function record(type, payload = {}) {
  await addEvent(type, payload);
  await refreshEventCount();
}

async function restoreStoredModel() {
  try {
    const stored = await loadModel();
    if (!stored?.data) return false;

    detector.setModelBuffer(stored.data, stored.name);
    aiReady = false;
    aiUnavailable = false;

    const sizeMb = (stored.sizeBytes / 1024 / 1024).toFixed(1);
    setMessage(`Stored model restored: ${stored.name} (${sizeMb} MB). It is available offline.`);
    return true;
  } catch (error) {
    console.warn("Stored model restore failed:", error);
    await record("AI_MODEL_RESTORE_ERROR", { message: error.message });
    return false;
  }
}

function getVideoTransform() {
  const rect = elements.video.getBoundingClientRect();
  const sourceWidth = elements.video.videoWidth;
  const sourceHeight = elements.video.videoHeight;
  if (!(rect.width > 0) || !(rect.height > 0) || !(sourceWidth > 0) || !(sourceHeight > 0)) return null;

  const fit = getComputedStyle(elements.video).objectFit;
  let scaleX = rect.width / sourceWidth;
  let scaleY = rect.height / sourceHeight;

  if (fit === "cover" || fit === "contain") {
    const scale = fit === "cover" ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    scaleX = scale;
    scaleY = scale;
  }

  const renderedWidth = sourceWidth * scaleX;
  const renderedHeight = sourceHeight * scaleY;
  return {
    scaleX,
    scaleY,
    offsetX: (rect.width - renderedWidth) / 2,
    offsetY: (rect.height - renderedHeight) / 2
  };
}

function mapSourcePoint(x, y, transform) {
  return {
    x: x * transform.scaleX + transform.offsetX,
    y: y * transform.scaleY + transform.offsetY
  };
}

function drawLine(ctx, line, frameWidth, frameHeight, transform) {
  if (!line) return;
  const y1 = frameHeight * 0.45;
  const y2 = frameHeight * 0.97;
  const p1 = mapSourcePoint(
    line.slope * y1 + line.intercept,
    y1,
    transform
  );
  const p2 = mapSourcePoint(
    line.slope * y2 + line.intercept,
    y2,
    transform
  );
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
}

function drawOverlay(tracks, lanes) {
  const rect = elements.video.getBoundingClientRect();
  const transform = getVideoTransform();
  if (!transform) return;

  const ratio = window.devicePixelRatio || 1;
  const ctx = elements.overlay.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, rect.width, rect.height);
  ctx.lineWidth = 2;
  ctx.font = "600 12px ui-monospace";
  ctx.textBaseline = "alphabetic";

  for (const track of tracks) {
    const b = track.box;
    const topLeft = mapSourcePoint(b.x1, b.y1, transform);
    const bottomRight = mapSourcePoint(b.x2, b.y2, transform);
    const width = bottomRight.x - topLeft.x;
    const height = bottomRight.y - topLeft.y;
    ctx.strokeStyle = "#00f0ff";
    ctx.strokeRect(topLeft.x, topLeft.y, width, height);
    ctx.fillStyle = "#00f0ff";
    ctx.fillText(
      `#${track.id} ${track.label} ${Math.round(track.confidence * 100)}%`,
      topLeft.x,
      Math.max(14, topLeft.y - 4)
    );
  }

  if (lanes?.leftLine || lanes?.rightLine) {
    ctx.beginPath();
    drawLine(ctx, lanes.leftLine, lanes.frameWidth, lanes.frameHeight, transform);
    drawLine(ctx, lanes.rightLine, lanes.frameWidth, lanes.frameHeight, transform);
    ctx.strokeStyle = "#ff9d2e";
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  if (lanes?.drift?.valid) {
    const y = lanes.frameHeight * 0.92;
    const centerX = lanes.drift.laneCenterX;
    const vehicleX = lanes.frameWidth / 2;
    const lanePoint = mapSourcePoint(centerX, y, transform);
    const vehiclePoint = mapSourcePoint(vehicleX, y, transform);
    ctx.beginPath();
    ctx.moveTo(lanePoint.x, lanePoint.y);
    ctx.lineTo(vehiclePoint.x, vehiclePoint.y);
    ctx.strokeStyle = lanes.drift.warning ? "#ff375f" : "#00f0ff";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}


function describeModel() {
  if (!detector.modelInfo) return "MODEL: not initialized";
  const info = detector.modelInfo;
  return `MODEL: ${info.name} · ${info.runtime} · ${info.outputDims?.join("x") || "shape unknown"}`;
}


function setAutoWarningState(type, active, payload = {}) {
  if (type === "FCW") {
    elements.fcw.classList.toggle("active", active);
    if (payload.ttcSeconds != null) {
      elements.fcw.textContent = `FCW ${payload.ttcSeconds.toFixed(1)}s`;
    } else {
      elements.fcw.textContent = "FCW";
    }
    fcwActive = active;
    return;
  }

  elements.ldw.classList.toggle("active", active);
  elements.ldw.textContent = active && payload.direction ? `LDW ${payload.direction}` : "LDW";
  ldwActive = active;
}

async function updateAutomaticWarnings(tracks, lanes, warnings = []) {
  const fcw = warnings
    .map((warning) => ({
      trackId: warning.trackId,
      ttcSeconds: warning.ttcSeconds
    }))
    .filter((item) => Number.isFinite(item.ttcSeconds))
    .sort((a, b) => a.ttcSeconds - b.ttcSeconds)[0];

  const nextFcw = Boolean(fcw && fcw.ttcSeconds > 0);
  if (nextFcw !== fcwActive) {
    setAutoWarningState("FCW", nextFcw, fcw || {});
    await record(nextFcw ? "FCW_AUTO_START" : "FCW_AUTO_CLEAR", fcw || {});
  } else if (nextFcw) {
    setAutoWarningState("FCW", true, fcw);
  }

  const nextLdw = Boolean(lanes?.drift?.warning);
  if (nextLdw !== ldwActive) {
    setAutoWarningState("LDW", nextLdw, lanes?.drift || {});
    await record(
      nextLdw ? "LDW_AUTO_START" : "LDW_AUTO_CLEAR",
      lanes?.drift || {}
    );
  }
}

async function runPerception() {
  if (inferenceBusy || !elements.video.videoWidth || media.mode === "standby") return;
  inferenceBusy = true;
  try {
    const now = performance.now();
    let lanes = null;

    if (now - lastLaneRunMs >= 200) {
      lanes = laneDetector.detect(elements.video);
      lastLaneRunMs = now;
    }

    if (!aiReady && !aiUnavailable) {
      try {
        await detector.init();
        aiReady = true;
        setMessage("Browser AI detector ready. Automatic FCW is active; automatic LDW is active.");
        await record("AI_READY");
      } catch (error) {
        aiUnavailable = true;
        setMessage("AI model is not installed yet. Automatic LDW remains available; camera/replay remains available.");
        await record("AI_UNAVAILABLE", { message: error.message });
      }
    }

    let tracks = [];
    let warnings = [];
    if (aiReady) {
      const result = await pipeline.process(elements.video, now);
      tracks = result.tracks;
      warnings = result.warnings;
    }

    const laneState = lanes || laneDetector.lastState || null;
    drawOverlay(tracks, laneState);
    await updateAutomaticWarnings(tracks, laneState, warnings);

    if (aiReady && detector.modelInfo) {
      const target = detector.modelInfo.targetClasses.join(", ");
      setMessage(`${describeModel()} · targets: ${target}`);
    }
  } catch (error) {
    aiReady = false;
    aiUnavailable = true;
    setMessage(`Perception error: ${error.message}`);
    await record("PERCEPTION_ERROR", { message: error.message });
  } finally {
    inferenceBusy = false;
  }
}

function startInferenceLoop() {
  if (inferenceTimer) clearInterval(inferenceTimer);
  inferenceTimer = setInterval(runPerception, 100);
}

function stopInferenceLoop() {
  if (inferenceTimer) clearInterval(inferenceTimer);
  inferenceTimer = null;
  pipeline.reset();
  laneDetector.reset();
  lastLaneRunMs = 0;
  drawOverlay([], null);
}

async function start() {
  try {
    await media.startCamera();
    telemetry.setMode("camera");
    setStatus("running", "RUNNING");
    setMessage("Live camera active. Automatic LDW starts immediately; automatic FCW starts when the AI model is available.");
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
  clearWarnings();
  await record("SESSION_STOPPED");
});


elements.model.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const buffer = await file.arrayBuffer();
    detector.setModelBuffer(buffer, file.name);
    await saveModel(buffer, {
      name: file.name,
      sizeBytes: file.size,
      type: file.type || "application/octet-stream"
    });
    pipeline.reset();
    clearWarnings();
    aiReady = false;
    aiUnavailable = false;
    setStatus("running", media.mode === "standby" ? "READY" : "RUNNING");
    setMessage(`Model loaded and stored locally: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB). It will be reused offline.`);
    await record("AI_MODEL_LOADED", {
      name: file.name,
      sizeBytes: file.size,
      type: file.type || "application/octet-stream"
    });

    if (media.mode !== "standby") {
      await runPerception();
    }
  } catch (error) {
    aiReady = false;
    aiUnavailable = true;
    setMessage(`Unable to load model: ${error.message}`);
    await record("AI_MODEL_ERROR", { message: error.message });
  } finally {
    event.target.value = "";
  }
});



elements.forgetModel.addEventListener("click", async () => {
  try {
    await deleteModel();
    detector.clearModelBuffer();
    pipeline.reset();
    aiReady = false;
    aiUnavailable = true;
    clearWarnings();
    setMessage("Stored AI model removed from this device. Automatic LDW remains available.");
    await record("AI_MODEL_REMOVED");
  } catch (error) {
    setMessage(`Unable to remove stored model: ${error.message}`);
    await record("AI_MODEL_REMOVE_ERROR", { message: error.message });
  }
});

elements.file.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    await media.loadFile(file);
    telemetry.setMode("video");
    setStatus("running", "REPLAY");
    setMessage("Local video replay active. Automatic LDW starts immediately; automatic FCW starts when the AI model is available.");
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
    try {
      await navigator.serviceWorker.register("./sw.js");
    } catch (error) {
      console.warn("Service worker registration failed:", error);
    }
  }
  if (!window.isSecureContext) {
    setMessage("Camera access usually requires HTTPS. GitHub Pages supplies HTTPS.");
  } else if (!media.supportsCamera) {
    setMessage("Camera API unavailable. Local video replay remains available.");
  }
  await refreshEventCount();
  await restoreStoredModel();
  renderLoop();
}

init();

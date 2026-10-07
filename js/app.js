import { MediaController } from "./camera.js";
import { Telemetry } from "./telemetry.js";
import { addEvent, countEvents } from "./storage.js";

const $ = (id) => document.getElementById(id);

const elements = {
  video: $("camera"),
  overlay: $("overlay"),
  runtime: $("runtime-status"),
  fps: $("fps"),
  mode: $("mode"),
  eventCount: $("event-count"),
  message: $("message"),
  fcw: $("warning-fcw"),
  ldw: $("warning-ldw"),
  start: $("start-camera"),
  stop: $("stop-camera"),
  file: $("video-file"),
  testFcw: $("test-fcw"),
  testLdw: $("test-ldw"),
  clear: $("clear-warnings")
};

const media = new MediaController(elements.video);
const telemetry = new Telemetry({
  fpsEl: elements.fps,
  modeEl: elements.mode,
  eventCountEl: elements.eventCount
});

function setStatus(state, label) {
  elements.runtime.dataset.state = state;
  elements.runtime.textContent = label;
}

function setMessage(message) {
  elements.message.textContent = message;
}

function clearWarnings() {
  elements.fcw.classList.remove("active");
  elements.ldw.classList.remove("active");
}

async function refreshEventCount() {
  telemetry.setEventCount(await countEvents());
}

async function record(type) {
  await addEvent(type, { source: "hud-test" });
  await refreshEventCount();
}

async function start() {
  try {
    await media.startCamera();
    telemetry.setMode("camera");
    setStatus("running", "RUNNING");
    setMessage("Live camera active. Perception modules will attach to this pipeline.");
    await record("SESSION_STARTED");
  } catch (error) {
    setStatus("idle", "ERROR");
    setMessage(error.message || "Unable to start camera.");
  }
}

elements.start.addEventListener("click", start);

elements.stop.addEventListener("click", async () => {
  media.stop();
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
    setMessage("Local video replay active.");
    await record("VIDEO_REPLAY_STARTED");
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
  renderLoop();
}

init();

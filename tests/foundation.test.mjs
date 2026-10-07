import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const required = [
  "index.html",
  "manifest.json",
  "sw.js",
  "css/app.css",
  "js/app.js",
  "js/camera.js",
  "js/storage.js",
  "js/telemetry.js",
  "js/ai/mediapipe.js",
  "js/ai/mediapipe-worker.js",
  "js/ai/hybrid-detector.js",
  "VERSION",
  "CHANGELOG.md"
];

for (const relative of required) {
  assert.equal(existsSync(resolve(root, relative)), true, `missing required file: ${relative}`);
}

for (const relative of [
  "js/app.js",
  "js/camera.js",
  "js/storage.js",
  "js/telemetry.js",
  "js/ai/mediapipe.js",
  "js/ai/mediapipe-worker.js",
  "js/ai/hybrid-detector.js"
]) {
  const result = spawnSync(process.execPath, ["--check", resolve(root, relative)], { encoding: "utf8" });
  assert.equal(result.status, 0, `JavaScript syntax error in ${relative}: ${result.stderr}`);
}

const html = readFileSync(resolve(root, "index.html"), "utf8");
for (const expected of [
  'rel="manifest"',
  'id="camera"',
  'id="overlay"',
  'src="./js/app.js"'
]) {
  assert.equal(html.includes(expected), true, `index.html missing ${expected}`);
}

const sw = readFileSync(resolve(root, "sw.js"), "utf8");
for (const asset of [
  "./index.html",
  "./manifest.json",
  "./css/app.css",
  "./js/app.js",
  "./js/camera.js",
  "./js/storage.js",
  "./js/telemetry.js"
]) {
  assert.equal(sw.includes(asset), true, `service worker does not cache ${asset}`);
}

const manifest = JSON.parse(readFileSync(resolve(root, "manifest.json"), "utf8"));
assert.equal(manifest.name, "DASHCAM-V1");
assert.equal(manifest.display, "standalone");

const version = readFileSync(resolve(root, "VERSION"), "utf8").trim();
const expectedCache = `dashcam-v1-shell-${version}`;
assert.equal(sw.includes(expectedCache), true, "service worker cache must match VERSION");

console.log("FOUNDATION_TESTS_PASSED");

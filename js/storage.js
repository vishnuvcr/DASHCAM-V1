const DB_NAME = "dashcam-v1";
const DB_VERSION = 2;
const STORE = "events";
const MODEL_STORE = "models";
const ACTIVE_MODEL_ID = "active";
const MAX_MODEL_BYTES = 64 * 1024 * 1024;

let dbPromise;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
        store.createIndex("timestamp", "timestamp");
        store.createIndex("type", "type");
      }

      if (!db.objectStoreNames.contains(MODEL_STORE)) {
        db.createObjectStore(MODEL_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

export async function addEvent(type, payload = {}) {
  const db = await openDb();
  const event = { type, payload, timestamp: new Date().toISOString() };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const request = tx.objectStore(STORE).add(event);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function countEvents() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).count();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function listEvents(limit = 100) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const rows = [];
    const tx = db.transaction(STORE, "readonly");
    const request = tx.objectStore(STORE).openCursor(null, "prev");
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || rows.length >= limit) return resolve(rows);
      rows.push(cursor.value);
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveModel(buffer, metadata = {}) {
  if (!(buffer instanceof ArrayBuffer)) {
    throw new TypeError("Model data must be an ArrayBuffer.");
  }
  if (buffer.byteLength === 0) {
    throw new Error("Model file is empty.");
  }
  if (buffer.byteLength > MAX_MODEL_BYTES) {
    throw new Error("Model file exceeds the 64 MB browser storage limit.");
  }

  const db = await openDb();
  const record = {
    id: ACTIVE_MODEL_ID,
    data: buffer,
    name: metadata.name || "local-model.onnx",
    sizeBytes: buffer.byteLength,
    type: metadata.type || "application/octet-stream",
    savedAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, "readwrite");
    tx.objectStore(MODEL_STORE).put(record);
    tx.oncomplete = () => resolve({ ...record, data: undefined });
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error("Model save transaction aborted."));
  });
}

export async function loadModel() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, "readonly");
    const request = tx.objectStore(MODEL_STORE).get(ACTIVE_MODEL_ID);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteModel() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE, "readwrite");
    const request = tx.objectStore(MODEL_STORE).delete(ACTIVE_MODEL_ID);
    request.onsuccess = () => resolve(true);
    request.onerror = () => reject(request.error);
  });
}

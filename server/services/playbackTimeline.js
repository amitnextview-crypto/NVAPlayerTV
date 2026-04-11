const fs = require("fs");
const path = require("path");

const basePath = process.pkg
  ? (global.runtimeBasePath || path.dirname(process.execPath))
  : path.join(__dirname, "..");

const dataDir = path.join(basePath, "data");
const timelineFilePath = process.env.PLAYBACK_TIMELINE_PATH
  ? path.resolve(process.env.PLAYBACK_TIMELINE_PATH)
  : path.join(dataDir, "playback-timeline.json");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function emptyStore() {
  return {
    global: { sections: {} },
    devices: {},
  };
}

function readStore() {
  try {
    if (!fs.existsSync(timelineFilePath)) return emptyStore();
    const raw = String(fs.readFileSync(timelineFilePath, "utf8") || "").trim();
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw);
    return {
      global: parsed?.global?.sections ? parsed.global : { sections: {} },
      devices: parsed?.devices && typeof parsed.devices === "object" ? parsed.devices : {},
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store) {
  ensureDir(path.dirname(timelineFilePath));
  fs.writeFileSync(timelineFilePath, JSON.stringify(store, null, 2), "utf8");
}

function normalizeSection(section) {
  const value = Number(section || 0);
  if (!Number.isFinite(value) || value < 1 || value > 3) return 0;
  return Math.floor(value);
}

function normalizeTargetDevice(deviceId) {
  const value = String(deviceId || "all").trim() || "all";
  return value === "all" ? "all" : value;
}

function buildTimelinePayload(section, patch = {}) {
  const now = Date.now();
  const syncAt = Math.max(now, Number(patch.syncAt || now));
  return {
    section,
    cycleId: String(patch.cycleId || `${section}-${syncAt}`),
    syncAt,
    updatedAt: Number(patch.updatedAt || now),
    fileCount: Math.max(0, Number(patch.fileCount || 0)),
    mediaSignature: String(patch.mediaSignature || ""),
    targetDevice: normalizeTargetDevice(patch.targetDevice || "all"),
  };
}

function updateSectionTimeline(deviceId, section, patch = {}) {
  const safeSection = normalizeSection(section);
  if (!safeSection) return null;
  const targetDevice = normalizeTargetDevice(deviceId);
  const store = readStore();
  const entry = buildTimelinePayload(safeSection, {
    ...patch,
    targetDevice,
  });

  if (targetDevice === "all") {
    store.global = store.global || { sections: {} };
    store.global.sections = store.global.sections || {};
    store.global.sections[String(safeSection)] = entry;
  } else {
    store.devices = store.devices || {};
    store.devices[targetDevice] = store.devices[targetDevice] || { sections: {} };
    store.devices[targetDevice].sections = store.devices[targetDevice].sections || {};
    store.devices[targetDevice].sections[String(safeSection)] = entry;
  }

  writeStore(store);
  return entry;
}

function clearDeviceTimeline(deviceId) {
  const targetDevice = normalizeTargetDevice(deviceId);
  if (targetDevice === "all") return;
  const store = readStore();
  if (store.devices && store.devices[targetDevice]) {
    delete store.devices[targetDevice];
    writeStore(store);
  }
}

function getPlaybackTimeline(deviceId) {
  const targetDevice = normalizeTargetDevice(deviceId);
  const store = readStore();
  const merged = {};

  const globalSections = store?.global?.sections || {};
  for (const [key, value] of Object.entries(globalSections)) {
    merged[key] = value;
  }

  if (targetDevice !== "all") {
    const deviceSections = store?.devices?.[targetDevice]?.sections || {};
    for (const [key, value] of Object.entries(deviceSections)) {
      merged[key] = value;
    }
  }

  return {
    sections: merged,
  };
}

module.exports = {
  clearDeviceTimeline,
  getPlaybackTimeline,
  updateSectionTimeline,
};

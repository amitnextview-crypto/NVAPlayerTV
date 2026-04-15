const fs = require("fs");
const path = require("path");
const express = require("express");
const multer = require("multer");
const { getPlaybackTimeline } = require("../services/playbackTimeline");

const router = express.Router();

const basePath = process.pkg
  ? (global.runtimeBasePath || path.dirname(process.execPath))
  : path.join(__dirname, "..");
const assetBasePath = process.pkg
  ? (global.assetBasePath || path.join(__dirname, ".."))
  : path.join(__dirname, "..");

const CONFIG_DIR = path.join(basePath, "data", "configs");
const FALLBACK_DIR = path.join(basePath, "uploads", "fallbacks");
const UPDATE_DIR = path.join(basePath, "uploads", "updates");
const DEFAULT_CONFIG_PATH = path.join(CONFIG_DIR, "default.json");
const ASSET_DEFAULT_CONFIG_PATH = path.join(assetBasePath, "data", "configs", "default.json");
const SAFE_DEVICE_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function sanitizeDeviceId(value) {
  const id = String(value || "").trim();
  if (id === "all") return id;
  if (!SAFE_DEVICE_RE.test(id)) return "";
  return id;
}

function normalizeDeviceIds(input) {
  const values = Array.isArray(input) ? input : [input];
  return Array.from(
    new Set(values.map((value) => sanitizeDeviceId(value)).filter(Boolean))
  );
}

function emitToTargets(targetDevices, eventName, payload = {}) {
  if (!global.io) return { success: false, delivered: 0, skipped: [] };
  const ids = normalizeDeviceIds(targetDevices);
  if (!ids.length) return { success: false, delivered: 0, skipped: [] };

  if (ids.includes("all")) {
    global.io.emit(eventName, payload);
    return { success: true, delivered: Object.keys(global.connectedDevices || {}).length, skipped: [] };
  }

  const delivered = [];
  const skipped = [];
  for (const deviceId of ids) {
    const socketId = global.connectedDevices?.[deviceId];
    if (!socketId) {
      skipped.push(deviceId);
      continue;
    }
    global.io.to(socketId).emit(eventName, payload);
    delivered.push(deviceId);
  }
  return { success: delivered.length > 0, delivered: delivered.length, skipped };
}

const DEFAULT_CONFIG_TEMPLATE = {
  orientation: "horizontal",
  layout: "fullscreen",
  grid3Layout: "stack-v",
  gridRatio: "1:1:1",
  slideDuration: 5,
  animation: "slide",
  bgColor: "#000000",
  sections: [
    { slideDirection: "left", slideDuration: 5, sourceType: "multimedia", sourceUrl: "" },
    { slideDirection: "left", slideDuration: 5, sourceType: "multimedia", sourceUrl: "" },
    { slideDirection: "left", slideDuration: 5, sourceType: "multimedia", sourceUrl: "" },
  ],
  ticker: {
    text: "",
    color: "#ffffff",
    bgColor: "#000000",
    speed: 6,
    fontSize: 24,
    position: "bottom",
  },
  schedule: {
    enabled: false,
    start: "09:00",
    end: "18:00",
    days: [0, 1, 2, 3, 4, 5, 6],
    fallbackMode: "black",
    fallbackMessage: "Playback is currently scheduled off.",
    fallbackImageUrl: "",
    fallbackTextColor: "#ffffff",
    fallbackBgColor: "#000000",
  },
};

if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}
if (!fs.existsSync(FALLBACK_DIR)) {
  fs.mkdirSync(FALLBACK_DIR, { recursive: true });
}
if (!fs.existsSync(UPDATE_DIR)) {
  fs.mkdirSync(UPDATE_DIR, { recursive: true });
}

function ensureDefaultConfig() {
  try {
    if (fs.existsSync(DEFAULT_CONFIG_PATH)) return;

    const fallbackRaw = fs.existsSync(ASSET_DEFAULT_CONFIG_PATH)
      ? fs.readFileSync(ASSET_DEFAULT_CONFIG_PATH, "utf-8")
      : JSON.stringify(DEFAULT_CONFIG_TEMPLATE, null, 2);
    const parsed = JSON.parse(fallbackRaw);
    const normalized = {
      ...DEFAULT_CONFIG_TEMPLATE,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      layout: "fullscreen",
    };
    fs.writeFileSync(DEFAULT_CONFIG_PATH, JSON.stringify(normalized, null, 2));
  } catch (_e) {
    // best effort
  }
}

ensureDefaultConfig();

const fallbackUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, FALLBACK_DIR),
    filename: (req, file, cb) => {
      const target = String(req.body?.targetDevice || "all")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 80);
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = [".jpg", ".jpeg", ".png", ".mp4", ".mov", ".mkv", ".webm"].includes(ext)
        ? ext
        : ".jpg";
      cb(null, `schedule-fallback-${target}${safeExt}`);
    },
  }),
  limits: { fileSize: 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".mp4", ".mov", ".mkv", ".webm"].includes(ext)) {
      return cb(new Error("Only JPG/PNG/MP4/MOV/MKV/WEBM files are allowed"));
    }
    cb(null, true);
  },
});

const appUpdateUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPDATE_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname || "").toLowerCase();
      const safeExt = ext === ".apk" ? ".apk" : ".bin";
      cb(null, `NVA-SignagePlayerTV-update${safeExt}`);
    },
  }),
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "").toLowerCase();
    if (ext !== ".apk") {
      return cb(new Error("Only APK files are allowed"));
    }
    cb(null, true);
  },
});

router.get("/", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  const deviceId = sanitizeDeviceId(req.query.deviceId);
  let filePath;

  if (deviceId) {
    const devicePath = path.join(CONFIG_DIR, `${deviceId}.json`);
    filePath = fs.existsSync(devicePath)
      ? devicePath
      : DEFAULT_CONFIG_PATH;
  } else {
    filePath = DEFAULT_CONFIG_PATH;
  }

  const data = fs.readFileSync(filePath, "utf-8");
  res.json({
    ...JSON.parse(data),
    playbackTimeline: getPlaybackTimeline(deviceId || "all"),
  });
});

router.post("/", (req, res) => {
  const payload = req.body && typeof req.body === "object" ? req.body : {};
  const rawTargetDevice =
    Object.prototype.hasOwnProperty.call(payload, "targetDevice") ? payload.targetDevice : "all";
  const { config } = payload;
  const safeTarget = sanitizeDeviceId(rawTargetDevice);
  if (!safeTarget) {
    return res.status(400).json({ success: false, error: "invalid-device-id" });
  }
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return res.status(400).json({ success: false, error: "invalid-config-payload" });
  }

  if (safeTarget === "all") {
    const defaultPath = DEFAULT_CONFIG_PATH;
    fs.writeFileSync(defaultPath, JSON.stringify(config, null, 2));

    const files = fs.readdirSync(CONFIG_DIR);
    files.forEach((file) => {
      if (file !== "default.json" && file.endsWith(".json")) {
        const devicePath = path.join(CONFIG_DIR, file);
        fs.writeFileSync(devicePath, JSON.stringify(config, null, 2));
      }
    });

    if (global.io) {
      global.io.emit("config-updated");
    }
  } else {
    const devicePath = path.join(CONFIG_DIR, `${safeTarget}.json`);
    fs.writeFileSync(devicePath, JSON.stringify(config, null, 2));

    if (global.io && global.connectedDevices?.[safeTarget]) {
      const socketId = global.connectedDevices[safeTarget];
      global.io.to(socketId).emit("config-updated");
    }
  }

  res.json({ success: true });
});

router.post("/clear-device", (req, res) => {
  const safeTarget = sanitizeDeviceId(req.body?.targetDevice);
  if (!safeTarget) {
    return res.json({ success: false, error: "invalid-device-id" });
  }

  if (safeTarget === "all") {
    if (global.io) {
      global.io.emit("clear-data");
      console.log("Clear data command sent to: all devices");
      return res.json({ success: true });
    }
    return res.json({ success: false });
  }

  if (global.io && global.connectedDevices?.[safeTarget]) {
    const socketId = global.connectedDevices[safeTarget];
    global.io.to(socketId).emit("clear-data");
    console.log("Clear data command sent to:", safeTarget);
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

router.post("/deep-clear-device", (req, res) => {
  const safeTarget = sanitizeDeviceId(req.body?.targetDevice);
  if (!safeTarget) {
    return res.json({ success: false, error: "invalid-device-id" });
  }
  const result = emitToTargets([safeTarget], "deep-clear-data", {
    preserveKeys: ["activation", "deviceId", "license"],
  });
  return res.json({
    success: result.success,
    delivered: result.delivered,
    skipped: result.skipped,
  });
});

router.post("/restart-device", (req, res) => {
  const safeTarget = sanitizeDeviceId(req.body?.targetDevice);
  if (!safeTarget) {
    return res.json({ success: false, error: "invalid-device-id" });
  }

  if (safeTarget === "all") {
    if (global.io) {
      global.io.emit("restart-app");
      return res.json({ success: true });
    }
    return res.json({ success: false });
  }

  if (global.io && global.connectedDevices?.[safeTarget]) {
    const socketId = global.connectedDevices[safeTarget];
    global.io.to(socketId).emit("restart-app");
    console.log("Restart command sent to:", safeTarget);
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

router.post("/rename-device", (req, res) => {
  const safeTarget = sanitizeDeviceId(req.body?.targetDevice);
  const nextName = String(req.body?.deviceName || "").trim();
  if (!safeTarget || safeTarget === "all") {
    return res.status(400).json({ success: false, error: "invalid-device-id" });
  }
  if (!nextName || nextName.length > 80) {
    return res.status(400).json({ success: false, error: "invalid-device-name" });
  }

  const existingStatuses = Object.values(global.deviceStatus || {});
  const duplicate = existingStatuses.find((item) => {
    if (!item?.deviceId || item.deviceId === safeTarget) return false;
    const currentName = String(item?.meta?.deviceName || item?.meta?.name || "").trim();
    return currentName && currentName.toLowerCase() === nextName.toLowerCase();
  });
  if (duplicate) {
    return res.status(409).json({ success: false, error: "duplicate-device-name" });
  }

  const result = emitToTargets([safeTarget], "rename-device", { deviceName: nextName });
  return res.json({
    success: result.success,
    delivered: result.delivered,
    skipped: result.skipped,
  });
});

router.post("/clear-cache", (req, res) => {
  const safeTarget = sanitizeDeviceId(req.body?.targetDevice);
  if (!safeTarget) {
    return res.json({ success: false, error: "invalid-device-id" });
  }

  if (safeTarget === "all") {
    if (global.io) {
      global.io.emit("clear-cache");
      console.log("Clear cache command sent to: all devices");
      return res.json({ success: true });
    }
    return res.json({ success: false });
  }

  if (global.io && global.connectedDevices?.[safeTarget]) {
    const socketId = global.connectedDevices[safeTarget];
    global.io.to(socketId).emit("clear-cache");
    console.log("Clear cache command sent to:", safeTarget);
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

router.post("/bulk-action", (req, res) => {
  const action = String(req.body?.action || "").trim();
  const deviceIds = normalizeDeviceIds(req.body?.deviceIds);
  const config = req.body?.config && typeof req.body.config === "object" ? req.body.config : null;
  const payload = req.body?.payload && typeof req.body.payload === "object" ? req.body.payload : {};

  if (!action) {
    return res.status(400).json({ success: false, error: "action-required" });
  }
  if (!deviceIds.length) {
    return res.status(400).json({ success: false, error: "device-targets-required" });
  }

  if (action === "apply-config" && config) {
    let okCount = 0;
    for (const deviceId of deviceIds) {
      if (deviceId === "all") continue;
      const devicePath = path.join(CONFIG_DIR, `${deviceId}.json`);
      fs.writeFileSync(devicePath, JSON.stringify(config, null, 2));
      if (global.io && global.connectedDevices?.[deviceId]) {
        global.io.to(global.connectedDevices[deviceId]).emit("config-updated");
      }
      okCount += 1;
    }
    return res.json({ success: true, applied: okCount });
  }

  const eventMap = {
    reboot: "device-command",
    "restart-app": "restart-app",
    refresh: "device-command",
    "clear-cache": "clear-cache",
    "deep-clear-data": "deep-clear-data",
    "kiosk-toggle": "device-command",
    orientation: "device-command",
    brightness: "device-command",
    volume: "device-command",
    mute: "device-command",
    "force-sync": "device-command",
    "refresh-content": "device-command",
    "sleep-timer": "device-command",
    "wake-timer": "device-command",
    "auto-start-on-boot": "device-command",
  };
  const eventName = eventMap[action];
  if (!eventName) {
    return res.status(400).json({ success: false, error: "unsupported-action" });
  }
  const result = emitToTargets(deviceIds, eventName, {
    action,
    ...payload,
  });
  return res.json({
    success: result.success,
    delivered: result.delivered,
    skipped: result.skipped,
  });
});

router.post("/auto-reopen", (req, res) => {
  const { enabled } = req.body || {};
  const safeTarget = sanitizeDeviceId(req.body?.targetDevice);
  if (!safeTarget) {
    return res.json({ success: false, error: "invalid-device-id" });
  }
  const flag = !!enabled;

  if (safeTarget === "all") {
    if (global.io) {
      global.io.emit("set-auto-reopen", { enabled: flag });
      return res.json({ success: true });
    }
    return res.json({ success: false });
  }

  if (global.io && global.connectedDevices?.[safeTarget]) {
    const socketId = global.connectedDevices[safeTarget];
    global.io.to(socketId).emit("set-auto-reopen", { enabled: flag });
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

router.post("/upload-app-update", (req, res) => {
  appUpdateUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "APK upload failed" });
    }
    if (!req.file?.filename) {
      return res.status(400).json({ error: "No APK uploaded" });
    }

    return res.json({
      success: true,
      apkUrl: `/media/updates/${req.file.filename}`,
      fileName: req.file.filename,
      size: Number(req.file.size || 0),
    });
  });
});

router.post("/install-app-update", (req, res) => {
  const { apkUrl } = req.body || {};
  const safeTarget = sanitizeDeviceId(req.body?.targetDevice);
  if (!safeTarget) {
    return res.json({ success: false, error: "invalid-device-id" });
  }
  const safeApkUrl = String(apkUrl || "").trim();
  if (!safeApkUrl) {
    return res.status(400).json({ success: false, error: "APK URL missing" });
  }

  if (safeTarget === "all") {
    if (global.io) {
      global.io.emit("install-app-update", { apkUrl: safeApkUrl });
      return res.json({ success: true });
    }
    return res.json({ success: false });
  }

  if (global.io && global.connectedDevices?.[safeTarget]) {
    const socketId = global.connectedDevices[safeTarget];
    global.io.to(socketId).emit("install-app-update", { apkUrl: safeApkUrl });
    return res.json({ success: true });
  }

  return res.json({ success: false });
});

router.post("/upload-fallback-image", (req, res) => {
  fallbackUpload.single("file")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || "Upload failed" });
    }
    if (!req.file?.filename) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    return res.json({
      success: true,
      url: `/media/fallbacks/${req.file.filename}`,
    });
  });
});

module.exports = router;

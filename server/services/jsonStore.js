const fs = require("fs");
const path = require("path");

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function readJsonFile(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return cloneFallback(fallback);
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : cloneFallback(fallback);
  } catch {
    return cloneFallback(fallback);
  }
}

function writeJsonFile(filePath, payload) {
  ensureDir(path.dirname(filePath));
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), "utf8");
  fs.renameSync(tmpPath, filePath);
}

function updateJsonFile(filePath, fallback, updater) {
  const current = readJsonFile(filePath, fallback);
  const next = updater(current);
  writeJsonFile(filePath, next);
  return next;
}

function cloneFallback(fallback) {
  if (Array.isArray(fallback)) return [...fallback];
  if (fallback && typeof fallback === "object") {
    return JSON.parse(JSON.stringify(fallback));
  }
  return fallback;
}

module.exports = {
  ensureDir,
  readJsonFile,
  writeJsonFile,
  updateJsonFile,
};

const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { safeStat, safeReaddir, safeExistsDir, safeExists } = require("../utils/fsSafe");

const router = express.Router();
const BASE_DIR = process.pkg
  ? path.join(global.runtimeBasePath || path.dirname(process.execPath), "uploads")
  : path.join(__dirname, "../uploads");
const ALLOWED_MEDIA_EXT = /\.(mp4|mov|mkv|webm|jpg|jpeg|png|txt|pdf)$/i;
const HASH_CACHE = new Map();
const SAFE_DEVICE_RE = /^[a-zA-Z0-9_-]{1,64}$/;

function sanitizeDeviceId(value) {
  const id = String(value || "").trim();
  if (id === "all") return id;
  if (!SAFE_DEVICE_RE.test(id)) return "";
  return id;
}

function estimatePdfPageCount(filePath) {
  try {
    const content = fs.readFileSync(filePath, "latin1");
    const matches = content.match(/\/Type\s*\/Page\b/g);
    return Math.max(1, matches ? matches.length : 1);
  } catch (_e) {
    return 1;
  }
}

function getFileHash(fullPath, stat) {
  try {
    const cacheKey = `${fullPath}|${Number(stat?.mtimeMs || 0)}|${Number(stat?.size || 0)}`;
    const cached = HASH_CACHE.get(cacheKey);
    if (cached) return cached;
    const data = fs.readFileSync(fullPath);
    const hash = crypto.createHash("sha1").update(data).digest("hex");
    HASH_CACHE.set(cacheKey, hash);
    return hash;
  } catch (_e) {
    return "";
  }
}

function listDirsSortedByMtime(dirPath) {
  if (!safeExistsDir(dirPath)) return [];
  const names = safeReaddir(dirPath);
  const entries = names
    .map((name) => ({ name, full: path.join(dirPath, name) }))
    .filter((entry) => {
      const stat = safeStat(entry.full);
      return stat != null && stat.isDirectory();
    });
  entries.sort((a, b) => {
    const aStat = safeStat(a.full);
    const bStat = safeStat(b.full);
    const aM = Number(aStat?.mtimeMs || 0);
    const bM = Number(bStat?.mtimeMs || 0);
    return bM - aM;
  });
  return entries;
}

function resolveSectionDirectory(deviceId, sectionNo) {
  const sectionBase = path.join(BASE_DIR, deviceId, `section${sectionNo}`);
  const activeFile = `${sectionBase}__active.txt`;
  const versionsDir = `${sectionBase}__versions`;

  try {
    if (safeExists(activeFile) && safeExistsDir(versionsDir)) {
      const raw = String(fs.readFileSync(activeFile, "utf8") || "").trim();
      let activeVersion = raw;
      if (raw.startsWith("{")) {
        const parsed = JSON.parse(raw);
        activeVersion = String(parsed?.activeVersion || "").trim();
      }
      if (activeVersion) {
        const activeDir = path.join(versionsDir, activeVersion);
        if (safeExistsDir(activeDir)) return activeDir;
      }
    }
  } catch {
  }

  if (safeExistsDir(sectionBase)) return sectionBase;

  const latestVersion = listDirsSortedByMtime(versionsDir)[0];
  if (latestVersion?.full) return latestVersion.full;

  return "";
}

function readActiveSectionFiles(sectionBase) {
  const activeFile = `${sectionBase}__active.txt`;
  if (!safeExists(activeFile)) return null;

  try {
    const raw = String(fs.readFileSync(activeFile, "utf8") || "").trim();
    if (!raw || !raw.startsWith("{")) return null;
    const parsed = JSON.parse(raw);
    const files = Array.isArray(parsed?.files) ? parsed.files : [];
    const normalized = files
      .map((name) => String(name || "").trim())
      .filter(Boolean);
    return new Set(normalized);
  } catch {
    return null;
  }
}

router.get("/", (req, res) => {
  const deviceId = sanitizeDeviceId(req.query.deviceId);

  if (!deviceId) return res.json([]);

  const result = [];

  for (let i = 1; i <= 3; i++) {
    const tryReadSectionFiles = (candidateDevice) => {
      const dirPath = resolveSectionDirectory(candidateDevice, i);
      if (!safeExistsDir(dirPath)) return { device: candidateDevice, dirPath, files: [] };
      let names = safeReaddir(dirPath).filter((name) => ALLOWED_MEDIA_EXT.test(name));
      const directSectionBase = path.join(BASE_DIR, candidateDevice, `section${i}`);
      if (dirPath === directSectionBase) {
        const activeFiles = readActiveSectionFiles(directSectionBase);
        if (activeFiles && activeFiles.size) {
          names = names.filter((name) => activeFiles.has(name));
        }
      }
      return { device: candidateDevice, dirPath, files: names };
    };

    let chosen = tryReadSectionFiles(deviceId);
    // If device section exists but is empty/non-media, fall back to "all".
    if (!chosen.files.length && String(deviceId) !== "all") {
      const fallback = tryReadSectionFiles("all");
      if (fallback.files.length) {
        chosen = fallback;
      }
    }

    if (!chosen.files.length) continue;

    for (const name of chosen.files) {
      const sectionDir = chosen.dirPath;
      if (!ALLOWED_MEDIA_EXT.test(name)) continue;
      const fullPath = path.join(sectionDir, name);
      const stat = safeStat(fullPath, { retries: 6 });
      if (!stat) continue;
      const ext = path.extname(name).toLowerCase();
      const relative = path
        .relative(BASE_DIR, fullPath)
        .replace(/\\/g, "/");
      const baseUrl = `/media/${relative}`;

      const hash = getFileHash(fullPath, stat);
      if (ext === ".pdf") {
        const pageCount = estimatePdfPageCount(fullPath);
        for (let page = 1; page <= pageCount; page++) {
          result.push({
            name: `${name}#page-${page}`,
            originalName: name,
            section: i,
            url: baseUrl,
            type: "pdf",
            page,
            pageCount,
            size: stat.size,
            mtimeMs: Number(stat.mtimeMs || 0),
            hash,
          });
        }
        continue;
      }

      result.push({
        name,
        section: i,
        url: baseUrl,
        type: ext === ".txt" ? "text" : "media",
        size: stat.size,
        mtimeMs: Number(stat.mtimeMs || 0),
        hash,
      });
    }
  }

  try {
    const hash = crypto
      .createHash("sha1")
      .update(
        result
          .map((item) =>
            [
              item.url,
              item.size || 0,
              item.mtimeMs || 0,
              item.page || 0,
              item.pageCount || 0,
              item.section || 0,
            ].join("|")
          )
          .join("~")
      )
      .digest("hex");
    const etag = `"${hash}"`;
    if (req.headers["if-none-match"] === etag) {
      res.status(304).end();
      return;
    }
    res.setHeader("ETag", etag);
  } catch {
  }

  res.json(result);
});

module.exports = router;

const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { clearDeviceTimeline, updateSectionTimeline } = require("../services/playbackTimeline");
const { encodeVideo } = require("../services/videoEncoder");
const uploadQueue = require("../services/uploadQueue");
const { safeStat, safeReaddir, safeExistsDir, safeExists, wait } = require("../utils/fsSafe");

const router = express.Router();

const basePath = process.pkg
  ? (global.runtimeBasePath || path.dirname(process.execPath))
  : path.join(__dirname, "..");

const uploadsBase = path.join(basePath, "uploads");
const ALLOWED_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".mkv",
  ".webm",
  ".jpg",
  ".jpeg",
  ".png",
  ".txt",
  ".pdf",
  ".ppt",
  ".pptx",
  ".pptm",
  ".pps",
  ".ppsx",
  ".potx",
]);
const ALLOWED_MIME_TYPES = new Set([
  "video/mp4",
  "video/mov",
  "video/webm",
  "video/x-matroska",
  "image/jpeg",
  "image/png",
  "text/plain",
  "application/pdf",
  "application/x-pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint.presentation.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.presentationml.slideshow",
  "application/vnd.ms-powerpoint.slideshow.macroenabled.12",
  "application/vnd.openxmlformats-officedocument.presentationml.template",
]);
const VIDEO_EXTENSIONS = new Set([".mp4", ".mov", ".mkv", ".webm"]);
const PPT_EXTENSIONS = new Set([".ppt", ".pptx", ".pptm", ".pps", ".ppsx", ".potx"]);
const PPT_MARKER_NAME = ".ppt_marker";
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB
const MAX_FILES_PER_UPLOAD = 120;
const DISABLE_UPLOAD_TRANSCODE = String(process.env.DISABLE_UPLOAD_TRANSCODE || "") === "1";
const DIRECT_PLAY_VIDEO_EXTENSIONS = new Set([".mp4"]);
const SAFE_DEVICE_RE = /^[a-zA-Z0-9_-]{1,64}$/;
const activeEnterpriseJobs = new Set();

function sanitizeDeviceId(value) {
  const id = String(value || "").trim();
  if (id === "all") return id;
  if (!SAFE_DEVICE_RE.test(id)) return "";
  return id;
}

function normalizeDeviceIdList(value) {
  if (Array.isArray(value)) {
    return Array.from(new Set(value.map((item) => sanitizeDeviceId(item)).filter(Boolean)));
  }
  if (typeof value === "string") {
    return Array.from(
      new Set(
        value
          .split(",")
          .map((item) => sanitizeDeviceId(item))
          .filter(Boolean)
      )
    );
  }
  return [];
}

function emitSectionUploadStatus(deviceId, section, status, message = "") {
  if (!global.io) return;
  const payload = {
    section: Number(section || 0),
    status: String(status || "processing"),
    message: String(message || ""),
  };

  if (String(deviceId) === "all") {
    global.io.emit("section-upload-status", payload);
    return;
  }

  const socketId = global.connectedDevices?.[deviceId];
  if (socketId) {
    global.io.to(socketId).emit("section-upload-status", payload);
  }
}

function toErrorText(err, fallback = "Upload failed") {
  if (!err) return fallback;
  if (typeof err === "string") return err;
  if (typeof err.message === "string" && err.message.trim()) return err.message.trim();
  return fallback;
}

function humanizeUploadError(err, fallback = "Upload failed") {
  const message = toErrorText(err, fallback);
  const lower = message.toLowerCase();
  const code = String(err?.code || "").toUpperCase();

  if (lower.includes("unsupported file type")) {
    return message;
  }

  if (code === "EPERM" || code === "EBUSY" || code === "ENOTEMPTY" || code === "EEXIST") {
    return "Upload folder/file is temporarily locked by the OS. Please retry in a few seconds.";
  }

  if (code === "EXDEV") {
    return "Server file move failed across storage volumes. Check server upload path configuration.";
  }

  if (lower.includes("enospc")) {
    return "Server storage is full. Free disk space and retry upload.";
  }

  if (lower.includes("eacces") || lower.includes("eperm")) {
    return "Server does not have permission to write upload files.";
  }

  if (lower.includes("enoent")) {
    return "Upload folder not found. Restart CMS server and try again.";
  }

  if (/[a-z]:\\[^:\n]+/i.test(message)) {
    return "Upload failed due to a server file-system error.";
  }

  return message;
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function cleanDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    fs.rmSync(path.join(dirPath, entry), { recursive: true, force: true });
  }
}

function extFromMime(mimeType) {
  const mime = String(mimeType || "").toLowerCase();
  if (mime === "video/mp4") return ".mp4";
  if (mime === "video/mov") return ".mov";
  if (mime === "video/webm") return ".webm";
  if (mime === "video/x-matroska") return ".mkv";
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "text/plain") return ".txt";
  if (mime === "application/pdf" || mime === "application/x-pdf") return ".pdf";
  if (mime === "application/vnd.ms-powerpoint") return ".ppt";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return ".pptx";
  if (mime === "application/vnd.ms-powerpoint.presentation.macroenabled.12") return ".pptm";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.slideshow") return ".ppsx";
  if (mime === "application/vnd.ms-powerpoint.slideshow.macroenabled.12") return ".pps";
  if (mime === "application/vnd.openxmlformats-officedocument.presentationml.template") return ".potx";
  return "";
}

function sanitizeFileName(file, req) {
  const parsed = path.parse(file?.originalname || "media");
  const safeBase = (parsed.name || "media")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
  const rawExt = (parsed.ext || "").toLowerCase().replace(/[^a-zA-Z0-9.]/g, "");
  const safeExt = rawExt || extFromMime(file?.mimetype);

  req._nameCounter = req._nameCounter || {};
  const key = `${safeBase}${safeExt}`.toLowerCase();
  req._nameCounter[key] = (req._nameCounter[key] || 0) + 1;

  const count = req._nameCounter[key];
  return count === 1 ? `${safeBase}${safeExt}` : `${safeBase}-${count}${safeExt}`;
}

function findSofficeBinary() {
  const envPath = String(process.env.LIBREOFFICE_PATH || process.env.SOFFICE_PATH || "").trim();
  if (envPath && safeExists(envPath)) return envPath;
  const candidates = [
    "C:\\\\Program Files\\\\LibreOffice\\\\program\\\\soffice.exe",
    "C:\\\\Program Files (x86)\\\\LibreOffice\\\\program\\\\soffice.exe",
  ];
  for (const candidate of candidates) {
    if (safeExists(candidate)) return candidate;
  }
  return "soffice";
}

function safeBaseName(value) {
  return String(value || "slides")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 80);
}

async function execFileSafe(cmd, args, timeoutMs = 180000) {
  await new Promise((resolve, reject) => {
    execFile(cmd, args, { timeout: timeoutMs }, (err) => {
      if (err) return reject(err);
      return resolve();
    });
  });
}

function listPngsForBase(outputDir, base) {
  const lowerBase = base.toLowerCase();
  return safeReaddir(outputDir)
    .filter((name) => name.toLowerCase().endsWith(".png"))
    .filter((name) => name.toLowerCase().startsWith(lowerBase))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}

async function convertPresentationToPdf(filePath, outputDir) {
  const soffice = findSofficeBinary();
  const args = [
    "--headless",
    "--nologo",
    "--nolockcheck",
    "--nodefault",
    "--nofirststartwizard",
    "--convert-to",
    "pdf",
    "--outdir",
    outputDir,
    filePath,
  ];

  await execFileSafe(soffice, args, 180000);

  const base = path.parse(filePath).name;
  const pdfPath = path.join(outputDir, `${base}.pdf`);
  if (!safeExists(pdfPath)) {
    throw new Error("ppt-convert-missing-pdf");
  }
  return pdfPath;
}

async function convertPdfToImages(pdfPath, outputDir, baseName) {
  const outputBase = path.join(outputDir, `${baseName}_slide`);
  // Try pdftoppm (Poppler) first - fast and reliable.
  try {
    await execFileSafe("pdftoppm", ["-png", "-r", "130", pdfPath, outputBase], 180000);
    const pngs = listPngsForBase(outputDir, `${baseName}_slide`);
    if (pngs.length) return pngs;
  } catch {
    // continue to next strategy
  }

  // Fallback: ImageMagick (magick) conversion.
  try {
    await execFileSafe(
      "magick",
      ["-density", "130", pdfPath, path.join(outputDir, `${baseName}_slide-%03d.png`)],
      180000
    );
    const pngs = listPngsForBase(outputDir, `${baseName}_slide`);
    if (pngs.length) return pngs;
  } catch {
    // continue to last strategy
  }

  // Last fallback: LibreOffice direct PNG export (may be single slide).
  try {
    const soffice = findSofficeBinary();
    const args = [
      "--headless",
      "--nologo",
      "--nolockcheck",
      "--nodefault",
      "--nofirststartwizard",
      "--convert-to",
      "png",
      "--outdir",
      outputDir,
      pdfPath,
    ];
    await execFileSafe(soffice, args, 180000);
    const pngs = listPngsForBase(outputDir, baseName);
    if (pngs.length) return pngs;
  } catch {
    // ignore
  }

  return [];
}

async function convertPresentationToImages(filePath, outputDir) {
  const pdfPath = await convertPresentationToPdf(filePath, outputDir);
  const baseName = safeBaseName(path.parse(filePath).name);
  const pngs = await convertPdfToImages(pdfPath, outputDir, baseName);
  if (!pngs.length) {
    throw new Error("ppt-convert-missing-images");
  }
  try {
    await removePathWithRetry(pdfPath, { force: true }, 2, 120);
  } catch {
  }
  return pngs;
}

function sectionPathFor(deviceId, sectionNumber) {
  return path.join(uploadsBase, deviceId, `section${sectionNumber}`);
}

function resolveActiveSectionDir(deviceId, sectionNumber) {
  const { sectionBase, versionsDir, activeFile } = sectionPaths(deviceId, sectionNumber);
  const activeState = readActiveSectionState(activeFile);
  if (activeState?.activeVersion) {
    const activeVersionDir = path.join(versionsDir, activeState.activeVersion);
    if (safeExistsDir(activeVersionDir)) return activeVersionDir;
  }
  if (safeExistsDir(sectionBase)) return sectionBase;
  return "";
}

function cleanupStaleIncomingDirs(deviceId, section, maxAgeMs = 6 * 60 * 60 * 1000) {
  const deviceDir = path.join(uploadsBase, deviceId);
  if (!safeExistsDir(deviceDir)) return;
  const prefix = `section${section}__incoming`;
  const now = Date.now();
  const entries = safeReaddir(deviceDir);

  for (const entry of entries) {
    if (!String(entry).startsWith(prefix)) continue;
    const full = path.join(deviceDir, entry);
    const stat = safeStat(full);
    if (!stat || !stat.isDirectory()) continue;
    const ageMs = now - Number(stat.mtimeMs || 0);
    if (ageMs < maxAgeMs) continue;
    try {
      fs.rmSync(full, { recursive: true, force: true });
    } catch {
    }
  }
}

function directoryHasVideo(dirPath) {
  if (!safeExistsDir(dirPath)) return false;
  const files = safeReaddir(dirPath);
  return files.some((name) =>
    VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase())
  );
}

function directoryHasPpt(dirPath) {
  if (!safeExistsDir(dirPath)) return false;
  const files = safeReaddir(dirPath);
  if (files.includes(PPT_MARKER_NAME)) return true;
  return files.some((name) =>
    PPT_EXTENSIONS.has(path.extname(name).toLowerCase())
  );
}

function anyOtherSectionHasVideoOrPpt(deviceId, currentSection) {
  for (let s = 1; s <= 3; s++) {
    if (String(s) === String(currentSection)) continue;
    const dir = resolveActiveSectionDir(deviceId, s);
    if (directoryHasVideo(dir) || directoryHasPpt(dir)) return true;
  }
  return false;
}

function uniqueFilePath(dirPath, fileName) {
  const parsed = path.parse(fileName);
  let candidate = path.join(dirPath, fileName);
  let count = 2;
  while (safeExists(candidate)) {
    candidate = path.join(dirPath, `${parsed.name}-${count}${parsed.ext}`);
    count += 1;
  }
  return candidate;
}

function isTransientFsError(err) {
  const code = String(err?.code || "").toUpperCase();
  return code === "EPERM" || code === "EBUSY" || code === "ENOTEMPTY" || code === "EEXIST";
}

async function removePathWithRetry(targetPath, options = {}, retries = 6, delayMs = 120) {
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      if (!safeExists(targetPath)) return;
      fs.rmSync(targetPath, options);
      if (!safeExists(targetPath)) return;
    } catch (err) {
      lastErr = err;
      if (!isTransientFsError(err) || i === retries - 1) {
        throw err;
      }
    }
    await wait(delayMs * (i + 1));
  }
  if (safeExists(targetPath)) {
    throw lastErr || new Error("remove-failed");
  }
}

async function renameWithRetry(fromPath, toPath, retries = 5, delayMs = 140) {
  let lastErr = null;
  for (let i = 0; i < retries; i += 1) {
    try {
      fs.renameSync(fromPath, toPath);
      return;
    } catch (err) {
      lastErr = err;
      if (!isTransientFsError(err) || i === retries - 1) {
        throw err;
      }
      await wait(delayMs * (i + 1));
    }
  }
  throw lastErr || new Error("rename-failed");
}

function sectionPaths(deviceId, section) {
  const sectionBase = path.join(uploadsBase, deviceId, `section${section}`);
  return {
    sectionBase,
    versionsDir: `${sectionBase}__versions`,
    activeFile: `${sectionBase}__active.txt`,
  };
}

function buildVersionName() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function readActiveSectionState(activeFile) {
  if (!safeExists(activeFile)) return null;
  try {
    const raw = String(fs.readFileSync(activeFile, "utf8") || "").trim();
    if (!raw) return null;
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw);
      return {
        activeVersion: String(parsed?.activeVersion || "").trim(),
        files: Array.isArray(parsed?.files)
          ? parsed.files.map((name) => String(name || "").trim()).filter(Boolean)
          : [],
      };
    }
    return {
      activeVersion: raw,
      files: [],
    };
  } catch {
    return null;
  }
}

async function cleanupOldSectionVersions(versionsDir, keepVersion = "", keepCount = 2) {
  if (!safeExistsDir(versionsDir)) return;
  const entries = safeReaddir(versionsDir)
    .map((name) => ({ name, full: path.join(versionsDir, name), stat: safeStat(path.join(versionsDir, name)) }))
    .filter((entry) => entry.stat?.isDirectory?.());

  entries.sort((a, b) => Number(b.stat?.mtimeMs || 0) - Number(a.stat?.mtimeMs || 0));
  let kept = 0;
  for (const entry of entries) {
    if (entry.name === keepVersion) {
      kept += 1;
      continue;
    }
    if (kept < keepCount) {
      kept += 1;
      continue;
    }
    try {
      await removePathWithRetry(entry.full, { recursive: true, force: true }, 3, 80);
    } catch {
    }
  }
}

async function activateIncomingSection(deviceId, section, incomingDir) {
  const { sectionBase, versionsDir, activeFile } = sectionPaths(deviceId, section);
  const incomingFiles = safeExistsDir(incomingDir) ? safeReaddir(incomingDir) : [];
  const versionName = buildVersionName();
  const versionDir = path.join(versionsDir, versionName);
  const previousState = readActiveSectionState(activeFile);

  ensureDir(versionsDir);
  await renameWithRetry(incomingDir, versionDir);
  await wait(120);

  const activeFiles = safeExistsDir(versionDir) ? safeReaddir(versionDir) : incomingFiles;

  fs.writeFileSync(
    activeFile,
    JSON.stringify({
      activeVersion: versionName,
      files: activeFiles,
      updatedAt: Date.now(),
    }),
    "utf8"
  );

  if (safeExistsDir(sectionBase)) {
    try {
      await removePathWithRetry(sectionBase, { recursive: true, force: true }, 2, 60);
    } catch {
    }
  }

  cleanupOldSectionVersions(versionsDir, versionName, previousState?.activeVersion ? 2 : 1).catch(() => {
  });

  return {
    versionName,
    activeFiles,
    updatedAt: Date.now(),
  };
}

async function optimizeVideosInDirectory(dirPath) {
  if (DISABLE_UPLOAD_TRANSCODE || String(process.env.DISABLE_VIDEO_TRANSCODE || "") === "1") {
    return;
  }

  const files = safeReaddir(dirPath);
  for (const fileName of files) {
    const ext = path.extname(fileName).toLowerCase();
    if (!VIDEO_EXTENSIONS.has(ext)) continue;

    const inputPath = path.join(dirPath, fileName);
    if (!safeExists(inputPath)) continue;

    const stat = safeStat(inputPath, { retries: 6 });
    if (!stat) continue;

    if (DIRECT_PLAY_VIDEO_EXTENSIONS.has(ext)) {
      console.log("Skipping transcode for direct-play MP4:", fileName);
      continue;
    }

    try {
      console.log("Transcoding video:", fileName);
      const encodedPath = await encodeVideo(inputPath);
      const targetFileName = `${path.parse(fileName).name}.mp4`;
      const finalPath = uniqueFilePath(dirPath, targetFileName);
      await removePathWithRetry(inputPath, { force: true }, 5, 100);
      await renameWithRetry(encodedPath, finalPath);
      console.log("Transcode done:", path.basename(finalPath));
    } catch (e) {
      console.log("Transcode failed, using original file:", fileName, String(e?.message || e));
    }
  }
}

function parseRequestOptions(rawOptions) {
  if (!rawOptions) return {};
  if (typeof rawOptions === "object") return rawOptions;
  try {
    return JSON.parse(String(rawOptions || "{}"));
  } catch {
    return {};
  }
}

function fileSignatureForDir(dirPath) {
  if (!safeExistsDir(dirPath)) return "";
  return safeReaddir(dirPath)
    .map((name) => {
      const full = path.join(dirPath, name);
      const stat = safeStat(full);
      return [name, Number(stat?.size || 0), Number(stat?.mtimeMs || 0)].join("|");
    })
    .sort((a, b) => a.localeCompare(b))
    .join("~");
}

async function cloneDir(sourceDir, targetDir) {
  ensureDir(targetDir);
  const entries = safeReaddir(sourceDir);
  for (const name of entries) {
    const from = path.join(sourceDir, name);
    const to = path.join(targetDir, name);
    fs.copyFileSync(from, to);
  }
}

function isQueuePaused() {
  return !!uploadQueue.getQueueSnapshot()?.paused;
}

function upsertJobResult(results, nextResult) {
  const deviceId = String(nextResult?.deviceId || "").trim();
  if (!deviceId) return results;
  const filtered = results.filter((item) => String(item?.deviceId || "").trim() !== deviceId);
  filtered.push({
    ...nextResult,
    deviceId,
    updatedAt: new Date().toISOString(),
  });
  return filtered;
}

function getEligibleTargetIds(job, retryOnlyFailed) {
  const targetIds = Array.isArray(job?.targets) ? job.targets : [];
  const previousResults = Array.isArray(job?.results) ? job.results : [];

  if (retryOnlyFailed) {
    const failedIds = previousResults
      .filter((item) => item?.status === "failed")
      .map((item) => item.deviceId)
      .filter(Boolean);
    return failedIds.length ? Array.from(new Set(failedIds)) : targetIds;
  }

  const completedStates = new Set(["success", "skipped"]);
  return targetIds.filter((deviceId) => {
    const prior = previousResults.find((item) => item?.deviceId === deviceId);
    return !prior || !completedStates.has(String(prior.status || ""));
  });
}

function getRetainedResults(previousResults, eligibleTargetIds) {
  const eligible = new Set(eligibleTargetIds.map((item) => String(item || "").trim()).filter(Boolean));
  return previousResults.filter((item) => !eligible.has(String(item?.deviceId || "").trim()));
}

async function processEnterpriseJob(jobId) {
  if (!jobId || activeEnterpriseJobs.has(jobId)) return;
  activeEnterpriseJobs.add(jobId);
  try {
    const snapshot = uploadQueue.getQueueSnapshot();
    if (snapshot.paused) return;
    const job = uploadQueue.getJob(jobId);
    if (!job || !job.spoolDir || !safeExistsDir(job.spoolDir)) {
      if (job) {
        uploadQueue.archiveJob(jobId, {
          status: "failed",
          overallProgress: 100,
          error: "spool-missing",
        });
      }
      return;
    }

    const requestOptions = job.options && typeof job.options === "object" ? job.options : {};
    const retryOnlyFailed = !!requestOptions.retryOnlyFailed;
    const previousResults = Array.isArray(job.results) ? job.results : [];
    const eligibleTargetIds = getEligibleTargetIds(job, retryOnlyFailed);
    const retainedResults = getRetainedResults(previousResults, eligibleTargetIds);

    if (!eligibleTargetIds.length) {
      const failed = retainedResults.filter((item) => item.status === "failed");
      const succeeded = retainedResults.filter((item) => item.status === "success");
      const status = failed.length ? (succeeded.length ? "partial" : "failed") : "success";
      if (status === "success") {
        uploadQueue.archiveJob(jobId, {
          status,
          overallProgress: 100,
          results: retainedResults,
        });
        try {
          fs.rmSync(job.spoolDir, { recursive: true, force: true });
        } catch {
        }
      } else {
        uploadQueue.updateJob(jobId, {
          status,
          overallProgress: 100,
          results: retainedResults,
        });
      }
      return;
    }

    const onlineFilter = !!requestOptions.skipOfflineDevices;
    const liveTargets = eligibleTargetIds.filter((deviceId) => {
      if (!onlineFilter) return true;
      if (deviceId === "all") return true;
      return !!global.isDeviceActivelyOnline?.(deviceId);
    });
    const skippedOffline = eligibleTargetIds
      .filter((deviceId) => !liveTargets.includes(deviceId))
      .map((deviceId) => ({
        deviceId,
        status: "skipped",
        reason: "offline",
      }));

    let results = [...retainedResults];
    let cursor = 0;
    let pauseRequested = false;
    const concurrency = Math.max(
      1,
      Math.min(
        5,
        Number(requestOptions.maxConcurrentUploads || snapshot.settings.maxConcurrentUploads || 3)
      )
    );
    uploadQueue.updateJob(jobId, {
      status: "uploading",
      retryOnlyFailed: false,
      overallProgress: Math.round((results.length / Math.max(1, eligibleTargetIds.length)) * 100),
      results,
    });

    const worker = async () => {
      while (cursor < liveTargets.length) {
        if (isQueuePaused()) {
          pauseRequested = true;
          return;
        }
        const index = cursor;
        cursor += 1;
        const deviceId = liveTargets[index];
        const tempDir = path.join(
          uploadsBase,
          deviceId,
          `section${job.section}__incoming_enterprise_${Date.now()}_${index}`
        );
        try {
          results = upsertJobResult(results, { deviceId, status: "uploading" });
          uploadQueue.updateJob(jobId, {
            status: "uploading",
            overallProgress: Math.round((results.filter((item) => item.status !== "uploading").length / Math.max(1, eligibleTargetIds.length)) * 100),
            results,
          });
          if (
            requestOptions.skipIfSameExists &&
            fileSignatureForDir(resolveActiveSectionDir(deviceId, job.section)) === job.fileHash
          ) {
            results = upsertJobResult(results, { deviceId, status: "skipped", reason: "duplicate" });
          } else {
            await cloneDir(job.spoolDir, tempDir);
            await processIncomingSection(deviceId, String(job.section), tempDir, job.requestBody || {});
            results = upsertJobResult(results, { deviceId, status: "success" });
          }
        } catch (error) {
          try {
            if (safeExists(tempDir)) {
              fs.rmSync(tempDir, { recursive: true, force: true });
            }
          } catch {
          }
          results = upsertJobResult(results, {
            deviceId,
            status: "failed",
            reason: humanizeUploadError(error, "Enterprise upload failed"),
          });
        }
        uploadQueue.updateJob(jobId, {
          status: "uploading",
          overallProgress: Math.round((results.length / Math.max(1, eligibleTargetIds.length)) * 100),
          results,
        });
      }
    };

    await Promise.allSettled(
      Array.from({ length: Math.min(concurrency, Math.max(1, liveTargets.length)) }, () => worker())
    );

    if (pauseRequested || isQueuePaused()) {
      uploadQueue.updateJob(jobId, {
        status: "pending",
        overallProgress: Math.round((results.filter((item) => item.status !== "uploading").length / Math.max(1, eligibleTargetIds.length)) * 100),
        results,
      });
      uploadQueue.appendLog("Enterprise upload paused", {
        jobId,
        completedTargets: results.filter((item) => item.status === "success").length,
      });
      return;
    }

    const normalizedResults = skippedOffline.reduce(
      (acc, item) => upsertJobResult(acc, item),
      [...results]
    );
    const failed = normalizedResults.filter((item) => item.status === "failed");
    const succeeded = normalizedResults.filter((item) => item.status === "success");
    const status = failed.length ? (succeeded.length ? "partial" : "failed") : "success";

    if (status === "success") {
      uploadQueue.archiveJob(jobId, {
        status,
        overallProgress: 100,
        results: normalizedResults,
      });
      try {
        fs.rmSync(job.spoolDir, { recursive: true, force: true });
      } catch {
      }
      return;
    }

    uploadQueue.updateJob(jobId, {
      status,
      overallProgress: 100,
      results: normalizedResults,
    });
  } finally {
    activeEnterpriseJobs.delete(jobId);
    if (!isQueuePaused()) {
      setTimeout(() => {
        try {
          schedulePendingEnterpriseJobs();
        } catch {
        }
      }, 50);
    }
  }
}

function schedulePendingEnterpriseJobs() {
  const snapshot = uploadQueue.getQueueSnapshot();
  if (snapshot.paused) return;
  const candidates = (snapshot.jobs || [])
    .filter((job) => ["pending", "uploading", "failed", "partial"].includes(String(job.status || "")))
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  const availableSlots = Math.max(0, 1 - activeEnterpriseJobs.size);
  for (const job of candidates.slice(0, availableSlots)) {
    processEnterpriseJob(job.id).catch((error) => {
      uploadQueue.appendLog("Enterprise job crashed", {
        jobId: job.id,
        error: String(error?.message || error),
      });
    });
  }
}

async function processIncomingSection(deviceId, section, tempSectionPath, requestBody = {}) {
  const incomingFiles = safeExistsDir(tempSectionPath)
    ? safeReaddir(tempSectionPath)
    : [];
  const presentationFiles = incomingFiles.filter((name) =>
    /\.(ppt|pptx|pptm|pps|ppsx|potx)$/i.test(String(name || ""))
  );
  if (presentationFiles.length) {
    emitSectionUploadStatus(
      deviceId,
      section,
      "processing",
      "Converting PowerPoint to images... Please wait."
    );
    for (const fileName of presentationFiles) {
      const fullPath = path.join(tempSectionPath, fileName);
      await convertPresentationToImages(fullPath, tempSectionPath);
      await removePathWithRetry(fullPath, { force: true }, 3, 120);
    }
  }
  const incomingHasVideo = incomingFiles.some((name) =>
    VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase())
  );
  const incomingHasPpt =
    String(requestBody?.containsPpt || "").trim() === "1" ||
    incomingFiles.some((name) =>
      PPT_EXTENSIONS.has(path.extname(name).toLowerCase())
    );
  if (incomingHasPpt) {
    try {
      fs.writeFileSync(path.join(tempSectionPath, PPT_MARKER_NAME), "1", "utf8");
    } catch {
    }
  }
  if (incomingHasVideo && anyOtherSectionHasVideoOrPpt(deviceId, section)) {
    throw new Error("Video/PPT allowed in only one grid section. Remove PPT/video from all sections first.");
  }
  if (incomingHasPpt && anyOtherSectionHasVideoOrPpt(deviceId, section)) {
    throw new Error("PPT/video allowed in only one grid section. Remove PPT/video from all sections first.");
  }

  if (incomingHasVideo) {
    emitSectionUploadStatus(
      deviceId,
      section,
      "processing",
      "Processing video for TV compatibility... Please wait."
    );
    await optimizeVideosInDirectory(tempSectionPath);
  }

  const activation = await activateIncomingSection(deviceId, section, tempSectionPath);

  if (deviceId === "all" && safeExistsDir(uploadsBase)) {
    const folders = safeReaddir(uploadsBase);
    for (const folder of folders) {
      if (folder === "all") continue;
      clearDeviceTimeline(folder);
      const { sectionBase, versionsDir, activeFile } = sectionPaths(folder, section);
      try {
        if (safeExists(sectionBase)) {
          fs.rmSync(sectionBase, { recursive: true, force: true });
        }
        if (safeExists(versionsDir)) {
          fs.rmSync(versionsDir, { recursive: true, force: true });
        }
        if (safeExists(activeFile)) {
          fs.rmSync(activeFile, { force: true });
        }
      } catch {
      }
    }
  }

  if (global.io) {
    const syncAt = Date.now() + 500;
    const timeline = updateSectionTimeline(deviceId, section, {
      targetDevice: deviceId,
      syncAt,
      updatedAt: activation?.updatedAt || Date.now(),
      cycleId: `${section}-${String(activation?.versionName || Date.now())}`,
      fileCount: Array.isArray(activation?.activeFiles) ? activation.activeFiles.length : 0,
      mediaSignature: Array.isArray(activation?.activeFiles)
        ? activation.activeFiles.join("|")
        : "",
    });
    if (deviceId === "all") {
      global.io.emit("media-updated", { syncAt, section, timeline });
    } else if (global.connectedDevices?.[deviceId]) {
      const socketId = global.connectedDevices[deviceId];
      global.io.to(socketId).emit("media-updated", { syncAt, section, timeline });
    }
  }

  emitSectionUploadStatus(deviceId, section, "ready", "");
  return activation;
}

router.post("/:deviceId/section/:section", (req, res, next) => {
  const deviceId = sanitizeDeviceId(req.params.deviceId);
  if (String(req.params.deviceId || "").trim() === "enterprise") {
    return next();
  }
  if (!deviceId) {
    return res.status(400).json({ ok: false, error: "invalid-device-id" });
  }
  const section = req.params.section;

  const uploadToken = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const tempSectionPath = path.join(
    uploadsBase,
    deviceId,
    `section${section}__incoming_${uploadToken}`
  );

  try {
    cleanupStaleIncomingDirs(deviceId, section);
    ensureDir(tempSectionPath);

    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, tempSectionPath),
      filename: (reqRef, file, cb) => cb(null, sanitizeFileName(file, reqRef)),
    });

    const upload = multer({
      storage,
      limits: {
        fileSize: MAX_FILE_SIZE_BYTES,
        files: MAX_FILES_PER_UPLOAD,
      },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname || "").toLowerCase();
        const mime = String(file.mimetype || "").toLowerCase();
        if (!ALLOWED_EXTENSIONS.has(ext) && !ALLOWED_MIME_TYPES.has(mime)) {
          return cb(new Error(`Unsupported file type: ${file.originalname}`));
        }
        cb(null, true);
      },
    }).array("files");

    emitSectionUploadStatus(
      deviceId,
      section,
      "processing",
      "Uploading media... Please wait."
    );

    upload(req, res, async (err) => {
      try {
        if (err) {
          if (safeExists(tempSectionPath)) {
            try {
              fs.rmSync(tempSectionPath, { recursive: true, force: true });
            } catch (_e) {}
          }

          const message =
            err instanceof multer.MulterError
              ? err.code === "LIMIT_FILE_SIZE"
                ? `File too large. Max allowed is ${Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024))} GB per file.`
                : err.code === "LIMIT_FILE_COUNT"
                ? `Too many files. Max allowed is ${MAX_FILES_PER_UPLOAD} files.`
                : humanizeUploadError(err, "Upload failed")
              : humanizeUploadError(err, "Upload failed");

          console.error("Upload error:", message);
          emitSectionUploadStatus(deviceId, section, "error", message);
          return res.status(400).json({ error: message });
        }

        const activation = await processIncomingSection(deviceId, section, tempSectionPath, req.body);

        console.log(
          "New files saved in:",
          path.join(uploadsBase, deviceId, `section${section}`)
        );
        return res.json({ success: true });
      } catch (innerError) {
        if (safeExists(tempSectionPath)) {
          try {
            fs.rmSync(tempSectionPath, { recursive: true, force: true });
          } catch (_e) {}
        }
        const message = humanizeUploadError(innerError, "Upload failed on server");
        console.log("Upload error:", innerError);
        emitSectionUploadStatus(deviceId, section, "error", message);
        return res.status(500).json({ error: message });
      }
    });
  } catch (error) {
    if (safeExists(tempSectionPath)) {
      try {
        fs.rmSync(tempSectionPath, { recursive: true, force: true });
      } catch (_e) {}
    }
    console.log("Upload error:", error);
    emitSectionUploadStatus(deviceId, section, "error", humanizeUploadError(error, "Upload failed on server"));
    return res.status(500).json({ error: humanizeUploadError(error, "Upload failed on server") });
  }
});

router.post("/enterprise/section/:section", (req, res) => {
  const section = Number(req.params.section || 1);
  const spoolToken = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const spoolDir = path.join(uploadsBase, `_enterprise_spool_${spoolToken}`);
  ensureDir(spoolDir);

  const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, spoolDir),
    filename: (reqRef, file, cb) => cb(null, sanitizeFileName(file, reqRef)),
  });
  const upload = multer({
    storage,
    limits: {
      fileSize: MAX_FILE_SIZE_BYTES,
      files: MAX_FILES_PER_UPLOAD,
    },
  }).array("files");

  upload(req, res, async (err) => {
    if (err) {
      try {
        fs.rmSync(spoolDir, { recursive: true, force: true });
      } catch {
      }
      return res.status(400).json({ ok: false, error: humanizeUploadError(err, "Enterprise upload failed") });
    }

    try {
      const requestOptions = parseRequestOptions(req.body?.options);
      const targetIds = normalizeDeviceIdList(req.body?.deviceIds || req.body?.targets);
      if (!targetIds.length) {
        throw new Error("device-targets-required");
      }

      const fileName = safeReaddir(spoolDir)[0] || "upload";
      const fileHash = fileSignatureForDir(spoolDir);
      const job = uploadQueue.createJob({
        section,
        fileName,
        fileHash,
        fileSize: safeReaddir(spoolDir)
          .map((name) => Number(safeStat(path.join(spoolDir, name))?.size || 0))
          .reduce((sum, size) => sum + size, 0),
        targets: targetIds,
        priority: Number(requestOptions.priority || 0),
        options: requestOptions,
        spoolDir,
        requestBody: {
          containsPpt: req.body?.containsPpt,
        },
      });

      schedulePendingEnterpriseJobs();
      return res.json({
        ok: true,
        jobId: job.id,
        queued: true,
      });
    } catch (error) {
      try {
        fs.rmSync(spoolDir, { recursive: true, force: true });
      } catch {
      }
      return res.status(500).json({
        ok: false,
        error: humanizeUploadError(error, "Enterprise upload failed"),
      });
    }
  });
});

global.processPendingEnterpriseUploads = schedulePendingEnterpriseJobs;
setTimeout(() => {
  try {
    schedulePendingEnterpriseJobs();
  } catch {
  }
}, 1000);

module.exports = router;

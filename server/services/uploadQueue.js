const path = require("path");
const crypto = require("crypto");
const { readJsonFile, writeJsonFile } = require("./jsonStore");

const basePath = process.pkg
  ? (global.runtimeBasePath || path.dirname(process.execPath))
  : path.join(__dirname, "..");

const DATA_FILE = path.join(basePath, "data", "upload-queue.json");
const HISTORY_LIMIT = 120;

function defaultState() {
  return {
    settings: {
      maxConcurrentUploads: 3,
      groupSize: 5,
    },
    paused: false,
    jobs: [],
    history: [],
    logs: [],
    updatedAt: null,
  };
}

function readState() {
  const state = readJsonFile(DATA_FILE, defaultState());
  return {
    ...defaultState(),
    ...state,
    jobs: Array.isArray(state.jobs) ? state.jobs : [],
    history: Array.isArray(state.history) ? state.history : [],
    logs: Array.isArray(state.logs) ? state.logs : [],
    settings: {
      ...defaultState().settings,
      ...(state.settings && typeof state.settings === "object" ? state.settings : {}),
    },
  };
}

function writeState(state) {
  writeJsonFile(DATA_FILE, {
    ...defaultState(),
    ...state,
    updatedAt: new Date().toISOString(),
  });
}

function appendLog(message, meta = {}) {
  const state = readState();
  state.logs = [
    {
      id: crypto.randomBytes(8).toString("hex"),
      time: new Date().toISOString(),
      message: String(message || "").slice(0, 400),
      meta: meta && typeof meta === "object" ? meta : {},
    },
    ...state.logs,
  ].slice(0, HISTORY_LIMIT * 2);
  writeState(state);
}

function getQueueSnapshot() {
  return readState();
}

function updateSettings(patch = {}) {
  const state = readState();
  const maxConcurrentUploads = Math.max(1, Math.min(5, Number(patch.maxConcurrentUploads || state.settings.maxConcurrentUploads || 3)));
  const groupSize = Math.max(1, Math.min(50, Number(patch.groupSize || state.settings.groupSize || 5)));
  state.settings = {
    maxConcurrentUploads,
    groupSize,
  };
  writeState(state);
  return state.settings;
}

function setPaused(paused) {
  const state = readState();
  state.paused = !!paused;
  writeState(state);
  return state.paused;
}

function createJob(payload = {}) {
  const state = readState();
  const job = {
    id: crypto.randomBytes(12).toString("hex"),
    section: Number(payload.section || 1),
    fileName: String(payload.fileName || ""),
    fileHash: String(payload.fileHash || ""),
    fileSize: Number(payload.fileSize || 0),
    targets: Array.isArray(payload.targets) ? payload.targets : [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    status: "pending",
    overallProgress: 0,
    priority: Number(payload.priority || 0),
    options: payload.options && typeof payload.options === "object" ? payload.options : {},
  };
  state.jobs.push(job);
  writeState(state);
  appendLog("Upload job queued", { jobId: job.id, targets: job.targets.length });
  return job;
}

function updateJob(jobId, patch = {}) {
  const state = readState();
  const index = state.jobs.findIndex((job) => job.id === jobId);
  if (index < 0) return null;
  state.jobs[index] = {
    ...state.jobs[index],
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  writeState(state);
  return state.jobs[index];
}

function getJob(jobId) {
  const state = readState();
  return state.jobs.find((job) => job.id === jobId) || null;
}

function archiveJob(jobId, patch = {}) {
  const state = readState();
  const index = state.jobs.findIndex((job) => job.id === jobId);
  if (index < 0) return null;
  const job = {
    ...state.jobs[index],
    ...patch,
    updatedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };
  state.jobs.splice(index, 1);
  state.history = [job, ...state.history].slice(0, HISTORY_LIMIT);
  writeState(state);
  appendLog("Upload job completed", { jobId, status: job.status });
  return job;
}

function removeJob(jobId) {
  const state = readState();
  const index = state.jobs.findIndex((job) => job.id === jobId);
  if (index < 0) return null;
  const [job] = state.jobs.splice(index, 1);
  writeState(state);
  return job;
}

module.exports = {
  appendLog,
  getQueueSnapshot,
  getJob,
  updateSettings,
  setPaused,
  createJob,
  updateJob,
  archiveJob,
  removeJob,
};

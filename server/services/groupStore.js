const path = require("path");
const { readJsonFile, writeJsonFile } = require("./jsonStore");

const basePath = process.pkg
  ? (global.runtimeBasePath || path.dirname(process.execPath))
  : path.join(__dirname, "..");

const DATA_FILE = path.join(basePath, "data", "groups.json");

function readState() {
  const state = readJsonFile(DATA_FILE, {
    groups: [],
    updatedAt: null,
  });
  const groups = Array.isArray(state.groups) ? state.groups : [];
  return {
    groups: groups.map(normalizeGroup).filter(Boolean),
    updatedAt: state.updatedAt || null,
  };
}

function writeState(state) {
  writeJsonFile(DATA_FILE, {
    groups: Array.isArray(state?.groups) ? state.groups.map(normalizeGroup).filter(Boolean) : [],
    updatedAt: new Date().toISOString(),
  });
}

function normalizeGroup(group) {
  if (!group || typeof group !== "object") return null;
  const id = String(group.id || "").trim();
  const name = String(group.name || "").trim();
  const devices = Array.isArray(group.devices)
    ? Array.from(new Set(group.devices.map((item) => String(item || "").trim()).filter(Boolean)))
    : [];
  if (!id || !name) return null;
  return {
    id,
    name,
    devices,
    createdAt: group.createdAt || new Date().toISOString(),
    updatedAt: group.updatedAt || new Date().toISOString(),
  };
}

function makeId(name) {
  const base = String(name || "group")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "group"}-${Math.random().toString(36).slice(2, 8)}`;
}

function listGroups() {
  return readState().groups;
}

function replaceGroups(groups = []) {
  const normalized = (Array.isArray(groups) ? groups : [])
    .map((group) => normalizeGroup(group))
    .filter(Boolean);
  writeState({ groups: normalized });
  return normalized;
}

function saveGroup(name, devices = [], id = "") {
  const trimmed = String(name || "").trim();
  if (!trimmed) {
    return { ok: false, error: "group-name-required" };
  }
  const state = readState();
  const duplicate = state.groups.find(
    (group) =>
      group.name.toLowerCase() === trimmed.toLowerCase() &&
      (!id || group.id !== id)
  );
  if (duplicate) {
    return { ok: false, error: "group-name-duplicate" };
  }

  const nowIso = new Date().toISOString();
  const normalizedDevices = Array.from(
    new Set((Array.isArray(devices) ? devices : []).map((item) => String(item || "").trim()).filter(Boolean))
  );
  const existingIndex = state.groups.findIndex((group) => group.id === id);
  const group = {
    id: existingIndex >= 0 ? id : makeId(trimmed),
    name: trimmed,
    devices: normalizedDevices,
    createdAt: existingIndex >= 0 ? state.groups[existingIndex].createdAt : nowIso,
    updatedAt: nowIso,
  };

  if (existingIndex >= 0) {
    state.groups[existingIndex] = group;
  } else {
    state.groups.push(group);
  }
  writeState(state);
  return { ok: true, group };
}

function deleteGroup(id) {
  const state = readState();
  const nextGroups = state.groups.filter((group) => group.id !== id);
  if (nextGroups.length === state.groups.length) {
    return { ok: false, error: "group-not-found" };
  }
  writeState({ groups: nextGroups });
  return { ok: true };
}

function autoCreateGroups(deviceIds = [], chunkSize = 5) {
  const ids = Array.from(new Set((Array.isArray(deviceIds) ? deviceIds : []).map((item) => String(item || "").trim()).filter(Boolean)));
  const size = Math.max(1, Math.min(100, Number(chunkSize || 5)));
  const created = [];
  for (let index = 0; index < ids.length; index += size) {
    const items = ids.slice(index, index + size);
    const label = `Group ${Math.floor(index / size) + 1}`;
    const saved = saveGroup(label, items);
    if (saved.ok) {
      created.push(saved.group);
    }
  }
  return created;
}

module.exports = {
  listGroups,
  replaceGroups,
  saveGroup,
  deleteGroup,
  autoCreateGroups,
};

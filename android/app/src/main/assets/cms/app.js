const SUPPORTED_FILE_EXT = /\.(mp4|mov|mkv|webm|jpg|jpeg|png|txt|pdf|ppt|pptx|pptm|pps|ppsx|potx)$/i;
const VIDEO_FILE_EXT = /\.(mp4|mov|mkv|webm)$/i;
const PPT_FILE_EXT = /\.(ppt|pptx|pptm|pps|ppsx|potx)$/i;
const PPTX_FILE_EXT = /\.(pptx|pptm|ppsx|potx)$/i;
const PPT_LEGACY_EXT = /\.(ppt|pps)$/i;
const PPTX_CANVAS_WIDTH = 1920;
const PPTX_CANVAS_HEIGHT = 1080;
const PPTX_RENDER_DPR = 1;
const MAX_FILES_PER_UPLOAD = 120;
const HARD_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;
const WARN_FILE_SIZE_BYTES = 700 * 1024 * 1024;
const DEFAULT_UPLOAD_TIMEOUT_MS = 15 * 60 * 1000;
const MIN_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_UPLOAD_TIMEOUT_MS = 120 * 60 * 1000;
const MULTI_DEVICE_UPLOAD_RETRIES = 2;
const MULTI_DEVICE_RETRY_DELAY_MS = 1800;
const UPLOAD_TIMEOUT_STORAGE_KEY = "cmsUploadTimeoutMs";

const GRID3_LAYOUTS = [
  { id: "stack-v", label: "Stack Vertical" },
  { id: "stack-h", label: "Stack Horizontal" },
  { id: "top-two-bottom-one", label: "Top 2 / Bottom 1" },
  { id: "top-one-bottom-two", label: "Top 1 / Bottom 2" },
];
const GRID2_LAYOUTS = [
  { id: "stack-h", label: "Horizontal Split" },
  { id: "stack-v", label: "Vertical Split" },
];

const SECTION_SOURCE_TYPES = {
  multimedia: "multimedia",
  web: "web",
  youtube: "youtube",
};

let selectedGrid3Layout = "stack-v";
let currentConfig = null;
let previewMediaBySection = { 1: [], 2: [], 3: [] };
let previewSectionState = {
  1: { index: 0, timer: null },
  2: { index: 0, timer: null },
  3: { index: 0, timer: null },
};
let previewPollTimer = null;
let alertsPollTimer = null;
let selectedGridRatio = "1:1:1";
let latestDeviceStatusList = [];
let isDeviceDashboardOpen = false;
const SELECTED_ORIGINS_STORAGE_KEY = "tvCmsSelectedOrigins";
const seenApkUpdateSuccessNotices = new Set();
let currentDeviceMap = new Map();
let selectedDeviceOrigins = new Set(loadStoredSelectedOrigins());
let cmsAccessOverrides = {};
const IS_TV_COMPACT_MODE = new URLSearchParams(window.location.search).get("tv") === "1";
const DEVICE_SCAN_PORTS = (() => {
  const currentPort = Number(window.location.port || "8080") || 8080;
  return Array.from(new Set([currentPort, 8080, 8081, 9090, 10080]));
})();
let subnetScanInFlight = null;
let lastSubnetScanAt = 0;
let localNetworkState = {
  connected: true,
  internet: true,
  transport: "wifi",
  localOnlyMode: false,
};
const tvPickedState = {
  1: { count: 0, ready: false },
  2: { count: 0, ready: false },
  3: { count: 0, ready: false },
};

function setLoaderVisibility(visible) {
  const loader = document.getElementById("uploadLoader");
  if (!loader) return;
  loader.classList.toggle("hidden", !visible);
}

function clampUploadTimeoutMs(value) {
  const parsed = Number(value || 0);
  if (!Number.isFinite(parsed)) return DEFAULT_UPLOAD_TIMEOUT_MS;
  return Math.max(MIN_UPLOAD_TIMEOUT_MS, Math.min(MAX_UPLOAD_TIMEOUT_MS, Math.round(parsed)));
}

function loadStoredUploadTimeoutMs() {
  try {
    return clampUploadTimeoutMs(window.localStorage.getItem(UPLOAD_TIMEOUT_STORAGE_KEY));
  } catch (_e) {
    return DEFAULT_UPLOAD_TIMEOUT_MS;
  }
}

let uploadTimeoutMs = loadStoredUploadTimeoutMs();

function getUploadTimeoutMs() {
  return clampUploadTimeoutMs(uploadTimeoutMs);
}

function syncUploadTimeoutInput() {
  const input = document.getElementById("uploadTimeoutMinutes");
  if (!input) return;
  input.value = String(Math.round(getUploadTimeoutMs() / 60000));
}

function setUploadTimeoutMinutes(value) {
  const nextMs = clampUploadTimeoutMs(Number(value || 0) * 60000);
  uploadTimeoutMs = nextMs;
  try {
    window.localStorage.setItem(UPLOAD_TIMEOUT_STORAGE_KEY, String(nextMs));
  } catch (_e) {
  }
  syncUploadTimeoutInput();
  return nextMs;
}

function loadStoredSelectedOrigins() {
  try {
    const raw = window.localStorage.getItem(SELECTED_ORIGINS_STORAGE_KEY);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map((item) => normalizeOrigin(item)).filter(Boolean) : [];
  } catch (_e) {
    return [];
  }
}

function persistSelectedOrigins() {
  try {
    window.localStorage.setItem(
      SELECTED_ORIGINS_STORAGE_KEY,
      JSON.stringify(Array.from(selectedDeviceOrigins).filter(Boolean))
    );
  } catch (_e) {
  }
}

function getCurrentOrigin() {
  return window.location.origin;
}

function getCmsAuthPassword() {
  try {
    const fromWindow = typeof window.enterpriseGetAuthPassword === "function"
      ? String(window.enterpriseGetAuthPassword() || "").trim()
      : "";
    if (fromWindow) return fromWindow;
  } catch (_e) {
  }
  try {
    return String(window.sessionStorage.getItem("tvCmsAuthPassword") || "0408").trim() || "0408";
  } catch (_e) {
    return "0408";
  }
}

function buildCmsAuthHeaders(baseHeaders = {}) {
  const headers = { ...(baseHeaders || {}) };
  const password = getCmsAuthPassword();
  if (password) {
    headers["X-CMS-Password"] = password;
  }
  return headers;
}

function buildLocalTvDevice(status = {}) {
  const normalizedOrigin = getCurrentOrigin();
  return {
    name: String(status?.name || "This TV"),
    deviceId: String(status?.deviceId || "local-tv"),
    ip: String(status?.ip || window.location.hostname || "127.0.0.1"),
    hostname: String(status?.hostname || ""),
    localUrl: normalizedOrigin,
    publicUrl: normalizedOrigin,
    origin: normalizedOrigin,
    online: true,
    preferredPort: Number(status?.preferredPort || window.location.port || 8080),
    port: Number(status?.port || window.location.port || 8080),
    appState: String(status?.appState || "running"),
    meta: status?.meta && typeof status.meta === "object" ? status.meta : {},
    runtime: status?.runtime && typeof status.runtime === "object" ? status.runtime : {},
    lastSeen: Number(status?.lastSeen || Date.now()),
  };
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw.replace(/\/+$/, "");
  const hasPort = /:\d+$/.test(raw);
  return `http://${raw.replace(/\/+$/, "")}${hasPort ? "" : `:${window.location.port || "8080"}`}`;
}

function sanitizePort(value) {
  const port = Number(value || 0);
  if (!Number.isFinite(port) || port < 1024 || port > 65535) return 0;
  return Math.round(port);
}

function getAccessOverride(deviceOrId) {
  const deviceId = typeof deviceOrId === "string"
    ? deviceOrId
    : String(deviceOrId?.deviceId || "").trim();
  if (!deviceId) return null;
  const item = cmsAccessOverrides?.[deviceId];
  return item && typeof item === "object" ? item : null;
}

function withPreferredPort(origin, preferredPort) {
  const normalized = normalizeOrigin(origin);
  const safePort = sanitizePort(preferredPort);
  if (!normalized || !safePort) return normalized;
  try {
    const url = new URL(normalized);
    url.port = String(safePort);
    return url.toString().replace(/\/+$/, "");
  } catch (_e) {
    return normalized.replace(/:\d+$/, `:${safePort}`);
  }
}

function getDeviceOptionValue(device) {
  const override = getAccessOverride(device);
  if (override?.origin) {
    return withPreferredPort(override.origin, override.preferredPort || device?.preferredPort || device?.port);
  }
  const base = normalizeOrigin(device?.publicUrl || device?.localUrl || device?.origin || "");
  return withPreferredPort(base, override?.preferredPort || device?.preferredPort || device?.port);
}

function rebuildHiddenDeviceSelectOptions() {
  const select = document.getElementById("deviceSelect");
  if (!select) return;
  select.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Devices";
  select.appendChild(allOption);

  Array.from(currentDeviceMap.values()).forEach((device) => {
    const value = getDeviceOptionValue(device);
    if (!value) return;
    const opt = document.createElement("option");
    opt.value = value;
    opt.textContent = device.name
      ? `${device.name} (${device.deviceId || device.ip || value})`
      : (device.deviceId || device.ip || value);
    select.appendChild(opt);
  });
}

function upsertDiscoveredDevices(devices = []) {
  if (!Array.isArray(devices) || !devices.length) return;
  for (const device of devices) {
    const value = getDeviceOptionValue(device);
    if (!value) continue;
    const existing = currentDeviceMap.get(value) || {};
    currentDeviceMap.set(value, {
      ...existing,
      ...device,
      accessOverride: getAccessOverride(device),
      origin: value,
    });
  }
}

async function loadAccessOverrides() {
  try {
    const res = await fetch(`/api/access-overrides?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json().catch(() => ({}));
    cmsAccessOverrides = data?.overrides && typeof data.overrides === "object"
      ? data.overrides
      : {};
  } catch (_e) {
    cmsAccessOverrides = {};
  }
}

async function probeDeviceOrigin(origin) {
  const normalized = normalizeOrigin(origin);
  if (!normalized) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 900);
  try {
    const res = await fetch(`${normalized}/status?ts=${Date.now()}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const status = await res.json();
    return {
      ...status,
      online: status?.online !== false,
      publicUrl: normalizeOrigin(status?.publicUrl || normalized),
      localUrl: normalizeOrigin(status?.localUrl || ""),
      origin: normalizeOrigin(status?.publicUrl || normalized),
    };
  } catch (_e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function scanSubnetForDevices(force = false) {
  if (IS_TV_COMPACT_MODE) return null;
  const now = Date.now();
  if (subnetScanInFlight) return subnetScanInFlight;
  if (!force && now - lastSubnetScanAt < 20000) return null;
  lastSubnetScanAt = now;

  subnetScanInFlight = (async () => {
    try {
      const selfStatus = await probeDeviceOrigin(getCurrentOrigin());
      const ip = String(selfStatus?.ip || "").trim();
      const parts = ip.split(".");
      if (parts.length !== 4) return;

      const selfOrigin = getCurrentOrigin();
      const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
      const candidates = [];
      const seen = new Set();
      for (let host = 1; host < 255; host += 1) {
        for (const port of DEVICE_SCAN_PORTS) {
          const candidate = `http://${prefix}.${host}:${port}`;
          if (candidate === selfOrigin) continue;
          if (seen.has(candidate)) continue;
          seen.add(candidate);
          candidates.push(candidate);
        }
      }
      Object.values(cmsAccessOverrides || {}).forEach((item) => {
        const candidate = withPreferredPort(item?.origin || "", item?.preferredPort);
        if (!candidate || candidate === selfOrigin || seen.has(candidate)) return;
        seen.add(candidate);
        candidates.push(candidate);
      });

      for (let i = 0; i < candidates.length; i += 48) {
        const batch = candidates.slice(i, i + 48);
        const results = await Promise.all(batch.map((origin) => probeDeviceOrigin(origin)));
        const found = results.filter(Boolean);
        if (found.length) {
          upsertDiscoveredDevices(found);
          const previousSelected = new Set(selectedDeviceOrigins);
          const nextSelected = Array.from(previousSelected).filter((value) => currentDeviceMap.has(value));
          if (nextSelected.length) {
            selectedDeviceOrigins = new Set(nextSelected);
          } else if (!previousSelected.size) {
            selectedDeviceOrigins = new Set(Array.from(currentDeviceMap.keys()));
          }
          rebuildHiddenDeviceSelectOptions();
          syncHiddenDeviceSelect();
          persistSelectedOrigins();
          renderDeviceChecklist();
        }
      }
    } finally {
      subnetScanInFlight = null;
    }
  })();

  return subnetScanInFlight;
}

function getSelectedDeviceValue() {
  const selectedEntries = getSelectedDeviceEntries();
  if (!selectedEntries.length) return "";
  return selectedEntries.length === 1 ? getDeviceOptionValue(selectedEntries[0]) : "all";
}

function getSelectedDeviceEntries() {
  const devices = Array.from(currentDeviceMap.values());
  if (!devices.length) return [];
  const selected = devices.filter((device) => selectedDeviceOrigins.has(getDeviceOptionValue(device)));
  return selected;
}

function getSelectedOrigins() {
  return getSelectedDeviceEntries()
    .map((device) => getDeviceOptionValue(device))
    .filter(Boolean);
}

function getEffectiveTargetOrigins() {
  if (IS_TV_COMPACT_MODE) {
    return [getCurrentOrigin()];
  }
  const selected = getSelectedOrigins();
  return selected.length ? selected : [];
}

function getOnlineTargetDevices() {
  if (IS_TV_COMPACT_MODE) {
    const localDevice = Array.from(currentDeviceMap.values())[0];
    return {
      onlineTargets: localDevice ? [localDevice] : [],
      offlineTargets: [],
    };
  }
  const selectedEntries = getSelectedDeviceEntries();
  const onlineTargets = [];
  const offlineTargets = [];
  selectedEntries.forEach((device) => {
    if (device?.online === false) offlineTargets.push(device);
    else onlineTargets.push(device);
  });
  return { onlineTargets, offlineTargets };
}

function getPrimaryOrigin() {
  return getSelectedOrigins()[0] || Array.from(currentDeviceMap.keys())[0] || getCurrentOrigin();
}

function syncHiddenDeviceSelect() {
  const select = document.getElementById("deviceSelect");
  if (!select) return;
  const selectedEntries = getSelectedDeviceEntries();
  select.value = selectedEntries.length === 1
    ? getDeviceOptionValue(selectedEntries[0])
    : "all";
}

function updateDeviceSelectionSummary() {
  const summary = document.getElementById("deviceSelectionSummary");
  if (!summary) return;
  if (IS_TV_COMPACT_MODE) {
    summary.textContent = "Managing this TV only.";
    return;
  }
  const total = currentDeviceMap.size;
  const selected = getSelectedOrigins().length;
  if (!total) {
    summary.textContent = "Scanning devices...";
    return;
  }
  if (!selected) {
    summary.textContent = "No device selected";
    return;
  }
  summary.textContent =
    selected === total
      ? `All ${total} device${total === 1 ? "" : "s"} selected${localNetworkState?.internet ? "" : " - local only mode"}`
      : `${selected} of ${total} device${total === 1 ? "" : "s"} selected${localNetworkState?.internet ? "" : " - local only mode"}`;
}

async function refreshLocalNetworkState() {
  try {
    const res = await fetch(`/network-state?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    if (data && typeof data === "object") {
      localNetworkState = {
        connected: !!data.connected,
        internet: !!data.internet,
        transport: String(data.transport || "none"),
        localOnlyMode: !!data.localOnlyMode,
      };
    }
  } catch (_e) {
  }
}

function renderDeviceChecklist() {
  const container = document.getElementById("deviceChecklist");
  if (!container) return;

  const devices = Array.from(currentDeviceMap.values());
  if (!devices.length) {
    container.innerHTML = `<div class="device-checklist-empty">Scanning devices...</div>`;
    updateDeviceSelectionSummary();
    return;
  }

  if (IS_TV_COMPACT_MODE) {
    const localDevice = devices[0];
    const origin = getDeviceOptionValue(localDevice);
    const checked = selectedDeviceOrigins.has(origin);
    container.innerHTML = `
      <label class="device-select-card ${checked ? "is-selected" : ""}">
        <input type="checkbox" checked disabled />
        <div>
          <div class="device-select-title">${localDevice?.name || "This TV"}</div>
          <div class="device-select-meta">${localDevice?.deviceId || "local-tv"}<br/>${localDevice?.ip || origin}</div>
        </div>
        <div class="device-select-status online">This TV</div>
      </label>
    `;
    updateDeviceSelectionSummary();
    return;
  }

  const allSelected = devices.every((device) => selectedDeviceOrigins.has(getDeviceOptionValue(device)));
  const cards = [
    `
      <label class="device-select-card ${allSelected ? "is-selected" : ""}">
        <input type="checkbox" ${allSelected ? "checked" : ""} onchange="selectAllDevices(this.checked)" />
        <div>
          <div class="device-select-title">All Connected Devices</div>
          <div class="device-select-meta">Apply settings, uploads, cache actions, and app updates to every online TV.</div>
        </div>
        <div class="device-select-status ${allSelected ? "online" : "offline"}">${allSelected ? "Selected" : "Custom"}</div>
      </label>
    `,
  ];

  devices.forEach((device) => {
    const origin = getDeviceOptionValue(device);
    const checked = selectedDeviceOrigins.has(origin);
    cards.push(`
      <label class="device-select-card ${checked ? "is-selected" : ""}">
        <input type="checkbox" ${checked ? "checked" : ""} onchange="toggleDeviceSelection('${origin}', this.checked)" />
        <div>
          <div class="device-select-title">${device.name || device.deviceId || "Unnamed TV"}</div>
          <div class="device-select-meta">${device.deviceId || "-"}<br/>${device.ip || origin}${device.hostname ? ` • ${device.hostname}` : ""}</div>
        </div>
        <div class="device-select-status ${device.online ? "online" : "offline"}">${device.online ? "Online" : "Offline"}</div>
      </label>
    `);
  });

  container.innerHTML = cards.join("");
  updateDeviceSelectionSummary();
}

async function handleDeviceSelectionChanged() {
  syncHiddenDeviceSelect();
  persistSelectedOrigins();
  renderDeviceChecklist();
  renderHealthSummary(latestDeviceStatusList);
  renderDeviceAlerts(latestDeviceStatusList);
  if (getSelectedOrigins().length) {
    await loadConfig();
  } else {
    renderScreenPreview();
  }
}

async function toggleDeviceSelection(origin, checked) {
  if (checked) {
    selectedDeviceOrigins.add(origin);
  } else {
    selectedDeviceOrigins.delete(origin);
  }
  await handleDeviceSelectionChanged();
}

async function selectAllDevices(checked = true) {
  if (checked) {
    selectedDeviceOrigins = new Set(Array.from(currentDeviceMap.keys()));
  } else {
    selectedDeviceOrigins = new Set();
  }
  await handleDeviceSelectionChanged();
}

window.toggleDeviceSelection = toggleDeviceSelection;
window.selectAllDevices = selectAllDevices;

function prefixRemoteUrl(origin, path) {
  const raw = String(path || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  return `${normalizeOrigin(origin)}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

async function postToSelectedDevices(path, body = {}) {
  const { onlineTargets } = getOnlineTargetDevices();
  const origins = onlineTargets.map((device) => getDeviceOptionValue(device)).filter(Boolean);
  if (!origins.length) {
    throw new Error("Select at least one device first.");
  }
  const responses = await Promise.all(origins.map(async (origin) => {
    const res = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: buildCmsAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`${origin} failed with HTTP ${res.status}`);
    }
    return await res.json().catch(() => ({ success: true }));
  }));
  return responses;
}

function removeActiveMessageDialogs() {
  document.querySelectorAll(".message-overlay").forEach((el) => el.remove());
}

function getMessageGlyph(type) {
  if (type === "success") return "✓";
  if (type === "error") return "!";
  if (type === "warning") return "!";
  return "i";
}

function createMessageDialog({
  type = "info",
  title = "Message",
  message = "",
  actions = [],
  closeOnBackdrop = false,
}) {
  const safeType = ["success", "error", "warning", "info"].includes(type)
    ? type
    : "info";

  const overlay = document.createElement("div");
  overlay.className = "message-overlay";

  const panel = document.createElement("div");
  panel.className = `message-panel message-${safeType}`;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");

  const head = document.createElement("div");
  head.className = "message-head";

  const icon = document.createElement("div");
  icon.className = `message-icon message-icon-${safeType}`;
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = getMessageGlyph(safeType);

  const titleWrap = document.createElement("div");
  titleWrap.className = "message-title-wrap";

  const titleEl = document.createElement("h3");
  titleEl.className = "message-title";
  titleEl.textContent = String(title || "Message");
  titleWrap.appendChild(titleEl);

  const typeTag = document.createElement("div");
  typeTag.className = "message-type-tag";
  typeTag.textContent = safeType.toUpperCase();
  titleWrap.appendChild(typeTag);

  head.appendChild(icon);
  head.appendChild(titleWrap);

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = String(message || "");

  const footer = document.createElement("div");
  footer.className = "message-actions";

  actions.forEach((action) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn ${action.variant || "primary"} message-btn`;
    btn.textContent = action.label || "OK";
    btn.addEventListener("click", () => action.onClick?.());
    footer.appendChild(btn);
  });

  panel.appendChild(head);
  panel.appendChild(body);
  panel.appendChild(footer);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  if (closeOnBackdrop) {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) {
        actions[0]?.onClick?.();
      }
    });
  }

  return { overlay, panel };
}

function showNotice(type, title, message, durationMs = 4200) {
  removeActiveMessageDialogs();

  const { overlay } = createMessageDialog({
    type,
    title,
    message,
    closeOnBackdrop: true,
    actions: [
      {
        label: "OK",
        variant: "primary",
        onClick: () => overlay.remove(),
      },
    ],
  });

  if (durationMs > 0) {
    setTimeout(() => {
      if (overlay.isConnected) overlay.remove();
    }, durationMs);
  }
}

function showNoticeDialog(type, title, message) {
  removeActiveMessageDialogs();
  return new Promise((resolve) => {
    let resolved = false;
    const finish = () => {
      if (resolved) return;
      resolved = true;
      if (overlay.isConnected) overlay.remove();
      resolve(true);
    };
    const { overlay } = createMessageDialog({
      type,
      title,
      message,
      closeOnBackdrop: true,
      actions: [
        {
          label: "OK",
          variant: "primary",
          onClick: finish,
        },
      ],
    });
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish();
    });
  });
}

function showConfirmDialog(title, message, confirmText = "Confirm", cancelText = "Cancel") {
  removeActiveMessageDialogs();
  return new Promise((resolve) => {
    const onClose = (result) => {
      if (overlay.isConnected) overlay.remove();
      document.removeEventListener("keydown", onKeyDown);
      resolve(result);
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose(false);
      if (event.key === "Enter") onClose(true);
    };

    const { overlay, panel } = createMessageDialog({
      type: "warning",
      title,
      message,
      actions: [
        { label: cancelText, variant: "warning", onClick: () => onClose(false) },
        { label: confirmText, variant: "primary", onClick: () => onClose(true) },
      ],
      closeOnBackdrop: true,
    });

    document.addEventListener("keydown", onKeyDown);
    const buttons = panel.querySelectorAll(".message-btn");
    (buttons[buttons.length - 1] || buttons[0])?.focus();
  });
}

const RATIO_PRESETS = {
  fullscreen: [{ value: "1:1", label: "Default" }],
  grid2: [
    { value: "1:1", label: "Equal" },
    { value: "2:1", label: "Section 1 Large" },
    { value: "1:2", label: "Section 2 Large" },
  ],
  grid3StackV: [
    { value: "1:1:1", label: "Equal" },
    { value: "2:1:1", label: "Section 1 Large" },
    { value: "1:2:1", label: "Section 2 Large" },
    { value: "1:1:2", label: "Section 3 Large" },
  ],
  grid3StackH: [
    { value: "1:1:1", label: "Equal" },
    { value: "2:1:1", label: "Section 1 Wide" },
    { value: "1:2:1", label: "Section 2 Wide" },
    { value: "1:1:2", label: "Section 3 Wide" },
  ],
  grid3TopBottom: [
    { value: "1:1", label: "Equal Top/Bottom" },
    { value: "2:1", label: "Top Large" },
    { value: "1:2", label: "Bottom Large" },
  ],
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(unitIndex === 0 ? 0 : 2)} ${units[unitIndex]}`;
}

function updateUploadProgress(percent, statusText) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const fill = document.getElementById("uploadProgressFill");
  const progressText = document.getElementById("uploadProgressText");
  const status = document.getElementById("uploadStatus");

  if (fill) fill.style.width = `${clamped}%`;
  if (progressText) progressText.textContent = `${clamped}%`;
  if (status && statusText) status.textContent = statusText;
}

window.__cmsSetLoaderVisibility = setLoaderVisibility;
window.__cmsUpdateUploadProgress = updateUploadProgress;

function renderUploadDetailRows(rows = []) {
  const wrap = document.getElementById("uploadDetailList");
  if (!wrap) return;
  if (!rows.length) {
    wrap.innerHTML = "";
    return;
  }
  wrap.innerHTML = rows.map((row) => `
    <div class="upload-detail-item is-${row.state || "pending"}">
      <div>
        <strong>${row.label || "Device"}</strong>
        <span>${row.message || ""}</span>
      </div>
      <strong>${row.percent == null ? "" : `${Math.max(0, Math.min(100, Math.round(row.percent)))}%`}</strong>
    </div>
  `).join("");
}

function resetUploadDetails() {
  renderUploadDetailRows([]);
}

function validateUploadFiles(fileList) {
  const files = Array.from(fileList || []);
  const errors = [];
  const warnings = [];
  const validFiles = [];
  let totalSize = 0;

  if (!files.length) {
    errors.push("Select at least one file.");
    return { errors, warnings, validFiles, totalSize };
  }

  if (files.length > MAX_FILES_PER_UPLOAD) {
    errors.push(`Max ${MAX_FILES_PER_UPLOAD} files per upload allowed.`);
  }

  for (const file of files) {
    totalSize += file.size || 0;

    if (!SUPPORTED_FILE_EXT.test(file.name || "")) {
      errors.push(`Unsupported file type: ${file.name}`);
      continue;
    }

    if ((file.size || 0) > HARD_FILE_SIZE_BYTES) {
      errors.push(
        `File too large (> ${formatBytes(HARD_FILE_SIZE_BYTES)}): ${file.name}`
      );
      continue;
    }

    if ((file.size || 0) > WARN_FILE_SIZE_BYTES) {
      warnings.push(`Large file: ${file.name} (${formatBytes(file.size)})`);
    }

    validFiles.push(file);
  }

  return { errors, warnings, validFiles, totalSize };
}

function uploadWithProgress(url, formData, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.timeout = getUploadTimeoutMs();
    const authHeaders = buildCmsAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => {
      if (value != null && value !== "") {
        xhr.setRequestHeader(key, value);
      }
    });

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = (event.loaded / event.total) * 100;
      onProgress(percent);
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
        return;
      }
      reject(new Error(parseUploadErrorResponse(xhr.status, xhr.responseText)));
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.ontimeout = () => reject(new Error("Upload timed out while waiting for server response"));
    xhr.send(formData);
  });
}

function createAggregateProgressTracker(totalTargets, section) {
  const safeTotal = Math.max(1, Number(totalTargets || 1));
  const perTarget = Array.from({ length: safeTotal }, () => 0);
  const rowState = Array.from({ length: safeTotal }, () => ({
    label: `Device`,
    message: "Waiting",
    percent: 0,
    state: "pending",
  }));
  let lastRendered = 0;

  const render = () => {
    const completed = perTarget.filter((value) => value >= 100).length;
    const rawAverage = perTarget.reduce((sum, value) => sum + Number(value || 0), 0) / safeTotal;
    const smoothPercent = Math.max(lastRendered, Math.min(99, Math.round(rawAverage)));
    lastRendered = smoothPercent;
    updateUploadProgress(
      smoothPercent,
      completed >= safeTotal
        ? `Finalizing section ${section} on all ${safeTotal} devices...`
        : `Uploading section ${section} to ${safeTotal} devices... ${completed}/${safeTotal} done`
    );
    renderUploadDetailRows(rowState);
  };

  return {
    setLabel(targetIndex, label) {
      const safeIndex = Number(targetIndex || 0);
      if (safeIndex < 0 || safeIndex >= rowState.length) return;
      rowState[safeIndex].label = label || `Device ${safeIndex + 1}`;
      render();
    },
    setState(targetIndex, state, message, percent) {
      const safeIndex = Number(targetIndex || 0);
      if (safeIndex < 0 || safeIndex >= rowState.length) return;
      rowState[safeIndex] = {
        ...rowState[safeIndex],
        state: state || rowState[safeIndex].state,
        message: message || rowState[safeIndex].message,
        percent: percent == null ? rowState[safeIndex].percent : percent,
      };
      render();
    },
    setProgress(targetIndex, percent) {
      const safeIndex = Number(targetIndex || 0);
      if (safeIndex < 0 || safeIndex >= perTarget.length) return;
      const nextPercent = Math.max(perTarget[safeIndex], Math.max(0, Math.min(100, Number(percent || 0))));
      perTarget[safeIndex] = nextPercent;
      rowState[safeIndex] = {
        ...rowState[safeIndex],
        state: nextPercent >= 100 ? "done" : "uploading",
        message: nextPercent >= 100 ? "Upload complete" : "Uploading",
        percent: nextPercent,
      };
      render();
    },
    markComplete(targetIndex) {
      this.setProgress(targetIndex, 100);
    },
    markRetry(targetIndex, attempt) {
      const safeIndex = Number(targetIndex || 0);
      if (safeIndex < 0 || safeIndex >= perTarget.length) return;
      rowState[safeIndex] = {
        ...rowState[safeIndex],
        state: "uploading",
        message: `Retry ${attempt + 1} in progress`,
      };
      updateUploadProgress(
        Math.max(lastRendered, 2),
        `Retrying upload for device ${safeIndex + 1}/${safeTotal} (attempt ${attempt + 1})...`
      );
      renderUploadDetailRows(rowState);
    },
    finish(finalMessage) {
      lastRendered = 100;
      updateUploadProgress(100, finalMessage || `Upload complete on ${safeTotal} device${safeTotal === 1 ? "" : "s"}`);
      renderUploadDetailRows(rowState);
    },
  };
}

async function verifyUploadedFilesAcrossSelectedOrigins(targets, section, uploadFiles, tracker) {
  const results = [];
  for (const target of targets || []) {
    const idx = Number(target?.index || 0);
    try {
      const verified = await verifyUploadedFilesOnOrigin(target.origin, section, uploadFiles);
      if (verified) {
        tracker.setState(idx, "done", "Upload complete (verified after reconnect)", 100);
      }
      results.push({ ...target, verified });
    } catch (_e) {
      results.push({ ...target, verified: false });
    }
  }
  return results;
}

async function uploadToOriginWithRetry(origin, section, buildFormData, tracker, targetIndex) {
  let lastError = null;
  for (let attempt = 0; attempt <= MULTI_DEVICE_UPLOAD_RETRIES; attempt += 1) {
    try {
      if (attempt > 0) {
        tracker.markRetry(targetIndex, attempt);
      }
      const formData = buildFormData();
      await uploadWithProgress(`${origin}/upload?section=${encodeURIComponent(section)}`, formData, (percent) => {
        tracker.setProgress(targetIndex, percent);
      });
      tracker.markComplete(targetIndex);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < MULTI_DEVICE_UPLOAD_RETRIES) {
        await wait(MULTI_DEVICE_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError || new Error("Upload failed");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyUploadedFilesOnOrigin(origin, section, uploadFiles, retries = 8, delayMs = 2500) {
  const expectedNames = uploadFiles
    .map((file) => String(file?.name || "").trim().toLowerCase())
    .filter(Boolean);
  if (!expectedNames.length) return false;

  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const res = await fetch(`${origin}/media-list?ts=${Date.now()}`);
      const files = await res.json();
      const existing = new Set(
        (Array.isArray(files) ? files : [])
          .filter((item) => Number(item?.section || 0) === Number(section))
          .map((item) => String(item?.originalName || item?.name || "").trim().toLowerCase())
          .filter(Boolean)
      );
      if (expectedNames.every((name) => existing.has(name))) {
        return true;
      }
    } catch (_e) {
    }
    if (attempt < retries - 1) {
      await wait(delayMs);
    }
  }
  return false;
}

async function verifyUploadedFilesAcrossOrigins(origins, section, uploadFiles) {
  const checks = await Promise.all(
    (origins || []).map((origin) => verifyUploadedFilesOnOrigin(origin, section, uploadFiles))
  );
  return checks.length > 0 && checks.every(Boolean);
}

async function detectDuplicateUploadTargets(targets, section, uploadFiles) {
  const fileSignatures = new Map(
    (uploadFiles || []).map((file) => [
      String(file?.name || "").trim().toLowerCase(),
      Number(file?.size || 0),
    ])
  );
  const duplicateOrigins = new Set();

  await Promise.all((targets || []).map(async (target) => {
    try {
      const res = await fetch(`${target.origin}/media-list?ts=${Date.now()}`);
      if (!res.ok) return;
      const list = await res.json();
      const sectionItems = (Array.isArray(list) ? list : []).filter((item) => Number(item?.section || 0) === Number(section));
      const allMatch = Array.from(fileSignatures.entries()).every(([name, size]) =>
        sectionItems.some((item) =>
          String(item?.originalName || item?.name || "").trim().toLowerCase() === name &&
          Number(item?.size || 0) === size
        )
      );
      if (allMatch && fileSignatures.size) {
        duplicateOrigins.add(target.origin);
      }
    } catch (_e) {
    }
  }));

  return duplicateOrigins;
}

function cloneUploadFormData(files, containsPpt) {
  const formData = new FormData();
  if (containsPpt) {
    formData.append("containsPpt", "1");
  }
  for (const file of files) {
    formData.append("files", file);
  }
  return formData;
}

function parseUploadErrorResponse(status, responseText) {
  const statusCode = Number(status || 0);
  const rawText = String(responseText || "").trim();

  try {
    const parsed = JSON.parse(rawText || "{}");
    const msg = String(parsed?.error || parsed?.message || "").trim();
    if (msg) return sanitizeUploadErrorMessage(msg, statusCode);
  } catch (_e) {
    // Non-JSON response: continue with text heuristics.
  }

  if (/<!doctype html/i.test(rawText) || /<html[\s>]/i.test(rawText)) {
    if (statusCode === 404) {
      return "Upload API endpoint not found. Please check CMS URL and try again.";
    }
    if (statusCode === 413) {
      return `File too large. Please upload files below ${formatBytes(HARD_FILE_SIZE_BYTES)}.`;
    }
    if (statusCode >= 500) {
      return "Server error during upload. Please check CMS server logs and retry.";
    }
    return "Invalid server response received during upload. Please verify CMS server is running correctly.";
  }

  if (!rawText) {
    return statusCode
      ? `Upload failed with status ${statusCode}.`
      : "Upload failed due to an unexpected server response.";
  }

  return sanitizeUploadErrorMessage(rawText, statusCode);
}

function sanitizeUploadErrorMessage(message, statusCode) {
  const raw = String(message || "").trim();
  const lower = raw.toLowerCase();

  if (/[a-z]:\\[^:\n]+/i.test(raw)) {
    if (lower.includes("enospc")) {
      return "Upload failed: server storage is full. Free disk space and retry.";
    }
    if (lower.includes("eacces") || lower.includes("eperm")) {
      return "Upload failed: server does not have write permission for upload folder.";
    }
    if (lower.includes("enoent")) {
      return "Upload failed: upload folder not found on server. Please restart CMS and try again.";
    }
    return "Upload failed due to a server file-system error. Please check CMS server permissions/logs.";
  }

  if (lower.includes("network error")) {
    return "Network error during upload. Check local network/Wi-Fi and retry.";
  }

  if (statusCode === 413 || lower.includes("too large") || lower.includes("limit_file_size")) {
    return `File too large. Please upload files below ${formatBytes(HARD_FILE_SIZE_BYTES)}.`;
  }

  if (statusCode === 404 || lower.includes("cannot post")) {
    return "Upload API not found. Please open correct CMS URL and try again.";
  }

  if (lower.includes("unexpected field")) {
    return "Upload request format is invalid. Refresh CMS page and try again.";
  }

  return raw;
}

async function canUploadVideosToSection(deviceId, section) {
  const targetOrigin = normalizeOrigin(deviceId) || getCurrentOrigin();
  const res = await fetch(`${targetOrigin}/media-list?ts=${Date.now()}`);
  const files = await res.json();
  const hasVideoOrPptElsewhere = (files || []).some((f) => {
    const name = f.originalName || f.name || "";
    const sec = Number(f.section || 1);
    if (sec === Number(section)) return false;
    return VIDEO_FILE_EXT.test(name) || PPT_FILE_EXT.test(name);
  });
  return !hasVideoOrPptElsewhere;
}

async function canUploadPptToSection(deviceId, section) {
  const targetOrigin = normalizeOrigin(deviceId) || getCurrentOrigin();
  const res = await fetch(`${targetOrigin}/media-list?ts=${Date.now()}`);
  const files = await res.json();
  const hasVideoOrPptElsewhere = (files || []).some((f) => {
    const name = f.originalName || f.name || "";
    const sec = Number(f.section || 1);
    if (sec === Number(section)) return false;
    return VIDEO_FILE_EXT.test(name) || PPT_FILE_EXT.test(name);
  });
  return !hasVideoOrPptElsewhere;
}

function fileNameBase(name) {
  const safe = String(name || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
  const dot = safe.lastIndexOf(".");
  return dot > 0 ? safe.slice(0, dot) : safe;
}

function pad3(n) {
  return String(n).padStart(3, "0");
}

function canvasToBlob(canvas, type = "image/png", quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas conversion failed"));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

let pdfJsLoadingPromise = null;
function ensurePdfJsLoaded() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (pdfJsLoadingPromise) return pdfJsLoadingPromise;

  pdfJsLoadingPromise = new Promise((resolve, reject) => {
    const candidates = [
      {
        script: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
        worker: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js",
      },
      {
        script: "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js",
        worker: "https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
      },
    ];

    let index = 0;
    const tryNext = () => {
      if (index >= candidates.length) {
        reject(new Error("Failed to load PDF engine. Check internet on CMS PC and refresh."));
        return;
      }

      const candidate = candidates[index];
      index += 1;
      const script = document.createElement("script");
      script.src = candidate.script;
      script.onload = () => {
        if (!window.pdfjsLib) {
          tryNext();
          return;
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = candidate.worker;
        resolve(window.pdfjsLib);
      };
      script.onerror = () => {
        script.remove();
        tryNext();
      };
      document.head.appendChild(script);
    };

    tryNext();
  });

  return pdfJsLoadingPromise;
}

async function convertPdfFileToImages(file) {
  const pdfjsLib = await ensurePdfJsLoaded();
  const data = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data }).promise;
  const base = fileNameBase(file.name || "document");
  const converted = [];

  for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
    const page = await doc.getPage(pageNo);
    const viewport = page.getViewport({ scale: 1.6 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(viewport.width);
    canvas.height = Math.floor(viewport.height);
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;
    const blob = await canvasToBlob(canvas, "image/png");
    converted.push(
      new File([blob], `${base}__page-${pad3(pageNo)}.png`, {
        type: "image/png",
      })
    );
  }

  return converted;
}

let pptxViewLoadingPromise = null;
function ensurePptxViewLoaded() {
  if (window.PptxViewJS && window.PptxViewJS.PPTXViewer) {
    return Promise.resolve(window.PptxViewJS);
  }
  if (pptxViewLoadingPromise) return pptxViewLoadingPromise;

  const loadScript = (src) =>
    new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = () => resolve();
      script.onerror = () => {
        script.remove();
        reject(new Error(`Failed to load ${src}`));
      };
      document.head.appendChild(script);
    });

  pptxViewLoadingPromise = (async () => {
    const candidates = [
      {
        jszip: "https://cdn.jsdelivr.net/npm/jszip/dist/jszip.min.js",
        chart: "https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js",
        pptx: "https://cdn.jsdelivr.net/npm/pptxviewjs/dist/PptxViewJS.min.js",
      },
      {
        jszip: "https://unpkg.com/jszip/dist/jszip.min.js",
        chart: "https://unpkg.com/chart.js/dist/chart.umd.min.js",
        pptx: "https://unpkg.com/pptxviewjs/dist/PptxViewJS.min.js",
      },
    ];

    let lastErr = null;
    for (const candidate of candidates) {
      try {
        await loadScript(candidate.jszip);
        await loadScript(candidate.chart);
        await loadScript(candidate.pptx);
        if (window.PptxViewJS && window.PptxViewJS.PPTXViewer) {
          return window.PptxViewJS;
        }
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("Failed to load PPTX viewer library.");
  })();

  return pptxViewLoadingPromise;
}

let pptxFontsLoadingPromise = null;
function ensurePptxFontsLoaded() {
  if (pptxFontsLoadingPromise) return pptxFontsLoadingPromise;
  pptxFontsLoadingPromise = (async () => {
    const styleId = "pptx-fonts";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
@font-face {
  font-family: "Carlito";
  font-style: normal;
  font-weight: 400;
  src: url("https://cdn.jsdelivr.net/fontsource/fonts/carlito@latest/latin-400-normal.woff2") format("woff2"),
       url("https://cdn.jsdelivr.net/fontsource/fonts/carlito@latest/latin-400-normal.woff") format("woff");
}
@font-face {
  font-family: "Carlito";
  font-style: normal;
  font-weight: 700;
  src: url("https://cdn.jsdelivr.net/fontsource/fonts/carlito@latest/latin-700-normal.woff2") format("woff2"),
       url("https://cdn.jsdelivr.net/fontsource/fonts/carlito@latest/latin-700-normal.woff") format("woff");
}
@font-face {
  font-family: "Arimo";
  font-style: normal;
  font-weight: 400 700;
  src: url("https://cdn.jsdelivr.net/fontsource/fonts/arimo@latest/latin-wght-normal.woff2") format("woff2");
}
@font-face {
  font-family: "Calibri";
  font-style: normal;
  font-weight: 400;
  src: url("https://cdn.jsdelivr.net/fontsource/fonts/carlito@latest/latin-400-normal.woff2") format("woff2");
}
@font-face {
  font-family: "Calibri";
  font-style: normal;
  font-weight: 700;
  src: url("https://cdn.jsdelivr.net/fontsource/fonts/carlito@latest/latin-700-normal.woff2") format("woff2");
}
@font-face {
  font-family: "Arial";
  font-style: normal;
  font-weight: 400 700;
  src: url("https://cdn.jsdelivr.net/fontsource/fonts/arimo@latest/latin-wght-normal.woff2") format("woff2");
}
      `;
      document.head.appendChild(style);
    }
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }
  })();
  return pptxFontsLoadingPromise;
}

async function convertPptxFileToImages(file) {
  await ensurePptxFontsLoaded();
  const PptxViewJS = await ensurePptxViewLoaded();
  const base = fileNameBase(file.name || "presentation");
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(PPTX_CANVAS_WIDTH * PPTX_RENDER_DPR);
  canvas.height = Math.round(PPTX_CANVAS_HEIGHT * PPTX_RENDER_DPR);
  const viewer = new PptxViewJS.PPTXViewer({
    canvas,
    autoExposeGlobals: true,
  });

  let slideSize = null;
  const slideCount = await new Promise((resolve, reject) => {
    viewer.on("loadComplete", (info) => {
      const count = Number(info?.slideCount || 0);
      const w = Number(info?.slideWidth || info?.width || info?.size?.width || 0);
      const h = Number(info?.slideHeight || info?.height || info?.size?.height || 0);
      if (w > 0 && h > 0) slideSize = { width: w, height: h };
      resolve(count || 0);
    });
    viewer.on("loadError", (err) => reject(err || new Error("PPTX load failed")));
    viewer.loadFile(file).catch((err) => reject(err));
  });

  if (!slideCount) {
    throw new Error("No slides found in PowerPoint file.");
  }

  const converted = [];
  const tryRender = async (index) => {
    try {
      await viewer.renderSlide(index, canvas);
      return true;
    } catch {
      return false;
    }
  };

  let baseIndex = null;
  let firstIndex = null;
  if (await tryRender(1)) {
    baseIndex = 1;
    firstIndex = 1;
  } else if (await tryRender(0)) {
    baseIndex = 0;
    firstIndex = 0;
  } else {
    throw new Error("PPTX slide render failed.");
  }

  if (slideSize && slideSize.width > 0 && slideSize.height > 0) {
    const aspect = slideSize.width / slideSize.height;
    let targetW = PPTX_CANVAS_WIDTH;
    let targetH = PPTX_CANVAS_HEIGHT;
    if (aspect > 0) {
      const fitW = Math.round(PPTX_CANVAS_HEIGHT * aspect);
      if (fitW <= PPTX_CANVAS_WIDTH) {
        targetW = fitW;
        targetH = PPTX_CANVAS_HEIGHT;
      } else {
        targetW = PPTX_CANVAS_WIDTH;
        targetH = Math.round(PPTX_CANVAS_WIDTH / aspect);
      }
    }
    canvas.width = Math.round(targetW * PPTX_RENDER_DPR);
    canvas.height = Math.round(targetH * PPTX_RENDER_DPR);
  }

  for (let offset = 0; offset < slideCount; offset += 1) {
    const slideIndex = baseIndex + offset;
    if (slideIndex !== firstIndex) {
      const ok = await tryRender(slideIndex);
      if (!ok) break;
    }
    const blob = await canvasToBlob(canvas, "image/png");
    converted.push(
      new File([blob], `${base}__slide-${pad3(offset + 1)}.png`, {
        type: "image/png",
      })
    );
    firstIndex = null;
  }

  return converted;
}

function sectionCount(layout) {
  if (layout === "grid2") return 2;
  if (layout === "grid3") return 3;
  return 1;
}

function normalizeWebUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value}`;
}

function extractYoutubeId(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/i,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{6,})/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match?.[1]) return match[1];
  }
  return "";
}

function normalizeYoutubeEmbedUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/youtube\.com\/embed\//i.test(value)) return value;
  const id = extractYoutubeId(value);
  if (!id) return "";
  return `https://www.youtube.com/embed/${id}?autoplay=1&mute=1&playsinline=1&rel=0&modestbranding=1`;
}

function normalizeSectionSourceUrl(sourceType, value) {
  if (sourceType === SECTION_SOURCE_TYPES.web) return normalizeWebUrl(value);
  if (sourceType === SECTION_SOURCE_TYPES.youtube) return normalizeYoutubeEmbedUrl(value);
  return "";
}

function buildPdfViewerUrl(fileUrl, page) {
  const safePage = Math.max(1, Number(page || 1));
  return `/pdf-viewer.html?file=${encodeURIComponent(fileUrl)}&page=${safePage}`;
}

function normalizeRatio(value, count) {
  const parts = String(value || "")
    .split(":")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length !== count) return count === 3 ? [1, 1, 1] : [1, 1];
  return parts;
}

function ratioOptionsFor(layout, grid3Layout) {
  if (layout === "grid2") return RATIO_PRESETS.grid2;
  if (layout === "grid3" && grid3Layout === "stack-v") return RATIO_PRESETS.grid3StackV;
  if (layout === "grid3" && grid3Layout === "stack-h") return RATIO_PRESETS.grid3StackH;
  if (layout === "grid3") return RATIO_PRESETS.grid3TopBottom;
  return RATIO_PRESETS.fullscreen;
}

function updateGridRatioOptions() {
  const layout = document.getElementById("layout").value;
  const ratioSelect = document.getElementById("gridRatio");
  if (!ratioSelect) return;

  const options = ratioOptionsFor(layout, selectedGrid3Layout);
  ratioSelect.innerHTML = options
    .map((opt) => `<option value="${opt.value}">${opt.label} (${opt.value})</option>`)
    .join("");

  const exists = options.some((opt) => opt.value === selectedGridRatio);
  selectedGridRatio = exists ? selectedGridRatio : options[0].value;
  ratioSelect.value = selectedGridRatio;
}

function getScheduleFromForm() {
  const enabled = !!document.getElementById("scheduleEnabled")?.checked;
  const start = document.getElementById("scheduleStart")?.value || "09:00";
  const end = document.getElementById("scheduleEnd")?.value || "18:00";
  const fallbackMode = document.getElementById("scheduleFallbackMode")?.value || "black";
  const fallbackMessage = document.getElementById("scheduleFallbackMessage")?.value || "";
  const fallbackImageUrl = document.getElementById("scheduleFallbackImageUrl")?.value?.trim() || "";
  const fallbackTextColor = document.getElementById("scheduleFallbackTextColor")?.value || "#ffffff";
  const fallbackBgColor = document.getElementById("scheduleFallbackBgColor")?.value || "#000000";
  const dayInputs = Array.from(document.querySelectorAll(".schedule-day"));
  const days = dayInputs
    .filter((el) => el.checked)
    .map((el) => Number(el.value))
    .filter((n) => Number.isFinite(n));

  return {
    enabled,
    start,
    end,
    days,
    fallbackMode,
    fallbackMessage,
    fallbackImageUrl,
    fallbackTextColor,
    fallbackBgColor,
  };
}

function setScheduleToForm(schedule) {
  const safeSchedule = schedule || {};
  const enabled = !!safeSchedule.enabled;
  const start = safeSchedule.start || "09:00";
  const end = safeSchedule.end || "18:00";
  const days = Array.isArray(safeSchedule.days) && safeSchedule.days.length
    ? safeSchedule.days.map(Number)
    : [1, 2, 3, 4, 5, 6, 0];
  const fallbackMode = safeSchedule.fallbackMode || "black";

  const enabledEl = document.getElementById("scheduleEnabled");
  const startEl = document.getElementById("scheduleStart");
  const endEl = document.getElementById("scheduleEnd");
  const modeEl = document.getElementById("scheduleFallbackMode");
  const msgEl = document.getElementById("scheduleFallbackMessage");
  const imageUrlEl = document.getElementById("scheduleFallbackImageUrl");
  const textColorEl = document.getElementById("scheduleFallbackTextColor");
  const bgColorEl = document.getElementById("scheduleFallbackBgColor");
  const fields = document.getElementById("scheduleFields");

  if (enabledEl) enabledEl.checked = enabled;
  if (startEl) startEl.value = start;
  if (endEl) endEl.value = end;
  if (modeEl) modeEl.value = fallbackMode;
  if (msgEl) msgEl.value = safeSchedule.fallbackMessage || "";
  if (imageUrlEl) imageUrlEl.value = safeSchedule.fallbackImageUrl || "";
  if (textColorEl) textColorEl.value = safeSchedule.fallbackTextColor || "#ffffff";
  if (bgColorEl) bgColorEl.value = safeSchedule.fallbackBgColor || "#000000";
  if (fields) fields.style.opacity = enabled ? "1" : "0.55";

  const dayInputs = Array.from(document.querySelectorAll(".schedule-day"));
  dayInputs.forEach((el) => {
    el.checked = days.includes(Number(el.value));
  });

  updateScheduleFallbackVisibility();
}

function updateScheduleFallbackVisibility() {
  const mode = document.getElementById("scheduleFallbackMode")?.value || "black";
  const msgWrap = document.getElementById("scheduleFallbackMessageWrap");
  const imageWrap = document.getElementById("scheduleFallbackImageWrap");
  if (msgWrap) msgWrap.classList.toggle("hidden", mode !== "message");
  if (imageWrap) imageWrap.classList.toggle("hidden", mode !== "image");
}

function miniLayoutMarkup(layout, grid3Layout) {
  if (layout === "fullscreen") {
    return `<div style="height:100%;display:grid;grid-template-columns:1fr"><div class="cell">1</div></div>`;
  }

  if (layout === "grid2") {
    const [a, b] = normalizeRatio(selectedGridRatio, 2);
    if (grid3Layout === "stack-v") {
      return `
        <div style="height:100%;display:grid;grid-template-rows:${a}fr ${b}fr">
          <div class="cell">1</div><div class="cell">2</div>
        </div>
      `;
    }
    return `
      <div style="height:100%;display:grid;grid-template-columns:${a}fr ${b}fr">
        <div class="cell">1</div><div class="cell">2</div>
      </div>
    `;
  }

  if (grid3Layout === "stack-h") {
    const [a, b, c] = normalizeRatio(selectedGridRatio, 3);
    return `
      <div style="height:100%;display:grid;grid-template-columns:${a}fr ${b}fr ${c}fr">
        <div class="cell">1</div><div class="cell">2</div><div class="cell">3</div>
      </div>
    `;
  }

  if (grid3Layout === "top-two-bottom-one") {
    const [top, bottom] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div style="height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:${top}fr ${bottom}fr;grid-template-areas:'one two' 'three three';">
        <div class="cell" style="grid-area:one;">1</div>
        <div class="cell" style="grid-area:two;">2</div>
        <div class="cell" style="grid-area:three;">3</div>
      </div>
    `;
  }

  if (grid3Layout === "top-one-bottom-two") {
    const [top, bottom] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div style="height:100%;display:grid;grid-template-columns:1fr 1fr;grid-template-rows:${top}fr ${bottom}fr;grid-template-areas:'one one' 'two three';">
        <div class="cell" style="grid-area:one;">1</div>
        <div class="cell" style="grid-area:two;">2</div>
        <div class="cell" style="grid-area:three;">3</div>
      </div>
    `;
  }

  const [r1, r2, r3] = normalizeRatio(selectedGridRatio, 3);
  return `
    <div style="height:100%;display:grid;grid-template-rows:${r1}fr ${r2}fr ${r3}fr">
      <div class="cell">1</div><div class="cell">2</div><div class="cell">3</div>
    </div>
  `;
}

function liveLayoutMarkup(layout, grid3Layout) {
  if (layout === "fullscreen") {
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:1fr;">
        <div class="preview-slot" data-section="1"></div>
      </div>
    `;
  }

  if (layout === "grid2") {
    const [left, right] = normalizeRatio(selectedGridRatio, 2);
    if (grid3Layout === "stack-v") {
      return `
        <div class="preview-layout" style="display:grid;grid-template-rows:${left}fr ${right}fr;">
          <div class="preview-slot" data-section="1"></div>
          <div class="preview-slot" data-section="2"></div>
        </div>
      `;
    }
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:${left}fr ${right}fr;">
        <div class="preview-slot" data-section="1"></div>
        <div class="preview-slot" data-section="2"></div>
      </div>
    `;
  }

  if (grid3Layout === "stack-h") {
    const [a, b, c] = normalizeRatio(selectedGridRatio, 3);
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:${a}fr ${b}fr ${c}fr;">
        <div class="preview-slot" data-section="1"></div>
        <div class="preview-slot" data-section="2"></div>
        <div class="preview-slot" data-section="3"></div>
      </div>
    `;
  }

  if (grid3Layout === "top-two-bottom-one") {
    const [top, bottom] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:${top}fr ${bottom}fr;grid-template-areas:'one two' 'three three';">
        <div class="preview-slot" data-section="1" style="grid-area:one;"></div>
        <div class="preview-slot" data-section="2" style="grid-area:two;"></div>
        <div class="preview-slot" data-section="3" style="grid-area:three;"></div>
      </div>
    `;
  }

  if (grid3Layout === "top-one-bottom-two") {
    const [top, bottom] = normalizeRatio(selectedGridRatio, 2);
    return `
      <div class="preview-layout" style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:${top}fr ${bottom}fr;grid-template-areas:'one one' 'two three';">
        <div class="preview-slot" data-section="1" style="grid-area:one;"></div>
        <div class="preview-slot" data-section="2" style="grid-area:two;"></div>
        <div class="preview-slot" data-section="3" style="grid-area:three;"></div>
      </div>
    `;
  }

  const [r1, r2, r3] = normalizeRatio(selectedGridRatio, 3);
  return `
    <div class="preview-layout" style="display:grid;grid-template-rows:${r1}fr ${r2}fr ${r3}fr;">
      <div class="preview-slot" data-section="1"></div>
      <div class="preview-slot" data-section="2"></div>
      <div class="preview-slot" data-section="3"></div>
    </div>
  `;
}

function getSectionDurationMs(config, sectionNumber) {
  const sectionDuration = config?.sections?.[sectionNumber - 1]?.slideDuration;
  const fallbackDuration = config?.slideDuration || 5;
  return Math.max(1, Number(sectionDuration || fallbackDuration)) * 1000;
}

function clearPreviewTimers() {
  for (const key of Object.keys(previewSectionState)) {
    const state = previewSectionState[key];
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
  }
}

function resetPreviewState() {
  clearPreviewTimers();
  previewSectionState = {
    1: { index: 0, timer: null },
    2: { index: 0, timer: null },
    3: { index: 0, timer: null },
  };
}

function getSelectedDeviceStatus() {
  const selectedDevice = document.getElementById("deviceSelect")?.value || "all";
  if (selectedDevice === "all") return null;
  return latestDeviceStatusList.find((entry) => entry.deviceId === selectedDevice) || null;
}

function getLivePlaybackForSection(sectionNumber, status) {
  if (!status?.meta?.currentPlaybackBySection) return null;
  return status.meta.currentPlaybackBySection[sectionNumber] || null;
}

function formatDurationMs(value) {
  const totalMs = Math.max(0, Number(value || 0));
  if (!totalMs) return "00:00";
  const totalSeconds = Math.floor(totalMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function findLiveFile(files, liveSection) {
  if (!liveSection || !Array.isArray(files)) return null;
  const itemIndex = Number(liveSection.itemIndex || 0);
  if (itemIndex > 0) {
    const safeIndex = Math.max(0, Math.min(files.length - 1, itemIndex - 1));
    return files[safeIndex] || null;
  }
  const title = String(liveSection.title || "").trim();
  if (!title) return null;
  return (
    files.find((file) => {
      const candidates = [
        file.originalName,
        file.name,
        file.url,
        file.remoteUrl,
      ];
      return candidates.some((value) => String(value || "") === title);
    }) || null
  );
}

function renderPreviewEmpty(slot, title, subtitle, hint, badgeText = "UPLOAD REQUIRED") {
  const card = document.createElement("div");
  card.className = "preview-empty-card";

  const badge = document.createElement("div");
  badge.className = "preview-empty-badge";
  badge.textContent = String(badgeText || "UPLOAD REQUIRED");

  const titleEl = document.createElement("div");
  titleEl.className = "preview-empty-title";
  titleEl.textContent = String(title || "No Media");

  const subEl = document.createElement("div");
  subEl.className = "preview-empty-subtitle";
  subEl.textContent = String(subtitle || "");

  const hintEl = document.createElement("div");
  hintEl.className = "preview-empty-hint";
  hintEl.textContent = String(hint || "");

  card.appendChild(badge);
  card.appendChild(titleEl);
  if (subtitle) card.appendChild(subEl);
  if (hint) card.appendChild(hintEl);
  slot.appendChild(card);
}

function parsePreviewCacheStatus(status, rawStatus) {
  const raw = String(rawStatus || "").trim();
  const base = raw.toLowerCase();
  if (base.startsWith("streaming")) return { base: "streaming", label: raw };
  if (base === "cached") return { base: "cached", label: "CACHED" };
  if (base === "offline") return { base: "offline", label: "OFFLINE" };
  if (base === "empty") return { base: "empty", label: "EMPTY" };
  if (!raw) {
    if (!status) return { base: "", label: "" };
    return status.online ? { base: "", label: "" } : { base: "offline", label: "OFFLINE" };
  }
  return { base, label: raw };
}

function applyPreviewLiveOverlay(slot, status, sectionNumber, cacheStatusOverride = "") {
  if (!status) return;
  const liveSection = getLivePlaybackForSection(sectionNumber, status);
  const cacheStatus = parsePreviewCacheStatus(
    status,
    cacheStatusOverride || liveSection?.cacheStatus || ""
  );

  const badge = document.createElement("div");
  badge.className = `preview-live-badge ${status.online ? "online" : "offline"}`;
  badge.textContent = status.online ? "LIVE" : "OFFLINE";
  slot.appendChild(badge);

  if (cacheStatus.base) {
    const cacheBadge = document.createElement("div");
    cacheBadge.className = `preview-cache-badge ${cacheStatus.base}`;
    cacheBadge.textContent = String(cacheStatus.label || "").toUpperCase();
    slot.appendChild(cacheBadge);
  }

  if (status?.meta?.mediaCacheSummary) {
    const sum = status.meta.mediaCacheSummary;
    if (Number(sum?.total || 0) > 0) {
      const percent = Number(sum?.percent || 0);
      const cachePctBadge = document.createElement("div");
      cachePctBadge.className = "preview-cache-badge cache-percent";
      cachePctBadge.textContent = `CACHE ${percent}%`;
      slot.appendChild(cachePctBadge);

      const bar = document.createElement("div");
      bar.className = "preview-cache-bar";
      const fill = document.createElement("div");
      fill.className = "preview-cache-bar-fill";
      fill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
      bar.appendChild(fill);
      slot.appendChild(bar);
    }
  }

  if (liveSection) {
    const info = document.createElement("div");
    info.style.position = "absolute";
    info.style.left = "8px";
    info.style.right = "8px";
    info.style.bottom = "8px";
    info.style.padding = "7px 9px";
    info.style.borderRadius = "10px";
    info.style.background = "rgba(6, 10, 16, 0.76)";
    info.style.border = "1px solid rgba(120, 180, 220, 0.24)";
    info.style.color = "#dff4ff";
    info.style.fontSize = "10px";
    info.style.lineHeight = "1.45";
    info.style.whiteSpace = "pre-line";
    info.style.pointerEvents = "none";

    const lines = [];
    const itemIndex = Number(liveSection.itemIndex || 0);
    const totalItems = Number(liveSection.totalItems || 0);
    if (itemIndex > 0 && totalItems > 0) {
      lines.push(`Running file: ${itemIndex}/${totalItems}`);
    }
    if (Number(liveSection.itemDurationMs || 0) > 0) {
      lines.push(
        `Current run: ${formatDurationMs(liveSection.itemElapsedMs)} / ${formatDurationMs(
          liveSection.itemDurationMs
        )}`
      );
    }
    if (Number(liveSection.playlistTotalMs || 0) > 0) {
      lines.push(
        `Section total: ${formatDurationMs(liveSection.playlistElapsedMs)} / ${formatDurationMs(
          liveSection.playlistTotalMs
        )}`
      );
    }
    if (lines.length) {
      info.textContent = lines.join("\n");
      slot.appendChild(info);
    }
  }

  // Live detail panel removed as requested.
}

function renderSectionSlot(slot, sectionNumber, config) {
  const sectionConfig = config?.sections?.[sectionNumber - 1] || {};
  const sourceType = sectionConfig.sourceType || SECTION_SOURCE_TYPES.multimedia;
  const sourceUrl = normalizeSectionSourceUrl(sourceType, sectionConfig.sourceUrl);

  const files = previewMediaBySection[sectionNumber] || [];
  const state = previewSectionState[sectionNumber];
  const selectedStatus = getSelectedDeviceStatus();
  const liveSection = getLivePlaybackForSection(sectionNumber, selectedStatus);
  const fallbackCacheStatus = !selectedStatus
    ? ""
    : liveSection?.cacheStatus
    ? String(liveSection.cacheStatus)
    : selectedStatus.online
    ? ""
    : "Offline";
  const liveMode = !!selectedStatus && !!liveSection;

  if (state.timer) {
    clearTimeout(state.timer);
    state.timer = null;
  }

  slot.innerHTML = "";
  const tag = document.createElement("div");
  tag.className = "slot-tag";
  tag.textContent = `Section ${sectionNumber}`;
  slot.appendChild(tag);

  if (sourceType === SECTION_SOURCE_TYPES.web || sourceType === SECTION_SOURCE_TYPES.youtube) {
    if (!sourceUrl) {
      applyPreviewLiveOverlay(slot, selectedStatus, sectionNumber, fallbackCacheStatus);
      return;
    }

    const frame = document.createElement("iframe");
    frame.className = "preview-media";
    frame.src = sourceUrl;
    frame.setAttribute("allow", "autoplay; encrypted-media; picture-in-picture");
    frame.setAttribute("allowfullscreen", "true");
    frame.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    frame.style.border = "0";
    slot.appendChild(frame);
    applyPreviewLiveOverlay(slot, selectedStatus, sectionNumber, fallbackCacheStatus);
    return;
  }

  if (!files.length) {
    applyPreviewLiveOverlay(slot, selectedStatus, sectionNumber, fallbackCacheStatus);
    return;
  }

  const liveFile = liveMode ? findLiveFile(files, liveSection) : null;
  if (liveMode && !liveFile) {
    applyPreviewLiveOverlay(slot, selectedStatus, sectionNumber, fallbackCacheStatus);
    return;
  }

  const file = liveFile || files[state.index % files.length];
  const isVideo = /\.(mp4|mov|mkv|webm)$/i.test(file.name || "");
  const isText = (file.type || "").toLowerCase() === "text" || /\.txt$/i.test(file.originalName || file.name || "");
  const isPdf = (file.type || "").toLowerCase() === "pdf" || /\.pdf$/i.test(file.originalName || file.name || "");

  if (isPdf) {
    const frame = document.createElement("iframe");
    frame.className = "preview-media";
    frame.src = buildPdfViewerUrl(file.remoteUrl || file.url || "", file.page || 1);
    frame.setAttribute("allowfullscreen", "true");
    frame.style.border = "0";
    slot.appendChild(frame);

    if (!liveMode) {
      const durationMs = getSectionDurationMs(config, sectionNumber);
      state.timer = setTimeout(() => {
        state.index = (state.index + 1) % files.length;
        renderSectionSlot(slot, sectionNumber, config);
      }, durationMs);
    }
    applyPreviewLiveOverlay(slot, selectedStatus, sectionNumber, fallbackCacheStatus);
    return;
  }

  if (isText) {
    const panel = document.createElement("div");
    panel.className = "cell";
    panel.style.padding = "10px";
    panel.style.overflow = "auto";
    panel.style.fontSize = "12px";
    panel.style.textAlign = "left";
    panel.textContent = "Loading text...";
    slot.appendChild(panel);

    fetch(file.remoteUrl || file.url || "", { cache: "no-store" })
      .then((r) => r.text())
      .then((text) => {
        panel.textContent = text || "No text content";
      })
      .catch(() => {
        panel.textContent = "Unable to load text file";
      });

    if (!liveMode) {
      const durationMs = getSectionDurationMs(config, sectionNumber);
      state.timer = setTimeout(() => {
        state.index = (state.index + 1) % files.length;
        renderSectionSlot(slot, sectionNumber, config);
      }, durationMs);
    }
    applyPreviewLiveOverlay(slot, selectedStatus, sectionNumber, fallbackCacheStatus);
    return;
  }

  const mediaEl = document.createElement(isVideo ? "video" : "img");

  mediaEl.className = "preview-media";
  mediaEl.src = file.remoteUrl || file.url || "";

  if (isVideo) {
    mediaEl.muted = true;
    mediaEl.autoplay = true;
    mediaEl.playsInline = true;
    mediaEl.preload = "metadata";
    if (liveMode) mediaEl.loop = true;

    if (!liveMode) {
      mediaEl.onended = () => {
        state.index = (state.index + 1) % files.length;
        renderSectionSlot(slot, sectionNumber, config);
      };

      mediaEl.onerror = () => {
        state.timer = setTimeout(() => {
          state.index = (state.index + 1) % files.length;
          renderSectionSlot(slot, sectionNumber, config);
        }, 1500);
      };
    }
  } else {
    if (!liveMode) {
      const durationMs = getSectionDurationMs(config, sectionNumber);
      state.timer = setTimeout(() => {
        state.index = (state.index + 1) % files.length;
        renderSectionSlot(slot, sectionNumber, config);
      }, durationMs);
    }
  }

  slot.appendChild(mediaEl);
  applyPreviewLiveOverlay(slot, selectedStatus, sectionNumber, fallbackCacheStatus);
}

function startLivePreviewPlayback(config) {
  const preview = document.getElementById("screenPreview");
  if (!preview) return;

  clearPreviewTimers();
  const slots = preview.querySelectorAll(".preview-slot");
  slots.forEach((slot) => {
    const sectionNumber = Number(slot.getAttribute("data-section") || "1");
    renderSectionSlot(slot, sectionNumber, config);
  });
}

function renderGrid3LayoutOptions() {
  const box = document.getElementById("grid3LayoutOptions");
  const title = document.getElementById("gridLayoutTitle");
  const layout = document.getElementById("layout")?.value || "fullscreen";
  const layoutSection = document.getElementById("grid3LayoutSection");

  if (!box || !layoutSection) return;

  if (layout !== "grid2" && layout !== "grid3") {
    layoutSection.classList.add("hidden");
    return;
  }

  layoutSection.classList.remove("hidden");
  if (title) {
    title.textContent = layout === "grid2" ? "Grid 2 Layout Options" : "Grid 3 Layout Options";
  }

  if (layout === "grid2") {
    const validIds = GRID2_LAYOUTS.map((item) => item.id);
    if (!validIds.includes(selectedGrid3Layout)) {
      selectedGrid3Layout = "stack-h";
    }
    box.innerHTML = GRID2_LAYOUTS.map((item) => {
      const active = item.id === selectedGrid3Layout ? "active" : "";
      const mini = miniLayoutMarkup("grid2", item.id);
      return `
        <button class="layout-option ${active}" onclick="selectGrid3Layout('${item.id}')" type="button">
          <strong>${item.label}</strong>
          <div class="mini-layout">${mini}</div>
        </button>
      `;
    }).join("");
    return;
  }

  const validIds = GRID3_LAYOUTS.map((item) => item.id);
  if (!validIds.includes(selectedGrid3Layout)) {
    selectedGrid3Layout = "stack-v";
  }
  box.innerHTML = GRID3_LAYOUTS.map((item) => {
    const active = item.id === selectedGrid3Layout ? "active" : "";
    const mini = miniLayoutMarkup("grid3", item.id);
    return `
      <button class="layout-option ${active}" onclick="selectGrid3Layout('${item.id}')" type="button">
        <strong>${item.label}</strong>
        <div class="mini-layout">${mini}</div>
      </button>
    `;
  }).join("");
}

function renderScreenPreview() {
  const config = currentConfig || buildConfigFromForm();
  const layout = config.layout || "fullscreen";
  const preview = document.getElementById("screenPreview");
  if (!preview) return;
  preview.innerHTML = liveLayoutMarkup(layout, selectedGrid3Layout);
  applyPreviewTicker(preview, config.ticker || {});
  startLivePreviewPlayback(config);
}

function applyPreviewTicker(preview, ticker = {}) {
  const existing = preview.querySelector(".preview-ticker");
  if (existing) {
    if (existing.__tickerAnimation) {
      try {
        existing.__tickerAnimation.cancel();
      } catch (_e) {
      }
    }
    existing.remove();
  }

  const layoutEl = preview.querySelector(".preview-layout");
  if (layoutEl) {
    layoutEl.style.height = "100%";
    layoutEl.style.marginTop = "0px";
    layoutEl.style.marginBottom = "0px";
  }

  const text = String(ticker?.text || "").trim();
  if (!text) return;

  const fontSize = Number(ticker?.fontSize || 24);
  const padY = 6;
  const tickerHeight = Math.max(22, Math.round(fontSize + padY * 2));
  const position = String(ticker?.position || "bottom");

  const wrap = document.createElement("div");
  wrap.className = `preview-ticker ${position === "top" ? "top" : "bottom"}`;
  wrap.style.background = String(ticker?.bgColor || "#000");
  wrap.style.height = `${tickerHeight}px`;

  const track = document.createElement("div");
  track.className = "preview-ticker-track";

  const span = document.createElement("span");
  span.className = "preview-ticker-text";
  span.textContent = text;
  span.style.color = String(ticker?.color || "#fff");
  span.style.fontSize = `${fontSize}px`;

  track.appendChild(span);
  wrap.appendChild(track);
  preview.appendChild(wrap);

  if (layoutEl) {
    layoutEl.style.height = `calc(100% - ${tickerHeight}px)`;
    if (position === "top") {
      layoutEl.style.marginTop = `${tickerHeight}px`;
    } else {
      layoutEl.style.marginBottom = `${tickerHeight}px`;
    }
  }

  requestAnimationFrame(() => {
    const previewWidth = preview.clientWidth || 1;
    const textWidth = span.getBoundingClientRect().width || 1;
    const speed = Number.isFinite(Number(ticker?.speed)) ? Number(ticker.speed) : 6;
    const pixelsPerSecond = 40 + speed * 15;
    const distance = previewWidth + textWidth;
    const duration = Math.max(2000, (distance / pixelsPerSecond) * 1000);
    try {
      const animation = track.animate(
        [
          { transform: `translateX(${previewWidth}px)` },
          { transform: `translateX(-${textWidth}px)` },
        ],
        { duration, iterations: Infinity, easing: "linear" }
      );
      wrap.__tickerAnimation = animation;
    } catch (_e) {
    }
  });
}

function buildConfigFromForm() {
  const section1Duration = Number(document.getElementById("duration1").value || 5);
  return {
    orientation: document.getElementById("orientation").value,
    layout: document.getElementById("layout").value,
    grid3Layout: selectedGrid3Layout,
    gridRatio: selectedGridRatio,
    // Keep backward compatibility for player fallback.
    slideDuration: section1Duration,
    animation: document.getElementById("animation")?.value || "slide",
    bgColor: "#000000",
    sections: [
      {
        slideDirection: document.getElementById("dir1").value,
        slideDuration: Number(document.getElementById("duration1").value || 5),
        sourceType: document.getElementById("sourceType1")?.value || SECTION_SOURCE_TYPES.multimedia,
        sourceUrl: document.getElementById("sourceUrl1")?.value || "",
      },
      {
        slideDirection: document.getElementById("dir2").value,
        slideDuration: Number(document.getElementById("duration2").value || 5),
        sourceType: document.getElementById("sourceType2")?.value || SECTION_SOURCE_TYPES.multimedia,
        sourceUrl: document.getElementById("sourceUrl2")?.value || "",
      },
      {
        slideDirection: document.getElementById("dir3").value,
        slideDuration: Number(document.getElementById("duration3").value || 5),
        sourceType: document.getElementById("sourceType3")?.value || SECTION_SOURCE_TYPES.multimedia,
        sourceUrl: document.getElementById("sourceUrl3")?.value || "",
      },
    ],
    ticker: {
      text: document.getElementById("tickerText").value,
      color: document.getElementById("tickerColor").value,
      bgColor: document.getElementById("tickerBgColor").value,
      speed: Number(document.getElementById("tickerSpeed").value || 6),
      fontSize: Number(document.getElementById("tickerFontSize").value || 24),
      position: document.getElementById("tickerPosition").value,
    },
    cache: {
      videoMB: Number(document.getElementById("videoCacheMB")?.value || 2048),
    },
    schedule: getScheduleFromForm(),
  };
}

async function loadPreviewMedia(deviceId) {
  try {
    const targetOrigin = normalizeOrigin(deviceId) || getCurrentOrigin();
    const res = await fetch(`${targetOrigin}/media-list?ts=${Date.now()}`);
    const files = await res.json();
    const grouped = { 1: [], 2: [], 3: [] };
    for (const file of files) {
      const sec = Number(file.section || 1);
      if (!grouped[sec]) grouped[sec] = [];
      grouped[sec].push({
        ...file,
        remoteUrl: prefixRemoteUrl(targetOrigin, file.url),
      });
    }
    previewMediaBySection = grouped;
    resetPreviewState();
  } catch (e) {
    console.log("Preview media load failed", e);
    previewMediaBySection = { 1: [], 2: [], 3: [] };
    resetPreviewState();
  }
}

function startPreviewPolling() {
  if (previewPollTimer) {
    clearInterval(previewPollTimer);
  }

  previewPollTimer = setInterval(async () => {
    await loadPreviewMedia(getPrimaryOrigin());
    renderScreenPreview();
  }, 15000);
}

async function loadPreviewMediaSection(deviceId, sectionNumber) {
  try {
    const targetOrigin = normalizeOrigin(deviceId) || getCurrentOrigin();
    const res = await fetch(`${targetOrigin}/media-list?ts=${Date.now()}`);
    const files = await res.json();
    const next = [];
    for (const file of files) {
      const sec = Number(file.section || 1);
      if (sec !== Number(sectionNumber)) continue;
      next.push({
        ...file,
        remoteUrl: prefixRemoteUrl(targetOrigin, file.url),
      });
    }
    previewMediaBySection[sectionNumber] = next;
    if (previewSectionState[sectionNumber]?.timer) {
      clearTimeout(previewSectionState[sectionNumber].timer);
      previewSectionState[sectionNumber].timer = null;
    }
    previewSectionState[sectionNumber].index = 0;
  } catch (_e) {
  }
}

function updateSectionVisibility() {
  const layout = document.getElementById("layout").value;

  const s1 = document.getElementById("section1Wrapper");
  const s2 = document.getElementById("section2Wrapper");
  const s3 = document.getElementById("section3Wrapper");
  const grid3LayoutSection = document.getElementById("grid3LayoutSection");

  s1.style.display = "block";
  s2.style.display = layout === "fullscreen" ? "none" : "block";
  s3.style.display = layout === "grid3" ? "block" : "none";
  grid3LayoutSection.classList.toggle("hidden", layout !== "grid3" && layout !== "grid2");

  // Ensure layout options normalize selectedGrid3Layout before preview render.
  renderGrid3LayoutOptions();
  renderScreenPreview();
}

function formatStatusTime(value) {
  if (!value) return "-";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "-";
  return dt.toLocaleString();
}

function formatMetaStorage(freeBytes, totalBytes) {
  const free = Number(freeBytes || 0);
  const total = Number(totalBytes || 0);
  if (!total) return "-";
  return `${formatBytes(free)} free / ${formatBytes(total)} total`;
}

function renderHealthSummary(statusList) {
  const list = Array.isArray(statusList) ? statusList : [];
  const online = list.filter((item) => !!item.online).length;
  const offline = list.filter((item) => !item.online).length;
  const errors = list.filter((item) => !!item.lastError).length;
  const freeTotal = list.reduce((sum, item) => sum + Number(item?.meta?.freeBytes || 0), 0);

  const onlineEl = document.getElementById("summaryOnline");
  const offlineEl = document.getElementById("summaryOffline");
  const errorsEl = document.getElementById("summaryErrors");
  const storageEl = document.getElementById("summaryFreeStorage");
  if (onlineEl) onlineEl.textContent = String(online);
  if (offlineEl) offlineEl.textContent = String(offline);
  if (errorsEl) errorsEl.textContent = String(errors);
  if (storageEl) storageEl.textContent = freeTotal ? formatBytes(freeTotal) : "-";

  const detailsEl = document.getElementById("selectedDeviceDetails");
  if (!detailsEl) return;
  const selectedDevice = document.getElementById("deviceSelect")?.value || "all";
  if (selectedDevice === "all") {
    detailsEl.textContent =
      "All devices selected.\nChoose a single device to view detailed health, storage, app version, and last sync info.";
  } else {
    const item = list.find((entry) => getDeviceOptionValue(entry) === selectedDevice);
    if (!item) {
      detailsEl.textContent = "Selected device is currently not connected to CMS.";
    } else {
      const lines = [
        `Device: ${item.deviceId}`,
        `State: ${item.online ? "Online" : "Offline"}`,
        `Last Seen: ${formatStatusTime(item.lastSeen)}`,
        `App Version: ${item.meta?.appVersion || "-"}`,
        `Storage: ${formatMetaStorage(item.meta?.freeBytes || 0, item.meta?.totalBytes || 0)}`,
        `App Data: media ${formatBytes(item.meta?.mediaBytes || 0)}, config ${formatBytes(item.meta?.configBytes || 0)}, cache ${formatBytes(item.meta?.cacheBytes || 0)}`,
        `CMS: ${item.meta?.server || "-"}`,
        `Last App State: ${item.appState || "-"}`,
        `Last Config Sync: ${formatStatusTime(item.meta?.lastConfigSyncAt)}`,
        `Last Media Sync: ${formatStatusTime(item.meta?.lastMediaSyncAt)}`,
      ];
      const playback = item.meta?.currentPlaybackBySection || {};
      Object.keys(playback)
        .sort((a, b) => Number(a) - Number(b))
        .forEach((sectionKey) => {
          const section = playback[sectionKey] || {};
          const pageText = Number(section.page || 0) > 0 ? ` (page ${section.page})` : "";
          lines.push(
            `Section ${sectionKey}: ${section.title || "-"}${pageText} [${section.sourceType || "-"}${section.mediaType ? `/${section.mediaType}` : ""}]`
          );
          if (Number(section.itemDurationMs || 0) > 0) {
            lines.push(
              `Section ${sectionKey} Run: ${formatDurationMs(section.itemElapsedMs)} / ${formatDurationMs(section.itemDurationMs)}`
            );
          }
          if (Number(section.playlistTotalMs || 0) > 0) {
            lines.push(
              `Section ${sectionKey} Total: ${formatDurationMs(section.playlistElapsedMs)} / ${formatDurationMs(section.playlistTotalMs)}`
            );
          }
        });
      const diagnostics = Array.isArray(item.meta?.recentDiagnostics)
        ? item.meta.recentDiagnostics.slice(-5)
        : [];
      diagnostics.forEach((entry) => {
        lines.push(
          `Diag: ${formatStatusTime(entry?.time)} [${String(entry?.type || "-")}] ${String(entry?.message || "-")}`
        );
      });
      const recentEvents = Array.isArray(item.recentEvents) ? item.recentEvents.slice(-5) : [];
      recentEvents.forEach((entry) => {
        lines.push(
          `Event: ${formatStatusTime(entry?.time)} [${String(entry?.type || "-")}] ${String(entry?.message || "-")}`
        );
      });
      if (item.lastDisconnectAt) {
        lines.push(`Disconnected: ${formatStatusTime(item.lastDisconnectAt)} (${item.lastDisconnectReason || "unknown"})`);
      }
      if (item.lastError) {
        lines.push(`Last Error: ${item.lastError}`);
      }
      detailsEl.textContent = lines.join("\n");
    }
  }
  renderDeviceDashboardList(list);
}

function renderDeviceDashboardList(statusList) {
  const box = document.getElementById("deviceDashboardList");
  if (!box) return;
  const list = Array.isArray(statusList) ? statusList : [];
  const selectedDevice = document.getElementById("deviceSelect")?.value || "all";
  const searchValue = String(document.getElementById("deviceDashboardSearch")?.value || "")
    .trim()
    .toLowerCase();
  const filtered = !searchValue
    ? list
    : list.filter((item) => {
        const haystack = [
          item.deviceId,
          item.appState,
          item.lastError,
          item.meta?.appVersion,
          item.online ? "online" : "offline",
        ]
          .map((value) => String(value || "").toLowerCase())
          .join(" ");
        return haystack.includes(searchValue);
      });

  if (!filtered.length) {
    box.innerHTML = `<div class="alerts-empty">No device health data available.</div>`;
    return;
  }

  box.innerHTML = filtered
    .map((item) => {
      const optionValue = getDeviceOptionValue(item);
      const isSelected = selectedDevice === optionValue;
      const stateText = item.online ? "Online" : item.lastError ? "Error" : "Offline";
      const freeBytes = Number(item.meta?.freeBytes || 0);
      const totalBytes = Number(item.meta?.totalBytes || 0);
      const storageRatio = totalBytes > 0 ? freeBytes / totalBytes : 1;
      const lowStorage = totalBytes > 0 && storageRatio < 0.12;
      const summaryLines = [
        `Version: ${item.meta?.appVersion || "-"}`,
        `Last Seen: ${formatStatusTime(item.lastSeen)}`,
        `Storage: ${formatMetaStorage(item.meta?.freeBytes || 0, item.meta?.totalBytes || 0)}`,
        `Media: ${formatBytes(item.meta?.mediaBytes || 0)}`,
        `Cache: ${formatBytes(item.meta?.cacheBytes || 0)}`,
        `State: ${item.appState || "-"}`,
        `Config Sync: ${formatStatusTime(item.meta?.lastConfigSyncAt)}`,
        `Media Sync: ${formatStatusTime(item.meta?.lastMediaSyncAt)}`,
      ];
      const playback = item.meta?.currentPlaybackBySection || {};
      const firstPlaybackKey = Object.keys(playback)
        .sort((a, b) => Number(a) - Number(b))[0];
      if (firstPlaybackKey) {
        const playing = playback[firstPlaybackKey] || {};
        summaryLines.push(`Playing: S${firstPlaybackKey} ${playing.title || "-"}`);
        if (Number(playing.itemDurationMs || 0) > 0) {
          summaryLines.push(
            `Run: ${formatDurationMs(playing.itemElapsedMs)} / ${formatDurationMs(playing.itemDurationMs)}`
          );
        }
      }
      const lastDiag = Array.isArray(item.meta?.recentDiagnostics)
        ? item.meta.recentDiagnostics[item.meta.recentDiagnostics.length - 1]
        : null;
      if (lastDiag?.message) {
        summaryLines.push(`Diag: [${String(lastDiag.type || "-")}] ${String(lastDiag.message)}`);
      }
      const lastEvent = Array.isArray(item.recentEvents)
        ? item.recentEvents[item.recentEvents.length - 1]
        : null;
      if (lastEvent?.message) {
        summaryLines.push(`Event: [${String(lastEvent.type || "-")}] ${String(lastEvent.message)}`);
      }
      if (item.lastError) {
        summaryLines.push(`Error: ${item.lastError}`);
      }
      return `
        <button
          type="button"
          class="dashboard-card ${isSelected ? "is-selected" : ""} ${lowStorage ? "is-warning" : ""}"
          onclick="selectDeviceFromDashboard('${String(optionValue).replace(/'/g, "\\'")}')"
        >
          <div class="dashboard-card-head">
            <div class="dashboard-card-title">${item.deviceId}</div>
            <div class="alert-state ${item.online ? "online" : item.lastError ? "error" : "offline"}">${stateText}</div>
          </div>
          <div class="dashboard-card-meta">${summaryLines.join("\n")}</div>
        </button>
      `;
    })
    .join("");
}

function toggleDeviceDashboard(forceValue) {
  const overlay = document.getElementById("deviceDashboardOverlay");
  if (!overlay) return;
  isDeviceDashboardOpen =
    typeof forceValue === "boolean" ? forceValue : !isDeviceDashboardOpen;
  overlay.classList.toggle("hidden", !isDeviceDashboardOpen);
  if (isDeviceDashboardOpen) {
    renderHealthSummary(latestDeviceStatusList);
  }
}

function selectDeviceFromDashboard(deviceValue) {
  if (!currentDeviceMap.has(deviceValue)) return;
  selectedDeviceOrigins = new Set([deviceValue]);
  syncHiddenDeviceSelect();
  renderDeviceChecklist();
  loadConfig();
  renderHealthSummary(latestDeviceStatusList);
  renderDeviceAlerts(latestDeviceStatusList);
  loadPreviewMedia(getPrimaryOrigin()).then(renderScreenPreview).catch(() => {});
}

function renderDeviceAlerts(statusList) {
  const box = document.getElementById("deviceAlertsList");
  if (!box) return;

  const selectedOrigins = new Set(getSelectedOrigins());
  const filtered = !selectedOrigins.size || selectedOrigins.size === currentDeviceMap.size
    ? statusList
    : statusList.filter((s) => selectedOrigins.has(getDeviceOptionValue(s)));

  if (!filtered.length) {
    box.innerHTML = `<div class="alerts-empty">No device alerts yet.</div>`;
    return;
  }

  box.innerHTML = filtered
    .map((item) => {
      const online = !!item.online;
      const hasError = !!item.lastError;
      const offline = !online;
      const stateClass = online ? "online" : hasError ? "error" : "offline";
      const stateText = online ? "Online" : hasError ? "Error" : "Offline";
      const cardClass = online ? "" : hasError ? "error" : "offline";

      const details = [
        `Last Seen: ${formatStatusTime(item.lastSeen)}`,
      ];
      if (item.lastDisconnectAt) {
        details.push(
          `Disconnected: ${formatStatusTime(item.lastDisconnectAt)} (${item.lastDisconnectReason || "unknown"})`
        );
      }
      if (item.lastErrorAt) {
        details.push(`Error At: ${formatStatusTime(item.lastErrorAt)}`);
      }
      if (item.lastError) {
        details.push(`Error: ${item.lastError}`);
      }
      if (item.meta?.appVersion) {
        details.push(`App Version: ${item.meta.appVersion}`);
      }
      if (item.meta && (item.meta.totalBytes || item.meta.freeBytes)) {
        details.push(
          `Storage: ${formatMetaStorage(item.meta.freeBytes, item.meta.totalBytes)}`
        );
      }
      if (item.meta) {
        details.push(
          `App Data: media ${formatBytes(item.meta.mediaBytes || 0)}, config ${formatBytes(
            item.meta.configBytes || 0
          )}, cache ${formatBytes(item.meta.cacheBytes || 0)}`
        );
      }
      if (item.meta?.server) {
        details.push(`CMS: ${item.meta.server}`);
      }
      if (item.meta?.apkUpdate?.status === "success") {
        const previousVersion = item.meta?.apkUpdate?.previousVersion || "-";
        const currentVersion = item.meta?.apkUpdate?.currentVersion || item.meta?.appVersion || "-";
        details.push(`APK Updated: ${previousVersion} -> ${currentVersion}`);
      }

      return `
        <div class="alert-item ${cardClass}">
          <div class="alert-head">
            <div class="alert-device">${item.deviceId}</div>
            <div class="alert-state ${stateClass}">${stateText}</div>
          </div>
          <div class="alert-meta">${details.join("<br/>")}</div>
        </div>
      `;
    })
    .join("");
}

function showApkUpdateSuccessNotices(statusList) {
  const list = Array.isArray(statusList) ? statusList : [];
  list.forEach((item) => {
    if (item?.appState !== "apk-update-success") return;
    if (item?.meta?.apkUpdate?.status !== "success") return;

    const previousVersion = String(item?.meta?.apkUpdate?.previousVersion || "").trim();
    const currentVersion = String(
      item?.meta?.apkUpdate?.currentVersion || item?.meta?.appVersion || ""
    ).trim();
    const reportedAt = String(item?.meta?.apkUpdate?.reportedAt || item?.lastSeen || "").trim();
    const noticeKey = `${String(item?.deviceId || "")}|${currentVersion}|${reportedAt}`;
    if (!noticeKey || seenApkUpdateSuccessNotices.has(noticeKey)) return;
    seenApkUpdateSuccessNotices.add(noticeKey);

    const versionText =
      previousVersion && currentVersion
        ? `from version ${previousVersion} to ${currentVersion}`
        : currentVersion
        ? `to version ${currentVersion}`
        : "successfully";

    showNotice(
      "success",
      "APK Updated",
      `Device ${item.deviceId} has been updated ${versionText}.`,
      7000
    );
  });
}

function buildLatestDeviceStatusList(fetchedDevices = []) {
  const merged = new Map();
  const pushDevice = (device) => {
    if (!device) return;
    const optionValue = getDeviceOptionValue(device);
    const fallbackOrigin = normalizeOrigin(device?.origin || device?.publicUrl || device?.localUrl || "");
    const key = String(device?.deviceId || optionValue || fallbackOrigin || "").trim();
    if (!key) return;
    const existing = merged.get(key) || {};
    const next = {
      ...existing,
      ...device,
    };
    if (existing.online === true || device?.online === true) {
      next.online = true;
    } else if (existing.online === false || device?.online === false) {
      next.online = false;
    } else {
      next.online = true;
    }
    merged.set(key, next);
  };

  Array.from(currentDeviceMap.values()).forEach(pushDevice);
  (Array.isArray(fetchedDevices) ? fetchedDevices : []).forEach(pushDevice);
  return Array.from(merged.values());
}

async function loadDeviceAlerts(options = {}) {
  try {
    if (options?.forceScan) {
      await scanSubnetForDevices(true);
    }
    let fetchedList = [];
    if (IS_TV_COMPACT_MODE) {
      const res = await fetch(`/status?ts=${Date.now()}`);
      const status = await res.json();
      fetchedList = [buildLocalTvDevice(status)];
    } else {
      const res = await fetch(`/devices?ts=${Date.now()}`, { cache: "no-store" });
      const list = await res.json();
      fetchedList = Array.isArray(list) ? list : [];
    }
    upsertDiscoveredDevices(fetchedList);
    latestDeviceStatusList = buildLatestDeviceStatusList(fetchedList);
    window.__latestDeviceStatusList = latestDeviceStatusList;
    showApkUpdateSuccessNotices(latestDeviceStatusList);
    renderDeviceChecklist();
    renderHealthSummary(latestDeviceStatusList);
    renderDeviceAlerts(latestDeviceStatusList);
    renderScreenPreview();
  } catch (_e) {
    const box = document.getElementById("deviceAlertsList");
    if (box) {
      box.innerHTML = `<div class="alerts-empty">Unable to load device alerts.</div>`;
    }
    window.__latestDeviceStatusList = latestDeviceStatusList;
    renderHealthSummary(latestDeviceStatusList);
    renderScreenPreview();
  }
}

function startAlertsPolling() {
  if (alertsPollTimer) {
    clearInterval(alertsPollTimer);
  }
  loadDeviceAlerts();
  alertsPollTimer = setInterval(loadDeviceAlerts, 5000);
}

function onSectionSourceChange(section) {
  updateSectionUploadMode(section);
  currentConfig = buildConfigFromForm();
  renderScreenPreview();
}

function onSectionSourceUrlInput() {
  currentConfig = buildConfigFromForm();
  renderScreenPreview();
}

function updateSectionUploadMode(section) {
  const typeEl = document.getElementById(`sourceType${section}`);
  const uploadWrap = document.getElementById(`uploadWrap${section}`);
  const sourceWrap = document.getElementById(`sourceUrlWrap${section}`);
  const sourceInput = document.getElementById(`sourceUrl${section}`);
  if (!typeEl) return;

  const sourceType = typeEl.value || SECTION_SOURCE_TYPES.multimedia;
  if (uploadWrap) uploadWrap.classList.toggle("hidden", sourceType !== SECTION_SOURCE_TYPES.multimedia);
  if (sourceWrap) sourceWrap.classList.toggle("hidden", sourceType === SECTION_SOURCE_TYPES.multimedia);

  if (sourceInput) {
    if (sourceType === SECTION_SOURCE_TYPES.youtube) {
      sourceInput.placeholder = "https://youtube.com/watch?v=...";
    } else if (sourceType === SECTION_SOURCE_TYPES.web) {
      sourceInput.placeholder = "https://example.com";
    } else {
      sourceInput.placeholder = "";
    }
  }
}

function renderUploadSections() {
  const layout = document.getElementById("layout").value;
  const container = document.getElementById("uploadSections");
  container.innerHTML = "";

  const count = sectionCount(layout);

    for (let i = 1; i <= count; i++) {
      container.innerHTML += `
        <div class="upload-section-card">
            <h3>Section ${i}</h3>
            <div class="source-controls">
              <label>Source Type</label>
              <select id="sourceType${i}" onchange="onSectionSourceChange(${i})">
            <option value="multimedia">Multimedia (Image/Video)</option>
            <option value="web">Website URL</option>
            <option value="youtube">YouTube URL</option>
          </select>
        </div>
        <div id="sourceUrlWrap${i}" class="hidden">
          <input
            type="text"
            id="sourceUrl${i}"
            class="source-url-input"
            placeholder=""
            oninput="onSectionSourceUrlInput()"
          />
        </div>
          ${
              IS_TV_COMPACT_MODE
                ? `
                  <div id="uploadWrap${i}" class="tv-upload-stack">
                    <div class="tv-upload-row">
                      <button class="btn warning tv-section-chip" type="button" onclick="triggerTvSectionPick(${i})">S${i}</button>
                    </div>
                    <div class="tv-upload-row">
                      <div id="tvPickStatus${i}" class="tv-upload-input-look">${getTvPickStatusText(i)}</div>
                    </div>
                  </div>
                `
            : `
              <div id="uploadWrap${i}" class="upload-row">
                <input
                  type="file"
                  id="media${i}"
                  multiple
                  accept=".mp4,.m4v,.mov,.mkv,.webm,.jpg,.jpeg,.png,.txt,.pdf,.ppt,.pptx,.pptm,.pps,.ppsx,.potx,video/mp4,video/quicktime,video/webm,image/jpeg,image/png,text/plain,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint.presentation.macroenabled.12,application/vnd.openxmlformats-officedocument.presentationml.slideshow,application/vnd.ms-powerpoint.slideshow.macroenabled.12,application/vnd.openxmlformats-officedocument.presentationml.template"
                />
                <button class="btn primary" type="button" onclick="uploadMedia(${i})">Upload Section ${i}</button>
              </div>
            `
        }
      </div>
    `;
    updateSectionUploadMode(i);
  }
}

function getTvPickStatusText(section) {
  const state = tvPickedState[Number(section) || 1] || { count: 0, ready: false };
  if (state.ready && state.count > 0) {
    return `${state.count} file(s) selected. Uploading to Section ${section}...`;
  }
  return `Tap S${section}, choose files, and they will upload automatically.`;
}

function updateTvPickStatus(section) {
  const statusEl = document.getElementById(`tvPickStatus${section}`);
  if (statusEl) {
    statusEl.textContent = getTvPickStatusText(section);
  }
}

function triggerTvSectionPick(section) {
  if (!window.ReactNativeWebView) {
    showNotice("warning", "TV Picker Unavailable", "Native TV file picker is available only inside the TV app.", 5000);
    return;
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: "TV_PICK_SECTION",
    section: Number(section || 1),
  }));
}

function triggerTvSectionUpload(section) {
  if (!window.ReactNativeWebView) {
    showNotice("warning", "TV Upload Unavailable", "Native TV upload is available only inside the TV app.", 5000);
    return;
  }
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: "TV_UPLOAD_SECTION",
    section: Number(section || 1),
    targets: [getCurrentOrigin()],
  }));
}

function handleTvNativeEvent(payload) {
  const section = Number(payload?.section || 1);
  if (payload?.type === "TV_PICK_COMPLETE") {
    tvPickedState[section] = {
      count: Number(payload?.count || 0),
      ready: true,
    };
    updateTvPickStatus(section);
    if (tvPickedState[section].count <= 0) {
      showNotice("warning", "No Files Selected", `No file was selected for Section ${section}.`, 3500);
      tvPickedState[section] = { count: 0, ready: false };
      updateTvPickStatus(section);
      return;
    }
    showNotice("info", "Uploading", `${tvPickedState[section].count} file(s) selected for Section ${section}. Upload starting...`, 3500);
    triggerTvSectionUpload(section);
    return;
  }
  if (payload?.type === "TV_PICK_FAILED") {
    tvPickedState[section] = { count: 0, ready: false };
    updateTvPickStatus(section);
    showNotice("warning", "Selection Cancelled", String(payload?.message || "File selection cancelled."), 4500);
    return;
  }
  if (payload?.type === "TV_UPLOAD_COMPLETE") {
    tvPickedState[section] = { count: 0, ready: false };
    updateTvPickStatus(section);
    const primaryOrigin = getPrimaryOrigin();
    if (primaryOrigin) {
      loadPreviewMediaSection(primaryOrigin, section)
        .then(() => renderScreenPreview())
        .catch(() => {});
    }
    showNotice("success", "Upload Complete", `${Number(payload?.count || 0)} file(s) uploaded to Section ${section}.`, 4000);
    return;
  }
  if (payload?.type === "TV_UPLOAD_FAILED") {
    showNotice("error", "Upload Failed", String(payload?.message || "Unable to upload picked files."), 6000);
  }
}

window.handleTvNativeEvent = handleTvNativeEvent;
window.triggerTvSectionPick = triggerTvSectionPick;

function selectGrid3Layout(layoutId) {
  selectedGrid3Layout = layoutId;
  if (currentConfig) currentConfig.grid3Layout = layoutId;
  updateGridRatioOptions();
  if (currentConfig) currentConfig.gridRatio = selectedGridRatio;
  renderGrid3LayoutOptions();
  renderScreenPreview();
}

async function loadDevices(options = {}) {
  const previousSelected = new Set(selectedDeviceOrigins);
  await loadAccessOverrides();

  if (IS_TV_COMPACT_MODE) {
    currentDeviceMap = new Map();
    let localStatus = {};
    try {
      const res = await fetch(`/status?ts=${Date.now()}`);
      localStatus = await res.json().catch(() => ({}));
    } catch (_e) {
      localStatus = {};
    }
    const localDevice = buildLocalTvDevice(localStatus);
    currentDeviceMap.set(getCurrentOrigin(), localDevice);
    rebuildHiddenDeviceSelectOptions();
    selectedDeviceOrigins = new Set([getCurrentOrigin()]);
    syncHiddenDeviceSelect();
    persistSelectedOrigins();
    renderDeviceChecklist();
    return;
  }

  let devices = [];
  try {
    const res = await fetch(`/devices?ts=${Date.now()}`, { cache: "no-store" });
    devices = await res.json();
  } catch (_e) {
    devices = [];
  }

  const normalizedDevices = Array.isArray(devices) ? devices.slice() : [];
  if (!normalizedDevices.length) {
    normalizedDevices.push({
      name: "This TV",
      deviceId: "local-tv",
      ip: window.location.hostname || "127.0.0.1",
      localUrl: getCurrentOrigin(),
      publicUrl: getCurrentOrigin(),
      origin: getCurrentOrigin(),
      online: true,
    });
  }
  if (!currentDeviceMap.size) {
    currentDeviceMap = new Map();
  }
  upsertDiscoveredDevices(normalizedDevices);
  Object.entries(cmsAccessOverrides || {}).forEach(([deviceId, override]) => {
    const origin = withPreferredPort(override?.origin || "", override?.preferredPort);
    if (!origin || currentDeviceMap.has(origin)) return;
    currentDeviceMap.set(origin, {
      name: deviceId,
      deviceId,
      origin,
      publicUrl: origin,
      localUrl: origin,
      accessOverride: override,
      online: false,
    });
  });
  rebuildHiddenDeviceSelectOptions();

  const nextSelected = Array.from(previousSelected).filter((value) => currentDeviceMap.has(value));
  const storedSelected = loadStoredSelectedOrigins().filter((value) => currentDeviceMap.has(value));
  selectedDeviceOrigins = new Set(
    nextSelected.length
      ? nextSelected
      : storedSelected.length
        ? storedSelected
        : Array.from(currentDeviceMap.keys())
  );
  syncHiddenDeviceSelect();
  persistSelectedOrigins();
  renderDeviceChecklist();
  if (options?.waitForScan || options?.forceScan) {
    await scanSubnetForDevices(!!options.forceScan);
  } else {
    void scanSubnetForDevices();
  }
}

async function uploadMedia(section) {
  const sourceType = document.getElementById(`sourceType${section}`)?.value || SECTION_SOURCE_TYPES.multimedia;
  if (sourceType !== SECTION_SOURCE_TYPES.multimedia) {
    showNotice("info", "Upload Not Required", "For Website/YouTube source, upload is not required. Save settings only.");
    return;
  }

  const loader = document.getElementById("uploadLoader");
  const input = document.getElementById(`media${section}`);
  const files = input?.files;

  const { errors, warnings, validFiles, totalSize } = validateUploadFiles(files);
  const selectedHasVideo = validFiles.some((f) => VIDEO_FILE_EXT.test(f.name || ""));
  const selectedHasPpt = validFiles.some((f) => PPT_FILE_EXT.test(f.name || ""));

  if (errors.length) {
    showNotice("error", "Upload Validation Failed", errors.join("\n"), 7000);
    return;
  }

  if (warnings.length) {
    const proceed = await showConfirmDialog(
      "Large Upload Warning",
      `${warnings.join("\n")}\n\nTotal upload size: ${formatBytes(
        totalSize
      )}\n\nContinue upload?`
    );
    if (!proceed) return;
  }

  let primaryOrigin = "";
  let uploadFiles = [...validFiles];
  let targetDevices = [];

  try {
    loader.classList.remove("hidden");
    updateUploadProgress(0, "Preparing upload...");
    resetUploadDetails();

    const { onlineTargets, offlineTargets } = getOnlineTargetDevices();
    const allSelectedTargets = [...onlineTargets, ...offlineTargets].map((device) => ({
      ...device,
      origin: getDeviceOptionValue(device),
      label: device.name || device.deviceId || getDeviceOptionValue(device),
    })).filter((item) => item.origin);
    targetDevices = allSelectedTargets.filter((device) => device.online !== false);
    const deviceOrigins = targetDevices.map((item) => item.origin);
    if (!deviceOrigins.length) {
      if (offlineTargets.length) {
        throw new Error("All selected devices are offline. Only online devices can receive uploads.");
      }
      throw new Error("Select at least one device first.");
    }
    primaryOrigin = deviceOrigins[0];
    if (selectedHasVideo) {
      const allowed = await canUploadVideosToSection(primaryOrigin, section);
      if (!allowed) {
        showNotice(
          "warning",
          "Video/PPT Upload Restricted",
          "Video/PPT allowed in only one grid section. Remove PPT/video from all sections first.",
          6500
        );
        return;
      }
    }
    if (selectedHasPpt) {
      const allowed = await canUploadPptToSection(primaryOrigin, section);
      if (!allowed) {
        showNotice(
          "warning",
          "PPT/Video Upload Restricted",
          "PPT/video allowed in only one grid section. Remove PPT/video from all sections first.",
          6500
        );
        return;
      }
    }

    const legacyPpt = uploadFiles.filter((f) => PPT_LEGACY_EXT.test(f.name || ""));
    if (legacyPpt.length) {
      throw new Error("Old PowerPoint (.ppt/.pps) not supported. Please save as .pptx and retry.");
    }

    const pptxFiles = uploadFiles.filter((f) => PPTX_FILE_EXT.test(f.name || ""));
    let containsPpt = false;
    if (pptxFiles.length) {
      updateUploadProgress(0, "Converting PowerPoint slides to images...");
      const nonPptx = uploadFiles.filter((f) => !PPTX_FILE_EXT.test(f.name || ""));
      const convertedPptImages = [];
      let slideCounter = 0;
      for (const pptxFile of pptxFiles) {
        const slides = await convertPptxFileToImages(pptxFile);
        slideCounter += slides.length;
        convertedPptImages.push(...slides);
        updateUploadProgress(0, `PowerPoint converted: ${slideCounter} slide(s)`);
      }
      uploadFiles = [...nonPptx, ...convertedPptImages];
      containsPpt = true;
      if (!uploadFiles.length) {
        throw new Error("No uploadable files generated from PowerPoint");
      }
    }

    const pdfFiles = uploadFiles.filter((f) => /\.pdf$/i.test(f.name || ""));
    if (pdfFiles.length) {
      updateUploadProgress(0, "Converting PDF pages to image slides...");
      const nonPdf = uploadFiles.filter((f) => !/\.pdf$/i.test(f.name || ""));
      const convertedPdfImages = [];
      for (const pdfFile of pdfFiles) {
        const pages = await convertPdfFileToImages(pdfFile);
        convertedPdfImages.push(...pages);
      }
      uploadFiles = [...nonPdf, ...convertedPdfImages];
      if (!uploadFiles.length) {
        throw new Error("No uploadable files generated from PDF");
      }
    }

    updateUploadProgress(
      0,
      `Queueing ${uploadFiles.length} file(s), ${formatBytes(totalSize)} for ${deviceOrigins.length} device${deviceOrigins.length === 1 ? "" : "s"}`
    );

    const duplicateOrigins = await detectDuplicateUploadTargets(targetDevices, section, uploadFiles);
    const tracker = createAggregateProgressTracker(allSelectedTargets.length, section);
    const successfulTargets = [];
    const failedTargets = [];
    const recoveredTargets = [];
    const skippedOfflineTargets = [];
    const skippedDuplicateTargets = [];
    allSelectedTargets.forEach((target, idx) => {
      tracker.setLabel(idx, target.label);
      if (target.online === false) {
        tracker.setState(idx, "skipped", "Skipped: device is offline", 100);
        skippedOfflineTargets.push(target);
      } else if (duplicateOrigins.has(target.origin)) {
        tracker.setState(idx, "skipped", "Skipped: identical files already exist", 100);
        skippedDuplicateTargets.push(target);
      } else {
        tracker.setState(idx, "pending", "Waiting in queue", 0);
      }
    });

    const queuedTargets = allSelectedTargets
      .map((target, idx) => ({ ...target, index: idx }))
      .filter((target) => target.online !== false && !duplicateOrigins.has(target.origin));

    for (let queueIndex = 0; queueIndex < queuedTargets.length; queueIndex += 1) {
      const target = queuedTargets[queueIndex];
      tracker.setState(
        target.index,
        "uploading",
        `Uploading now (${queueIndex + 1}/${queuedTargets.length})`,
        0
      );
      try {
        await uploadToOriginWithRetry(
          target.origin,
          section,
          () => cloneUploadFormData(uploadFiles, containsPpt),
          tracker,
          target.index
        );
        successfulTargets.push(target);
      } catch (error) {
        const rawMessage = String(error?.message || "Upload failed");
        const shouldVerify = /network error during upload|upload timed out/i.test(rawMessage);
        let recovered = false;
        if (shouldVerify) {
          updateUploadProgress(
            Math.max(92, Math.min(99, Math.round(((queueIndex + 1) / Math.max(queuedTargets.length, 1)) * 100))),
            `Connection interrupted for ${target.label}. Verifying saved media...`
          );
          const verifyResults = await verifyUploadedFilesAcrossSelectedOrigins([target], section, uploadFiles, tracker);
          recovered = !!verifyResults[0]?.verified;
        }
        if (recovered) {
          successfulTargets.push(target);
          recoveredTargets.push(target);
          continue;
        }
        tracker.setState(target.index, "error", rawMessage, 0);
        failedTargets.push({ ...target, message: rawMessage });
      }
    }

    if (successfulTargets.length) {
      await loadPreviewMediaSection(primaryOrigin, section);
      renderScreenPreview();
    }

    tracker.finish(`Upload queue finished. ${successfulTargets.length}/${queuedTargets.length} devices updated.`);
    const summaryParts = [
      successfulTargets.length
        ? `${successfulTargets.length} device${successfulTargets.length === 1 ? "" : "s"} updated with new media.`
        : "",
      failedTargets.length
        ? `${failedTargets.length} device${failedTargets.length === 1 ? "" : "s"} failed and will keep previous media.`
        : "",
      skippedOfflineTargets.length
        ? `${skippedOfflineTargets.length} offline device${skippedOfflineTargets.length === 1 ? "" : "s"} skipped.`
        : "",
      skippedDuplicateTargets.length
        ? `${skippedDuplicateTargets.length} device${skippedDuplicateTargets.length === 1 ? "" : "s"} already had the same files.`
        : "",
      recoveredTargets.length
        ? `${recoveredTargets.length} upload${recoveredTargets.length === 1 ? "" : "s"} were verified after connection interruption.`
        : "",
    ].filter(Boolean);
    const failedNames = failedTargets.map((target) => target.label).filter(Boolean);
    if (failedNames.length) {
      summaryParts.push(`Failed: ${failedNames.join(", ")}.`);
    }
    const hasMeaningfulSkip = skippedOfflineTargets.length || skippedDuplicateTargets.length;
    if (successfulTargets.length && !failedTargets.length) {
      showNotice("success", "Upload Complete", summaryParts.join(" "));
    } else if (successfulTargets.length) {
      showNotice("warning", "Upload Partially Complete", summaryParts.join(" "), 8500);
    } else if (hasMeaningfulSkip && !failedTargets.length) {
      showNotice("warning", "No Upload Needed", summaryParts.join(" ") || "Selected devices did not need a new upload.", 7000);
    } else {
      showNotice("error", "Upload Failed", summaryParts.join(" ") || "No device accepted the new media.", 8500);
    }
  } catch (err) {
    const rawMessage = String(err?.message || "Unknown error");
    const message = /pdf engine/i.test(rawMessage)
      ? `${rawMessage}\n\nPDF uploads require conversion on the CMS page before sending to devices.`
      : /pptx|powerpoint/i.test(rawMessage)
      ? `${rawMessage}\n\nPowerPoint conversion happens in the CMS browser. Please ensure the CMS PC has internet access to load the viewer libraries.`
      : rawMessage;
    showNotice("error", "Upload Failed", message, 7000);
  } finally {
    loader.classList.add("hidden");
    updateUploadProgress(0, "Preparing upload...");
    resetUploadDetails();
  }
}

async function loadConfig() {
  const targetDevice = getPrimaryOrigin();
  const res = await fetch(`${targetDevice}/config?ts=${Date.now()}`);
  const config = await res.json();

  document.getElementById("orientation").value = config.orientation || "horizontal";
  document.getElementById("layout").value = config.layout || "fullscreen";
  document.getElementById("animation").value = config.animation || "slide";

  document.getElementById("dir1").value = config.sections?.[0]?.slideDirection || "left";
  document.getElementById("dir2").value = config.sections?.[1]?.slideDirection || "left";
  document.getElementById("dir3").value = config.sections?.[2]?.slideDirection || "left";

  document.getElementById("duration1").value = config.sections?.[0]?.slideDuration || 7;
  document.getElementById("duration2").value = config.sections?.[1]?.slideDuration || 13;
  document.getElementById("duration3").value = config.sections?.[2]?.slideDuration || 19;

  document.getElementById("tickerText").value =
    config.ticker?.text || "Breaking News: NextView Premium Product New Update Available!";
  document.getElementById("tickerFontSize").value = config.ticker?.fontSize || 24;
  document.getElementById("tickerPosition").value = config.ticker?.position || "bottom";
  document.getElementById("tickerColor").value = config.ticker?.color || "#ffffff";
  document.getElementById("tickerBgColor").value = config.ticker?.bgColor || "#000000";
  document.getElementById("tickerSpeed").value = config.ticker?.speed ?? 6;
  document.getElementById("videoCacheMB").value = config.cache?.videoMB || 2048;
  setScheduleToForm(config.schedule);

  selectedGrid3Layout = config.grid3Layout || "stack-v";
  selectedGridRatio = config.gridRatio || "1:1:1";
  currentConfig = {
    ...config,
    grid3Layout: selectedGrid3Layout,
    gridRatio: selectedGridRatio,
  };
  await loadPreviewMedia(targetDevice);
  updateGridRatioOptions();
  renderGrid3LayoutOptions();
  renderUploadSections();
  for (let i = 1; i <= 3; i++) {
    const sectionConfig = config.sections?.[i - 1] || {};
    const typeEl = document.getElementById(`sourceType${i}`);
    const urlEl = document.getElementById(`sourceUrl${i}`);
    if (typeEl) typeEl.value = sectionConfig.sourceType || SECTION_SOURCE_TYPES.multimedia;
    if (urlEl) urlEl.value = sectionConfig.sourceUrl || "";
    updateSectionUploadMode(i);
  }
  updateSectionVisibility();
}

async function saveConfig() {
  const config = buildConfigFromForm();
  const { onlineTargets } = getOnlineTargetDevices();
  const targetDevices = onlineTargets
    .map((device) => getDeviceOptionValue(device))
    .filter(Boolean);

  if (!targetDevices.length) {
    showNotice("warning", "No Online Device Selected", "Select at least one online device before saving settings.", 5000);
    return;
  }

  currentConfig = config;
  renderScreenPreview();
  setLoaderVisibility(true);
  updateUploadProgress(6, `Applying settings to ${targetDevices.length} device${targetDevices.length === 1 ? "" : "s"}...`);

  try {
    let completed = 0;
    const requests = targetDevices.map(async (targetDevice) => {
      const res = await fetch(`${targetDevice}/config`, {
        method: "POST",
        headers: buildCmsAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ config }),
      });

      if (!res.ok) {
        let msg = `Save failed (HTTP ${res.status})`;
        try {
          const data = await res.json();
          if (data?.message) msg = data.message;
          else if (data?.error) msg = data.error;
        } catch (_e) {
        }
        throw new Error(msg);
      }
      const payload = await res.json().catch(() => ({ success: true }));
      completed += 1;
      updateUploadProgress(
        Math.max(10, Math.min(100, Math.round((completed / Math.max(targetDevices.length, 1)) * 100))),
        `Settings applied on ${completed} of ${targetDevices.length} device${targetDevices.length === 1 ? "" : "s"}...`
      );
      return payload;
    });

    const results = await Promise.allSettled(requests);
    const failed = results.find((item) => item.status === "rejected");
    if (failed && failed.status === "rejected") {
      throw new Error(String(failed.reason?.message || "Unable to save configuration."));
    }

    updateUploadProgress(100, "Configuration applied successfully.");
    showNotice("success", "Settings Saved", "Configuration has been applied successfully.", 2200);
    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage("CONFIG_SAVED");
    }
  } catch (err) {
    showNotice("error", "Save Failed", String(err?.message || "Unable to save configuration."), 6500);
  } finally {
    setTimeout(() => {
      setLoaderVisibility(false);
      updateUploadProgress(0, "Preparing upload...");
    }, 350);
  }
}

async function clearDeviceData() {
  if (!getEffectiveTargetOrigins().length) {
    showNotice("warning", "No Device Selected", "Select at least one device first.", 5000);
    return;
  }
  const deviceId = getSelectedDeviceValue();
  const confirmMsg =
    deviceId === "all"
      ? "Are you sure? This will clear app data on ALL connected devices."
      : "Are you sure? This will clear app data.";

  if (!(await showConfirmDialog("Clear Device Data", confirmMsg, "Yes, Clear", "Cancel"))) return;

  const { onlineTargets } = getOnlineTargetDevices();
  const total = Math.max(1, onlineTargets.length);
  setLoaderVisibility(true);
  updateUploadProgress(10, `Sending clear data command to ${total} device${total === 1 ? "" : "s"}...`);

  try {
    const results = await postToSelectedDevices("/config/clear-device");
    const okCount = results.filter((item) => item?.success !== false).length;
    updateUploadProgress(
      100,
      `Clear data command sent to ${okCount} of ${total} device${total === 1 ? "" : "s"}.`
    );
    if (okCount === total) {
      showNotice("success", "Command Sent", "Clear data command has been sent.");
    } else if (okCount > 0) {
      showNotice("warning", "Partially Sent", `Command sent to ${okCount} of ${total} devices.`, 5000);
    } else {
      showNotice("error", "Command Failed", "Device not connected.");
    }
  } catch (error) {
    showNotice("error", "Command Failed", String(error?.message || "Unable to send clear data command."), 6500);
  } finally {
    setTimeout(() => {
      setLoaderVisibility(false);
      updateUploadProgress(0, "Preparing upload...");
    }, 450);
  }
}

async function clearDeviceCache() {
  if (!getEffectiveTargetOrigins().length) {
    showNotice("warning", "No Device Selected", "Select at least one device first.", 5000);
    return;
  }
  const deviceId = getSelectedDeviceValue();
  const confirmMsg =
    deviceId === "all"
      ? "Clear cache on ALL connected devices?"
      : `Clear cache on device ${deviceId}?`;

  if (!(await showConfirmDialog("Clear Device Cache", confirmMsg, "Yes, Clear", "Cancel"))) return;

  const results = await postToSelectedDevices("/config/clear-cache");
  if (results.every((item) => item?.success !== false)) {
    showNotice("success", "Command Sent", "Clear cache command has been sent.");
  } else {
    showNotice("error", "Command Failed", "Device not connected.");
  }
}

async function restartDeviceApp() {
  if (!getEffectiveTargetOrigins().length) {
    showNotice("warning", "No Device Selected", "Select at least one device first.", 5000);
    return;
  }
  const deviceId = getSelectedDeviceValue();
  const confirmMsg =
    deviceId === "all"
      ? "Restart app on ALL connected devices?"
      : `Restart app on device ${deviceId}?`;

  if (!(await showConfirmDialog("Restart App", confirmMsg, "Yes, Restart", "Cancel"))) return;

  const results = await postToSelectedDevices("/config/restart-device");
  if (results.every((item) => item?.success !== false)) {
    showNotice("success", "Command Sent", "Restart command has been sent.");
  } else {
    showNotice("error", "Restart Failed", "Device not connected.");
  }
}

async function setAutoReopen(enabled) {
  if (!getEffectiveTargetOrigins().length) {
    showNotice("warning", "No Device Selected", "Select at least one device first.", 5000);
    return;
  }
  const results = await postToSelectedDevices("/config/auto-reopen", { enabled: !!enabled });
  if (results.every((item) => item?.success !== false)) {
    showNotice("success", "Auto Reopen Updated", `Auto reopen ${enabled ? "enabled" : "disabled"}.`, 2200);
  } else {
    showNotice("error", "Command Failed", "Device not connected.");
  }
}

async function uploadAndInstallAppUpdate() {
  const fileInput = document.getElementById("appUpdateFile");
  const deviceId = getSelectedDeviceValue();
  const file = fileInput?.files?.[0];
  if (!file) {
    showNotice("warning", "APK Required", "Select an APK file first.");
    return;
  }

  const confirmed = await showConfirmDialog(
    "Update App",
    `Upload and install ${file.name} on ${deviceId === "all" ? "all connected devices" : `device ${deviceId}`}?`,
    "Upload And Update",
    "Cancel"
  );
  if (!confirmed) return;

  const loader = document.getElementById("uploadLoader");
  try {
    loader.classList.remove("hidden");
    const targetOrigins = getEffectiveTargetOrigins();
    if (!targetOrigins.length) {
      throw new Error("Select at least one device first.");
    }

    for (let idx = 0; idx < targetOrigins.length; idx += 1) {
      const origin = targetOrigins[idx];
      const formData = new FormData();
      formData.append("file", file);

      const responseText = await uploadWithProgress(`${origin}/config/upload-app-update`, formData, (percent) => {
        updateUploadProgress(percent, `Uploading APK to device ${idx + 1} of ${targetOrigins.length}...`);
      });
      const uploaded = JSON.parse(String(responseText || "{}"));
      const apkUrl = uploaded?.apkUrl;
      if (!apkUrl) {
        throw new Error("APK upload response invalid");
      }

      updateUploadProgress(100, `Sending install command to device ${idx + 1}...`);
      const installRes = await fetch(`${origin}/config/install-app-update`, {
        method: "POST",
        headers: buildCmsAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ apkUrl }),
      });
      const installData = await installRes.json();
      if (!installData?.success) {
        throw new Error("Install command failed. Device may be offline.");
      }
    }

    showNotice(
      "success",
      "Update Sent",
      "APK sent. Follow the TV prompt if needed.",
      7000
    );
  } catch (err) {
    const rawMessage = String(err?.message || "Unknown error");
    const message =
      /endpoint not found|api endpoint not found|cannot post/i.test(rawMessage)
        ? "This CMS server is running an older build that does not support APK update yet. Restart or rebuild the CMS server, then try again."
        : rawMessage;
    showNotice("error", "App Update Failed", message, 7000);
  } finally {
    loader.classList.add("hidden");
    updateUploadProgress(0, "Preparing upload...");
  }
}

// Ensure inline onclick handlers in index.html always resolve these actions.
window.clearDeviceData = clearDeviceData;
window.clearDeviceCache = clearDeviceCache;
window.restartDeviceApp = restartDeviceApp;
window.setAutoReopen = setAutoReopen;
window.uploadAndInstallAppUpdate = uploadAndInstallAppUpdate;
window.toggleDeviceDashboard = toggleDeviceDashboard;
window.selectDeviceFromDashboard = selectDeviceFromDashboard;
window.__cmsShowNotice = showNotice;
window.__cmsShowConfirmDialog = showConfirmDialog;
window.__cmsBuildConfig = buildConfigFromForm;
window.__cmsLoadDevices = loadDevices;
window.__cmsLoadDeviceAlerts = loadDeviceAlerts;
window.__cmsLoadConfig = loadConfig;
window.__cmsUploadSection = uploadMedia;
window.__cmsGetCurrentOrigin = getCurrentOrigin;
window.__cmsNormalizeOrigin = normalizeOrigin;
window.__cmsGetDeviceMap = () => currentDeviceMap;
window.__cmsGetDeviceOptionValue = (device) => getDeviceOptionValue(device);
window.__cmsGetSelectedOrigins = () => Array.from(selectedDeviceOrigins);
window.__cmsSetSelectedOrigins = async (origins = []) => {
  selectedDeviceOrigins = new Set((Array.isArray(origins) ? origins : []).map((value) => normalizeOrigin(value)).filter(Boolean));
  await handleDeviceSelectionChanged();
};
window.__cmsGetAccessOverrides = () => ({ ...(cmsAccessOverrides || {}) });
window.__cmsReloadAccessOverrides = loadAccessOverrides;

  document.addEventListener("DOMContentLoaded", async () => {
    if (IS_TV_COMPACT_MODE) {
      document.body.classList.add("tv-compact-mode");
    }

  renderGrid3LayoutOptions();
  updateScheduleFallbackVisibility();
  syncUploadTimeoutInput();
  updateUploadProgress(0, "Preparing upload...");
  await refreshLocalNetworkState();
  await loadDevices();
  if (getSelectedOrigins().length) {
    await loadConfig();
  }
  startPreviewPolling();
  startAlertsPolling();
  setInterval(() => {
    refreshLocalNetworkState().then(updateDeviceSelectionSummary).catch(() => {});
  }, 12000);

  document.getElementById("layout").addEventListener("change", () => {
    updateGridRatioOptions();
    currentConfig = buildConfigFromForm();
    currentConfig.gridRatio = selectedGridRatio;
    renderUploadSections();
    updateSectionVisibility();
  });

  document.getElementById("deviceSelect").addEventListener("change", async () => {
    const value = document.getElementById("deviceSelect")?.value || "all";
    selectedDeviceOrigins = value === "all" ? new Set(Array.from(currentDeviceMap.keys())) : new Set([value]);
    await handleDeviceSelectionChanged();
    loadDeviceAlerts();
  });
  document.getElementById("uploadTimeoutMinutes")?.addEventListener("change", (event) => {
    setUploadTimeoutMinutes(event?.target?.value);
  });
  document.getElementById("gridRatio").addEventListener("change", (e) => {
    selectedGridRatio = e.target.value;
    if (currentConfig) currentConfig.gridRatio = selectedGridRatio;
    renderGrid3LayoutOptions();
    renderScreenPreview();
  });
  document.getElementById("scheduleEnabled").addEventListener("change", () => {
    const fields = document.getElementById("scheduleFields");
    if (fields) fields.style.opacity = document.getElementById("scheduleEnabled").checked ? "1" : "0.55";
    currentConfig = buildConfigFromForm();
  });
  document.getElementById("scheduleFallbackMode").addEventListener("change", () => {
    updateScheduleFallbackVisibility();
    currentConfig = buildConfigFromForm();
  });

  const previewLinkedFields = [
    "duration1",
    "duration2",
    "duration3",
    "dir1",
    "dir2",
    "dir3",
    "orientation",
    "animation",
    "tickerText",
    "tickerFontSize",
    "tickerPosition",
    "tickerColor",
    "tickerBgColor",
    "tickerSpeed",
    "scheduleStart",
    "scheduleEnd",
    "scheduleFallbackMessage",
    "scheduleFallbackTextColor",
    "scheduleFallbackBgColor",
  ];

  previewLinkedFields.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("change", () => {
      currentConfig = buildConfigFromForm();
      renderScreenPreview();
    });
  });

  Array.from(document.querySelectorAll(".schedule-day")).forEach((el) => {
    el.addEventListener("change", () => {
      currentConfig = buildConfigFromForm();
    });
  });

  document.addEventListener("keydown", (event) => {
    const active = document.activeElement;
    if (!(active instanceof HTMLInputElement) || active.type !== "range") return;
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    const focusables = Array.from(
      document.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")
    ).filter((el) => {
      if (!(el instanceof HTMLElement)) return false;
      if (el.hasAttribute("disabled")) return false;
      if (el.getAttribute("aria-hidden") === "true") return false;
      if (el.offsetParent === null) return false;
      return true;
    });

    const index = focusables.indexOf(active);
    if (index < 0) return;
    const nextIndex = event.key === "ArrowDown" ? index + 1 : index - 1;
    const target = focusables[nextIndex];
    if (target instanceof HTMLElement) {
      event.preventDefault();
      target.focus();
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    window.requestAnimationFrame(() => {
      try {
        target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      } catch (_e) {
      }
    });
  });
});

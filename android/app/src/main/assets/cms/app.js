const SUPPORTED_FILE_EXT = /\.(mp4|m4v|mov|mkv|webm|jpg|jpeg|png|txt|pdf|ppt|pptx|pptm|pps|ppsx|potx)$/i;
const VIDEO_FILE_EXT = /\.(mp4|m4v|mov|mkv|webm)$/i;
const PPT_FILE_EXT = /\.(ppt|pptx|pptm|pps|ppsx|potx)$/i;
const PPTX_FILE_EXT = /\.(pptx|pptm|ppsx|potx)$/i;
const PPT_LEGACY_EXT = /\.(ppt|pps)$/i;
const PPTX_CANVAS_WIDTH = 1920;
const PPTX_CANVAS_HEIGHT = 1080;
const PPTX_RENDER_DPR = 1;
const HARD_FILE_SIZE_BYTES = 5 * 1024 * 1024 * 1024;
const WARN_FILE_SIZE_BYTES = 700 * 1024 * 1024;
const DEFAULT_UPLOAD_TIMEOUT_MS = 120 * 60 * 1000;
const MIN_UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
const MAX_UPLOAD_TIMEOUT_MS = 360 * 60 * 1000;
const MULTI_DEVICE_UPLOAD_RETRIES = 2;
const MULTI_DEVICE_RETRY_DELAY_MS = 1800;
const MULTI_DEVICE_UPLOAD_CONCURRENCY = 6;
const UPLOAD_TIMEOUT_STORAGE_KEY = "cmsUploadTimeoutMs";
const FAST_UPLOAD_SKIP_DUPLICATE_BYTES = 700 * 1024 * 1024;
const CHUNK_UPLOAD_SIZE_BYTES = 25 * 1024 * 1024;
const CHUNK_UPLOAD_PARALLEL_PARTS = 6;

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
  template: "template",
};

const ORDER_TEMPLATE_PRESETS = [
  ["burger-queue", "Burger Queue Board", "Ready to Collect", "Preparation of Orders", "Welcome to Diner Burger", "Prep", "Ready", "705\n713\n715\n732\n771\n777", "657\n653\n655\n144", "#f4f72a", "#ffffff", "#d92736", "#f7f7f7", "#101010", "#1f2328", 54, "classic"],
  ["prep-ready", "Prep Ready Split", "Ready", "Prep", "Order status", "Prep", "Ready", "A254\nA258\nA255\nA259\nB025\nA256\nA257", "A253\nB024", "#5fb052", "#2695d8", "#6cc04a", "#ffffff", "#222222", "#ffffff", 50, "split"],
  ["pharmacy-token", "Pharmacy Token", "Now Serving", "Waiting Tokens", "Please keep your bill ready", "Waiting", "Counter", "P101\nP102\nP103\nP104\nP105", "P099\nP100", "#00e5ff", "#8bd450", "#ffcc33", "#f6fbff", "#07131f", "#eef7ff", 48, "split"],
  ["clinic-call", "Clinic Call Board", "Doctor Ready", "In Queue", "Silence your phone inside clinic", "Queue", "Room", "C12\nC13\nC14\nC15\nC16", "C10\nC11", "#4ade80", "#38bdf8", "#f97316", "#ffffff", "#111827", "#f8fafc", 46, "split"],
  ["bank-counter", "Bank Counter", "Counter Open", "Waiting", "Thank you for banking with us", "Waiting", "Counter", "B221\nB222\nB223\nB224\nB225", "B219\nB220", "#fde047", "#60a5fa", "#22c55e", "#ffffff", "#0b1120", "#f8fafc", 48, "classic"],
  ["cafe-pickup", "Cafe Pickup", "Pick Up", "Being Prepared", "Fresh coffee. Fresh moments.", "Preparing", "Ready", "C701\nC702\nC703\nC704", "C699\nC700", "#facc15", "#fb923c", "#ef4444", "#fff7ed", "#1c1917", "#fff7ed", 50, "classic"],
  ["retail-service", "Retail Service Desk", "Collect Item", "Processing", "Visit service desk for support", "Processing", "Ready", "R45\nR46\nR47\nR48\nR49", "R43\nR44", "#a7f3d0", "#93c5fd", "#f472b6", "#f8fafc", "#111827", "#f8fafc", 46, "split"],
  ["airport-lounge", "Lounge Display", "Boarding Ready", "Security Check", "Have your ID ready", "Check", "Ready", "L11\nL12\nL13\nL14", "L09\nL10", "#fef08a", "#67e8f9", "#c084fc", "#ffffff", "#020617", "#e2e8f0", 48, "classic"],
  ["hotel-reception", "Hotel Reception", "Room Ready", "Check-in Queue", "Welcome to our hotel", "Check-in", "Ready", "H301\nH302\nH303\nH304", "H299\nH300", "#fbbf24", "#34d399", "#60a5fa", "#fffaf0", "#1f2937", "#fffaf0", 48, "split"],
  ["parking-token", "Parking Token", "Vehicle Ready", "In Service", "Drive safe", "Service", "Ready", "V81\nV82\nV83\nV84", "V79\nV80", "#fb7185", "#22d3ee", "#facc15", "#ffffff", "#18181b", "#fafafa", 46, "classic"],
  ["government-counter", "Public Counter", "Please Proceed", "Token Queue", "Keep documents ready", "Queue", "Counter", "G501\nG502\nG503\nG504\nG505", "G499\nG500", "#bef264", "#38bdf8", "#fb923c", "#f8fafc", "#0f172a", "#f8fafc", 44, "split"],
  ["salon-spa", "Salon Appointment", "Chair Ready", "Waiting", "Relax. Your turn is coming.", "Waiting", "Ready", "S31\nS32\nS33\nS34", "S29\nS30", "#f9a8d4", "#c4b5fd", "#f59e0b", "#fff7fb", "#2d1b2f", "#fff7fb", 46, "split"],
].map(([id, name, title, subtitle, footer, prepTitle, readyTitle, prepItems, readyItems, primaryColor, secondaryColor, accentColor, textColor, backgroundColor, panelColor, fontSize, layout]) => ({
  id,
  name,
  title,
  subtitle,
  footer,
  prepTitle,
  readyTitle,
  prepItems,
  readyItems,
  primaryColor,
  secondaryColor,
  accentColor,
  textColor,
  backgroundColor,
  panelColor,
  fontSize,
  layout,
  imageData: "",
}));

function createDefaultOrderTemplate(presetId = "burger-queue") {
  const preset = ORDER_TEMPLATE_PRESETS.find((item) => item.id === presetId) || ORDER_TEMPLATE_PRESETS[0];
  return {
    ...preset,
    id: `${preset.id}-${Date.now()}`,
    presetId: preset.id,
    name: preset.name,
  };
}

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
let pendingUploadSelections = { 1: [], 2: [], 3: [] };
let restartAfterUploadedMediaSave = false;
const SELECTED_ORIGINS_STORAGE_KEY = "tvCmsSelectedOrigins";
const CMS_FORM_DRAFT_STORAGE_KEY = "tvCmsFormDraftV2";
const seenApkUpdateSuccessNotices = new Set();
let currentDeviceMap = new Map();
let selectedDeviceOrigins = new Set(loadStoredSelectedOrigins());
let cmsAccessOverrides = {};
let scheduleManagerState = { profiles: [], entries: [], editingEntryId: "", editingProfileId: "" };
let cmsFormDirty = false;
let cmsFormHydrating = false;
let cmsDraftRestoreChecked = false;
const IS_TV_COMPACT_MODE = new URLSearchParams(window.location.search).get("tv") === "1";
const DEVICE_SCAN_PORTS = (() => {
  const currentPort = Number(window.location.port || "8080") || 8080;
  return Array.from(new Set([currentPort, 8080, 8081, 9090, 10080]));
})();
const PLAYER_ORIENTATION = (() => {
  try {
    return String(new URLSearchParams(window.location.search).get("ori") || "horizontal").trim().toLowerCase();
  } catch (_e) {
    return "horizontal";
  }
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

function updateViewportHeightVar() {
  try {
    const root = document.documentElement;
    if (!root) return;
    root.style.setProperty("--tvvh", `${Math.max(window.innerHeight || 0, 1)}px`);
    root.style.setProperty("--tvvw", `${Math.max(window.innerWidth || 0, 1)}px`);
  } catch (_e) {
  }
}

function applyTvViewportClass() {
  const body = document.body;
  if (!body) return;
  const width = Math.max(window.innerWidth || 0, 1);
  const height = Math.max(window.innerHeight || 0, 1);
  const shortest = Math.min(width, height);

  body.classList.toggle("tv-screen-portrait", height >= width);
  body.classList.toggle("tv-screen-landscape", width > height);
  body.classList.remove("tv-size-sm", "tv-size-md", "tv-size-lg");

  if (shortest <= 720) {
    body.classList.add("tv-size-sm");
    return;
  }
  if (shortest <= 1080) {
    body.classList.add("tv-size-md");
    return;
  }
  body.classList.add("tv-size-lg");
}

function applyPlayerOrientationClass() {
  const body = document.body;
  if (!body) return;
  body.classList.remove(
    "player-orientation-horizontal",
    "player-orientation-reverse-horizontal",
    "player-orientation-vertical",
    "player-orientation-reverse-vertical"
  );
  body.classList.add(`player-orientation-${PLAYER_ORIENTATION}`);
}

function getFocusableElementsForTv() {
  return Array.from(
    document.querySelectorAll("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")
  ).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hasAttribute("disabled")) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    if (el.classList.contains("hidden")) return false;
    if (el.offsetParent === null) return false;
    return true;
  });
}

function getElementScrollTop(element) {
  if (!element) return 0;
  if (element === document.scrollingElement || element === document.documentElement || element === document.body) {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }
  return element.scrollTop || 0;
}

function setElementScrollTop(element, value) {
  if (!element) return;
  if (element === document.scrollingElement || element === document.documentElement || element === document.body) {
    window.scrollTo(0, value);
    return;
  }
  element.scrollTop = value;
}

function canScrollPane(pane, direction) {
  if (!pane) return false;
  const scrollTop = getElementScrollTop(pane);
  const clientHeight = pane === document.scrollingElement || pane === document.documentElement || pane === document.body
    ? window.innerHeight || document.documentElement.clientHeight || 0
    : pane.clientHeight || 0;
  const scrollHeight = pane.scrollHeight || 0;
  if (direction === "up") return scrollTop > 2;
  return scrollTop + clientHeight < scrollHeight - 2;
}

function performTvScroll(pane, delta) {
  if (!pane || !delta) return false;
  const maxScroll = Math.max(0, (pane.scrollHeight || 0) - ((pane.clientHeight || window.innerHeight || 0)));
  const before = getElementScrollTop(pane);
  const next = Math.max(0, Math.min(maxScroll, before + delta));
  if (Math.abs(next - before) < 1) return false;
  setElementScrollTop(pane, next);
  return true;
}

function focusNearestElementByDirection(direction) {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const focusables = getFocusableElementsForTv();
  if (!focusables.length) return false;
  if (!active || !focusables.includes(active)) {
    focusables[0].focus();
    return true;
  }

  const currentRect = active.getBoundingClientRect();
  const currentCenterX = currentRect.left + currentRect.width / 2;
  const currentCenterY = currentRect.top + currentRect.height / 2;
  const activePane = getTvScrollablePane(active);

  const findBest = (items) => {
    let best = null;
    let bestScore = Number.POSITIVE_INFINITY;

    items.forEach((el) => {
      if (el === active) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = centerX - currentCenterX;
      const deltaY = centerY - currentCenterY;

      if (direction === "right" && deltaX <= 8) return;
      if (direction === "left" && deltaX >= -8) return;
      if (direction === "down" && deltaY <= 8) return;
      if (direction === "up" && deltaY >= -8) return;

      const primary = direction === "left" || direction === "right" ? Math.abs(deltaX) : Math.abs(deltaY);
      const secondary = direction === "left" || direction === "right" ? Math.abs(deltaY) : Math.abs(deltaX);
      const panePenalty =
        activePane && (direction === "up" || direction === "down") && getTvScrollablePane(el) !== activePane
          ? Math.max(160, Math.abs(deltaX) * 1.5)
          : 0;
      const score = primary + secondary * 2.4 + panePenalty;

      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    });

    return best;
  };

  if ((direction === "up" || direction === "down") && activePane) {
    const samePaneFocusables = focusables.filter((el) => getTvScrollablePane(el) === activePane);
    const samePaneBest = findBest(samePaneFocusables);
    if (samePaneBest instanceof HTMLElement) {
      samePaneBest.focus();
      return true;
    }
    if (canScrollPane(activePane, direction)) {
      return false;
    }
  }

  const best = findBest(focusables);

  if (best instanceof HTMLElement) {
    best.focus();
    return true;
  }
  return false;
}

function getTvScrollablePane(element) {
  let current = element instanceof HTMLElement ? element : null;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const canScrollY = /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`);
    if (canScrollY && current.scrollHeight > current.clientHeight + 4) {
      return current;
    }
    current = current.parentElement;
  }
  const page = document.scrollingElement || document.documentElement;
  return page && page.scrollHeight > page.clientHeight + 4 ? page : null;
}

function scrollTvPane(direction) {
  if (!IS_TV_COMPACT_MODE) return false;
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const fallbackPane = document.querySelector(".middle-col") || document.querySelector(".left-col") || document.querySelector(".container");
  const pane = getTvScrollablePane(active) || fallbackPane;
  if (!pane) return false;

  const amount = Math.max(72, Math.round((pane.clientHeight || window.innerHeight || 360) * 0.42));
  const delta = direction === "up" ? -amount : amount;
  return performTvScroll(pane, delta)
    || canScrollPane(pane, direction);
}

function keepTvFocusVisible(target) {
  if (!(target instanceof HTMLElement)) return;
  window.requestAnimationFrame(() => {
    try {
      const pane = getTvScrollablePane(target);
      if (pane && pane !== document.scrollingElement && pane !== document.documentElement) {
        const paneRect = pane.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const margin = 28;
        if (targetRect.bottom > paneRect.bottom - margin) {
          performTvScroll(pane, targetRect.bottom - paneRect.bottom + margin);
          return;
        }
        if (targetRect.top < paneRect.top + margin) {
          performTvScroll(pane, targetRect.top - paneRect.top - margin);
          return;
        }
      }
      target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: IS_TV_COMPACT_MODE ? "auto" : "smooth" });
    } catch (_e) {
    }
  });
}

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
    if (!isTvHostedDeviceStatus(status)) return null;
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

function isTvHostedDeviceStatus(status) {
  if (!status || typeof status !== "object") return false;
  const deviceId = String(status.deviceId || "").trim();
  const publicUrl = normalizeOrigin(status.publicUrl || "");
  const localUrl = normalizeOrigin(status.localUrl || "");
  const port = Number(status.port || 0);
  return !!deviceId && !!publicUrl && !!localUrl && port > 0;
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
        if (!/^https?:\/\/[^/]+:(8080|8081|9090|10080)$/i.test(candidate)) return;
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
  persistCmsFormDraft();
  renderDeviceChecklist();
  renderHealthSummary(latestDeviceStatusList);
  renderDeviceAlerts(latestDeviceStatusList);
  if (getSelectedOrigins().length) {
    await loadConfig();
  } else {
    renderScreenPreview();
  }
}

async function clearEnterpriseGroupSelectionSilently() {
  try {
    if (typeof window.enterpriseClearActiveGroupSelection === "function") {
      await window.enterpriseClearActiveGroupSelection({
        silent: true,
        preserveSelection: true,
      });
    }
  } catch (_e) {
  }
}

async function toggleDeviceSelection(origin, checked) {
  if (checked) {
    selectedDeviceOrigins.add(origin);
  } else {
    selectedDeviceOrigins.delete(origin);
  }
  await clearEnterpriseGroupSelectionSilently();
  await handleDeviceSelectionChanged();
}

async function selectAllDevices(checked = true) {
  if (checked) {
    selectedDeviceOrigins = new Set(Array.from(currentDeviceMap.keys()));
  } else {
    selectedDeviceOrigins = new Set();
  }
  await clearEnterpriseGroupSelectionSilently();
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

function isLargeUploadSet(files = []) {
  return (files || []).some((file) => Number(file?.size || 0) >= FAST_UPLOAD_SKIP_DUPLICATE_BYTES);
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
  overlay.style.zIndex = "40000";

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
  const progress = document.querySelector("#uploadLoader .upload-progress");
  if (progress) {
    progress.setAttribute("aria-valuenow", String(clamped));
    if (statusText) progress.setAttribute("aria-valuetext", `${clamped}% — ${statusText}`);
  }
}

function getPendingUploadFiles(section) {
  const safeSection = Number(section || 0);
  if (!safeSection) return [];
  const cached = Array.isArray(pendingUploadSelections[safeSection])
    ? pendingUploadSelections[safeSection]
    : [];
  if (cached.length) return cached;
  const input = document.getElementById(`media${safeSection}`);
  return Array.from(input?.files || []);
}

function updateUploadSelectionStatus(section) {
  const safeSection = Number(section || 0);
  const statusEl = document.getElementById(`mediaStatus${safeSection}`);
  if (!statusEl) return;

  const files = getPendingUploadFiles(safeSection);
  if (!files.length) {
    statusEl.textContent = "No files selected";
    return;
  }

  const names = files
    .slice(0, 3)
    .map((file) => String(file?.name || "").trim())
    .filter(Boolean);
  const remaining = files.length - names.length;
  statusEl.textContent =
    remaining > 0
      ? `${files.length} file(s) selected: ${names.join(", ")} +${remaining} more`
      : `${files.length} file(s) selected: ${names.join(", ")}`;
}

function captureUploadSelection(section) {
  const safeSection = Number(section || 0);
  const input = document.getElementById(`media${safeSection}`);
  const files = Array.from(input?.files || []);
  pendingUploadSelections = {
    ...pendingUploadSelections,
    [safeSection]: files,
  };
  updateUploadSelectionStatus(safeSection);
  markCmsFormDirty();
}

function clearUploadSelection(section) {
  const safeSection = Number(section || 0);
  const input = document.getElementById(`media${safeSection}`);
  if (input) {
    input.value = "";
  }
  pendingUploadSelections = {
    ...pendingUploadSelections,
    [safeSection]: [],
  };
  updateUploadSelectionStatus(safeSection);
  markCmsFormDirty();
}

async function clearUnusedSectionsForLayout(origins = [], layout = "fullscreen") {
  const maxSection = sectionCount(layout);
  const sectionsToClear = [];
  for (let section = maxSection + 1; section <= 3; section += 1) {
    sectionsToClear.push(section);
  }
  if (!sectionsToClear.length) return;

  const uniqueOrigins = Array.from(
    new Set((Array.isArray(origins) ? origins : []).map((origin) => normalizeOrigin(origin)).filter(Boolean))
  );
  if (!uniqueOrigins.length) return;

  await Promise.allSettled(uniqueOrigins.flatMap((origin) =>
    sectionsToClear.map((section) =>
      fetch(`${origin}/config/clear-section-media`, {
        method: "POST",
        headers: buildCmsAuthHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ section }),
      })
    )
  ));

  sectionsToClear.forEach((section) => {
    previewMediaBySection[section] = [];
    clearUploadSelection(section);
  });
  renderScreenPreview();
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

function buildChunkUploadKey(origin, section, files) {
  const input = JSON.stringify({
    origin,
    section,
    files: (files || []).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    })),
  });
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(16);
}

async function postJsonToOrigin(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildCmsAuthHeaders(),
    },
    body: JSON.stringify(payload || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(String(data?.error || `Request failed (${res.status})`));
  }
  return data;
}

function uploadChunkToOrigin(url, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.timeout = Math.max(10 * 60 * 1000, getUploadTimeoutMs());
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    const authHeaders = buildCmsAuthHeaders();
    Object.entries(authHeaders).forEach(([key, value]) => {
      if (value != null && value !== "") {
        xhr.setRequestHeader(key, value);
      }
    });
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      onProgress(Number(event.loaded || 0));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.responseText);
        return;
      }
      reject(new Error(parseUploadErrorResponse(xhr.status, xhr.responseText)));
    };
    xhr.onerror = () => reject(new Error("Network error during chunk upload"));
    xhr.ontimeout = () => reject(new Error("Chunk upload timed out"));
    xhr.send(blob);
  });
}

async function uploadFilesWithChunksToOrigin(origin, section, files, containsPpt, onProgress) {
  const totalBytes = (files || []).reduce((sum, file) => sum + Number(file?.size || 0), 0);
  const init = await postJsonToOrigin(`${origin}/upload/chunk/init?section=${encodeURIComponent(section)}`, {
    uploadKey: buildChunkUploadKey(origin, section, files),
    chunkSize: CHUNK_UPLOAD_SIZE_BYTES,
    containsPpt: containsPpt ? "1" : "",
    files: (files || []).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
    })),
  });

  const uploadId = init.uploadId;
  const chunkSize = Number(init.chunkSize || CHUNK_UPLOAD_SIZE_BYTES);
  const receivedByFile = new Map(
    (init.files || []).map((file) => [
      Number(file.index),
      new Set((file.received || []).map((value) => Number(value))),
    ])
  );
  let completedBytes = (init.files || []).reduce((sum, file) => {
    const received = receivedByFile.get(Number(file.index)) || new Set();
    let done = 0;
    received.forEach((chunkIndex) => {
      const start = chunkIndex * chunkSize;
      const end = Math.min(Number(file.size || 0), start + chunkSize);
      done += Math.max(0, end - start);
    });
    return sum + done;
  }, 0);
  const activeChunkBytes = new Map();
  const emitAggregateProgress = () => {
    const activeBytes = Array.from(activeChunkBytes.values()).reduce(
      (sum, value) => sum + Number(value || 0),
      0
    );
    onProgress(totalBytes ? ((completedBytes + activeBytes) / totalBytes) * 100 : 0);
  };
  emitAggregateProgress();

  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    const file = files[fileIndex];
    const chunks = Math.max(1, Math.ceil(Number(file.size || 0) / chunkSize));
    const received = receivedByFile.get(fileIndex) || new Set();
    const pendingChunks = [];
    for (let chunkIndex = 0; chunkIndex < chunks; chunkIndex += 1) {
      if (!received.has(chunkIndex)) pendingChunks.push(chunkIndex);
    }

    let cursor = 0;
    async function uploadWorker() {
      while (cursor < pendingChunks.length) {
        const chunkIndex = pendingChunks[cursor];
        cursor += 1;
      const start = chunkIndex * chunkSize;
      const end = Math.min(Number(file.size || 0), start + chunkSize);
      const blob = file.slice(start, end);
      let uploaded = false;
      for (let attempt = 0; attempt < 4 && !uploaded; attempt += 1) {
        try {
          const progressKey = `${fileIndex}:${chunkIndex}`;
          await uploadChunkToOrigin(
            `${origin}/upload/chunk/${encodeURIComponent(uploadId)}/file/${fileIndex}/part/${chunkIndex}?section=${encodeURIComponent(section)}`,
            blob,
            (loaded) => {
              activeChunkBytes.set(progressKey, Math.max(0, Math.min(blob.size, Number(loaded || 0))));
              emitAggregateProgress();
            }
          );
          activeChunkBytes.delete(progressKey);
          completedBytes += blob.size;
          emitAggregateProgress();
          uploaded = true;
        } catch (error) {
          activeChunkBytes.delete(`${fileIndex}:${chunkIndex}`);
          emitAggregateProgress();
          if (attempt >= 3) throw error;
          await wait(1200 * (attempt + 1));
        }
      }
    }
    }

    const workerCount = Math.max(
      1,
      Math.min(CHUNK_UPLOAD_PARALLEL_PARTS, pendingChunks.length || 1)
    );
    await Promise.all(Array.from({ length: workerCount }, () => uploadWorker()));
  }

  await postJsonToOrigin(`${origin}/upload/chunk/${encodeURIComponent(uploadId)}/complete?section=${encodeURIComponent(section)}`, {
    containsPpt: containsPpt ? "1" : "",
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

async function uploadToOriginWithRetry(origin, section, uploadFiles, containsPpt, tracker, targetIndex, options = {}) {
  let lastError = null;
  const maxRetries = Math.max(0, Number(options.maxRetries ?? MULTI_DEVICE_UPLOAD_RETRIES));
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      if (attempt > 0) {
        tracker.markRetry(targetIndex, attempt);
      }
      try {
        await uploadFilesWithChunksToOrigin(origin, section, uploadFiles, containsPpt, (percent) => {
          tracker.setProgress(targetIndex, percent);
        });
      } catch (chunkError) {
        if (!/not found|endpoint not found|404/i.test(String(chunkError?.message || ""))) {
          throw chunkError;
        }
        const formData = cloneUploadFormData(uploadFiles, containsPpt);
        await uploadWithProgress(`${origin}/upload?section=${encodeURIComponent(section)}`, formData, (percent) => {
          tracker.setProgress(targetIndex, percent);
        });
      }
      tracker.markComplete(targetIndex);
      return;
    } catch (error) {
      lastError = error;
      if (typeof options.verifyBeforeRetry === "function") {
        try {
          const verified = await options.verifyBeforeRetry(error, attempt);
          if (verified) {
            tracker.setState(targetIndex, "done", "Upload complete (verified)", 100);
            return { recovered: true };
          }
        } catch (_verifyError) {
        }
      }
      if (attempt < maxRetries) {
        await wait(MULTI_DEVICE_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
    }
  }
  throw lastError || new Error("Upload failed");
}

async function runUploadsInParallel(targets, concurrency, worker) {
  const queue = Array.isArray(targets) ? targets.slice() : [];
  const workerCount = Math.max(1, Math.min(Number(concurrency || 1), queue.length || 1));
  let nextIndex = 0;

  const runners = Array.from({ length: workerCount }, async (_unused, laneIndex) => {
    while (nextIndex < queue.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      await worker(queue[currentIndex], currentIndex, laneIndex);
    }
  });

  await Promise.all(runners);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyUploadedFilesOnOrigin(origin, section, uploadFiles, retries = 20, delayMs = 3000) {
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

function normalizeSectionSourceType(value) {
  const type = String(value || "").trim();
  return Object.values(SECTION_SOURCE_TYPES).includes(type)
    ? type
    : SECTION_SOURCE_TYPES.multimedia;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseTemplateItems(value) {
  return String(value || "")
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 24);
}

function getTemplatesFromSectionConfig(sectionConfig = {}) {
  if (Array.isArray(sectionConfig.sourceTemplates)) {
    return sectionConfig.sourceTemplates.filter((item) => item && typeof item === "object");
  }
  if (sectionConfig.sourceTemplate && typeof sectionConfig.sourceTemplate === "object") {
    return [sectionConfig.sourceTemplate];
  }
  return [];
}

function buildOrderTemplateMarkup(template = {}, { preview = false } = {}) {
  const tpl = { ...createDefaultOrderTemplate(template?.presetId || "burger-queue"), ...(template || {}) };
  const prepItems = parseTemplateItems(tpl.prepItems);
  const readyItems = parseTemplateItems(tpl.readyItems);
  const fontSize = Math.max(24, Math.min(96, Number(tpl.fontSize || 54)));
  const rawLayout = String(tpl.layout || "classic");
  const styleId = Object.prototype.hasOwnProperty.call(TEMPLATE_STYLE_PRESETS, rawLayout) ? rawLayout : "classic";
  const split = [
    "split", "executive", "dashboard", "luxury", "midnight",
    "kiosk", "leaderboard", "driveThru", "metro", "premiumCard",
  ].includes(styleId);
  const style = [
    `--tpl-bg:${escapeHtml(tpl.backgroundColor || "#101010")}`,
    `--tpl-panel:${escapeHtml(tpl.panelColor || "#ffffff")}`,
    `--tpl-primary:${escapeHtml(tpl.primaryColor || "#f4f72a")}`,
    `--tpl-secondary:${escapeHtml(tpl.secondaryColor || "#2695d8")}`,
    `--tpl-accent:${escapeHtml(tpl.accentColor || "#d92736")}`,
    `--tpl-text:${escapeHtml(tpl.textColor || "#ffffff")}`,
    `--tpl-prep-title-bg:${escapeHtml(tpl.prepTitleBgColor || "rgba(0,0,0,0.28)")}`,
    `--tpl-ready-title-bg:${escapeHtml(tpl.readyTitleBgColor || "rgba(0,0,0,0.28)")}`,
    `--tpl-prep-list-bg:${escapeHtml(tpl.prepListBgColor || tpl.panelColor || "#ffffff")}`,
    `--tpl-ready-list-bg:${escapeHtml(tpl.readyListBgColor || (styleId === "classic" ? "#090909" : tpl.panelColor || "#ffffff"))}`,
    `--tpl-font:${fontSize}px`,
  ].join(";");

  const prepHtml = prepItems.map((item) => `<div class="tpl-item prep">${escapeHtml(item)}</div>`).join("");
  const readyHtml = readyItems.map((item, index) =>
    `<div class="tpl-item ready ${index === 0 ? "hero-ready" : ""}">${escapeHtml(item)}</div>`
  ).join("");
  const imageData = String(tpl.imageData || "").trim();
  const imageHtml = imageData
    ? `<img class="tpl-brand-img" src="${escapeHtml(imageData)}" alt="" />`
    : `<div class="tpl-brand-mark">${escapeHtml(tpl.brandText || String(tpl.name || "T").slice(0, 1))}</div>`;
  const badgeText = String(tpl.badgeText || "LIVE").trim();
  const prepTag = String(tpl.prepTag || "Preparing").trim();
  const readyTag = String(tpl.readyTag || "Ready").trim();
  const footerBadge = String(tpl.footerBadge || "NextView").trim();

  return `
    <div class="order-template ${split ? "split" : "classic"} style-${styleId} ${preview ? "is-preview" : ""}" style="${style}">
      <div class="tpl-screen">
        <div class="tpl-glow one"></div>
        <div class="tpl-glow two"></div>
        <div class="tpl-top">
          <div class="tpl-brand-block">
            <div class="tpl-icon">${imageHtml}</div>
          </div>
          <div class="tpl-center-title">
            <span>${escapeHtml(tpl.name || "Display Board")}</span>
          </div>
          <div class="tpl-bag">${escapeHtml(badgeText)}</div>
        </div>
        <div class="tpl-body">
          <section class="tpl-column prep-col">
            <div class="tpl-column-title"><span>${escapeHtml(prepTag)}</span>${escapeHtml(tpl.subtitle || "Preparation of Orders")}</div>
            <div class="tpl-list prep-list">${prepHtml || `<div class="tpl-empty">No prep orders</div>`}</div>
          </section>
          <section class="tpl-column ready-col">
            <div class="tpl-column-title"><span>${escapeHtml(readyTag)}</span>${escapeHtml(tpl.title || "Ready to Collect")}</div>
            <div class="tpl-list ready-list">${readyHtml || `<div class="tpl-empty">No ready orders</div>`}</div>
          </section>
        </div>
        <div class="tpl-footer"><strong>${escapeHtml(footerBadge)}</strong><em>${escapeHtml(tpl.footer || "")}</em><span></span></div>
      </div>
    </div>
  `;
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

function scheduleId(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }
function scheduleMinutes(value) {
  const [hour, minute] = String(value || "").split(":").map(Number);
  return Number.isInteger(hour) && Number.isInteger(minute) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60 ? hour * 60 + minute : null;
}
function schedulePartsOnDay(entry, day) {
  const start = scheduleMinutes(entry.start), end = scheduleMinutes(entry.end);
  const days = Array.isArray(entry.days) && entry.days.length ? entry.days.map(Number) : [0, 1, 2, 3, 4, 5, 6];
  if (start == null || end == null) return [];
  if (start === end) return days.includes(day) ? [[0, 1440]] : [];
  if (start < end) return days.includes(day) ? [[start, end]] : [];
  const parts = [];
  if (days.includes(day)) parts.push([start, 1440]);
  if (days.includes((day + 6) % 7)) parts.push([0, end]);
  return parts;
}
function scheduleEntriesOverlap(a, b) {
  return Array.from({ length: 7 }, (_, day) => day).some((day) =>
    schedulePartsOnDay(a, day).some((left) => schedulePartsOnDay(b, day).some((right) => left[0] < right[1] && right[0] < left[1]))
  );
}
function renderScheduleProfileMediaPicker() {
  const root = document.getElementById("scheduleProfileMediaPicker");
  if (!root) return;
  const selected = new Set(Array.from(root.querySelectorAll("input:checked")).map((input) => `${input.dataset.section}|${input.dataset.name}`));
  root.innerHTML = "";
  for (let section = 1; section <= 3; section += 1) {
    const files = Array.isArray(previewMediaBySection?.[section]) ? previewMediaBySection[section] : [];
    const block = document.createElement("div");
    block.className = "schedule-media-section";
    const heading = document.createElement("strong");
    heading.textContent = `Section ${section} files`;
    block.appendChild(heading);
    if (!files.length) {
      const empty = document.createElement("span");
      empty.textContent = "No uploaded files yet";
      block.appendChild(empty);
    } else {
      files.forEach((file) => {
        const name = String(file?.originalName || file?.name || "").trim();
        if (!name) return;
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.dataset.section = String(section);
        input.dataset.name = name;
        input.checked = selected.has(`${section}|${name}`);
        input.addEventListener("change", markCmsFormDirty);
        const title = document.createElement("span");
        title.textContent = name;
        label.append(input, title);
        block.appendChild(label);
      });
    }
    root.appendChild(block);
  }
}
function getScheduleProfileMediaSelection() {
  const selected = { 1: [], 2: [], 3: [] };
  Array.from(document.querySelectorAll("#scheduleProfileMediaPicker input:checked")).forEach((input) => {
    const section = Number(input.dataset.section || 0);
    const name = String(input.dataset.name || "").trim();
    if (selected[section] && name) selected[section].push(name);
  });
  return selected;
}
function getScheduleProfile(id) { return scheduleManagerState.profiles.find((profile) => profile.id === id) || null; }
function updateScheduleProfileEditorStatus() {
  const status = document.getElementById("scheduleProfileEditorStatus");
  const profile = getScheduleProfile(String(document.getElementById("scheduleProfileSelect")?.value || scheduleManagerState.editingProfileId || ""));
  if (!status) return;
  status.textContent = profile
    ? `Editing “${profile.name}”: changes above and new uploads will belong only to this profile.`
    : "Select a profile to start editing its files and design.";
  status.classList.toggle("is-active", !!profile);
}
function saveCurrentDesignToScheduleProfile(profileId) {
  const profile = getScheduleProfile(profileId);
  if (!profile) return false;
  const current = buildConfigFromForm();
  const priorSections = profile.config?.sections || [];
  current.sections = (current.sections || []).map((section, index) => ({
    ...section,
    playlistNames: Array.isArray(priorSections[index]?.playlistNames) ? priorSections[index].playlistNames : [],
  }));
  delete current.schedule;
  profile.config = current;
  return true;
}
function openScheduleProfileEditor(id) {
  const profile = getScheduleProfile(String(id || ""));
  if (!profile) return;
  const preservedSchedule = getScheduleFromForm();
  scheduleManagerState.editingProfileId = profile.id;
  applyConfigToForm({ ...profile.config, schedule: preservedSchedule });
  scheduleManagerState.editingProfileId = profile.id;
  const select = document.getElementById("scheduleProfileSelect");
  if (select) select.value = profile.id;
  updateScheduleProfileEditorStatus();
  showNotice("info", "Profile Ready", `You are now editing ${profile.name}. Upload files and change CMS settings, then save them to this profile.`, 5000);
}
function saveScheduleProfileChanges() {
  const profileId = String(document.getElementById("scheduleProfileSelect")?.value || scheduleManagerState.editingProfileId || "");
  if (!saveCurrentDesignToScheduleProfile(profileId)) return showNotice("warning", "Select Profile", "Choose the profile whose files and design you want to save.");
  scheduleManagerState.editingProfileId = profileId;
  renderScheduleManager();
  const select = document.getElementById("scheduleProfileSelect");
  if (select) select.value = profileId;
  updateScheduleProfileEditorStatus();
  markCmsFormDirty();
  showNotice("success", "Profile Updated", "Files and current CMS design are saved to this profile.");
}
function addUploadedMediaToScheduleProfile(section, uploadFiles) {
  const profileId = String(document.getElementById("scheduleProfileSelect")?.value || scheduleManagerState.editingProfileId || "");
  const profile = getScheduleProfile(profileId);
  if (!profile) return;
  const index = Math.max(0, Math.min(2, Number(section || 1) - 1));
  profile.config = profile.config || {};
  profile.config.sections = Array.isArray(profile.config.sections) ? profile.config.sections : [];
  profile.config.sections[index] = profile.config.sections[index] || { sourceType: "multimedia" };
  const existing = Array.isArray(profile.config.sections[index].playlistNames) ? profile.config.sections[index].playlistNames : [];
  const names = (uploadFiles || []).map((file) => String(file?.name || "").trim()).filter(Boolean);
  profile.config.sections[index].playlistNames = Array.from(new Set([...existing, ...names]));
  markCmsFormDirty();
}
function renderScheduleManager() {
  const select = document.getElementById("scheduleProfileSelect"), entriesList = document.getElementById("scheduleEntriesList"), profilesList = document.getElementById("scheduleProfilesList"), warning = document.getElementById("scheduleConflictWarning");
  if (!select || !entriesList || !profilesList || !warning) return;
  const previousSelection = select.value;
  select.innerHTML = scheduleManagerState.profiles.length
    ? scheduleManagerState.profiles.map((profile) => `<option value="${profile.id}">${escapeHtml(profile.name)}</option>`).join("")
    : `<option value="">Save a profile first</option>`;
  if (scheduleManagerState.profiles.some((profile) => profile.id === previousSelection)) select.value = previousSelection;
  if (scheduleManagerState.editingProfileId && scheduleManagerState.profiles.some((profile) => profile.id === scheduleManagerState.editingProfileId)) select.value = scheduleManagerState.editingProfileId;
  profilesList.innerHTML = scheduleManagerState.profiles.map((profile) => { const mediaCount=(profile?.config?.sections||[]).reduce((total,section)=>total+(Array.isArray(section?.playlistNames)?section.playlistNames.length:0),0); return `<div class="schedule-profile-card"><strong>${escapeHtml(profile.name)}</strong><span>${mediaCount} selected file${mediaCount===1?"":"s"} · saved content + design</span><button class="btn warning compact-btn" onclick="window.scheduleDeleteProfile?.('${profile.id}')">Delete</button></div>`; }).join("");
  entriesList.innerHTML = scheduleManagerState.entries.map((entry) => {
    const profile = scheduleManagerState.profiles.find((item) => item.id === entry.profileId);
    const days = (entry.days || []).map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][Number(day)]).filter(Boolean).join(", ");
    return `<div class="schedule-entry-card"><strong>${escapeHtml(profile?.name || "Missing profile")}</strong><div>${entry.start}–${entry.end} · ${days || "No days"} · Priority ${Number(entry.priority || 0)}</div><button class="btn primary compact-btn" onclick="window.scheduleEditEntry?.('${entry.id}')">Edit</button> <button class="btn warning compact-btn" onclick="window.scheduleDeleteEntry?.('${entry.id}')">Delete</button></div>`;
  }).join("") || `<div class="enterprise-meta">No slots. When scheduling is enabled, the fallback appears outside these slots.</div>`;
  const conflicts = scheduleManagerState.entries.filter((entry) => entry.enabled !== false).reduce((count, entry, index, all) => count + all.slice(index + 1).filter((other) => other.enabled !== false && scheduleEntriesOverlap(entry, other)).length, 0);
  warning.classList.toggle("hidden", !conflicts);
  warning.textContent = conflicts ? `${conflicts} overlap${conflicts === 1 ? "" : "s"} detected — the highest-priority slot wins.` : "";
  updateScheduleProfileEditorStatus();
}
function saveScheduleProfile(){const name=String(document.getElementById("scheduleProfileName")?.value||"").trim();if(!name)return showNotice("warning","Profile Name Required","Enter a profile name.");const config=buildConfigFromForm();(config.sections||[]).forEach((section)=>{if(normalizeSectionSourceType(section?.sourceType)===SECTION_SOURCE_TYPES.multimedia)section.playlistNames=[];});delete config.schedule;const item={id:scheduleId("profile"),name,config};scheduleManagerState.profiles.push(item);scheduleManagerState.editingProfileId=item.id;document.getElementById("scheduleProfileName").value="";renderScheduleManager();const select=document.getElementById("scheduleProfileSelect");if(select)select.value=item.id;updateScheduleProfileEditorStatus();markCmsFormDirty();showNotice("success","Profile Created",`Now select ${name}, upload its files and set its design.`);}
function saveScheduleEntry(){const profileId=String(document.getElementById("scheduleProfileSelect")?.value||"");const days=Array.from(document.querySelectorAll(".schedule-day")).filter(x=>x.checked).map(x=>Number(x.value));const start=document.getElementById("scheduleStart")?.value,end=document.getElementById("scheduleEnd")?.value;if(!profileId||!days.length)return showNotice("warning","Profile And Days Required","Select a profile and at least one active day.");if(scheduleMinutes(start)==null||scheduleMinutes(end)==null)return showNotice("warning","Time Required","Enter valid start and end times.");saveCurrentDesignToScheduleProfile(profileId);const x={id:scheduleManagerState.editingEntryId||scheduleId("slot"),enabled:true,profileId,start,end,days,priority:Number(document.getElementById("schedulePriority").value||0)};const i=scheduleManagerState.entries.findIndex(y=>y.id===x.id);if(i<0)scheduleManagerState.entries.push(x);else scheduleManagerState.entries[i]=x;scheduleManagerState.editingEntryId="";scheduleManagerState.editingProfileId=profileId;renderScheduleManager();markCmsFormDirty();}
function editScheduleEntry(id){const x=scheduleManagerState.entries.find(y=>y.id===id);if(!x)return;scheduleManagerState.editingEntryId=id;document.getElementById("scheduleStart").value=x.start;document.getElementById("scheduleEnd").value=x.end;document.getElementById("schedulePriority").value=String(x.priority||0);Array.from(document.querySelectorAll(".schedule-day")).forEach(y=>y.checked=(x.days||[]).includes(Number(y.value)));renderScheduleManager();document.getElementById("scheduleProfileSelect").value=x.profileId;}
function deleteScheduleEntry(id){scheduleManagerState.entries=scheduleManagerState.entries.filter(x=>x.id!==id);renderScheduleManager();markCmsFormDirty();}
function clearScheduleEntryEditor(){scheduleManagerState.editingEntryId="";document.getElementById("schedulePriority").value="0";}
function deleteScheduleProfile(id){if(scheduleManagerState.entries.some(x=>x.profileId===id))return showNotice("warning","Profile In Use","Delete its slots first.");scheduleManagerState.profiles=scheduleManagerState.profiles.filter(x=>x.id!==id);renderScheduleManager();markCmsFormDirty();}
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
    profiles: scheduleManagerState.profiles,
    entries: scheduleManagerState.entries,

  };
}
function setScheduleToForm(schedule) {
  const editingProfileId = scheduleManagerState.editingProfileId || "";
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
  scheduleManagerState = {
    profiles: Array.isArray(safeSchedule.profiles) ? safeSchedule.profiles : [],
    entries: Array.isArray(safeSchedule.entries) ? safeSchedule.entries : [],
    editingEntryId: "",
    editingProfileId,
  };
  renderScheduleProfileMediaPicker();
  renderScheduleManager();
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
  const sourceType = normalizeSectionSourceType(sectionConfig.sourceType);
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

  if (sourceType === SECTION_SOURCE_TYPES.template) {
    const templates = getTemplatesFromSectionConfig(sectionConfig);
    const template = templates[state.index % Math.max(1, templates.length)] || createDefaultOrderTemplate("burger-queue");
    const wrap = document.createElement("div");
    wrap.className = "preview-template-wrap";
    wrap.innerHTML = buildOrderTemplateMarkup(template, { preview: true });
    slot.appendChild(wrap);
    if (templates.length > 1) {
      state.timer = setTimeout(() => {
        state.index = (state.index + 1) % templates.length;
        renderSectionSlot(slot, sectionNumber, config);
      }, getSectionDurationMs(config, sectionNumber));
    }
    applyPreviewLiveOverlay(slot, selectedStatus, sectionNumber, fallbackCacheStatus || "Template");
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
  const isVideo = /\.(mp4|m4v|mov|mkv|webm)$/i.test(file.name || "");
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
  if (IS_TV_COMPACT_MODE) return;
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
        sourceType: normalizeSectionSourceType(document.getElementById("sourceType1")?.value),
        sourceUrl: document.getElementById("sourceUrl1")?.value || "",
        sourceTemplates: getTemplatesFromSectionConfig(currentConfig?.sections?.[0] || {}),
      },
      {
        slideDirection: document.getElementById("dir2").value,
        slideDuration: Number(document.getElementById("duration2").value || 5),
        sourceType: normalizeSectionSourceType(document.getElementById("sourceType2")?.value),
        sourceUrl: document.getElementById("sourceUrl2")?.value || "",
        sourceTemplates: getTemplatesFromSectionConfig(currentConfig?.sections?.[1] || {}),
      },
      {
        slideDirection: document.getElementById("dir3").value,
        slideDuration: Number(document.getElementById("duration3").value || 5),
        sourceType: normalizeSectionSourceType(document.getElementById("sourceType3")?.value),
        sourceUrl: document.getElementById("sourceUrl3")?.value || "",
        sourceTemplates: getTemplatesFromSectionConfig(currentConfig?.sections?.[2] || {}),
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

function setFormValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

function hasPendingUploadFiles() {
  return Object.values(pendingUploadSelections || {}).some((files) => Array.isArray(files) && files.length > 0);
}

function isCmsFormElement(element) {
  if (!(element instanceof HTMLElement)) return false;
  return !!element.closest(
    "#uploadSections, #deviceChecklist, #deviceSelect, #layout, #gridRatio, .settings-card, .section-panel, .template-tools"
  );
}

function isCmsEditInProgress() {
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  return cmsFormDirty || hasPendingUploadFiles() || isCmsFormElement(active);
}

function persistCmsFormDraft() {
  if (cmsFormHydrating) return;
  try {
    const config = buildConfigFromForm();
    window.localStorage.setItem(
      CMS_FORM_DRAFT_STORAGE_KEY,
      JSON.stringify({
        config,
        selectedOrigins: Array.from(selectedDeviceOrigins).filter(Boolean),
        savedAt: Date.now(),
      })
    );
  } catch (_e) {
  }
}

function clearCmsFormDraft() {
  try {
    window.localStorage.removeItem(CMS_FORM_DRAFT_STORAGE_KEY);
  } catch (_e) {
  }
}

function markCmsFormDirty() {
  if (cmsFormHydrating) return;
  cmsFormDirty = true;
  try {
    currentConfig = buildConfigFromForm();
    persistCmsFormDraft();
  } catch (_e) {
  }
}

function restoreCmsFormDraftIfAvailable() {
  if (cmsDraftRestoreChecked) return false;
  cmsDraftRestoreChecked = true;
  try {
    const raw = window.localStorage.getItem(CMS_FORM_DRAFT_STORAGE_KEY);
    if (!raw) return false;
    const draft = JSON.parse(raw);
    if (!draft || typeof draft !== "object" || !draft.config) return false;
    if (Array.isArray(draft.selectedOrigins) && draft.selectedOrigins.length) {
      selectedDeviceOrigins = new Set(draft.selectedOrigins.map((value) => normalizeOrigin(value)).filter(Boolean));
      syncHiddenDeviceSelect();
      persistSelectedOrigins();
      renderDeviceChecklist();
    }
    applyConfigToForm(draft.config);
    cmsFormDirty = true;
    return true;
  } catch (_e) {
    return false;
  }
}

function applyConfigToForm(config = {}) {
  cmsFormHydrating = true;
  try {
    setFormValue("orientation", config.orientation || "horizontal");
    setFormValue("layout", config.layout || "fullscreen");
    setFormValue("animation", config.animation || "slide");

    setFormValue("dir1", config.sections?.[0]?.slideDirection || "left");
    setFormValue("dir2", config.sections?.[1]?.slideDirection || "left");
    setFormValue("dir3", config.sections?.[2]?.slideDirection || "left");

    setFormValue("duration1", config.sections?.[0]?.slideDuration || 7);
    setFormValue("duration2", config.sections?.[1]?.slideDuration || 13);
    setFormValue("duration3", config.sections?.[2]?.slideDuration || 19);

    setFormValue("tickerText", config.ticker?.text || "Breaking News: NextView Premium Product New Update Available!");
    setFormValue("tickerFontSize", config.ticker?.fontSize || 24);
    setFormValue("tickerPosition", config.ticker?.position || "bottom");
    setFormValue("tickerColor", config.ticker?.color || "#ffffff");
    setFormValue("tickerBgColor", config.ticker?.bgColor || "#000000");
    setFormValue("tickerSpeed", config.ticker?.speed ?? 6);
    setFormValue("videoCacheMB", config.cache?.videoMB || 2048);
    setScheduleToForm(config.schedule);

    selectedGrid3Layout = config.grid3Layout || "stack-v";
    selectedGridRatio = config.gridRatio || "1:1:1";
    currentConfig = {
      ...config,
      grid3Layout: selectedGrid3Layout,
      gridRatio: selectedGridRatio,
    };
    updateGridRatioOptions();
    renderGrid3LayoutOptions();
    renderUploadSections();
    for (let i = 1; i <= 3; i++) {
      const sectionConfig = config.sections?.[i - 1] || {};
      const typeEl = document.getElementById(`sourceType${i}`);
      const urlEl = document.getElementById(`sourceUrl${i}`);
      if (typeEl) typeEl.value = normalizeSectionSourceType(sectionConfig.sourceType);
      if (urlEl) urlEl.value = sectionConfig.sourceUrl || "";
      updateSectionUploadMode(i);
    }
    updateSectionVisibility();
  } finally {
    cmsFormHydrating = false;
  }
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
    renderScheduleProfileMediaPicker();
    resetPreviewState();
  } catch (e) {
    console.log("Preview media load failed", e);
    previewMediaBySection = { 1: [], 2: [], 3: [] };
    resetPreviewState();
  }
}

function startPreviewPolling() {
  if (IS_TV_COMPACT_MODE) return;
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
    renderScheduleProfileMediaPicker();
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
  persistSelectedOrigins();
  persistCmsFormDraft();
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
  alertsPollTimer = setInterval(loadDeviceAlerts, IS_TV_COMPACT_MODE ? 15000 : 5000);
}

function onSectionSourceChange(section) {
  updateSectionUploadMode(section);
  markCmsFormDirty();
  renderScreenPreview();
}

function onSectionSourceUrlInput() {
  markCmsFormDirty();
  renderScreenPreview();
}

function getSectionTemplates(section) {
  const config = currentConfig || buildConfigFromForm();
  return getTemplatesFromSectionConfig(config?.sections?.[section - 1] || {});
}

function setSectionTemplates(section, templates) {
  const selected = (Array.isArray(templates) ? templates : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => ({ ...item }));
  currentConfig = currentConfig || buildConfigFromForm();
  currentConfig.sections = Array.isArray(currentConfig.sections) ? currentConfig.sections : [];
  currentConfig.sections[section - 1] = {
    ...(currentConfig.sections[section - 1] || {}),
    sourceType: selected.length ? SECTION_SOURCE_TYPES.template : SECTION_SOURCE_TYPES.multimedia,
    sourceUrl: "",
    sourceTemplates: selected,
    sourceTemplate: null,
  };
  const typeEl = document.getElementById(`sourceType${section}`);
  if (typeEl) typeEl.value = selected.length ? SECTION_SOURCE_TYPES.template : SECTION_SOURCE_TYPES.multimedia;
  updateSectionUploadMode(section);
  renderTemplateSummary(section);
  markCmsFormDirty();
  renderScreenPreview();
}

function renderTemplateSummary(section) {
  const summary = document.getElementById(`templateSummary${section}`);
  if (!summary) return;
  const templates = getSectionTemplates(section);
  if (!templates.length) {
    summary.innerHTML = `<span>No template selected</span>`;
    return;
  }
  summary.innerHTML = templates
    .map((template, index) => `
      <span class="template-chip">
        <span class="template-chip-name">${index + 1}. ${escapeHtml(template.name || "Custom Template")}</span>
        <button class="template-chip-icon" type="button" title="Edit template" onclick="editSectionTemplate(${section}, ${index})">Edit</button>
        <button class="template-chip-icon danger" type="button" title="Remove template" onclick="removeSectionTemplate(${section}, ${index})">x</button>
      </span>
    `)
    .join("");
}

function addTemplateToSection(section) {
  showTemplateGallery(section);
}

function deleteTemplateFromSection(section) {
  setSectionTemplates(section, []);
  showNotice("success", "Templates Removed", `Section ${section} templates removed.`);
}

function removeSectionTemplate(section, index) {
  const templates = getSectionTemplates(section);
  if (!templates[index]) return;
  templates.splice(index, 1);
  setSectionTemplates(section, templates);
}

function editSectionTemplate(section, index) {
  const templates = getSectionTemplates(section);
  const template = templates[index];
  if (!template) return;
  showTemplateEditor(template, (updated) => {
    const next = getSectionTemplates(section);
    next[index] = cloneTemplate({ ...updated, id: template.id || updated.id });
    setSectionTemplates(section, next);
  }, {
    title: template.name || "Edit Template",
    onDelete: () => removeSectionTemplate(section, index),
  });
}

function cloneTemplate(template) {
  return {
    ...template,
    id: template?.id || `${template?.presetId || "template"}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  };
}

function getTemplateStyleLabel(layout) {
  const labels = {
    royal: "Royal 3D Board",
    executive: "Executive Split",
    glass: "Glass Premium",
    cinema: "Cinema Status",
    neon: "Neon Night",
    minimal: "Minimal Light",
    luxury: "Luxury Gold",
    token: "Token Counter",
    dashboard: "Dashboard Pro",
    poster: "Poster Tall",
    matrix: "Matrix Queue",
    sunrise: "Sunrise Cafe",
    midnight: "Midnight Blue",
    marble: "Marble Premium",
    kiosk: "Kiosk Side Hero",
    leaderboard: "Leaderboard Wide",
    vertical: "Vertical Ticket",
    compact: "Compact Grid",
    magazine: "Magazine Cover",
    stadium: "Stadium LED",
    driveThru: "Drive-Thru Lane",
    metro: "Metro Split",
    premiumCard: "Premium Cards",
    ribbon: "Ribbon Header",
    classic: "Classic Board",
    split: "Prep Ready Split",
  };
  return labels[String(layout || "")] || "Royal Board";
}

function getTemplateStyleSelectOptions(selectedLayout) {
  const layouts = [
    "royal", "executive", "glass", "cinema", "neon", "minimal", "luxury", "token",
    "dashboard", "poster", "matrix", "sunrise", "midnight", "marble",
    "kiosk", "leaderboard", "vertical", "compact", "magazine", "stadium",
    "driveThru", "metro", "premiumCard", "ribbon", "classic", "split",
  ];
  const selected = String(selectedLayout || "");
  return layouts
    .map((layout) =>
      `<option value="${layout}" ${selected === layout ? "selected" : ""}>${escapeHtml(getTemplateStyleLabel(layout))}</option>`
    )
    .join("");
}

const TEMPLATE_STYLE_PRESETS = {
  royal: {
    backgroundColor: "#130b2c",
    panelColor: "#fff8df",
    primaryColor: "#ffd166",
    secondaryColor: "#58d5ff",
    accentColor: "#f5b84b",
    textColor: "#fffaf0",
    prepTitleBgColor: "#263a63",
    readyTitleBgColor: "#5b2d78",
    prepListBgColor: "#f7fbff",
    readyListBgColor: "#11131f",
  },
  executive: {
    backgroundColor: "#071526",
    panelColor: "#eef6ff",
    primaryColor: "#a7f3d0",
    secondaryColor: "#93c5fd",
    accentColor: "#facc15",
    textColor: "#f8fafc",
    prepTitleBgColor: "#12324d",
    readyTitleBgColor: "#17443a",
    prepListBgColor: "#eef6ff",
    readyListBgColor: "#061018",
  },
  glass: {
    backgroundColor: "#082f49",
    panelColor: "#f0f9ff",
    primaryColor: "#67e8f9",
    secondaryColor: "#c4b5fd",
    accentColor: "#38bdf8",
    textColor: "#ecfeff",
    prepTitleBgColor: "#0f4c75",
    readyTitleBgColor: "#155e75",
    prepListBgColor: "#ecfeff",
    readyListBgColor: "#082f49",
  },
  cinema: {
    backgroundColor: "#211109",
    panelColor: "#fff7ed",
    primaryColor: "#facc15",
    secondaryColor: "#fb923c",
    accentColor: "#ef4444",
    textColor: "#fff7ed",
    prepTitleBgColor: "#4a220d",
    readyTitleBgColor: "#581c15",
    prepListBgColor: "#fff7ed",
    readyListBgColor: "#090909",
  },
  classic: {
    backgroundColor: "#101010",
    panelColor: "#ffffff",
    primaryColor: "#f4f72a",
    secondaryColor: "#2695d8",
    accentColor: "#d92736",
    textColor: "#ffffff",
    prepTitleBgColor: "#202936",
    readyTitleBgColor: "#202936",
    prepListBgColor: "#ffffff",
    readyListBgColor: "#090909",
  },
  split: {
    backgroundColor: "#222222",
    panelColor: "#ffffff",
    primaryColor: "#6cc04a",
    secondaryColor: "#2695d8",
    accentColor: "#5fb052",
    textColor: "#ffffff",
    prepTitleBgColor: "#174a6b",
    readyTitleBgColor: "#255f25",
    prepListBgColor: "#ffffff",
    readyListBgColor: "#ffffff",
  },
  neon: {
    backgroundColor: "#050018",
    panelColor: "#0b1026",
    primaryColor: "#22d3ee",
    secondaryColor: "#f472b6",
    accentColor: "#a78bfa",
    textColor: "#f5f3ff",
    prepTitleBgColor: "#31135e",
    readyTitleBgColor: "#083344",
    prepListBgColor: "#0f172a",
    readyListBgColor: "#020617",
  },
  minimal: {
    backgroundColor: "#f8fafc",
    panelColor: "#ffffff",
    primaryColor: "#0f766e",
    secondaryColor: "#2563eb",
    accentColor: "#111827",
    textColor: "#0f172a",
    prepTitleBgColor: "#e2e8f0",
    readyTitleBgColor: "#dbeafe",
    prepListBgColor: "#ffffff",
    readyListBgColor: "#f8fafc",
  },
  luxury: {
    backgroundColor: "#140f05",
    panelColor: "#fff7d6",
    primaryColor: "#f5c542",
    secondaryColor: "#d6a94f",
    accentColor: "#f59e0b",
    textColor: "#fff8dc",
    prepTitleBgColor: "#4a3414",
    readyTitleBgColor: "#6b4514",
    prepListBgColor: "#fff8dc",
    readyListBgColor: "#16110a",
  },
  token: {
    backgroundColor: "#062d2d",
    panelColor: "#ecfeff",
    primaryColor: "#67e8f9",
    secondaryColor: "#5eead4",
    accentColor: "#facc15",
    textColor: "#ecfeff",
    prepTitleBgColor: "#115e59",
    readyTitleBgColor: "#0e7490",
    prepListBgColor: "#f0fdfa",
    readyListBgColor: "#083344",
  },
  dashboard: {
    backgroundColor: "#0b1220",
    panelColor: "#e5e7eb",
    primaryColor: "#4ade80",
    secondaryColor: "#60a5fa",
    accentColor: "#f97316",
    textColor: "#f8fafc",
    prepTitleBgColor: "#1e3a8a",
    readyTitleBgColor: "#166534",
    prepListBgColor: "#eff6ff",
    readyListBgColor: "#052e16",
  },
  poster: {
    backgroundColor: "#450a0a",
    panelColor: "#fff1f2",
    primaryColor: "#fef08a",
    secondaryColor: "#fecdd3",
    accentColor: "#fb7185",
    textColor: "#fff1f2",
    prepTitleBgColor: "#9f1239",
    readyTitleBgColor: "#be123c",
    prepListBgColor: "#fff1f2",
    readyListBgColor: "#450a0a",
  },
  matrix: {
    backgroundColor: "#00140d",
    panelColor: "#dcfce7",
    primaryColor: "#86efac",
    secondaryColor: "#22c55e",
    accentColor: "#bbf7d0",
    textColor: "#dcfce7",
    prepTitleBgColor: "#064e3b",
    readyTitleBgColor: "#14532d",
    prepListBgColor: "#052e16",
    readyListBgColor: "#00140d",
  },
  sunrise: {
    backgroundColor: "#431407",
    panelColor: "#fff7ed",
    primaryColor: "#fdba74",
    secondaryColor: "#f9a8d4",
    accentColor: "#f97316",
    textColor: "#ffedd5",
    prepTitleBgColor: "#9a3412",
    readyTitleBgColor: "#be185d",
    prepListBgColor: "#fff7ed",
    readyListBgColor: "#431407",
  },
  midnight: {
    backgroundColor: "#020617",
    panelColor: "#e0f2fe",
    primaryColor: "#38bdf8",
    secondaryColor: "#818cf8",
    accentColor: "#f8fafc",
    textColor: "#e0f2fe",
    prepTitleBgColor: "#1e1b4b",
    readyTitleBgColor: "#0c4a6e",
    prepListBgColor: "#eef2ff",
    readyListBgColor: "#020617",
  },
  marble: {
    backgroundColor: "#1f2937",
    panelColor: "#f8fafc",
    primaryColor: "#14b8a6",
    secondaryColor: "#64748b",
    accentColor: "#eab308",
    textColor: "#f8fafc",
    prepTitleBgColor: "#334155",
    readyTitleBgColor: "#0f766e",
    prepListBgColor: "#f8fafc",
    readyListBgColor: "#111827",
  },
  kiosk: {
    backgroundColor: "#101827",
    panelColor: "#fef3c7",
    primaryColor: "#f59e0b",
    secondaryColor: "#38bdf8",
    accentColor: "#22c55e",
    textColor: "#f8fafc",
    prepTitleBgColor: "#0f3b57",
    readyTitleBgColor: "#8a3b06",
    prepListBgColor: "#e0f2fe",
    readyListBgColor: "#1f1304",
  },
  leaderboard: {
    backgroundColor: "#07111f",
    panelColor: "#ecfccb",
    primaryColor: "#bef264",
    secondaryColor: "#60a5fa",
    accentColor: "#f43f5e",
    textColor: "#f8fafc",
    prepTitleBgColor: "#1d4ed8",
    readyTitleBgColor: "#3f6212",
    prepListBgColor: "#eff6ff",
    readyListBgColor: "#172554",
  },
  vertical: {
    backgroundColor: "#241022",
    panelColor: "#fff1f2",
    primaryColor: "#fb7185",
    secondaryColor: "#fbbf24",
    accentColor: "#c084fc",
    textColor: "#fff7ed",
    prepTitleBgColor: "#92400e",
    readyTitleBgColor: "#9f1239",
    prepListBgColor: "#fffbeb",
    readyListBgColor: "#4a1028",
  },
  compact: {
    backgroundColor: "#0f172a",
    panelColor: "#e2e8f0",
    primaryColor: "#2dd4bf",
    secondaryColor: "#93c5fd",
    accentColor: "#facc15",
    textColor: "#f8fafc",
    prepTitleBgColor: "#1e293b",
    readyTitleBgColor: "#0f766e",
    prepListBgColor: "#f8fafc",
    readyListBgColor: "#042f2e",
  },
  magazine: {
    backgroundColor: "#3b0764",
    panelColor: "#fae8ff",
    primaryColor: "#f0abfc",
    secondaryColor: "#fda4af",
    accentColor: "#fde047",
    textColor: "#faf5ff",
    prepTitleBgColor: "#86198f",
    readyTitleBgColor: "#be185d",
    prepListBgColor: "#fae8ff",
    readyListBgColor: "#581c87",
  },
  stadium: {
    backgroundColor: "#052e16",
    panelColor: "#f7fee7",
    primaryColor: "#bef264",
    secondaryColor: "#5eead4",
    accentColor: "#f97316",
    textColor: "#f0fdf4",
    prepTitleBgColor: "#115e59",
    readyTitleBgColor: "#166534",
    prepListBgColor: "#ecfdf5",
    readyListBgColor: "#022c22",
  },
  driveThru: {
    backgroundColor: "#1c1917",
    panelColor: "#ffedd5",
    primaryColor: "#fb923c",
    secondaryColor: "#facc15",
    accentColor: "#ef4444",
    textColor: "#fff7ed",
    prepTitleBgColor: "#854d0e",
    readyTitleBgColor: "#c2410c",
    prepListBgColor: "#fef3c7",
    readyListBgColor: "#431407",
  },
  metro: {
    backgroundColor: "#111827",
    panelColor: "#f9fafb",
    primaryColor: "#dc2626",
    secondaryColor: "#2563eb",
    accentColor: "#111827",
    textColor: "#f9fafb",
    prepTitleBgColor: "#1d4ed8",
    readyTitleBgColor: "#b91c1c",
    prepListBgColor: "#eff6ff",
    readyListBgColor: "#fee2e2",
  },
  premiumCard: {
    backgroundColor: "#0c0a09",
    panelColor: "#f5f5f4",
    primaryColor: "#d4d4d8",
    secondaryColor: "#a1a1aa",
    accentColor: "#ca8a04",
    textColor: "#fafaf9",
    prepTitleBgColor: "#3f3f46",
    readyTitleBgColor: "#713f12",
    prepListBgColor: "#fafaf9",
    readyListBgColor: "#18181b",
  },
  ribbon: {
    backgroundColor: "#082f49",
    panelColor: "#f0f9ff",
    primaryColor: "#7dd3fc",
    secondaryColor: "#38bdf8",
    accentColor: "#f472b6",
    textColor: "#f0f9ff",
    prepTitleBgColor: "#075985",
    readyTitleBgColor: "#be185d",
    prepListBgColor: "#e0f2fe",
    readyListBgColor: "#0c4a6e",
  },
};

function applyTemplateStylePresetToForm(form, layout) {
  const preset = TEMPLATE_STYLE_PRESETS[String(layout || "")];
  if (!form || !preset) return;
  Object.entries(preset).forEach(([name, value]) => {
    const input = form.elements?.[name];
    if (input && "value" in input) input.value = value;
  });
}

function showTemplateGallery(section) {
  removeTemplateEditor();
  const selectedTemplates = getSectionTemplates(section);
  const selectedIds = new Set(selectedTemplates.map((item) => String(item.id || item.presetId || "")));
  let galleryTemplates = ORDER_TEMPLATE_PRESETS.map((preset) => {
    const existing = selectedTemplates.find((item) => String(item.presetId || item.id) === preset.id);
    return cloneTemplate(existing || createDefaultOrderTemplate(preset.id));
  });

  const overlay = document.createElement("div");
  overlay.className = "template-editor-overlay";
  overlay.innerHTML = `
    <div class="template-gallery-panel" role="dialog" aria-modal="true">
      <div class="template-editor-head">
        <div>
          <h2>Ready-made Templates</h2>
          <p class="section-help">Multiple templates select karein. Done ke baad Save Settings dabane par TV par ye templates rotate honge.</p>
        </div>
        <div class="template-head-actions">
          <div id="templateGalleryCount" class="section-help">0 selected</div>
          <button class="btn primary" type="button" data-template-done>Done</button>
          <button class="btn warning" type="button" data-template-close>Close</button>
        </div>
      </div>
      <div id="templateGalleryGrid" class="template-gallery-grid"></div>
    </div>
  `;
  document.body.appendChild(overlay);

  const renderGallery = () => {
    const grid = overlay.querySelector("#templateGalleryGrid");
    const count = overlay.querySelector("#templateGalleryCount");
    if (!grid) return;
    grid.innerHTML = galleryTemplates.map((template, index) => {
      const key = String(template.id || template.presetId || index);
      const checked = selectedIds.has(key) || selectedIds.has(String(template.presetId || ""));
      return `
        <article class="template-gallery-card ${checked ? "is-selected" : ""}">
          <div class="template-gallery-preview">${buildOrderTemplateMarkup(template, { preview: true })}</div>
          <div class="template-gallery-meta">
            <strong>${escapeHtml(template.name || "Custom Template")}</strong>
            <span>${escapeHtml(getTemplateStyleLabel(template.layout))}</span>
          </div>
          <div class="template-gallery-actions">
            <button class="btn ${checked ? "warning" : "primary"}" type="button" data-template-select="${index}">
              ${checked ? "Selected" : "Select"}
            </button>
            <button class="btn warning" type="button" data-template-edit="${index}">Edit</button>
          </div>
        </article>
      `;
    }).join("");
    if (count) count.textContent = `${selectedIds.size} selected`;
  };

  overlay.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.hasAttribute("data-template-close") || target === overlay) {
      removeTemplateEditor();
      return;
    }
    if (target.hasAttribute("data-template-done")) {
      const selected = galleryTemplates.filter((template, index) => {
        const key = String(template.id || template.presetId || index);
        return selectedIds.has(key) || selectedIds.has(String(template.presetId || ""));
      });
      setSectionTemplates(section, selected);
      removeTemplateEditor();
      showNotice("success", "Templates Added", `${selected.length} template(s) added. Click Save Settings to apply on TV.`);
      return;
    }
    const selectIndex = target.getAttribute("data-template-select");
    if (selectIndex !== null) {
      const template = galleryTemplates[Number(selectIndex)];
      const key = String(template?.id || template?.presetId || selectIndex);
      if (selectedIds.has(key)) {
        selectedIds.delete(key);
      } else {
        selectedIds.add(key);
      }
      renderGallery();
      return;
    }
    const editIndex = target.getAttribute("data-template-edit");
    if (editIndex !== null) {
      const index = Number(editIndex);
      showTemplateEditor(galleryTemplates[index], (updated) => {
        galleryTemplates[index] = cloneTemplate({ ...updated, id: galleryTemplates[index].id });
        selectedIds.add(String(galleryTemplates[index].id || galleryTemplates[index].presetId || index));
        renderGallery();
      }, { title: galleryTemplates[index]?.name || "Edit Template", backToGallery: true });
    }
  });
  renderGallery();
}

function showTemplateEditor(template, onSave, options = {}) {
  const existing = cloneTemplate(template || createDefaultOrderTemplate("burger-queue"));
  if (!options.backToGallery) removeTemplateEditor();
  let imageData = String(existing.imageData || "");

  const overlay = document.createElement("div");
  overlay.className = `template-editor-overlay ${options.backToGallery ? "template-edit-modal" : ""}`;
  overlay.innerHTML = `
    <div class="template-editor-panel" role="dialog" aria-modal="true">
      <div class="template-editor-head">
        <div>
          <h2>${escapeHtml(options.title || "Template Editor")}</h2>
          <p class="section-help">Text, colors, background aur optional image/logo edit karein. Image 500KB se kam honi chahiye.</p>
        </div>
        <div class="template-head-actions">
          <button class="btn primary" type="submit" form="templateEditorForm">Save Template</button>
          <button class="btn danger" type="button" data-template-delete>Delete</button>
          <button class="btn warning" type="button" data-template-close>Close</button>
        </div>
      </div>
      <div class="template-editor-grid">
        <div class="template-device-preview">
          <div class="template-device-frame">
            <div id="templateEditorPreview" class="template-live-preview"></div>
          </div>
        </div>
        <form id="templateEditorForm" class="template-editor-form">
          <label>Template Name</label>
          <input name="name" type="text" value="${escapeHtml(existing.name || "")}" />
          <label>Style</label>
          <select name="layout">
            ${getTemplateStyleSelectOptions(existing.layout)}
          </select>
          <div class="template-field-pair">
            <label>Brand Mark / Logo Text<input name="brandText" type="text" value="${escapeHtml(existing.brandText || String(existing.name || "T").slice(0, 1))}" /></label>
            <label>Top Badge<input name="badgeText" type="text" value="${escapeHtml(existing.badgeText || "LIVE")}" /></label>
          </div>
          <div class="template-field-pair">
            <label>Left Badge Tag<input name="prepTag" type="text" value="${escapeHtml(existing.prepTag || "Preparing")}" /></label>
            <label>Right Badge Tag<input name="readyTag" type="text" value="${escapeHtml(existing.readyTag || "Ready")}" /></label>
          </div>
          <div class="template-field-pair">
            <label>Left Subtitle<input name="subtitle" type="text" value="${escapeHtml(existing.subtitle || "")}" /></label>
            <label>Right Subtitle<input name="title" type="text" value="${escapeHtml(existing.title || "")}" /></label>
          </div>
          <label>Prep Orders</label>
          <textarea name="prepItems" rows="5">${escapeHtml(existing.prepItems || "")}</textarea>
          <label>Ready Orders</label>
          <textarea name="readyItems" rows="5">${escapeHtml(existing.readyItems || "")}</textarea>
          <div class="template-field-pair">
            <label>Footer Badge<input name="footerBadge" type="text" value="${escapeHtml(existing.footerBadge || "NextView")}" /></label>
            <label>Footer Text<input name="footer" type="text" value="${escapeHtml(existing.footer || "")}" /></label>
          </div>
          <label>Logo / Image (max 500KB)</label>
          <input name="imageFile" type="file" accept="image/*" />
          <div id="templateImageStatus" class="section-help">${imageData ? "Image added" : "No image selected"}</div>
          <div class="template-color-grid">
            <label>Text<input name="textColor" type="color" value="${escapeHtml(existing.textColor || "#ffffff")}" /></label>
            <label>Background<input name="backgroundColor" type="color" value="${escapeHtml(existing.backgroundColor || "#101010")}" /></label>
            <label>Panel<input name="panelColor" type="color" value="${escapeHtml(existing.panelColor || "#ffffff")}" /></label>
            <label>Ready<input name="primaryColor" type="color" value="${escapeHtml(existing.primaryColor || "#f4f72a")}" /></label>
            <label>Prep<input name="secondaryColor" type="color" value="${escapeHtml(existing.secondaryColor || "#2695d8")}" /></label>
            <label>Accent<input name="accentColor" type="color" value="${escapeHtml(existing.accentColor || "#d92736")}" /></label>
            <label>Left Subtitle BG<input name="prepTitleBgColor" type="color" value="${escapeHtml(existing.prepTitleBgColor || TEMPLATE_STYLE_PRESETS[existing.layout]?.prepTitleBgColor || "#202936")}" /></label>
            <label>Right Subtitle BG<input name="readyTitleBgColor" type="color" value="${escapeHtml(existing.readyTitleBgColor || TEMPLATE_STYLE_PRESETS[existing.layout]?.readyTitleBgColor || "#202936")}" /></label>
            <label>Prep Orders BG<input name="prepListBgColor" type="color" value="${escapeHtml(existing.prepListBgColor || TEMPLATE_STYLE_PRESETS[existing.layout]?.prepListBgColor || "#ffffff")}" /></label>
            <label>Ready Orders BG<input name="readyListBgColor" type="color" value="${escapeHtml(existing.readyListBgColor || TEMPLATE_STYLE_PRESETS[existing.layout]?.readyListBgColor || "#090909")}" /></label>
          </div>
          <label>Number Font Size</label>
          <input name="fontSize" type="range" min="24" max="96" value="${Number(existing.fontSize || 54)}" />
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const form = overlay.querySelector("#templateEditorForm");
  const readForm = () => {
    const data = new FormData(form);
    return {
      ...existing,
      name: String(data.get("name") || "Custom Template"),
      layout: String(data.get("layout") || "classic"),
      brandText: String(data.get("brandText") || ""),
      badgeText: String(data.get("badgeText") || ""),
      prepTag: String(data.get("prepTag") || ""),
      readyTag: String(data.get("readyTag") || ""),
      subtitle: String(data.get("subtitle") || ""),
      title: String(data.get("title") || ""),
      prepItems: String(data.get("prepItems") || ""),
      readyItems: String(data.get("readyItems") || ""),
      footerBadge: String(data.get("footerBadge") || ""),
      footer: String(data.get("footer") || ""),
      textColor: String(data.get("textColor") || "#ffffff"),
      backgroundColor: String(data.get("backgroundColor") || "#101010"),
      panelColor: String(data.get("panelColor") || "#ffffff"),
      primaryColor: String(data.get("primaryColor") || "#f4f72a"),
      secondaryColor: String(data.get("secondaryColor") || "#2695d8"),
      accentColor: String(data.get("accentColor") || "#d92736"),
      prepTitleBgColor: String(data.get("prepTitleBgColor") || ""),
      readyTitleBgColor: String(data.get("readyTitleBgColor") || ""),
      prepListBgColor: String(data.get("prepListBgColor") || ""),
      readyListBgColor: String(data.get("readyListBgColor") || ""),
      fontSize: Number(data.get("fontSize") || 54),
      imageData,
    };
  };
  const refreshPreview = () => {
    const preview = overlay.querySelector("#templateEditorPreview");
    if (preview) preview.innerHTML = buildOrderTemplateMarkup(readForm(), { preview: true });
  };

  form.addEventListener("input", refreshPreview);
  form.addEventListener("change", (event) => {
    if (event.target?.name === "layout") {
      applyTemplateStylePresetToForm(form, event.target.value);
    }
    refreshPreview();
  });
  form.elements.imageFile?.addEventListener("change", (event) => {
    const file = event.target?.files?.[0];
    const status = overlay.querySelector("#templateImageStatus");
    if (!file) {
      imageData = "";
      if (status) status.textContent = "No image selected";
      refreshPreview();
      return;
    }
    if (file.size > 500 * 1024) {
      event.target.value = "";
      if (status) status.textContent = "Image must be less than 500KB.";
      showNotice("warning", "Image Too Large", "Please select an image below 500KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      imageData = String(reader.result || "");
      if (status) status.textContent = `${file.name} added`;
      refreshPreview();
    };
    reader.readAsDataURL(file);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSave?.(readForm());
    overlay.remove();
    showNotice("success", "Template Saved", options.backToGallery ? "Template updated and selected." : "Template saved.");
  });
  overlay.querySelector("[data-template-close]")?.addEventListener("click", () => overlay.remove());
  overlay.querySelector("[data-template-delete]")?.addEventListener("click", () => {
    options.onDelete?.();
    overlay.remove();
  });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  refreshPreview();
}

function removeTemplateEditor() {
  document.querySelectorAll(".template-editor-overlay").forEach((el) => el.remove());
}

function updateSectionUploadMode(section) {
  const typeEl = document.getElementById(`sourceType${section}`);
  const uploadWrap = document.getElementById(`uploadWrap${section}`);
  const sourceWrap = document.getElementById(`sourceUrlWrap${section}`);
  const templateWrap = document.getElementById(`templateWrap${section}`);
  const sourceInput = document.getElementById(`sourceUrl${section}`);
  if (!typeEl) return;

  const sourceType = normalizeSectionSourceType(typeEl.value);
  if (typeEl.value !== sourceType) typeEl.value = sourceType;
  if (uploadWrap) uploadWrap.classList.toggle("hidden", sourceType !== SECTION_SOURCE_TYPES.multimedia);
  if (sourceWrap) {
    sourceWrap.classList.toggle(
      "hidden",
      sourceType === SECTION_SOURCE_TYPES.multimedia || sourceType === SECTION_SOURCE_TYPES.template
    );
  }
  if (templateWrap) templateWrap.classList.toggle("hidden", sourceType !== SECTION_SOURCE_TYPES.template);

  if (sourceInput) {
    if (sourceType === SECTION_SOURCE_TYPES.youtube) {
      sourceInput.placeholder = "https://youtube.com/watch?v=...";
    } else if (sourceType === SECTION_SOURCE_TYPES.web) {
      sourceInput.placeholder = "https://example.com";
    } else {
      sourceInput.placeholder = "";
    }
  }
  renderTemplateSummary(section);
}

function renderUploadSections() {
  const layout = document.getElementById("layout").value;
  const container = document.getElementById("uploadSections");

  const count = sectionCount(layout);
  for (let i = count + 1; i <= 3; i += 1) {
    pendingUploadSelections[i] = [];
  }

  const markup = [];
  for (let i = 1; i <= count; i++) {
    markup.push(`
        <div class="section-panel upload-section-card">
            <div class="section-heading-row" style="display:flex;align-items:center;gap:6px;margin-bottom:10px"><h3 style="margin:0">Section ${i}</h3><button class="btn files-btn" style="background:#1689e8;color:#fff;border:1px solid #8de1ff" type="button" onclick="window.openSectionFiles(${i})">Files</button></div>
            <div class="source-controls source-controls-stacked">
              <select id="sourceType${i}" onchange="onSectionSourceChange(${i})">
                <option value="multimedia" selected>Multimedia (Image/Video)</option>
                <option value="web">Website URL</option>
                <option value="youtube">YouTube URL</option>
                <option value="template">Ready Template (Offline Cached)</option>
          </select>
        </div>
        <div id="sourceUrlWrap${i}" class="hidden upload-source-url-wrap">
          <label for="sourceUrl${i}">Source URL</label>
          <input
            type="text"
            id="sourceUrl${i}"
            class="source-url-input"
            placeholder=""
            oninput="onSectionSourceUrlInput()"
          />
        </div>
        <div id="templateWrap${i}" class="template-tools hidden">
          <div class="template-actions">
            <button class="btn primary" type="button" onclick="addTemplateToSection(${i})">Add Templates</button>
            <button class="btn danger" type="button" onclick="deleteTemplateFromSection(${i})">Clear Templates</button>
          </div>
          <div id="templateSummary${i}" class="section-help">No template selected</div>
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
                  class="upload-file-input"
                  multiple
                  accept=".mp4,.m4v,.mov,.mkv,.webm,.jpg,.jpeg,.png,.txt,.pdf,.ppt,.pptx,.pptm,.pps,.ppsx,.potx,video/mp4,video/quicktime,video/webm,image/jpeg,image/png,text/plain,application/pdf,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint.presentation.macroenabled.12,application/vnd.openxmlformats-officedocument.presentationml.slideshow,application/vnd.ms-powerpoint.slideshow.macroenabled.12,application/vnd.openxmlformats-officedocument.presentationml.template"
                />
                <div class="upload-action-row">
                  <button class="btn primary" type="button" onclick="uploadMedia(${i})">Upload Section ${i}</button>
                </div>
              </div>
              <div id="mediaStatus${i}" class="section-help">No files selected</div>
            `
        }
      </div>
    `);
  }
  container.innerHTML = markup.join("");

  for (let i = 1; i <= count; i++) {
    if (!IS_TV_COMPACT_MODE) {
      const input = document.getElementById(`media${i}`);
      if (input) {
        input.addEventListener("change", () => captureUploadSelection(i));
      }
      updateUploadSelectionStatus(i);
    }
    updateSectionUploadMode(i);
  }
}

let sectionFilesModalToken = 0;

async function openSectionFiles(section) {
  return openConnectedDeviceFileManager();

  const modalToken = ++sectionFilesModalToken;
  document.querySelectorAll(".section-files-overlay").forEach((element) => element.remove());
  const origin = getCurrentOrigin();
  const overlay = document.createElement("div");
  overlay.className = "section-files-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:30000;display:flex;align-items:center;justify-content:center;padding:clamp(10px,3vw,24px);background:rgba(3,8,13,.78);backdrop-filter:blur(5px)";
  overlay.style.cssText = "position:fixed;inset:0;z-index:30000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(3,8,13,.78);backdrop-filter:blur(5px)";
  overlay.innerHTML = `<div class="section-files-panel" role="dialog" aria-modal="true" aria-label="All section files"><div class="template-gallery-head"><div><h3>All Section Files</h3><p>Files from Sections 1, 2 and 3.</p></div><button class="btn danger" type="button" data-close>Close</button></div><div data-file-list class="section-files-list"><div class="section-help">Loading files…</div></div><div class="template-actions" style="display:none"><button class="btn danger" type="button" data-delete disabled>Delete Selected</button></div></div>`;
  const list = overlay.querySelector("[data-file-list]");
  overlay.querySelector(".section-files-panel").style.cssText = "box-sizing:border-box;width:min(760px,100%);max-height:calc(100vh - 20px);overflow:auto;border-radius:18px;border:1px solid rgba(122,194,242,.26);background:linear-gradient(145deg,rgba(9,20,31,.98),rgba(7,15,23,.96));padding:16px;box-shadow:0 26px 70px rgba(0,0,0,.48)";
  const deleteButton = overlay.querySelector("[data-delete]");
  const close = () => {
    if (modalToken === sectionFilesModalToken) sectionFilesModalToken += 1;
    overlay.remove();
  };
  overlay.querySelector("[data-close]")?.addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);
  let files = [];
  try {
    const response = await fetch(`${origin}/media-list?ts=${Date.now()}`);
    if (!response.ok) throw new Error("media-list-failed");
    const unique = new Map();
    (await response.json()).forEach((file) => {
      const name = String(file?.originalName || file?.name || "").trim();
      if (name) unique.set(name, file);
    });
    files = Array.from(unique.values());
  } catch (_e) {
    if (modalToken !== sectionFilesModalToken) return;
    list.innerHTML = '<div class="section-help">Files could not be loaded. Please try again.</div>';
    return;
  }
  if (modalToken !== sectionFilesModalToken) return;
  const bySection = [1, 2, 3].map((sectionNo) => ({ sectionNo, files: files.filter((file) => Number(file?.section || 1) === sectionNo) }));
  list.innerHTML = files.length ? bySection.map(({ sectionNo, files: sectionFiles }) => `<section class="section-files-group" style="display:grid;gap:9px;padding:12px;border:1px solid rgba(111,197,239,.35);border-radius:12px;background:#0c2434"><h4 style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0"><span class="section-files-title" style="display:inline-flex;align-items:center;min-height:31px;padding:0 10px;border:1px solid #6bcaf5;border-radius:8px;background:#17465f;color:#fff;font-size:15px">Section ${sectionNo}</span><span class="section-files-count" style="display:inline-flex;align-items:center;min-height:31px;padding:0 10px;border:1px solid #72d3ff;border-radius:8px;background:#1689e8;color:#fff;font-size:13px">${sectionFiles.length} file${sectionFiles.length === 1 ? "" : "s"}</span></h4><div class="section-file-cards" style="display:grid;gap:7px">${sectionFiles.length ? sectionFiles.map((file) => {
    const name = String(file?.originalName || file?.name || "");
    const extension = name.includes(".") ? name.split(".").pop().toUpperCase() : "FILE";
    return `<label class="section-files-row" style="display:grid;grid-template-columns:22px minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid rgba(255,255,255,.18);border-radius:9px;background:#102c3d;cursor:pointer"><input class="section-file-checkbox" style="grid-column:1;grid-row:1 / span 2;width:17px;height:17px;margin:0;justify-self:center;accent-color:#1689e8" type="checkbox" data-section="${sectionNo}" value="${escapeHtml(name)}"><span class="section-file-name" style="display:grid;gap:3px;min-width:0"><strong title="${escapeHtml(name)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#fff;font-size:14px">${escapeHtml(name)}</strong><em style="font-style:normal;width:max-content;padding:2px 6px;border-radius:9px;background:#17465f;color:#bcecff;font-size:10px">${escapeHtml(extension)}</em></span><small style="grid-column:3;grid-row:1;color:#c5deec;white-space:nowrap">${formatBytes(Number(file?.size || 0))}</small></label>`;
  }).join("") : '<div class="section-help">No files in this section.</div>'}</div></section>`).join("") : '<div class="section-help">No uploaded files were found.</div>';
  deleteButton.disabled = !files.length;
  deleteButton?.addEventListener("click", async () => {
    const selected = Array.from(overlay.querySelectorAll("input[type=checkbox]:checked")).map((input) => ({ section: Number(input.dataset.section || 1), name: input.value }));
    if (!selected.length) return showNotice("warning", "No Files Selected", "Select at least one file to delete.");
    if (!(await showConfirmDialog("Delete Section Files", `Delete ${selected.length} selected file(s)?`, "Delete", "Cancel"))) return;
    try {
      const selectedBySection = selected.reduce((groups, item) => { (groups[item.section] ||= []).push(item.name); return groups; }, {});
      const results = await Promise.all(Object.entries(selectedBySection).map(async ([sectionNo, names]) => {
        const response = await fetch(`${origin}/config/delete-section-media`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ section: Number(sectionNo), files: names }) });
        const result = await response.json();
        if (!response.ok || !result?.success) throw new Error("delete-failed");
        return Number(result.deleted || 0);
      }));
      showNotice("success", "Files Deleted", `${results.reduce((total, value) => total + value, 0)} file(s) deleted.`);
      close();
    } catch (_e) {
      showNotice("error", "Delete Failed", "Selected files could not be deleted.");
    }
  });
}

async function openConnectedDeviceFileManager() {
  const token = ++sectionFilesModalToken;
  document.querySelectorAll(".section-files-overlay").forEach((element) => element.remove());
  const overlay = document.createElement("div");
  overlay.className = "section-files-overlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:30000;display:flex;align-items:center;justify-content:center;padding:clamp(10px,3vw,24px);background:rgba(3,8,13,.78);backdrop-filter:blur(5px)";
  overlay.innerHTML = `<div class="section-files-panel device-file-manager" role="dialog" aria-modal="true" aria-label="Device file manager">
    <div class="template-gallery-head device-file-manager-head"><div><h3>Media File Manager</h3><p>Select All Devices or one device to manage uploaded files.</p></div><div class="device-file-header-actions"><button class="btn danger" type="button" data-delete disabled>Delete Selected</button><button class="btn danger" type="button" data-close>Close</button></div></div>
    <div class="device-file-manager-body"><aside class="device-file-nav" data-nav>Loading devices...</aside><main class="device-file-content"><div class="device-file-content-head" data-heading></div><div class="section-files-list" data-list>Select a device.</div></main></div>
    <div class="device-file-actions"><span data-status>Select files to delete.</span></div>
  </div>`;
  const nav = overlay.querySelector("[data-nav]");
  overlay.querySelector(".device-file-manager").style.cssText = "box-sizing:border-box;width:min(1120px,100%);max-height:calc(100dvh - 20px);overflow:auto;border-radius:18px;border:1px solid rgba(122,194,242,.26);background:linear-gradient(145deg,rgba(9,20,31,.98),rgba(7,15,23,.96));padding:16px;box-shadow:0 26px 70px rgba(0,0,0,.48);margin:auto";
  const heading = overlay.querySelector("[data-heading]");
  const list = overlay.querySelector("[data-list]");
  const deleteButton = overlay.querySelector("[data-delete]");
  const status = overlay.querySelector("[data-status]");
  const close = () => { if (token === sectionFilesModalToken) sectionFilesModalToken += 1; overlay.remove(); };
  overlay.querySelector("[data-close]").addEventListener("click", close);
  overlay.addEventListener("click", (event) => { if (event.target === overlay) close(); });
  document.body.appendChild(overlay);

  let targets = [];
  let activeTarget = "all";
  const updateDeleteState = () => {
    const count = overlay.querySelectorAll("input[type=checkbox]:checked").length;
    deleteButton.disabled = !count;
    status.textContent = count ? `${count} file${count === 1 ? "" : "s"} selected` : "Select files to delete.";
  };
  const renderSections = (entries, title, details) => {
    heading.innerHTML = `<h4>${escapeHtml(title)}</h4><p>${escapeHtml(details)}</p>`;
    list.innerHTML = entries.map(({ target, files }) => `<section class="device-files-card"><div class="device-files-heading"><div><h4>${escapeHtml(target.name)}</h4><p>${escapeHtml(target.ip ? `IP: ${target.ip}` : target.origin)}</p></div><span class="section-files-count">${files.length} file${files.length === 1 ? "" : "s"}</span></div><div class="device-files-sections">${[1, 2, 3].map((sectionNo) => {
      const sectionFiles = files.filter((file) => Number(file?.section || 1) === sectionNo);
      return `<section class="section-files-group"><h4><span class="section-files-title">Section ${sectionNo}</span><span class="section-files-count">${sectionFiles.length}</span></h4><div class="section-file-cards">${sectionFiles.length ? sectionFiles.map((file) => {
        const name = String(file?.originalName || file?.name || "");
        const ext = name.includes(".") ? name.split(".").pop().toUpperCase() : "FILE";
        return `<label class="section-files-row"><input class="section-file-checkbox" type="checkbox" data-origin="${escapeHtml(target.origin)}" data-section="${sectionNo}" value="${escapeHtml(name)}"><span class="section-file-name"><strong title="${escapeHtml(name)}">${escapeHtml(name)}</strong><em>${escapeHtml(ext)}</em></span><small>${formatBytes(Number(file?.size || 0))}</small></label>`;
      }).join("") : '<div class="section-help">This section is empty.</div>'}</div></section>`;
    }).join("")}</div></section>`).join("");
    overlay.querySelectorAll("input[type=checkbox]").forEach((input) => input.addEventListener("change", updateDeleteState));
    updateDeleteState();
  };
  const loadFiles = async (target) => {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeout = controller ? setTimeout(() => controller.abort(), 3500) : null;
    try {
      const response = await fetch(`${target.origin}/media-list?ts=${Date.now()}`, { cache: "no-store", signal: controller?.signal });
      if (!response.ok) throw new Error("media-list-failed");
      const unique = new Map();
      (await response.json()).forEach((file) => {
        const name = String(file?.originalName || file?.name || "").trim();
        if (name) unique.set(`${Number(file?.section || 1)}:${name}`, file);
      });
      return { target, files: Array.from(unique.values()) };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
  const selectTarget = async (targetId) => {
    activeTarget = targetId;
    nav.querySelectorAll("[data-target]").forEach((button) => button.classList.toggle("is-active", button.dataset.target === targetId));
    list.innerHTML = '<div class="section-help">Loading files...</div>';
    try {
      const visibleTargets = targetId === "all" ? targets.filter((target) => target.id !== "all") : targets.filter((target) => target.id === targetId);
      const settled = await Promise.allSettled(visibleTargets.map(loadFiles));
      const results = settled.filter((item) => item.status === "fulfilled").map((item) => item.value);
      if (token !== sectionFilesModalToken || activeTarget !== targetId) return;
      const current = targets.find((target) => target.id === targetId);
      renderSections(results, current?.name || "All Devices", targetId === "all" ? "All connected device uploads. Select files to delete from their respective TV." : `Device ID: ${current?.deviceId || ""}${current?.ip ? ` | IP: ${current.ip}` : ""}`);
    } catch (_e) {
      if (token === sectionFilesModalToken) list.innerHTML = '<div class="section-help">Files could not be loaded. Please try again.</div>';
    }
  };
  try {
    // Do not block the popup on the background network/subnet scan. The CMS
    // already keeps a discovered-device cache while the page is open.
    await loadDevices();
    const devices = Array.from(currentDeviceMap.values());
    targets = [{ id: "all", name: "All Devices", origin: "", deviceId: "", ip: "" }, ...devices.map((device) => ({ id: getDeviceOptionValue(device), name: String(device.name || device.deviceId || "Unnamed TV"), origin: getDeviceOptionValue(device), deviceId: String(device.deviceId || ""), ip: String(device.ip || "") }))];
    nav.innerHTML = targets.map((target) => `<button type="button" class="device-file-nav-item" data-target="${escapeHtml(target.id)}"><strong>${escapeHtml(target.name)}</strong><small>${target.id === "all" ? "All connected TVs" : `IP: ${escapeHtml(target.ip || "Not available")}`}</small></button>`).join("");
    nav.querySelectorAll("[data-target]").forEach((button) => button.addEventListener("click", () => selectTarget(button.dataset.target)));
    await selectTarget("all");
  } catch (_e) {
    nav.innerHTML = '<div class="section-help">Connected devices could not be loaded.</div>';
  }
  deleteButton.addEventListener("click", async () => {
    const selected = Array.from(overlay.querySelectorAll("input[type=checkbox]:checked")).map((input) => ({ origin: String(input.dataset.origin || ""), section: Number(input.dataset.section || 1), name: input.value }));
    if (!selected.length) return;
    if (!(await showConfirmDialog("Delete Files", `Delete ${selected.length} selected file(s)?`, "Delete", "Cancel"))) return;
    try {
      const groups = selected.reduce((out, item) => { const key = `${item.origin}|${item.section}`; (out[key] ||= { origin: item.origin, section: item.section, files: [] }).files.push(item.name); return out; }, {});
      const results = await Promise.all(Object.values(groups).map(async ({ origin, section, files }) => {
        const response = await fetch(`${origin}/config/delete-section-media`, { method: "POST", headers: buildCmsAuthHeaders({ "Content-Type": "application/json" }), body: JSON.stringify({ section, files }) });
        const result = await response.json();
        if (!response.ok || !result?.success) throw new Error("delete-failed");
        return Number(result.deleted || 0);
      }));
      showNotice("success", "Files Deleted", `${results.reduce((sum, value) => sum + value, 0)} file(s) deleted.`);
      await selectTarget(activeTarget);
    } catch (_e) { showNotice("error", "Delete Failed", "Selected files could not be deleted."); }
  });
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
  setAutoReopen(false).catch(() => {});
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
    restartAfterUploadedMediaSave = true;
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
  markCmsFormDirty();
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
  const sourceType = normalizeSectionSourceType(document.getElementById(`sourceType${section}`)?.value);
  if (sourceType !== SECTION_SOURCE_TYPES.multimedia) {
    showNotice("info", "Upload Not Required", "For Website/YouTube/Ready Template source, upload is not required. Save settings only.");
    return;
  }

  const loader = document.getElementById("uploadLoader");
  captureUploadSelection(section);
  const files = getPendingUploadFiles(section);

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
      `Preparing ${uploadFiles.length} file(s), ${formatBytes(totalSize)} for ${deviceOrigins.length} device${deviceOrigins.length === 1 ? "" : "s"}`
    );

    const skipDuplicateScan = isLargeUploadSet(uploadFiles);
    const duplicateOrigins = skipDuplicateScan
      ? new Set()
      : await detectDuplicateUploadTargets(targetDevices, section, uploadFiles);
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
        tracker.setState(idx, "pending", "Ready for parallel upload", 0);
      }
    });

    const queuedTargets = allSelectedTargets
      .map((target, idx) => ({ ...target, index: idx }))
      .filter((target) => target.online !== false && !duplicateOrigins.has(target.origin));
    const hasVeryLargeVideo = uploadFiles.some(
      (file) => VIDEO_FILE_EXT.test(file?.name || "") && Number(file?.size || 0) > WARN_FILE_SIZE_BYTES
    );
    const isLargeUpload = isLargeUploadSet(uploadFiles);
    const uploadConcurrency = hasVeryLargeVideo
      ? 1
      : Math.max(1, Math.min(MULTI_DEVICE_UPLOAD_CONCURRENCY, queuedTargets.length || 1));

    await runUploadsInParallel(queuedTargets, uploadConcurrency, async (target, queueIndex, laneIndex) => {
      tracker.setState(
        target.index,
        "uploading",
        `Uploading now in lane ${laneIndex + 1} (${queueIndex + 1}/${queuedTargets.length})`,
        0
      );
      try {
        const result = await uploadToOriginWithRetry(
          target.origin,
          section,
          uploadFiles,
          containsPpt,
          tracker,
          target.index,
          {
            maxRetries: MULTI_DEVICE_UPLOAD_RETRIES,
            verifyBeforeRetry: isLargeUpload
              ? async (_error, attempt) => {
                  updateUploadProgress(
                    Math.max(92, Math.min(99, Math.round(((queueIndex + 1) / Math.max(queuedTargets.length, 1)) * 100))),
                    `Checking ${target.label} before retry ${attempt + 1}...`
                  );
                  return verifyUploadedFilesOnOrigin(target.origin, section, uploadFiles, 8, 2500);
                }
              : null,
          }
        );
        successfulTargets.push(target);
        if (result?.recovered) recoveredTargets.push(target);
      } catch (error) {
        const rawMessage = String(error?.message || "Upload failed");
        const shouldVerify =
          /network error during upload|upload timed out|server error|server-error|failed to fetch|connection/i.test(rawMessage) ||
          isLargeUpload;
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
          return;
        }
        tracker.setState(target.index, "error", rawMessage, 0);
        failedTargets.push({ ...target, message: rawMessage });
      }
    });

    tracker.finish(`Upload finished. ${successfulTargets.length}/${queuedTargets.length} devices updated.`);
    if (successfulTargets.length) {
      addUploadedMediaToScheduleProfile(section, uploadFiles);
      Promise.race([
        loadPreviewMediaSection(primaryOrigin, section),
        wait(2500),
      ])
        .then(() => renderScreenPreview())
        .catch(() => {});
    }
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
      restartAfterUploadedMediaSave = true;
      clearUploadSelection(section);
    } else if (successfulTargets.length) {
      showNotice("warning", "Upload Partially Complete", summaryParts.join(" "), 8500);
      clearUploadSelection(section);
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

async function loadConfig(options = {}) {
  const targetDevice = getPrimaryOrigin();
  const res = await fetch(`${targetDevice}/config?ts=${Date.now()}`);
  const config = await res.json();

  if (!options.force && cmsDraftRestoreChecked && isCmsEditInProgress()) {
    loadPreviewMedia(targetDevice)
      .then(() => renderScreenPreview())
      .catch(() => {});
    return config;
  }

  applyConfigToForm(config);
  restoreCmsFormDraftIfAvailable();
  loadPreviewMedia(targetDevice)
    .then(() => renderScreenPreview())
    .catch(() => {});
  return config;
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
        body: JSON.stringify({ config, restartAfterUpload: restartAfterUploadedMediaSave }),
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

    updateUploadProgress(92, "Applying settings instantly on selected TVs...");
    clearUnusedSectionsForLayout(targetDevices, config.layout || "fullscreen").catch(() => {});
    cmsFormDirty = false;
    restartAfterUploadedMediaSave = false;
    clearCmsFormDraft();
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
window.scheduleSaveProfile = saveScheduleProfile;
window.scheduleSaveProfileChanges = saveScheduleProfileChanges;
window.scheduleOpenProfile = openScheduleProfileEditor;
window.scheduleSaveEntry = saveScheduleEntry;
window.scheduleEditEntry = editScheduleEntry;
window.scheduleDeleteEntry = deleteScheduleEntry;
window.scheduleClearEntryEditor = clearScheduleEntryEditor;
window.scheduleDeleteProfile = deleteScheduleProfile;
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
window.openSectionFiles = openSectionFiles;
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
window.addTemplateToSection = addTemplateToSection;
window.showTemplateEditor = showTemplateEditor;
window.deleteTemplateFromSection = deleteTemplateFromSection;
window.removeSectionTemplate = removeSectionTemplate;
window.editSectionTemplate = editSectionTemplate;

  document.addEventListener("DOMContentLoaded", async () => {
  updateViewportHeightVar();
  applyTvViewportClass();
  window.addEventListener("resize", () => {
    updateViewportHeightVar();
    applyTvViewportClass();
  });
    if (IS_TV_COMPACT_MODE) {
      document.body.classList.add("tv-compact-mode");
    }
  applyPlayerOrientationClass();

  renderGrid3LayoutOptions();
  updateScheduleFallbackVisibility();
  syncUploadTimeoutInput();
  updateUploadProgress(0, "Preparing upload...");
  await refreshLocalNetworkState();
  await loadDevices();
  if (getSelectedOrigins().length) {
    await loadConfig();
  } else {
    restoreCmsFormDraftIfAvailable();
    renderScreenPreview();
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
    markCmsFormDirty();
  });

  document.getElementById("deviceSelect").addEventListener("change", async () => {
    const value = document.getElementById("deviceSelect")?.value || "all";
    selectedDeviceOrigins = value === "all" ? new Set(Array.from(currentDeviceMap.keys())) : new Set([value]);
    await clearEnterpriseGroupSelectionSilently();
    await handleDeviceSelectionChanged();
    loadDeviceAlerts();
  });
  document.getElementById("uploadTimeoutMinutes")?.addEventListener("change", (event) => {
    setUploadTimeoutMinutes(event?.target?.value);
    markCmsFormDirty();
  });
  document.getElementById("gridRatio").addEventListener("change", (e) => {
    selectedGridRatio = e.target.value;
    if (currentConfig) currentConfig.gridRatio = selectedGridRatio;
    renderGrid3LayoutOptions();
    markCmsFormDirty();
    renderScreenPreview();
  });
  document.getElementById("scheduleEnabled").addEventListener("change", () => {
    const fields = document.getElementById("scheduleFields");
    if (fields) fields.style.opacity = document.getElementById("scheduleEnabled").checked ? "1" : "0.55";
    markCmsFormDirty();
  });
  document.getElementById("scheduleProfileSelect").addEventListener("change", (event) => {
    const profileId = String(event?.target?.value || "");
    if (profileId) openScheduleProfileEditor(profileId);
  });
  document.getElementById("scheduleFallbackMode").addEventListener("change", () => {
    updateScheduleFallbackVisibility();
    markCmsFormDirty();
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
      markCmsFormDirty();
      renderScreenPreview();
    });
  });

  Array.from(document.querySelectorAll(".schedule-day")).forEach((el) => {
    el.addEventListener("change", () => {
      markCmsFormDirty();
    });
  });

  document.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;
    if (target.type === "file") return;
    if (!isCmsFormElement(target)) return;
    markCmsFormDirty();
  });

  document.addEventListener("keydown", (event) => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    if (active instanceof HTMLInputElement && active.type === "range" && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      const moved = focusNearestElementByDirection(event.key === "ArrowDown" ? "down" : "up");
      if (moved) event.preventDefault();
      return;
    }

    if (!IS_TV_COMPACT_MODE) return;
    if (event.key === "ArrowRight") {
      if (focusNearestElementByDirection("right")) event.preventDefault();
      return;
    }
    if (event.key === "ArrowLeft") {
      if (focusNearestElementByDirection("left")) event.preventDefault();
      return;
    }
    if (event.key === "ArrowDown") {
      if (focusNearestElementByDirection("down") || scrollTvPane("down")) event.preventDefault();
      return;
    }
    if (event.key === "ArrowUp") {
      if (focusNearestElementByDirection("up") || scrollTvPane("up")) event.preventDefault();
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    keepTvFocusVisible(target);
  });

  if (IS_TV_COMPACT_MODE) {
    document.addEventListener("wheel", (event) => {
      const target = event.target instanceof HTMLElement ? event.target : document.body;
      const pane = getTvScrollablePane(target) || document.querySelector(".container");
      if (!pane) return;
      if (performTvScroll(pane, event.deltaY)) event.preventDefault();
    }, { passive: false });
  }
});

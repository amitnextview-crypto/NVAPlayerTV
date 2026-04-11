const state = {
  devices: [],
  selected: new Set(),
  manualOrigins: new Set(),
  configLoaded: false,
  groups: loadGroups(),
};

const els = {
  deviceList: document.getElementById("deviceList"),
  activityLog: document.getElementById("activityLog"),
  selectionSummary: document.getElementById("selectionSummary"),
  renameHint: document.getElementById("renameHint"),
  deviceName: document.getElementById("deviceName"),
  manualIp: document.getElementById("manualIp"),
  groupName: document.getElementById("groupName"),
  groupSelect: document.getElementById("groupSelect"),
};

function loadGroups() {
  try {
    const raw = localStorage.getItem("tvCmsGroups");
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function persistGroups() {
  localStorage.setItem("tvCmsGroups", JSON.stringify(state.groups));
}

function renderGroups() {
  const names = Object.keys(state.groups).sort((a, b) => a.localeCompare(b));
  els.groupSelect.innerHTML = "";
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = names.length ? "Select saved group" : "No saved groups";
  els.groupSelect.appendChild(placeholder);
  names.forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = `${name} (${(state.groups[name] || []).length})`;
    els.groupSelect.appendChild(option);
  });
}

function log(message) {
  const item = document.createElement("div");
  item.className = "activity-item";
  item.textContent = `${new Date().toLocaleTimeString()}  ${message}`;
  els.activityLog.prepend(item);
  while (els.activityLog.children.length > 12) {
    els.activityLog.removeChild(els.activityLog.lastChild);
  }
}

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw.replace(/\/+$/, "");
  }
  return `http://${raw.replace(/\/+$/, "")}:8080`;
}

function selectedDevices() {
  return state.devices.filter((device) => state.selected.has(device.origin));
}

function updateSelectionSummary() {
  const count = selectedDevices().length;
  els.selectionSummary.textContent = `${count} TV${count === 1 ? "" : "s"} selected`;
  const single = count === 1 ? selectedDevices()[0] : null;
  els.renameHint.textContent = single ? `${single.name} selected` : "Select 1 TV";
  els.deviceName.value = single ? single.name || "" : "";
  els.deviceName.disabled = !single;
  document.getElementById("saveNameBtn").disabled = !single;
}

function renderDevices() {
  els.deviceList.innerHTML = "";
  if (!state.devices.length) {
    const empty = document.createElement("div");
    empty.className = "activity-item";
    empty.textContent = "Scanning local network for TVs...";
    els.deviceList.appendChild(empty);
    updateSelectionSummary();
    return;
  }

  state.devices.forEach((device) => {
    const card = document.createElement("label");
    card.className = "device-card";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selected.has(device.origin);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(device.origin);
      else state.selected.delete(device.origin);
      updateSelectionSummary();
    });

    const copy = document.createElement("div");
    const displayName = device.name || "Unnamed TV";
    const subtitle =
      displayName && device.deviceId && displayName !== device.deviceId
        ? "Custom TV name active"
        : "Rename TV for easy identification";
    copy.innerHTML = `
      <div class="device-title">${displayName} (${device.deviceId || "unknown"})</div>
      <div class="device-subtitle">${subtitle}</div>
      <div class="device-meta">${device.ip || device.origin}${device.hostname ? ` • ${device.hostname}` : ""}</div>
    `;

    const status = document.createElement("div");
    status.className = `status ${device.online ? "online" : "offline"}`;
    status.textContent = device.online ? "Online" : "Offline";

    card.appendChild(checkbox);
    card.appendChild(copy);
    card.appendChild(status);
    els.deviceList.appendChild(card);
  });

  updateSelectionSummary();
}

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function mergeDevices(nextDevices) {
  const map = new Map();
  state.devices.forEach((device) => {
    if (!device || !device.origin) return;
    map.set(device.origin, { ...device, online: false });
  });
  nextDevices.forEach((device) => {
    if (!device || !device.origin) return;
    map.set(device.origin, { ...map.get(device.origin), ...device });
  });
  state.devices = Array.from(map.values()).sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return `${a.name || ""}`.localeCompare(`${b.name || ""}`);
  });
  renderDevices();
}

async function probeOrigin(origin) {
  try {
    const status = await fetchJson(`${origin}/status`);
    return {
      origin,
      name: status.name || status.deviceId || "Unnamed TV",
      deviceId: status.deviceId || "",
      ip: status.ip || "",
      hostname: status.hostname || "",
      online: status.online !== false,
    };
  } catch (_error) {
    return null;
  }
}

async function scanSubnet(baseOrigin) {
  try {
    const baseStatus = await fetchJson(`${baseOrigin}/status`);
    const ip = String(baseStatus.ip || "");
    const parts = ip.split(".");
    if (parts.length !== 4) return;
    const prefix = `${parts[0]}.${parts[1]}.${parts[2]}`;
    const origins = [];
    for (let i = 1; i < 255; i += 1) {
      const candidate = `http://${prefix}.${i}:8080`;
      if (candidate === baseOrigin) continue;
      origins.push(candidate);
    }
    for (let index = 0; index < origins.length; index += 12) {
      const batch = origins.slice(index, index + 12);
      const results = await Promise.all(batch.map(probeOrigin));
      mergeDevices(results.filter(Boolean));
    }
  } catch (_error) {
  }
}

async function refreshDevices() {
  const origin = window.location.origin;
  const merged = [];

  const self = await probeOrigin(origin);
  if (self) merged.push(self);

  try {
    const discovered = await fetchJson(`${origin}/devices`);
    discovered.forEach((device) => {
      const deviceOrigin = normalizeOrigin(device.publicUrl || `http://${device.ip}:8080`);
      if (!deviceOrigin) return;
      merged.push({
        origin: deviceOrigin,
        name: device.name || device.deviceId || "Unnamed TV",
        deviceId: device.deviceId || "",
        ip: device.ip || "",
        hostname: device.hostname || "",
        online: device.online !== false,
      });
    });
  } catch (_error) {
  }

  for (const manual of state.manualOrigins) {
    const found = await probeOrigin(manual);
    if (found) merged.push(found);
  }

  mergeDevices(merged.filter(Boolean));
  scanSubnet(origin);
}

function applyConfigToForm(config) {
  if (!config || typeof config !== "object") return;
  document.getElementById("layout").value = config.layout || "fullscreen";
  document.getElementById("orientation").value = config.orientation || "horizontal";
  document.getElementById("duration").value =
    Number(config.sections?.[0]?.slideDuration || config.slideDuration || 5);
  document.getElementById("tickerText").value = String(config.ticker?.text || "");
  document.getElementById("tickerSpeed").value = Number(config.ticker?.speed || 6);
}

async function loadInitialConfig() {
  if (state.configLoaded) return;
  try {
    const config = await fetchJson(`${window.location.origin}/config`);
    applyConfigToForm(config);
    state.configLoaded = true;
  } catch (_error) {
  }
}

function buildConfigPayload() {
  const duration = Number(document.getElementById("duration").value || 5);
  const tickerSpeed = Number(document.getElementById("tickerSpeed").value || 6);
  return {
    orientation: document.getElementById("orientation").value,
    layout: document.getElementById("layout").value,
    grid3Layout: "stack-v",
    gridRatio: "1:1:1",
    slideDuration: duration,
    animation: "slide",
    bgColor: "#000000",
    sections: [
      { slideDirection: "left", slideDuration: duration, sourceType: "multimedia", sourceUrl: "" },
      { slideDirection: "left", slideDuration: duration, sourceType: "multimedia", sourceUrl: "" },
      { slideDirection: "left", slideDuration: duration, sourceType: "multimedia", sourceUrl: "" },
    ],
    ticker: {
      text: document.getElementById("tickerText").value,
      color: "#ffffff",
      bgColor: "#000000",
      speed: tickerSpeed,
      fontSize: 24,
      position: "bottom",
    },
    cache: { videoMB: 2048 },
  };
}

async function buildMergedConfig(device) {
  const current = await fetchJson(`${device.origin}/config`);
  const next = buildConfigPayload();
  return {
    ...current,
    ...next,
    ticker: {
      ...(current?.ticker || {}),
      ...(next.ticker || {}),
    },
    cache: {
      ...(current?.cache || {}),
      ...(next.cache || {}),
    },
    sections: Array.isArray(next.sections) ? next.sections : current?.sections || [],
  };
}

async function applyConfig() {
  const targets = selectedDevices();
  if (!targets.length) {
    log("Select at least one TV before applying settings.");
    return;
  }
  log(`Applying settings to ${targets.length} TV(s)...`);
  await Promise.all(targets.map(async (device) => {
    const config = await buildMergedConfig(device);
    await fetch(`${device.origin}/config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config }),
    });
  }));
  log("Settings applied successfully.");
}

async function saveDeviceName() {
  const targets = selectedDevices();
  if (targets.length !== 1) {
    log("Select exactly one TV to rename it.");
    return;
  }
  const nextName = String(els.deviceName.value || "").trim();
  if (!nextName) {
    log("Enter a TV name first.");
    return;
  }
  const target = targets[0];
  await fetch(`${target.origin}/config`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceName: nextName }),
  });
  log(`Saved TV name: ${nextName}`);
  await refreshDevices();
}

async function uploadMedia() {
  const targets = selectedDevices();
  if (!targets.length) {
    log("Select at least one TV before upload.");
    return;
  }
  const files = Array.from(document.getElementById("mediaFiles").files || []);
  if (!files.length) {
    log("Choose media files first.");
    return;
  }
  const section = document.getElementById("section").value;
  log(`Uploading ${files.length} file(s) to ${targets.length} TV(s)...`);
  await Promise.all(targets.map(async (device) => {
    const formData = new FormData();
    files.forEach((file, index) => formData.append(`file${index}`, file, file.name));
    await fetch(`${device.origin}/upload?section=${encodeURIComponent(section)}`, {
      method: "POST",
      body: formData,
    });
  }));
  log("Upload completed.");
}

function saveCurrentSelectionAsGroup() {
  const name = String(els.groupName.value || "").trim();
  const targets = selectedDevices();
  if (!name) {
    log("Enter a group name first.");
    return;
  }
  if (!targets.length) {
    log("Select TVs first, then save the group.");
    return;
  }
  state.groups[name] = targets.map((device) => device.origin);
  persistGroups();
  renderGroups();
  els.groupName.value = "";
  log(`Saved group "${name}" with ${targets.length} TV(s).`);
}

function applySavedGroup() {
  const name = String(els.groupSelect.value || "");
  const origins = state.groups[name] || [];
  state.selected = new Set(origins);
  renderDevices();
  if (name) {
    log(`Selected TVs from group "${name}".`);
  }
}

function deleteSavedGroup() {
  const name = String(els.groupSelect.value || "");
  if (!name) {
    log("Select a group to delete.");
    return;
  }
  delete state.groups[name];
  persistGroups();
  renderGroups();
  log(`Deleted group "${name}".`);
}

document.getElementById("refreshBtn").addEventListener("click", refreshDevices);
document.getElementById("applyConfigBtn").addEventListener("click", applyConfig);
document.getElementById("uploadBtn").addEventListener("click", uploadMedia);
document.getElementById("saveNameBtn").addEventListener("click", saveDeviceName);
document.getElementById("selectAllBtn").addEventListener("click", () => {
  state.devices.forEach((device) => state.selected.add(device.origin));
  renderDevices();
});
document.getElementById("clearSelectionBtn").addEventListener("click", () => {
  state.selected.clear();
  renderDevices();
});
document.getElementById("saveGroupBtn").addEventListener("click", saveCurrentSelectionAsGroup);
document.getElementById("applyGroupBtn").addEventListener("click", applySavedGroup);
document.getElementById("deleteGroupBtn").addEventListener("click", deleteSavedGroup);

document.getElementById("manualForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const origin = normalizeOrigin(els.manualIp.value);
  if (!origin) return;
  state.manualOrigins.add(origin);
  els.manualIp.value = "";
  const found = await probeOrigin(origin);
  if (found) {
    mergeDevices([found]);
    log(`Added ${found.name} manually.`);
  } else {
    log(`Could not reach ${origin}.`);
  }
});

renderGroups();
refreshDevices();
loadInitialConfig();
setInterval(refreshDevices, 10000);

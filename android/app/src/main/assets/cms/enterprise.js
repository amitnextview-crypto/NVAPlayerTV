(function enterpriseCms() {
  const state = {
    groups: [],
    devices: [],
    queue: null,
    logs: [],
    selectedDevices: new Set(),
    activeGroupId: "",
    editingGroupId: "",
    authenticated: false,
    deviceLevels: {},
  };
  const ACTIVE_GROUP_STORAGE_KEY = "tvCmsActiveGroupId";
  const AUTH_PASSWORD_STORAGE_KEY = "tvCmsAuthPassword";
  const FIXED_CMS_PASSWORD = "0408";

  function byId(id) {
    return document.getElementById(id);
  }

  function loadActiveGroupId() {
    try {
      return String(window.localStorage.getItem(ACTIVE_GROUP_STORAGE_KEY) || "").trim();
    } catch (_e) {
      return "";
    }
  }

  function persistActiveGroupId(groupId) {
    try {
      window.localStorage.setItem(ACTIVE_GROUP_STORAGE_KEY, String(groupId || "").trim());
    } catch (_e) {
    }
  }

  function notice(type, title, message, duration) {
    if (window.__cmsShowNotice) {
      window.__cmsShowNotice(type, title, message, duration);
      return;
    }
    window.alert(`${title}\n\n${message}`);
  }

  function setSharedLoaderVisibility(visible) {
    try {
      if (typeof window.__cmsSetLoaderVisibility === "function") {
        window.__cmsSetLoaderVisibility(visible);
        return;
      }
    } catch (_e) {
    }
    const loader = byId("uploadLoader");
    if (loader) loader.classList.toggle("hidden", !visible);
  }

  function updateSharedProgress(percent, message) {
    try {
      if (typeof window.__cmsUpdateUploadProgress === "function") {
        window.__cmsUpdateUploadProgress(percent, message);
        return;
      }
    } catch (_e) {
    }
    const fill = byId("uploadProgressFill");
    const progressText = byId("uploadProgressText");
    const status = byId("uploadStatus");
    const safePercent = Math.max(0, Math.min(100, Math.round(Number(percent || 0))));
    if (fill) fill.style.width = `${safePercent}%`;
    if (progressText) progressText.textContent = `${safePercent}%`;
    if (status && message) status.textContent = String(message);
  }

  function normalizeDeviceId(value) {
    return String(value || "").trim().toLowerCase();
  }

  function enrichGroupsFromCurrentDevices(groups = []) {
    const deviceMap = new Map();
    state.devices.forEach((device) => {
      const key = normalizeDeviceId(device?.deviceId);
      if (!key) return;
      deviceMap.set(key, device);
    });
    return (Array.isArray(groups) ? groups : []).map((group) => {
      const rawDevices = Array.isArray(group?.devices) ? group.devices : [];
      const devices = rawDevices.map((entry) => {
        const fallbackId = entry?.deviceId || entry;
        const key = normalizeDeviceId(fallbackId);
        return deviceMap.get(key) || entry;
      });
      const onlineCount = devices.filter((device) => device?.online !== false).length;
      return {
        ...(group || {}),
        devices,
        deviceCount: devices.length,
        onlineCount,
        offlineCount: Math.max(0, devices.length - onlineCount),
      };
    });
  }

  async function runGroupActionProgress(actionLabel, action, successMessage = "") {
    setSharedLoaderVisibility(true);
    updateSharedProgress(12, `${actionLabel}...`);
    try {
      const result = await action({
        setProgress(percent, message) {
          updateSharedProgress(percent, message || actionLabel);
        },
      });
      updateSharedProgress(100, successMessage || `${actionLabel} complete.`);
      return result;
    } finally {
      setTimeout(() => {
        setSharedLoaderVisibility(false);
        updateSharedProgress(0, "Preparing upload...");
      }, 450);
    }
  }

  async function runRefreshContentWithProgress(selected) {
    const total = Math.max(1, selected.length);
    setSharedLoaderVisibility(true);
    updateSharedProgress(8, `Starting sync on ${total} device${total === 1 ? "" : "s"}...`);

    try {
      let completed = 0;
      const requests = selected.map(async (device) => {
        const result = await fetchJson(`${getDeviceOrigin(device)}/config/bulk-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "refresh-content", payload: {} }),
        });
        completed += 1;
        updateSharedProgress(
          Math.max(15, Math.min(92, Math.round((completed / total) * 100))),
          `Sync request sent to ${completed} of ${total} device${total === 1 ? "" : "s"}...`
        );
        return result;
      });
      const results = await Promise.allSettled(requests);
      const failed = results.find((item) => item.status === "rejected");
      if (failed && failed.status === "rejected") {
        throw new Error(String(failed.reason?.message || "Unable to send the sync command."));
      }
      updateSharedProgress(100, "Sync applied successfully.");
      notice("success", "Sync Started", `Sync command sent to ${total} device${total === 1 ? "" : "s"}.`, 2600);
      void refreshDevices();
    } finally {
      setTimeout(() => {
        setSharedLoaderVisibility(false);
        updateSharedProgress(0, "Preparing upload...");
      }, 500);
    }
  }

  function storeAuthPassword(password) {
    try {
      const safe = String(password || FIXED_CMS_PASSWORD);
      if (safe) window.sessionStorage.setItem(AUTH_PASSWORD_STORAGE_KEY, safe);
      else window.sessionStorage.removeItem(AUTH_PASSWORD_STORAGE_KEY);
    } catch (_e) {
    }
  }

  function getStoredAuthPassword() {
    try {
      return String(window.sessionStorage.getItem(AUTH_PASSWORD_STORAGE_KEY) || FIXED_CMS_PASSWORD).trim() || FIXED_CMS_PASSWORD;
    } catch (_e) {
      return FIXED_CMS_PASSWORD;
    }
  }

  async function confirmDialog(title, message, confirmText, cancelText) {
    if (window.__cmsShowConfirmDialog) {
      return window.__cmsShowConfirmDialog(title, message, confirmText, cancelText);
    }
    return window.confirm(`${title}\n\n${message}`);
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options,
      headers: {
        "X-CMS-Password": getStoredAuthPassword(),
        ...((options && options.headers) || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(data?.error || data?.message || `HTTP ${res.status}`));
    }
    return data;
  }

  function setAuthLocked(locked, message = "") {
    document.body.classList.remove("cms-auth-locked");
  }

  function openManageModal(section = "") {
    byId("enterpriseModal")?.classList.remove("hidden");
    if (section === "groups") {
      byId("enterpriseGroupsSection")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function closeManageModal() {
    byId("enterpriseModal")?.classList.add("hidden");
  }

  function getDeviceMap() {
    const map = typeof window.__cmsGetDeviceMap === "function"
      ? window.__cmsGetDeviceMap()
      : new Map();
    return map instanceof Map ? map : new Map();
  }

  function getDeviceOrigin(device) {
    if (typeof window.__cmsGetDeviceOptionValue === "function") {
      return String(window.__cmsGetDeviceOptionValue(device) || "").trim();
    }
    return formatOrigin(device);
  }

  function syncSelectedDevicesFromMainUi() {
    if (typeof window.__cmsGetSelectedOrigins !== "function") return;
    const selectedOrigins = new Set(
      (window.__cmsGetSelectedOrigins() || []).map((item) => String(item || "").trim()).filter(Boolean)
    );
    const mappedIds = state.devices
      .filter((device) => selectedOrigins.has(getDeviceOrigin(device)))
      .map((device) => String(device?.deviceId || "").trim())
      .filter(Boolean);
    state.selectedDevices = new Set(mappedIds);
  }

  function refreshDeviceStateFromApp() {
    state.devices = Array.from(getDeviceMap().values());
    syncSelectedDevicesFromMainUi();
    if (!state.selectedDevices.size && typeof window.__cmsGetSelectedOrigins !== "function") {
      state.selectedDevices = new Set(
        state.devices
          .map((device) => String(device?.deviceId || "").trim())
          .filter(Boolean)
      );
    } else {
      state.selectedDevices = new Set(
        Array.from(state.selectedDevices).filter((deviceId) =>
          state.devices.some((device) => device.deviceId === deviceId)
        )
      );
    }
  }

  function getSelectedDeviceEntries() {
    const deviceMap = new Map(state.devices.map((device) => [device.deviceId, device]));
    return Array.from(state.selectedDevices)
      .map((deviceId) => deviceMap.get(deviceId))
      .filter(Boolean);
  }

  function getCommandTargetEntries() {
    const selected = getSelectedDeviceEntries();
    const online = selected.filter((device) => device?.online !== false && getDeviceOrigin(device));
    return online;
  }

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
      size /= 1024;
      index += 1;
    }
    return `${size >= 100 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
  }

  function formatOrigin(device) {
    return String(device?.origin || device?.publicUrl || device?.localUrl || "").trim();
  }

  function computeOriginForUpdate(device, nextUrl, preferredPort) {
    const normalize = window.__cmsNormalizeOrigin || ((value) => String(value || "").trim());
    const raw = String(nextUrl || "").trim();
    if (raw) {
      return normalize(raw);
    }
    const base = normalize(formatOrigin(device));
    if (!base || !preferredPort) return base;
    try {
      const url = new URL(base);
      url.port = String(preferredPort);
      return url.toString().replace(/\/+$/, "");
    } catch (_e) {
      return base.replace(/:\d+$/, `:${preferredPort}`);
    }
  }

  async function syncSelectedOriginsToMainUi() {
    if (typeof window.__cmsSetSelectedOrigins !== "function") return;
    const origins = getSelectedDeviceEntries()
      .map((device) => getDeviceOrigin(device))
      .filter(Boolean);
    await window.__cmsSetSelectedOrigins(origins);
  }

  async function applySelectedDevices(nextSelected, options = {}) {
    state.selectedDevices = new Set(Array.from(nextSelected || []).filter(Boolean));
    await syncSelectedOriginsToMainUi();
    renderDevicePicker("enterpriseDevicePicker");
    renderDevicePicker("enterpriseBulkTargets");
    renderDevicePicker("enterpriseUploadTargets");
    renderDeviceControlPanel();
    updateSelectedDeviceMeta();
    if (options.refreshGroups !== false) {
      renderGroups();
    }
  }

  async function applyGroupSelection(group, options = {}) {
    if (!group) return;
    state.activeGroupId = String(group.id || "").trim();
    persistActiveGroupId(state.activeGroupId);
    await applySelectedDevices(
      (group.devices || []).map((item) => item.deviceId || item),
      { refreshGroups: true }
    );
    if (options.notify) {
      notice("success", "Group Selected", `${group.name} is now selected.`);
    }
  }

  function clearActiveGroupSelection() {
    state.activeGroupId = "";
    persistActiveGroupId("");
    renderGroups();
  }

  async function syncActiveGroupSelection() {
    const activeGroup = state.groups.find((item) => item.id === state.activeGroupId);
    if (!activeGroup) {
      clearActiveGroupSelection();
      return;
    }
    await applySelectedDevices(
      (activeGroup.devices || []).map((item) => item.deviceId || item),
      { refreshGroups: false }
    );
    const compactSelect = byId("compactGroupSelect");
    if (compactSelect) compactSelect.value = state.activeGroupId;
  }

  function updateSelectedDeviceMeta() {
    const meta = byId("enterpriseSelectedDeviceMeta");
    if (!meta) return;
    const selected = getSelectedDeviceEntries();
    if (!selected.length) {
      meta.textContent = "Select one or more devices to control, rename, or normalize access URLs.";
      return;
    }
    if (selected.length === 1) {
      const [device] = selected;
      meta.textContent = [
        `${device.name || device.deviceId} (${device.deviceId})`,
        device.ip ? `IP: ${device.ip}` : "",
        formatOrigin(device) ? `Access: ${formatOrigin(device)}` : "",
        device.appVersion || device.meta?.appVersion ? `App: ${device.appVersion || device.meta?.appVersion}` : "",
        device.preferredPort ? `Preferred Port: ${device.preferredPort}` : "",
      ].filter(Boolean).join(" | ");
      if (byId("enterpriseAccessUrlValue")) byId("enterpriseAccessUrlValue").value = formatOrigin(device);
      if (byId("enterprisePreferredPortValue")) byId("enterprisePreferredPortValue").value = String(device.preferredPort || device.port || 8080);
      return;
    }
    const online = selected.filter((item) => item.online).length;
    meta.textContent = `${selected.length} devices selected | ${online} online | ${selected.length - online} offline`;
  }

  function renderDevicePicker(targetId, selected = state.selectedDevices) {
    const wrap = byId(targetId);
    if (!wrap) return;
    wrap.innerHTML = "";
    if (!state.devices.length) {
      wrap.innerHTML = `<div class="enterprise-meta">No device status available yet.</div>`;
      return;
    }
    state.devices.forEach((device) => {
      const row = document.createElement("div");
      row.className = "enterprise-picker-item";
      row.innerHTML = `
        <label>
          <input type="checkbox" data-device-id="${device.deviceId}" ${selected.has(device.deviceId) ? "checked" : ""} />
          <span>${device.name || device.deviceId}</span>
        </label>
        <span class="enterprise-badge ${device.online ? "online" : "offline"}">
          ${device.online ? "Online" : "Offline"}
        </span>
      `;
      const checkbox = row.querySelector("input");
      checkbox.addEventListener("change", async () => {
        if (checkbox.checked) selected.add(device.deviceId);
        else selected.delete(device.deviceId);
        clearActiveGroupSelection();
        await applySelectedDevices(selected);
      });
      wrap.appendChild(row);
    });
  }

  function renderGroups() {
    const wrap = byId("enterpriseGroupsList");
    if (!wrap) return;
    const search = String(byId("enterpriseGroupSearch")?.value || "").trim().toLowerCase();
    const list = state.groups.filter((group) => {
      if (!search) return true;
      const deviceNames = (group.devices || [])
        .map((device) => device?.name || device?.deviceId || device)
        .join(" ")
        .toLowerCase();
      return group.name.toLowerCase().includes(search) || deviceNames.includes(search);
    });
    const compactSelect = byId("compactGroupSelect");
    if (compactSelect) {
      compactSelect.innerHTML = `<option value="">None</option>${list.map((group) => `<option value="${group.id}">${group.name} (${group.deviceCount || 0})</option>`).join("")}`;
      compactSelect.value = list.some((group) => group.id === state.activeGroupId) ? state.activeGroupId : "";
    }
    const compactMeta = byId("compactGroupMeta");
    if (compactMeta) {
      const activeGroup = list.find((group) => group.id === state.activeGroupId);
      compactMeta.textContent = activeGroup
        ? `${activeGroup.name} is selected. Choose None to switch back to manual targeting.`
        : list.length
          ? `${list.length} saved group(s) available. Choose None to target devices manually.`
          : "No saved groups yet. Choose None to target devices manually.";
    }
    if (!list.length) {
      wrap.innerHTML = `<div class="enterprise-meta">No groups found.</div>`;
      return;
    }
    wrap.innerHTML = "";
    list.forEach((group) => {
      const card = document.createElement("div");
      card.className = `enterprise-group-card ${group.id === state.activeGroupId ? "is-active" : ""}`;
      const deviceNames = (group.devices || [])
        .map((device) => device.name || device.deviceId || device)
        .filter(Boolean)
        .join(", ");
      card.innerHTML = `
        <div class="enterprise-group-head">
          <div>
            <strong>${group.name}</strong>
            <div class="enterprise-meta">${deviceNames || "No devices"}</div>
          </div>
          <div class="enterprise-actions-row">
            <button class="btn primary" type="button" data-action="edit">Edit</button>
            <button class="btn warning" type="button" data-action="select">Select</button>
            <button class="btn danger" type="button" data-action="delete">Delete</button>
          </div>
        </div>
        <div class="enterprise-badges">
          <span class="enterprise-badge neutral">${group.deviceCount || 0} devices</span>
          <span class="enterprise-badge online">${group.onlineCount || 0} online</span>
          <span class="enterprise-badge offline">${group.offlineCount || 0} offline</span>
        </div>
      `;
      card.querySelector('[data-action="edit"]').addEventListener("click", async () => {
        state.editingGroupId = group.id;
        byId("enterpriseGroupName").value = group.name;
        await applySelectedDevices((group.devices || []).map((item) => item.deviceId || item));
      });
      card.querySelector('[data-action="select"]').addEventListener("click", async () => {
        await applyGroupSelection(group, { notify: true });
      });
      card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        const yes = await confirmDialog("Delete Group", `Delete group "${group.name}"?`, "Delete", "Cancel");
        if (!yes) return;
        await runGroupActionProgress(
          `Deleting group ${group.name}`,
          async (progress) => {
            progress.setProgress(28, `Deleting group ${group.name}...`);
            await fetchJson(`/api/groups/${encodeURIComponent(group.id)}`, { method: "DELETE" });
            progress.setProgress(72, "Refreshing group list...");
            await refreshGroups();
          },
          "Group deleted successfully."
        );
        notice("success", "Group Deleted", `${group.name} was removed.`);
      });
      wrap.appendChild(card);
    });
  }

  function renderDeviceControlPanel() {
    const wrap = byId("enterpriseDeviceControlList");
    if (!wrap) return;
    const search = String(byId("enterpriseDeviceSearch")?.value || "").trim().toLowerCase();
    const selected = new Set(state.selectedDevices);
    const rows = state.devices.filter((device) => {
      if (!search) return true;
      const haystack = [
        device.deviceId,
        device.name,
        device.ip,
        device.appVersion,
        device.meta?.appVersion,
        formatOrigin(device),
        device.online ? "online" : "offline",
      ].join(" ").toLowerCase();
      return haystack.includes(search);
    });
    if (!rows.length) {
      wrap.innerHTML = `<div class="enterprise-meta">No devices match the current search.</div>`;
      updateSelectedDeviceMeta();
      return;
    }
    wrap.innerHTML = rows.map((device) => `
      <button class="enterprise-device-card ${selected.has(device.deviceId) ? "is-selected" : ""}" type="button" data-device-card="${device.deviceId}">
        <div class="enterprise-device-card-head">
          <span class="enterprise-device-name">${device.name || device.deviceId}</span>
          <span class="enterprise-badge ${device.online ? "online" : "offline"}">${device.online ? "Online" : "Offline"}</span>
        </div>
        <div class="enterprise-device-meta">${[
          `ID: ${device.deviceId}`,
          device.ip ? `IP: ${device.ip}` : "",
          formatOrigin(device) ? `Access: ${formatOrigin(device)}` : "",
          device.meta?.appVersion ? `App: ${device.meta.appVersion}` : "",
          device.meta?.freeBytes || device.meta?.totalBytes ? `Storage: ${formatBytes(device.meta?.freeBytes)} free / ${formatBytes(device.meta?.totalBytes)} total` : "",
        ].filter(Boolean).join("\n")}</div>
      </button>
    `).join("");
    Array.from(wrap.querySelectorAll("[data-device-card]")).forEach((button) => {
      button.addEventListener("click", async () => {
        const deviceId = String(button.getAttribute("data-device-card") || "").trim();
        if (!deviceId) return;
        if (state.selectedDevices.has(deviceId)) state.selectedDevices.delete(deviceId);
        else state.selectedDevices.add(deviceId);
        clearActiveGroupSelection();
        await applySelectedDevices(state.selectedDevices);
      });
    });
    updateSelectedDeviceMeta();
  }

  function renderQueue() {
    const summary = byId("enterpriseQueueSummary");
    const list = byId("enterpriseQueueList");
    const logs = byId("enterpriseLogs");
    if (!summary || !list || !logs) return;
    if (!state.queue) {
      summary.textContent = "Queue state unavailable.";
      list.innerHTML = "";
      logs.innerHTML = "";
      return;
    }
    summary.textContent = `Paused: ${state.queue.paused ? "Yes" : "No"} | Pending: ${(state.queue.jobs || []).length} | History: ${(state.queue.history || []).length}`;
    byId("enterpriseConcurrency").value = String(state.queue.settings?.maxConcurrentUploads || 3);
    byId("enterpriseGroupSize").value = String(state.queue.settings?.groupSize || 5);
    const jobs = Array.isArray(state.queue.jobs) ? state.queue.jobs : [];
    const history = Array.isArray(state.queue.history) ? state.queue.history : [];
    const rows = jobs.length ? jobs : history;
    list.innerHTML = rows.length
      ? rows.slice(0, 12).map((job) => `
          <div class="enterprise-log-item">
            <strong>${job.name || job.jobId || "Upload Job"}</strong>
            <div class="enterprise-meta">${job.status || "queued"}${job.jobId ? ` | ${job.jobId}` : ""}</div>
          </div>
        `).join("")
      : `<div class="enterprise-meta">No queue jobs yet. Enterprise uploads run with the current TV-hosted upload engine.</div>`;
    logs.innerHTML = Array.isArray(state.logs) && state.logs.length
      ? state.logs.slice(0, 20).map((log) => `
          <div class="enterprise-log-item">
            <strong>${log.title || "Log"}</strong>
            <div class="enterprise-meta">${log.message || ""}</div>
          </div>
        `).join("")
      : `<div class="enterprise-meta">No upload/system logs yet.</div>`;
  }

  async function refreshSession() {
    const data = await fetchJson(`/api/auth/session?ts=${Date.now()}`);
    const meta = byId("authSessionMeta");
    if (!meta) return;
    meta.textContent = data.authenticated
      ? "Default CMS password is fixed to 0408."
      : "Default CMS password is fixed to 0408.";
  }

  async function refreshDevices(options = {}) {
    if (typeof window.__cmsLoadDevices === "function") {
      await window.__cmsLoadDevices(options);
    }
    if (typeof window.__cmsLoadDeviceAlerts === "function") {
      await window.__cmsLoadDeviceAlerts(options);
    }
    refreshDeviceStateFromApp();
    renderDevicePicker("enterpriseDevicePicker");
    renderDevicePicker("enterpriseBulkTargets");
    renderDevicePicker("enterpriseUploadTargets");
    renderDeviceControlPanel();
    await syncActiveGroupSelection();
  }

  async function refreshGroups() {
    const data = await fetchJson(`/api/groups?ts=${Date.now()}`);
    state.groups = enrichGroupsFromCurrentDevices(Array.isArray(data.groups) ? data.groups : []);
    if (!state.activeGroupId) {
      state.activeGroupId = loadActiveGroupId();
    }
    if (state.activeGroupId && !state.groups.some((item) => item.id === state.activeGroupId)) {
      state.activeGroupId = "";
      persistActiveGroupId("");
    }
    renderGroups();
    await syncActiveGroupSelection();
  }

  async function refreshQueue() {
    const data = await fetchJson(`/api/upload-queue?ts=${Date.now()}`);
    state.queue = data.queue || null;
    state.logs = Array.isArray(data.logs) ? data.logs : [];
    renderQueue();
  }

  async function refreshAll(options = {}) {
    if (!state.authenticated) return;
    await Promise.allSettled([refreshSession(), refreshDevices(options), refreshGroups(), refreshQueue()]);
  }

  async function saveGroup() {
    const name = String(byId("enterpriseGroupName")?.value || "").trim();
    const selectedDevices = Array.from(state.selectedDevices);
    if (!name) {
      notice("warning", "Group Name Required", "Enter a group name first.");
      return;
    }
    if (!selectedDevices.length) {
      notice("warning", "No Devices Selected", "Select at least one device for the group.");
      return;
    }
    if (selectedDevices.length > 5) {
      notice("warning", "Group Limit Reached", "A group can include up to 5 devices only.");
      return;
    }
    const saved = await runGroupActionProgress(
      state.editingGroupId ? `Updating group ${name}` : `Saving group ${name}`,
      async (progress) => {
        progress.setProgress(24, "Sending group data...");
        const response = await fetchJson("/api/groups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: state.editingGroupId,
            name,
            devices: selectedDevices,
          }),
        });
        progress.setProgress(72, "Refreshing group list...");
        await refreshGroups();
        return response;
      },
      "Group saved successfully."
    );
    state.editingGroupId = "";
    state.activeGroupId = String(saved?.group?.id || "").trim();
    persistActiveGroupId(state.activeGroupId);
    byId("enterpriseGroupName").value = "";
    closeManageModal();
    notice("success", "Group Saved", `${name} is ready.`);
  }

  async function sendPresetAction(kind) {
    refreshDeviceStateFromApp();
    syncSelectedDevicesFromMainUi();
    const selected = getCommandTargetEntries();
    if (!selected.length) {
      notice("warning", "No Online Device Selected", "Select at least one online device first.");
      return;
    }

    let action = kind;
    const payload = {};
    if (kind === "mute-on" || kind === "mute-off") {
      action = "mute";
      payload.enabled = kind === "mute-on";
    } else if (kind === "volume-up" || kind === "volume-down") {
      action = "volume-step";
      payload.delta = kind === "volume-up" ? 1 : -1;
    } else if (kind === "kiosk-on" || kind === "kiosk-off") {
      action = "kiosk-toggle";
      payload.enabled = kind === "kiosk-on";
    } else if (kind === "auto-start-on" || kind === "auto-start-off") {
      action = "auto-start-on-boot";
      payload.enabled = kind === "auto-start-on";
    } else if (kind === "orientation") {
      payload.orientation = String(byId("enterpriseOrientationValue")?.value || "horizontal");
    } else if (kind === "volume") {
      payload.volume = Number(byId("enterpriseVolumeValue")?.value || 50);
    } else if (kind === "brightness") {
      payload.brightness = Number(byId("enterpriseBrightnessValue")?.value || 50);
    }
    if (action === "refresh-content") {
      try {
        await runRefreshContentWithProgress(selected);
      } catch (error) {
        notice("error", "Sync Failed", String(error?.message || "Unable to send the sync command."));
      }
      return;
    }
    const requests = selected.map((device) =>
      fetchJson(`${getDeviceOrigin(device)}/config/bulk-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, payload }),
      })
    );
    void Promise.allSettled(requests).then((results) => {
      const failed = results.find((item) => item.status === "rejected");
      if (failed && failed.status === "rejected") {
        notice("error", "Command Failed", String(failed.reason?.message || "Unable to send the command."));
        return;
      }
      void refreshDevices();
    });
  }

  async function renameDevice() {
    const selected = getSelectedDeviceEntries();
    const nextName = String(byId("enterpriseRenameValue")?.value || "").trim();
    if (selected.length !== 1) {
      notice("warning", "Single Device Required", "Select exactly one device to rename.");
      return;
    }
    if (!nextName) {
      notice("warning", "Device Name Required", "Enter the new device name first.");
      return;
    }
    const targetOrigin = getDeviceOrigin(selected[0]);
    await fetchJson(`${targetOrigin}/config/rename-device`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceName: nextName }),
    });
    byId("enterpriseRenameValue").value = "";
    await refreshDevices();
    await refreshGroups();
    notice("success", "Device Renamed", `Device renamed to ${nextName}.`);
  }

  async function saveAccessOverride(preferredOnly) {
    const selected = getSelectedDeviceEntries();
    if (!selected.length) {
      notice("warning", "Device Required", "Select at least one device first.");
      return;
    }
    if (!preferredOnly && selected.length !== 1) {
      notice("warning", "Single Device Required", "Select exactly one device to save a manual access URL.");
      return;
    }
    const device = selected[0];
    const accessUrl = String(byId("enterpriseAccessUrlValue")?.value || "").trim();
    const preferredPort = Number(byId("enterprisePreferredPortValue")?.value || 0);
    const targets = preferredOnly ? selected : [device];
    await Promise.all(targets.map(async (item) => {
      const nextOrigin = computeOriginForUpdate(item, preferredOnly ? "" : accessUrl, preferredPort);
      await fetchJson(`${formatOrigin(item)}/config/access-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessUrl: preferredOnly ? "" : accessUrl,
          preferredPort,
        }),
      });
      await fetchJson("/api/access-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deviceId: item.deviceId,
          origin: nextOrigin,
          preferredPort,
        }),
      });
    }));
    notice("success", "Access Updated", preferredOnly
      ? `Preferred port ${preferredPort} applied to ${targets.length} device(s). Devices will rebind on the new port.`
      : `Access URL saved as ${computeOriginForUpdate(device, accessUrl, preferredPort)}.`);
    await refreshAll();
  }

  async function uploadMedia() {
    const files = Array.from(byId("enterpriseUploadFiles")?.files || []);
    const selected = getSelectedDeviceEntries();
    const section = Number(byId("enterpriseUploadSection")?.value || 1);
    if (!files.length) {
      notice("warning", "Files Required", "Choose files first.");
      return;
    }
    if (!selected.length) {
      notice("warning", "No Targets Selected", "Select at least one device.");
      return;
    }
    const targetInput = byId(`media${section}`);
    if (!targetInput) {
      notice("error", "Upload Input Missing", "Section upload control not found.");
      return;
    }
    const previousOrigins = typeof window.__cmsGetSelectedOrigins === "function"
      ? window.__cmsGetSelectedOrigins()
      : [];
    const dt = new DataTransfer();
    files.forEach((file) => dt.items.add(file));
    targetInput.files = dt.files;
    await syncSelectedOriginsToMainUi();
    try {
      await window.__cmsUploadSection(section);
      byId("enterpriseUploadResult").textContent = `Uploaded ${files.length} file(s) to ${selected.length} device(s) on section ${section}.`;
      await refreshQueue();
    } finally {
      if (typeof window.__cmsSetSelectedOrigins === "function") {
        await window.__cmsSetSelectedOrigins(previousOrigins);
      }
    }
  }

  async function saveQueueSettings() {
    await fetchJson("/api/upload-queue/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        maxConcurrentUploads: Number(byId("enterpriseConcurrency")?.value || 3),
        groupSize: Number(byId("enterpriseGroupSize")?.value || 5),
      }),
    });
    await refreshQueue();
    notice("success", "Queue Settings Saved", "Upload concurrency and group size updated.");
  }

  async function pauseQueue() {
    await fetchJson("/api/upload-queue/pause", { method: "POST" });
    await refreshQueue();
    notice("success", "Queue Paused", "Queue state saved for this TV-hosted CMS.");
  }

  async function resumeQueue() {
    await fetchJson("/api/upload-queue/resume", { method: "POST" });
    await refreshQueue();
    notice("success", "Queue Resumed", "Queue processing resumed.");
  }

  async function exportBackup() {
    const data = await fetchJson("/api/backup/export");
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `embedded-signage-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    byId("enterpriseBackupMeta").textContent = `Exported ${new Date(data.exportedAt).toLocaleString()}`;
  }

  async function restoreBackup() {
    const file = byId("enterpriseRestoreFile")?.files?.[0];
    if (!file) {
      notice("warning", "Backup File Required", "Choose a backup JSON file first.");
      return;
    }
    const raw = await file.text();
    const parsed = JSON.parse(raw);
    await fetchJson("/api/backup/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: parsed }),
    });
    await refreshAll();
    notice("success", "Backup Restored", "Groups and access settings were restored.");
  }

  async function logout() {
    state.authenticated = false;
    closeManageModal();
    setAuthLocked(false, "");
  }

  async function changePassword() {
    notice("info", "Fixed Password", "CMS password is fixed to 0408.");
  }

  function openSecurity() {
    openManageModal("security");
  }

  async function quickApplyGroup() {
    const id = String(byId("compactGroupSelect")?.value || "").trim();
    if (!id) {
      clearActiveGroupSelection();
      notice("success", "Manual Targeting Enabled", "Group targeting is cleared. You can now select devices manually.");
      return;
    }
    const group = state.groups.find((item) => item.id === id);
    if (!group) {
      notice("warning", "Group Required", "Select a saved group first.");
      return;
    }
    await applyGroupSelection(group, { notify: true });
  }

  state.activeGroupId = loadActiveGroupId();

  async function login() {
    storeAuthPassword(FIXED_CMS_PASSWORD);
    state.authenticated = true;
    setAuthLocked(false, "");
    await refreshAll();
  }

  async function checkSession() {
    storeAuthPassword(FIXED_CMS_PASSWORD);
    state.authenticated = true;
    setAuthLocked(false, "");
    await refreshAll();
  }

  window.enterpriseRefreshAll = (options = {}) => refreshAll({
    forceScan: true,
    waitForScan: true,
    ...options,
  });
  window.enterpriseRefreshDevices = (options = {}) => refreshDevices({
    forceScan: true,
    waitForScan: true,
    ...options,
  });
  window.enterpriseRefreshGroups = refreshGroups;
  window.enterpriseSaveGroup = saveGroup;
  window.enterpriseSendPresetAction = sendPresetAction;
  window.enterpriseRenameDevice = renameDevice;
  window.enterpriseSaveAccessUrl = () => saveAccessOverride(false);
  window.enterpriseApplyPreferredPort = () => saveAccessOverride(true);
  window.enterpriseUploadMedia = uploadMedia;
  window.enterpriseSaveQueueSettings = saveQueueSettings;
  window.enterprisePauseQueue = pauseQueue;
  window.enterpriseResumeQueue = resumeQueue;
  window.enterpriseExportBackup = exportBackup;
  window.enterpriseRestoreBackup = restoreBackup;
  window.enterpriseLogout = logout;
  window.enterpriseChangePassword = changePassword;
  window.enterpriseOpenSecurity = openSecurity;
  window.enterpriseLogin = login;
  window.enterpriseGetAuthPassword = getStoredAuthPassword;
  window.enterpriseQuickApplyGroup = quickApplyGroup;
  window.enterpriseOpenManageModal = openManageModal;
  window.enterpriseCloseManageModal = closeManageModal;

  document.addEventListener("DOMContentLoaded", () => {
    byId("enterpriseGroupSearch")?.addEventListener("input", renderGroups);
    byId("enterpriseDeviceSearch")?.addEventListener("input", renderDeviceControlPanel);
    byId("compactGroupSelect")?.addEventListener("change", async (event) => {
      const id = String(event?.target?.value || "").trim();
      if (!id) {
        clearActiveGroupSelection();
        return;
      }
      const group = state.groups.find((item) => item.id === id);
      if (group) {
        await applyGroupSelection(group);
      }
    });
    byId("cmsLoginPassword")?.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        login();
      }
    });
    checkSession();
    setInterval(() => {
      if (!state.authenticated) return;
      refreshQueue().catch(() => {});
      refreshDevices().catch(() => {});
      refreshGroups().catch(() => {});
    }, 15000);
  });
})();

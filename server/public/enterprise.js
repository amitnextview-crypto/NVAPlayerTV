(function enterpriseCms() {
  const state = {
    groups: [],
    devices: [],
    queue: null,
    selectedDevices: new Set(),
    editingGroupId: "",
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function notice(type, title, message, duration) {
    if (window.__cmsShowNotice) {
      window.__cmsShowNotice(type, title, message, duration);
      return;
    }
    window.alert(`${title}\n\n${message}`);
  }

  async function confirmDialog(title, message, confirmText, cancelText) {
    if (window.__cmsShowConfirmDialog) {
      return window.__cmsShowConfirmDialog(title, message, confirmText, cancelText);
    }
    return window.confirm(`${title}\n\n${message}`);
  }

  async function fetchJson(url, options) {
    const res = await fetch(url, {
      credentials: "same-origin",
      ...options,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(data?.error || data?.message || `HTTP ${res.status}`));
    }
    return data;
  }

  function getDeviceMap() {
    return new Map(state.devices.map((device) => [device.deviceId, device]));
  }

  function getSelectedDeviceEntries() {
    const deviceMap = getDeviceMap();
    return Array.from(state.selectedDevices)
      .map((deviceId) => deviceMap.get(deviceId))
      .filter(Boolean);
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

  function updateSelectedDeviceMeta() {
    const meta = byId("enterpriseSelectedDeviceMeta");
    if (!meta) return;
    const selected = getSelectedDeviceEntries();
    if (!selected.length) {
      meta.textContent = "Select one or more devices to control and rename.";
      return;
    }
    if (selected.length === 1) {
      const [device] = selected;
      meta.textContent = [
        `${device.name || device.deviceId} (${device.deviceId})`,
        device.ip ? `IP: ${device.ip}` : "",
        device.appVersion ? `App: ${device.appVersion}` : "",
        device.freeBytes || device.totalBytes ? `Storage: ${formatBytes(device.freeBytes)} free / ${formatBytes(device.totalBytes)} total` : "",
      ].filter(Boolean).join(" | ");
      return;
    }
    const online = selected.filter((item) => item.online).length;
    meta.textContent = `${selected.length} devices selected | ${online} online | ${selected.length - online} offline`;
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
          device.appVersion ? `App: ${device.appVersion}` : "",
          device.freeBytes || device.totalBytes ? `Storage: ${formatBytes(device.freeBytes)} free / ${formatBytes(device.totalBytes)} total` : "",
          device.cacheBytes ? `Cache: ${formatBytes(device.cacheBytes)}` : "",
        ].filter(Boolean).join("\n")}</div>
      </button>
    `).join("");
    Array.from(wrap.querySelectorAll("[data-device-card]")).forEach((button) => {
      button.addEventListener("click", () => {
        const deviceId = String(button.getAttribute("data-device-card") || "").trim();
        if (!deviceId) return;
        if (state.selectedDevices.has(deviceId)) {
          state.selectedDevices.delete(deviceId);
        } else {
          state.selectedDevices.add(deviceId);
        }
        renderDevicePicker("enterpriseDevicePicker");
        renderDevicePicker("enterpriseBulkTargets");
        renderDevicePicker("enterpriseUploadTargets");
        renderDeviceControlPanel();
        updateSelectedDeviceMeta();
      });
    });
    updateSelectedDeviceMeta();
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
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          selected.add(device.deviceId);
        } else {
          selected.delete(device.deviceId);
        }
        if (targetId === "enterpriseDevicePicker") {
          renderDevicePicker("enterpriseBulkTargets");
          renderDevicePicker("enterpriseUploadTargets");
        }
        renderDeviceControlPanel();
        updateSelectedDeviceMeta();
      });
      wrap.appendChild(row);
    });
  }

  function renderGroups() {
    const wrap = byId("enterpriseGroupsList");
    if (!wrap) return;
    const search = String(byId("enterpriseGroupSearch")?.value || "").trim().toLowerCase();
    const deviceMap = getDeviceMap();
    const list = state.groups.filter((group) => {
      if (!search) return true;
      const deviceNames = (group.devices || [])
        .map((device) => device?.name || device?.deviceId || deviceMap.get(device)?.name || device)
        .join(" ")
        .toLowerCase();
      return group.name.toLowerCase().includes(search) || deviceNames.includes(search);
    });
    if (!list.length) {
      wrap.innerHTML = `<div class="enterprise-meta">No groups found.</div>`;
      return;
    }
    wrap.innerHTML = "";
    list.forEach((group) => {
      const card = document.createElement("div");
      card.className = "enterprise-group-card";
      const deviceNames = (group.devices || [])
        .map((device) => device.name || device.deviceId)
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
      card.querySelector('[data-action="edit"]').addEventListener("click", () => {
        state.editingGroupId = group.id;
        byId("enterpriseGroupName").value = group.name;
        state.selectedDevices = new Set((group.devices || []).map((item) => item.deviceId || item));
        renderDevicePicker("enterpriseDevicePicker");
        renderDevicePicker("enterpriseBulkTargets");
        renderDevicePicker("enterpriseUploadTargets");
      });
      card.querySelector('[data-action="select"]').addEventListener("click", () => {
        state.selectedDevices = new Set((group.devices || []).map((item) => item.deviceId || item));
        renderDevicePicker("enterpriseDevicePicker");
        renderDevicePicker("enterpriseBulkTargets");
        renderDevicePicker("enterpriseUploadTargets");
        notice("success", "Group Selected", `${group.name} loaded into the target selectors.`);
      });
      card.querySelector('[data-action="delete"]').addEventListener("click", async () => {
        const yes = await confirmDialog("Delete Group", `Delete group "${group.name}"?`, "Delete", "Cancel");
        if (!yes) return;
        await fetchJson(`/api/groups/${encodeURIComponent(group.id)}`, { method: "DELETE" });
        await refreshGroups();
        notice("success", "Group Deleted", `${group.name} was removed.`);
      });
      wrap.appendChild(card);
    });
  }

  function renderQueue() {
    const summary = byId("enterpriseQueueSummary");
    const list = byId("enterpriseQueueList");
    if (!summary || !list) return;
    if (!state.queue) {
      summary.textContent = "Queue state unavailable.";
      list.innerHTML = "";
      return;
    }
    const queue = state.queue;
    summary.textContent = `Paused: ${queue.paused ? "Yes" : "No"} | Pending: ${queue.jobs.length} | History: ${queue.history.length}`;
    byId("enterpriseConcurrency").value = String(queue.settings?.maxConcurrentUploads || 3);
    byId("enterpriseGroupSize").value = String(queue.settings?.groupSize || 5);
    const rows = [...(queue.jobs || []), ...(queue.history || []).slice(0, 10)];
    if (!rows.length) {
      list.innerHTML = `<div class="enterprise-meta">No queue jobs yet.</div>`;
      return;
    }
    list.innerHTML = rows.map((job) => `
      <div class="enterprise-log-item" data-job-id="${job.id || ""}">
        <strong>${job.fileName || "Upload job"}</strong>
        <div class="enterprise-meta">Status: ${job.status || "pending"} | Section: ${job.section || 1} | Targets: ${(job.targets || []).length}</div>
        <div class="enterprise-meta">Progress: ${Number(job.overallProgress || 0)}%</div>
        <div class="enterprise-meta">Results: ${
          Array.isArray(job.results)
            ? [
                `${job.results.filter((item) => item.status === "success").length} success`,
                `${job.results.filter((item) => item.status === "failed").length} failed`,
                `${job.results.filter((item) => item.status === "skipped").length} skipped`,
                `${job.results.filter((item) => item.status === "uploading").length} uploading`,
              ].join(" | ")
            : "No target results yet"
        }</div>
        ${["failed", "partial"].includes(String(job.status || "")) ? '<div class="enterprise-actions-row"><button class="btn warning" type="button" data-retry-job="1">Retry Failed Only</button></div>' : ""}
      </div>
    `).join("");
    Array.from(list.querySelectorAll("[data-retry-job='1']")).forEach((btn) => {
      btn.addEventListener("click", async () => {
        const card = btn.closest("[data-job-id]");
        const jobId = String(card?.getAttribute("data-job-id") || "").trim();
        if (!jobId) return;
        await retryFailed(jobId);
      });
    });
  }

  function renderLogs() {
    const wrap = byId("enterpriseLogs");
    if (!wrap) return;
    const logs = state.queue?.logs || [];
    if (!logs.length) {
      wrap.innerHTML = `<div class="enterprise-meta">No upload/system logs yet.</div>`;
      return;
    }
    wrap.innerHTML = logs.slice(0, 20).map((log) => `
      <div class="enterprise-log-item">
        <strong>${log.message}</strong>
        <div class="enterprise-meta">${new Date(log.time).toLocaleString()}</div>
      </div>
    `).join("");
  }

  async function refreshDevices() {
    const list = await fetchJson(`/device-status?ts=${Date.now()}`);
    state.devices = Array.isArray(list)
      ? list.map((item) => ({
          deviceId: item.deviceId,
          name: item.meta?.deviceName || item.meta?.name || item.deviceId,
          online: !!item.online,
          ip: item.ip || item.meta?.ip || "",
          appVersion: item.meta?.appVersion || "",
          freeBytes: Number(item.meta?.freeBytes || 0),
          totalBytes: Number(item.meta?.totalBytes || 0),
          cacheBytes: Number(item.meta?.cacheBytes || 0),
          mediaBytes: Number(item.meta?.mediaBytes || 0),
          network: item.meta?.networkState || null,
        }))
      : [];
    renderDevicePicker("enterpriseDevicePicker");
    renderDevicePicker("enterpriseBulkTargets");
    renderDevicePicker("enterpriseUploadTargets");
    renderDeviceControlPanel();
    updateSelectedDeviceMeta();
  }

  async function refreshGroups() {
    const data = await fetchJson(`/api/groups?ts=${Date.now()}`);
    state.groups = Array.isArray(data.groups) ? data.groups : [];
    renderGroups();
  }

  async function refreshQueue() {
    state.queue = await fetchJson(`/api/upload-queue?ts=${Date.now()}`);
    renderQueue();
    renderLogs();
  }

  async function refreshSession() {
    const data = await fetchJson(`/api/auth/session?ts=${Date.now()}`);
    const meta = byId("authSessionMeta");
    if (!meta) return;
    if (!data.authenticated) {
      meta.textContent = "Not authenticated. Reload page to login.";
      return;
    }
    meta.textContent = `Authenticated. Auto logout after ${Math.round((data.inactivityTimeoutMs || 0) / 60000)} minutes of inactivity.`;
  }

  async function refreshAll() {
    await Promise.allSettled([refreshSession(), refreshDevices(), refreshGroups(), refreshQueue()]);
  }

  async function saveGroup() {
    const name = String(byId("enterpriseGroupName")?.value || "").trim();
    const deviceIds = Array.from(state.selectedDevices);
    if (!name) {
      notice("warning", "Group Name Required", "Enter a group name first.");
      return;
    }
    if (!deviceIds.length) {
      notice("warning", "No Devices Selected", "Select at least one device for the group.");
      return;
    }
    await fetchJson("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: state.editingGroupId || undefined,
        name,
        devices: deviceIds,
      }),
    });
    state.editingGroupId = "";
    byId("enterpriseGroupName").value = "";
    await refreshGroups();
    notice("success", "Group Saved", `${name} has been saved.`);
  }

  async function autoCreateGroups() {
    if (!state.selectedDevices.size) {
      notice("warning", "No Devices Selected", "Select devices first to auto-create groups.");
      return;
    }
    await fetchJson("/api/groups/auto-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        devices: Array.from(state.selectedDevices),
        groupSize: Number(byId("enterpriseGroupSize")?.value || 5),
      }),
    });
    await refreshGroups();
    notice("success", "Groups Created", "Auto groups were created from selected devices.");
  }

  async function runBulkAction() {
    const action = String(byId("enterpriseBulkAction")?.value || "").trim();
    const value = String(byId("enterpriseBulkValue")?.value || "").trim();
    const deviceIds = Array.from(state.selectedDevices);
    if (!deviceIds.length) {
      notice("warning", "No Targets Selected", "Select at least one target device.");
      return;
    }
    const payload = {};
    if (value) payload.value = value;
    if (action === "orientation") payload.orientation = value || "horizontal";
    if (action === "volume") payload.volume = Number(value || 0);
    if (action === "brightness") payload.brightness = Number(value || 0);
    if (action === "mute") payload.enabled = value === "true" || value === "1" || value === "on";

    const body = {
      action,
      deviceIds,
      payload,
    };
    if (action === "apply-config" && window.__cmsBuildConfig) {
      body.config = window.__cmsBuildConfig();
    }
    await fetchJson("/config/bulk-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    notice("success", "Bulk Action Sent", `${action} was sent to ${deviceIds.length} device(s).`);
  }

  async function sendPresetAction(kind) {
    const deviceIds = Array.from(state.selectedDevices);
    if (!deviceIds.length) {
      notice("warning", "No Targets Selected", "Select at least one device first.");
      return;
    }

    let action = kind;
    const payload = {};
    if (kind === "mute-on" || kind === "mute-off") {
      action = "mute";
      payload.enabled = kind === "mute-on";
    } else if (kind === "kiosk-on" || kind === "kiosk-off") {
      action = "kiosk-toggle";
      payload.enabled = kind === "kiosk-on";
    } else if (kind === "auto-start-on" || kind === "auto-start-off") {
      action = "auto-start-on-boot";
      payload.enabled = kind === "auto-start-on";
    } else if (kind === "orientation") {
      payload.orientation = String(byId("enterpriseOrientationValue")?.value || "horizontal");
    } else if (kind === "volume") {
      payload.volume = Number(byId("enterpriseVolumeValue")?.value || 0);
    } else if (kind === "brightness") {
      payload.brightness = Number(byId("enterpriseBrightnessValue")?.value || 50);
    }

    await fetchJson("/config/bulk-action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, deviceIds, payload }),
    });
    notice("success", "Command Sent", `${action} was sent to ${deviceIds.length} device(s).`);
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
    await fetchJson("/config/rename-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetDevice: selected[0].deviceId,
        deviceName: nextName,
      }),
    });
    byId("enterpriseRenameValue").value = "";
    await refreshDevices();
    await refreshGroups();
    notice("success", "Device Renamed", `Device renamed to ${nextName}.`);
  }

  async function uploadMedia() {
    const files = Array.from(byId("enterpriseUploadFiles")?.files || []);
    const deviceIds = Array.from(state.selectedDevices);
    const section = Number(byId("enterpriseUploadSection")?.value || 1);
    if (!files.length) {
      notice("warning", "Files Required", "Choose files first.");
      return;
    }
    if (!deviceIds.length) {
      notice("warning", "No Targets Selected", "Select at least one device.");
      return;
    }
    const form = new FormData();
    files.forEach((file) => form.append("files", file));
    form.append("deviceIds", deviceIds.join(","));
    form.append("options", JSON.stringify({
      skipOfflineDevices: !!byId("enterpriseSkipOffline")?.checked,
      skipIfSameExists: !!byId("enterpriseSkipDuplicate")?.checked,
      maxConcurrentUploads: Number(byId("enterpriseConcurrency")?.value || 3),
    }));
    const res = await fetch(`/upload/enterprise/section/${section}`, {
      method: "POST",
      body: form,
      credentials: "same-origin",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(String(data?.error || "Enterprise upload failed"));
    }
    byId("enterpriseUploadResult").textContent = `Job ${data.jobId || ""} queued. Upload will continue in the enterprise queue with pause/resume and retry support.`;
    await refreshQueue();
    notice("success", "Enterprise Upload Started", `Upload queued for section ${section}.`);
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
    notice("success", "Queue Paused", "New queue jobs will stay paused.");
  }

  async function resumeQueue() {
    await fetchJson("/api/upload-queue/resume", { method: "POST" });
    await refreshQueue();
    notice("success", "Queue Resumed", "Queue processing resumed.");
  }

  async function retryFailed(jobId) {
    await fetchJson(`/api/upload-queue/retry-failed/${encodeURIComponent(jobId)}`, {
      method: "POST",
    });
    await refreshQueue();
    notice("success", "Retry Started", "Failed targets were re-queued.");
  }

  async function exportBackup() {
    const data = await fetchJson("/api/backup/export");
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signage-backup-${Date.now()}.json`;
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
    notice("success", "Backup Restored", "Groups and queue settings were restored.");
  }

  async function logout() {
    await fetchJson("/api/auth/logout", { method: "POST" });
    window.location.href = "/lock";
  }

  async function changePassword() {
    const currentPassword = String(byId("cmsCurrentPassword")?.value || "");
    const nextPassword = String(byId("cmsNewPassword")?.value || "");
    if (!currentPassword || !nextPassword) {
      notice("warning", "Password Required", "Fill both current and new password fields.");
      return;
    }
    await fetchJson("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, nextPassword }),
    });
    notice("success", "Password Changed", "Password updated. Please login again.", 5000);
    setTimeout(() => {
      window.location.href = "/lock";
    }, 800);
  }

  function openSecurity() {
    byId("enterpriseSecurityCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
    byId("cmsCurrentPassword")?.focus();
  }

  window.enterpriseRefreshAll = refreshAll;
  window.enterpriseRefreshDevices = refreshDevices;
  window.enterpriseRefreshGroups = refreshGroups;
  window.enterpriseSaveGroup = saveGroup;
  window.enterpriseAutoCreateGroups = autoCreateGroups;
  window.enterpriseRunBulkAction = runBulkAction;
  window.enterpriseSendPresetAction = sendPresetAction;
  window.enterpriseRenameDevice = renameDevice;
  window.enterpriseUploadMedia = uploadMedia;
  window.enterpriseSaveQueueSettings = saveQueueSettings;
  window.enterprisePauseQueue = pauseQueue;
  window.enterpriseResumeQueue = resumeQueue;
  window.enterpriseExportBackup = exportBackup;
  window.enterpriseRestoreBackup = restoreBackup;
  window.enterpriseLogout = logout;
  window.enterpriseChangePassword = changePassword;
  window.enterpriseOpenSecurity = openSecurity;

  document.addEventListener("DOMContentLoaded", () => {
    byId("enterpriseGroupSearch")?.addEventListener("input", renderGroups);
    byId("enterpriseDeviceSearch")?.addEventListener("input", renderDeviceControlPanel);
    refreshAll();
    setInterval(() => {
      refreshQueue().catch(() => {});
      refreshDevices().catch(() => {});
      refreshGroups().catch(() => {});
    }, 15000);
  });
})();

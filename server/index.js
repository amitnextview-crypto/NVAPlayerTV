const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const os = require("os");
const { exec } = require("child_process");

// Runtime writable base path (user-local in pkg mode to avoid permission issues)
const runtimeBasePath = process.pkg
  ? path.join(
      process.env.LOCALAPPDATA ||
        process.env.APPDATA ||
        path.dirname(process.execPath),
      "NVA SignagePlayerTV"
    )
  : __dirname;

// Asset base path (__dirname points to snapshot when packed by pkg)
const assetBasePath = __dirname;

global.runtimeBasePath = runtimeBasePath;
global.assetBasePath = assetBasePath;

if (!fs.existsSync(runtimeBasePath)) {
  fs.mkdirSync(runtimeBasePath, { recursive: true });
}

const configRoutes = require("./routes/config");
const uploadRoutes = require("./routes/upload");
const mediaRoutes = require("./routes/media");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const CMS_PASSWORD = String(process.env.CMS_PASSWORD || "0408");
const CMS_API_KEY = String(process.env.CMS_API_KEY || "");
const CMS_AUTH_COOKIE = "cms_auth";

function parseCookies(req) {
  const header = String(req.headers?.cookie || "");
  if (!header) return {};
  return header.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

function isCmsAuthed(req) {
  const cookies = parseCookies(req);
  return cookies[CMS_AUTH_COOKIE] === "1";
}

function wantsHtml(req) {
  const accept = String(req.headers?.accept || "");
  return accept.includes("text/html");
}

function isApiAuthed(req) {
  if (isCmsAuthed(req)) return true;
  const headerPwd = String(req.headers?.["x-cms-password"] || "").trim();
  if (headerPwd && headerPwd === CMS_PASSWORD) return true;
  if (CMS_API_KEY) {
    const headerKey = String(req.headers?.["x-api-key"] || "").trim();
    const queryKey = String(req.query?.apiKey || "").trim();
    if (headerKey && headerKey === CMS_API_KEY) return true;
    if (queryKey && queryKey === CMS_API_KEY) return true;
  }
  return false;
}

function requireCmsAuth(req, res, next) {
  if (isApiAuthed(req)) return next();
  if (wantsHtml(req)) return res.redirect("/lock");
  return res.status(401).json({ ok: false, error: "unauthorized" });
}

app.get("/lock", (req, res) => {
  if (isCmsAuthed(req)) {
    return res.redirect("/");
  }
  const message = String(req.query?.error || "");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.status(200).send(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>CMS Locked</title>
    <style>
      :root {
        --bg: #0c0f14;
        --panel: #141a23;
        --panel-2: #0f141c;
        --border: #253041;
        --text: #e8edf5;
        --muted: #9aa6b2;
        --accent: #5ad2a4;
        --accent-2: #2ea0ff;
        --danger: #ff7b7b;
      }
      * { box-sizing: border-box; }
      body {
        margin:0;
        font-family: "Space Grotesk", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background:
          radial-gradient(1200px 800px at 10% 10%, rgba(90,210,164,.18), transparent 60%),
          radial-gradient(900px 600px at 90% 20%, rgba(46,160,255,.18), transparent 55%),
          var(--bg);
        color: var(--text);
      }
      .wrap { min-height:100vh; display:flex; align-items:center; justify-content:center; padding:28px; }
      .card {
        width:100%; max-width:520px;
        background: linear-gradient(180deg, rgba(20,26,35,.95), rgba(14,19,27,.96));
        border:1px solid var(--border);
        border-radius:16px;
        padding:28px;
        box-shadow: 0 24px 80px rgba(0,0,0,.45);
        position: relative;
        overflow: hidden;
      }
      .card::after {
        content:"";
        position:absolute;
        inset:-40% -20% auto auto;
        width:260px; height:260px;
        background: radial-gradient(circle, rgba(90,210,164,.25), transparent 70%);
        pointer-events:none;
      }
      .brand {
        display:flex; align-items:center; gap:12px; margin-bottom:14px;
      }
      .dot {
        width:10px; height:10px; border-radius:50%;
        background: var(--accent);
        box-shadow: 0 0 12px rgba(90,210,164,.8);
      }
      h1 { margin:0; font-size:24px; letter-spacing:.2px; }
      p { margin:6px 0 20px 0; color:var(--muted); font-size:14px; }
      .field {
        display:flex; align-items:center; gap:10px;
        background: var(--panel-2);
        border:1px solid var(--border);
        padding:10px 12px;
        border-radius:12px;
      }
      input {
        width:100%;
        background: transparent;
        border:none;
        color:var(--text);
        font-size:16px;
        outline:none;
      }
      button {
        margin-top:16px; width:100%;
        padding:12px 14px;
        border-radius:12px; border:none;
        background: linear-gradient(135deg, var(--accent), var(--accent-2));
        color:#091017; font-weight:700; font-size:16px;
        cursor:pointer;
      }
      .error { margin-top:12px; color:var(--danger); font-size:14px; }
      .footer { margin-top:18px; color:#6e7a88; font-size:12px; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <div class="card">
        <div class="brand"><span class="dot"></span><strong>Signage CMS</strong></div>
        <h1>Access Locked</h1>
        <p>Enter the CMS password to continue.</p>
        <form method="POST" action="/lock">
          <div class="field">
            <input type="password" name="password" placeholder="Password" autofocus />
          </div>
          <button type="submit">Unlock</button>
        </form>
        ${message ? `<div class="error">${message}</div>` : ""}
        <div class="footer">Unauthorized access is not permitted.</div>
      </div>
    </div>
  </body>
</html>`);
});

app.post("/lock", (req, res) => {
  const value = String(req.body?.password || "").trim();
  if (value && value === CMS_PASSWORD) {
    res.setHeader(
      "Set-Cookie",
      `${CMS_AUTH_COOKIE}=1; Path=/; HttpOnly; SameSite=Strict`
    );
    try {
      const indexPath = path.join(assetBasePath, "public", "index.html");
      const html = fs.readFileSync(indexPath, "utf8");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return res.status(200).send(html);
    } catch {
      return res.redirect("/");
    }
  }
  return res.redirect("/lock?error=Wrong%20password");
});

app.use((req, res, next) => {
  if (req.path.startsWith("/lock")) return next();
  if (req.method === "GET" && wantsHtml(req)) {
    return res.redirect("/lock");
  }
  return next();
});

app.use("/media-list", mediaRoutes);
app.use("/upload", requireCmsAuth, uploadRoutes);
app.use("/config", (req, res, next) => {
  if (req.method === "GET") return next();
  return requireCmsAuth(req, res, next);
}, configRoutes);
app.get("/ping", (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.json({ ok: true, time: Date.now() });
});
app.use(
  "/",
  express.static(path.join(assetBasePath, "public"), {
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      res.setHeader("Surrogate-Control", "no-store");
    },
  })
);
app.use(
  "/media",
  express.static(path.join(runtimeBasePath, "uploads"), {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".mp4")) {
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Accept-Ranges", "bytes");
        // Avoid long-lived device cache growth for large media.
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");
      }

      if (filePath.endsWith(".mov")) {
        res.setHeader("Content-Type", "video/mov");
        res.setHeader("Accept-Ranges", "bytes");
        // Avoid long-lived device cache growth for large media.
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");
      }

      if (filePath.endsWith(".webm")) {
        res.setHeader("Content-Type", "video/webm");
        res.setHeader("Accept-Ranges", "bytes");
        // Avoid long-lived device cache growth for large media.
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");
      }

      if (filePath.match(/\.(jpg|jpeg|png|pdf|txt)$/i)) {
        res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        res.setHeader("Surrogate-Control", "no-store");
      }
    },
  })
);

// Socket server
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

global.io = io;

// Connected devices + health state
const connectedDevices = {};
const deviceStatus = {};
const socketToDevice = {};
global.connectedDevices = connectedDevices;
global.deviceStatus = deviceStatus;

function nowIso() {
  return new Date().toISOString();
}

function upsertDeviceStatus(deviceId, patch = {}) {
  if (!deviceId) return;
  const prev = deviceStatus[deviceId] || {
    deviceId,
    online: false,
    lastSeen: null,
    lastError: null,
    lastErrorAt: null,
    lastDisconnectReason: null,
    lastDisconnectAt: null,
    appState: null,
    meta: null,
    recentEvents: [],
  };

  deviceStatus[deviceId] = {
    ...prev,
    ...patch,
    deviceId,
    lastSeen: nowIso(),
  };
}

function appendDeviceEvent(deviceId, type, message) {
  if (!deviceId) return;
  const prev = deviceStatus[deviceId] || { recentEvents: [] };
  const nextEvents = [
    ...(Array.isArray(prev.recentEvents) ? prev.recentEvents : []),
    {
      time: nowIso(),
      type: String(type || "runtime"),
      message: String(message || "").slice(0, 240),
    },
  ].slice(-20);
  upsertDeviceStatus(deviceId, { recentEvents: nextEvents });
}

io.on("connection", (socket) => {
  socket.on("register-device", (deviceId) => {
    connectedDevices[deviceId] = socket.id;
    socketToDevice[socket.id] = deviceId;
    upsertDeviceStatus(deviceId, {
      online: true,
      lastDisconnectReason: null,
      lastDisconnectAt: null,
      lastError: null,
      lastErrorAt: null,
      errorType: null,
    });
    appendDeviceEvent(deviceId, "socket", "Device connected");
    console.log("Device connected:", deviceId);
  });

  socket.on("device-health", (payload) => {
    const deviceId = String(payload?.deviceId || socketToDevice[socket.id] || "").trim();
    if (!deviceId) return;
    connectedDevices[deviceId] = socket.id;
    socketToDevice[socket.id] = deviceId;
    upsertDeviceStatus(deviceId, {
      online: true,
      appState: payload?.appState || null,
      meta: payload?.meta || null,
      lastError: null,
      lastErrorAt: null,
      errorType: null,
    });
    if (payload?.appState) {
      appendDeviceEvent(deviceId, "health", `State: ${String(payload.appState)}`);
    }
  });

  socket.on("device-error", (payload) => {
    const deviceId = String(payload?.deviceId || socketToDevice[socket.id] || "").trim();
    if (!deviceId) return;
    connectedDevices[deviceId] = socket.id;
    socketToDevice[socket.id] = deviceId;
    upsertDeviceStatus(deviceId, {
      online: true,
      lastError: payload?.message || payload?.error || "Unknown device error",
      lastErrorAt: nowIso(),
      errorType: payload?.type || "runtime",
    });
    appendDeviceEvent(
      deviceId,
      payload?.type || "runtime",
      payload?.message || payload?.error || "Unknown device error"
    );
  });

  socket.on("disconnect", (reason) => {
    for (const id of Object.keys(connectedDevices)) {
      if (connectedDevices[id] === socket.id) {
        delete connectedDevices[id];
        upsertDeviceStatus(id, {
          online: false,
          lastDisconnectReason: String(reason || "disconnect"),
          lastDisconnectAt: nowIso(),
        });
        appendDeviceEvent(id, "socket", `Disconnected: ${String(reason || "disconnect")}`);
        console.log("Device disconnected:", id);
      }
    }

    if (socketToDevice[socket.id]) {
      delete socketToDevice[socket.id];
    }
  });
});

// Connected device IDs
app.get("/devices", (req, res) => {
  if (!isApiAuthed(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  res.json(Object.keys(connectedDevices));
});

// Live health/error status for CMS
app.get("/device-status", (req, res) => {
  if (!isApiAuthed(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const list = Object.values(deviceStatus)
    .map((item) => ({
      ...item,
      online: !!connectedDevices[item.deviceId],
    }))
    .sort((a, b) => {
      if (a.online !== b.online) return a.online ? -1 : 1;
      const aTs = Date.parse(a.lastErrorAt || a.lastSeen || 0);
      const bTs = Date.parse(b.lastErrorAt || b.lastSeen || 0);
      return bTs - aTs;
    });

  res.json(list);
});

// Get active local IP
function getLocalIP() {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family !== "IPv4") continue;
      if (iface.internal) continue;
      if (iface.address.startsWith("169.")) continue;

      return iface.address;
    }
  }

  return "localhost";
}

// Start server
const PORT = 8080;

server.on("error", (err) => {
  if (err?.code === "EADDRINUSE") {
    console.log(`Port ${PORT} already in use. Opening existing CMS session.`);
    exec(`start http://localhost:${PORT}`);
    process.exit(0);
    return;
  }

  console.error("Server startup failed:", err);
  process.exit(1);
});

server.listen(PORT, "0.0.0.0", () => {
  const ip = getLocalIP();
  const url = `http://${ip}:${PORT}`;

  console.log(`CMS running on ${url}`);

  exec(`start ${url}`);
});

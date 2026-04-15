const crypto = require("crypto");
const path = require("path");
const { readJsonFile, writeJsonFile } = require("./jsonStore");

const basePath = process.pkg
  ? (global.runtimeBasePath || path.dirname(process.execPath))
  : path.join(__dirname, "..");

const DATA_FILE = path.join(basePath, "data", "cms-security.json");
const DEFAULT_PASSWORD = String(process.env.CMS_PASSWORD || "0408");
const SESSION_TTL_MS = 20 * 60 * 1000;
const SESSION_COOKIE = "cms_session";
const sessions = new Map();

function now() {
  return Date.now();
}

function randomToken(size = 32) {
  return crypto.randomBytes(size).toString("hex");
}

function pbkdf2Hash(password, salt, iterations = 120000) {
  const hash = crypto.pbkdf2Sync(String(password || ""), salt, iterations, 64, "sha512");
  return hash.toString("hex");
}

function createPasswordRecord(password) {
  const salt = randomToken(16);
  const iterations = 120000;
  return {
    algorithm: "pbkdf2-sha512",
    salt,
    iterations,
    hash: pbkdf2Hash(password, salt, iterations),
    updatedAt: new Date().toISOString(),
  };
}

function ensureSecurityState() {
  const current = readJsonFile(DATA_FILE, {});
  if (current?.password?.hash) return current;
  const next = {
    password: createPasswordRecord(DEFAULT_PASSWORD),
  };
  writeJsonFile(DATA_FILE, next);
  return next;
}

function readSecurityState() {
  return ensureSecurityState();
}

function verifyPassword(password) {
  const state = readSecurityState();
  const record = state?.password || {};
  const salt = String(record.salt || "");
  const iterations = Number(record.iterations || 120000);
  const expected = String(record.hash || "");
  if (!salt || !expected) return false;
  const actual = pbkdf2Hash(password, salt, iterations);
  try {
    return crypto.timingSafeEqual(Buffer.from(actual, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function changePassword(currentPassword, nextPassword) {
  if (!verifyPassword(currentPassword)) {
    return { ok: false, error: "current-password-invalid" };
  }
  const next = String(nextPassword || "").trim();
  if (next.length < 4 || next.length > 64) {
    return { ok: false, error: "password-length-invalid" };
  }
  const state = readSecurityState();
  state.password = createPasswordRecord(next);
  writeJsonFile(DATA_FILE, state);
  sessions.clear();
  return { ok: true };
}

function createSession(meta = {}) {
  const id = randomToken(24);
  const expiresAt = now() + SESSION_TTL_MS;
  sessions.set(id, {
    id,
    createdAt: now(),
    lastSeenAt: now(),
    expiresAt,
    meta: meta && typeof meta === "object" ? meta : {},
  });
  return {
    id,
    expiresAt,
    maxAgeMs: SESSION_TTL_MS,
  };
}

function getSession(sessionId) {
  const id = String(sessionId || "").trim();
  if (!id) return null;
  const session = sessions.get(id);
  if (!session) return null;
  if (session.expiresAt <= now()) {
    sessions.delete(id);
    return null;
  }
  session.lastSeenAt = now();
  session.expiresAt = now() + SESSION_TTL_MS;
  return session;
}

function destroySession(sessionId) {
  sessions.delete(String(sessionId || "").trim());
}

function cleanupExpiredSessions() {
  const ts = now();
  for (const [id, session] of sessions.entries()) {
    if (!session || session.expiresAt <= ts) {
      sessions.delete(id);
    }
  }
}

setInterval(cleanupExpiredSessions, 60 * 1000).unref?.();

module.exports = {
  SESSION_COOKIE,
  SESSION_TTL_MS,
  ensureSecurityState,
  verifyPassword,
  changePassword,
  createSession,
  getSession,
  destroySession,
};

"use strict";

const fs = require("fs");
const path = require("path");

const TRANSIENT_CODES = new Set(["EPERM", "EBUSY", "EACCES", "ENOTEMPTY", "EEXIST"]);
const DEFAULT_RETRIES = 5;
const DEFAULT_DELAY_MS = 80;

function isTransientError(err) {
  if (!err || typeof err !== "object") return false;
  const code = String(err.code || "").toUpperCase();
  return TRANSIENT_CODES.has(code);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Safe stat with retry on EPERM/EBUSY (Windows file locking).
 * Returns null if file missing or stat fails after retries.
 */
function safeStat(filePath, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRIES;
  for (let i = 0; i < retries; i++) {
    try {
      return fs.statSync(filePath);
    } catch (err) {
      if (!isTransientError(err) || i === retries - 1) return null;
    }
  }
  return null;
}

/** Async version for use with await and longer delays without blocking. */
async function safeStatAsync(filePath, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRIES;
  const delayMs = options.delayMs ?? DEFAULT_DELAY_MS;
  for (let i = 0; i < retries; i++) {
    try {
      const stat = await fs.promises.stat(filePath);
      return stat;
    } catch (err) {
      if (!isTransientError(err) || i === retries - 1) return null;
    }
    await wait(delayMs * (i + 1));
  }
  return null;
}

/**
 * Safe readdir with retry on EPERM/EBUSY.
 * Returns [] on failure after retries.
 */
function safeReaddir(dirPath, options = {}) {
  const retries = options.retries ?? DEFAULT_RETRIES;
  for (let i = 0; i < retries; i++) {
    try {
      return fs.readdirSync(dirPath);
    } catch (err) {
      if (!isTransientError(err) || i === retries - 1) return [];
    }
  }
  return [];
}

/**
 * Safe existsSync + isDirectory using safe stat (avoids EPERM on stat).
 */
function safeExistsDir(dirPath) {
  const stat = safeStat(dirPath);
  return stat != null && stat.isDirectory();
}

/**
 * Safe existsSync using safe stat.
 */
function safeExists(filePath) {
  return safeStat(filePath) != null;
}

module.exports = {
  isTransientError,
  wait,
  safeStat,
  safeStatAsync,
  safeReaddir,
  safeExistsDir,
  safeExists,
};

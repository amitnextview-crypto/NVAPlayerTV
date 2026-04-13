import RNFS from "react-native-fs";
import { NativeModules } from "react-native";
import { getServer } from "./serverService";

const { DeviceIdModule } = NativeModules as any;

const MEDIA_DIR = `${RNFS.DocumentDirectoryPath}/media`;
const MEDIA_ROOT = `${MEDIA_DIR}/files`;
const MANIFEST_PATH = `${MEDIA_DIR}/manifest.json`;
const LIST_CACHE_PATH = `${MEDIA_DIR}/list-cache.json`;
const MEDIA_FETCH_TIMEOUT_MS = 8000;
const MEDIA_FETCH_BACKOFF_BASE_MS = 1500;
const MEDIA_FETCH_BACKOFF_MAX_MS = 30000;
const DOWNLOAD_CONCURRENCY = 6;
const LARGE_MEDIA_BYTES = 300 * 1024 * 1024;
const LARGE_MEDIA_CONCURRENCY = 2;
const LIST_REFRESH_MIN_INTERVAL_MS = 3000;
const SMALL_FILE_AWAIT_BYTES = 5 * 1024 * 1024;
const DOWNLOAD_MAX_RETRIES = 5;
const DOWNLOAD_RETRY_DELAY_MS = 1500;
const DOWNLOAD_CONNECTION_TIMEOUT_MS = 30000;
const DOWNLOAD_READ_TIMEOUT_MS = 15 * 60 * 1000;
const DEFAULT_MIN_FREE_BYTES = 500 * 1024 * 1024;
const VIDEO_FILE_RE = /\.(mp4|m4v|mov|mkv|webm)(\?.*)?$/i;
const VIDEO_DOWNLOAD_CONCURRENCY = 2;
const CACHE_SUMMARY_TTL_MS = 3000;
const LOW_STORAGE_HARD_LIMIT_BYTES = 1200 * 1024 * 1024;
const LOW_STORAGE_SOFT_LIMIT_BYTES = 2200 * 1024 * 1024;
const LOW_STORAGE_SMALL_FILE_BYTES = 10 * 1024 * 1024;
const LOW_STORAGE_MEDIUM_FILE_BYTES = 24 * 1024 * 1024;
const LOW_STORAGE_VIDEO_FILE_BYTES = 40 * 1024 * 1024;
const LOW_STORAGE_ROOM_TOTAL_BYTES = 5 * 1024 * 1024 * 1024;

function getAdaptiveDownloadConcurrency(): number {
  try {
    const stats = DeviceIdModule?.getStorageStats?.();
    const freeBytes = Number(stats?.freeBytes || 0);
    if (!freeBytes || Number.isNaN(freeBytes)) return DOWNLOAD_CONCURRENCY;
    if (freeBytes < 1 * 1024 * 1024 * 1024) return Math.min(3, DOWNLOAD_CONCURRENCY);
    if (freeBytes < 3 * 1024 * 1024 * 1024) return Math.min(4, DOWNLOAD_CONCURRENCY);
    if (freeBytes < 8 * 1024 * 1024 * 1024) return Math.min(6, DOWNLOAD_CONCURRENCY);
    return DOWNLOAD_CONCURRENCY;
  } catch {
    return DOWNLOAD_CONCURRENCY;
  }
}

type CacheProgress = {
  received: number;
  total: number;
  percent: number;
  updatedAt: number;
};

const progressMap: Record<string, CacheProgress> = {};
const progressListeners = new Set<(path: string, progress: CacheProgress) => void>();
let downloadConcurrencyOverride: number | null = null;

export function subscribeCacheProgress(
  handler: (path: string, progress: CacheProgress) => void
) {
  progressListeners.add(handler);
  return () => progressListeners.delete(handler);
}

export function setDownloadConcurrencyOverride(value: number | null) {
  if (value === null || value === undefined) {
    downloadConcurrencyOverride = null;
    return;
  }
  const safeValue = Number(value);
  downloadConcurrencyOverride = Number.isFinite(safeValue) ? Math.max(1, safeValue) : null;
}

export function getCacheProgress(path: string): CacheProgress | null {
  return progressMap[path] || null;
}

function emitProgress(path: string, progress: CacheProgress) {
  progressMap[path] = progress;
  for (const listener of progressListeners) {
    try {
      listener(path, progress);
    } catch {
      // ignore
    }
  }
}

function invalidateCacheSummary() {
  cacheSummaryCache.at = 0;
}

function clearProgressForMissingPaths(activeUrls: Set<string>) {
  for (const key of Object.keys(progressMap)) {
    if (!activeUrls.has(key)) {
      delete progressMap[key];
    }
  }
}

function markCachedProgress(path: string, totalBytes = 0) {
  emitProgress(path, {
    total: Math.max(0, Number(totalBytes || 0)),
    received: Math.max(0, Number(totalBytes || 0)),
    percent: 100,
    updatedAt: Date.now(),
  });
}
// Short grace period avoids deleting files that might still be in active playback pipeline.
const CACHE_RETENTION_MS = 2 * 60 * 1000;

type MediaItem = {
  name?: string;
  originalName?: string;
  section?: number;
  url?: string;
  type?: string;
  page?: number;
  pageCount?: number;
  size?: number;
  mtimeMs?: number;
  hash?: string;
  remoteUrl?: string;
  localPath?: string;
};

type ManifestEntry = {
  url: string;
  localPath: string;
  size: number;
  mtimeMs: number;
  hash?: string;
  lastSeenAt?: number;
};

type ManifestMap = Record<string, ManifestEntry>;

let memoryListCache: MediaItem[] = [];
let memoryListCacheAtMs = 0;
let inFlightListRefresh: Promise<MediaItem[]> | null = null;
const inFlightDownloads = new Map<string, Promise<string | null>>();
let lastListEtag = "";
let prioritySection = 0;
let nonPriorityThrottleMs = 0;
let listBackoffFailCount = 0;
let listBackoffUntilMs = 0;
let lastBackoffLogAtMs = 0;
const lastMediaLogAtBySection: Record<number, number> = {};
const lastMediaLogKeyBySection: Record<number, string> = {};
let cacheSummaryCache = { at: 0, total: 0, cached: 0, percent: 0 };

function getListBackoffDelayMs(): number {
  const exp = Math.min(listBackoffFailCount, 6);
  const base = MEDIA_FETCH_BACKOFF_BASE_MS * Math.pow(2, exp);
  const jitter = Math.floor(Math.random() * 600);
  return Math.min(MEDIA_FETCH_BACKOFF_MAX_MS, base + jitter);
}

export function setPrioritySection(section: number) {
  const value = Number(section || 0);
  prioritySection = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export function setNonPriorityThrottleMs(ms: number) {
  const value = Number(ms || 0);
  nonPriorityThrottleMs = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

export async function resetMediaRuntimeState(options: { clearListCache?: boolean } = {}) {
  memoryListCache = [];
  memoryListCacheAtMs = 0;
  inFlightListRefresh = null;
  lastListEtag = "";
  listBackoffFailCount = 0;
  listBackoffUntilMs = 0;
  lastBackoffLogAtMs = 0;
  cacheSummaryCache = { at: 0, total: 0, cached: 0, percent: 0 };
  for (const key of Object.keys(progressMap)) {
    delete progressMap[key];
  }
  if (options.clearListCache) {
    try {
      if (await RNFS.exists(LIST_CACHE_PATH)) {
        await RNFS.unlink(LIST_CACHE_PATH);
      }
    } catch {
      // ignore cleanup errors
    }
  }
}

function mediaItemFingerprint(item: MediaItem): string {
  return [
    String(item?.url || ""),
    String(item?.remoteUrl || ""),
    String(item?.localPath || ""),
    String(item?.name || ""),
    String(item?.originalName || ""),
    String(item?.type || ""),
    Number(item?.section || 0),
    Number(item?.page || 0),
    Number(item?.pageCount || 0),
    Number(item?.size || 0),
    Number(item?.mtimeMs || 0),
    String(item?.hash || ""),
  ].join("|");
}

function sameMediaList(a: MediaItem[], b: MediaItem[]): boolean {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (mediaItemFingerprint(a[i]) !== mediaItemFingerprint(b[i])) {
      return false;
    }
  }
  return true;
}

function fetchWithTimeout(
  url: string,
  timeoutMs = MEDIA_FETCH_TIMEOUT_MS,
  headers: Record<string, string> = {}
): Promise<Response> {
  return Promise.race([
    fetch(url, {
      headers: {
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
        ...headers,
      },
    }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("media-fetch-timeout")), timeoutMs)
    ),
  ]);
}

function safeName(value: string, fallback = "media"): string {
  const name = String(value || fallback)
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 120);
  return name || fallback;
}

async function ensureMediaDirs() {
  await RNFS.mkdir(MEDIA_DIR);
  await RNFS.mkdir(MEDIA_ROOT);
}

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const exists = await RNFS.exists(filePath);
    if (!exists) return fallback;
    const raw = await RNFS.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile(filePath: string, payload: any) {
  await RNFS.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function readManifest(): Promise<ManifestMap> {
  return readJsonFile<ManifestMap>(MANIFEST_PATH, {});
}

async function writeManifest(manifest: ManifestMap) {
  await writeJsonFile(MANIFEST_PATH, manifest);
  invalidateCacheSummary();
}

async function readListCache(): Promise<MediaItem[]> {
  const list = await readJsonFile<MediaItem[]>(LIST_CACHE_PATH, []);
  return Array.isArray(list) ? list : [];
}

async function writeListCache(list: MediaItem[]) {
  if (sameMediaList(memoryListCache, list)) {
    memoryListCacheAtMs = Date.now();
    return;
  }
  await writeJsonFile(LIST_CACHE_PATH, list);
  memoryListCache = list;
  memoryListCacheAtMs = Date.now();
  invalidateCacheSummary();
}

async function fileExists(path: string): Promise<boolean> {
  try {
    return await RNFS.exists(path);
  } catch {
    return false;
  }
}

function localUri(path: string): string {
  if (path.startsWith("file://")) return path;
  return `file://${path}`;
}

function hashString(value: string): string {
  let hash = 0;
  const input = String(value || "");
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function localPathFor(remoteUrl: string, section: number, name: string): string {
  const encoded = hashString(remoteUrl);
  const fileName = safeName(`${section}_${encoded}_${name}`);
  return `${MEDIA_ROOT}/${fileName}`;
}

function shouldCacheItem(item: MediaItem): boolean {
  const url = String(item?.url || "").trim();
  if (!url) return false;
  const sizeBytes = Number(item?.size || 0);
  const isVideo = isVideoItem(item);
  try {
    const stats = DeviceIdModule?.getStorageStats?.();
    const freeBytes = Number(stats?.freeBytes || 0);
    const totalBytes = Number(stats?.totalBytes || 0);
    const lowCapacityDevice =
      totalBytes > 0 && totalBytes <= LOW_STORAGE_ROOM_TOTAL_BYTES;
    if (freeBytes > 0 && freeBytes <= LOW_STORAGE_HARD_LIMIT_BYTES) {
      if (isVideo) {
        return sizeBytes > 0 && sizeBytes <= LOW_STORAGE_VIDEO_FILE_BYTES;
      }
      return sizeBytes <= 0 || sizeBytes <= LOW_STORAGE_SMALL_FILE_BYTES;
    }
    if (
      (freeBytes > 0 && freeBytes <= LOW_STORAGE_SOFT_LIMIT_BYTES) ||
      lowCapacityDevice
    ) {
      if (isVideo) {
        return sizeBytes > 0 && sizeBytes <= LOW_STORAGE_VIDEO_FILE_BYTES;
      }
      return sizeBytes <= 0 || sizeBytes <= LOW_STORAGE_MEDIUM_FILE_BYTES;
    }
  } catch {
    // ignore adaptive storage checks
  }
  return true;
}

export function isMediaCacheEligible(item: MediaItem): boolean {
  return shouldCacheItem(item);
}

function isVideoItem(item: MediaItem): boolean {
  const mime = String(item?.type || "").toLowerCase();
  if (mime.startsWith("video/")) return true;
  const name = String(item?.originalName || item?.name || item?.url || "");
  return VIDEO_FILE_RE.test(name);
}

function getDownloadKey(item: MediaItem): string {
  return `${String(item.url || "")}|${Number(item.size || 0)}|${Number(item.mtimeMs || 0)}`;
}

function isExpectedValue(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

async function computeFileHash(path: string): Promise<string> {
  try {
    const hashFn = (RNFS as any)?.hash;
    if (typeof hashFn === "function") {
      const value = await hashFn(path, "sha1");
      return String(value || "");
    }
  } catch {
    // ignore
  }
  return "";
}

async function isManifestEntryUsable(
  entry: ManifestEntry | undefined,
  expectedSize: number,
  expectedMtime: number,
  expectedHash: string
): Promise<boolean> {
  if (!entry?.localPath) return false;
  if (!(await fileExists(entry.localPath))) return false;

  const sizeExpected = isExpectedValue(expectedSize);
  const mtimeExpected = isExpectedValue(expectedMtime);
  const hashExpected = String(expectedHash || "").trim();
  if (!sizeExpected && !mtimeExpected) {
    if (hashExpected) {
      const actualHash = await computeFileHash(entry.localPath);
      if (!actualHash || actualHash !== hashExpected) return false;
      entry.hash = hashExpected;
    }
    entry.lastSeenAt = Date.now();
    return true;
  }

  try {
    const stat = await RNFS.stat(entry.localPath);
    const size = Number(stat?.size || 0);
    const sizeOk = !sizeExpected || size === expectedSize;
    const mtimeOk = !mtimeExpected || Number(entry.mtimeMs || 0) === expectedMtime;
    let hashOk = true;
    if (hashExpected) {
      const actualHash = await computeFileHash(entry.localPath);
      hashOk = !!actualHash && actualHash === hashExpected;
    }
    if (sizeOk && mtimeOk && hashOk) {
      if (sizeExpected && entry.size !== expectedSize) entry.size = expectedSize;
      if (mtimeExpected && entry.mtimeMs !== expectedMtime) entry.mtimeMs = expectedMtime;
      if (hashExpected && entry.hash !== hashExpected) entry.hash = hashExpected;
      entry.lastSeenAt = Date.now();
      return true;
    }
  } catch {
    // fallthrough
  }

  return false;
}

async function downloadIfNeeded(
  server: string,
  item: MediaItem,
  manifest: ManifestMap
): Promise<string | null> {
  const remotePath = String(item.url || "");
  if (!remotePath) return null;
  const remoteUrl = `${server}${remotePath}`;
  const sourceName = String(item.originalName || item.name || "media.bin");
  const section = Number(item.section || 1);
  const expectedSize = Number(item.size || 0);
  const expectedMtime = Number(item.mtimeMs || 0);
  const expectedHash = String(item.hash || "").trim();
  const entry = manifest[remotePath];

  if (await isManifestEntryUsable(entry, expectedSize, expectedMtime, expectedHash)) {
    markCachedProgress(remotePath, Number(entry?.size || expectedSize || 0));
    return entry!.localPath;
  }

  const targetPath = localPathFor(remoteUrl, section, sourceName);
  emitProgress(remotePath, {
    total: expectedSize || 0,
    received: 0,
    percent: 0,
    updatedAt: Date.now(),
  });
  // If the file already exists locally (manifest missing), reuse it.
  try {
    if (await fileExists(targetPath)) {
      const stat = await RNFS.stat(targetPath);
      const size = Number(stat?.size || 0);
      if (!expectedSize || size === expectedSize) {
        if (expectedHash) {
          const actualHash = await computeFileHash(targetPath);
          if (!actualHash || actualHash !== expectedHash) {
            throw new Error("download-hash-mismatch");
          }
        }
      manifest[remotePath] = {
        url: remotePath,
        localPath: targetPath,
        size: expectedSize || size,
        mtimeMs: expectedMtime,
        hash: expectedHash || undefined,
        lastSeenAt: Date.now(),
      };
      await writeManifest(manifest);
      emitProgress(remotePath, {
        total: expectedSize || size || 0,
        received: expectedSize || size || 0,
          percent: 100,
          updatedAt: Date.now(),
        });
        invalidateCacheSummary();
        return targetPath;
      }
    }
  } catch {
    // continue to download
  }
  for (let attempt = 0; attempt < DOWNLOAD_MAX_RETRIES; attempt += 1) {
    try {
      try {
        if (await fileExists(targetPath)) {
          await RNFS.unlink(targetPath);
        }
      } catch {
        // clean partial files before retrying
      }
      const download = RNFS.downloadFile({
        fromUrl: `${remoteUrl}?ts=${Date.now()}`,
        toFile: targetPath,
        background: false,
        discretionary: false,
        connectionTimeout: DOWNLOAD_CONNECTION_TIMEOUT_MS,
        readTimeout: DOWNLOAD_READ_TIMEOUT_MS,
        progressInterval: 500,
        progress: (data) => {
          const total = Number(data?.contentLength || 0);
          const received = Number(data?.bytesWritten || 0);
          if (!total) return;
          const percent = Math.max(0, Math.min(100, Math.round((received / total) * 100)));
          emitProgress(remotePath, {
            total,
            received,
            percent,
            updatedAt: Date.now(),
          });
        },
      });
      const result = await download.promise;
      if (result.statusCode < 200 || result.statusCode >= 300) {
        throw new Error(`download-http-${result.statusCode}`);
      }

      const finalStat = await RNFS.stat(targetPath);
      const finalSize = Number(finalStat?.size || 0);
      if (expectedHash) {
        const actualHash = await computeFileHash(targetPath);
        if (!actualHash || actualHash !== expectedHash) {
          try {
            await RNFS.unlink(targetPath);
          } catch {
            // ignore
          }
          throw new Error("download-hash-mismatch");
        }
      }
      manifest[remotePath] = {
        url: remotePath,
        localPath: targetPath,
        size: expectedSize || finalSize,
        mtimeMs: expectedMtime,
        hash: expectedHash || undefined,
        lastSeenAt: Date.now(),
      };
      await writeManifest(manifest);
      emitProgress(remotePath, {
        total: expectedSize || finalSize || 0,
        received: expectedSize || finalSize || 0,
        percent: 100,
        updatedAt: Date.now(),
      });
      invalidateCacheSummary();
      return targetPath;
    } catch {
      try {
        if (await fileExists(targetPath)) {
          await RNFS.unlink(targetPath);
        }
      } catch {
        // ignore cleanup errors
      }
      if (attempt < DOWNLOAD_MAX_RETRIES - 1) {
        await new Promise<void>((resolve) => setTimeout(() => resolve(), DOWNLOAD_RETRY_DELAY_MS));
      }
    }
  }

  return entry?.localPath && (await fileExists(entry.localPath)) ? entry.localPath : null;
}

async function downloadIfNeededDeduped(
  server: string,
  item: MediaItem,
  manifest: ManifestMap
): Promise<string | null> {
  const key = getDownloadKey(item);
  const existing = inFlightDownloads.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      return await downloadIfNeeded(server, item, manifest);
    } finally {
      inFlightDownloads.delete(key);
    }
  })();

  inFlightDownloads.set(key, task);
  return task;
}

async function removeStaleFiles(
  manifest: ManifestMap,
  activeUrls: Set<string>,
  options: { immediate?: boolean } = {}
) {
  const now = Date.now();
  const activeList = Array.from(activeUrls);
  const activeCachedChecks = await Promise.all(
    activeList.map(async (url) => {
      const entry = manifest[url];
      if (!entry || !entry.localPath) return false;
      return await fileExists(entry.localPath);
    })
  );

  for (const url of Object.keys(manifest)) {
    const entry = manifest[url];
    if (!entry) continue;
    if (activeUrls.has(url)) {
      entry.lastSeenAt = now;
      continue;
    }
    if (!entry.lastSeenAt) {
      entry.lastSeenAt = now;
      if (!options.immediate) continue;
    }
    if (!options.immediate && now - Number(entry.lastSeenAt || 0) < CACHE_RETENTION_MS) continue;

    // Avoid unlinking immediately; a file can still be in active playback pipeline.
    // Delete only after a retention window to reduce playback risk.
    try {
      if (entry.localPath && (await fileExists(entry.localPath))) {
        await RNFS.unlink(entry.localPath);
      }
    } catch {
      // ignore
    }
    delete manifest[url];
  }
}

async function applyManifestToCachedList(list: MediaItem[]): Promise<MediaItem[]> {
  if (!Array.isArray(list) || !list.length) return [];
  try {
    await ensureMediaDirs();
    const manifest = await readManifest();
    let changed = false;

    const mapped = await Promise.all(
      list.map(async (item) => {
        const path = String(item?.url || "");
        if (!path) return item;
        const entry = manifest[path];
        if (!entry || !(await fileExists(entry.localPath))) return item;
        const fileUri = localUri(entry.localPath);
        markCachedProgress(path, Number(entry.size || item?.size || 0));
        if (item.remoteUrl !== fileUri || item.localPath !== entry.localPath) {
          changed = true;
          return { ...item, localPath: entry.localPath, remoteUrl: fileUri };
        }
        return item;
      })
    );

    if (changed) {
      await writeListCache(mapped);
      return mapped;
    }

    return mapped;
  } catch {
    return list;
  }
}

async function runTasksWithConcurrency(
  tasks: Array<() => Promise<void>>,
  concurrency = DOWNLOAD_CONCURRENCY,
  options: { ignoreOverride?: boolean; delayMs?: number } = {}
) {
  const adaptive = getAdaptiveDownloadConcurrency();
  let safeConcurrency = Math.max(1, Number(concurrency || adaptive || 1));
  if (!options.ignoreOverride && downloadConcurrencyOverride !== null) {
    if (downloadConcurrencyOverride === 0) return;
    safeConcurrency = Math.max(1, Math.min(safeConcurrency, downloadConcurrencyOverride));
  }
  let cursor = 0;

  async function worker() {
    while (cursor < tasks.length) {
      const index = cursor;
      cursor += 1;
      try {
        await tasks[index]();
      } catch {
        // no-op
      }
      if (options.delayMs && options.delayMs > 0) {
        await new Promise<void>((resolve) => setTimeout(() => resolve(), options.delayMs));
      }
    }
  }

  const workers = Array.from({ length: Math.min(safeConcurrency, tasks.length) }, () => worker());
  await Promise.allSettled(workers);
}

async function mapServerListToPlayable(
  serverList: MediaItem[],
  server: string,
  options: { awaitDownloads?: boolean; pruneStaleNow?: boolean } = {}
): Promise<MediaItem[]> {
  await ensureMediaDirs();
  const manifest = await readManifest();
  const activeUrls = new Set<string>();
  const uniqueByUrl = new Map<string, MediaItem>();

  for (const item of serverList) {
    const path = String(item?.url || "");
    if (!path) continue;
    activeUrls.add(path);
    if (!uniqueByUrl.has(path)) uniqueByUrl.set(path, item);
  }

  const resolvedByUrl: Record<string, string> = {};
  const pendingDownloads: Array<() => Promise<void>> = [];
  const pendingLargeDownloads: Array<() => Promise<void>> = [];
  const pendingVideoDownloads: Array<() => Promise<void>> = [];
  const priorityDownloads: Array<() => Promise<void>> = [];
  const priorityLargeDownloads: Array<() => Promise<void>> = [];
  const priorityVideoDownloads: Array<() => Promise<void>> = [];
  for (const [path, item] of uniqueByUrl.entries()) {
    const existing = manifest[path];
    if (existing) {
      const expectedSize = Number(item.size || 0);
      const expectedMtime = Number(item.mtimeMs || 0);
      const expectedHash = String(item.hash || "").trim();
      if (await isManifestEntryUsable(existing, expectedSize, expectedMtime, expectedHash)) {
        resolvedByUrl[path] = existing.localPath;
        markCachedProgress(path, Number(existing.size || item.size || 0));
        continue;
      }
    }

    // Keep playback immediate: use remote now, download cache in background.
    // Limit caching to reasonable file sizes to avoid memory pressure on TV devices.
    if (shouldCacheItem(item)) {
      const sizeBytes = Number(item?.size || 0);
      if (options.awaitDownloads && sizeBytes > 0 && sizeBytes <= SMALL_FILE_AWAIT_BYTES) {
        const localPathValue = await downloadIfNeededDeduped(server, item, manifest);
        if (localPathValue) {
          resolvedByUrl[path] = localPathValue;
          continue;
        }
      }
      const task = async () => {
        const localPathValue = await downloadIfNeededDeduped(server, item, manifest);
        if (localPathValue) {
          resolvedByUrl[path] = localPathValue;
        }
      };
      const isPriority = prioritySection > 0 && Number(item?.section || 0) === prioritySection;
      if (isVideoItem(item)) {
        (isPriority ? priorityVideoDownloads : pendingVideoDownloads).push(task);
      } else if (sizeBytes > LARGE_MEDIA_BYTES) {
        (isPriority ? priorityLargeDownloads : pendingLargeDownloads).push(task);
      } else {
        (isPriority ? priorityDownloads : pendingDownloads).push(task);
      }
    }
  }

  const mapped = serverList.map((item) => {
    const path = String(item?.url || "");
    const localPathValue = resolvedByUrl[path];
    if (localPathValue) {
      return {
        ...item,
        localPath: localPathValue,
        remoteUrl: localUri(localPathValue),
      };
    }
    return {
      ...item,
      remoteUrl: `${server}${path}`,
    };
  });

  await removeStaleFiles(manifest, activeUrls, { immediate: !!options.pruneStaleNow });
  clearProgressForMissingPaths(activeUrls);
  await writeManifest(manifest);
  if (!sameMediaList(memoryListCache, mapped)) {
    await writeListCache(mapped);
  } else {
    memoryListCacheAtMs = Date.now();
  }

  if (
    !pendingDownloads.length &&
    !pendingLargeDownloads.length &&
    !pendingVideoDownloads.length &&
    !priorityDownloads.length &&
    !priorityLargeDownloads.length &&
    !priorityVideoDownloads.length
  ) {
    return mapped;
  }

  const buildRefreshed = () =>
    serverList.map((item) => {
      const path = String(item?.url || "");
      const localPathValue = manifest[path]?.localPath;
      if (localPathValue) {
        markCachedProgress(path, Number(item?.size || 0));
        return {
          ...item,
          localPath: localPathValue,
          remoteUrl: localUri(localPathValue),
        };
      }
      return {
        ...item,
        remoteUrl: `${server}${path}`,
      };
    });

  if (options.awaitDownloads) {
    if (priorityDownloads.length) {
      await runTasksWithConcurrency(priorityDownloads, DOWNLOAD_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    if (priorityVideoDownloads.length) {
      await runTasksWithConcurrency(priorityVideoDownloads, VIDEO_DOWNLOAD_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    if (priorityLargeDownloads.length) {
      await runTasksWithConcurrency(priorityLargeDownloads, LARGE_MEDIA_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    if (pendingDownloads.length) {
      await runTasksWithConcurrency(pendingDownloads, DOWNLOAD_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    if (pendingVideoDownloads.length) {
      await runTasksWithConcurrency(pendingVideoDownloads, VIDEO_DOWNLOAD_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    if (pendingLargeDownloads.length) {
      await runTasksWithConcurrency(pendingLargeDownloads, LARGE_MEDIA_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    const refreshed = buildRefreshed();
    await writeManifest(manifest);
    if (sameMediaList(memoryListCache, refreshed)) {
      memoryListCacheAtMs = Date.now();
      return memoryListCache;
    }
    await writeListCache(refreshed);
    return refreshed;
  }

  const backgroundSync = async () => {
    if (priorityDownloads.length) {
      await runTasksWithConcurrency(priorityDownloads, DOWNLOAD_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    if (priorityVideoDownloads.length) {
      await runTasksWithConcurrency(priorityVideoDownloads, VIDEO_DOWNLOAD_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    if (priorityLargeDownloads.length) {
      await runTasksWithConcurrency(priorityLargeDownloads, LARGE_MEDIA_CONCURRENCY, {
        ignoreOverride: true,
      });
    }
    if (pendingDownloads.length) {
      await runTasksWithConcurrency(pendingDownloads, DOWNLOAD_CONCURRENCY, {
        delayMs: nonPriorityThrottleMs,
      });
    }
    if (pendingVideoDownloads.length) {
      await runTasksWithConcurrency(pendingVideoDownloads, VIDEO_DOWNLOAD_CONCURRENCY, {
        delayMs: nonPriorityThrottleMs,
      });
    }
    if (pendingLargeDownloads.length) {
      await runTasksWithConcurrency(pendingLargeDownloads, LARGE_MEDIA_CONCURRENCY, {
        delayMs: nonPriorityThrottleMs,
      });
    }
    const refreshed = buildRefreshed();
    await writeManifest(manifest);
    if (!sameMediaList(memoryListCache, refreshed)) {
      await writeListCache(refreshed);
    } else {
      memoryListCacheAtMs = Date.now();
    }
  };

  backgroundSync().catch(() => {
    // no-op
  });

  return mapped;
}

function sanitizeCachedList(list: MediaItem[]): MediaItem[] {
  if (!Array.isArray(list)) return [];
  return list.filter((item) => {
    if (!item || typeof item !== "object") return false;
    return !!item.url;
  });
}

function normalizeMediaList(list: MediaItem[]): MediaItem[] {
  if (!Array.isArray(list) || !list.length) return [];
  const seen = new Set<string>();
  const result: MediaItem[] = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const url = String(item.url || "").trim();
    if (!url) continue;
    const name = String(item.originalName || item.name || "").trim();
    const size = Number(item.size || 0);
    const mtime = Number(item.mtimeMs || 0);
    const section = Number(item.section || 0);
    const page = Number(item.page || 0);
    const key = `${url}|${name}|${size}|${mtime}|${section}|${page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function fetchServerMediaList(server: string): Promise<MediaItem[]> {
  const deviceId = await DeviceIdModule.getDeviceId();
  const headers: Record<string, string> = {};
  if (lastListEtag) headers["If-None-Match"] = lastListEtag;
  const res = await fetchWithTimeout(
    `${server}/media-list?deviceId=${deviceId}&ts=${Date.now()}`,
    MEDIA_FETCH_TIMEOUT_MS,
    headers
  );
  if (res.status === 304) {
    if (memoryListCache.length) return memoryListCache;
    const cached = normalizeMediaList(sanitizeCachedList(await readListCache()));
    return cached;
  }
  if (!res.ok) {
    throw new Error(`media-http-${res.status}`);
  }
  const etag = res.headers?.get?.("ETag");
  if (etag) lastListEtag = etag;
  const list = await res.json();
  if (!Array.isArray(list)) return [];
  return normalizeMediaList(list);
}

async function loadCachedPlayableList(): Promise<MediaItem[]> {
  if (memoryListCache.length) return memoryListCache;
  try {
    const cached = normalizeMediaList(sanitizeCachedList(await readListCache()));
    const mapped = await applyManifestToCachedList(cached);
    memoryListCache = mapped;
    memoryListCacheAtMs = Date.now();
    return mapped;
  } catch (e) {
    console.log("Load cached playable list failed", e);
    return [];
  }
}

async function refreshPlayableList(
  options: {
    blockUntilCached?: boolean;
    blockUntilCachedSmallBytes?: number;
    pruneStaleNow?: boolean;
    force?: boolean;
    forceHard?: boolean;
  } = {}
): Promise<MediaItem[]> {
  const now = Date.now();
  const server = getServer();
  if (!server) {
    return loadCachedPlayableList();
  }

  const ageMs = now - memoryListCacheAtMs;
  if (!options.force && memoryListCache.length && ageMs < LIST_REFRESH_MIN_INTERVAL_MS) {
    return memoryListCache;
  }

  if ((!options.force || !options.forceHard) && listBackoffUntilMs && now < listBackoffUntilMs) {
    return loadCachedPlayableList();
  }

  if (inFlightListRefresh) return inFlightListRefresh;

  inFlightListRefresh = (async () => {
    try {
      const list = await fetchServerMediaList(server);
      listBackoffFailCount = 0;
      listBackoffUntilMs = 0;
      const totalBytes = list.reduce((sum, item) => sum + Number(item?.size || 0), 0);
      const smallLimit = Number(options.blockUntilCachedSmallBytes || 0);
      const awaitDownloads =
        !!options.blockUntilCached ||
        (smallLimit > 0 && totalBytes > 0 && totalBytes <= smallLimit);
      return mapServerListToPlayable(list, server, {
        awaitDownloads,
        pruneStaleNow: !!options.pruneStaleNow,
      });
    } catch (e) {
      listBackoffFailCount += 1;
      listBackoffUntilMs = Date.now() + getListBackoffDelayMs();
      if (Date.now() - lastBackoffLogAtMs > 5000) {
        lastBackoffLogAtMs = Date.now();
        console.log("Media list fetch failed, backing off", e);
      }
      return loadCachedPlayableList();
    }
  })();

  try {
    return await inFlightListRefresh;
  } finally {
    inFlightListRefresh = null;
  }
}

export async function syncMedia(
  options: {
    blockUntilCached?: boolean;
    blockUntilCachedSmallBytes?: number;
    pruneStaleNow?: boolean;
    force?: boolean;
    forceHard?: boolean;
  } = {}
) {
  try {
    await refreshPlayableList(options);
    return true;
  } catch (e) {
    console.log("Media sync failed, using cached list", e);
    await loadCachedPlayableList();
    return false;
  }
}

export async function getMediaFiles(sectionIndex = 0) {
  const sectionNo = sectionIndex + 1;

  try {
    const mapped = await refreshPlayableList();
    const filtered = mapped.filter((file) => Number(file.section || 0) === sectionNo);
    try {
      const names = filtered
        .map((file) => String(file.originalName || file.name || file.url || ""))
        .filter(Boolean)
        .slice(0, 25);
      const key = `${filtered.length}|${names.join("|")}`;
      const now = Date.now();
      const lastAt = lastMediaLogAtBySection[sectionNo] || 0;
      if (key !== lastMediaLogKeyBySection[sectionNo] || now - lastAt > 10000) {
        lastMediaLogAtBySection[sectionNo] = now;
        lastMediaLogKeyBySection[sectionNo] = key;
        console.log(
          "Media list",
          `section=${sectionNo}`,
          `count=${filtered.length}`,
          names.length ? `items=${names.join(" | ")}` : "items=none"
        );
      }
    } catch {
      // ignore logging failures
    }
    return filtered;
  } catch (e) {
    console.log("Media list fetch failed, fallback to cache", e);
  }

  const cached = await loadCachedPlayableList();
  const filtered = cached.filter((file) => Number(file.section || 0) === sectionNo);
  try {
    const names = filtered
      .map((file) => String(file.originalName || file.name || file.url || ""))
      .filter(Boolean)
      .slice(0, 25);
    const key = `cache|${filtered.length}|${names.join("|")}`;
    const now = Date.now();
    const lastAt = lastMediaLogAtBySection[sectionNo] || 0;
    if (key !== lastMediaLogKeyBySection[sectionNo] || now - lastAt > 10000) {
      lastMediaLogAtBySection[sectionNo] = now;
      lastMediaLogKeyBySection[sectionNo] = key;
      console.log(
        "Media list (cache)",
        `section=${sectionNo}`,
        `count=${filtered.length}`,
        names.length ? `items=${names.join(" | ")}` : "items=none"
      );
    }
  } catch {
    // ignore logging failures
  }
  return filtered;
}

export async function hasCachedMedia(): Promise<boolean> {
  try {
    const list = await readListCache();
    return Array.isArray(list) && list.length > 0;
  } catch {
    return false;
  }
}

export async function pruneCacheIfLow(minFreeBytes = DEFAULT_MIN_FREE_BYTES) {
  try {
    const stats = DeviceIdModule?.getStorageStats?.();
    const freeBytes = Number(stats?.freeBytes || 0);
    if (!freeBytes || freeBytes >= minFreeBytes) return false;

    await ensureMediaDirs();
    const manifest = await readManifest();
    const entries = Object.values(manifest).filter((entry) => entry?.localPath);
    if (!entries.length) return false;

    const sorted = entries.sort(
      (a, b) => Number(a.lastSeenAt || 0) - Number(b.lastSeenAt || 0)
    );

    let reclaimed = 0;
    for (const entry of sorted) {
      if (!entry?.localPath) continue;
      try {
        if (await fileExists(entry.localPath)) {
          await RNFS.unlink(entry.localPath);
          reclaimed += Number(entry.size || 0);
        }
      } catch {
        // ignore unlink errors
      }
      delete manifest[entry.url];
      if (freeBytes + reclaimed >= minFreeBytes) break;
    }

    await writeManifest(manifest);
    return true;
  } catch {
    return false;
  }
}

export async function prefetchMediaItems(items: MediaItem[]) {
  try {
    const server = getServer();
    if (!server) return;
    if (!Array.isArray(items) || !items.length) return;

    await ensureMediaDirs();
    const manifest = await readManifest();
    const videoTasks: Array<() => Promise<void>> = [];
    const otherTasks: Array<() => Promise<void>> = [];

    for (const item of items) {
      if (!shouldCacheItem(item)) continue;
      const task = async () => {
        const localPathValue = await downloadIfNeededDeduped(server, item, manifest);
        if (localPathValue) {
          // manifest is updated inside downloadIfNeededDeduped/downloadIfNeeded
        }
      };
      if (isVideoItem(item)) {
        videoTasks.push(task);
      } else {
        otherTasks.push(task);
      }
    }

    if (otherTasks.length) {
      await runTasksWithConcurrency(otherTasks, 2);
    }
    if (videoTasks.length) {
      await runTasksWithConcurrency(videoTasks, 1);
    }

    await writeManifest(manifest);
  } catch {
    // ignore prefetch errors
  }
}

export async function getCacheSummary() {
  try {
    const now = Date.now();
    if (now - cacheSummaryCache.at < CACHE_SUMMARY_TTL_MS) {
      return {
        total: cacheSummaryCache.total,
        cached: cacheSummaryCache.cached,
        percent: cacheSummaryCache.percent,
      };
    }
    const list = await readListCache();
    if (!Array.isArray(list) || !list.length) {
      cacheSummaryCache = { at: now, total: 0, cached: 0, percent: 0 };
      return { total: 0, cached: 0, percent: 0 };
    }
    const manifest = await readManifest();
    let cached = 0;
    for (const item of list) {
      const path = String(item?.url || "");
      const entry = manifest[path];
      if (entry?.localPath && (await fileExists(entry.localPath))) {
        cached += 1;
      }
    }
    const total = list.length;
    const percent = total ? Math.round((cached / total) * 100) : 0;
    cacheSummaryCache = { at: now, total, cached, percent };
    return { total, cached, percent };
  } catch {
    return { total: 0, cached: 0, percent: 0 };
  }
}

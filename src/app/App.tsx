import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  AppState,
  BackHandler,
  Dimensions,
  NativeEventEmitter,
  Easing,
  NativeModules,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Immersive from "react-native-immersive";
import AsyncStorage from "@react-native-async-storage/async-storage";
import RNFS from "react-native-fs";
import { io, Socket } from "socket.io-client";
import AdminButton from "../admin/AdminButton";
import AdminCmsPanel from "../admin/AdminCmsPanel";
import CmsAccessCard from "../admin/CmsAccessCard";
import PlayerScreen from "../player/PlayerScreen";
import { loadConfig } from "../services/configService";
import {
  clearEmbeddedCmsState,
  setEmbeddedRuntimeInfo,
  startEmbeddedCmsServer,
} from "../services/embeddedCmsService";
import {
  activateDeviceWithKey,
  hasLocalActivationForDevice,
  readStoredLicense,
} from "../services/licenseService";
import {
  getCacheSummary,
  clearPlaybackOverride,
  hasCachedMedia,
  pruneCacheIfLow,
  resetMediaRuntimeState,
  setDownloadConcurrencyOverride,
  setNonPriorityThrottleMs,
  setPrioritySection,
  syncMedia,
} from "../services/mediaService";
import { PlaybackController } from "../services/playbackController";
import { findCMS, getServer, restoreServerFromStorage } from "../services/serverService";
import { SourceManager, type SourceSnapshot } from "../services/sourceManager";
import {
  isUsbModuleAvailable,
  refreshUsbState,
  subscribeUsbState,
} from "../services/usbManagerModule";
import { ensureUsbMediaReadPermissions } from "../services/storagePermissionService";

let socket: Socket | null = null;
const USE_EMBEDDED_CMS = true;
const WATCHDOG_INTERVAL_MS = 5000;
const WATCHDOG_STALL_MS = 180000;
const NETWORK_RECOVERY_INTERVAL_MS = 10000;
const NETWORK_QUALITY_CHECK_INTERVAL_MS = 15000;
const NETWORK_QUALITY_SLOW_MS = 1800;
const NETWORK_QUALITY_VERY_SLOW_MS = 3500;
const SELF_HEAL_SYNC_INTERVAL_MS = 120000;
const RECONNECT_RETRY_INTERVAL_MS = 10000;
const ENABLE_AUTO_WIFI_RECOVERY = false;
const ENABLE_NETWORK_RECOVERY_LOOP = false;
const OFFLINE_NOTICE_POLL_MS = 3000;
const AUTO_CLEAR_BOOT_MARKER_KEY = "auto_clear_boot_marker_v1";
const AUTO_CLEAR_BOOT_LOOP_GUARD_MS = 20000;
const ENABLE_AUTO_CLEAR_ON_BOOT = false;
const INIT_RETRY_DELAY_MS = 5000;
const MEDIA_UPDATE_DEBOUNCE_MS = 800;
const LICENSE_INIT_RETRY_COUNT = 5;
const LICENSE_INIT_RETRY_DELAY_MS = 1200;
const APK_UPDATE_PENDING_KEY = "apk_update_pending_v1";
const APK_UPDATE_PENDING_MAX_AGE_MS = 1000 * 60 * 60;
const CACHE_GUARD_INTERVAL_MS = 120000;
const CACHE_MIN_FREE_BYTES = 1024 * 1024 * 1024;
const SMALL_CACHE_BLOCK_BYTES = 30 * 1024 * 1024;
const STARTUP_DEFER_MS = 2500;
const MAX_DIAGNOSTIC_EVENTS = 24;
const DEVICE_META_CACHE_MS = 30000;
const TV_BACK_DOUBLE_PRESS_MS = 1300;
const INITIAL_SOURCE_SNAPSHOT: SourceSnapshot = {
  activeSource: "CMS_OFFLINE",
  usbMounted: false,
  usbHasPlayableMedia: false,
  usbPlaylist: [],
  usbMountPath: "",
  usbSuppressed: false,
};

type RuntimeErrorInfo = {
  message: string;
  detail?: string;
  source?: string;
  time: string;
  silent?: boolean;
};

class PlayerErrorBoundary extends React.Component<
  { onError?: (error: Error) => void; children: React.ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMessage: String(error?.message || error) };
  }

  componentDidCatch(error: Error) {
    if (this.props.onError) {
      this.props.onError(error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBoundaryWrap}>
          <Text style={styles.errorBoundaryTitle}>Playback Error</Text>
          <Text style={styles.errorBoundaryText}>
            {this.state.errorMessage || "Unexpected error. Please check logs."}
          </Text>
        </View>
      );
    }
    return this.props.children as any;
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(() => resolve(), ms));
}

async function getPathSizeSafe(targetPath: string): Promise<number> {
  try {
    const exists = await RNFS.exists(targetPath);
    if (!exists) return 0;
    const stat = await RNFS.stat(targetPath);
    if (!stat.isDirectory()) {
      return Number(stat.size || 0);
    }
    const entries = await RNFS.readDir(targetPath);
    const sizes: number[] = await Promise.all(
      entries.map((entry) => getPathSizeSafe(entry.path))
    );
    return sizes.reduce((sum: number, size: number) => sum + Number(size || 0), 0);
  } catch {
    return 0;
  }
}

const PRESERVED_ASYNC_KEYS = new Set([
  "license_key_v1",
  "license_device_id_v1",
  "tvCmsActiveGroupId",
]);

export default function App() {
  const [bootReady, setBootReady] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminInitialView, setAdminInitialView] = useState<"access" | "cms">("access");
  const [ready, setReady] = useState(false);
  const [config, setConfig] = useState<any>(null);
  const [mediaVersion, setMediaVersion] = useState(0);
  const [connectSubtitleText, setConnectSubtitleText] = useState(
    "Preparing network scan..."
  );
  const [connectStatusText, setConnectStatusText] = useState(
    "Auto reconnect active"
  );
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0)).current;
  const deviceIdRef = useRef("unknown");
  const [licenseReady, setLicenseReady] = useState(false);
  const [licensed, setLicensed] = useState(false);
  const [licenseDeviceId, setLicenseDeviceId] = useState("");
  const [licenseInput, setLicenseInput] = useState("");
  const [licenseStatus, setLicenseStatus] = useState("Checking activation...");
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [lastError, setLastError] = useState<RuntimeErrorInfo | null>(null);
  const [sourceSnapshot, setSourceSnapshot] = useState<SourceSnapshot>(INITIAL_SOURCE_SNAPSHOT);
  const [offlineNotice, setOfflineNotice] = useState("");
  const [uploadProcessingBySection, setUploadProcessingBySection] = useState<
    Record<number, string>
  >({});
  const [uploadCountsBySection, setUploadCountsBySection] = useState<
    Record<number, { uploaded: number; total: number }>
  >({});
  const [playlistSyncAt, setPlaylistSyncAt] = useState(0);
  const [contentResetVersion, setContentResetVersion] = useState(0);
  const [sectionMediaVersion, setSectionMediaVersion] = useState<Record<number, number>>({
    1: 0,
    2: 0,
    3: 0,
  });
  const [sectionPlaybackTimeline, setSectionPlaybackTimeline] = useState<Record<number, any>>({});
  const [apkUpdateState, setApkUpdateState] = useState<{
    status: string;
    message: string;
    percent: number;
    visible: boolean;
  }>({
    status: "",
    message: "",
    percent: 0,
    visible: false,
  });
  const socketUrlRef = useRef("");
  const playbackBySectionRef = useRef<Record<number, any>>({});
  const lastMetaRef = useRef<any | null>(null);
  const lastConfigSyncAtRef = useRef("");
  const lastMediaSyncAtRef = useRef("");
  const pendingApkUpdateSuccessRef = useRef<any | null>(null);
  const errorClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const offlineNoticeRef = useRef("");
  const offlineNoticeDismissedRef = useRef(false);
  const lastPlaybackHealthEmitAtRef = useRef(0);
  const networkQualityRef = useRef("unknown");
  const playbackStatsRef = useRef({
    playbackChanges: 0,
    playbackErrors: 0,
    lastTitle: "",
    lastSection: 0,
    lastUpdatedAt: "",
  });
  const sectionRefreshTimersRef = useRef<Record<number, ReturnType<typeof setTimeout> | null>>({
    1: null,
    2: null,
    3: null,
  });
  const diagnosticEventsRef = useRef<Array<{ time: string; type: string; message: string }>>([]);
  const deviceMetaCacheRef = useRef<{
    at: number;
    mediaBytes: number;
    configBytes: number;
    cacheBytes: number;
  }>({
    at: 0,
    mediaBytes: 0,
    configBytes: 0,
    cacheBytes: 0,
  });
  const lastTvBackPressAtRef = useRef(0);
  const adminOpenedByBackRef = useRef(false);
  const sourceManagerRef = useRef(new SourceManager());
  const playbackControllerRef = useRef(new PlaybackController());

  const openAdminPanel = (view: "access" | "cms", options: { openedByBack?: boolean } = {}) => {
    setAdminInitialView(view);
    setShowAdmin(true);
    adminOpenedByBackRef.current = !!options.openedByBack;
    if (view === "cms") {
      lastTvBackPressAtRef.current = 0;
    }
  };

  const closeAdminPanel = () => {
    setShowAdmin(false);
    adminOpenedByBackRef.current = false;
    lastTvBackPressAtRef.current = 0;
  };

  const handleTvBackAction = useCallback(() => {
    const now = Date.now();

    if (showAdmin) {
      if (adminInitialView === "cms") {
        closeAdminPanel();
        return true;
      }
      if (
        adminOpenedByBackRef.current &&
        lastTvBackPressAtRef.current > 0 &&
        now - lastTvBackPressAtRef.current <= TV_BACK_DOUBLE_PRESS_MS
      ) {
        openAdminPanel("cms");
        return true;
      }
      closeAdminPanel();
      return true;
    }

    if (now - lastTvBackPressAtRef.current <= TV_BACK_DOUBLE_PRESS_MS) {
      openAdminPanel("cms");
      return true;
    }

    lastTvBackPressAtRef.current = now;
    openAdminPanel("access", { openedByBack: true });
    return true;
  }, [adminInitialView, showAdmin]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", handleTvBackAction);
    return () => subscription.remove();
  }, [handleTvBackAction]);

  useEffect(() => {
    const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
    if (!nativeDeviceModule) return;
    const emitter = new NativeEventEmitter(nativeDeviceModule);
    const sub = emitter.addListener("tvRemoteKey", (event: any) => {
      const eventType = String(event?.eventType || "").toLowerCase();
      const keyAction = Number(event?.eventKeyAction ?? -1);
      if (eventType !== "back") return;
      if (keyAction !== -1 && keyAction !== 1) return;
      handleTvBackAction();
    });
    return () => {
      sub.remove();
    };
  }, [handleTvBackAction]);

  useEffect(() => {
    offlineNoticeRef.current = offlineNotice;
  }, [offlineNotice]);

  useEffect(() => {
    const unsubscribe = sourceManagerRef.current.subscribe((snapshot) => {
      console.log(
        "[USB_SOURCE]",
        JSON.stringify({
          activeSource: snapshot.activeSource,
          usbMounted: snapshot.usbMounted,
          usbHasPlayableMedia: snapshot.usbHasPlayableMedia,
          usbMountPath: snapshot.usbMountPath,
          usbPlaylistSize: snapshot.usbPlaylist.length,
          usbSuppressed: snapshot.usbSuppressed,
        })
      );
      setSourceSnapshot(snapshot);
      if (snapshot.activeSource === "USB" && snapshot.usbPlaylist.length) {
        playbackControllerRef.current.playUsbPlaylist(snapshot.usbPlaylist);
        return;
      }
      playbackControllerRef.current.stopUsbPlayback();
    });
    return () => {
      unsubscribe();
      playbackControllerRef.current.stopUsbPlayback();
      clearPlaybackOverride("usb");
    };
  }, []);

  useEffect(() => {
    if (!isUsbModuleAvailable()) return;

    let mounted = true;
    const applyUsbState = async () => {
      try {
        const permissionGranted = await ensureUsbMediaReadPermissions();
        console.log("[USB_PERM]", permissionGranted ? "granted" : "denied");
        if (!permissionGranted) return;
        const state = await refreshUsbState();
        console.log("[USB_REFRESH]", JSON.stringify(state));
        if (!mounted) return;
        sourceManagerRef.current.onUsbState(state);
      } catch {
        // ignore USB refresh errors
      }
    };

    const unsubscribeUsb = subscribeUsbState((state) => {
      sourceManagerRef.current.onUsbState(state);
    });

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void applyUsbState();
      }
    });

    void applyUsbState();

    return () => {
      mounted = false;
      unsubscribeUsb();
      appStateSub.remove();
    };
  }, []);

  const pushDiagnosticEvent = (type: string, message: string) => {
    diagnosticEventsRef.current = [
      ...diagnosticEventsRef.current,
      {
        time: new Date().toISOString(),
        type: String(type || "runtime"),
        message: String(message || "").slice(0, 240),
      },
    ].slice(-MAX_DIAGNOSTIC_EVENTS);
  };

  const reportRuntimeError = (message: string, detail = "", source = "runtime") => {
    pushDiagnosticEvent(source, detail ? `${message} | ${detail}` : message);
    if (errorClearTimerRef.current) {
      clearTimeout(errorClearTimerRef.current);
      errorClearTimerRef.current = null;
    }
    const silent = source === "player";
    const friendlyMessage =
      source === "player"
        ? String(message || "Playback error")
        : "Something went wrong. Player will try to recover.";
    const friendlyDetail = detail ? String(detail) : "";

    if (!silent) {
      setLastError({
        message: friendlyMessage,
        detail: friendlyDetail,
        source,
        time: new Date().toISOString(),
        silent,
      });
    } else {
      setLastError((current) => (current?.source === "player" ? null : current));
    }
    if (socket?.connected) {
      socket.emit("device-error", {
        deviceId: deviceIdRef.current,
        type: source,
        message: detail ? `${message} | ${detail}` : message,
      });
    }
    if (!silent) {
      errorClearTimerRef.current = setTimeout(() => {
        setLastError(null);
        errorClearTimerRef.current = null;
      }, 20000);
    }
  };

  async function clearRuntimePlaybackData() {
    // Intentionally do not clear AsyncStorage license keys.
    const mediaPath = `${RNFS.DocumentDirectoryPath}/media`;
    const configPath = `${RNFS.DocumentDirectoryPath}/config.json`;
    if (await RNFS.exists(mediaPath)) {
      await RNFS.unlink(mediaPath);
    }
    if (await RNFS.exists(configPath)) {
      await RNFS.unlink(configPath);
    }
  }

  async function clearRuntimeCacheOnly() {
    const mediaPath = `${RNFS.DocumentDirectoryPath}/media`;
    const cachePath = RNFS.CachesDirectoryPath;
    if (await RNFS.exists(mediaPath)) {
      await RNFS.unlink(mediaPath);
    }
    if (cachePath && (await RNFS.exists(cachePath))) {
      const entries = await RNFS.readDir(cachePath);
      await Promise.allSettled(entries.map((entry) => RNFS.unlink(entry.path)));
    }
  }

  async function clearRuntimeTransientCache() {
    const cachePath = RNFS.CachesDirectoryPath;
    if (!cachePath) return;
    if (!(await RNFS.exists(cachePath))) return;
    const entries = await RNFS.readDir(cachePath);
    await Promise.allSettled(entries.map((entry) => RNFS.unlink(entry.path)));
  }

  async function clearPersistedPlaybackState() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const playbackKeys = keys.filter((key) => String(key || "").startsWith("playback:"));
      if (playbackKeys.length) {
        await AsyncStorage.multiRemove(playbackKeys);
      }
    } catch {
      // ignore cleanup errors
    }
  }

  function resetRuntimePlaybackSnapshots() {
    playbackBySectionRef.current = {};
    playbackStatsRef.current = {
      ...playbackStatsRef.current,
      playbackChanges: 0,
      lastTitle: "",
      lastSection: 0,
      lastUpdatedAt: new Date().toISOString(),
    };
    if (socket?.connected && lastMetaRef.current) {
      socket.emit("device-health", {
        deviceId: deviceIdRef.current,
        appState: "playback-reset",
        meta: {
          ...lastMetaRef.current,
          currentPlaybackBySection: {},
        },
      });
    }
  }

  function normalizePlaybackTimeline(raw: any) {
    const sections = raw?.sections && typeof raw.sections === "object" ? raw.sections : {};
    const next: Record<number, any> = {};
    for (const [key, value] of Object.entries(sections)) {
      const section = Number(key || 0);
      if (!section) continue;
      next[section] = value;
    }
    return next;
  }

  function mergePlaybackTimeline(section: number, timeline: any) {
    if (!section || !timeline) return;
    setSectionPlaybackTimeline((current) => ({
      ...current,
      [section]: timeline,
    }));
  }

  async function clearRuntimeDeepData() {
    await resetMediaRuntimeState({ clearListCache: true });
    await clearPersistedPlaybackState();
    resetRuntimePlaybackSnapshots();
    setSectionPlaybackTimeline({});
    setUploadProcessingBySection({});
    setUploadCountsBySection({});
    setPlaylistSyncAt(0);
    setContentResetVersion((prev) => prev + 1);
    setSectionMediaVersion({ 1: 0, 2: 0, 3: 0 });

    try {
      const keys = await AsyncStorage.getAllKeys();
      const removeKeys = keys.filter((key) => !PRESERVED_ASYNC_KEYS.has(String(key || "")));
      if (removeKeys.length) {
        await AsyncStorage.multiRemove(removeKeys);
      }
    } catch {
      // ignore AsyncStorage cleanup errors
    }

    await clearRuntimePlaybackData();
    await clearRuntimeTransientCache();
    try {
      const manifestPath = `${RNFS.DocumentDirectoryPath}/media/manifest.json`;
      const listPath = `${RNFS.DocumentDirectoryPath}/media/list-cache.json`;
      if (await RNFS.exists(manifestPath)) {
        await RNFS.unlink(manifestPath);
      }
      if (await RNFS.exists(listPath)) {
        await RNFS.unlink(listPath);
      }
    } catch {
      // ignore cleanup errors
    }

    try {
      await clearEmbeddedCmsState();
    } catch {
      // ignore native embedded CMS cleanup errors
    }
  }

  function bumpSectionMediaVersion(section?: number) {
    const safeSection = Number(section || 0);
    if (!safeSection || safeSection < 1 || safeSection > 3) return;
    setSectionMediaVersion((current) => ({
      ...current,
      [safeSection]: Number(current?.[safeSection] || 0) + 1,
    }));
  }

  const refreshPlayerMediaImmediately = async (section?: number) => {
    await resetMediaRuntimeState({ clearListCache: true });
    if (section && section >= 1 && section <= 3) {
      mergePlaybackTimeline(section, {
        section,
        syncAt: Date.now(),
        cycleId: `local-${String(section)}-${Date.now()}`,
      });
      bumpSectionMediaVersion(section);
      return;
    }
    await clearPersistedPlaybackState();
    resetRuntimePlaybackSnapshots();
    setContentResetVersion((prev) => prev + 1);
    setPlaylistSyncAt(Date.now());
    setMediaVersion((prev) => prev + 1);
  };

  const finalizePlayerMediaRefresh = async (section?: number) => {
    await syncMedia({
      force: true,
      forceHard: true,
      pruneStaleNow: true,
    });
    await clearRuntimeTransientCache();
    await clearOldCachedMediaExceptActive();
    lastMediaSyncAtRef.current = new Date().toISOString();
    if (section && section >= 1 && section <= 3) {
      bumpSectionMediaVersion(section);
      return;
    }
    setMediaVersion((prev) => prev + 1);
  };

  async function clearOldCachedMediaExceptActive() {
    try {
      const mediaPath = `${RNFS.DocumentDirectoryPath}/media`;
      const manifestPath = `${mediaPath}/manifest.json`;
      const listPath = `${mediaPath}/list-cache.json`;
      const keepSet = new Set<string>();

      if (await RNFS.exists(listPath)) {
        try {
          const rawList = await RNFS.readFile(listPath, "utf8");
          const list = JSON.parse(rawList || "[]");
          if (Array.isArray(list)) {
            for (const item of list) {
              if (!item || typeof item !== "object") continue;
              const localPath = String(item.localPath || "").trim();
              if (localPath) keepSet.add(localPath);
            }
          }
        } catch {
          // ignore
        }
      }

      if (await RNFS.exists(manifestPath)) {
        try {
          const raw = await RNFS.readFile(manifestPath, "utf8");
          const manifest = JSON.parse(raw || "{}");
          if (manifest && typeof manifest === "object") {
            for (const key of Object.keys(manifest)) {
              const entry = manifest[key];
              const localPath = String(entry?.localPath || "").trim();
              if (localPath) keepSet.add(localPath);
            }
          }
        } catch {
          // ignore
        }
      }

      const filesRoot = `${mediaPath}/files`;
      if (!(await RNFS.exists(filesRoot))) return;
      const entries = await RNFS.readDir(filesRoot);
      let removedCount = 0;
      let removedBytes = 0;
      await Promise.allSettled(
        entries.map(async (entry) => {
          const fullPath = String(entry?.path || "");
          if (!fullPath) return;
          if (keepSet.has(fullPath)) return;
          try {
            removedBytes += Number(entry?.size || 0);
            await RNFS.unlink(fullPath);
            removedCount += 1;
          } catch {
            // ignore
          }
        })
      );
      if (removedCount > 0) {
        console.log(
          "Cache cleanup: removed",
          removedCount,
          "file(s),",
          Math.round(removedBytes / (1024 * 1024)),
          "MB"
        );
      } else {
        console.log("Cache cleanup: no stale files to remove");
      }
    } catch {
      // ignore cleanup errors
    }
  }

  useEffect(() => {
    let mounted = true;
    if (!ENABLE_AUTO_CLEAR_ON_BOOT) {
      setBootReady(true);
      return () => {
        mounted = false;
      };
    }

    const triggerAppReload = () => {
      try {
        const rn = require("react-native");
        if (rn?.NativeModules?.DeviceIdModule?.restartApp) {
          rn.NativeModules.DeviceIdModule.restartApp();
          return true;
        }
        if (rn?.NativeModules?.RNRestart?.Restart) {
          rn.NativeModules.RNRestart.Restart();
          return true;
        }
        if (rn?.DevSettings?.reload) {
          rn.DevSettings.reload();
          return true;
        }
      } catch (_e) {
      }
      return false;
    };

    const autoClearOnBoot = async () => {
      try {
        const markerRaw = await AsyncStorage.getItem(AUTO_CLEAR_BOOT_MARKER_KEY);
        const markerTs = Number(markerRaw || 0);
        const recentMarker =
          Number.isFinite(markerTs) &&
          markerTs > 0 &&
          Date.now() - markerTs < AUTO_CLEAR_BOOT_LOOP_GUARD_MS;

        if (recentMarker) {
          await AsyncStorage.removeItem(AUTO_CLEAR_BOOT_MARKER_KEY);
          if (mounted) setBootReady(true);
          return;
        }

        await AsyncStorage.setItem(
          AUTO_CLEAR_BOOT_MARKER_KEY,
          String(Date.now())
        );

        await clearRuntimePlaybackData();

        const reloaded = triggerAppReload();
        if (!reloaded) {
          await AsyncStorage.removeItem(AUTO_CLEAR_BOOT_MARKER_KEY);
          if (mounted) setBootReady(true);
        }
      } catch (_e) {
        try {
          await AsyncStorage.removeItem(AUTO_CLEAR_BOOT_MARKER_KEY);
        } catch {
        }
        if (mounted) setBootReady(true);
      }
    };

    autoClearOnBoot();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const ErrorUtils = (globalThis as any)?.ErrorUtils;
    if (!ErrorUtils?.setGlobalHandler) return;

    const prevHandler = ErrorUtils.getGlobalHandler ? ErrorUtils.getGlobalHandler() : null;
    ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      const message = String(error?.message || error || "Unknown JS error");
      reportRuntimeError(message, isFatal ? "fatal" : "non-fatal", "js");
      if (__DEV__ && typeof prevHandler === "function") {
        prevHandler(error, isFatal);
      }
    });

    return () => {
      if (typeof prevHandler === "function") {
        ErrorUtils.setGlobalHandler(prevHandler);
      }
    };
  }, []);

  useEffect(() => {
    const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
    if (!nativeDeviceModule) return;
    startEmbeddedCmsServer();
    const emitter = new NativeEventEmitter(nativeDeviceModule);
    const sub = emitter.addListener("apkUpdateProgress", (payload: any) => {
      const status = String(payload?.status || "").trim();
      const message = String(payload?.message || "").trim();
      const percent = Math.max(0, Math.min(100, Number(payload?.percent || 0)));
      const detail = String(payload?.detail || "").trim();
      pushDiagnosticEvent("apk-update", detail ? `${status}: ${detail}` : `${status}: ${message}`);
      setApkUpdateState({
        status,
        message: message || "Updating app...",
        percent,
        visible: status !== "hidden",
      });
      if (status === "error" && detail) {
        reportRuntimeError("APK update failed", detail, "apk-update");
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
    if (!nativeDeviceModule) return;
    const emitter = new NativeEventEmitter(nativeDeviceModule);
    const sub = emitter.addListener("embeddedCmsEvent", async (event: any) => {
      try {
        const type = String(event?.type || "").trim();
        const payload = event?.payload ? JSON.parse(String(event.payload)) : {};
        if (type === "config-updated") {
          sourceManagerRef.current.onCmsUpdate();
          const loadedConfig = await loadConfig(setConfig);
          setSectionPlaybackTimeline(normalizePlaybackTimeline(loadedConfig?.playbackTimeline));
          lastConfigSyncAtRef.current = new Date().toISOString();
          return;
        }
        if (type === "media-updated") {
          sourceManagerRef.current.onCmsUpdate();
          const section = Number(payload?.section || 0);
          await refreshPlayerMediaImmediately(section);
          void finalizePlayerMediaRefresh(section);
          return;
        }
        if (type === "device-command") {
          const action = String(payload?.action || "").trim();
          if (action === "force-sync" || action === "refresh-content" || action === "refresh") {
            sourceManagerRef.current.onCmsUpdate();
            await refreshPlayerMediaImmediately();
            void finalizePlayerMediaRefresh();
            return;
          }
          if (action === "deep-clear-data") {
            await clearRuntimeDeepData();
            if (nativeDeviceModule?.restartApp) {
              nativeDeviceModule.restartApp();
            } else {
              const { DevSettings } = require("react-native");
              DevSettings.reload();
            }
            return;
          }
          if (nativeDeviceModule?.executeDeviceCommand) {
            await nativeDeviceModule.executeDeviceCommand(
              action,
              JSON.stringify(payload || {})
            );
          }
          return;
        }
      } catch {
      }
    });
    return () => {
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!bootReady) return;
    const spinLoop = Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );

    spinLoop.start();
    pulseLoop.start();

    return () => {
      spinLoop.stop();
      pulseLoop.stop();
    };
  }, [bootReady, pulseValue, spinValue]);

  useEffect(() => {
    if (!bootReady) return;
    let mounted = true;
    const initLicense = async () => {
      try {
        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        const deviceId = String(nativeDeviceModule?.getDeviceId?.() || "").trim();
        deviceIdRef.current = deviceId || "unknown";
        if (!mounted) return;
        setLicenseDeviceId(deviceId || "unknown");
        let storedLicense = { deviceId: "", licenseKey: "" };
        let active = false;

        for (let attempt = 0; attempt < LICENSE_INIT_RETRY_COUNT; attempt += 1) {
          storedLicense = await readStoredLicense();
          if (!mounted) return;

          if (storedLicense.licenseKey) {
            setLicenseInput(storedLicense.licenseKey);
          }

          active = deviceId ? await hasLocalActivationForDevice(deviceId) : false;
          if (active) break;

          const hasStoredKeyForDevice =
            storedLicense.deviceId === deviceId && !!storedLicense.licenseKey;
          if (hasStoredKeyForDevice) {
            active = true;
            break;
          }

          if (attempt < LICENSE_INIT_RETRY_COUNT - 1) {
            await wait(LICENSE_INIT_RETRY_DELAY_MS);
          }
        }

        if (!mounted) return;
        setLicensed(!!active);
        setLicenseStatus(
          active
            ? "Device activated. Starting player..."
            : "License required. Enter key to activate."
        );
      } catch (_e) {
        if (!mounted) return;
        setLicensed(false);
        setLicenseStatus("Unable to read device id.");
      } finally {
        if (mounted) setLicenseReady(true);
      }
    };
    initLicense();
    return () => {
      mounted = false;
    };
  }, [bootReady]);

  useEffect(() => {
    if (!bootReady) return;
    let mounted = true;

    const inspectPendingApkUpdate = async () => {
      try {
        const raw = await AsyncStorage.getItem(APK_UPDATE_PENDING_KEY);
        if (!raw || !mounted) return;
        const pending = JSON.parse(String(raw || "{}"));
        const requestedAt = Number(pending?.requestedAt || 0);
        const previousVersion = String(pending?.previousVersion || "").trim();
        const apkUrl = String(pending?.apkUrl || "").trim();

        if (
          !requestedAt ||
          Date.now() - requestedAt > APK_UPDATE_PENDING_MAX_AGE_MS
        ) {
          await AsyncStorage.removeItem(APK_UPDATE_PENDING_KEY);
          return;
        }

        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        const currentVersion = String(nativeDeviceModule?.getAppVersion?.() || "").trim();
        if (!currentVersion || !previousVersion || currentVersion === previousVersion) {
          return;
        }

        pendingApkUpdateSuccessRef.current = {
          apkUrl,
          previousVersion,
          currentVersion,
          requestedAt,
          reportedAt: new Date().toISOString(),
        };
        await AsyncStorage.removeItem(APK_UPDATE_PENDING_KEY);
      } catch (_e) {
      }
    };

    inspectPendingApkUpdate();
    return () => {
      mounted = false;
    };
  }, [bootReady]);

  const onActivateLicense = async () => {
    if (licenseBusy) return;
    setLicenseBusy(true);
    const result = await activateDeviceWithKey(licenseDeviceId, licenseInput);
    setLicenseBusy(false);
    setLicenseStatus(result.message);
    if (result.success) {
      setLicenseInput(String(licenseInput || "").trim().toUpperCase());
      setLicensed(true);
      setReady(false);
    }
  };

  useEffect(() => {
    if (!bootReady || !licenseReady || !licensed) return;
    let isMounted = true;
    let watchdogTimer: ReturnType<typeof setInterval> | null = null;
    let healthTimer: ReturnType<typeof setInterval> | null = null;
    let networkRecoveryTimer: ReturnType<typeof setInterval> | null = null;
    let networkQualityTimer: ReturnType<typeof setInterval> | null = null;
    let selfHealTimer: ReturnType<typeof setInterval> | null = null;
    let cacheGuardTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setInterval> | null = null;
    let offlineNoticeTimer: ReturnType<typeof setInterval> | null = null;
    let deferredStartTimer: ReturnType<typeof setTimeout> | null = null;
    let initRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let mediaUpdateTimer: ReturnType<typeof setTimeout> | null = null;
    let initInProgress = false;
    let reconnectMissCount = 0;
    let lastWatchdogTick = Date.now();
    const setConnectTexts = (subtitle: string, status: string) => {
      if (!isMounted) return;
      setConnectSubtitleText(subtitle);
      setConnectStatusText(status);
    };

    function safeRestartApp(reason: string) {
      if (socket?.connected) {
        socket.emit("device-error", {
          deviceId: deviceIdRef.current,
          type: "restart",
          message: `App restart triggered: ${reason}`,
        });
      }
      console.log("Restarting app:", reason);
      try {
        const rn = require("react-native");
        if (rn?.NativeModules?.DeviceIdModule?.restartApp) {
          rn.NativeModules.DeviceIdModule.restartApp();
          return;
        }
        if (rn?.NativeModules?.RNRestart?.Restart) {
          rn.NativeModules.RNRestart.Restart();
          return;
        }
        if (rn?.DevSettings?.reload) {
          rn.DevSettings.reload();
          return;
        }
      } catch (e) {
        console.log("Restart failed", e);
      }
    }

    const startDisconnectRecovery = (_reason: string) => {
      // Offline-first mode: do not auto-restart app on CMS disconnect.
      // Player should continue using cached config/media.
    };

    const clearDisconnectRecovery = () => {
      // no-op in offline-first mode
    };

    const startWatchdog = () => {
      if (watchdogTimer) return;
      lastWatchdogTick = Date.now();
      watchdogTimer = setInterval(() => {
        const now = Date.now();
        const delta = now - lastWatchdogTick;
        lastWatchdogTick = now;
        if (delta > WATCHDOG_INTERVAL_MS + WATCHDOG_STALL_MS) {
          safeRestartApp(`js-stall ${delta}ms`);
        }
      }, WATCHDOG_INTERVAL_MS);
    };

    const stopWatchdog = () => {
      if (!watchdogTimer) return;
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    };

    const checkAndRecoverNetwork = () => {
      try {
        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        if (!nativeDeviceModule?.getNetworkState) return;

        const networkState = nativeDeviceModule.getNetworkState() || {};
        const hasInternet = !!networkState?.internet;
        const connected = !!networkState?.connected;
        if (hasInternet || connected) {
          offlineNoticeDismissedRef.current = false;
          if (offlineNoticeRef.current) setOfflineNotice("");
          return;
        }

        setConnectTexts(
          "Internet OFF detected. Running offline",
          "Offline mode"
        );

        if (!offlineNoticeDismissedRef.current) {
          setOfflineNotice("Internet not connected. Running in offline mode.");
        }

        if (ENABLE_AUTO_WIFI_RECOVERY && nativeDeviceModule?.tryRecoverInternet) {
          const recovery = nativeDeviceModule.tryRecoverInternet();
          emitDeviceHealth("network-recovery", { networkState, recovery });
        } else {
          emitDeviceHealth("network-recovery", { networkState, recovery: null });
        }
      } catch (e) {
        console.log("Network recovery check failed", e);
      }
    };

    const startNetworkRecoveryLoop = () => {
      if (!ENABLE_NETWORK_RECOVERY_LOOP) return;
      if (networkRecoveryTimer) return;
      checkAndRecoverNetwork();
      networkRecoveryTimer = setInterval(() => {
        checkAndRecoverNetwork();
      }, NETWORK_RECOVERY_INTERVAL_MS);
    };

    const stopNetworkRecoveryLoop = () => {
      if (!networkRecoveryTimer) return;
      clearInterval(networkRecoveryTimer);
      networkRecoveryTimer = null;
    };

    const refreshOfflineNotice = () => {
      try {
        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        if (!nativeDeviceModule?.getNetworkState) return;
        const networkState = nativeDeviceModule.getNetworkState() || {};
        const hasInternet = !!networkState?.internet;
        const connected = !!networkState?.connected;
        if (hasInternet || connected) {
          offlineNoticeDismissedRef.current = false;
          if (offlineNoticeRef.current) setOfflineNotice("");
          return;
        }
        if (!offlineNoticeDismissedRef.current) {
          setOfflineNotice("Internet not connected. Running in offline mode.");
        }
      } catch {
      }
    };

    const startOfflineNoticeLoop = () => {
      if (offlineNoticeTimer) return;
      refreshOfflineNotice();
      offlineNoticeTimer = setInterval(refreshOfflineNotice, OFFLINE_NOTICE_POLL_MS);
    };

    const stopOfflineNoticeLoop = () => {
      if (!offlineNoticeTimer) return;
      clearInterval(offlineNoticeTimer);
      offlineNoticeTimer = null;
    };

    const pingServer = async (serverUrl: string, timeoutMs: number) => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const start = Date.now();
      try {
        const res = await fetch(`${serverUrl}/ping?ts=${Date.now()}`, {
          method: "GET",
          signal: controller.signal,
          headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
        });
        const latency = Date.now() - start;
        return res?.ok ? latency : null;
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    const assessNetworkQuality = async () => {
      const server = getServer();
      if (!server) return;
      const latency = await pingServer(server, NETWORK_QUALITY_VERY_SLOW_MS + 1500);
      let quality = "good";
      if (latency === null) {
        quality = "offline";
      } else if (latency > NETWORK_QUALITY_VERY_SLOW_MS) {
        quality = "very-slow";
      } else if (latency > NETWORK_QUALITY_SLOW_MS) {
        quality = "slow";
      }

      if (quality !== networkQualityRef.current) {
        networkQualityRef.current = quality;
      }

      if (quality === "offline") {
        setDownloadConcurrencyOverride(0);
      } else if (quality === "very-slow") {
        setDownloadConcurrencyOverride(1);
      } else if (quality === "slow") {
        setDownloadConcurrencyOverride(2);
      } else {
        setDownloadConcurrencyOverride(null);
      }
    };

    const startNetworkQualityLoop = () => {
      if (networkQualityTimer) return;
      assessNetworkQuality();
      networkQualityTimer = setInterval(() => {
        assessNetworkQuality();
      }, NETWORK_QUALITY_CHECK_INTERVAL_MS);
    };

    const stopNetworkQualityLoop = () => {
      if (!networkQualityTimer) return;
      clearInterval(networkQualityTimer);
      networkQualityTimer = null;
      setDownloadConcurrencyOverride(null);
    };

    const startSelfHealSyncLoop = () => {
      if (selfHealTimer) return;
      selfHealTimer = setInterval(async () => {
        if (!socket?.connected && !USE_EMBEDDED_CMS) return;
        try {
          const configLoaded = await loadConfig(setConfig);
          if (!configLoaded) {
            emitDeviceError("self-heal-config", "Config refresh failed");
            return;
          }
          await syncMedia();
          emitDeviceHealth("self-heal-sync");
        } catch (e) {
          emitDeviceError("self-heal-sync", String((e as any)?.message || e));
        }
      }, SELF_HEAL_SYNC_INTERVAL_MS);
    };

    const stopSelfHealSyncLoop = () => {
      if (!selfHealTimer) return;
      clearInterval(selfHealTimer);
      selfHealTimer = null;
    };

    const startCacheGuardLoop = () => {
      if (cacheGuardTimer) return;
      cacheGuardTimer = setInterval(async () => {
        await pruneCacheIfLow(CACHE_MIN_FREE_BYTES);
      }, CACHE_GUARD_INTERVAL_MS);
    };

    const stopCacheGuardLoop = () => {
      if (!cacheGuardTimer) return;
      clearInterval(cacheGuardTimer);
      cacheGuardTimer = null;
    };

    const resetSocketConnection = () => {
      try {
        if (socket) {
          socket.removeAllListeners();
          socket.disconnect();
        }
      } catch {
      }
      socket = null;
      socketUrlRef.current = "";
    };

    const startReconnectLoop = () => {
      if (USE_EMBEDDED_CMS) return;
      if (reconnectTimer) return;
      reconnectTimer = setInterval(async () => {
        if (!isMounted || initInProgress) return;
        if (socket?.connected) {
          reconnectMissCount = 0;
          return;
        }
        try {
          const restoredUrl = await restoreServerFromStorage();
          const preferredUrl = restoredUrl || socketUrlRef.current || getServer();
          reconnectMissCount += 1;
          if (
            socket &&
            !socket.connected &&
            reconnectMissCount <= 2 &&
            (!preferredUrl || preferredUrl === socketUrlRef.current)
          ) {
            socket.connect();
            return;
          }
          const discoveredUrl = preferredUrl || (await findCMS());
          if (
            discoveredUrl &&
            socket &&
            socketUrlRef.current &&
            discoveredUrl !== socketUrlRef.current
          ) {
            resetSocketConnection();
          } else if (socket && reconnectMissCount >= 3) {
            resetSocketConnection();
          }
        } catch {
        }
        await init();
      }, RECONNECT_RETRY_INTERVAL_MS);
    };

    const stopReconnectLoop = () => {
      if (!reconnectTimer) return;
      clearInterval(reconnectTimer);
      reconnectTimer = null;
    };

    const scheduleInitRetry = () => {
      if (initRetryTimer) return;
      initRetryTimer = setTimeout(() => {
        initRetryTimer = null;
        if (isMounted) init();
      }, INIT_RETRY_DELAY_MS);
    };

    const emitDeviceHealth = (appState: string, meta: any = null) => {
      if (!socket?.connected) return;
      socket.emit("device-health", {
        deviceId: deviceIdRef.current,
        appState,
        meta,
      });
    };

    const emitDeviceError = (type: string, message: string) => {
      if (!socket?.connected) return;
      socket.emit("device-error", {
        deviceId: deviceIdRef.current,
        type,
        message,
      });
    };

    const collectDeviceMeta = async (
      extra: Record<string, any> = {},
      options: { forceStorageScan?: boolean } = {}
    ) => {
      const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
      let storageStats = { freeBytes: 0, totalBytes: 0 };
      let appVersion = "";

      try {
        if (nativeDeviceModule?.getStorageStats) {
          storageStats = nativeDeviceModule.getStorageStats() || storageStats;
        }
      } catch {
      }

      try {
        if (nativeDeviceModule?.getAppVersion) {
          appVersion = String(nativeDeviceModule.getAppVersion() || "");
        }
      } catch {
      }

      let deviceName = "";
      try {
        if (nativeDeviceModule?.getDeviceName) {
          deviceName = String(nativeDeviceModule.getDeviceName() || "");
        }
      } catch {
      }

      const now = Date.now();
      const shouldRefreshStorage =
        !!options.forceStorageScan ||
        now - Number(deviceMetaCacheRef.current.at || 0) > DEVICE_META_CACHE_MS;
      if (shouldRefreshStorage) {
        const mediaBytes = await getPathSizeSafe(`${RNFS.DocumentDirectoryPath}/media`);
        const configBytes = await getPathSizeSafe(`${RNFS.DocumentDirectoryPath}/config.json`);
        const cacheBytes = await getPathSizeSafe(RNFS.CachesDirectoryPath);
        deviceMetaCacheRef.current = {
          at: now,
          mediaBytes,
          configBytes,
          cacheBytes,
        };
      }

      const {
        mediaBytes,
        configBytes,
        cacheBytes,
      } = deviceMetaCacheRef.current;

      return {
        appVersion,
        deviceName,
        licensed,
        server: getServer(),
        currentPlaybackBySection: playbackBySectionRef.current,
        recentDiagnostics: diagnosticEventsRef.current,
        lastConfigSyncAt: lastConfigSyncAtRef.current,
        lastMediaSyncAt: lastMediaSyncAtRef.current,
        playbackStats: playbackStatsRef.current,
        mediaBytes,
        configBytes,
        cacheBytes,
        freeBytes: Number(storageStats?.freeBytes || 0),
        totalBytes: Number(storageStats?.totalBytes || 0),
        ...extra,
      };
    };

    const emitDeviceHealthSnapshot = async (
      appState: string,
      extra: Record<string, any> = {},
      options: { forceStorageScan?: boolean } = {}
    ) => {
      const cacheSummary = await getCacheSummary();
      const meta = await collectDeviceMeta({
        mediaCacheSummary: cacheSummary,
        ...extra,
      }, options);
      lastMetaRef.current = meta;
      setEmbeddedRuntimeInfo({
        deviceId: deviceIdRef.current,
        appState,
        meta,
      });
      emitDeviceHealth(appState, meta);
    };

    const onClearData = async () => {
      console.log("Clear data command received");

      try {
        resetRuntimePlaybackSnapshots();
        await clearRuntimeDeepData();

        console.log("Data cleared");
        await emitDeviceHealthSnapshot("deep-clear-data", {
          preservedIdentity: true,
        }, { forceStorageScan: true });
        const { DevSettings } = require("react-native");
        DevSettings.reload();
      } catch (e) {
        console.log("Clear failed", e);
        emitDeviceError("clear-data", `Clear failed: ${String((e as any)?.message || e)}`);
      }
    };

    const onClearCache = async () => {
      try {
        await clearRuntimeCacheOnly();
        await emitDeviceHealthSnapshot("clear-cache", {}, { forceStorageScan: true });
        await syncMedia({ force: true, blockUntilCachedSmallBytes: SMALL_CACHE_BLOCK_BYTES });
        if (isMounted) {
          setMediaVersion((prev) => prev + 1);
        }
      } catch (e) {
        emitDeviceError("clear-cache", `Clear cache failed: ${String((e as any)?.message || e)}`);
      }
    };

    const onDeepClearData = async () => {
      try {
        await clearRuntimeDeepData();
        await emitDeviceHealthSnapshot("deep-clear-data", {
          preservedIdentity: true,
        }, { forceStorageScan: true });
        safeRestartApp("deep clear data command");
      } catch (e) {
        emitDeviceError("deep-clear-data", `Deep clear failed: ${String((e as any)?.message || e)}`);
      }
    };

    const onRenameDevice = async (payload: any) => {
      try {
        const nextName = String(payload?.deviceName || "").trim();
        if (!nextName) return;
        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        if (nativeDeviceModule?.setDeviceName) {
          nativeDeviceModule.setDeviceName(nextName);
          await emitDeviceHealthSnapshot("device-name-updated", {
            deviceName: nextName,
          });
        }
      } catch (e) {
        emitDeviceError("rename-device", `Rename failed: ${String((e as any)?.message || e)}`);
      }
    };

    const onGenericDeviceCommand = async (payload: any) => {
      const action = String(payload?.action || "").trim();
      try {
        if (action === "force-sync" || action === "refresh-content" || action === "refresh") {
          await refreshPlayerMediaImmediately();
          await finalizePlayerMediaRefresh();
          await emitDeviceHealthSnapshot(`command-${action}`, { action });
          return;
        }
        if (action === "deep-clear-data") {
          await onDeepClearData();
          return;
        }
        const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
        if (nativeDeviceModule?.executeDeviceCommand) {
          await nativeDeviceModule.executeDeviceCommand(
            action,
            JSON.stringify(payload || {})
          );
          await emitDeviceHealthSnapshot(`command-${action}`, { action, payload });
        }
      } catch (e) {
        emitDeviceError("device-command", `${action || "unknown"} failed: ${String((e as any)?.message || e)}`);
      }
    };

    const init = async () => {
      if (initInProgress) return;
      initInProgress = true;
      try {
        if (USE_EMBEDDED_CMS) {
          startEmbeddedCmsServer();
          await restoreServerFromStorage();
          const localServer = getServer();
          deviceIdRef.current = String(
            (NativeModules as any)?.DeviceIdModule?.getDeviceId?.() || deviceIdRef.current
          );
          setConnectTexts(
            localServer
              ? `Local CMS ready at ${localServer}`
              : "Starting local TV CMS",
            "Local CMS"
          );
          const loadedConfig = await loadConfig(setConfig);
          setSectionPlaybackTimeline(normalizePlaybackTimeline(loadedConfig?.playbackTimeline));
          if (loadedConfig) {
            lastConfigSyncAtRef.current = new Date().toISOString();
          }
          await syncMedia({
            force: true,
            forceHard: true,
            blockUntilCachedSmallBytes: SMALL_CACHE_BLOCK_BYTES,
          });
          lastMediaSyncAtRef.current = new Date().toISOString();
          await emitDeviceHealthSnapshot("ready", { ready: true }, { forceStorageScan: true });
          if (healthTimer) clearInterval(healthTimer);
          healthTimer = setInterval(async () => {
            await emitDeviceHealthSnapshot("ready", { ready: true });
          }, 15000);
          if (isMounted) {
            setReady(true);
            setConnectTexts("TV-hosted CMS is active. Player is ready.", "Ready");
          }
          return;
        }
        await restoreServerFromStorage();
        const restoredServer = getServer();
        const cachedConfig = await loadConfig(setConfig);
        await syncMedia({ blockUntilCachedSmallBytes: SMALL_CACHE_BLOCK_BYTES });
        const cachedMedia = await hasCachedMedia();
        if (isMounted && (cachedConfig || cachedMedia)) {
          setConnectTexts(
            restoredServer
              ? "Saved CMS found. Opening cached content while reconnecting"
              : "CMS offline. Playing cached content",
            "Offline playback"
          );
          setReady(true);
        }
        if (ENABLE_NETWORK_RECOVERY_LOOP) checkAndRecoverNetwork();
        if (restoredServer) {
          setConnectTexts(`Reconnecting to saved CMS at ${restoredServer}`, "Reconnecting");
        } else {
          setConnectTexts("Scanning local network for CMS server", "Network scan running");
        }
        const url = restoredServer || (await findCMS());
        if (!url) {
          pushDiagnosticEvent("cms", "CMS not found. Using cached playback");
          console.log("No CMS found – using cached content if available");
          if (ENABLE_NETWORK_RECOVERY_LOOP) checkAndRecoverNetwork();
          if (isMounted) {
            if (cachedConfig || cachedMedia) {
              setConnectTexts(
                cachedConfig
                  ? "CMS offline. Playing cached content"
                  : "CMS not found. Playing cached content",
                "Offline playback"
              );
              setReady(true);
            } else {
              setConnectTexts("CMS not found. Showing empty player", "Offline");
              setReady(true);
            }
          }
          scheduleInitRetry();
          return;
        }

        const { DeviceIdModule } = NativeModules;
        const deviceId = await DeviceIdModule.getDeviceId();
        deviceIdRef.current = deviceId;
        setConnectTexts(
          `CMS found at ${url}. Opening secure socket`,
          "Connecting to server"
        );

        socket = io(url, {
          transports: ["websocket"],
          reconnection: true,
          reconnectionAttempts: Infinity,
          reconnectionDelay: 3000,
        });
        socketUrlRef.current = url;

        socket.on("connect", async () => {
          sourceManagerRef.current.setBrowserCmsActive(true);
          if (offlineNoticeRef.current) {
            setOfflineNotice("");
          }
          reconnectMissCount = 0;
          pushDiagnosticEvent("socket", `Connected to ${url}`);
          console.log("Connected:", deviceId);
          stopReconnectLoop();
          clearDisconnectRecovery();
          socket?.emit("register-device", deviceId);
          await emitDeviceHealthSnapshot("connected", { phase: "socket-connected" }, { forceStorageScan: true });
          setConnectTexts("Connected. Downloading device configuration", "Syncing config");

          const loadedConfig = await loadConfig(setConfig);
          setSectionPlaybackTimeline(normalizePlaybackTimeline(loadedConfig?.playbackTimeline));
          if (!loadedConfig) {
            emitDeviceError("config", "Config unavailable from server and local cache");
            setConnectTexts("Config unavailable. Retrying automatically", "Config retry");
            resetSocketConnection();
            if (isMounted) setReady(false);
            scheduleInitRetry();
            return;
          }
          lastConfigSyncAtRef.current = new Date().toISOString();
          emitDeviceHealth("syncing-config");
          setConnectTexts("Configuration received. Syncing media catalog", "Syncing media");
          const cachedMediaAvailable = await hasCachedMedia();
          if (cachedMediaAvailable && isMounted) {
            setConnectTexts("Playing cached content. Syncing in background", "Ready");
            setReady(true);
          }
          try {
            await syncMedia({
              force: true,
              forceHard: true,
              blockUntilCachedSmallBytes: SMALL_CACHE_BLOCK_BYTES,
            });
            lastMediaSyncAtRef.current = new Date().toISOString();
            await emitDeviceHealthSnapshot("syncing-media", {}, { forceStorageScan: true });
          } finally {
            if (isMounted) {
              setConnectTexts("Setup complete. Starting player", "Ready");
              setReady(true);
            }
          }

          if (healthTimer) clearInterval(healthTimer);
          healthTimer = setInterval(async () => {
            await emitDeviceHealthSnapshot("ready", { ready: true });
          }, 15000);

          if (pendingApkUpdateSuccessRef.current) {
            await emitDeviceHealthSnapshot("apk-update-success", {
              apkUpdate: {
                status: "success",
                ...pendingApkUpdateSuccessRef.current,
              },
            }, { forceStorageScan: true });
            pendingApkUpdateSuccessRef.current = null;
          }

          if (isMounted) setReady(true);
        });

        // Media update: refresh slideshow immediately, then sync/cache in background.
        socket.on("media-updated", (payload) => {
          sourceManagerRef.current.onCmsUpdate();
          const syncAt = Number(payload?.syncAt || 0);
          const section = Number(payload?.section || 0);
          if (section) {
            setPrioritySection(section);
          }
          if (section && payload?.timeline) {
            mergePlaybackTimeline(section, payload.timeline);
          }
          if (!section) {
            if (syncAt > Date.now()) {
              setPlaylistSyncAt(syncAt);
            } else {
              setPlaylistSyncAt(Date.now());
            }
          }
          emitDeviceHealth("media-updated-received");
          if (mediaUpdateTimer) clearTimeout(mediaUpdateTimer);
          mediaUpdateTimer = setTimeout(async () => {
            mediaUpdateTimer = null;
            try {
              await refreshPlayerMediaImmediately(section);
              await finalizePlayerMediaRefresh(section);
            } finally {
              await emitDeviceHealthSnapshot("media-updated-synced", {}, { forceStorageScan: true });
            }
          }, MEDIA_UPDATE_DEBOUNCE_MS);
        });

        // Config-only update should apply settings without restarting media playback.
        socket.on("config-updated", async () => {
          sourceManagerRef.current.onCmsUpdate();
          const loadedConfig = await loadConfig(setConfig);
          if (loadedConfig) {
            setSectionPlaybackTimeline(normalizePlaybackTimeline(loadedConfig?.playbackTimeline));
            lastConfigSyncAtRef.current = new Date().toISOString();
            emitDeviceHealth("config-updated");
          } else {
            emitDeviceError("config-updated", "Config refresh failed");
          }
        });

        socket.on("section-upload-status", (payload) => {
          const section = Number(payload?.section || 0);
          if (!section || section < 1 || section > 3) return;

          const status = String(payload?.status || "").toLowerCase();
          const message = String(payload?.message || "").trim();
          const total = Number(payload?.total || payload?.count || 0);
          const uploaded = Number(payload?.uploaded || payload?.done || 0);
          const countSuffix = total
            ? ` (${uploaded > 0 ? uploaded : total}/${total})`
            : "";

          if (status === "processing") {
            setPrioritySection(section);
            setUploadProcessingBySection((prev) => ({
              ...prev,
              [section]: `${message || "Uploading... Please wait."}${countSuffix}`,
            }));
            if (total > 0) {
              setUploadCountsBySection((prev) => ({
                ...prev,
                [section]: { uploaded, total },
              }));
            }
            return;
          }

          if (status === "ready") {
            setPrioritySection(section);
            setUploadProcessingBySection((prev) => ({
              ...prev,
              [section]: "Applying new media on device... Please wait.",
            }));
            if (total > 0) {
              setUploadCountsBySection((prev) => ({
                ...prev,
                [section]: { uploaded: total, total },
              }));
            }
            if (section >= 1 && section <= 3) {
              const existing = sectionRefreshTimersRef.current[section];
              if (existing) {
                clearTimeout(existing);
              }
              sectionRefreshTimersRef.current[section] = setTimeout(async () => {
                sectionRefreshTimersRef.current[section] = null;
                try {
                  await refreshPlayerMediaImmediately(section);
                  await syncMedia({
                    force: true,
                    forceHard: true,
                    blockUntilCachedSmallBytes: SMALL_CACHE_BLOCK_BYTES,
                    pruneStaleNow: true,
                  });
                  await clearRuntimeTransientCache();
                  await clearOldCachedMediaExceptActive();
                  lastMediaSyncAtRef.current = new Date().toISOString();
                  if (isMounted) {
                    bumpSectionMediaVersion(section);
                  }
                  setUploadProcessingBySection((prev) => {
                    const next = { ...prev };
                    delete next[section];
                    return next;
                  });
                  setUploadCountsBySection((prev) => {
                    const next = { ...prev };
                    delete next[section];
                    return next;
                  });
                  await emitDeviceHealthSnapshot("section-upload-ready", { section }, { forceStorageScan: true });
                } catch (_e) {
                  setUploadProcessingBySection((prev) => ({
                    ...prev,
                    [section]: "New media received, but device refresh failed. Retrying on next sync.",
                  }));
                }
              }, 400);
            }
            return;
          }

          if (status === "error") {
            setUploadProcessingBySection((prev) => ({
              ...prev,
              [section]: message || "Upload failed. Please try again.",
            }));
            setUploadCountsBySection((prev) => {
              const next = { ...prev };
              delete next[section];
              return next;
            });
            return;
          }
        });

        socket.on("clear-data", onClearData);
        socket.on("deep-clear-data", onDeepClearData);
        socket.on("clear-cache", onClearCache);
        socket.on("restart-app", () => safeRestartApp("manual restart command"));
        socket.on("rename-device", onRenameDevice);
        socket.on("device-command", onGenericDeviceCommand);
        socket.on("install-app-update", async (payload) => {
          try {
            const nativeDeviceModule = (NativeModules as any)?.DeviceIdModule;
            const rawApkUrl = String(payload?.apkUrl || "").trim();
            const serverBase = String(getServer() || "").trim();
            const apkUrl =
              rawApkUrl && /^https?:\/\//i.test(rawApkUrl)
                ? rawApkUrl
                : rawApkUrl && serverBase
                ? `${serverBase}${rawApkUrl.startsWith("/") ? rawApkUrl : `/${rawApkUrl}`}`
                : "";
            if (!apkUrl || !nativeDeviceModule?.installApkUpdate) {
              throw new Error("APK update not available");
            }
            const previousVersion = String(nativeDeviceModule?.getAppVersion?.() || "").trim();
            await AsyncStorage.setItem(
              APK_UPDATE_PENDING_KEY,
              JSON.stringify({
                apkUrl,
                previousVersion,
                requestedAt: Date.now(),
              })
            );
            await emitDeviceHealthSnapshot("install-app-update", {
              apkUrl,
              apkUpdate: {
                status: "installing",
                previousVersion,
                requestedAt: new Date().toISOString(),
              },
            }, { forceStorageScan: true });
            nativeDeviceModule.installApkUpdate(apkUrl);
          } catch (e) {
            emitDeviceError("install-app-update", String((e as any)?.message || e));
          }
        });
        socket.on("set-auto-reopen", (payload) => {
          try {
            const enabled = !!payload?.enabled;
            const { DeviceIdModule: NativeDeviceModule } = NativeModules;
            if (NativeDeviceModule?.setAutoReopenEnabled) {
              NativeDeviceModule.setAutoReopenEnabled(enabled);
              emitDeviceHealth("auto-reopen-updated", { enabled });
            }
          } catch (e) {
            emitDeviceError("auto-reopen", `Failed to update auto reopen: ${String((e as any)?.message || e)}`);
          }
        });
        socket.on("disconnect", (reason) => {
          sourceManagerRef.current.setBrowserCmsActive(false);
          pushDiagnosticEvent("socket", `Disconnected: ${String(reason)}`);
          setConnectTexts(
            `Connection lost (${String(reason)}). Continuing cached playback`,
            "Offline mode"
          );
          reconnectMissCount = 0;
          startReconnectLoop();
          startDisconnectRecovery(`disconnect:${String(reason)}`);
        });
        socket.on("connect_error", (err) => {
          sourceManagerRef.current.setBrowserCmsActive(false);
          pushDiagnosticEvent("socket", `Connect error: ${String(err?.message || "unknown")}`);
          if (ENABLE_NETWORK_RECOVERY_LOOP) checkAndRecoverNetwork();
          setConnectTexts(
            "Socket unavailable. Continuing cached playback",
            "Offline mode"
          );
          reconnectMissCount = Math.max(reconnectMissCount, 1);
          startReconnectLoop();
          emitDeviceError("connect-error", err?.message || "unknown");
          startDisconnectRecovery(`connect_error:${err?.message || "unknown"}`);
        });
      } catch (err) {
        console.log("Init error", err);
        if (socket?.connected) {
          socket.emit("device-error", {
            deviceId: deviceIdRef.current,
            type: "init",
            message: String((err as any)?.message || err),
          });
        }
        setConnectTexts("Startup failed unexpectedly", "Recovery mode");
        if (isMounted) setReady(false);
      } finally {
        initInProgress = false;
      }
    };

    init();
    (Immersive as any).on();
    startWatchdog();
    startNetworkRecoveryLoop();
    startReconnectLoop();
    startOfflineNoticeLoop();
    deferredStartTimer = setTimeout(() => {
      startNetworkQualityLoop();
      startSelfHealSyncLoop();
      startCacheGuardLoop();
    }, STARTUP_DEFER_MS);

    return () => {
      isMounted = false;
      clearDisconnectRecovery();
      stopWatchdog();
      stopNetworkRecoveryLoop();
      stopNetworkQualityLoop();
      stopSelfHealSyncLoop();
      stopCacheGuardLoop();
      stopReconnectLoop();
      stopOfflineNoticeLoop();
      if (deferredStartTimer) {
        clearTimeout(deferredStartTimer);
        deferredStartTimer = null;
      }
      if (initRetryTimer) {
        clearTimeout(initRetryTimer);
        initRetryTimer = null;
      }
      if (mediaUpdateTimer) {
        clearTimeout(mediaUpdateTimer);
        mediaUpdateTimer = null;
      }
      if (offlineNoticeTimerRef.current) {
        clearTimeout(offlineNoticeTimerRef.current);
        offlineNoticeTimerRef.current = null;
      }
      if (healthTimer) {
        clearInterval(healthTimer);
        healthTimer = null;
      }
      if (socket) {
        socket.off("connect");
        socket.off("media-updated");
        socket.off("config-updated");
        socket.off("clear-data", onClearData);
        socket.off("deep-clear-data", onDeepClearData);
        socket.off("clear-cache", onClearCache);
        socket.off("restart-app");
        socket.off("rename-device", onRenameDevice);
        socket.off("device-command", onGenericDeviceCommand);
        socket.off("install-app-update");
        socket.off("set-auto-reopen");
        socket.off("section-upload-status");
        socket.off("disconnect");
        socket.off("connect_error");
        resetSocketConnection();
      }
      socketUrlRef.current = "";
    };
  }, [bootReady, licenseReady, licensed]);

  useEffect(() => {
    if (!config) return;
    try {
      const rawMb = Number(config?.cache?.videoMB || 0);
      const { DeviceIdModule: NativeDeviceModule } = NativeModules as any;
      if (!NativeDeviceModule?.setVideoCacheMaxBytes) return;
      const stats = NativeDeviceModule?.getStorageStats?.() || {};
      const freeBytes = Number(stats?.freeBytes || 0);
      const totalBytes = Number(stats?.totalBytes || 0);
      let adaptiveMb = Number.isFinite(rawMb) && rawMb > 0 ? rawMb : 128;
      if (totalBytes > 0 && totalBytes <= 4.5 * 1024 * 1024 * 1024) {
        adaptiveMb = Math.min(adaptiveMb, 128);
      }
      if (freeBytes > 0 && freeBytes <= 1.2 * 1024 * 1024 * 1024) {
        adaptiveMb = Math.min(adaptiveMb, 64);
      } else if (freeBytes > 0 && freeBytes <= 2.2 * 1024 * 1024 * 1024) {
        adaptiveMb = Math.min(adaptiveMb, 96);
      } else {
        adaptiveMb = Math.min(adaptiveMb, 160);
      }
      const bytes = Math.max(64, Math.round(adaptiveMb)) * 1024 * 1024;
      NativeDeviceModule.setVideoCacheMaxBytes(bytes);
    } catch {
    }
  }, [config]);

  useEffect(() => {
    // Soft throttle for non-priority sections to keep playback smooth.
    setNonPriorityThrottleMs(120);
  }, []);

  if (!bootReady) {
    return (
      <View style={styles.connectRoot}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <View style={styles.connectCard}>
          <Text style={styles.connectTitle}>Preparing Device</Text>
          <Text style={styles.connectSubtitle}>Clearing local data and restarting player...</Text>
        </View>
      </View>
    );
  }

  if (!licenseReady) {
    return (
      <View style={styles.connectRoot}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <View style={styles.connectCard}>
          <Text style={styles.connectTitle}>Checking License</Text>
          <Text style={styles.connectSubtitle}>Preparing device activation state...</Text>
        </View>
      </View>
    );
  }

  if (!licensed) {
    return (
      <View style={styles.connectRoot}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <View style={styles.licenseCard}>
          <Text style={styles.connectTitle}>Activate Device</Text>
          <Text style={styles.licenseHint}>Share Device ID and enter license key provided by admin.</Text>

          <View style={styles.licenseRow}>
            <Text style={styles.licenseLabel}>Device ID</Text>
            <Text selectable style={styles.licenseValue}>{licenseDeviceId || "unknown"}</Text>
          </View>

          <View style={styles.licenseRow}>
            <Text style={styles.licenseLabel}>License Key</Text>
            <TextInput
              value={licenseInput}
              onChangeText={setLicenseInput}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="Enter key"
              placeholderTextColor="rgba(210,220,232,0.45)"
              style={styles.licenseInput}
            />
          </View>

          <Pressable
            onPress={onActivateLicense}
            disabled={licenseBusy}
            style={({ pressed }) => [
              styles.licenseBtn,
              pressed && !licenseBusy ? { opacity: 0.85 } : null,
              licenseBusy ? { opacity: 0.55 } : null,
            ]}
          >
            <Text style={styles.licenseBtnText}>
              {licenseBusy ? "Verifying..." : "Save And Activate"}
            </Text>
          </Pressable>

          <Text style={styles.licenseStatus}>{licenseStatus}</Text>
          <CmsAccessCard />
        </View>
      </View>
    );
  }

  if (!ready) {
    const ringSpin = spinValue.interpolate({
      inputRange: [0, 1],
      outputRange: ["0deg", "360deg"],
    });
    const pulseScale = pulseValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.9, 1.12],
    });
    const pulseOpacity = pulseValue.interpolate({
      inputRange: [0, 1],
      outputRange: [0.35, 1],
    });

    return (
      <View style={styles.connectRoot}>
        <View style={styles.bgGlowTop} />
        <View style={styles.bgGlowBottom} />
        <AdminButton
          side="right"
          icon={"\u25A6"}
          hasTVPreferredFocus={!showAdmin}
          onOpen={() => openAdminPanel("cms")}
        />
        {sourceSnapshot.activeSource !== "USB" ? (
          <AdminButton
            side="left"
            icon={"\u2699"}
            focusable={false}
            onOpen={() => openAdminPanel("access")}
          />
        ) : null}

        <View style={styles.connectCard}>
          <Animated.View style={[styles.loaderRing, { transform: [{ rotate: ringSpin }] }]}>
            <View style={styles.loaderInner} />
          </Animated.View>

          <Animated.View
            style={[
              styles.pulseDot,
              { opacity: pulseOpacity, transform: [{ scale: pulseScale }] },
            ]}
          />

          <Text style={styles.connectTitle}>Connecting To CMS</Text>
          <Text style={styles.connectSubtitle}>
            {connectSubtitleText}
          </Text>

          <View style={styles.statusPill}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>{connectStatusText}</Text>
          </View>
        </View>
      </View>
    );
  }

  const safeConfig = config || {
    orientation: "horizontal",
    bgColor: "#000",
    layout: "fullscreen",
    slideDuration: 5,
    sections: [{ sourceType: "multimedia" }],
  };
  const effectiveConfig =
    sourceSnapshot.activeSource === "USB"
      ? playbackControllerRef.current.buildUsbConfig(safeConfig)
      : safeConfig;
  const playbackSourceVersion =
    sourceSnapshot.activeSource === "USB"
      ? [
          sourceSnapshot.activeSource,
          sourceSnapshot.usbMountPath,
          sourceSnapshot.usbPlaylist.length,
          sourceSnapshot.usbPlaylist
            .map((item) => `${item?.url || item?.name || ""}:${Number(item?.mtimeMs || 0)}`)
            .join("|"),
        ].join("::")
      : sourceSnapshot.activeSource;

  const handlePlaybackChange = (payload: any) => {
    const section = Number(payload?.section || 0);
    if (!section) return;
    setPrioritySection(section);
    const previous = playbackBySectionRef.current[section] || null;
    const nextPlayback = {
      title: String(payload?.title || ""),
      sourceType: String(payload?.sourceType || ""),
      mediaType: String(payload?.mediaType || ""),
      page: Number(payload?.page || 0),
      cacheStatus: String(payload?.cacheStatus || ""),
      itemIndex: Number(payload?.itemIndex || 0),
      totalItems: Number(payload?.totalItems || 0),
      itemElapsedMs: Number(payload?.itemElapsedMs || 0),
      itemDurationMs: Number(payload?.itemDurationMs || 0),
      playlistElapsedMs: Number(payload?.playlistElapsedMs || 0),
      playlistTotalMs: Number(payload?.playlistTotalMs || 0),
      updatedAt: new Date().toISOString(),
    };
    const changedMedia =
      !previous ||
      previous.title !== nextPlayback.title ||
      previous.sourceType !== nextPlayback.sourceType ||
      previous.mediaType !== nextPlayback.mediaType ||
      previous.page !== nextPlayback.page ||
      previous.itemIndex !== nextPlayback.itemIndex ||
      previous.totalItems !== nextPlayback.totalItems;
    const changedTiming =
      !previous ||
      Math.abs(Number(previous.itemElapsedMs || 0) - nextPlayback.itemElapsedMs) >= 900 ||
      Math.abs(Number(previous.playlistElapsedMs || 0) - nextPlayback.playlistElapsedMs) >= 900 ||
      Math.abs(Number(previous.itemDurationMs || 0) - nextPlayback.itemDurationMs) >= 900 ||
      Math.abs(Number(previous.playlistTotalMs || 0) - nextPlayback.playlistTotalMs) >= 900 ||
      previous.cacheStatus !== nextPlayback.cacheStatus;
    playbackStatsRef.current = {
      ...playbackStatsRef.current,
      playbackChanges: playbackStatsRef.current.playbackChanges + (changedMedia ? 1 : 0),
      lastTitle: nextPlayback.title,
      lastSection: section,
      lastUpdatedAt: new Date().toISOString(),
    };
    playbackBySectionRef.current = {
      ...playbackBySectionRef.current,
      [section]: nextPlayback,
    };
    if (socket?.connected && lastMetaRef.current) {
      const now = Date.now();
      if (changedMedia || changedTiming || now - lastPlaybackHealthEmitAtRef.current >= 1000) {
        lastPlaybackHealthEmitAtRef.current = now;
        socket.emit("device-health", {
          deviceId: deviceIdRef.current,
          appState: "playback-change",
          meta: {
            ...lastMetaRef.current,
            currentPlaybackBySection: playbackBySectionRef.current,
          },
        });
      }
    }
  };

  const handlePlaybackError = (payload: any) => {
    const message = String(payload?.message || "Playback error");
    const detailParts = [
      payload?.name ? `File: ${payload.name}` : "",
      payload?.mediaType ? `Type: ${payload.mediaType}` : "",
    ].filter(Boolean);
    const detail = detailParts.join(" · ");
    playbackStatsRef.current = {
      ...playbackStatsRef.current,
      playbackErrors: playbackStatsRef.current.playbackErrors + 1,
      lastUpdatedAt: new Date().toISOString(),
    };
    reportRuntimeError(message, detail, "player");
  };

  const { width, height } = Dimensions.get("window");
  const orientation = effectiveConfig.orientation;

  let rotation = "0deg";
  let containerWidth = width;
  let containerHeight = height;

  if (orientation === "vertical") {
    rotation = "90deg";
    containerWidth = height;
    containerHeight = width;
  }

  if (orientation === "reverse-vertical") {
    rotation = "-90deg";
    containerWidth = height;
    containerHeight = width;
  }

  if (orientation === "reverse-horizontal") {
    rotation = "180deg";
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <View
        style={{
          width: containerWidth,
          height: containerHeight,
          position: "absolute",
          top: (height - containerHeight) / 2,
          left: (width - containerWidth) / 2,
          transform: [{ rotate: rotation }],
        }}
      >
        <PlayerErrorBoundary onError={(error) => reportRuntimeError(String(error?.message || error), "", "boundary")}>
          <PlayerScreen
            config={effectiveConfig}
            mediaVersion={mediaVersion}
            sectionMediaVersion={sectionMediaVersion}
            playlistSyncAt={playlistSyncAt}
            contentResetVersion={contentResetVersion}
            playbackSourceVersion={playbackSourceVersion}
            sectionPlaybackTimeline={sectionPlaybackTimeline}
            uploadProcessingBySection={uploadProcessingBySection}
            uploadCountsBySection={uploadCountsBySection}
            onPlaybackChange={handlePlaybackChange}
            onPlaybackError={handlePlaybackError}
          />
        </PlayerErrorBoundary>
        <AdminButton
          side="right"
          icon={"\u25A6"}
          hasTVPreferredFocus={!showAdmin}
          onOpen={() => openAdminPanel("cms")}
        />
        {sourceSnapshot.activeSource !== "USB" ? (
          <AdminButton
            side="left"
            icon={"\u2699"}
            focusable={false}
            onOpen={() => openAdminPanel("access")}
          />
        ) : null}
        <AdminCmsPanel
          visible={showAdmin}
          view={adminInitialView}
          onViewChange={setAdminInitialView}
          onClose={closeAdminPanel}
          orientation={orientation}
        />
        {offlineNotice ? (
          <View style={styles.offlineToast}>
            <Text style={styles.offlineToastText}>{offlineNotice}</Text>
            <Pressable
              onPress={() => {
                offlineNoticeDismissedRef.current = true;
                setOfflineNotice("");
              }}
              style={({ pressed }) => [
                styles.offlineToastClose,
                pressed ? styles.offlineToastClosePressed : null,
              ]}
            >
              <Text style={styles.offlineToastCloseText}>x</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
      {lastError ? (
        <View style={styles.errorToast}>
          <Text style={styles.errorToastTitle}>Error</Text>
          <Text style={styles.errorToastMsg}>{lastError.message}</Text>
          {lastError.detail ? (
            <Text style={styles.errorToastDetail}>{lastError.detail}</Text>
          ) : null}
        </View>
      ) : null}
      {apkUpdateState.visible ? (
        <View style={styles.apkUpdateOverlay}>
          <View style={styles.apkUpdateCard}>
            <Text style={styles.apkUpdateTitle}>App Update</Text>
            <Text style={styles.apkUpdateMessage}>{apkUpdateState.message}</Text>
            <View style={styles.apkUpdateBar}>
              <View
                style={[
                  styles.apkUpdateBarFill,
                  { width: `${Math.max(0, Math.min(100, apkUpdateState.percent))}%` },
                ]}
              />
            </View>
            <Text style={styles.apkUpdatePercent}>{`${Math.round(apkUpdateState.percent)}%`}</Text>
            {apkUpdateState.status === "awaiting-confirmation" ? (
              <Text style={styles.apkUpdateHint}>
                Confirm install on TV if Android shows a package installer prompt.
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  connectRoot: {
    flex: 1,
    backgroundColor: "#05080d",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  bgGlowTop: {
    position: "absolute",
    top: -180,
    right: -120,
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(22, 168, 255, 0.18)",
  },
  bgGlowBottom: {
    position: "absolute",
    bottom: -170,
    left: -140,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: "rgba(0, 210, 180, 0.14)",
  },
  connectCard: {
    width: "82%",
    maxWidth: 520,
    minHeight: 340,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(16, 20, 27, 0.9)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 26,
    paddingVertical: 34,
  },
  loaderRing: {
    width: 102,
    height: 102,
    borderRadius: 51,
    borderWidth: 5,
    borderColor: "rgba(84, 190, 255, 0.2)",
    borderTopColor: "#5ec4ff",
    borderRightColor: "#39d8bc",
    alignItems: "center",
    justifyContent: "center",
  },
  loaderInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: "rgba(255, 255, 255, 0.07)",
  },
  pulseDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 16,
    backgroundColor: "#69f1d0",
  },
  connectTitle: {
    marginTop: 22,
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
  connectSubtitle: {
    marginTop: 10,
    color: "rgba(216, 225, 236, 0.82)",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    maxWidth: 360,
  },
  statusPill: {
    marginTop: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(132, 228, 205, 0.35)",
    backgroundColor: "rgba(39, 149, 122, 0.18)",
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7fffd4",
    marginRight: 8,
  },
  statusText: {
    color: "#c8fff1",
    fontSize: 13,
    fontWeight: "600",
  },
  licenseCard: {
    width: "86%",
    maxWidth: 620,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
    backgroundColor: "rgba(16, 20, 27, 0.93)",
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  licenseHint: {
    marginTop: 8,
    marginBottom: 14,
    color: "rgba(216, 225, 236, 0.8)",
    fontSize: 14,
    lineHeight: 20,
  },
  licenseRow: {
    marginTop: 10,
  },
  licenseLabel: {
    color: "#dff2ff",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
  },
  licenseValue: {
    color: "#9de6d5",
    fontSize: 14,
    backgroundColor: "rgba(22,30,40,0.75)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  licenseInput: {
    color: "#f2fbff",
    fontSize: 15,
    borderWidth: 1,
    borderColor: "rgba(124, 190, 231, 0.45)",
    borderRadius: 10,
    backgroundColor: "rgba(14, 19, 27, 0.86)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    letterSpacing: 0.4,
  },
  licenseBtn: {
    marginTop: 18,
    backgroundColor: "#1d8fff",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  licenseBtnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "700",
  },
  licenseStatus: {
    marginTop: 12,
    color: "rgba(206, 229, 245, 0.86)",
    fontSize: 13,
    lineHeight: 18,
  },
  errorToast: {
    position: "absolute",
    left: 16,
    right: 16,
    top: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(120, 16, 26, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(255, 140, 140, 0.45)",
  },
  errorToastTitle: {
    color: "#ffd9d9",
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 4,
  },
  errorToastMsg: {
    color: "#ffecec",
    fontSize: 13,
  },
  errorToastDetail: {
    color: "#f8caca",
    fontSize: 12,
    marginTop: 4,
  },
  errorBoundaryWrap: {
    flex: 1,
    backgroundColor: "#0b0f14",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  errorBoundaryTitle: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  errorBoundaryText: {
    color: "rgba(220, 230, 240, 0.9)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
  },
  offlineToast: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    maxWidth: "78%",
    minWidth: 180,
    paddingVertical: 6,
    paddingLeft: 12,
    paddingRight: 34,
    borderRadius: 10,
    backgroundColor: "rgba(10, 16, 22, 0.9)",
    borderWidth: 1,
    borderColor: "rgba(120, 180, 220, 0.4)",
  },
  offlineToastText: {
    color: "rgba(200, 225, 240, 0.95)",
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
  },
  offlineToastClose: {
    position: "absolute",
    right: 6,
    top: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineToastClosePressed: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  offlineToastCloseText: {
    color: "rgba(200, 225, 240, 0.95)",
    fontSize: 13,
    lineHeight: 13,
    fontWeight: "700",
  },
  apkUpdateOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  apkUpdateCard: {
    width: "82%",
    maxWidth: 560,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(120, 190, 255, 0.28)",
    backgroundColor: "rgba(10, 16, 24, 0.96)",
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  apkUpdateTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  apkUpdateMessage: {
    marginTop: 10,
    color: "#d8e8f5",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  apkUpdateBar: {
    marginTop: 16,
    height: 14,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(120, 190, 255, 0.22)",
  },
  apkUpdateBarFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#44d38e",
  },
  apkUpdatePercent: {
    marginTop: 12,
    color: "#cffff0",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  apkUpdateHint: {
    marginTop: 12,
    color: "rgba(210, 224, 238, 0.82)",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
});

import React, { useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import Video, { BufferingStrategyType } from "react-native-video";
import SlideRenderer from "./SlideRenderer";
import Ticker from "./Ticker";

const GRID_GAP = 0;

function parseRatio(value: any, count: number): number[] {
  const parts = String(value || "")
    .split(":")
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n > 0);
  if (parts.length !== count) return count === 3 ? [1, 1, 1] : [1, 1];
  return parts;
}

function parseTimeToMinutes(value: string): number | null {
  const [hStr, mStr] = String(value || "").split(":");
  const h = Number(hStr);
  const m = Number(mStr);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isScheduleActive(schedule: any): boolean {
  if (!schedule?.enabled) return true;

  const now = new Date();
  const day = now.getDay();
  const days = Array.isArray(schedule.days) && schedule.days.length
    ? schedule.days.map((d: any) => Number(d)).filter((d: number) => Number.isFinite(d))
    : [0, 1, 2, 3, 4, 5, 6];

  if (!days.includes(day)) return false;

  const start = parseTimeToMinutes(schedule.start || "00:00");
  const end = parseTimeToMinutes(schedule.end || "23:59");
  if (start == null || end == null) return true;
  if (start === end) return true;

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  return nowMinutes >= start || nowMinutes < end;
}

export default function PlayerScreen({
  config,
  mediaVersion,
  playlistSyncAt,
  contentResetVersion,
  sectionPlaybackTimeline,
  uploadProcessingBySection,
  uploadCountsBySection,
  onPlaybackChange,
  onPlaybackError,
}: any) {
  const [scheduleOn, setScheduleOn] = useState(true);
  const rendererEpoch = `${Number(mediaVersion || 0)}-${Number(contentResetVersion || 0)}-${Number(playlistSyncAt || 0)}`;
  const getSectionKey = (sectionIndex: number) => {
    const timeline = sectionPlaybackTimeline?.[sectionIndex + 1] || null;
    const cycle = String(timeline?.cycleId || timeline?.syncAt || "none");
    return `section-${sectionIndex}-${rendererEpoch}-${cycle}`;
  };
  const tickerHeight = config?.ticker?.text
    ? (config.ticker.fontSize || 24) + 12
    : 0;
  const grid3Layout = config?.grid3Layout || "stack-v";
  const gridRatio = config?.gridRatio || "1:1:1";
  useEffect(() => {
    const evalSchedule = () => setScheduleOn(isScheduleActive(config?.schedule));
    evalSchedule();
    const timer = setInterval(evalSchedule, 30000);
    return () => clearInterval(timer);
  }, [config?.schedule]);

  const renderGrid3 = () => {
    if (grid3Layout === "stack-h") {
      const [a, b, c] = parseRatio(gridRatio, 3);
      return (
        <View style={{ flex: 1, flexDirection: "row", gap: GRID_GAP }}>
          <View style={{ flex: a, marginRight: GRID_GAP / 2 }}>
            <SlideRenderer
              key={getSectionKey(0)}
              sectionIndex={0}
              config={config}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[1] || null}
              processingMessage={uploadProcessingBySection?.[1] || ""}
              processingCount={uploadCountsBySection?.[1] || null}
              onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
            />
          </View>
          <View style={{ flex: b, marginHorizontal: GRID_GAP / 2 }}>
            <SlideRenderer
              key={getSectionKey(1)}
              sectionIndex={1}
              config={config}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[2] || null}
              processingMessage={uploadProcessingBySection?.[2] || ""}
              processingCount={uploadCountsBySection?.[2] || null}
              onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
            />
          </View>
          <View style={{ flex: c, marginLeft: GRID_GAP / 2 }}>
            <SlideRenderer
              key={getSectionKey(2)}
              sectionIndex={2}
              config={config}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[3] || null}
              processingMessage={uploadProcessingBySection?.[3] || ""}
              processingCount={uploadCountsBySection?.[3] || null}
              onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
            />
          </View>
        </View>
      );
    }

    if (grid3Layout === "top-two-bottom-one") {
      const [top, bottom] = parseRatio(gridRatio, 2);
      return (
        <View style={{ flex: 1, gap: GRID_GAP }}>
          <View style={{ flex: top, flexDirection: "row", gap: GRID_GAP }}>
            <View style={{ flex: 1, marginRight: GRID_GAP / 2 }}>
              <SlideRenderer
                key={getSectionKey(0)}
              sectionIndex={0}
              config={config}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[1] || null}
              processingMessage={uploadProcessingBySection?.[1] || ""}
              processingCount={uploadCountsBySection?.[1] || null}
              onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
            />
            </View>
            <View style={{ flex: 1, marginLeft: GRID_GAP / 2 }}>
              <SlideRenderer
                key={getSectionKey(1)}
              sectionIndex={1}
              config={config}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[2] || null}
              processingMessage={uploadProcessingBySection?.[2] || ""}
              processingCount={uploadCountsBySection?.[2] || null}
              onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
            />
            </View>
          </View>
          <View style={{ flex: bottom }}>
            <SlideRenderer
              key={getSectionKey(2)}
              sectionIndex={2}
              config={config}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[3] || null}
              processingMessage={uploadProcessingBySection?.[3] || ""}
              processingCount={uploadCountsBySection?.[3] || null}
              onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
            />
          </View>
        </View>
      );
    }

    if (grid3Layout === "top-one-bottom-two") {
      const [top, bottom] = parseRatio(gridRatio, 2);
      return (
        <View style={{ flex: 1, gap: GRID_GAP }}>
          <View style={{ flex: top }}>
            <SlideRenderer
              key={getSectionKey(0)}
              sectionIndex={0}
              config={config}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[1] || null}
              processingMessage={uploadProcessingBySection?.[1] || ""}
              onPlaybackError={onPlaybackError}
            />
          </View>
          <View style={{ flex: bottom, flexDirection: "row", gap: GRID_GAP }}>
            <View style={{ flex: 1, marginRight: GRID_GAP / 2 }}>
              <SlideRenderer
                key={getSectionKey(1)}
                sectionIndex={1}
                config={config}
                mediaVersion={mediaVersion}
                playlistSyncAt={playlistSyncAt}
                contentResetVersion={contentResetVersion}
                sectionTimeline={sectionPlaybackTimeline?.[2] || null}
                processingMessage={uploadProcessingBySection?.[2] || ""}
                onPlaybackError={onPlaybackError}
              />
            </View>
            <View style={{ flex: 1, marginLeft: GRID_GAP / 2 }}>
              <SlideRenderer
                key={getSectionKey(2)}
                sectionIndex={2}
                config={config}
                mediaVersion={mediaVersion}
                playlistSyncAt={playlistSyncAt}
                contentResetVersion={contentResetVersion}
                sectionTimeline={sectionPlaybackTimeline?.[3] || null}
                processingMessage={uploadProcessingBySection?.[3] || ""}
                onPlaybackError={onPlaybackError}
              />
            </View>
          </View>
        </View>
      );
    }

    const [a, b, c] = parseRatio(gridRatio, 3);
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: a, marginBottom: GRID_GAP / 2 }}>
          <SlideRenderer
            key={getSectionKey(0)}
            sectionIndex={0}
            config={config}
            mediaVersion={mediaVersion}
            playlistSyncAt={playlistSyncAt}
            contentResetVersion={contentResetVersion}
            sectionTimeline={sectionPlaybackTimeline?.[1] || null}
            processingMessage={uploadProcessingBySection?.[1] || ""}
            processingCount={uploadCountsBySection?.[1] || null}
            onPlaybackChange={onPlaybackChange}
            onPlaybackError={onPlaybackError}
          />
        </View>
        <View style={{ flex: b, marginVertical: GRID_GAP / 2 }}>
          <SlideRenderer
            key={getSectionKey(1)}
            sectionIndex={1}
            config={config}
            mediaVersion={mediaVersion}
            playlistSyncAt={playlistSyncAt}
            contentResetVersion={contentResetVersion}
            sectionTimeline={sectionPlaybackTimeline?.[2] || null}
            processingMessage={uploadProcessingBySection?.[2] || ""}
            processingCount={uploadCountsBySection?.[2] || null}
            onPlaybackChange={onPlaybackChange}
            onPlaybackError={onPlaybackError}
          />
        </View>
        <View style={{ flex: c, marginTop: GRID_GAP / 2 }}>
          <SlideRenderer
            key={getSectionKey(2)}
            sectionIndex={2}
            config={config}
            mediaVersion={mediaVersion}
            playlistSyncAt={playlistSyncAt}
            contentResetVersion={contentResetVersion}
            sectionTimeline={sectionPlaybackTimeline?.[3] || null}
            processingMessage={uploadProcessingBySection?.[3] || ""}
            processingCount={uploadCountsBySection?.[3] || null}
            onPlaybackChange={onPlaybackChange}
            onPlaybackError={onPlaybackError}
          />
        </View>
      </View>
    );
  };

  const renderGrid2 = () => {
    const [left, right] = parseRatio(gridRatio, 2);
    const isHorizontal = grid3Layout === "stack-h";

    if (!isHorizontal) {
      return (
        <View style={{ flex: 1, flexDirection: "column", gap: GRID_GAP }}>
          <View style={{ flex: left, marginBottom: GRID_GAP / 2 }}>
            <SlideRenderer
              key={getSectionKey(0)}
              config={config}
              sectionIndex={0}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[1] || null}
              processingMessage={uploadProcessingBySection?.[1] || ""}
              onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
            />
          </View>
          <View style={{ flex: right, marginTop: GRID_GAP / 2 }}>
            <SlideRenderer
              key={getSectionKey(1)}
              config={config}
              sectionIndex={1}
              mediaVersion={mediaVersion}
              playlistSyncAt={playlistSyncAt}
              contentResetVersion={contentResetVersion}
              sectionTimeline={sectionPlaybackTimeline?.[2] || null}
              processingMessage={uploadProcessingBySection?.[2] || ""}
              onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
            />
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1, flexDirection: "row", gap: GRID_GAP }}>
        <View style={{ flex: left, marginRight: GRID_GAP / 2 }}>
          <SlideRenderer
            key={getSectionKey(0)}
            config={config}
            sectionIndex={0}
            mediaVersion={mediaVersion}
            playlistSyncAt={playlistSyncAt}
            contentResetVersion={contentResetVersion}
            sectionTimeline={sectionPlaybackTimeline?.[1] || null}
            processingMessage={uploadProcessingBySection?.[1] || ""}
            onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
          />
        </View>
        <View style={{ flex: right, marginLeft: GRID_GAP / 2 }}>
          <SlideRenderer
            key={getSectionKey(1)}
            config={config}
            sectionIndex={1}
            mediaVersion={mediaVersion}
            playlistSyncAt={playlistSyncAt}
            contentResetVersion={contentResetVersion}
            sectionTimeline={sectionPlaybackTimeline?.[2] || null}
            processingMessage={uploadProcessingBySection?.[2] || ""}
            onPlaybackChange={onPlaybackChange}
              onPlaybackError={onPlaybackError}
          />
        </View>
      </View>
    );
  };

  if (!scheduleOn) {
    const fallbackMode = config?.schedule?.fallbackMode || "black";
    const fallbackBgColor = config?.schedule?.fallbackBgColor || "#000000";
    const fallbackMediaUrl = config?.schedule?.fallbackImageUrl || "";
    const isFallbackVideo = /\.(mp4|mov|mkv|webm)(\?.*)?$/i.test(fallbackMediaUrl);

    if (fallbackMode === "image" && fallbackMediaUrl) {
      if (isFallbackVideo) {
        const streamingBufferConfig = {
          minBufferMs: 3000,
          maxBufferMs: 15000,
          bufferForPlaybackMs: 1500,
          bufferForPlaybackAfterRebufferMs: 2500,
          backBufferDurationMs: 0,
          cacheSizeMB: 0,
          maxHeapAllocationPercent: 0.2,
          minBufferMemoryReservePercent: 0.25,
          minBackBufferMemoryReservePercent: 0.25,
        };
        return (
          <View style={{ flex: 1, backgroundColor: fallbackBgColor }}>
            <Video
              source={{ uri: fallbackMediaUrl }}
              style={{ width: "100%", height: "100%" }}
              resizeMode="cover"
              repeat
              muted={false}
              playInBackground={false}
              ignoreSilentSwitch="ignore"
              bufferingStrategy={BufferingStrategyType.DEPENDING_ON_MEMORY}
              bufferConfig={streamingBufferConfig}
            />
          </View>
        );
      }
      return (
        <View style={{ flex: 1, backgroundColor: fallbackBgColor }}>
          <Image
            source={{ uri: fallbackMediaUrl }}
            style={{ width: "100%", height: "100%" }}
            resizeMode="cover"
          />
        </View>
      );
    }

    if (fallbackMode === "message") {
      return (
        <View
          style={{
            flex: 1,
            backgroundColor: fallbackBgColor,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 30,
          }}
        >
          <Text
            style={{
              color: config?.schedule?.fallbackTextColor || "#ffffff",
              fontSize: 28,
              fontWeight: "700",
              textAlign: "center",
            }}
          >
            {config?.schedule?.fallbackMessage || "Playback is currently scheduled off."}
          </Text>
        </View>
      );
    }

    return <View style={{ flex: 1, backgroundColor: fallbackBgColor }} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: config.bgColor }}>
      {config.ticker?.text && config.ticker?.position === "top" ? (
        <Ticker ticker={config.ticker} />
      ) : null}
      <View
        style={{
          flex: 1,
          flexDirection: config.layout === "fullscreen" ? "column" : "row",
        }}
      >
        {config.layout === "fullscreen" && (
          <SlideRenderer
            key={getSectionKey(0)}
            config={config}
            sectionIndex={0}
            mediaVersion={mediaVersion}
            playlistSyncAt={playlistSyncAt}
            contentResetVersion={contentResetVersion}
            sectionTimeline={sectionPlaybackTimeline?.[1] || null}
            processingMessage={uploadProcessingBySection?.[1] || ""}
            processingCount={uploadCountsBySection?.[1] || null}
            onPlaybackChange={onPlaybackChange}
            onPlaybackError={onPlaybackError}
          />
        )}
        {config.layout === "grid2" && renderGrid2()}
        {config.layout === "grid3" && renderGrid3()}
      </View>
      {config.ticker?.text && config.ticker?.position !== "top" ? (
        <Ticker ticker={config.ticker} />
      ) : null}
    </View>
  );
}

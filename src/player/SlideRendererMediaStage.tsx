import React from "react";
import { ActivityIndicator, Animated, Image, ScrollView, Text, View } from "react-native";
import { WebView } from "react-native-webview";
import NativeVideoPlayer from "./NativeVideoPlayer";

type Props = {
  showProcessingOverlay: boolean;
  processingMessage: string;
  uploadTotal: number;
  uploadDone: number;
  files: any[];
  isVideo: boolean;
  isPdf: boolean;
  isText: boolean;
  mediaRotateLayerStyle: any;
  styles: any;
  videoFade: Animated.Value;
  videoReloadToken: number;
  effectiveVideoUri: string;
  resumePositionMs: number;
  mediaResizeMode: any;
  videoVolume: number;
  videoMuted: boolean;
  forceLocalRestart: boolean;
  pdfReloadToken: number;
  pdfSlotUrls: { a: string; b: string };
  pdfVisibleSlot: "a" | "b";
  imageVisibleSlot: "a" | "b";
  imageSlotUrls: { a: string; b: string };
  slideImageTrackEnabled: boolean;
  activeImageUri: string;
  nextImageUri: string;
  transitionDirection: string;
  backdropTranslateX: Animated.Value;
  backdropTranslateY: Animated.Value;
  slideDistanceX: number;
  slideDistanceY: number;
  nextImageSlot: "a" | "b";
  textContent: string;
  showBufferIndicator: boolean;
  videoBuffering: boolean;
  isMarkedCached: boolean;
  bufferingReason: string;
  onVideoEnd: () => void;
  onVideoReady: () => void;
  onVideoProgress: (event: any) => void;
  onVideoBuffering: (event: any) => void;
  onRenderError: () => void;
  onPdfLoadEnd: (slot: "a" | "b") => void;
  onPdfError: () => void;
  onImageLoadEnd: (slot: "a" | "b") => void;
};

export default function SlideRendererMediaStage(props: Props) {
  const {
    showProcessingOverlay,
    processingMessage,
    uploadTotal,
    uploadDone,
    files,
    isVideo,
    isPdf,
    isText,
    mediaRotateLayerStyle,
    styles,
    videoFade,
    videoReloadToken,
    effectiveVideoUri,
    resumePositionMs,
    mediaResizeMode,
    videoVolume,
    videoMuted,
    forceLocalRestart,
    pdfReloadToken,
    pdfSlotUrls,
    pdfVisibleSlot,
    imageVisibleSlot,
    imageSlotUrls,
    slideImageTrackEnabled,
    activeImageUri,
    nextImageUri,
    transitionDirection,
    backdropTranslateX,
    backdropTranslateY,
    slideDistanceX,
    slideDistanceY,
    nextImageSlot,
    textContent,
    showBufferIndicator,
    videoBuffering,
    isMarkedCached,
    bufferingReason,
    onVideoEnd,
    onVideoReady,
    onVideoProgress,
    onVideoBuffering,
    onRenderError,
    onPdfLoadEnd,
    onPdfError,
    onImageLoadEnd,
  } = props;

  if (showProcessingOverlay) {
    return (
      <View style={styles.processingWrap}>
        <ActivityIndicator size="large" color="#7fffd4" />
        <Text style={styles.processingTitle}>Updating Section</Text>
        <Text style={styles.processingText}>
          {String(processingMessage || "Uploading... Please wait.")}
        </Text>
        {uploadTotal > 0 ? (
          <Text style={styles.processingCountText}>
            {`Uploading files: ${Math.min(uploadDone || 0, uploadTotal)}/${uploadTotal}`}
          </Text>
        ) : null}
        {files.length ? (
          <Text style={styles.processingCountText}>
            {`Files in section: ${files.length}`}
          </Text>
        ) : null}
      </View>
    );
  }

  if (isVideo) {
    return (
      <View style={mediaRotateLayerStyle}>
        <Animated.View style={[styles.media, styles.videoSurface, { opacity: videoFade }]}>
          <NativeVideoPlayer
            key={`video-player-${videoReloadToken}`}
            src={effectiveVideoUri}
            style={styles.media}
            rotation={0}
            muted={videoMuted}
            volume={videoVolume}
            startPositionMs={resumePositionMs}
            resizeMode={mediaResizeMode}
            repeat={files.length === 1 && !forceLocalRestart}
            onEnd={onVideoEnd}
            onReady={onVideoReady}
            onProgress={onVideoProgress}
            onBuffering={onVideoBuffering}
            onError={onRenderError}
          />
        </Animated.View>
        {showBufferIndicator && videoBuffering && !isMarkedCached ? (
          <View style={styles.bufferOverlay}>
            <View style={styles.bufferRing}>
              <ActivityIndicator size="small" color="#8fffe7" />
            </View>
            <Text style={styles.bufferHint}>{bufferingReason}</Text>
          </View>
        ) : null}
      </View>
    );
  }

  if (isPdf) {
    return (
      <View style={mediaRotateLayerStyle}>
        {pdfSlotUrls.a ? (
          <WebView
            key={`pdf-a-${pdfReloadToken}`}
            source={{ uri: pdfSlotUrls.a }}
            style={[
              styles.media,
              styles.pdfLayer,
              pdfVisibleSlot === "a" ? styles.pdfVisible : styles.pdfHidden,
            ]}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
            mixedContentMode="always"
            mediaPlaybackRequiresUserAction={false}
            onLoadEnd={() => onPdfLoadEnd("a")}
            onError={onPdfError}
          />
        ) : null}
        {pdfSlotUrls.b ? (
          <WebView
            key={`pdf-b-${pdfReloadToken}`}
            source={{ uri: pdfSlotUrls.b }}
            style={[
              styles.media,
              styles.pdfLayer,
              pdfVisibleSlot === "b" ? styles.pdfVisible : styles.pdfHidden,
            ]}
            javaScriptEnabled
            domStorageEnabled
            allowsInlineMediaPlayback
            setSupportMultipleWindows={false}
            mixedContentMode="always"
            mediaPlaybackRequiresUserAction={false}
            onLoadEnd={() => onPdfLoadEnd("b")}
            onError={onPdfError}
          />
        ) : null}
      </View>
    );
  }

  if (isText) {
    return (
      <View style={[mediaRotateLayerStyle, styles.textWrap]}>
        <ScrollView
          style={styles.media}
          contentContainerStyle={styles.textContentWrap}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.textContent}>
            {textContent || "No text content"}
          </Text>
        </ScrollView>
      </View>
    );
  }

  if (slideImageTrackEnabled && activeImageUri && nextImageUri) {
    return (
      <View style={mediaRotateLayerStyle}>
        <Animated.View
          style={[
            styles.imageTrack,
            {
              transform: [
                {
                  translateX:
                    transitionDirection === "left" || transitionDirection === "right"
                      ? backdropTranslateX
                      : 0,
                },
                {
                  translateY:
                    transitionDirection === "top" || transitionDirection === "bottom"
                      ? backdropTranslateY
                      : 0,
                },
              ],
            },
          ]}
        >
          <Image
            source={{ uri: activeImageUri }}
            style={[
              styles.media,
              styles.imageTrackItem,
              styles.imageTrackCurrent,
            ]}
            resizeMode={mediaResizeMode}
            fadeDuration={0}
            onError={onRenderError}
          />
          <Image
            source={{ uri: nextImageUri }}
            style={[
              styles.media,
              styles.imageTrackItem,
              transitionDirection === "left"
                ? { left: slideDistanceX }
                : transitionDirection === "right"
                ? { left: -slideDistanceX }
                : transitionDirection === "top"
                ? { top: slideDistanceY }
                : { top: -slideDistanceY },
            ]}
            resizeMode={mediaResizeMode}
            fadeDuration={0}
            onLoad={() => onImageLoadEnd(nextImageSlot)}
            onError={onRenderError}
          />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={mediaRotateLayerStyle}>
      {imageSlotUrls.a ? (
        <Image
          source={{ uri: imageSlotUrls.a }}
          style={[
            styles.media,
            styles.imageLayer,
            imageVisibleSlot === "a" ? styles.imageVisible : styles.imageHidden,
          ]}
          resizeMode={mediaResizeMode}
          fadeDuration={0}
          onLoad={() => onImageLoadEnd("a")}
          onError={onRenderError}
        />
      ) : null}
      {imageSlotUrls.b ? (
        <Image
          source={{ uri: imageSlotUrls.b }}
          style={[
            styles.media,
            styles.imageLayer,
            imageVisibleSlot === "b" ? styles.imageVisible : styles.imageHidden,
          ]}
          resizeMode={mediaResizeMode}
          fadeDuration={0}
          onLoad={() => onImageLoadEnd("b")}
          onError={onRenderError}
        />
      ) : null}
    </View>
  );
}

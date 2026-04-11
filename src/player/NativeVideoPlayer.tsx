import React from "react";
import {
  NativeSyntheticEvent,
  requireNativeComponent,
  StyleProp,
  ViewStyle,
} from "react-native";

type NativeVideoErrorEvent = NativeSyntheticEvent<{ message?: string }>;
type NativeVideoBufferEvent = NativeSyntheticEvent<{ buffering?: boolean }>;
type NativeVideoProgressEvent = NativeSyntheticEvent<{
  positionMs?: number;
  durationMs?: number;
  isPlaying?: boolean;
}>;

type Props = {
  src: string;
  style?: StyleProp<ViewStyle>;
  rotation?: number;
  muted?: boolean;
  paused?: boolean;
  repeat?: boolean;
  startPositionMs?: number;
  resizeMode?: "stretch" | "cover" | "contain";
  onEnd?: () => void;
  onReady?: () => void;
  onError?: (event: NativeVideoErrorEvent) => void;
  onBuffering?: (event: NativeVideoBufferEvent) => void;
  onProgress?: (event: NativeVideoProgressEvent) => void;
};

const NativeVideoPlayerView = requireNativeComponent<Props>("NativeVideoPlayerView");

export default function NativeVideoPlayer(props: Props) {
  return <NativeVideoPlayerView {...props} />;
}

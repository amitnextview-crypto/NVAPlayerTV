package com.signageplayertv;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.HashMap;
import java.util.Map;

public class NativeVideoPlayerManager extends SimpleViewManager<NativeVideoPlayerView> {
    public static final String REACT_CLASS = "NativeVideoPlayerView";

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }

    @NonNull
    @Override
    protected NativeVideoPlayerView createViewInstance(@NonNull ThemedReactContext reactContext) {
        return new NativeVideoPlayerView(reactContext, reactContext);
    }

    @Override
    public void onDropViewInstance(@NonNull NativeVideoPlayerView view) {
        super.onDropViewInstance(view);
        view.destroyView();
    }

    @ReactProp(name = "src")
    public void setSrc(NativeVideoPlayerView view, @Nullable String src) {
        view.setSrc(src);
    }

    @ReactProp(name = "muted", defaultBoolean = true)
    public void setMuted(NativeVideoPlayerView view, boolean muted) {
        view.setMuted(muted);
    }

    @ReactProp(name = "paused", defaultBoolean = false)
    public void setPaused(NativeVideoPlayerView view, boolean paused) {
        view.setPaused(paused);
    }

    @ReactProp(name = "repeat", defaultBoolean = false)
    public void setRepeat(NativeVideoPlayerView view, boolean repeat) {
        view.setRepeat(repeat);
    }

    @ReactProp(name = "startPositionMs", defaultDouble = 0d)
    public void setStartPositionMs(NativeVideoPlayerView view, double startPositionMs) {
        view.setStartPositionMs(startPositionMs);
    }

    @ReactProp(name = "resizeMode")
    public void setResizeMode(NativeVideoPlayerView view, @Nullable String resizeMode) {
        view.setResizeMode(resizeMode);
    }

    @ReactProp(name = "rotation", defaultFloat = 0f)
    public void setRotation(NativeVideoPlayerView view, float rotation) {
        view.setVideoRotation(rotation);
    }

    @Nullable
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        Map<String, Object> events = new HashMap<>();
        events.put("topEnd", MapBuilder.of("registrationName", "onEnd"));
        events.put("topError", MapBuilder.of("registrationName", "onError"));
        events.put("topReady", MapBuilder.of("registrationName", "onReady"));
        events.put("topBuffer", MapBuilder.of("registrationName", "onBuffering"));
        events.put("topProgress", MapBuilder.of("registrationName", "onProgress"));
        return events;
    }
}

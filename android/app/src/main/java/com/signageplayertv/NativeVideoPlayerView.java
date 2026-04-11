package com.signageplayertv;

import android.content.Context;
import android.graphics.Color;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.view.LayoutInflater;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.LifecycleEventListener;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;
import com.google.android.exoplayer2.DefaultLoadControl;
import com.google.android.exoplayer2.ExoPlayer;
import com.google.android.exoplayer2.MediaItem;
import com.google.android.exoplayer2.PlaybackException;
import com.google.android.exoplayer2.Player;
import com.google.android.exoplayer2.C;
import com.google.android.exoplayer2.DefaultRenderersFactory;
import com.google.android.exoplayer2.source.DefaultMediaSourceFactory;
import com.google.android.exoplayer2.upstream.DefaultDataSource;
import com.google.android.exoplayer2.upstream.DefaultHttpDataSource;
import com.google.android.exoplayer2.ui.AspectRatioFrameLayout;
import com.google.android.exoplayer2.ui.StyledPlayerView;
import com.google.android.exoplayer2.database.StandaloneDatabaseProvider;
import com.google.android.exoplayer2.upstream.cache.CacheDataSink;
import com.google.android.exoplayer2.upstream.cache.CacheDataSource;
import com.google.android.exoplayer2.upstream.cache.LeastRecentlyUsedCacheEvictor;
import com.google.android.exoplayer2.upstream.cache.SimpleCache;

import java.io.File;

public class NativeVideoPlayerView extends FrameLayout implements LifecycleEventListener {
    private static final long SEEK_TOLERANCE_MS = 1200L;
    private static final long BUFFER_STALL_RECOVERY_MS = 15000L;
    private static final long RECOVERY_THROTTLE_MS = 5000L;
    private final ReactContext reactContext;
    private final StyledPlayerView playerView;
    private ExoPlayer player;
    private String src = "";
    private boolean muted = true;
    private boolean paused = false;
    private boolean repeat = false;
    private long startPositionMs = 0L;
    private String resizeMode = "stretch";
    private float rotation = 0f;
    private String preparedSrc = "";
    private boolean attached = false;
    private boolean startPositionApplied = false;
    private long lastKnownPositionMs = 0L;
    private long lastRecoveryAtMs = 0L;
    private int recoveryCount = 0;
    private boolean bufferingActive = false;
    private final Runnable bufferingRecoveryRunnable = new Runnable() {
        @Override
        public void run() {
            if (!attached || player == null || src.isEmpty() || !bufferingActive) return;
            attemptRecovery("buffer-stall");
        }
    };
    private final Handler progressHandler = new Handler(Looper.getMainLooper());
    private final Runnable progressRunnable = new Runnable() {
        @Override
        public void run() {
            dispatchProgress();
            progressHandler.postDelayed(this, 1000L);
        }
    };
    private static SimpleCache videoCache;
    private static final long VIDEO_CACHE_DEFAULT_BYTES = 128L * 1024 * 1024; // 128MB
    private static long videoCacheMaxBytes = VIDEO_CACHE_DEFAULT_BYTES;

    public NativeVideoPlayerView(@NonNull Context context, @NonNull ReactContext reactContext) {
        super(context);
        this.reactContext = reactContext;
        LayoutInflater.from(context).inflate(R.layout.native_video_player_view, this, true);
        this.playerView = findViewById(R.id.native_video_player_surface);
        this.playerView.setLayoutParams(new LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT,
            ViewGroup.LayoutParams.MATCH_PARENT
        ));
        this.playerView.setKeepScreenOn(true);
        this.playerView.setKeepContentOnPlayerReset(true);
        this.playerView.setShutterBackgroundColor(Color.TRANSPARENT);
        applyResizeMode();
        applyRotation();
        reactContext.addLifecycleEventListener(this);
    }

    private static synchronized SimpleCache getVideoCache(Context context) {
        long prefMaxBytes = VIDEO_CACHE_DEFAULT_BYTES;
        try {
            prefMaxBytes = context.getSharedPreferences("kiosk_prefs", Context.MODE_PRIVATE)
                    .getLong("video_cache_max_bytes", VIDEO_CACHE_DEFAULT_BYTES);
        } catch (Exception ignored) {
        }
        if (prefMaxBytes < 64L * 1024 * 1024) prefMaxBytes = 64L * 1024 * 1024;
        if (videoCache != null && videoCacheMaxBytes == prefMaxBytes) return videoCache;
        if (videoCache != null) {
            try {
                videoCache.release();
            } catch (Exception ignored) {
            }
            videoCache = null;
        }
        videoCacheMaxBytes = prefMaxBytes;
        File cacheDir = new File(context.getCacheDir(), "exo_video_cache");
        LeastRecentlyUsedCacheEvictor evictor = new LeastRecentlyUsedCacheEvictor(videoCacheMaxBytes);
        StandaloneDatabaseProvider dbProvider = new StandaloneDatabaseProvider(context);
        videoCache = new SimpleCache(cacheDir, evictor, dbProvider);
        return videoCache;
    }

    public static synchronized void clearVideoCache(Context context) {
        try {
            if (videoCache != null) {
                try {
                    videoCache.release();
                } catch (Exception ignored) {
                }
                videoCache = null;
            }
            File cacheDir = new File(context.getCacheDir(), "exo_video_cache");
            deleteDir(cacheDir);
        } catch (Exception ignored) {
        }
    }

    private static void deleteDir(File dir) {
        if (dir == null || !dir.exists()) return;
        if (dir.isDirectory()) {
            File[] files = dir.listFiles();
            if (files != null) {
                for (File f : files) {
                    deleteDir(f);
                }
            }
        }
        try {
            dir.delete();
        } catch (Exception ignored) {
        }
    }

    public void setSrc(String value) {
        String next = value == null ? "" : value.trim();
        if (next.equals(this.src)) {
            if (player != null && !next.isEmpty()) {
                try {
                    if (!startPositionApplied && startPositionMs > 0L) {
                        long currentPosition = Math.max(0L, player.getCurrentPosition());
                        if (Math.abs(currentPosition - startPositionMs) > SEEK_TOLERANCE_MS) {
                            player.seekTo(Math.max(0L, startPositionMs));
                        }
                        startPositionApplied = true;
                    }
                    player.setPlayWhenReady(!paused);
                    if (!paused) {
                        player.play();
                    }
                    dispatchProgress();
                } catch (Exception ignored) {
                }
            }
            return;
        }
        this.src = next;
        recoveryCount = 0;
        prepareIfPossible();
    }

    public void setMuted(boolean value) {
        this.muted = value;
        if (player != null) {
            player.setVolume(value ? 0f : 1f);
        }
    }

    public void setPaused(boolean value) {
        this.paused = value;
        if (player != null) {
            try {
                player.setPlayWhenReady(!value);
                if (!value) {
                    player.play();
                } else {
                    player.pause();
                }
            } catch (Exception ignored) {
            }
        }
    }

    public void setRepeat(boolean value) {
        this.repeat = value;
        if (player != null) {
            player.setRepeatMode(value ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
        }
    }

    public void setStartPositionMs(double value) {
        long safeValue = Math.max(0L, Math.round(value));
        this.startPositionMs = safeValue;
        if (player == null) {
            this.startPositionApplied = safeValue <= 0L;
            return;
        }
        if (safeValue <= 0L) {
            this.startPositionApplied = true;
            return;
        }
        this.startPositionApplied = false;
        if (player != null) {
            try {
                long currentPosition = Math.max(0L, player.getCurrentPosition());
                if (Math.abs(currentPosition - safeValue) > SEEK_TOLERANCE_MS) {
                    player.seekTo(safeValue);
                }
                startPositionApplied = true;
                dispatchProgress();
            } catch (Exception ignored) {
            }
        }
    }

    public void setResizeMode(String value) {
        this.resizeMode = value == null ? "stretch" : value;
        applyResizeMode();
    }

    public void setVideoRotation(float value) {
        this.rotation = value;
        applyRotation();
    }

    private void ensurePlayer() {
        if (player != null) return;

        DefaultLoadControl loadControl = new DefaultLoadControl.Builder()
                .setBufferDurationsMs(
                        4000,
                        30000,
                        750,
                        1500
                )
                .setTargetBufferBytes(C.LENGTH_UNSET)
                .setPrioritizeTimeOverSizeThresholds(true)
                .build();

        DefaultHttpDataSource.Factory httpFactory = new DefaultHttpDataSource.Factory()
                .setAllowCrossProtocolRedirects(true)
                .setConnectTimeoutMs(20000)
                .setReadTimeoutMs(45000);
        DefaultDataSource.Factory upstreamFactory = new DefaultDataSource.Factory(getContext(), httpFactory);
        CacheDataSink.Factory cacheSinkFactory = new CacheDataSink.Factory()
                .setCache(getVideoCache(getContext()))
                .setFragmentSize(CacheDataSink.DEFAULT_FRAGMENT_SIZE);
        CacheDataSource.Factory dataSourceFactory = new CacheDataSource.Factory()
                .setCache(getVideoCache(getContext()))
                .setUpstreamDataSourceFactory(upstreamFactory)
                .setCacheWriteDataSinkFactory(cacheSinkFactory)
                .setFlags(CacheDataSource.FLAG_IGNORE_CACHE_ON_ERROR);

        DefaultRenderersFactory renderersFactory = new DefaultRenderersFactory(getContext())
                .setEnableDecoderFallback(true);

        player = new ExoPlayer.Builder(getContext(), renderersFactory)
                .setLoadControl(loadControl)
                .setMediaSourceFactory(new DefaultMediaSourceFactory(dataSourceFactory))
                .build();
        playerView.setPlayer(player);
        player.setVolume(muted ? 0f : 1f);
        player.setRepeatMode(repeat ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
        player.setWakeMode(C.WAKE_MODE_NETWORK);
        player.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                if (playbackState == Player.STATE_BUFFERING) {
                    bufferingActive = true;
                    progressHandler.removeCallbacks(bufferingRecoveryRunnable);
                    progressHandler.postDelayed(bufferingRecoveryRunnable, BUFFER_STALL_RECOVERY_MS);
                    WritableMap payload = Arguments.createMap();
                    payload.putBoolean("buffering", true);
                    dispatchEvent("topBuffer", payload);
                }
                if (playbackState == Player.STATE_READY) {
                    bufferingActive = false;
                    progressHandler.removeCallbacks(bufferingRecoveryRunnable);
                    if (!startPositionApplied && startPositionMs > 0L) {
                        try {
                            long currentPosition = Math.max(0L, player.getCurrentPosition());
                            long durationMs = Math.max(0L, player.getDuration());
                            long safeSeek = startPositionMs;
                            if (durationMs > 2000L) {
                                safeSeek = Math.min(startPositionMs, Math.max(0L, durationMs - 1200L));
                            }
                            if (safeSeek > 0L && Math.abs(currentPosition - safeSeek) > SEEK_TOLERANCE_MS) {
                                player.seekTo(safeSeek);
                            }
                        } catch (Exception ignored) {
                        }
                        startPositionApplied = true;
                    }
                    WritableMap payload = Arguments.createMap();
                    payload.putBoolean("buffering", false);
                    dispatchEvent("topBuffer", payload);
                    dispatchEvent("topReady", null);
                    dispatchProgress();
                }
                if (playbackState == Player.STATE_ENDED && !repeat) {
                    bufferingActive = false;
                    progressHandler.removeCallbacks(bufferingRecoveryRunnable);
                    dispatchProgress();
                    dispatchEvent("topEnd", null);
                }
            }

            @Override
            public void onPlayerError(@NonNull PlaybackException error) {
                WritableMap event = Arguments.createMap();
                event.putString("message", buildErrorMessage(error));
                dispatchEvent("topError", event);
                attemptRecovery("player-error");
            }
        });
    }

    private String buildErrorMessage(@NonNull PlaybackException error) {
        String message = String.valueOf(error.getMessage());
        try {
            return "code="
                    + error.errorCode
                    + ", name="
                    + error.getErrorCodeName()
                    + ", msg="
                    + message;
        } catch (Exception ignored) {
            return message;
        }
    }

    private void attemptRecovery(String reason) {
        if (player == null || src.isEmpty()) return;
        long now = System.currentTimeMillis();
        if (now - lastRecoveryAtMs < RECOVERY_THROTTLE_MS) return;
        lastRecoveryAtMs = now;
        recoveryCount += 1;
        long recoverPosition = Math.max(lastKnownPositionMs, Math.max(0L, player.getCurrentPosition()));
        startPositionMs = recoverPosition;
        startPositionApplied = false;
        preparedSrc = "";
        bufferingActive = false;
        progressHandler.removeCallbacks(bufferingRecoveryRunnable);
        try {
            player.stop();
        } catch (Exception ignored) {
        }
        WritableMap event = Arguments.createMap();
        event.putString("message", "native-recovery:" + reason + ":count=" + recoveryCount);
        dispatchEvent("topError", event);
        prepareIfPossible();
    }

    private void prepareIfPossible() {
        if (!attached || src.isEmpty()) return;
        ensurePlayer();
        if (player != null && src.equals(preparedSrc) && player.getCurrentMediaItem() != null) {
            try {
                if (!startPositionApplied && startPositionMs > 0L) {
                    player.seekTo(Math.max(0L, startPositionMs));
                    startPositionApplied = true;
                }
                player.setPlayWhenReady(!paused);
                if (!paused) {
                    player.play();
                }
                dispatchProgress();
                return;
            } catch (Exception ignored) {
                // Fall through to a full prepare if the existing player state is invalid.
            }
        }
        MediaItem mediaItem = MediaItem.fromUri(Uri.parse(src));
        startPositionApplied = false;
        preparedSrc = src;
        player.setMediaItem(mediaItem, Math.max(0L, startPositionMs));
        player.prepare();
        player.setPlayWhenReady(!paused);
        if (!paused) {
            player.play();
        }
        dispatchProgress();
    }

    private void applyResizeMode() {
        int mode = AspectRatioFrameLayout.RESIZE_MODE_FILL;
        if ("cover".equalsIgnoreCase(resizeMode)) {
            mode = AspectRatioFrameLayout.RESIZE_MODE_ZOOM;
        } else if ("contain".equalsIgnoreCase(resizeMode)) {
            mode = AspectRatioFrameLayout.RESIZE_MODE_FIT;
        }
        playerView.setResizeMode(mode);
    }

    private void applyRotation() {
        playerView.setRotation(rotation);
    }

    private void dispatchEvent(String eventName, WritableMap payload) {
        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(
                getId(),
                eventName,
                payload
        );
    }

    private void dispatchProgress() {
        if (player == null) return;
        try {
            lastKnownPositionMs = Math.max(0L, player.getCurrentPosition());
            WritableMap payload = Arguments.createMap();
            payload.putDouble("positionMs", (double) lastKnownPositionMs);
            payload.putDouble("durationMs", (double) Math.max(0L, player.getDuration()));
            payload.putBoolean("isPlaying", player.isPlaying());
            dispatchEvent("topProgress", payload);
        } catch (Exception ignored) {
        }
    }

    private void releasePlayer() {
        if (player != null) {
            dispatchProgress();
            player.release();
            player = null;
        }
        bufferingActive = false;
        progressHandler.removeCallbacks(bufferingRecoveryRunnable);
        preparedSrc = "";
    }

    @Override
    protected void onAttachedToWindow() {
        super.onAttachedToWindow();
        attached = true;
        progressHandler.removeCallbacks(progressRunnable);
        progressHandler.post(progressRunnable);
        prepareIfPossible();
    }

    @Override
    protected void onDetachedFromWindow() {
        attached = false;
        progressHandler.removeCallbacks(progressRunnable);
        progressHandler.removeCallbacks(bufferingRecoveryRunnable);
        if (player != null) {
            try {
                dispatchProgress();
                player.pause();
            } catch (Exception ignored) {
            }
        }
        super.onDetachedFromWindow();
    }

    @Override
    public void onHostResume() {
        if (player != null && player.getCurrentMediaItem() != null && src.equals(preparedSrc)) {
            try {
                player.setPlayWhenReady(!paused);
                if (!paused) {
                    player.play();
                }
                dispatchProgress();
                return;
            } catch (Exception ignored) {
                // Fall back to prepareIfPossible below.
            }
        }
        prepareIfPossible();
    }

    @Override
    public void onHostPause() {
        if (player != null) {
            progressHandler.removeCallbacks(bufferingRecoveryRunnable);
            dispatchProgress();
            player.pause();
        }
    }

    @Override
    public void onHostDestroy() {
        progressHandler.removeCallbacks(progressRunnable);
        releasePlayer();
    }

    public void destroyView() {
        progressHandler.removeCallbacks(progressRunnable);
        releasePlayer();
    }
}

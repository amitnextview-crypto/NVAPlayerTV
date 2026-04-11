import { buildPlaybackResumeKey, getPlaylistAdvanceState } from "./videoPlaybackState";

describe("videoPlaybackState", () => {
  it("builds stable playback resume keys", () => {
    expect(buildPlaybackResumeKey(2, "video-a")).toBe(
      "playback:resume:section:2:video-a"
    );
  });

  it("advances sequentially and wraps only at the end", () => {
    expect(getPlaylistAdvanceState(5, 0)).toEqual({
      nextIndex: 1,
      wrappedToStart: false,
    });
    expect(getPlaylistAdvanceState(5, 4)).toEqual({
      nextIndex: 0,
      wrappedToStart: true,
    });
  });

  it("stays at zero for empty or single-item playlists", () => {
    expect(getPlaylistAdvanceState(0, 0)).toEqual({
      nextIndex: 0,
      wrappedToStart: false,
    });
    expect(getPlaylistAdvanceState(1, 0)).toEqual({
      nextIndex: 0,
      wrappedToStart: false,
    });
  });
});

describe("playback timeline store", () => {
  const prevPath = process.env.PLAYBACK_TIMELINE_PATH;
  const tmpPath = require("path").join(
    process.cwd(),
    "tmp-playback-timeline-test.json"
  );

  beforeEach(() => {
    process.env.PLAYBACK_TIMELINE_PATH = tmpPath;
    jest.resetModules();
    try {
      require("fs").unlinkSync(tmpPath);
    } catch {
    }
  });

  afterAll(() => {
    process.env.PLAYBACK_TIMELINE_PATH = prevPath;
    try {
      require("fs").unlinkSync(tmpPath);
    } catch {
    }
  });

  test("merges global and device-specific section timelines", () => {
    const store = require("../server/services/playbackTimeline");
    store.updateSectionTimeline("all", 1, {
      cycleId: "global-1",
      syncAt: 1000,
      fileCount: 3,
    });
    store.updateSectionTimeline("device-a", 2, {
      cycleId: "device-2",
      syncAt: 2000,
      fileCount: 5,
    });

    const timeline = store.getPlaybackTimeline("device-a");
    expect(timeline.sections["1"].cycleId).toBe("global-1");
    expect(timeline.sections["2"].cycleId).toBe("device-2");
  });

  test("device-specific section overrides global section", () => {
    const store = require("../server/services/playbackTimeline");
    store.updateSectionTimeline("all", 1, {
      cycleId: "global-1",
      syncAt: 1000,
    });
    store.updateSectionTimeline("device-a", 1, {
      cycleId: "device-1",
      syncAt: 2000,
    });

    const timeline = store.getPlaybackTimeline("device-a");
    expect(timeline.sections["1"].cycleId).toBe("device-1");
    expect(Number(timeline.sections["1"].syncAt || 0)).toBeGreaterThanOrEqual(2000);
  });
});

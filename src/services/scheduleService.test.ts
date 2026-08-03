import { getScheduleConflictPairs, resolveScheduledConfig } from "./scheduleService";

const profile = (id: string, layout: string) => ({ id, name: id, config: { layout, ticker: { text: id } } });
const at = (day: number, hour: number, minute = 0) => new Date(2026, 7, 2 + day, hour, minute);

describe("scheduleService", () => {
  const base = {
    layout: "fullscreen",
    ticker: { text: "default" },
    schedule: {
      enabled: true,
      profiles: [profile("morning", "grid2"), profile("night", "grid3")],
      entries: [
        { id: "morning", profileId: "morning", start: "09:00", end: "12:00", days: [0], priority: 1 },
        { id: "night", profileId: "night", start: "22:00", end: "02:00", days: [0], priority: 1 },
      ],
    },
  };

  it("uses the configured profile for a regular active slot", () => {
    const result = resolveScheduledConfig(base, at(0, 10));
    expect(result.activeEntry?.id).toBe("morning");
    expect(result.config.layout).toBe("grid2");
  });

  it("keeps a midnight-crossing slot active on the following day", () => {
    const result = resolveScheduledConfig(base, at(1, 1));
    expect(result.activeEntry?.id).toBe("night");
    expect(result.config.layout).toBe("grid3");
  });

  it("uses the higher priority entry when slots overlap", () => {
    const config = { ...base, schedule: { ...base.schedule, entries: [
      { id: "low", profileId: "morning", start: "09:00", end: "13:00", days: [0], priority: 1 },
      { id: "high", profileId: "night", start: "10:00", end: "11:00", days: [0], priority: 5 },
    ] } };
    expect(resolveScheduledConfig(config, at(0, 10, 30)).activeEntry?.id).toBe("high");
  });

  it("detects a cross-midnight conflict", () => {
    const conflicts = getScheduleConflictPairs([
      { id: "late", start: "22:00", end: "02:00", days: [0] },
      { id: "early", start: "01:00", end: "03:00", days: [1] },
    ]);
    expect(conflicts).toHaveLength(1);
  });

  it("does not schedule when Enable Schedule is off", () => {
    const config = { ...base, schedule: { ...base.schedule, enabled: false } };
    const result = resolveScheduledConfig(config, at(0, 10));
    expect(result.enabled).toBe(false);
    expect(result.activeEntry).toBeNull();
    expect(result.config).toBe(config);
  });
});

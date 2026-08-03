type ScheduleEntry = {
  id?: string;
  enabled?: boolean;
  profileId?: string;
  priority?: number;
  start?: string;
  end?: string;
  days?: number[];
};

function timeToMinutes(value: unknown): number | null {
  const parts = String(value || "").split(":");
  const hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function isEntryActive(entry: ScheduleEntry, now: Date): boolean {
  if (entry?.enabled === false) return false;
  const start = timeToMinutes(entry?.start || "00:00");
  const end = timeToMinutes(entry?.end || "23:59");
  if (start === null || end === null) return false;
  const days = Array.isArray(entry?.days) && entry.days.length
    ? entry.days.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [0, 1, 2, 3, 4, 5, 6];
  if (!days.length) return false;
  const today = now.getDay();
  const yesterday = (today + 6) % 7;
  const current = now.getHours() * 60 + now.getMinutes();
  if (start === end) return days.includes(today);
  if (start < end) return days.includes(today) && current >= start && current < end;
  return (days.includes(today) && current >= start) || (days.includes(yesterday) && current < end);
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value || {}));
}

function mergeProfile(baseConfig: any, profileConfig: any) {
  const next = { ...baseConfig, ...(profileConfig || {}) };
  next.ticker = { ...(baseConfig?.ticker || {}), ...(profileConfig?.ticker || {}) };
  next.cache = { ...(baseConfig?.cache || {}), ...(profileConfig?.cache || {}) };
  if (Array.isArray(profileConfig?.sections)) next.sections = cloneValue(profileConfig.sections);
  next.schedule = baseConfig?.schedule;
  return next;
}

export function resolveScheduledConfig(baseConfig: any, now = new Date()) {
  const schedule = baseConfig?.schedule || {};
  if (!schedule?.enabled) return { config: baseConfig, enabled: false, activeEntry: null };
  const entries: ScheduleEntry[] = Array.isArray(schedule.entries) && schedule.entries.length
    ? schedule.entries
    : [{ id: "legacy", enabled: true, start: schedule.start, end: schedule.end, days: schedule.days, priority: 0 }];
  const active = entries.filter((entry: ScheduleEntry) => isEntryActive(entry, now))
    .sort((a: ScheduleEntry, b: ScheduleEntry) => Number(b?.priority || 0) - Number(a?.priority || 0) || String(a?.id || "").localeCompare(String(b?.id || "")))[0] || null;
  if (!active) return { config: baseConfig, enabled: true, activeEntry: null };
  const profiles = Array.isArray(schedule.profiles) ? schedule.profiles : [];
  const profile = profiles.find((item: any) => String(item?.id || "") === String(active?.profileId || ""));
  return { config: profile?.config ? mergeProfile(baseConfig, profile.config) : baseConfig, enabled: true, activeEntry: active, profile: profile || null };
}

export function createScheduleProfileSnapshot(config: any) {
  const snapshot = cloneValue(config);
  delete snapshot.schedule;
  return snapshot;
}

export function getScheduleConflictPairs(entries: ScheduleEntry[] = []) {
  const active = entries.filter((entry) => entry && entry.enabled !== false);
  const pairs: Array<[ScheduleEntry, ScheduleEntry]> = [];
  // Return the parts of an entry that occur on `day`. A midnight-crossing
  // entry contributes its late part on its selected day and its early part on
  // the following day; this is important for accurate conflict warnings.
  const coveredMinutes = (entry: ScheduleEntry, day: number) => {
    const start = timeToMinutes(entry.start || "00:00");
    const end = timeToMinutes(entry.end || "23:59");
    const days = Array.isArray(entry.days) && entry.days.length ? entry.days.map(Number) : [0, 1, 2, 3, 4, 5, 6];
    if (start === null || end === null) return [] as Array<[number, number]>;
    if (start === end) return [[0, 1440]];
    if (start < end) return days.includes(day) ? [[start, end]] : [];
    const previousDay = (day + 6) % 7;
    const parts: Array<[number, number]> = [];
    if (days.includes(day)) parts.push([start, 1440]);
    if (days.includes(previousDay)) parts.push([0, end]);
    return parts;
  };
  for (let i = 0; i < active.length; i += 1) for (let j = i + 1; j < active.length; j += 1) {
    let overlaps = false;
    for (let day = 0; day < 7 && !overlaps; day += 1) for (const a of coveredMinutes(active[i], day)) for (const b of coveredMinutes(active[j], day)) {
      if (a[0] < b[1] && b[0] < a[1]) overlaps = true;
    }
    if (overlaps) pairs.push([active[i], active[j]]);
  }
  return pairs;
}

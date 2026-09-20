const fs = require("node:fs");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

function dayKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

// Split at local midnight, including 23/25-hour daylight-saving days.
function addInterval(days, start, end) {
  while (start < end) {
    const date = new Date(start);
    const midnight = new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate() + 1,
    ).getTime();
    const until = Math.min(midnight, end);
    const key = dayKey(date);
    days[key] = (days[key] || 0) + until - start;
    start = until;
  }
}

class Tracker {
  constructor(file, now = Date.now) {
    this.file = file;
    this.now = now;
    this.data = { version: 1, days: {}, sessions: [] };
    if (fs.existsSync(file)) {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      if (
        !data ||
        data.version !== 1 ||
        !data.days ||
        typeof data.days !== "object" ||
        Array.isArray(data.days) ||
        !Array.isArray(data.sessions) ||
        data.sessions.some(
          (s) =>
            !s ||
            typeof s.id !== "string" ||
            !Number.isFinite(s.start) ||
            !Number.isFinite(s.end) ||
            !Number.isFinite(s.duration) ||
            s.duration < 0,
        ) ||
        Object.entries(data.days).some(
          ([key, value]) =>
            !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
            !Number.isFinite(value) ||
            value < 0,
        )
      ) {
        throw new Error(
          "The saved tracking file is invalid. Your original file has not been changed.",
        );
      }
      this.data = data;
    }
    // A previous process may have crashed: never add time since its last checkpoint.
    this.active = null;
  }
  save() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(`${this.file}.tmp`, JSON.stringify(this.data));
    fs.renameSync(`${this.file}.tmp`, this.file);
  }
  start() {
    if (this.active) return this.snapshot();
    const start = this.now();
    const session = { id: randomUUID(), start, end: start, duration: 0 };
    this.data.sessions.push(session);
    this.active = { session, last: start };
    this.save();
    return this.snapshot();
  }
  checkpoint() {
    if (!this.active) return;
    const end = this.now();
    const { session, last } = this.active;
    // Do not count clock corrections backwards.
    if (end > last) {
      addInterval(this.data.days, last, end);
      session.duration += end - last;
    }
    session.end = end;
    this.active.last = end;
    this.save();
  }
  stop() {
    this.checkpoint();
    this.active = null;
    return this.snapshot();
  }
  snapshot() {
    return JSON.parse(
      JSON.stringify({ ...this.data, active: this.active?.session || null }),
    );
  }
}
module.exports = { Tracker, dayKey, addInterval };

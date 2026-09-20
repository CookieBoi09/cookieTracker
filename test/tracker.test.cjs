const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { Tracker, addInterval, dayKey } = require("../src/tracker.cjs");
function fixture(t, initial = new Date(2026, 8, 19, 12).getTime()) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cookie-tracker-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "tracking.json");
  let now = initial;
  const tracker = new Tracker(file, () => now);
  return {
    tracker,
    file,
    advance: (ms) => {
      now += ms;
    },
  };
}
test("start is idempotent; stop persists elapsed time and stops accumulation", (t) => {
  const { tracker, advance, file } = fixture(t);
  tracker.start();
  tracker.start();
  advance(12345);
  tracker.stop();
  advance(50000);
  tracker.checkpoint();
  assert.equal(tracker.snapshot().sessions.length, 1);
  assert.equal(tracker.snapshot().sessions[0].duration, 12345);
  assert.equal(tracker.snapshot().active, null);
  assert.equal(new Tracker(file).snapshot().days["2026-09-19"], 12345);
});
test("checkpoints do not double count and recovery never counts closed time", (t) => {
  const { tracker, advance, file } = fixture(t);
  tracker.start();
  advance(1000);
  tracker.checkpoint();
  advance(1000);
  tracker.checkpoint();
  advance(86400000);
  const recovered = new Tracker(file);
  assert.equal(recovered.snapshot().active, null);
  assert.equal(recovered.snapshot().sessions[0].duration, 2000);
  assert.equal(recovered.snapshot().days["2026-09-19"], 2000);
});
test("sessions split at local midnight and the new year", (t) => {
  const { tracker, advance } = fixture(
    t,
    new Date(2024, 11, 31, 23, 59, 59).getTime(),
  );
  tracker.start();
  advance(3000);
  tracker.stop();
  assert.deepEqual(tracker.snapshot().days, {
    "2024-12-31": 1000,
    "2025-01-01": 2000,
  });
});
test("leap days and daylight-saving boundaries use local calendar days", () => {
  const days = {};
  addInterval(
    days,
    new Date(2024, 1, 28, 23).getTime(),
    new Date(2024, 2, 1, 1).getTime(),
  );
  assert.equal(days["2024-02-29"], 86400000);
  const dst = {};
  const start = new Date(2026, 2, 8),
    end = new Date(2026, 2, 9);
  addInterval(dst, start.getTime(), end.getTime());
  assert.equal(dst[dayKey(start)], end - start);
});
test("clock moving backward never subtracts tracked time", (t) => {
  const { tracker, advance } = fixture(t);
  tracker.start();
  advance(2000);
  tracker.checkpoint();
  advance(-1000);
  tracker.stop();
  assert.equal(tracker.snapshot().sessions[0].duration, 2000);
});
test("invalid saved data is reported without overwriting it", (t) => {
  const { file } = fixture(t);
  fs.writeFileSync(file, "not valid json");
  assert.throws(() => new Tracker(file));
  assert.equal(fs.readFileSync(file, "utf8"), "not valid json");
});

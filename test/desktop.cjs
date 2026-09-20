const { _electron: electron } = require("playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "cookie-ui-"));
  const options = {
    executablePath: require("electron"),
    args: [".", `--user-data-dir=${directory}`],
    cwd: path.join(__dirname, ".."),
  };
  let app;
  try {
    app = await electron.launch(options);
    const actual = await app.evaluate(({ app }) => app.getPath("userData"));
    assert.equal(fs.realpathSync(actual), fs.realpathSync(directory));
    let page = await app.firstWindow();
    await page.waitForSelector("#toggle:not([disabled])");
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: path.join(process.env.SCREENSHOT_DIR, "cookie-tracker.png"),
        fullPage: true,
      });
    await page.click("#toggle");
    await page.waitForFunction(
      () => document.querySelector("#clock").textContent !== "00:00:00",
    );
    await page.click("#toggle");
    assert.equal(
      await page.locator("#button-text").textContent(),
      "Start tracking",
    );
    let snapshot = await page.evaluate(() => window.tracker.read());
    assert.equal(snapshot.sessions.length, 1);
    assert.ok(snapshot.sessions[0].duration >= 1000);
    await page.click("#history-nav");
    await page.waitForSelector("#history-page:visible");
    const currentYear = new Date().getFullYear();
    assert.equal(
      await page.locator("#history-heatmap button.day").count(),
      new Date(currentYear, 1, 29).getMonth() === 1 ? 366 : 365,
    );
    for (let y = currentYear; y > 2024; y--) await page.click("#prev-year");
    assert.equal(await page.locator("#year-label").textContent(), "2024");
    assert.equal(
      await page.locator("#history-heatmap button.day").count(),
      366,
    );
    await page.locator("#history-heatmap button.day").nth(59).click();
    assert.match(
      await page.locator("#day-detail").textContent(),
      /February 29/,
    );
    await page.click("#this-year");
    if (process.env.SCREENSHOT_DIR)
      await page.screenshot({
        path: path.join(
          process.env.SCREENSHOT_DIR,
          "cookie-tracker-history.png",
        ),
        fullPage: true,
      });
    await page.click("#timer-nav");
    await page.click("#toggle");
    await page.waitForFunction(
      () => document.querySelector("#clock").textContent !== "00:00:00",
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    );
    await app.close().catch(() => {});
    app = null;
    const saved = JSON.parse(
      fs.readFileSync(path.join(directory, "tracking.json"), "utf8"),
    );
    assert.equal(saved.sessions.length, 2);
    app = await electron.launch(options);
    page = await app.firstWindow();
    await page.waitForSelector("#toggle:not([disabled])");
    snapshot = await page.evaluate(() => window.tracker.read());
    assert.equal(snapshot.active, null);
    assert.deepEqual(snapshot.days, saved.days);
    assert.equal(snapshot.sessions.length, 2);
    await page.click("#toggle");
    await app.evaluate(({ powerMonitor }) => powerMonitor.emit("suspend"));
    snapshot = await page.evaluate(() => window.tracker.read());
    assert.equal(snapshot.active, null);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: start/stop, year navigation, leap-day selection, close/reopen persistence, sleep stop, no renderer errors",
    );
  } finally {
    if (app) await app.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

# Cookie Tracker

A small, local-first desktop time tracker. Start a session, do your thing, and stop when you’re done. Closing the window or putting the computer to sleep stops tracking automatically.

## Run

Use Node.js 22.12 or newer and npm.

```sh
npm install
npm start
```

## Your workflow

- **Timer:** press Start tracking. Press Stop tracking to save the session, or close the app.
- **History:** browse calendar years with the arrow buttons. Select a day in the GitHub-style activity grid to see its total. Monthly bars show how your time adds up.
- The app opens stopped every time. Sleep stops a session; waking up does not restart it. Minimizing the window keeps tracking.
- Green squares represent under 30 minutes, 30–59 minutes, 1–2 hours, and 2+ hours. An empty square means no time tracked.
- Sessions crossing midnight are allocated to their local calendar days. The current streak includes yesterday if you haven’t tracked today yet.

## Storage and recovery

No account or network connection is needed. History is saved to `tracking.json` inside Electron’s per-user application data directory (`~/Library/Application Support/cookie-tracker` on macOS). Back up that file while the app is closed to preserve or transfer history. Data is not synced between devices.

The main process owns one timer, prevents duplicate app instances, and saves an atomic checkpoint every second. Normal close saves the final interval. If the app or computer crashes, the next launch uses the last checkpoint and never adds time spent closed; the final second may be lost. Invalid data is reported without replacing the original file. Keep your system clock accurate while tracking.

## Validate and package

```sh
npm test
npm run test:desktop
npm run format:check
npm run dist
```

The desktop test opens the real app with isolated temporary data; it requires a graphical desktop. It covers Start/Stop, year navigation, leap-day selection, closing and reopening, and stopping on sleep. Set `SCREENSHOT_DIR` to an existing folder to capture the Timer and History pages during the test.

The packaging command builds for the host platform: a macOS DMG, Windows installer, or Linux AppImage in `dist/`. Public distribution may require platform signing credentials; these are not included.

The UI is plain HTML/CSS/JavaScript. Electron uses a sandboxed renderer, context isolation, and a narrow preload API. The timer and filesystem access stay in the main process. Unit tests cover persistence, stop behavior, crash recovery, repeated starts, midnight/year boundaries, leap days, daylight-saving boundaries, and invalid data.

const $ = (selector) => document.querySelector(selector);
let state = { days: {}, sessions: [], active: null };
let year = new Date().getFullYear();
let selectedDay = null;
let pending = false;
const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const key = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const duration = (ms) => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const clock = (ms) => {
  const seconds = Math.floor(ms / 1000);
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
};
const level = (ms) =>
  ms <= 0 ? 0 : ms < 1800000 ? 1 : ms < 3600000 ? 2 : ms < 7200000 ? 3 : 4;
const sum = (values) => values.reduce((a, b) => a + b, 0);
function stat(label, value, note, icon) {
  return `<article class="stat"><div class="stat-label">${label}<span class="stat-icon" aria-hidden="true">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></article>`;
}
function heatmap(target, forYear) {
  const container = $(target);
  container.replaceChildren();
  const scroll = document.createElement("div");
  scroll.className = "heatmap-scroll";
  const heat = document.createElement("div");
  heat.className = "heatmap";
  const weekdays = document.createElement("div");
  weekdays.className = "weekday-labels";
  ["", "", "Mon", "", "Wed", "", "Fri", ""].forEach((text) => {
    const el = document.createElement("span");
    el.textContent = text;
    weekdays.append(el);
  });
  const wrap = document.createElement("div");
  wrap.className = "grid-wrap";
  const labels = document.createElement("div");
  labels.className = "month-labels";
  const grid = document.createElement("div");
  grid.className = "day-grid";
  const first = new Date(forYear, 0, 1);
  const count = Math.round(
    (Date.UTC(forYear + 1, 0, 1) - Date.UTC(forYear, 0, 1)) / 86400000,
  );
  const offset = first.getDay();
  const weeks = Math.ceil((offset + count) / 7);
  labels.style.gridTemplateColumns = `repeat(${weeks}, 1fr)`;
  for (let m = 0; m < 12; m++) {
    const date = new Date(forYear, m, 1);
    const index = Math.round(
      (Date.UTC(forYear, m, 1) - Date.UTC(forYear, 0, 1)) / 86400000,
    );
    const el = document.createElement("span");
    el.textContent = months[m];
    el.style.gridColumn = String(Math.floor((offset + index) / 7) + 1);
    labels.append(el);
  }
  const today = key(new Date());
  for (let i = 0; i < weeks * 7; i++) {
    const date = new Date(forYear, 0, i - offset + 1);
    const day = key(date);
    const blank = date.getFullYear() !== forYear;
    const ms = state.days[day] || 0;
    const el = document.createElement(blank ? "span" : "button");
    el.className = `day level-${level(ms)}${blank ? " blank" : ""}${day > today ? " future" : ""}${day === selectedDay ? " selected-day" : ""}`;
    if (!blank) {
      const label = `${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}: ${duration(ms)} tracked`;
      el.title = label;
      el.setAttribute("aria-label", label);
      el.disabled = day > today;
      el.addEventListener("click", () => {
        year = forYear;
        selectedDay = day;
        location.hash = "history";
        renderHistory();
      });
    }
    grid.append(el);
  }
  wrap.append(labels, grid);
  heat.append(weekdays, wrap);
  scroll.append(heat);
  container.append(scroll);
  const footer = document.createElement("div");
  footer.className = "heatmap-footer";
  footer.innerHTML =
    '<span>Each square is a day. Every minute counts.</span><div class="legend"><span>Less</span><i title="No time"></i><i class="level-1" title="Under 30 minutes"></i><i class="level-2" title="30–59 minutes"></i><i class="level-3" title="1–2 hours"></i><i class="level-4" title="2+ hours"></i><span>More</span></div>';
  container.append(footer);
}
function renderTimer() {
  const now = new Date();
  const today = key(now);
  const total = state.days[today] || 0;
  $("#today-date").textContent = now
    .toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toUpperCase();
  $("#clock").textContent = clock(state.active?.duration || 0);
  $("#status").classList.toggle("running", !!state.active);
  $("#status").innerHTML = state.active
    ? "<span></span> IN YOUR OWN TIME"
    : "<span></span> READY WHEN YOU ARE";
  $("#button-text").textContent = state.active
    ? "Stop tracking"
    : "Start tracking";
  $("#button-icon").textContent = state.active ? "■" : "▶";
  $("#timer-caption").textContent = state.active
    ? "One moment closer to what matters."
    : "Your next small step starts here.";
  const midnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
  ).getTime();
  const todaySessions = state.sessions.filter(
    (s) =>
      (s.end > midnight && s.start < nextMidnight) || s.id === state.active?.id,
  );
  let streak = 0;
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (!total) date.setDate(date.getDate() - 1);
  while (state.days[key(date)] > 0) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  $("#today-stats").innerHTML =
    stat(
      "Time today",
      duration(total),
      total
        ? "Time you’ve made for yourself."
        : "Your first minute is waiting.",
      "◷",
    ) +
    stat(
      "Sessions today",
      String(todaySessions.length),
      "Room for one more small step.",
      "≋",
    ) +
    stat(
      "Current streak",
      `${streak} ${streak === 1 ? "day" : "days"}`,
      "Keep showing up for yourself.",
      "↗",
    );
  $("#session-count").textContent =
    `${todaySessions.length} ${todaySessions.length === 1 ? "session" : "sessions"}`;
  const list = $("#sessions");
  list.replaceChildren();
  if (!todaySessions.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent =
      "A fresh start. Press Start tracking to begin your first session.";
    list.append(empty);
  }
  todaySessions
    .slice()
    .reverse()
    .forEach((s) => {
      const row = document.createElement("div");
      row.className = "session";
      const active = s.id === state.active?.id;
      const time = (t) =>
        new Date(t).toLocaleTimeString(undefined, {
          hour: "2-digit",
          minute: "2-digit",
        });
      row.innerHTML = `<div>${active ? "In progress" : "Focus session"}<div class="session-time">${time(s.start)} — ${active ? "Now" : time(s.end)}</div></div><span class="session-duration">${duration(s.duration)}</span>`;
      list.append(row);
    });
}
function renderHistory() {
  $("#year-label").textContent = year;
  $("#prev-year").disabled = year <= 1970;
  $("#next-year").disabled = year >= new Date().getFullYear();
  const entries = Object.entries(state.days).filter(([day]) =>
    day.startsWith(`${year}-`),
  );
  const total = sum(entries.map(([, ms]) => ms));
  const days = entries.filter(([, ms]) => ms > 0).length;
  $("#year-stats").innerHTML =
    stat(
      "Total time",
      duration(total),
      "All your moments, added together.",
      "◷",
    ) +
    stat("Active days", String(days), "Days you made a little space.", "▦") +
    stat(
      "Daily average",
      duration(days ? total / days : 0),
      "Across the days you tracked.",
      "↗",
    );
  heatmap("#history-heatmap", year);
  $("#day-detail").textContent = selectedDay
    ? `${new Date(selectedDay + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })} · ${duration(state.days[selectedDay] || 0)} tracked`
    : "Select a square to explore your day.";
  const totals = months.map((_, i) =>
    sum(
      entries
        .filter(([day]) => Number(day.slice(5, 7)) === i + 1)
        .map(([, ms]) => ms),
    ),
  );
  const maximum = Math.max(...totals, 1);
  const bars = $("#months");
  bars.replaceChildren();
  months.forEach((month, i) => {
    const el = document.createElement("div");
    el.className = "month";
    el.innerHTML = `<div class="bar-track"><div class="bar"></div></div><span>${month}</span><div class="month-total">${duration(totals[i])}</div>`;
    el.querySelector(".bar").style.height = `${(totals[i] / maximum) * 100}%`;
    el.title = `${month} ${year}: ${duration(totals[i])}`;
    bars.append(el);
  });
}
function route() {
  const history = location.hash === "#history";
  $("#timer-page").hidden = history;
  $("#history-page").hidden = !history;
  $("#timer-nav").classList.toggle("selected", !history);
  $("#history-nav").classList.toggle("selected", history);
  $("#timer-nav").setAttribute("aria-current", history ? "false" : "page");
  $("#history-nav").setAttribute("aria-current", history ? "page" : "false");
  if (history) renderHistory();
  else {
    renderTimer();
    heatmap("#current-heatmap", new Date().getFullYear());
  }
}
$("#prev-year").onclick = () => {
  if (year > 1970) {
    year--;
    selectedDay = null;
    renderHistory();
  }
};
$("#next-year").onclick = () => {
  if (year < new Date().getFullYear()) {
    year++;
    selectedDay = null;
    renderHistory();
  }
};
$("#this-year").onclick = () => {
  year = new Date().getFullYear();
  selectedDay = null;
  renderHistory();
};
$("#toggle").onclick = async () => {
  if (pending) return;
  pending = true;
  $("#toggle").disabled = true;
  try {
    state = await (state.active
      ? window.tracker.stop()
      : window.tracker.start());
    renderTimer();
    heatmap("#current-heatmap", new Date().getFullYear());
  } catch (error) {
    $("#error").textContent = `Could not update the timer: ${error.message}`;
    $("#error").hidden = false;
  } finally {
    pending = false;
    $("#toggle").disabled = false;
  }
};
window.addEventListener("hashchange", route);
if (window.tracker) {
  window.tracker.onChange((next) => {
    const changed = JSON.stringify(state.days) !== JSON.stringify(next.days);
    state = next;
    renderTimer();
    if (location.hash === "#history") {
      if (changed) renderHistory();
    } else if (changed) heatmap("#current-heatmap", new Date().getFullYear());
  });
  window.tracker
    .read()
    .then((next) => {
      state = next;
      route();
    })
    .catch((error) => {
      $("#error").textContent = error.message;
      $("#error").hidden = false;
    });
} else {
  route();
  $("#toggle").disabled = true;
  $("#error").textContent =
    "Open Cookie Tracker with npm start to track time. This browser view is a preview.";
  $("#error").hidden = false;
}

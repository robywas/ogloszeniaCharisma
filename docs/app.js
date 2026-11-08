const REFRESH_MS = 5 * 60 * 1000;

let loadedOnce = false;

function eventsJsonUrl() {
  const base = window.location.href.endsWith("/")
    ? window.location.href
    : `${window.location.href}/`;
  return new URL("events.json", base).href;
}

function escapeHtml(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function formatRange(ev) {
  return ev.timeLabel;
}

function upcomingEvents(events, now = new Date()) {
  return events.filter((ev) => new Date(ev.start) > now);
}

function groupByDay(events) {
  const groups = new Map();
  for (const ev of events) {
    if (!groups.has(ev.dateLabel)) {
      groups.set(ev.dateLabel, { dateLabel: ev.dateLabel, events: [] });
    }
    groups.get(ev.dateLabel).events.push(ev);
  }
  return [...groups.values()];
}

function renderEventItem(ev) {
  const location = ev.location
    ? `<p class="event__location">${escapeHtml(ev.location)}</p>`
    : "";
  const description = ev.description
    ? `<p class="event__description">${escapeHtml(ev.description)}</p>`
    : "";

  return `
    <li class="event">
      <span class="event__time">${escapeHtml(formatRange(ev))}</span>
      <div class="event__body">
        <h3 class="event__title">${escapeHtml(ev.title)}</h3>
        ${location}
        ${description}
      </div>
    </li>
  `;
}

function render(payload) {
  if (!payload || !Array.isArray(payload.events)) {
    throw new Error("Nieprawidłowy plik events.json");
  }

  document.title = payload.title;
  document.getElementById("title").textContent = payload.title || "Wydarzenia";

  const list = document.getElementById("events");
  const empty = document.getElementById("empty");
  list.innerHTML = "";

  const events = upcomingEvents(payload.events);
  if (!events.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  const days = groupByDay(events);
  const columnFirst = payload.dayLayout === "columns";
  list.className = columnFirst ? "events events--columns" : "events events--rows";
  list.style.setProperty("--day-rows", String(Math.ceil(days.length / 2)));

  for (const day of days) {
    const dayEl = document.createElement("li");
    dayEl.className = "day";
    dayEl.innerHTML = `
      <h2 class="day__date">${escapeHtml(day.dateLabel)}</h2>
      <ul class="day__events">
        ${day.events.map(renderEventItem).join("")}
      </ul>
    `;
    list.appendChild(dayEl);
  }
}

async function load() {
  const res = await fetch(`${eventsJsonUrl()}?t=${Date.now()}`);
  if (!res.ok) {
    throw new Error(`Nie można wczytać events.json (${res.status})`);
  }
  const payload = await res.json();
  render(payload);
  loadedOnce = true;
}

function showError(err) {
  document.getElementById("title").textContent = "Błąd ładowania";
  const empty = document.getElementById("empty");
  empty.textContent = err.message;
  empty.hidden = false;
}

const STAGE_W = 1920;
const STAGE_H = 1080;

function fitStage() {
  const stage = document.getElementById("stage");
  if (!stage) return;

  if (window.matchMedia("(orientation: portrait)").matches) {
    stage.style.transform = "none";
    stage.style.width = "100%";
    stage.style.height = "auto";
    return;
  }

  const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  const x = (window.innerWidth - STAGE_W * scale) / 2;
  stage.style.width = `${STAGE_W}px`;
  stage.style.height = `${STAGE_H}px`;
  stage.style.transform = `translate(${x}px, 0px) scale(${scale})`;
}

window.addEventListener("resize", fitStage);
window.matchMedia("(orientation: portrait)").addEventListener("change", fitStage);
fitStage();

load().catch(showError);

setInterval(() => {
  load().catch((err) => {
    if (!loadedOnce) showError(err);
    console.error("Odświeżanie wydarzeń:", err);
  });
}, REFRESH_MS);

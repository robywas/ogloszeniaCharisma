const REFRESH_MS = 5 * 60 * 1000;

function escapeHtml(text) {
  const el = document.createElement("span");
  el.textContent = text;
  return el.innerHTML;
}

function formatRange(ev) {
  if (ev.allDay) return ev.timeLabel;
  if (ev.endTimeLabel) return `${ev.timeLabel} – ${ev.endTimeLabel}`;
  return ev.timeLabel;
}

function render(payload) {
  document.title = payload.title;
  document.getElementById("title").textContent = payload.title;

  const updated = new Date(payload.generatedAt);
  const meta = document.getElementById("meta");
  meta.textContent = `Odświeżono: ${updated.toLocaleString("pl-PL")} · strefa: ${payload.timezone}`;

  const list = document.getElementById("events");
  const empty = document.getElementById("empty");
  list.innerHTML = "";

  if (!payload.events.length) {
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  for (const ev of payload.events) {
    const li = document.createElement("li");
    li.className = "event";
    li.innerHTML = `
      <div class="event__when">
        <span class="event__date">${escapeHtml(ev.dateLabel)}</span>
        <span class="event__time">${escapeHtml(formatRange(ev))}</span>
      </div>
      <div class="event__body">
        <h2 class="event__title">${escapeHtml(ev.title)}</h2>
        ${ev.location ? `<p class="event__location">${escapeHtml(ev.location)}</p>` : ""}
        ${ev.description ? `<p class="event__description">${escapeHtml(ev.description)}</p>` : ""}
      </div>
    `;
    list.appendChild(li);
  }
}

async function load() {
  const res = await fetch(`events.json?t=${Date.now()}`);
  if (!res.ok) throw new Error("Nie można wczytać events.json");
  const payload = await res.json();
  render(payload);
}

load().catch((err) => {
  document.getElementById("title").textContent = "Błąd ładowania";
  document.getElementById("meta").textContent = err.message;
});

setInterval(load, REFRESH_MS);

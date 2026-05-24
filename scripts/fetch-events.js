import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import ical from "node-ical";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadConfig() {
  const path = existsSync(join(root, "config.json"))
    ? join(root, "config.json")
    : join(root, "config.example.json");

  if (!existsSync(path)) {
    console.error("Brak config.json — skopiuj config.example.json.");
    process.exit(1);
  }

  const config = JSON.parse(readFileSync(path, "utf8"));
  if (process.env.ICAL_URL) config.icalUrl = process.env.ICAL_URL;
  if (!config.icalUrl || config.icalUrl.includes("TWOJ_ID")) {
    console.error("Ustaw icalUrl w config.json lub zmienną ICAL_URL.");
    process.exit(1);
  }
  return config;
}

function startOfDay(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return new Date(`${y}-${m}-${d}T00:00:00`);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function stripHtml(text) {
  return text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}

function toEventSummary(vevent, timeZone) {
  const start = vevent.start instanceof Date ? vevent.start : new Date(vevent.start);
  const end = vevent.end instanceof Date ? vevent.end : vevent.end ? new Date(vevent.end) : null;
  const allDay =
    vevent.datetype === "date" ||
    (start.getHours() === 0 &&
      start.getMinutes() === 0 &&
      end &&
      (end.getTime() - start.getTime()) % 86400000 === 0);

  const dateLabel = new Intl.DateTimeFormat("pl-PL", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .formatToParts(start)
    .map((p) => (p.type === "month" ? p.value.toLowerCase() : p.value))
    .join("");

  return {
    uid: vevent.uid,
    title: vevent.summary || "(bez tytułu)",
    location: vevent.location || "",
    description: stripHtml((vevent.description || "").replace(/\r\n/g, "\n")),
    allDay,
    start: start.toISOString(),
    end: end ? end.toISOString() : null,
    dateLabel,
    timeLabel: allDay ? "cały dzień" : new Intl.DateTimeFormat("pl-PL", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    }).format(start),
  };
}

async function main() {
  const config = loadConfig();
  const timeZone = config.timezone || "Europe/Warsaw";
  const daysAhead = config.daysAhead ?? 7;
  const excludeTitles = new Set(
    (config.excludeTitles || []).map((t) => t.toLowerCase())
  );

  const res = await fetch(config.icalUrl);
  if (!res.ok) {
    throw new Error(`Nie udało się pobrać iCal: ${res.status} ${res.statusText}`);
  }
  const icsText = await res.text();
  const parsed = ical.sync.parseICS(icsText);

  const tomorrow = addDays(startOfDay(new Date(), timeZone), 1);
  const windowEnd = addDays(tomorrow, daysAhead);

  const events = Object.values(parsed)
    .filter((item) => item.type === "VEVENT")
    .map((vevent) => toEventSummary(vevent, timeZone))
    .filter((ev) => {
      const start = new Date(ev.start);
      const end = ev.end ? new Date(ev.end) : start;
      if (excludeTitles.has(ev.title.toLowerCase())) return false;
      return end >= tomorrow && start < windowEnd;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const outDir = join(root, "docs");
  mkdirSync(outDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    timezone: timeZone,
    daysAhead,
    title: config.title || "Wydarzenia",
    dayLayout: config.dayLayout === "columns" ? "columns" : "rows",
    events,
  };

  writeFileSync(join(outDir, "events.json"), JSON.stringify(payload, null, 2), "utf8");
  console.log(`Zapisano ${events.length} wydarzeń → docs/events.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

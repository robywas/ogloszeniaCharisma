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

/** Północ danego dnia kalendarzowego w podanej strefie → Date (UTC instant). */
function midnightInTimeZone(timeZone, year, month, day) {
  for (let hour = -2; hour <= 26; hour++) {
    const test = new Date(Date.UTC(year, month - 1, day, hour, 0, 0, 0));
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      hour12: false,
    }).formatToParts(test);

    const y = Number(parts.find((p) => p.type === "year").value);
    const m = Number(parts.find((p) => p.type === "month").value);
    const d = Number(parts.find((p) => p.type === "day").value);
    const h = Number(parts.find((p) => p.type === "hour").value);

    if (y === year && m === month && d === day && h === 0) {
      return test;
    }
  }
  throw new Error(`Nie udało się ustalić północy: ${year}-${month}-${day} (${timeZone})`);
}

function addCalendarDays(year, month, day, days) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function getTodayParts(timeZone, ref = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(ref);

  return {
    year: Number(parts.find((p) => p.type === "year").value),
    month: Number(parts.find((p) => p.type === "month").value),
    day: Number(parts.find((p) => p.type === "day").value),
  };
}

/** Okno: [jutro 00:00, jutro + daysAhead dni 00:00) w strefie config. */
function getWindowBounds(timeZone, daysAhead) {
  const today = getTodayParts(timeZone);
  const tomorrow = addCalendarDays(today.year, today.month, today.day, 1);
  const windowEndDay = addCalendarDays(
    tomorrow.year,
    tomorrow.month,
    tomorrow.day,
    daysAhead
  );

  return {
    windowStart: midnightInTimeZone(
      timeZone,
      tomorrow.year,
      tomorrow.month,
      tomorrow.day
    ),
    windowEnd: midnightInTimeZone(
      timeZone,
      windowEndDay.year,
      windowEndDay.month,
      windowEndDay.day
    ),
  };
}

function toDate(value) {
  if (value instanceof Date) return value;
  return new Date(value);
}

function stripHtml(text) {
  return text.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}

function eventDurationMs(vevent) {
  const start = toDate(vevent.start);
  const end = vevent.end ? toDate(vevent.end) : null;
  if (!end || end <= start) return 60 * 60 * 1000;
  return end.getTime() - start.getTime();
}

function toEventSummary(vevent, occurrenceStart, timeZone) {
  const start = toDate(occurrenceStart);
  const durationMs = eventDurationMs(vevent);
  const end = new Date(start.getTime() + durationMs);

  const allDay =
    vevent.datetype === "date" ||
    (durationMs >= 86400000 - 1000 && durationMs <= 86400000 + 1000);

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
    uid: `${vevent.uid}-${start.toISOString()}`,
    title: vevent.summary || "(bez tytułu)",
    location: vevent.location || "",
    description: stripHtml((vevent.description || "").replace(/\r\n/g, "\n")),
    allDay,
    start: start.toISOString(),
    end: end.toISOString(),
    dateLabel,
    timeLabel: allDay
      ? "cały dzień"
      : new Intl.DateTimeFormat("pl-PL", {
          timeZone,
          hour: "2-digit",
          minute: "2-digit",
        }).format(start),
  };
}

function isInWindow(start, windowStart, windowEnd) {
  return start >= windowStart && start < windowEnd;
}

function dedupeKey(ev) {
  return `${ev.start.slice(0, 16)}|${ev.title.toLowerCase().trim()}`;
}

function dateKeyInZone(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(toDate(date));
}

function isExcludedOccurrence(vevent, occurrenceStart, timeZone) {
  if (vevent.exdate && typeof vevent.exdate === "object") {
    const occKey = dateKeyInZone(occurrenceStart, timeZone);
    for (const key of Object.keys(vevent.exdate)) {
      if (key === occKey) return true;
      const ex = vevent.exdate[key];
      if (ex instanceof Date && dateKeyInZone(ex, timeZone) === occKey) return true;
    }
  }

  const recKey = dateKeyInZone(occurrenceStart, timeZone);
  const override = vevent.recurrences?.[recKey];
  if (override?.status === "CANCELLED") return true;

  return false;
}

function collectEvents(vevent, windowStart, windowEnd, timeZone, out) {
  if (vevent.rrule) {
    const occurrences = vevent.rrule.between(windowStart, windowEnd, true);
    for (const occ of occurrences) {
      const start = toDate(occ);
      if (!isInWindow(start, windowStart, windowEnd)) continue;
      if (isExcludedOccurrence(vevent, start, timeZone)) continue;

      const recKey = dateKeyInZone(start, timeZone);
      const override = vevent.recurrences?.[recKey];
      if (override && override.status !== "CANCELLED") {
        const overrideStart = toDate(override.start);
        if (isInWindow(overrideStart, windowStart, windowEnd)) {
          out.push(toEventSummary({ ...vevent, ...override }, overrideStart, timeZone));
        }
        continue;
      }

      out.push(toEventSummary(vevent, start, timeZone));
    }
    return;
  }

  if (vevent.status === "CANCELLED") return;

  const start = toDate(vevent.start);
  if (!isInWindow(start, windowStart, windowEnd)) return;
  out.push(toEventSummary(vevent, start, timeZone));
}

async function main() {
  const config = loadConfig();
  const timeZone = config.timezone || "Europe/Warsaw";
  const daysAhead = config.daysAhead ?? 7;
  const excludeTitles = new Set(
    (config.excludeTitles || []).map((t) => t.toLowerCase())
  );

  const { windowStart, windowEnd } = getWindowBounds(timeZone, daysAhead);

  const res = await fetch(config.icalUrl);
  if (!res.ok) {
    throw new Error(`Nie udało się pobrać iCal: ${res.status} ${res.statusText}`);
  }
  const icsText = await res.text();
  const parsed = ical.sync.parseICS(icsText);

  const raw = [];
  for (const item of Object.values(parsed)) {
    if (item.type !== "VEVENT") continue;
    collectEvents(item, windowStart, windowEnd, timeZone, raw);
  }

  const seen = new Set();
  const events = raw
    .filter((ev) => {
      if (excludeTitles.has(ev.title.toLowerCase())) return false;
      const key = dedupeKey(ev);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start));

  const outDir = join(root, "docs");
  mkdirSync(outDir, { recursive: true });

  const payload = {
    generatedAt: new Date().toISOString(),
    timezone: timeZone,
    daysAhead,
    windowStart: windowStart.toISOString(),
    windowEnd: windowEnd.toISOString(),
    title: config.title || "Wydarzenia",
    dayLayout: config.dayLayout === "columns" ? "columns" : "rows",
    events,
  };

  writeFileSync(join(outDir, "events.json"), JSON.stringify(payload, null, 2), "utf8");
  console.log(
    `Zapisano ${events.length} wydarzeń (${windowStart.toISOString()} → ${windowEnd.toISOString()}) → docs/events.json`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

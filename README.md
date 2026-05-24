# cal-2-web — Kościół Charisma

Strona z wydarzeniami z kalendarza Google (**7 dni od jutra**), pod duży ekran (WorshipTools Presenter).

**Adres po publikacji:** `https://TWOJ_USER.github.io/cal-2-web/`

## Publikacja na GitHub (jednorazowo)

```powershell
cd d:\GitHub\cal-2-web
git init
git add .
git commit -m "feat: strona wydarzeń z kalendarza Google"
git branch -M main
git remote add origin https://github.com/TWOJ_USER/cal-2-web.git
git push -u origin main
```

Następnie na GitHubie:

1. **Settings → Pages** → Source: **Deploy from a branch** → branch `main`, folder **`/docs`**
2. **Actions** → workflow „Odśwież wydarzenia” → **Run workflow** (lub poczekaj na push)

Kalendarz jest już skonfigurowany w `config.json`.

## Lokalnie

```powershell
npm install
npm run fetch    # pobiera wydarzenia → docs/events.json
```

Podgląd: otwórz `docs/index.html` w przeglądarce (najlepiej przez prosty serwer, np. `npx serve docs`).

## WorshipTools Presenter

Dodaj źródło **Web / URL** i wklej adres GitHub Pages.

Strona odświeża dane co 5 minut; synchronizacja z Google — co 3 h (GitHub Actions).

## Dostosowanie wyglądu

Edytuj `docs/style.css` — zmienne `--title-size`, `--event-title-size`, kolory itd.

## Konfiguracja (`config.json`)

| Pole | Opis |
|------|------|
| `icalUrl` | Link iCal z Google Calendar |
| `timezone` | `Europe/Warsaw` |
| `daysAhead`  | `7` — liczba dni od jutra |
| `title` | Nagłówek strony |
| `excludeTitles` | Wydarzenia do ukrycia, np. `["Nie ma spotkań"]` |

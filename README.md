# cal-2-web — Kościół Charisma

Strona z wydarzeniami z kalendarza Google (**7 dni od jutra**), pod duży ekran (WorshipTools Presenter).

**Adres strony:** https://robywas.github.io/ogloszeniaCharisma/

## Publikacja na GitHub (jednorazowo)

```powershell
cd d:\GitHub\cal-2-web
git init
git add .
git commit -m "feat: strona wydarzeń z kalendarza Google"
git branch -M main
git remote add origin git@github.com:robywas/ogloszeniaCharisma.git
git push -u origin main
```

Następnie na GitHubie:

1. **Settings → Pages** → Source: **Deploy from a branch** → branch `main`, folder **`/docs`**
2. Uruchom odświeżanie kalendarza — patrz sekcja **„Jak uruchomić workflow”** poniżej

Kalendarz jest już skonfigurowany w `config.json`.

## Jak uruchomić workflow „Odśwież wydarzenia”

To **nie** jest w Settings → Actions (tam są tylko General / Runners / OIDC).

1. Otwórz zakładkę **Actions** u góry repozytorium (obok Pull requests)
2. Po lewej wybierz **Odśwież wydarzenia**  
   — albo bezpośredni link:  
   https://github.com/robywas/ogloszeniaCharisma/actions/workflows/update-calendar.yml
3. Kliknij **Run workflow** → **Run workflow**

Jeśli zakładki Actions w ogóle nie ma: **Settings → Actions → General** → włącz **Allow all actions and reusable workflows**.

## Lokalnie

```powershell
npm install
npm run fetch    # pobiera wydarzenia → docs/events.json
npm run qr       # generuje docs/assets/qr.png (z logo w środku, jeśli jest logo.png)
```

## Logotyp i kod QR

1. Wgraj logotyp jako **`docs/assets/logo.png`** (PNG, przezroczyste tło, ok. 400×400 px)
2. Uruchom **`npm run qr`** — tworzy `docs/assets/qr.png` z logo w środku kodu
3. Wypchnij na GitHub (`docs/assets/`)

QR kieruje na adres z `siteUrl` w `config.json`. Logo i QR wyświetlają się na dole strony.

Podgląd: otwórz `docs/index.html` w przeglądarce (najlepiej przez prosty serwer, np. `npx serve docs`).

## WorshipTools Presenter

Dodaj źródło **Web / URL** i wklej adres: https://robywas.github.io/ogloszeniaCharisma/

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
| `siteUrl` | Adres strony (QR kod) |
| `logoPath` | Ścieżka do logo w `docs/` (domyślnie `assets/logo.png`) |
| `excludeTitles` | Wydarzenia do ukrycia, np. `["Nie ma spotkań"]` |
| `dayLayout` | `rows` — dni obok siebie (wt\|śr); `columns` — najpierw lewa kolumna, potem prawa |

**Okno dat:** od **jutra 00:00** przez **7 kolejnych dni** (strefa `timezone`). Wydarzenia cykliczne (RRULE) są rozwijane automatycznie.

**Uwaga:** Publiczny iCal Google zwykle zawiera tylko najbliższe wystąpienia; jeśli brakuje serii, sprawdź w kalendarzu czy wydarzenie jest cykliczne i publiczne.

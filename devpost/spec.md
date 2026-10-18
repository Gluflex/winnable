---
doc: spec
status: approved
---
<!-- Planning answers delegated by Leandro to the agent on 14.10.2026; approved under that delegation. -->

# Winnable — Technical Spec

## How This Works, In Plain Language
Winnable has two halves. A **collector** runs once a day on GitHub's servers: it asks Devpost for every open and upcoming hackathon, reads each hackathon's page for its eligibility list, deadline and prizes, looks at a few hundred finished hackathons to learn how many registrants really submit, fetches today's currency rates, and writes everything into one data file. The **board** is a plain web page that loads that file, asks the builder four questions, and does all ranking and checking in their browser. Nothing about the builder is stored anywhere but their own browser.

Why this shape: Devpost does not let a web page call its API directly (no cross-origin permission), and reading 180 hackathon pages on every visit would be slow and unfriendly to Devpost. Doing it once a day and publishing a static file is fast, free, and gentle.

## The Core Journey Through the System
PRD ref: `prd.md > The Core Journey`.
1. Builder opens the page → the browser loads `data/hackathons.json` (one file, written by the collector) and the profile from `localStorage`.
2. Builder fills About you → the profile is saved to `localStorage` → `rank.js` recomputes eligibility and odds for every hackathon → the board re-renders.
3. Builder types a GitHub username → `github.js` calls `api.github.com/users/<name>/repos` once → repo languages, topics and descriptions are matched against each hackathon's themes → match markers appear.
4. Builder opens a row → the detail view renders from the same in-memory record, including the arithmetic.
5. Builder adds to calendar → `ics.js` builds an .ics file in the browser and downloads it.
6. Next day the collector runs again → new hackathons get a `first_seen` date → returning builders see "new" markers for anything first seen after their last visit.

## Stack
- **Board**: plain HTML, CSS and JavaScript modules, no build step, no framework. Rationale: a single page with one data file needs nothing more, loads instantly and is easy to read in a public repo.
- **Fonts**: Bricolage Grotesque (words) and JetBrains Mono (figures) from Google Fonts (https://fonts.google.com).
- **Collector**: Python 3.12, standard library only, with `curl` for HTTP (Devpost answers Python's own HTTP client with 403; curl with a browser user agent works, verified 14.10.2026).
- **Schedule and hosting**: a GitHub Actions workflow (https://docs.github.com/actions) runs the collector daily and commits the data; GitHub Pages (https://docs.github.com/pages) serves the site from the repository. Free for public repositories.
- Unverified: whether GitHub Actions runners are also accepted by Devpost with curl. Checked early in the build; fallback: run the collector locally and commit.

## Where It Runs and How Someone Tries It
- Runtime: any modern browser. The collector needs Python 3.12 and curl.
- Local: `python collector/collect.py` then `python -m http.server 8080` in the repository root, open http://localhost:8080/.
- Demo recording: the local server or the GitHub Pages URL.
- Deployment: GitHub Pages from the `main` branch root after the repository is made public; the daily workflow keeps data fresh.
- Submission needs the demo video (under 3 minutes, YouTube or Vimeo) and the public repository with an open source licence (MIT).

## Look and Feel
From `prd.md > Look and Feel`. Lane: a Swiss railway departure poster (the yellow SBB timetable) for prize money; deadlines are departures. Board: signal yellow `#ffd200` with pure black `#000000` text; detail panel and sheets on white `#ffffff`; red `#d0021b` only for "closes within 48 hours"; ineligible rows in grey `#6e6a5e`. Dark mode: black board with yellow text (station display at night), panels `#1c1b17`. One family, Schibsted Grotesk (Google Fonts), weights 400 to 900, tabular figures for every number; no monospace. Odds are the largest type on each row (about 34 px, 64 px in the detail). Thin timetable rules between rows (1 px black at 25 %), right-aligned figures, 24-hour local times, sentence-case column headings, radius 8 px on controls only, no shadows, no gradients, no emoji. One orchestrated motion: rows re-sort with a FLIP animation when the profile changes; reduced motion turns it off. Short, dry copy.

## Components

### Collector (`collector/collect.py`)
Fetches open and upcoming hackathons from the Devpost API, then each hackathon's overview page; parses eligibility, deadline and prizes; computes the calibration from finished hackathons; fetches currency rates; writes `data/hackathons.json` and updates `data/seen.json`.
PRD ref: `prd.md > Odds and expected cash`, `prd.md > Eligibility checks`.

### Calibration (inside the collector)
Samples recently ended hackathons from the Devpost API, counts their gallery projects (24 per page, last page counted), and fits `submissions = a * registrants^b` by least squares on logarithms, keeping the points for the chart.
PRD ref: `prd.md > Odds and expected cash`, `prd.md > Screens and Layout` (How the odds work).

### Ranking (`site/js/rank.js`)
Pure functions: eligibility per profile (with reasons), expected submissions, odds, expected cash per entry in USD, sort order.
PRD ref: `prd.md > The board`, `prd.md > Odds and expected cash`.

### GitHub match (`site/js/github.js`)
Fetches public repos for a username (unauthenticated, 60 calls per hour per visitor IP), builds a keyword set, maps it to Devpost themes with a fixed dictionary, caches the result in `localStorage` for a day.
PRD ref: `prd.md > GitHub match`.

### Calendar (`site/js/ics.js`)
Builds RFC 5545 events with UTC times, folded lines and a two-day reminder.
PRD ref: `prd.md > Calendar`.

### Board UI (`site/js/app.js`, `site/index.html`, `site/css/style.css`)
Renders header, summary, filters, rows, Not for you section, detail view, About you panel and the How the odds work sheet (inline SVG chart).
PRD ref: `prd.md > Screens and Layout`, `prd.md > States and Boundaries`.

## Data Model
`data/hackathons.json`:
```
{
  "generated": "2026-10-14T18:00:00Z",
  "rates": {"USD": 1, "EUR": 1.08, ...},          // USD per unit
  "calibration": {"a": 0.9, "b": 0.85, "n": 180, "points": [[registrants, submissions], ...]},
  "hackathons": [{
    "id": 30447, "title": "...", "url": "...", "org": "...",
    "themes": ["Machine Learning/AI", ...],
    "location": "Online" | "Basel, Switzerland", "online": true,
    "registrants": 3491, "open_state": "open" | "upcoming",
    "starts": ISO | null, "deadline": ISO with offset,
    "eligibility": {"min_age": 18, "students_only": false, "invite_only": false,
                    "countries_excluded": ["Brazil", ...], "countries_only": [], "raw": ["Ages 18+ only", ...]},
    "prizes": [{"title": "First Place", "amount": 1250, "currency": "USD", "cash": true, "winners": 1}, ...],
    "first_seen": "2026-10-14"
  }]
}
```
`data/seen.json`: `{ "<id>": "first seen date" }`, kept between runs.
Browser `localStorage`: `winnable:profile` (country, adult, student, github, onlineOnly), `winnable:lastVisit`, `winnable:gh:<user>` (repos summary with fetch time).

## File Structure
```
winnable/
├── index.html              # redirects to site/ for GitHub Pages root
├── site/
│   ├── index.html          # the board
│   ├── css/style.css       # tokens (light and dark) and layout
│   └── js/
│       ├── app.js          # rendering and interaction
│       ├── rank.js         # eligibility, odds, expected cash, sorting
│       ├── github.js       # repo fetch and theme matching
│       ├── ics.js          # calendar export
│       └── countries.js    # country list for the About you picker
├── data/
│   ├── hackathons.json     # written by the collector
│   └── seen.json           # first-seen dates
├── collector/collect.py    # daily data refresh
├── tests/test_rank.mjs     # node tests for ranking and ics
├── .github/workflows/collect.yml
├── devpost/                # Devpost learning workspace
├── README.md
└── LICENSE                 # MIT
```

## External Services and Dependencies
- **Devpost hackathon API** `GET https://devpost.com/api/hackathons?status[]=open&status[]=upcoming&page=N` (40 per page): title, url, themes, registrations_count, prize_amount, displayed_location, invite_only, open_state, submission_gallery_url. `status[]=ended&order_by=recently-added` for calibration. No key, undocumented, no published rate limit: the collector waits 0.5 s between page requests.
- **Devpost hackathon pages** `GET https://<slug>.devpost.com/`: `#eligibility-list li` (age, students, countries in the tooltip `title`), `[data-iso-date]` deadline, `.prize` blocks (`.prize-value` amount and "in cash", `.prize-winners` count). Gallery `?page=N` for counting projects.
- **Currency rates** `GET https://api.frankfurter.app/latest?from=USD`: ECB reference rates, no key.
- **GitHub REST** `GET https://api.github.com/users/<user>/repos?per_page=100&sort=pushed`: CORS open, 60 unauthenticated requests per hour per IP.
- **Hosting**: GitHub Pages and Actions, free for public repositories.

## Important Failure Modes
- **Devpost changes its page markup** → the collector keeps the API fields, marks the hackathon "details unavailable", and the board shows it without odds at the bottom.
- **A hackathon has no cash prizes** → expected cash 0, odds "no cash prize", ranked at the end of the eligible list.
- **GitHub lookup fails or is rate-limited** → a short message in the About you panel; ranking unaffected.
- **Calibration sample too small (under 30 points)** → fall back to a fixed submission rate of 0.3, labelled as a default.

## What Was Simplified and Why
- **Equal chance per entry** instead of a skill model: no data on individual skill exists; the label says "for an average entry".
- **One calibration curve for all hackathons** instead of per category: enough points for one robust fit; categories would split the sample.
- **Theme dictionary** instead of a language model for GitHub matching: explainable, instant, free.
- **Registrants as of today** instead of a projected final count: projecting needs history the POC does not have; shown as "registrations still open".

## Decisions and Open Issues
- All choices above were made by the agent under Leandro's delegation (14.10.2026); none are attributed to him.
- Genuine uncertainty investigated during planning: whether submission rates are stable enough to predict. Evidence so far: five finished hackathons gave rates of 0.24 to 0.53 (14.10.2026). The build fits the model on a larger sample and shows the scatter, so the spread is visible rather than hidden.
- Resolved 18.10.2026: GitHub's runners can fetch Devpost pages with curl. The first manual run of the daily workflow collected every open hackathon, passed the ranking tests and committed fresh data (Actions run 39152070171).

---
doc: prd
status: approved
---
<!-- Planning answers delegated by Leandro to the agent on 14.10.2026; approved under that delegation. -->

# Winnable — Product Requirements

A web board for student builders that ranks every open Devpost hackathon by their realistic chance of winning cash and checks whether they may enter at all.
Source: `scope.md > The Unique Kernel`, `scope.md > Who It's For`.

## The Core Journey
1. The builder opens Winnable. The board already shows today's open hackathons with odds for a generic entrant, and a one-line promise: "Ranked by your odds, not the prize."
2. A short "About you" panel asks four things: country of residence, 18 or older, currently a student, and optionally a GitHub username. Answers save as they are typed; nothing is sent anywhere except the GitHub lookup.
3. The board re-ranks live. Hackathons the builder cannot enter move into a collapsed "Not for you" section, each with its reason. The rest are ordered by expected cash per entry.
4. Each row shows the odds ("1 in 6"), expected cash for one entry, total cash, deadline countdown and a match marker if the builder's GitHub repos fit the themes.
5. The builder opens a row. The detail view explains the odds in one sentence and a small calculation (registrants, expected submissions, cash winners), lists the prizes with cash and non-cash separated, shows each eligibility check with a tick or a reason, and offers "Add to calendar" and "Open on Devpost".
6. The builder adds deadlines to their calendar, singly or "top 5 at once", and leaves.
7. On the next visit, rows that appeared since then carry a "new" marker, and a "Closing this week" filter shows what is urgent.

## Screens and Layout
One page, three layers:
- **Board** (main view): header with name, data date and the About you summary; a summary line (open hackathons, how many you can enter, total cash you can enter for); filter chips (All, Closing this week, New, Matches your GitHub); the ranked rows; the collapsed "Not for you" section; a footer link to "How the odds work".
- **About you panel**: opens over the board on first visit and from the header summary later.
- **Detail view**: a side panel on desktop, a full-height sheet on phones.
- **How the odds work**: a sheet with the calibration chart (registrants against submissions for the finished hackathons used) and the formula in plain words.

## Look and Feel
Racing form meets field instrument (`scope.md > Inspiration & Identity`): warm paper background, near-black ink, one money-green accent, a muted red only for "not eligible". Big tabular numerals for the odds, a monospace face for every figure, a grotesque for words. Hairline rules between rows, no card shadows, no gradients, no emoji, no confetti. Dense like a race card but with generous row height so a phone works. Dark mode follows the system setting. Copy is short, plain and slightly dry ("1 in 4,212. Big prize, bigger crowd.").

## Features and Behavior

### The board
- Rows ranked by expected cash per entry, highest first; ties broken by nearer deadline.
- Each row: odds as "1 in N" (N rounded sensibly), expected cash per entry, total cash prize money, deadline as countdown ("3 days", "today 23:00" in local time), registrants, location marker for in-person events, "new" and "GitHub match" markers.
- The summary line updates with the profile.
- Filters combine with the ranking; empty filters say what to try instead.

- As a student builder in Switzerland, I want hackathons I cannot enter separated with the reason, so that I never read rules for something closed to me.
  - [ ] A hackathon excluding my country shows "Not open in Switzerland" and sits in "Not for you".
  - [ ] Changing my country re-ranks the board without reloading.
  - [ ] A students-only hackathon is eligible when I tick "student" and moves to "Not for you" when I untick it.

### Odds and expected cash
- Expected submissions come from the hackathon's registrants through a model fitted on finished Devpost hackathons.
- Odds of winning any cash prize: number of cash prize winners divided by expected submissions, shown as "1 in N"; never better than 1 in 1.
- Expected cash per entry: total cash for winners divided by expected submissions.
- Only prizes marked as cash count; credits, hardware, swag and "other" prizes are listed but excluded, so inflated prize pools do not mislead.
- Prizes in other currencies are converted to USD with that day's reference rates for ranking, and shown in their own currency.
- Hackathons still taking registrations carry the note "Registrations still open: odds will shrink".

- As a builder, I want to see why a hackathon ranks where it does, so that I trust the number.
  - [ ] The detail view shows registrants, expected submissions, cash winners and the resulting odds with the arithmetic.
  - [ ] "How the odds work" shows the calibration data and how many finished hackathons it uses.

### Eligibility checks
Checks against the profile, from each hackathon's structured "Who can participate" block: minimum age, countries excluded or the only countries allowed, students only, invite only, and in-person location (in-person events count as not for you while "Online only" is on, which is the default).

### GitHub match
With a username, the board fetches the builder's public repositories once, reads their languages, topics and descriptions, and marks hackathons whose themes fit, naming the matching repos in the detail view. A match never changes the odds.

### Calendar
"Add to calendar" downloads an .ics event at the deadline with a reminder two days before; "Top 5 to calendar" puts the five best eligible deadlines in one file.

## States and Boundaries
- **First visit**: the board shows generic odds behind the About you panel; closing the panel without answers keeps generic ranking and a reminder chip.
- **Returning visit**: profile and last-visit time are restored; new rows are marked.
- **No eligible hackathons**: a short message and the closest "Not for you" reasons.
- **GitHub user not found or rate-limited**: the field says so; everything else works.
- **Data older than two days**: the header shows the data date in the accent-free warning style.
- **Persistence**: profile and last visit live in the browser only. Nothing is stored server-side.

## Product Decisions
- Odds over prize size: the product exists because prize-sorted lists mislead (delegated decision, scope).
- One odds figure per hackathon, from all cash winners: readable at a glance; per-track odds would need the full rules text.
- Cash only: credits and swag inflate totals and cannot pay rent.
- Devpost only for the proof of concept: one clean, structured source; it is also where the judges live.
- Profile in the browser, no accounts: zero friction and no personal data to protect.
- Assumption, labelled: every entry has the same chance. Skill is not modelled; the odds are for an average entry.

## What We're Building
The board, About you panel, detail view, How the odds work sheet, eligibility checks, odds and expected cash, GitHub match, calendar export, new and closing-soon filters, light and dark mode, and the daily data refresh that feeds them.

## Deferred From the POC
- Saved favourites and notes: would need state beyond a profile.
- Email or push alerts: needs a backend and consent handling.
- Odds per prize track: needs parsing of free-text prize conditions.

## Possible Later Enhancements
Other money sources (EU project-run calls, bounties, grants); a skill multiplier learned from the builder's past results; team formation for team-only events; history of how odds moved as registrations grew.

## Non-Goals
- Not a hackathon listing clone: no descriptions copied beyond names, dates, themes and prize lines.
- No scraping behind logins and no automated registration or submission.
- No gambling framing: no streaks, no rewards, no "bet" language.

## Open Questions
- Typical growth of registrations before a deadline (to project final odds): can wait; the POC labels the uncertainty.

---
doc: checklist
status: approved
---
<!-- Approved under Leandro's delegation (14.10.2026). -->

# Build Checklist

Build mode: fast

## Slices

- [x] **1. Today's open Devpost hackathons appear on the board with deadline and cash prizes**
  Becomes usable: A local page lists every open and upcoming Devpost hackathon with its deadline, registrants and cash prize lines, from a data file the collector wrote.
  Why now: Proves the riskiest path first (fetching and parsing Devpost) and gives every later slice real data to render.
  PRD ref: `prd.md > The Core Journey` (step 1), `prd.md > Features and Behavior`
  Spec ref: `spec.md > Components` (Collector), `spec.md > Data Model`, `spec.md > File Structure`, `spec.md > External Services and Dependencies`
  Build: Scaffold the repository per the file structure; write the collector (API pages, overview page parsing for eligibility, deadline and prizes, currency rates, seen dates); write a minimal board that renders the rows.
  Verify (mechanical): Run the collector and confirm at least 100 hackathons with parsed deadlines and at least 80 % with prize lines; serve the site and confirm the rows render with no console errors.
  Learner check: Open the board and compare three rows with their Devpost pages.
  Commit: `Collect Devpost hackathons and list them`

- [ ] **2. Every hackathon carries calibrated odds and expected cash, and the board is ranked by them**
  Becomes usable: Rows show "1 in N" odds and expected cash per entry, ordered by expected cash.
  Why now: This is the unique kernel; everything else is presentation around it.
  PRD ref: `prd.md > Odds and expected cash`, `prd.md > The board`
  Spec ref: `spec.md > Components` (Calibration, Ranking)
  Build: Add the calibration from ended hackathons to the collector; write `rank.js` (expected submissions, odds, expected cash in USD, sort); render odds on rows; node tests for the maths.
  Verify (mechanical): Calibration uses at least 30 points; node tests pass; a hand-checked hackathon matches the formula.
  Learner check: Check that the biggest prize does not automatically rank first, and that the reason makes sense.
  Commit: `Calibrated odds and ranking`

- [ ] **3. Your profile decides what you can enter, with reasons**
  Becomes usable: The About you panel (country, 18+, student, online only) re-ranks the board live and moves ineligible hackathons to "Not for you" with their reason.
  Why now: Eligibility turns a ranked list into a personal one; it needs the ranking from slice 2.
  PRD ref: `prd.md > Eligibility checks`, `prd.md > States and Boundaries`
  Spec ref: `spec.md > Components` (Ranking, Board UI), `spec.md > Data Model` (localStorage)
  Build: About you panel, profile persistence, eligibility function with reasons, Not for you section, summary line.
  Verify (mechanical): Node tests for country exclusion, students only and age; toggling student moves a students-only hackathon between sections in the browser.
  Learner check: Set your real profile and confirm the Not for you reasons.
  Commit: `Profile-based eligibility`

- [ ] **4. Open a hackathon to see why it ranks where it does**
  Becomes usable: Detail view with the odds arithmetic, prizes split into cash and non-cash, eligibility ticks, themes; and the How the odds work sheet with the calibration chart.
  Why now: Trust in the number is what makes the board usable; needs slices 2 and 3.
  PRD ref: `prd.md > Screens and Layout`, `prd.md > Odds and expected cash`
  Spec ref: `spec.md > Components` (Board UI)
  Build: Detail panel and phone sheet, inline SVG calibration chart, methodology copy.
  Verify (mechanical): Detail values equal the row values for three hackathons; chart renders the calibration points; no console errors.
  Learner check: Open the top row and read the explanation aloud; does it convince you?
  Commit: `Detail view and odds explainer`

- [ ] **5. Your GitHub repos mark the hackathons that fit you**
  Becomes usable: Typing a GitHub username marks matching hackathons and names the matching repos in the detail view.
  Why now: Personal relevance on top of a working ranked board.
  PRD ref: `prd.md > GitHub match`
  Spec ref: `spec.md > Components` (GitHub match), `spec.md > External Services and Dependencies`
  Build: `github.js` fetch, cache, theme dictionary, markers and filter.
  Verify (mechanical): With username Gluflex, at least one hackathon shows a match; an unknown username shows a message and nothing breaks.
  Learner check: Enter your username and judge whether the matches are sensible.
  Commit: `GitHub theme matching`

- [ ] **6. Deadlines go into your calendar and new or urgent hackathons stand out**
  Becomes usable: Add to calendar per hackathon and Top 5 to calendar; New and Closing this week filters; new markers since the last visit.
  Why now: Turns the board into a weekly habit (the core loop).
  PRD ref: `prd.md > Calendar`, `prd.md > The Core Journey` (steps 6 and 7)
  Spec ref: `spec.md > Components` (Calendar, Board UI)
  Build: `ics.js`, buttons, filters, last-visit handling.
  Verify (mechanical): Node test parses the generated .ics (UTC times, folded lines); filters change the visible rows.
  Learner check: Import the Top 5 file into your calendar.
  Commit: `Calendar export and filters`

- [ ] **7. It refreshes itself every day and is ready to publish**
  Becomes usable: A GitHub Actions workflow runs the collector daily and commits fresh data; README, MIT licence, Pages entry point.
  Why now: Last, because it only packages what already works.
  PRD ref: `prd.md > What We're Building`
  Spec ref: `spec.md > Where It Runs and How Someone Tries It`, `spec.md > Stack`
  Build: Workflow file, root redirect, README with screenshots, LICENSE.
  Verify (mechanical): Workflow YAML validates; README commands work from a clean clone.
  Learner check: Read the README as a judge would.
  Commit: `Daily refresh and publishing setup`

## Hands-on Checkpoints

- [ ] Early usable behavior explored — after slice 3 (agent self-check with screenshots; Leandro's own look pending)
- [ ] Final kick-the-tires exploration and feedback completed

## Final Review

- [ ] Final review complete — feedback resolved and learner confirms ready to ship

## Code Tour and App Map

- [ ] Learning activity complete — guided route, focused alternative, prior practice connected, or brief recap
- [ ] Optional edit and transfer reflection addressed — offered/declined/already covered/not applicable as appropriate
- [ ] `devpost/app-map.html` generated from finished code, checked, and shown, including a project-grounded practice to reuse

Activity and evidence: not started
Route and stops: not started
Edit outcome: not started
Reflection: not started
Activity mode: not started

## Revisions

- Upcoming hackathons get their own "Opening soon" section without odds — 130 of 179 had not opened yet; their registrant counts are still tiny, so odds would have been misleadingly good, and their pages carry no deadline (the API's submission period text is used instead).
- Eligibility model widened (university vs high-school students, age ranges, team required, US only, member-only events kept as restrictions) — the real "Who can participate" lists contained eleven line types, not the four planned; treating unknown restrictions as blocking keeps "eligible" trustworthy.
- Collector runs four requests in parallel and saves hackathon data before calibrating — sequential calibration took 12 minutes per 20 data points because many finished hackathons have hidden galleries.

- Look and feel moved from "racing form on cream paper with a monospace for figures" to "Swiss departure poster, black on signal yellow, one grotesque" — the design review before slice 1's UI found the first direction matched three of the most common generated-design defaults (cream paper, hairline broadsheet, monospace data labels).

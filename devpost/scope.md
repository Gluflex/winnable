---
doc: scope
status: approved
---
<!-- Planning answers delegated by Leandro to the agent on 14.10.2026 ("do it anyway");
     approved under that delegation. -->

# Winnable

The open hackathons you can actually win, ranked by your real odds, not by the size of the prize.

## The Unique Kernel
Every open Devpost hackathon gets a calibrated chance of winning cash: how many people will really submit (learned from hundreds of finished hackathons: registrations against projects in the gallery), how many cash prizes there are, and whether you are even eligible (age, country, students only), checked against you with the reason shown. A USD 138,000 hackathon with 55,000 registrants becomes "1 in 4,000"; a USD 500 one with 46 registrants becomes "1 in 4". Lists sorted by prize hide exactly this.

## Who It's For
A student builder who ships side projects fast with AI agents and wants prize money in the 500 to 2,000 range: an ETH student on exchange in Delft, a dozen repos on GitHub, ten free evenings a month. Today they scroll 180 open hackathons on Devpost sorted by prize or deadline, open the big-money ones, and only find out in the rules that they are excluded, that the field is enormous, or that most of the "prize pool" is credits.

## The Core Loop
They open Winnable, their profile (country, age, student, optional GitHub user) is remembered, and the board shows every open hackathon ranked by expected cash for one entry. They glance at what is new since last time and what closes this week, open one to see the odds and eligibility reasons, add its deadline to their calendar, and go build. They come back weekly because new hackathons appear daily and the board does the rules-reading for them.

## Inspiration & Identity
A racing form or a bookmaker's odds board crossed with a field instrument: numbers first, tabular figures, dense but calm, one money-green accent, hairlines instead of cards with shadows. Confident and a little cheeky ("1 in 4"), never casino-like: no confetti, no gold. References: the Racing Post race card, Bloomberg terminal density, FiveThirtyEight odds displays.

## Why This Matters to the Learner
"So much money lying around and I could build such a simple solution for them" (Leandro, 14.10.2026). He wants a repeatable way to find money he can win, not a one-off.

## What "Working" Looks Like
A live web page with today's open Devpost hackathons. On first visit it asks four things (country, 18 or older, student, optional GitHub username). The board then re-orders: ineligible hackathons drop to a greyed section with their reason ("Students only", "Not open in Switzerland"), and the top rows show odds like "1 in 6" and an expected cash value per entry. The "oh, that's cool" beat: the biggest prize on Devpost sinks to the bottom of the ranking while a small one jumps to the top, and the odds line explains why in one sentence. One click puts the deadline in the calendar.

## The POC Boundary
- Devpost open and upcoming hackathons, refreshed daily by a scheduled script.
- Cash prizes parsed per prize and per winner (credits and swag excluded from the odds).
- Submission-rate model calibrated on recently ended Devpost hackathons.
- Eligibility check against the profile: minimum age, country exclusions, students only, invite only, in-person location.
- Ranked board, hackathon detail, calendar export (.ics), new-since-last-visit marker.
- Optional GitHub username: shows which open hackathons match the builder's languages and topics.
- Static site, profile stored only in the browser.

## Later
Other money sources (EU project-run calls, bounties, grants), alerts by email, team formation, odds by track or prize category, a personal skill multiplier from past wins.

## Explicitly Cut
- Accounts and a backend database: the profile fits in the browser, and no personal data leaves the device.
- Reading the full rules text with a language model: the structured eligibility block is reliable and free; the rest would add cost and uncertain parsing.
- Prize categories with conditions (best use of X, regional awards) modelled separately: one odds figure per hackathon keeps the board readable; categories are listed in the detail view.

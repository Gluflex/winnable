// node tests/test_rank.mjs
import assert from 'node:assert/strict';
import { expectedSubmissions, odds, ineligibility, rankAll, projectedRegistrants, openCount, bestOdds } from '../site/js/rank.js';

const calib = { a: 1, b: 0.9, n: 200 };
const rates = { USD: 1, EUR: 1.1 };
const now = new Date('2026-10-14T12:00:00Z');

// Calibration: power law, clamped to [1, registrants]
assert.equal(Math.round(expectedSubmissions(1000, calib)), Math.round(1000 ** 0.9));
assert.equal(expectedSubmissions(0, calib), 1);
assert.equal(expectedSubmissions(100, { a: 2, b: 1, n: 200 }), 100, 'never more submissions than registrants');
assert.equal(expectedSubmissions(100, { a: 1, b: 1, n: 5 }), 30, 'small calibration falls back to 30 %');

// Odds: only cash counts, winners multiply, currencies convert
const h = {
  registrants: 100, online: true, deadline: '2026-10-20T12:00:00Z',
  prizes: [
    { amount: 1000, currency: 'USD', cash: true, winners: 1 },
    { amount: 100, currency: 'EUR', cash: true, winners: 2 },
    { amount: 5000, currency: 'USD', cash: false, winners: 1 }, // credits: ignored
  ],
};
const o = odds(h, { a: 0.3, b: 1, n: 200 }, rates); // 30 expected submissions
assert.equal(o.slots, 3);
assert.equal(Math.round(o.totalCash), 1220);
assert.equal(o.oneIn, 10);
assert.equal(Math.round(o.ev), Math.round(1220 / 30));

// Participation prizes are not wins
const withParticipation = { registrants: 100, prizes: [
  { title: 'First Place', amount: 1000, currency: 'USD', cash: true, winners: 1 },
  { title: 'Participation', amount: 45, currency: 'USD', cash: true, winners: 300 },
  { title: 'Everyone who submits', amount: 5, currency: 'USD', cash: true, winners: 1 },
] };
const op = odds(withParticipation, { a: 0.3, b: 1, n: 200 }, rates);
assert.equal(op.slots, 1);
assert.equal(op.totalCash, 1000);

// Free-text amounts count once, winners still count as chances
const freeText = { registrants: 100, prizes: [{ amount: 2000, currency: 'USD', cash: true, inferred: true, winners: 20 }] };
assert.equal(odds(freeText, { a: 0.3, b: 1, n: 200 }, rates).totalCash, 2000);
assert.equal(odds(freeText, { a: 0.3, b: 1, n: 200 }, rates).slots, 20);

// Projection: a hackathon a fifth of the way through counts five times today's field;
// one that opened today counts at most 1 / 0.15 times
const run = { registrants: 100, starts: '2026-10-01T00:00:00Z', deadline: '2026-11-20T00:00:00Z' };
assert.equal(Math.round(projectedRegistrants(run, new Date('2026-10-11T00:00:00Z'))), 500);
assert.equal(Math.round(projectedRegistrants({ ...run, starts: '2026-10-14T00:00:00Z' }, now)), 667);
assert.equal(projectedRegistrants({ registrants: 100 }, now), 100, 'no dates: no projection');

// No cash prize: no odds, zero value
assert.equal(odds({ registrants: 50, prizes: [] }, calib, rates).oneIn, null);

// Eligibility with reasons
const base = { online: true, eligibility: { min_age: 18, students: 'university', countries_excluded: ['Brazil', 'Quebec'] } };
assert.deepEqual(ineligibility(base, { country: 'Switzerland', adult: true, student: 'university' }, now), []);
assert.deepEqual(ineligibility(base, { country: 'Brazil', adult: true, student: 'university' }, now), ['Not open in Brazil']);
assert.deepEqual(ineligibility(base, { student: 'no', adult: true }, now), ['Students only']);
assert.deepEqual(ineligibility(base, { student: true, adult: true }, now), [], 'old boolean profiles still work');
assert.deepEqual(ineligibility(base, { adult: false, student: 'university' }, now), ['18+ only']);
assert.deepEqual(ineligibility(base, { adult: true, student: 'high school' }, now), ['College students only']);
const teens = { online: true, eligibility: { min_age: 13, max_age: 18, students: 'high school' } };
assert.deepEqual(ineligibility(teens, { adult: true, student: 'university' }, now), ['Ages 13 to 18 only', 'High school students only']);
assert.deepEqual(ineligibility({ online: true, eligibility: { team_min: 2 } }, { team: false }, now), ['Team of 2 or more required']);
assert.deepEqual(ineligibility({ online: true, eligibility: { team_min: 2 } }, { team: true }, now), []);
assert.deepEqual(ineligibility({ online: true, eligibility: { restricted: ['SMU BIA members'] } }, {}, now), ['SMU BIA members']);
assert.deepEqual(ineligibility({ online: false, location: 'Basel, Switzerland' }, {}, now), ['In person: Basel, Switzerland']);
assert.deepEqual(ineligibility({ online: false, location: 'Block 45, Sharda University, ' }, {}, now), ['In person: Block 45, Sharda University'], 'organiser-typed trailing commas are trimmed');
assert.deepEqual(ineligibility({ online: false, location: 'Basel' }, { onlineOnly: false }, now), []);
assert.deepEqual(ineligibility({ online: false, location: 'Online, from anywhere' }, {}, now), [], 'online variants count as online');
assert.deepEqual(ineligibility({ online: false, location: 'Meadowlands Exposition Center + Online' }, {}, now), [], 'hybrid events can be entered online');
const longNames = { online: true, eligibility: { countries_excluded: ['Iran Islamic Republic of', "Korea Democratic People's Republic of", 'Syrian Arab Republic'] } };
assert.deepEqual(ineligibility(longNames, { country: 'Iran' }, now), ['Not open in Iran']);
assert.deepEqual(ineligibility(longNames, { country: 'North Korea' }, now), ['Not open in North Korea']);
assert.deepEqual(ineligibility(longNames, { country: 'South Korea' }, now), []);
assert.deepEqual(ineligibility(longNames, { country: 'Syria' }, now), ['Not open in Syria']);
assert.deepEqual(ineligibility({ online: true, eligibility: { min_age: 18 } }, { adult: null }, now), [], 'unanswered age never blocks');
assert.deepEqual(ineligibility({ online: true, eligibility: { countries_only: ['United States'] } }, { country: 'Netherlands' }, now),
  ['Only United States']);

// Ranking: eligible by expected cash, blocked separate, long-closed dropped
const data = {
  calibration: { a: 0.3, b: 1, n: 200 }, rates,
  hackathons: [
    { id: 1, registrants: 10000, online: true, deadline: '2026-11-01T00:00:00Z', prizes: [{ amount: 100000, currency: 'USD', cash: true, winners: 1 }] },
    { id: 2, registrants: 40, online: true, deadline: '2026-10-20T00:00:00Z', prizes: [{ amount: 1000, currency: 'USD', cash: true, winners: 1 }] },
    { id: 3, registrants: 40, online: false, location: 'Paris', deadline: '2026-10-20T00:00:00Z', prizes: [] },
    { id: 4, registrants: 40, online: true, deadline: '2026-10-01T00:00:00Z', prizes: [] },
  ],
};
data.hackathons.push({ id: 5, registrants: 12, online: true, open_state: 'upcoming', starts: '2026-11-01T00:00:00Z', deadline: '2026-11-20T23:59:00Z', prizes: [{ amount: 5000, currency: 'USD', cash: true, winners: 1 }] });
const r = rankAll(data, { onlineOnly: true }, now);
assert.deepEqual(r.eligible.map((x) => x.h.id), [2, 1], 'small field beats big prize');
assert.deepEqual(rankAll(data, { onlineOnly: true }, now, 'deadline').eligible.map((x) => x.h.id), [2, 1]);
assert.deepEqual(rankAll(data, { onlineOnly: true }, now, 'ev').eligible.map((x) => x.h.id), [2, 1]);
assert.deepEqual(r.upcoming.map((x) => x.h.id), [5], 'not-yet-open hackathons are never ranked by odds');
// Just opened (under 20 % of the period): no odds yet
const fresh = { id: 6, registrants: 3, online: true, open_state: 'open', starts: '2026-10-14T00:00:00Z', deadline: '2026-11-14T00:00:00Z', prizes: [{ amount: 500, currency: 'USD', cash: true, winners: 1 }] };
const r2 = rankAll({ ...data, hackathons: [fresh, ...data.hackathons] }, { onlineOnly: true }, now);
assert.ok(r2.upcoming.some((x) => x.h.id === 6) && !r2.eligible.some((x) => x.h.id === 6), 'freshly opened hackathons wait for their field');
// Under 24 hours left: last, whatever the odds
const closing = { id: 7, registrants: 10, online: true, starts: '2026-09-01T00:00:00Z', deadline: '2026-10-14T20:00:00Z', prizes: [{ amount: 5000, currency: 'USD', cash: true, winners: 3 }] };
const r3 = rankAll({ ...data, hackathons: [closing, ...data.hackathons] }, { onlineOnly: true }, now);
assert.equal(r3.eligible.at(-1).h.id, 7);
assert.deepEqual(r.blocked.map((x) => x.h.id), [3]);
// Open now counts what Devpost calls open: started, not closed, whether ranked, just opened or blocked
assert.equal(openCount(r2, now), r2.eligible.length + r2.blocked.filter((x) => x.h.open_state !== 'upcoming').length + 1, 'the just-opened hackathon counts as open');
assert.ok(!r.upcoming.some((x) => openCount({ eligible: [], upcoming: [x], blocked: [] }, now)), 'not-yet-open hackathons do not count');

// The headline's best odds do not depend on the chosen sort
const byCash = rankAll(data, { onlineOnly: true }, now, 'ev');
assert.equal(bestOdds(byCash)?.oneIn, Math.min(...byCash.eligible.filter((x) => x.oneIn && x.days >= 1).map((x) => x.oneIn)));
assert.equal(bestOdds({ eligible: [] }), undefined);
console.log('rank tests: all passed');

// Winnable ranking: eligibility against a profile, expected submissions from the
// calibration, odds of winning any cash prize, and expected cash for one entry.
// Pure functions only, so tests can run them in Node.

const FALLBACK_RATE = 0.3; // used when the calibration has fewer than 30 points

// How many of today's registrants will actually submit (calibrated power law)
export function expectedSubmissions(registrants, calib) {
  const reg = Math.max(0, registrants || 0);
  if (reg === 0) return 1;
  const est = calib && calib.n >= 30 ? calib.a * Math.pow(reg, calib.b) : reg * FALLBACK_RATE;
  return Math.max(1, Math.min(reg, est));
}

// A prize every participant gets is not a win: "Participation", "every participant", or 50+ winners
export const isParticipation = (p) => /particip|everyone|every (?:team|submission)|all (?:teams|participants|submissions)/i.test(p.title || '') || (p.winners || 1) >= 50;

// Cash prizes converted to USD with the day's rates (USD per unit of currency)
export function cashPrizes(h, rates) {
  return (h.prizes || [])
    .filter((p) => p.cash && p.amount > 0 && !isParticipation(p))
    .map((p) => {
      const rate = rates?.[p.currency] ?? (p.currency === 'USD' ? 1 : null);
      return { ...p, usd: rate == null ? null : p.amount * rate };
    });
}

// Registrations keep coming until the deadline. Project the final field linearly from
// the share of the submission period already elapsed (at least 15 %, so a hackathon
// that opened today counts its field as at most 6.7 times today's).
export function projectedRegistrants(h, now = new Date()) {
  const reg = h.registrants || 0;
  if (!h.starts || !h.deadline) return reg;
  const start = new Date(h.starts), end = new Date(h.deadline);
  if (!(end > start)) return reg;
  const f = Math.min(1, Math.max(0.15, (now - start) / (end - start)));
  return reg / f;
}

export function odds(h, calib, rates, now = new Date()) {
  const cash = cashPrizes(h, rates).filter((p) => p.usd != null);
  const slots = cash.reduce((s, p) => s + (p.winners || 1), 0);
  // Amounts read from free prize text count once: "$2,000 and $100 each to 20 people" must not become 20 x $2,000
  const totalCash = cash.reduce((s, p) => s + p.usd * (p.inferred ? 1 : p.winners || 1), 0);
  const projected = projectedRegistrants(h, now);
  const subs = expectedSubmissions(projected, calib);
  const pAny = slots ? Math.min(1, slots / subs) : 0;
  return {
    projected,
    subs,
    slots,
    totalCash,
    pAny,
    oneIn: pAny ? Math.max(1, Math.round(1 / pAny)) : null,
    ev: slots ? totalCash / Math.max(subs, slots) : 0,
  };
}

const norm = (s) => String(s || '').trim().toLowerCase();

// The profile's student status: 'no' | 'university' | 'high school' (older profiles stored a boolean)
export function studentLevel(p) {
  if (p.student === true) return 'university';
  if (p.student === false) return 'no';
  return p.student || null;
}

// Reasons this profile cannot enter; empty array = eligible
export function ineligibility(h, profile, now = new Date()) {
  const p = profile || {};
  const e = h.eligibility || {};
  const out = [];
  const level = studentLevel(p);
  if (h.deadline && new Date(h.deadline) < now) out.push('Closed');
  if (h.invite_only) out.push('Invite only');
  if (!h.online && p.onlineOnly !== false) out.push(`In person: ${h.location}`);
  if (e.min_age >= 18 && p.adult === false) out.push(`${e.min_age}+ only`);
  if (e.max_age != null && e.max_age <= 19 && p.adult === true) out.push(`Ages ${e.min_age ?? 13} to ${e.max_age} only`);
  if (e.students_only && level === 'no') out.push('Students only');
  if (e.students === 'university' && level && level !== 'university') out.push(level === 'no' ? 'Students only' : 'College students only');
  if (e.students === 'high school' && level && level !== 'high school') out.push('High school students only');
  if (e.professionals_only && level === 'high school') out.push('Professionals or graduates only');
  if (e.team_min && p.team === false) out.push(`Team of ${e.team_min} or more required`);
  for (const r of e.restricted || []) out.push(r);
  if (p.country) {
    const c = norm(p.country);
    if ((e.countries_excluded || []).some((x) => norm(x) === c)) out.push(`Not open in ${p.country}`);
    if ((e.countries_only || []).length && !e.countries_only.some((x) => norm(x).includes(c))) {
      out.push(`Only ${e.countries_only.join(', ')}`);
    }
  }
  return out;
}

export function daysLeft(h, now = new Date()) {
  return h.deadline ? (new Date(h.deadline) - now) / 864e5 : null;
}

// Not open yet: registrations are still small, so odds would be misleadingly good
export const isUpcoming = (h, now = new Date()) => h.open_state === 'upcoming' || (h.starts && new Date(h.starts) > now);

// Everything the board needs: open and eligible by expected cash, then by deadline;
// upcoming ones by start date, without odds; blocked ones with their reasons
// Sort orders the board offers. Best odds first; ties go to the bigger expected cash.
export const SORTS = {
  odds: (a, b) => (a.oneIn ?? 1e12) - (b.oneIn ?? 1e12) || b.ev - a.ev,
  ev: (a, b) => b.ev - a.ev || (a.days ?? 1e9) - (b.days ?? 1e9),
  deadline: (a, b) => (a.days ?? 1e9) - (b.days ?? 1e9),
};

export function rankAll(data, profile, now = new Date(), sort = 'odds') {
  const rows = data.hackathons.map((h) => {
    const o = odds(h, data.calibration, data.rates, now);
    return { h, ...o, reasons: ineligibility(h, profile, now), days: daysLeft(h, now), upcoming: isUpcoming(h, now) };
  }).filter((r) => r.days == null || r.days > -1);
  const by = SORTS[sort] || SORTS.odds;
  const byStart = (a, b) => new Date(a.h.starts || a.h.deadline || 0) - new Date(b.h.starts || b.h.deadline || 0);
  return {
    eligible: rows.filter((r) => !r.reasons.length && !r.upcoming).sort(by),
    upcoming: rows.filter((r) => !r.reasons.length && r.upcoming).sort(byStart),
    blocked: rows.filter((r) => r.reasons.length).sort(SORTS.ev),
  };
}

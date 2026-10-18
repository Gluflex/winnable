// Winnable board: loads the daily data file, ranks it for the builder's profile,
// and renders the timetable, the detail receipt and the about-you panel.
import { rankAll, cashPrizes, daysLeft, odds as oddsOf, ineligibility, studentLevel, isParticipation, place } from './rank.js';
import { fetchRepos, themeIndex, matchFor } from './github.js';
import { buildIcs, download } from './ics.js';
import { COUNTRIES } from './countries.js';
import { calibrationChart } from './chart.js';

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const int = (v) => Math.round(v).toLocaleString('en-US');
const usd = (v) => (v == null ? 'n/a' : v >= 10 ? `$${int(v)}` : v >= 1 ? `$${v.toFixed(2)}` : v > 0 ? `${Math.max(1, Math.round(v * 100))}¢` : '$0');
const PKEY = 'winnable:profile', VKEY = 'winnable:lastVisit';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

let DATA, ranked, ghIndex = null, filter = 'all', sort = 'odds';
let profile = load(PKEY) || {};
const lastVisit = load(VKEY);   // previous visit, for "new" markers
function load(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } }

const hasProfile = () => profile.country || profile.adult != null || profile.student != null;
const isNew = (h) => lastVisit && h.first_seen > lastVisit.slice(0, 10);

// ------------------------------------------------------------- formatting

// Calendar days from today to a date, in the viewer's own time zone
function calendarDays(d, now = new Date()) {
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((b - a) / 864e5);
}

function closes(h) {
  if (!h.deadline) return '<div class="closes"><b>n/a</b></div>';
  const d = new Date(h.deadline);
  const left = daysLeft(h);
  const day = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  const cal = calendarDays(d);
  const rel = cal === 0 ? `today ${time}` : cal === 1 ? `tomorrow ${time}` : `${time}, in ${cal} days`;
  return `<div class="closes ${cal <= 1 ? 'urgent' : ''}"><b>${day}</b><span>${rel}</span></div>`;
}

const oddsCell = (r) => (r.oneIn
  ? `<div class="odds"><small>1 in</small><b>${int(r.oneIn)}</b></div>`
  : '<div class="odds none"><b>no cash</b></div>');

function rowHtml(r, blocked) {
  const h = r.h;
  const gh = ghIndex ? matchFor(h, ghIndex) : null;
  const tags = [
    `<span>${int(h.registrants)} registered</span>`,
    h.online ? '' : `<span>${esc(place(h))}</span>`,
    isNew(h) ? '<span class="tag new">new</span>' : '',
    gh?.repos.length ? '<span class="tag gh">fits your GitHub</span>' : '',
  ].join('');
  const first = blocked ? `<div class="reason">${esc(r.reasons[0])}</div>` : oddsCell(r);
  return `<button class="row" role="row" data-id="${h.id}">
    ${first}
    <div class="what"><span class="name">${esc(h.title)}</span><span class="meta">${tags}</span></div>
    <div class="num pe money">${r.slots ? usd(r.ev) : ''}</div>
    <div class="num cash money big ${r.totalCash ? '' : 'nocash'}">${r.totalCash ? usd(r.totalCash) : '<span class="reason">no cash</span>'}</div>
    ${closes(h)}
  </button>`;
}

function soonHtml(r) {
  const h = r.h;
  const started = h.starts && new Date(h.starts) <= new Date();
  const opens = h.starts ? new Date(h.starts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'soon';
  const gh = ghIndex ? matchFor(h, ghIndex) : null;
  return `<button class="row" role="row" data-id="${h.id}">
    <div class="opens"><small>${started ? 'opened' : 'opens'}</small><b>${opens}</b></div>
    <div class="what"><span class="name">${esc(h.title)}</span><span class="meta"><span>${int(h.registrants)} registered so far</span>${gh?.repos.length ? '<span class="tag gh">fits your GitHub</span>' : ''}</span></div>
    <div class="num pe"></div>
    <div class="num cash money big ${r.totalCash ? '' : 'nocash'}">${r.totalCash ? usd(r.totalCash) : '<span class="reason">no cash</span>'}</div>
    <div class="closes"><b>${h.deadline ? new Date(h.deadline).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : 'n/a'}</b><span>${esc(h.period || '')}</span></div>
  </button>`;
}

// ------------------------------------------------------------- board

function visible(rows) {
  if (filter === 'week') return rows.filter((r) => r.days != null && r.days < 7);
  if (filter === 'new') return rows.filter((r) => isNew(r.h));
  if (filter === 'gh') return rows.filter((r) => ghIndex && matchFor(r.h, ghIndex).repos.length);
  return rows;
}

function render(animate) {
  const before = animate && !reduced ? positions() : null;
  ranked = rankAll(DATA, { ...profile, onlineOnly: profile.onlineOnly !== false }, new Date(), sort);
  const rows = visible(ranked.eligible);
  $('#rows').innerHTML = rows.length ? rows.map((r) => rowHtml(r, false)).join('')
    : `<div class="empty">${filter === 'new' ? 'Nothing new since your last visit. Check back tomorrow: the board refreshes daily.'
      : filter === 'gh' ? 'No open hackathon matches your repos right now. Try All.'
        : filter === 'week' ? 'Nothing you can enter closes this week.' : 'Nothing you can enter right now. The reasons are below.'}</div>`;
  $('#soonRows').innerHTML = ranked.upcoming.map(soonHtml).join('');
  $('#soonWrap').hidden = !ranked.upcoming.length || filter !== 'all';
  $('#soonTitle').textContent = `Opening soon or just opened (${ranked.upcoming.length})`;
  $('#topCal').hidden = !ranked.eligible.some((r) => r.oneIn);
  $('#blockedRows').innerHTML = ranked.blocked.map((r) => rowHtml(r, true)).join('');
  $('#blockedSum').textContent = `Not for you (${ranked.blocked.length})`;
  $('#blockedWrap').hidden = !ranked.blocked.length;
  summary();
  you();
  $$('#rows .row, #soonRows .row, #blockedRows .row').forEach((b) => (b.onclick = () => openDetail(+b.dataset.id)));
  if (before) flip(before);
}

function summary() {
  const n = ranked.eligible.length;
  const cash = ranked.eligible.reduce((s, r) => s + r.totalCash, 0);
  const best = ranked.eligible.find((r) => r.oneIn);
  const openNow = n + ranked.blocked.filter((r) => !r.upcoming).length;
  const lead = hasProfile()
    ? `${n} open hackathons you can enter right now.`
    : `${openNow} hackathons are open on Devpost right now. Tell Winnable about you to see which you can enter.`;
  const sub = best ? `Best odds right now: 1 in ${int(best.oneIn)}, ${esc(best.h.title)}. Odds come from ${DATA.calibration.n} finished hackathons.` : '';
  $('#summary').innerHTML = `${lead}<span class="sub">${sub}</span>`;
}

function you() {
  const lvl = studentLevel(profile);
  const parts = [profile.country, lvl === 'university' ? 'student' : lvl === 'high school' ? 'high school student' : null,
    profile.team ? 'with a team' : null,
    profile.adult ? '18+' : profile.adult === false ? 'under 18' : null, profile.github ? `GitHub ${profile.github}` : null].filter(Boolean);
  $('#youBtn').textContent = parts.length ? `You: ${parts.join(', ')}. Edit` : 'Tell Winnable about you';
}

// FLIP: the one orchestrated motion, rows sliding to their new rank
function positions() {
  const m = new Map();
  $$('#rows .row').forEach((el) => m.set(el.dataset.id, el.getBoundingClientRect().top));
  return m;
}
function flip(before) {
  $$('#rows .row').forEach((el) => {
    const was = before.get(el.dataset.id);
    const now = el.getBoundingClientRect().top;
    if (was == null) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 380, easing: 'ease-out' });
    } else if (Math.abs(was - now) > 1) {
      el.animate([{ transform: `translateY(${was - now}px)` }, { transform: 'none' }],
        { duration: 650, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  });
}

// ------------------------------------------------------------- panels

function openPanel(html, focusSel) {
  const p = $('#panel');
  p.innerHTML = `<button class="close" aria-label="Close">&times;</button>${html}`;
  p.hidden = false; $('#scrim').hidden = false;
  $('.close', p).onclick = closePanel;
  (focusSel ? $(focusSel, p) : $('.close', p))?.focus();
}
function closePanel() { $('#panel').hidden = true; $('#scrim').hidden = true; }

function verdict(r) {
  if (!r.slots) return 'No cash prizes. Credits and swag only, so it never ranks above a cash hackathon.';
  if (r.oneIn <= 3) return 'Small field for the money. Worth a weekend.';
  if (r.oneIn <= 15) return 'Good odds for real cash.';
  if (r.oneIn <= 60) return 'Decent, if the theme fits you.';
  if (r.totalCash >= 20000) return 'Big prize, bigger crowd.';
  return 'Long odds for this money.';
}

function openDetail(id) {
  const h = DATA.hackathons.find((x) => x.id === id);
  const r = [...ranked.eligible, ...ranked.blocked].find((x) => x.h.id === id) || { ...oddsOf(h, DATA.calibration, DATA.rates), reasons: [] };
  const rate = r.projected ? r.subs / r.projected : 0;
  const prizes = h.prizes || [];
  const cash = cashPrizes(h, DATA.rates);
  const e = h.eligibility || {};
  const prof = { ...profile, onlineOnly: profile.onlineOnly !== false };
  const level = studentLevel(prof);
  const checks = [
    ['Age', e.max_age ? `Ages ${e.min_age ?? 13} to ${e.max_age}` : e.min_age ? `${e.min_age}+` : 'No age limit listed',
      !(e.min_age >= 18 && prof.adult === false) && !(e.max_age != null && e.max_age <= 19 && prof.adult === true)],
    ['Where', e.countries_only?.length ? `Only ${e.countries_only.join(', ')}` : e.countries_excluded?.length ? `All countries except ${e.countries_excluded.join(', ')}` : 'All countries',
      !ineligibility({ ...h, online: true, invite_only: false, eligibility: { countries_excluded: e.countries_excluded, countries_only: e.countries_only } }, prof).length],
    ['Who', e.students === 'university' ? 'College students only' : e.students === 'high school' ? 'High school students only' : e.professionals_only ? 'Professionals and graduates only' : 'Students and non-students',
      !(e.students && level && level !== e.students) && !(e.professionals_only && level === 'high school')],
    e.team_min ? ['Team', `Team of ${e.team_min} or more`, prof.team !== false] : null,
    ...(e.restricted || []).map((x) => ['Restricted', x, false]),
    ['Location', h.online ? 'Online' : `In person: ${place(h)}`, h.online || prof.onlineOnly === false],
    h.invite_only ? ['Access', 'Invite only', false] : null,
  ].filter(Boolean);
  const gh = ghIndex ? matchFor(h, ghIndex) : null;
  const growing = h.open_state === 'upcoming' || (daysLeft(h) ?? 0) > 3;

  openPanel(`
    <div class="panel-head"><h2 id="panelTitle">${esc(h.title)}</h2>
    <p class="org">${esc(h.org || 'Devpost')}${h.deadline ? `, closes ${new Date(h.deadline).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : ''}</p>
    ${r.oneIn ? `<div class="bigodds"><small>1 in</small><b>${int(r.oneIn)}</b></div>` : '<div class="bigodds"><b>no cash</b></div>'}
    <p class="verdict">${verdict(r)}</p></div>
    ${r.reasons?.length ? `<p class="verdict blocked-reason">Not for you: ${esc(r.reasons.join(', '))}.</p>` : ''}

    <h3>How the odds are made</h3>
    <div class="receipt">
      <div><span>Registered today</span><b>${int(h.registrants)}</b></div>
      ${r.projected > h.registrants * 1.05 ? `<div><span class="op">Projected by the deadline, from how far the hackathon has run</span><b>about ${int(r.projected)}</b></div>` : ''}
      <div><span class="op">Expected to submit, ${Math.round(rate * 100)} % of them</span><b>about ${int(r.subs)}</b></div>
      <div><span class="op">Cash prizes</span><b>${r.slots} ${r.slots === 1 ? 'winner' : 'winners'}</b></div>
      <div class="total"><span>Chance of winning any cash</span><b>${r.oneIn ? `1 in ${int(r.oneIn)}` : 'none'}</b></div>
      <div><span class="op">Total cash</span><b>${usd(r.totalCash)}</b></div>
      <div class="total"><span>Expected cash for one entry</span><b>${usd(r.ev)}</b></div>
    </div>
    <p class="org">For an average entry. ${growing ? 'Registrations are still open, so the field will grow and the odds will lengthen.' : ''}</p>

    <h3>Can you enter</h3>
    <ul class="checks">${checks.map(([k, v, ok]) => `<li><span class="mark ${ok ? '' : 'no'}">${ok ? '&#10003;' : '&#10007;'}</span><span><b>${k}:</b> ${esc(v)}</span></li>`).join('')}</ul>

    <h3>Prizes</h3>
    <div class="prizes">${prizes.length ? prizes.map((p) => {
      const counted = p.cash && p.amount > 0 && !isParticipation(p);
      const why = isParticipation(p) && p.cash ? 'participation prize, not counted' : p.note || (p.inferred && counted ? 'amount read from the prize text' : '');
      return `<div class="${counted ? '' : 'noncash'}"><span>${esc(p.title)}${p.winners > 1 ? `, ${p.winners} winners` : ''}${why ? `<small class="pnote">${esc(why)}</small>` : ''}</span><b>${esc(p.value || '')}</b></div>`;
    }).join('') : '<div><span>No prizes listed</span></div>'}</div>
    ${cash.length !== prizes.length ? '<p class="org">Grey prizes are credits, hardware, swag or participation awards. They are not counted in the odds.</p>' : ''}

    ${h.themes?.length ? `<h3>Themes</h3><div class="chips">${h.themes.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : ''}
    ${gh?.repos.length ? `<h3>Fits your GitHub</h3><p>${gh.repos.map(esc).join(', ')} (${gh.themes.map(esc).join(', ')})</p>` : ''}

    <div class="actions">
      <button class="btn line" id="calOne">Add to calendar</button>
      <a class="btn solid" href="${esc(h.url)}" target="_blank" rel="noopener">Open on Devpost</a>
    </div>`);
  $('#calOne').onclick = () => download(`winnable-${h.id}.ics`, buildIcs([r]));
}

function openAbout() {
  openPanel(`
    <h2 id="panelTitle">About you</h2>
    <p class="org">These answers decide which hackathons you can enter. They stay in this browser.</p>
    <label class="field"><span>Country you live in</span>
      <select id="pfCountry"><option value="">Choose a country</option>${COUNTRIES.map((c) => `<option ${c === profile.country ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
    <label class="field"><span>Age</span>
      <select id="pfAdult"><option value="">Choose</option><option value="yes" ${profile.adult === true ? 'selected' : ''}>18 or older</option><option value="no" ${profile.adult === false ? 'selected' : ''}>Under 18</option></select></label>
    <label class="field"><span>Student</span>
      <select id="pfStudent">${[['no', 'Not a student'], ['university', 'University or college'], ['high school', 'High school']].map(([v, l]) => `<option value="${v}" ${studentLevel(profile) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    <label class="toggle"><span>I can enter with a team</span><input type="checkbox" id="pfTeam" ${profile.team ? 'checked' : ''}></label>
    <label class="toggle"><span>Online hackathons only</span><input type="checkbox" id="pfOnline" ${profile.onlineOnly !== false ? 'checked' : ''}></label>
    <label class="field"><span>GitHub username, optional</span>
      <input id="pfGithub" autocomplete="off" spellcheck="false" placeholder="octocat" value="${esc(profile.github || '')}">
      <span class="hint" id="pfGhNote">Marks hackathons whose themes fit your public repos. Only GitHub sees the request.</span></label>
    <div class="actions" style="grid-template-columns:1fr"><button class="btn solid" id="pfDone">Show my odds</button></div>`, '#pfCountry');
  const update = () => {
    profile = { ...profile, country: $('#pfCountry').value || null, adult: $('#pfAdult').value === '' ? null : $('#pfAdult').value === 'yes', student: $('#pfStudent').value,
      team: $('#pfTeam').checked, onlineOnly: $('#pfOnline').checked, github: $('#pfGithub').value.trim() || null };
    save(PKEY, profile);
  };
  $$('#panel select, #panel input').forEach((el) => (el.onchange = update));
  $('#pfDone').onclick = async () => {
    update();
    closePanel();
    render(true);
    await loadGithub();
  };
}

function openHow() {
  const c = DATA.calibration;
  openPanel(`
    <h2 id="panelTitle">How the odds work</h2>
    <p>Most people who register for a hackathon never submit. Winnable learns how many do from finished Devpost hackathons: registrants on one axis, projects in the gallery on the other.</p>
    ${calibrationChart(c)}
    <p class="org">${c.n} finished hackathons, collected ${esc(c.computed)}. Median: ${Math.round(c.median_rate * 100)} % of registrants submit. Fitted curve: submissions = ${c.a.toFixed(2)} &times; registrants<sup>${c.b.toFixed(2)}</sup>.</p>
    <h3>From that to your odds</h3>
    <p>Expected submissions come from the curve. Your chance of winning any cash is the number of cash winners divided by expected submissions. Expected cash for one entry is all cash prize money divided by expected submissions. Prizes in other currencies use the day's reference rates.</p>
    <h3>What it leaves out</h3>
    <p>Skill, team size and how well your idea fits: every entry counts the same, so read the odds as the field you are up against, not a forecast for you. Credits, hardware and swag are listed but never counted. Registrations still open will grow the field.</p>
    <p class="org">Data from Devpost's public hackathon pages, refreshed daily.</p>`);
}

// ------------------------------------------------------------- GitHub

async function loadGithub() {
  const user = profile.github;
  $('#filters [data-f="gh"]').hidden = true;
  if (!user) { ghIndex = null; return; }
  try {
    const repos = await fetchRepos(user);
    ghIndex = themeIndex(repos);
    $('#filters [data-f="gh"]').hidden = false;
    render(false);
  } catch (e) {
    ghIndex = null;
    const note = $('#pfGhNote');
    if (note) note.textContent = e.message;
    console.warn(e.message);
  }
}

// ------------------------------------------------------------- boot

async function boot() {
  DATA = await fetch('../data/hackathons.json').then((r) => r.json());
  render(false);
  const age = (Date.now() - new Date(DATA.generated)) / 864e5;
  $('#dataNote').textContent = `Data from Devpost, ${new Date(DATA.generated).toLocaleString('en-GB', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}${age > 2 ? '. Older than two days.' : '.'}`;
  $('#youBtn').onclick = openAbout;
  $('#howBtn').onclick = openHow;
  $('#scrim').onclick = closePanel;
  addEventListener('keydown', (e) => e.key === 'Escape' && !$('#panel').hidden && closePanel());
  $$('#filters button').forEach((b) => (b.onclick = () => {
    filter = b.dataset.f;
    $$('#filters button').forEach((x) => x.classList.toggle('on', x === b));
    render(false);
  }));
  $('#sortSel').onchange = (e) => { sort = e.target.value; render(true); };
  $('#topCal').onclick = () => download('winnable-top5.ics', buildIcs(ranked.eligible.filter((r) => r.oneIn).slice(0, 5)));
  save(VKEY, new Date().toISOString());
  if (!hasProfile()) setTimeout(openAbout, 600);
  else loadGithub();
}
boot();

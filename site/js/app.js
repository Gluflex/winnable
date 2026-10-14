// Winnable board: loads the daily data file and renders the timetable.
import { odds, daysLeft, isUpcoming, SORTS } from './rank.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const usd = (v) => (v == null ? 'n/a' : v >= 100 ? `$${Math.round(v).toLocaleString('en-US')}` : `$${v.toFixed(2)}`);

let DATA;

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

function row(r) {
  const h = r.h;
  const cash = r.totalCash;
  const oddsCell = r.oneIn ? `<div class="odds"><small>1 in</small><b>${r.oneIn.toLocaleString('en-US')}</b></div>` : '<div class="odds none"><b>no cash</b></div>';
  return `<div class="row" role="row">
    ${oddsCell}
    <div class="what"><span class="name">${esc(h.title)}</span>
      <span class="meta"><span>${h.registrants.toLocaleString('en-US')} registered</span>${h.online ? '' : `<span>${esc(h.location)}</span>`}</span></div>
    <div class="num pe money">${r.slots ? usd(r.ev) : ''}</div>
    <div class="num cash money big">${cash ? usd(cash) : 'no cash'}</div>
    ${closes(h)}
  </div>`;
}

async function boot() {
  DATA = await fetch('../data/hackathons.json').then((r) => r.json());
  const list = DATA.hackathons.filter((h) => (daysLeft(h) == null || daysLeft(h) > 0) && !isUpcoming(h))
    .map((h) => ({ h, ...odds(h, DATA.calibration, DATA.rates) }))
    .sort(SORTS.odds);
  $('#rows').innerHTML = list.map(row).join('');
  $('#summary').innerHTML = `${list.length} open hackathons on Devpost today, ranked by your odds of winning cash.`;
  $('#dataNote').textContent = `Data from Devpost, ${new Date(DATA.generated).toLocaleString('en-GB')}.`;
}
boot();

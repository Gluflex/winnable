// Calendar export (RFC 5545): one event per deadline, UTC times, folded lines,
// a reminder two days before.

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escText = (s) => String(s).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

export function fold(line) {
  const out = [];
  let rest = line;
  let first = true;
  while (new TextEncoder().encode(rest).length > (first ? 75 : 74)) {
    let cut = first ? 75 : 74;
    while (new TextEncoder().encode(rest.slice(0, cut)).length > (first ? 75 : 74)) cut--;
    out.push((first ? '' : ' ') + rest.slice(0, cut));
    rest = rest.slice(cut);
    first = false;
  }
  out.push((first ? '' : ' ') + rest);
  return out.join('\r\n');
}

export function buildIcs(rows, now = new Date()) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Winnable//Deadlines//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
  for (const r of rows) {
    const h = r.h;
    if (!h.deadline) continue;
    const end = new Date(h.deadline);
    const start = new Date(end.getTime() - 30 * 60000);
    const odds = r.oneIn ? `Odds about 1 in ${r.oneIn} for an average entry. ` : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:winnable-${h.id}@winnable`,
      `DTSTAMP:${stamp(now)}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${escText(`Deadline: ${h.title}`)}`,
      `DESCRIPTION:${escText(`${odds}Submit on Devpost: ${h.url}`)}`,
      `URL:${h.url}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${escText(`${h.title} closes in 2 days`)}`, 'TRIGGER:-P2D', 'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

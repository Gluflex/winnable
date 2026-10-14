// Calibration chart: finished hackathons, registrants against submitted projects,
// on log axes, with the fitted power law. Plain SVG, colours from CSS tokens.

const W = 400, H = 300, L = 46, R = 12, T = 12, B = 40;

export function calibrationChart(c) {
  const pts = c.points || [];
  if (!pts.length) return '';
  const lx = (v) => Math.log10(v);
  const xMin = 1, xMax = Math.ceil(Math.max(...pts.map((p) => lx(p[0]))));
  const yMin = 0, yMax = Math.ceil(Math.max(...pts.map((p) => lx(p[1]))));
  const X = (v) => L + ((lx(v) - xMin) / (xMax - xMin)) * (W - L - R);
  const Y = (v) => H - B - ((lx(v) - yMin) / (yMax - yMin)) * (H - T - B);
  const fmt = (v) => (v >= 1000 ? `${v / 1000}k` : `${v}`);

  let grid = '';
  for (let e = xMin; e <= xMax; e++) {
    const v = 10 ** e;
    grid += `<line x1="${X(v)}" x2="${X(v)}" y1="${T}" y2="${H - B}" class="g"/><text x="${X(v)}" y="${H - B + 16}" text-anchor="middle">${fmt(v)}</text>`;
  }
  for (let e = yMin; e <= yMax; e++) {
    const v = 10 ** e;
    grid += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${L - 8}" y="${Y(v) + 4}" text-anchor="end">${fmt(v)}</text>`;
  }
  const dots = pts.map(([r, s]) => `<circle cx="${X(r).toFixed(1)}" cy="${Y(s).toFixed(1)}" r="4"><title>${r.toLocaleString('en-US')} registered, ${s.toLocaleString('en-US')} submitted (${Math.round((s / r) * 100)} %)</title></circle>`).join('');
  const x0 = 10 ** xMin, x1 = 10 ** xMax;
  const f = (x) => Math.min(x, c.a * x ** c.b);
  const steps = 24;
  let d = '';
  for (let i = 0; i <= steps; i++) {
    const x = 10 ** (xMin + (i / steps) * (xMax - xMin));
    d += `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(Math.max(1, f(x))).toFixed(1)}`;
  }
  return `<figure class="calib">
    <figcaption>Projects submitted against registrants, ${c.n} finished hackathons</figcaption>
    <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Scatter of ${c.n} finished hackathons: submitted projects grow with registrants, with a median submission rate of ${Math.round(c.median_rate * 100)} percent">
      ${grid}
      <g class="dots">${dots}</g>
      <path d="${d}" class="fit"/>
      <text x="${(L + W - R) / 2}" y="${H - 6}" text-anchor="middle" class="axis">Registrants</text>
      <text transform="translate(12 ${(T + H - B) / 2}) rotate(-90)" text-anchor="middle" class="axis">Submitted</text>
    </svg>
  </figure>`;
}

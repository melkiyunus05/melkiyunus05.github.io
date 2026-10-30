'use strict';
// ---------- Jam Harian (jam dinding 12 jam, dua cincin) ----------
// Cincin dalam = 00.00 sampai 12.00, cincin luar = 12.00 sampai 24.00, angka 1 sampai 12 seperti jam dinding.
// Warna solid = jadwal tetap, bergaris = sesi rencana kerja, arsir abu = jam tidur.

const CX = 200, CY = 200;
const RINGS = [{ r1: 108, r2: 140, from: 0, to: 720 }, { r1: 146, r2: 180, from: 720, to: 1440 }];

function sleepRanges() {
  const s = toMin(dset.sleepStart), e = toMin(dset.sleepEnd);
  return s > e ? [[s, 1440], [0, e]] : [[s, e]];
}
// Semua yang punya jam di tanggal k
function dayBlocks(k) {
  const out = [];
  for (const it of itemsOn(k)) {
    if (!it.time) continue;
    const s = toMin(it.time);
    const c = cat(it.type);
    // Deadline tanpa jam selesai cukup ditandai sebagai titik waktu, bukan blok
    if (c.checkable && !it.endTime) out.push({ kind: 'mark', s, e: s, it, color: c.color });
    else out.push({ kind: 'item', s, e: Math.min(1440, endMin(it)), it, color: c.color });
  }
  for (const p of plansOn(k)) {
    const ss = planDay(p, k).sessions;
    ss.forEach((x, i) => {
      if (!x.time) return;
      const s = toMin(x.time);
      out.push({ kind: 'sess', s, e: Math.min(1440, s + x.min), p, x, i, n: ss.length, color: planColor(p) });
    });
  }
  return out.sort((a, b) => a.s - b.s || a.e - b.e);
}
// ---------- Gambar jam ----------
const ang = (m) => ((m % 720) / 720) * 2 * Math.PI;
const pt = (r, a) => [CX + r * Math.sin(a), CY - r * Math.cos(a)];
function arcPath(r1, r2, a1, a2) {
  if (a2 <= a1) a2 += 2 * Math.PI;
  const big = a2 - a1 > Math.PI ? 1 : 0;
  const [x1, y1] = pt(r2, a1), [x2, y2] = pt(r2, a2), [x3, y3] = pt(r1, a2), [x4, y4] = pt(r1, a1);
  return `M${x1.toFixed(1)} ${y1.toFixed(1)} A${r2} ${r2} 0 ${big} 1 ${x2.toFixed(1)} ${y2.toFixed(1)} L${x3.toFixed(1)} ${y3.toFixed(1)} A${r1} ${r1} 0 ${big} 0 ${x4.toFixed(1)} ${y4.toFixed(1)} Z`;
}
// Gambar rentang [s, e) menit; bisa terbagi ke dua cincin kalau melewati jam 12
function segments(s, e, attrs, pad = 0.012) {
  let out = '';
  for (const R of RINGS) {
    const a = Math.max(s, R.from), b = Math.min(e, R.to);
    if (b <= a) continue;
    const a2 = b - a >= 720 ? ang(a) + 2 * Math.PI - 0.0001 : (b === R.to ? 2 * Math.PI : ang(b));
    out += `<path d="${arcPath(R.r1 + 2, R.r2 - 2, ang(a) + pad, a2 - pad)}" ${attrs}/>`;
  }
  return out;
}

function clockSvg(k) {
  const blocks = dayBlocks(k);
  const today = k === toKey(new Date());
  const colors = [...new Set(blocks.filter((b) => b.kind === 'sess').map((b) => b.color))];
  let g = `<defs>${colors.map((c, i) => `<pattern id="cs${i}" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="${c}" fill-opacity=".35"/><rect width="3.5" height="7" fill="${c}" fill-opacity=".9"/></pattern>`).join('')}
    <pattern id="csleep" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
      <rect width="6" height="6" fill="#94a3b8" fill-opacity=".15"/><rect width="2" height="6" fill="#94a3b8" fill-opacity=".4"/></pattern></defs>`;
  g += `<circle cx="${CX}" cy="${CY}" r="194" class="ck-face"/>`;
  for (const R of RINGS) g += `<path d="${arcPath(R.r1, R.r2, 0, 2 * Math.PI - 0.0001)}" class="ck-ring"/>`;
  for (const [s, e] of sleepRanges()) g += segments(s, e, 'fill="url(#csleep)"', 0.004);
  for (const b of blocks) {
    if (b.kind === 'mark') continue;
    const done = b.kind === 'sess' ? (b.x.done || sessDoneMin(b.x) >= b.x.min) : isDone(b.it, k);
    const fill = b.kind === 'sess' ? `url(#cs${colors.indexOf(b.color)})` : b.color;
    const data = b.kind === 'sess' ? `data-plan="${b.p.id}" data-day="${k}" data-sess="${b.x.id}"` : `data-ck-item="${b.it.id}"`;
    const title = b.kind === 'sess' ? `${b.p.title} · Sesi ${b.i + 1}` : b.it.title;
    g += `<g class="ck-seg${done ? ' done' : ''}" ${data}><title>${esc(title)} ${dotTime(hhmm(b.s))} - ${dotTime(hhmm(b.e))}</title>${segments(b.s, b.e, `fill="${fill}" stroke="${b.color}" stroke-width="1.5"`)}</g>`;
  }
  // Deadline: penanda segitiga kecil di cincin yang sesuai
  for (const b of blocks.filter((x) => x.kind === 'mark')) {
    const R = RINGS[b.s >= 720 ? 1 : 0];
    const a = ang(b.s);
    const [x1, y1] = pt(R.r2 + 1, a - 0.05), [x2, y2] = pt(R.r2 + 1, a + 0.05), [x3, y3] = pt(R.r1 + 4, a);
    g += `<g class="ck-seg" data-ck-item="${b.it.id}"><title>${esc(b.it.title)} ${dotTime(b.it.time)}</title>
      <path d="M${x1} ${y1} L${x2} ${y2} L${x3} ${y3} Z" fill="${b.color}" stroke="var(--surface)" stroke-width="1.5"/></g>`;
  }
  for (let h = 1; h <= 12; h++) {
    const a = (h / 12) * 2 * Math.PI;
    const [tx, ty] = pt(90, a), [x1, y1] = pt(194, a), [x2, y2] = pt(185, a);
    g += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="ck-tick"/>`;
    g += `<text x="${tx}" y="${ty + 5}" text-anchor="middle" class="ck-num">${h}</text>`;
  }
  g += `<text x="${CX + 22}" y="${CY - 185}" class="ck-ringlabel">LUAR: 12-24</text>`;
  g += `<text x="${CX}" y="${CY - 120}" text-anchor="middle" class="ck-ringlabel">DALAM: 00-12</text>`;
  if (today) {
    const now = nowMin();
    const [nx, ny] = pt(now >= 720 ? 163 : 124, ang(now));
    const [hx, hy] = pt(58, ang(now));
    const [mx, my] = pt(84, ((now % 60) / 60) * 2 * Math.PI);
    g += `<circle cx="${nx}" cy="${ny}" r="9" class="ck-now"/>`;
    g += `<line x1="${CX}" y1="${CY}" x2="${hx}" y2="${hy}" class="ck-hand h"/><line x1="${CX}" y1="${CY}" x2="${mx}" y2="${my}" class="ck-hand m"/>`;
    g += `<circle cx="${CX}" cy="${CY}" r="6" class="ck-pin"/>`;
    // Tulisan jam diletakkan di sisi yang tidak dilewati jarum jam dan jarum menit
    const hy0 = Math.cos(ang(now)), my0 = Math.cos(((now % 60) / 60) * 2 * Math.PI);
    const down = hy0 < 0 || my0 < 0; // salah satu jarum mengarah ke bawah
    const up = hy0 > 0 || my0 > 0;
    const ty = down && !up ? CY - 30 : down && up ? CY + (hy0 < 0 ? -30 : 42) : CY + 42;
    g += `<text x="${CX}" y="${ty}" text-anchor="middle" class="ck-big">${dotTime(hhmm(now))}</text>`;
  } else {
    const d = fromKey(k);
    g += `<text x="${CX}" y="${CY + 8}" text-anchor="middle" class="ck-big">${DAYS[d.getDay()].slice(0, 3)}, ${d.getDate()}</text>`;
  }
  return `<svg class="day-clock" viewBox="0 0 400 400" role="img" aria-label="Jam harian">${g}</svg>`;
}

// ---------- Kartu jam ----------
// Sengaja sederhana: jam, keterangan warna, dan satu baris "sekarang / berikutnya".
function nextLine(k) {
  if (k !== toKey(new Date())) return '';
  const now = nowMin();
  const blocks = dayBlocks(k).filter((b) => b.kind !== 'mark' && b.e > now);
  const cur = blocks.find((b) => b.s <= now);
  const nxt = blocks.find((b) => b.s > now);
  const name = (b) => esc(b.kind === 'sess' ? b.p.title : b.it.title);
  if (cur) return `<p class="ck-next"><b>Sekarang</b> ${name(cur)} <span>sampai ${dotTime(hhmm(cur.e))}</span></p>`;
  if (nxt) return `<p class="ck-next"><b>Berikutnya</b> ${name(nxt)} <span>${dotTime(hhmm(nxt.s))}</span></p>`;
  return '';
}

function clockCardHtml(k) {
  return `<div class="clock-card">
    <div class="clock-head"><h3 class="sec-title">Jam harian</h3>
      <button type="button" class="link-btn" data-dayset title="Atur jam tidur dan batas beban">Tidur ${dotTime(dset.sleepStart)} - ${dotTime(dset.sleepEnd)}</button></div>
    <div class="clock-wrap">${clockSvg(k)}
      ${nextLine(k)}
      <div class="ck-legend"><span><i class="sw solid"></i>Jadwal</span><span><i class="sw striped"></i>Sesi rencana</span><span><i class="sw sleep"></i>Tidur</span></div>
    </div></div>`;
}

$('#dvBody').addEventListener('click', (e) => {
  if (e.target.closest('[data-dayset]')) { openDaySettings(); return; }
  const seg = e.target.closest('[data-ck-item]');
  if (seg) { const it = items.find((x) => x.id === seg.dataset.ckItem); if (it) openForm(it, selected); }
});

// Jarum jam ikut bergerak tiap menit saat tampilan Hari hari ini terbuka
setInterval(() => { if (page === 'cal' && mode === 'day' && selected === toKey(new Date()) && !document.querySelector('dialog[open]')) renderDayView(); }, 60000);

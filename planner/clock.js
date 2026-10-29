'use strict';
// ---------- Jam Harian (jam dinding 12 jam, dua cincin) ----------
// Cincin dalam = 00.00 sampai 12.00, cincin luar = 12.00 sampai 24.00, angka 1 sampai 12 seperti jam dinding.
// Warna solid = jadwal tetap, bergaris = sesi rencana kerja, arsir abu = jam tidur.
// Di sampingnya ada agenda berurutan lengkap dengan slot kosong, dan laci sesi yang belum diberi jam.

const CLOCK_FOLD_KEY = 'elio-planner-clock-folded';
const CX = 200, CY = 200;
const RINGS = [{ r1: 108, r2: 140, from: 0, to: 720 }, { r1: 146, r2: 180, from: 720, to: 1440 }];

function sleepRanges() {
  const s = toMin(dset.sleepStart), e = toMin(dset.sleepEnd);
  return s > e ? [[s, 1440], [0, e]] : [[s, e]];
}
function awakeRange() {
  const s = toMin(dset.sleepStart), e = toMin(dset.sleepEnd);
  return s > e ? [e, s] : [0, 1440];
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
function unplacedSessions(k) {
  const out = [];
  for (const p of plansOn(k)) planDay(p, k).sessions.forEach((x, i, arr) => { if (!x.time) out.push({ p, x, i, n: arr.length }); });
  return out;
}

// Slot kosong di jam bangun, dikurangi jadwal dan sesi yang sudah berjam.
// buffer: jeda (menit) yang disisakan setelah setiap kegiatan, dipakai saat mengatur otomatis.
function freeGaps(k, minLen = 30, buffer = 0) {
  const [wake, sleep] = awakeRange();
  let from = wake;
  if (k === toKey(new Date())) from = Math.max(from, Math.ceil(nowMin() / 15) * 15);
  const busy = dayBlocks(k).filter((b) => b.kind !== 'mark').map((b) => [b.s - (b.s > from ? buffer : 0), b.e + buffer]).sort((a, b) => a[0] - b[0]);
  const gaps = [];
  let cur = from;
  for (const [s, e] of busy) {
    if (s - cur >= minLen) gaps.push([cur, Math.min(s, sleep)]);
    cur = Math.max(cur, e);
    if (cur >= sleep) break;
  }
  if (sleep - cur >= minLen) gaps.push([cur, sleep]);
  return gaps.filter(([s, e]) => e - s >= minLen);
}

// Taruh sesi tanpa jam ke slot kosong paling awal, dengan jeda 15 menit antar kegiatan
function autoPlace(k) {
  const list = unplacedSessions(k);
  if (!list.length) return;
  const failed = [];
  for (const u of list) {
    // Setiap sesi yang baru diberi jam langsung ikut dihitung sebagai "sibuk" untuk sesi berikutnya
    const gap = freeGaps(k, u.x.min, 15).find(([s, e]) => e - Math.ceil(s / 15) * 15 >= u.x.min);
    if (!gap) { failed.push(u); continue; }
    u.x.time = hhmm(Math.ceil(gap[0] / 15) * 15);
  }
  savePlans();
  render();
  toast(failed.length
    ? `${list.length - failed.length} sesi diatur. ${failed.length} sesi tidak muat di slot kosong, atur jamnya manual.`
    : `${list.length} sesi diatur ke slot kosong`);
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

// ---------- Agenda berurutan ----------
function agendaHtml(k, focusedIds, status) {
  const today = k === toKey(new Date());
  const now = nowMin();
  const blocks = dayBlocks(k).filter((b) => b.kind === 'sess' || !focusedIds.has(b.it.id));
  const gaps = freeGaps(k, 60).map(([s, e]) => ({ kind: 'gap', s, e }));
  const rows = [...blocks, ...gaps].sort((a, b) => a.s - b.s || (a.kind === 'gap') - (b.kind === 'gap'));
  if (!rows.length) return '<p class="sec-empty">Belum ada jadwal atau sesi berjam di hari ini.</p>';
  return `<ul class="items agenda">${rows.map((r) => {
    if (r.kind === 'gap') {
      return `<li class="ag-free" data-gap="${hhmm(r.s)}"><span class="ag-t">${dotTime(hhmm(r.s))} - ${dotTime(hhmm(r.e))}</span><span>Kosong ${fmtH(r.e - r.s)}</span></li>`;
    }
    if (r.kind === 'sess') {
      const done = r.x.done || sessDoneMin(r.x) >= r.x.min;
      const live = today && now >= r.s && now < r.e && !done;
      const run = timer.status !== 'idle' && timer.target.kind === 'session' && timer.target.s === r.x.id;
      return `<li class="ag-sess${done ? ' done' : ''}${live ? ' now' : ''}" style="--pc:${r.color}" data-plan="${r.p.id}" data-day="${k}" data-sess="${r.x.id}">
        <span class="ag-t">${dotTime(hhmm(r.s))} - ${dotTime(hhmm(r.e))}</span>
        <i class="ag-sw"></i>
        <button type="button" class="ag-name" data-sess-open>${esc(r.p.title)}</button>
        <span class="ag-k">${live ? 'SEKARANG' : done ? 'Selesai' : `Sesi ${r.i + 1}/${r.n}`}</span>
        ${done ? '' : `<button type="button" class="play-btn" data-sess-play aria-label="Mulai timer" style="--c:${r.color}">${run && timer.status === 'running' ? '&#10074;&#10074;' : '&#9654;'}</button>`}
      </li>`;
    }
    return itemHtml(r.it, k, { status: status.get(r.it.id), focusDate: k });
  }).join('')}</ul>`;
}

function clockCardHtml(k, focusedIds, status) {
  const folded = readPref(CLOCK_FOLD_KEY, '') === '1';
  const un = unplacedSessions(k);
  const head = `<div class="clock-head"><h3 class="sec-title">Jam harian</h3>
    <div class="clock-tools">
      <button type="button" class="link-btn" data-dayset title="Atur jam tidur dan batas beban">Tidur ${dotTime(dset.sleepStart)} - ${dotTime(dset.sleepEnd)}</button>
      <button type="button" class="btn ghost small" data-clock-fold>${folded ? 'Tampilkan' : 'Lipat'}</button>
    </div></div>`;
  if (folded) return `<div class="clock-card folded">${head}</div>`;
  return `<div class="clock-card">${head}
    <div class="clock-grid">
      <div class="clock-wrap">${clockSvg(k)}
        <div class="ck-legend"><span><i class="sw solid"></i>Jadwal</span><span><i class="sw striped"></i>Sesi rencana</span><span><i class="sw sleep"></i>Tidur</span></div>
      </div>
      <div class="clock-side">
        ${agendaHtml(k, focusedIds, status)}
        ${un.length ? `<div class="tray"><b>Belum diatur jamnya:</b>
          ${un.map((u) => `<button type="button" class="pill" style="--c:${planColor(u.p)}" data-plan="${u.p.id}" data-day="${k}" data-sess="${u.x.id}" data-sess-open>${esc(u.p.title)} · ${fmtH(u.x.min)}</button>`).join('')}
          <span class="spacer"></span><button type="button" class="btn small primary" data-autoplace>Atur otomatis</button></div>` : ''}
      </div>
    </div></div>`;
}

$('#dvBody').addEventListener('click', (e) => {
  if (e.target.closest('[data-autoplace]')) { autoPlace(selected); return; }
  if (e.target.closest('[data-dayset]')) { openDaySettings(); return; }
  if (e.target.closest('[data-clock-fold]')) { writePref(CLOCK_FOLD_KEY, readPref(CLOCK_FOLD_KEY, '') === '1' ? '' : '1'); render(); return; }
  const seg = e.target.closest('[data-ck-item]');
  if (seg) { const it = items.find((x) => x.id === seg.dataset.ckItem); if (it) openForm(it, selected); return; }
  // Ketuk slot kosong: tambah item di jam itu
  const gap = e.target.closest('[data-gap]');
  if (gap) openForm(null, selected, { date: selected, time: gap.dataset.gap });
});

// Jarum jam ikut bergerak tiap menit saat tampilan Hari hari ini terbuka
setInterval(() => { if (page === 'cal' && mode === 'day' && selected === toKey(new Date()) && !document.querySelector('dialog[open]')) renderDayView(); }, 60000);

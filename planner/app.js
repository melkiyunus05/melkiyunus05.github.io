'use strict';

// ---------- Konfigurasi ----------
// Kategori bawaan. Setelah pertama kali disimpan, kategori bisa diubah sendiri lewat menu "Kelola kategori".
// checkable: punya checkbox selesai. weekly: otomatis "ulangi tiap minggu" saat dipilih. subs: pilihan jenis.
const DEFAULT_CATS = [
  { id: 'todo',       label: 'To do',         color: '#0ea5e9', checkable: true },
  { id: 'deadline',   label: 'Deadline',      color: '#ef4444', checkable: true, subs: ['Tugas', 'Lomba', 'Presentasi', 'Asistensi', 'Rapat', 'Lainnya'] },
  { id: 'ujian',      label: 'Ujian',         color: '#f97316', checkable: true, subs: ['Kuis', 'UTS', 'UAS', 'Praktikum'] },
  { id: 'kuliah',     label: 'Jadwal kuliah', color: '#8b5cf6', weekly: true },
  { id: 'asistensi',  label: 'Asistensi',     color: '#10b981', weekly: true },
  { id: 'acara',      label: 'Acara',         color: '#eab308' },
  { id: 'pengumuman', label: 'Pengumuman',    color: '#ec4899' },
  { id: 'lainnya',    label: 'Lainnya',       color: '#64748b', checkable: true },
];
// Dipakai untuk item yang kategorinya sudah dihapus
const UNKNOWN_CAT = { id: '', label: 'Tanpa kategori', color: '#94a3b8', checkable: true, weekly: false, subs: [] };
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]; // kalender mulai Senin
const STORE_KEY = 'elio-planner-v1';
const CATS_KEY = 'elio-planner-cats-v1';
const THEME_KEY = 'elio-planner-theme';
const MODE_KEY = 'elio-planner-mode';
const PAGE_KEY = 'elio-planner-page';
const FOCUS_KEY = 'elio-planner-focus-v1';
const FOCUS_MAX = 3;
const FIRED_KEY = 'elio-planner-fired-v1';
const REMIND_LABELS = { 0: 'saat mulai', 10: '10 mnt', 30: '30 mnt', 60: '1 jam', 180: '3 jam', 1440: 'H-1', 4320: 'H-3' };
const HOUR_PX = 48; // tinggi satu jam di tampilan mingguan
const UPCOMING_DAYS = 14;
const CHIPS_PER_CELL = 3;

// ---------- State ----------
let items = load();
let cats = loadCats();
let focus = loadFocus(); // { 'YYYY-MM-DD': [{ id, k }] }, k = tanggal kemunculan item
let view = startOfMonth(new Date());
let selected = toKey(new Date());
let filter = 'all';
let editing = null; // { id, occurrence } saat edit
let mode = readPref(MODE_KEY, 'day'); // 'day' | 'week' | 'month'
if (!['day', 'week', 'month'].includes(mode)) mode = 'day';
let sideTab = 'day';
let page = readPref(PAGE_KEY, 'cal'); // 'cal' | 'courses' | 'comps'
if (!['cal', 'courses', 'comps'].includes(page)) page = 'cal';

// ---------- Util tanggal ----------
function pad(n) { return String(n).padStart(2, '0'); }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 86400000); }
function prettyDate(k) { const d = fromKey(k); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function weekStart(k) { const d = fromKey(k); return addDays(d, -((d.getDay() + 6) % 7)); }
function toMin(t) { return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5)); }
function nowMin() { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); }
function endMin(it) { return it.endTime && it.endTime > it.time ? toMin(it.endTime) : toMin(it.time) + 60; }
function relDay(k) {
  const n = diffDays(toKey(new Date()), k);
  return n === 0 ? 'Hari ini' : n === 1 ? 'Besok' : n === -1 ? 'Kemarin' : n > 0 ? `${n} hari lagi` : `${-n} hari yang lalu`;
}
function shortDate(k) { const d = fromKey(k); return `${DAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; }

// ---------- Penyimpanan ----------
function readPref(key, fallback) { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } }
function writePref(key, val) { try { localStorage.setItem(key, val); } catch {} }
function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const data = raw ? JSON.parse(raw) : [];
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(items)); }
  catch { toast('Gagal menyimpan. Penyimpanan browser penuh atau diblokir.'); }
}
function cleanCat(c) {
  return {
    id: String(c.id || uid()),
    label: String(c.label || '').trim().slice(0, 40) || 'Kategori',
    color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : '#64748b',
    checkable: !!c.checkable,
    weekly: !!c.weekly,
    subs: Array.isArray(c.subs) ? c.subs.map((x) => String(x).trim().slice(0, 30)).filter(Boolean) : [],
  };
}
function loadCats() {
  try {
    const data = JSON.parse(localStorage.getItem(CATS_KEY));
    if (Array.isArray(data) && data.length) return data.map(cleanCat);
  } catch {}
  return DEFAULT_CATS.map(cleanCat);
}
function saveCats() {
  try { localStorage.setItem(CATS_KEY, JSON.stringify(cats)); }
  catch { toast('Gagal menyimpan kategori.'); }
}
function loadFocus() {
  try {
    const data = JSON.parse(localStorage.getItem(FOCUS_KEY));
    if (!data || typeof data !== 'object') return {};
    // Buang fokus yang sudah lebih dari 60 hari supaya penyimpanan tetap kecil
    const cutoff = toKey(addDays(new Date(), -60));
    for (const d of Object.keys(data)) if (d < cutoff || !Array.isArray(data[d])) delete data[d];
    return data;
  } catch { return {}; }
}
function saveFocus() { try { localStorage.setItem(FOCUS_KEY, JSON.stringify(focus)); } catch {} }
function focusOn(d) { return (focus[d] || []).filter((f) => items.some((it) => it.id === f.id)); }
function isFocused(d, id, k) { return focusOn(d).some((f) => f.id === id && f.k === k); }
function toggleFocus(d, id, k) {
  const list = focusOn(d);
  const i = list.findIndex((f) => f.id === id && f.k === k);
  if (i >= 0) list.splice(i, 1);
  else if (list.length >= FOCUS_MAX) { toast(`Fokus maksimal ${FOCUS_MAX}. Lepas salah satu dulu.`); return; }
  else list.push({ id, k });
  if (list.length) focus[d] = list; else delete focus[d];
  saveFocus();
  render();
  if (i < 0) toast(d === toKey(new Date()) ? 'Ditambahkan ke Fokus hari ini' : `Ditambahkan ke Fokus ${shortDate(d)}`);
}
function cat(id) { return cats.find((c) => c.id === id) || UNKNOWN_CAT; }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

// ---------- Query item ----------
// Mengembalikan semua kemunculan item pada tanggal k (item berulang mingguan ikut dihitung).
function itemsOn(k) {
  const day = fromKey(k).getDay();
  const out = [];
  for (const it of items) {
    if (it.weekly) {
      if (k < it.date) continue;
      if (it.until && k > it.until) continue;
      if (fromKey(it.date).getDay() !== day) continue;
      if (it.skip && it.skip.includes(k)) continue;
    } else if (it.date !== k) continue;
    out.push(it);
  }
  return out.sort(compareItems);
}
function compareItems(a, b) {
  // Tanpa jam diletakkan di akhir, yang penting lebih dulu
  const ta = a.time || (a.important ? '99:98' : '99:99'), tb = b.time || (b.important ? '99:98' : '99:99');
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.title.localeCompare(b.title);
}
function isDone(it, k) { return it.weekly ? !!(it.doneDates && it.doneDates.includes(k)) : !!it.done; }
function setDone(it, k, val) {
  if (it.weekly) {
    const s = new Set(it.doneDates || []);
    val ? s.add(k) : s.delete(k);
    it.doneDates = [...s];
  } else it.done = val;
}
function labelOf(it) { return it.sub ? `${cat(it.type).label} ${it.sub}` : cat(it.type).label; }

// ---------- Elemen ----------
const $ = (s) => document.querySelector(s);
const grid = $('#grid');
const dialog = $('#itemDialog');
const form = $('#itemForm');

// ---------- Render ----------
function render() {
  // Halaman Matkul dan Lomba memakai data yang sama, jadi ikut diperbarui
  if (page === 'courses') renderCourses();
  else if (page === 'comps') renderComps();
  renderHeader();
  if (mode === 'month') renderCalendar();
  else if (mode === 'week') renderWeek();
  else renderDayView();
  renderDay();
  renderUpcoming();
}

function renderHeader() {
  let label;
  if (mode === 'month') label = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
  else if (mode === 'week') {
    const a = weekStart(selected), b = addDays(a, 6);
    label = a.getMonth() === b.getMonth()
      ? `${a.getDate()} - ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`
      : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} - ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
  } else label = `${shortDate(selected)} ${fromKey(selected).getFullYear()}`;
  $('#periodLabel').textContent = label;
}

function applyMode() {
  $('#dayView').hidden = mode !== 'day';
  $('#weekView').hidden = mode !== 'week';
  $('#monthView').hidden = mode !== 'month';
  for (const b of $('#modeSeg').children) b.classList.toggle('on', b.dataset.mode === mode);
  // Di tampilan Hari, isi tanggal sudah tampil di tengah, jadi panel samping cukup menampilkan "Mendatang"
  $('.tabs').hidden = mode === 'day';
  if (mode === 'day') { $('#dayPanel').hidden = true; $('#upcomingPanel').hidden = false; }
  else showTab(sideTab);
}

function setMode(m) {
  mode = m;
  writePref(MODE_KEY, m);
  view = startOfMonth(fromKey(selected));
  applyMode();
  render();
}

function setPage(p) {
  page = p;
  writePref(PAGE_KEY, p);
  document.body.dataset.page = p;
  $('#calPage').hidden = p !== 'cal';
  $('#coursesPage').hidden = p !== 'courses';
  $('#compsPage').hidden = p !== 'comps';
  for (const b of $('#mainNav').children) b.classList.toggle('on', b.dataset.page === p);
  render();
  window.scrollTo(0, 0);
}

function nav(dir) {
  if (mode === 'month') view = new Date(view.getFullYear(), view.getMonth() + dir, 1);
  else {
    selected = toKey(addDays(fromKey(selected), dir * (mode === 'week' ? 7 : 1)));
    view = startOfMonth(fromKey(selected));
  }
  render();
}

function renderLegend() {
  $('#legend').innerHTML = cats
    .map((c) => `<span><i style="background:${c.color}"></i>${esc(c.label)}</span>`).join('');
  $('#weekdays').innerHTML = WEEK_ORDER.map((d) => `<div>${DAYS[d].slice(0, 3)}</div>`).join('');
}

function renderCalendar() {
  const offset = (view.getDay() + 6) % 7; // jumlah hari sebelum Senin pertama
  const start = addDays(view, -offset);
  const today = toKey(new Date());
  const frag = document.createDocumentFragment();

  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    // Sembunyikan baris ke-6 kalau seluruhnya di bulan berikutnya
    if (i === 35 && d.getMonth() !== view.getMonth()) break;
    const k = toKey(d);
    const list = itemsOn(k);
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    if (d.getMonth() !== view.getMonth()) cell.classList.add('other');
    if (k === today) cell.classList.add('today');
    if (k === selected) cell.classList.add('selected');
    if (d.getDay() === 0) cell.classList.add('sunday');
    cell.dataset.key = k;
    cell.setAttribute('aria-label', `${prettyDate(k)}, ${list.length} item`);

    let html = `<div class="num"><b>${d.getDate()}</b></div>`;
    html += list.slice(0, CHIPS_PER_CELL).map((it) =>
      `<div class="chip${isDone(it, k) ? ' done' : ''}" style="--c:${cat(it.type).color}">${it.important ? '&#9733; ' : ''}${it.time ? it.time + ' ' : ''}${esc(it.title)}</div>`
    ).join('');
    if (list.length > CHIPS_PER_CELL) html += `<div class="more">+${list.length - CHIPS_PER_CELL} lagi</div>`;
    html += `<div class="dots">${list.slice(0, 6).map((it) => `<i style="--c:${cat(it.type).color}"></i>`).join('')}</div>`;
    cell.innerHTML = html;
    frag.appendChild(cell);
  }
  grid.replaceChildren(frag);
}

function renderDay() {
  $('#dayTitle').textContent = prettyDate(selected);
  $('#daySub').textContent = relDay(selected);

  const all = itemsOn(selected);
  const types = [...new Set(all.map((it) => it.type))];
  if (filter !== 'all' && !types.includes(filter)) filter = 'all';
  $('#filters').innerHTML = types.length > 1
    ? [`<button data-f="all" class="${filter === 'all' ? 'on' : ''}">Semua (${all.length})</button>`,
       ...types.map((t) => `<button data-f="${esc(t)}" class="${filter === t ? 'on' : ''}">${esc(cat(t).label)}</button>`)].join('')
    : '';

  const list = filter === 'all' ? all : all.filter((it) => it.type === filter);
  $('#dayItems').innerHTML = list.length
    ? list.map((it) => itemHtml(it, selected, { focusDate: selected })).join('')
    : `<li class="empty">Belum ada apa pun di tanggal ini.<br>Tekan <b>+ Tambah</b> untuk mulai.</li>`;
}

function renderDayView() {
  const k = selected;
  const today = toKey(new Date());
  $('#dvTitle').textContent = prettyDate(k);
  $('#dvSub').textContent = relDay(k);
  const fl = focusOn(k);
  const list = itemsOn(k).filter((it) => !fl.some((f) => f.id === it.id && f.k === k)); // yang sudah jadi fokus tidak diulang
  const timed = list.filter((it) => it.time);
  const untimed = list.filter((it) => !it.time);

  // Tandai jadwal yang sedang berlangsung dan berikutnya (hanya untuk hari ini)
  const status = new Map();
  if (k === today) {
    const now = nowMin();
    let nextFound = false;
    for (const it of timed) {
      if (toMin(it.time) <= now && now < endMin(it)) status.set(it.id, 'now');
      else if (!nextFound && toMin(it.time) > now) { status.set(it.id, 'next'); nextFound = true; }
    }
  }

  const section = (title, rows, empty) => `<h3 class="sec-title">${title}</h3>` +
    (rows.length ? `<ul class="items">${rows.join('')}</ul>` : `<p class="sec-empty">${empty}</p>`);
  const focusItems = fl.map((f) => ({ it: items.find((x) => x.id === f.id), k: f.k }));
  const fDone = focusItems.filter((f) => isDone(f.it, f.k)).length;
  const fTitle = `Fokus${k === today ? ' hari ini' : ''} <span class="focus-count">${fl.length ? `${fDone}/${fl.length} selesai` : `maks ${FOCUS_MAX}`}</span>`;
  const fEmpty = `Pilih maksimal ${FOCUS_MAX} hal terpenting untuk diselesaikan. Tekan <span class="focus-icon">&#9678;</span> pada tugas mana pun, termasuk deadline di daftar Mendatang.`;
  $('#dvBody').innerHTML =
    `<div class="focus-box${fl.length && fDone === fl.length ? ' all-done' : ''}">` +
    section(fTitle, focusItems.map((f) => itemHtml(f.it, f.k, { focusDate: k, countdown: f.k !== k })), fEmpty) +
    (fl.length && fDone === fl.length ? '<p class="focus-done">Semua fokus selesai. Mantap!</p>' : '') + '</div>' +
    section('Jadwal', timed.map((it) => itemHtml(it, k, { status: status.get(it.id), focusDate: k })), 'Tidak ada jadwal berjam di hari ini.') +
    section('Tugas dan lainnya', untimed.map((it) => itemHtml(it, k, { focusDate: k })), 'Tidak ada tugas tanpa jam di hari ini.');
}

function renderWeek() {
  const start = weekStart(selected);
  const keys = Array.from({ length: 7 }, (_, i) => toKey(addDays(start, i)));
  const today = toKey(new Date());
  const lists = keys.map((k) => itemsOn(k));

  // Rentang jam menyesuaikan isi, minimal 07.00 sampai 18.00
  let minH = 7, maxH = 18;
  for (const l of lists) for (const it of l) if (it.time) {
    minH = Math.min(minH, Math.floor(toMin(it.time) / 60));
    maxH = Math.max(maxH, Math.ceil(Math.min(endMin(it), 1440) / 60));
  }
  const hours = maxH - minH;

  let head = '<div class="wk-corner"></div>';
  let allday = '<div class="wk-label">Tanpa jam</div>';
  let cols = '';
  keys.forEach((k, i) => {
    const d = fromKey(k);
    const cls = [k === today ? 'today' : '', k === selected ? 'selected' : '', d.getDay() === 0 ? 'sunday' : ''].join(' ');
    head += `<button type="button" class="wk-day ${cls}" data-day="${k}"><span>${DAYS[d.getDay()].slice(0, 3)}</span><b>${d.getDate()}</b></button>`;
    allday += `<div class="wk-allday ${cls}">${lists[i].filter((it) => !it.time).map((it) =>
      `<div class="chip${isDone(it, k) ? ' done' : ''}" style="--c:${cat(it.type).color}" data-id="${it.id}" data-key="${k}">${it.important ? '&#9733; ' : ''}${esc(it.title)}</div>`).join('')}</div>`;
    cols += `<div class="wk-col ${cls}" data-key="${k}">${weekEvents(lists[i].filter((it) => it.time), k, minH)}`;
    if (k === today && nowMin() >= minH * 60 && nowMin() < maxH * 60) {
      cols += `<div class="wk-now" style="top:${(nowMin() - minH * 60) / 60 * HOUR_PX}px"></div>`;
    }
    cols += '</div>';
  });
  let times = '';
  for (let h = minH; h < maxH; h++) times += `<div class="wk-time">${pad(h)}.00</div>`;

  $('#weekBody').innerHTML = `<div class="wk" style="--hours:${hours};--hour:${HOUR_PX}px" data-min="${minH}">
    ${head}${allday}<div class="wk-times">${times}</div>${cols}</div>`;

  // Di layar sempit, geser otomatis supaya kolom tanggal terpilih terlihat
  const sc = $('#weekBody');
  if (sc.scrollWidth > sc.clientWidth) {
    const col = sc.querySelector('.wk-day.selected');
    if (col) sc.scrollLeft = col.offsetLeft - 52;
  }
}

// Susun event yang bertumpuk jamnya menjadi beberapa lajur berdampingan
function weekEvents(list, k, minH) {
  const evs = list.map((it) => ({ it, s: toMin(it.time), e: Math.max(endMin(it), toMin(it.time) + 30) }))
    .sort((a, b) => a.s - b.s || a.e - b.e);
  const out = [];
  let cluster = [], clusterEnd = -1;
  const flush = () => {
    const lanes = [];
    for (const ev of cluster) {
      let lane = lanes.findIndex((end) => end <= ev.s);
      if (lane === -1) { lane = lanes.length; lanes.push(0); }
      lanes[lane] = ev.e;
      ev.lane = lane;
    }
    for (const ev of cluster) ev.lanes = lanes.length;
    out.push(...cluster);
    cluster = [];
  };
  for (const ev of evs) {
    if (ev.s >= clusterEnd && cluster.length) flush();
    cluster.push(ev);
    clusterEnd = Math.max(clusterEnd, ev.e);
  }
  if (cluster.length) flush();

  return out.map(({ it, s, e, lane, lanes }) => {
    const top = (s - minH * 60) / 60 * HOUR_PX;
    const height = (e - s) / 60 * HOUR_PX - 2;
    return `<div class="wk-ev${isDone(it, k) ? ' done' : ''}" data-id="${it.id}" data-key="${k}"
      style="--c:${cat(it.type).color};top:${top}px;height:${height}px;left:calc(${lane / lanes * 100}% + 2px);width:calc(${100 / lanes}% - 4px)">
      <b>${it.important ? '&#9733; ' : ''}${esc(it.title)}</b><span>${it.time}${it.endTime ? ' - ' + it.endTime : ''}${it.place ? ' · ' + esc(it.place) : ''}</span></div>`;
  }).join('');
}

function renderUpcoming() {
  const today = toKey(new Date());
  const groups = [];
  // Item yang lewat tanggal tapi belum dicentang
  const overdue = [];
  for (const it of items) {
    if (!it.weekly && cat(it.type).checkable && !it.done && it.date < today) overdue.push(it);
  }
  overdue.sort((a, b) => a.date.localeCompare(b.date));
  if (overdue.length) groups.push({ label: 'Terlewat', rows: overdue.map((it) => itemHtml(it, it.date, { countdown: true, focusDate: today })) });

  for (let i = 0; i <= UPCOMING_DAYS; i++) {
    const k = toKey(addDays(fromKey(today), i));
    const rows = itemsOn(k)
      .filter((it) => !(it.weekly && !cat(it.type).checkable)) // jadwal rutin (kuliah, asistensi) tidak perlu memenuhi daftar ini
      .filter((it) => !isDone(it, k))
      .map((it) => itemHtml(it, k, { countdown: true, focusDate: today }));
    if (rows.length) groups.push({ label: i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : shortDate(k), rows });
  }

  $('#upcomingItems').innerHTML = groups.length
    ? groups.map((g) => `<li class="group-label">${g.label}</li>${g.rows.join('')}`).join('')
    : `<li class="empty">Tidak ada yang mendesak dalam ${UPCOMING_DAYS} hari ke depan. Santai dulu.</li>`;
}

function itemHtml(it, k, opts = {}) {
  const showCountdown = !!opts.countdown;
  const t = cat(it.type);
  const done = isDone(it, k);
  const meta = [];
  meta.push(`<span class="badge" style="--c:${t.color}">${esc(labelOf(it))}</span>`);
  const course = !opts.hideCourse && typeof courseById === 'function' ? courseById(it.courseId) : null;
  if (course) meta.push(`<span class="course-tag" style="--cc:${course.color}">${esc(course.code || course.name)}</span>`);
  if (it.time) meta.push(`<span>${it.time}${it.endTime ? ' - ' + it.endTime : ''}</span>`);
  if (it.place) meta.push(`<span>${esc(it.place)}</span>`);
  if (it.weekly) meta.push(`<span>Tiap ${DAYS[fromKey(it.date).getDay()]}</span>`);
  const subs = it.subtasks || [];
  const subDone = subs.filter((x) => x.done).length;
  if (subs.length) {
    meta.push(`<span class="prog" title="Sub-tugas selesai"><i><b style="width:${subDone / subs.length * 100}%"></b></i>${subDone}/${subs.length}</span>`);
  }
  if (hasRemind(it)) meta.push(`<span title="Pengingat">&#128276; ${REMIND_LABELS[it.remind] || it.remind + ' mnt'}</span>`);
  if (opts.status === 'now') meta.unshift('<span class="status now">Sedang berlangsung</span>');
  if (opts.status === 'next') meta.unshift('<span class="status next">Berikutnya</span>');
  if (showCountdown) {
    const n = diffDays(toKey(new Date()), k);
    const txt = n < 0 ? `Lewat ${-n} hari` : n === 0 ? 'Hari ini' : `H-${n}`;
    meta.push(`<span class="countdown${n > 3 ? ' far' : ''}">${txt}</span>`);
  }
  const canFocus = opts.focusDate && t.checkable;
  const focused = canFocus && isFocused(opts.focusDate, it.id, k);
  return `<li class="item${done ? ' done' : ''}${opts.status ? ' ' + opts.status : ''}" style="--c:${t.color}" data-id="${it.id}" data-key="${k}"${canFocus ? ` data-fd="${opts.focusDate}"` : ''}>
    ${t.checkable ? `<input type="checkbox" ${done ? 'checked' : ''} aria-label="Tandai selesai">` : ''}
    <div class="body">
      <div class="title">${it.important ? '<span class="star" title="Penting">&#9733;</span> ' : ''}${esc(it.title)}</div>
      <div class="meta">${meta.join('')}</div>
      ${subs.length && !showCountdown ? `<ul class="subs">${subs.map((x) =>
        `<li class="${x.done ? 'done' : ''}"><label><input type="checkbox" class="sub-check" data-sub="${esc(x.id)}" ${x.done ? 'checked' : ''}><span>${esc(x.text)}</span></label></li>`).join('')}</ul>` : ''}
      ${it.notes && !showCountdown ? `<div class="notes">${linkify(esc(it.notes))}</div>` : ''}
    </div>
    ${canFocus ? `<button type="button" class="focus-btn${focused ? ' on' : ''}" data-focus title="${focused ? 'Lepas dari fokus' : 'Jadikan fokus'}" aria-label="${focused ? 'Lepas dari fokus' : 'Jadikan fokus'}">${focused ? '&#9673;' : '&#9678;'}</button>` : ''}
  </li>`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function linkify(s) {
  return s.replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener">${u}</a>`);
}

// ---------- Form ----------
let formType = 'todo';
let formSubs = []; // salinan sub-tugas yang sedang diedit di form

function buildTypePicker() {
  $('#typePicker').innerHTML = cats.map((c) =>
    `<button type="button" data-type="${esc(c.id)}" style="--c:${c.color}"><i></i>${esc(c.label)}</button>`).join('')
    + `<button type="button" class="manage" data-manage>+ Kelola kategori</button>`;
}

function setFormType(type, autoRepeat, sub = '') {
  formType = type;
  const c = cat(type);
  for (const b of $('#typePicker').children) b.classList.toggle('on', b.dataset.type === type);
  // Pertahankan jenis lama walaupun sudah dihapus dari daftar kategori
  const subs = sub && !c.subs.includes(sub) ? [...c.subs, sub] : c.subs;
  $('#subWrap').hidden = !subs.length;
  $('#subLabel').textContent = `Jenis ${c.label.toLowerCase()}`;
  $('#subSelect').innerHTML = subs.map((x) => `<option>${esc(x)}</option>`).join('');
  if (sub) form.sub.value = sub;
  if (autoRepeat) form.weekly.checked = c.weekly;
  syncRepeat();
}

function syncRepeat() {
  $('#untilWrap').style.visibility = form.weekly.checked ? 'visible' : 'hidden';
  // Sub-tugas untuk pekerjaan sekali jalan, bukan jadwal rutin
  $('#subtaskWrap').hidden = form.weekly.checked;
}

function renderFormSubs() {
  const done = formSubs.filter((x) => x.done).length;
  $('#subtaskCount').textContent = formSubs.length ? `${done}/${formSubs.length}` : '';
  $('#subtaskList').innerHTML = formSubs.map((x, i) => `<li data-i="${i}">
    <input type="checkbox" ${x.done ? 'checked' : ''} aria-label="Selesai">
    <input class="st-text" value="${esc(x.text)}" maxlength="120" aria-label="Sub-tugas">
    <button type="button" class="icon-btn small" data-up aria-label="Naikkan">&#8593;</button>
    <button type="button" class="icon-btn small danger" data-rm aria-label="Hapus sub-tugas">&#215;</button>
  </li>`).join('');
}

$('#subtaskInput').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault(); // jangan submit form
  const text = e.target.value.trim();
  if (!text) return;
  formSubs.push({ id: uid(), text, done: false });
  e.target.value = '';
  renderFormSubs();
});
$('#subtaskList').addEventListener('input', (e) => {
  const li = e.target.closest('li');
  if (li && e.target.classList.contains('st-text')) formSubs[li.dataset.i].text = e.target.value;
});
$('#subtaskList').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
$('#subtaskList').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const i = Number(li.dataset.i);
  if (e.target.matches('input[type="checkbox"]')) formSubs[i].done = e.target.checked;
  else if (e.target.closest('[data-rm]')) formSubs.splice(i, 1);
  else if (e.target.closest('[data-up]') && i > 0) [formSubs[i - 1], formSubs[i]] = [formSubs[i], formSubs[i - 1]];
  else return;
  renderFormSubs();
});

function openForm(it = null, occurrence = selected, preset = {}) {
  form.reset();
  editing = it ? { id: it.id, occurrence } : null;
  $('#formTitle').textContent = it ? 'Edit item' : 'Tambah item';
  $('#deleteBtn').hidden = !it;
  formSubs = it && it.subtasks ? it.subtasks.map((x) => ({ ...x })) : [];
  renderFormSubs();
  fillCourseSelect(it ? it.courseId : preset.courseId);
  if (it) {
    form.title.value = it.title;
    form.date.value = it.date;
    form.time.value = it.time || '';
    form.endTime.value = it.endTime || '';
    form.place.value = it.place || '';
    form.notes.value = it.notes || '';
    form.weekly.checked = !!it.weekly;
    form.important.checked = !!it.important;
    form.remind.value = hasRemind(it) ? String(it.remind) : '';
    form.until.value = it.until || '';
    setFormType(it.type, false, it.sub);
  } else {
    form.date.value = preset.date || selected;
    form.time.value = preset.time || '';
    const t = preset.type || (filter !== 'all' ? filter : formType);
    setFormType(cats.some((c) => c.id === t) ? t : cats[0].id, true);
    if (preset.weekly !== undefined) { form.weekly.checked = preset.weekly; syncRepeat(); }
    if (preset.title) form.title.value = preset.title;
    if (preset.place) form.place.value = preset.place;
  }
  dialog.showModal();
  if (!it) form.title.focus();
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const title = form.title.value.trim();
  if (!title) return;
  const data = {
    title,
    type: formType,
    sub: $('#subWrap').hidden ? '' : form.sub.value,
    date: form.date.value,
    time: form.time.value,
    endTime: form.endTime.value,
    place: form.place.value.trim(),
    notes: form.notes.value.trim(),
    weekly: form.weekly.checked,
    courseId: form.course.value,
    important: form.important.checked,
    remind: form.remind.value === '' ? '' : Number(form.remind.value),
    updated: Date.now(), // pengingat yang waktunya sudah lewat sebelum disimpan tidak akan dibunyikan
    until: form.weekly.checked ? form.until.value : '',
    subtasks: formSubs.map((x) => ({ ...x, text: x.text.trim() })).filter((x) => x.text),
  };
  // Sub-tugas yang belum di-Enter tetap ikut tersimpan
  const pending = $('#subtaskInput').value.trim();
  if (pending && !data.weekly) data.subtasks.push({ id: uid(), text: pending, done: false });
  $('#subtaskInput').value = '';
  if (data.until && data.until < data.date) { toast('"Sampai tanggal" harus setelah tanggal mulai.'); return; }
  let id;
  if (editing) {
    const it = items.find((x) => x.id === editing.id);
    Object.assign(it, data);
    id = it.id;
  } else {
    id = uid();
    items.push({ id, done: false, created: Date.now(), ...data });
  }
  save();
  dialog.close();
  // Tetap di tanggal terpilih kalau item muncul di sana, kalau tidak pindah ke tanggal item
  if (!itemsOn(selected).some((x) => x.id === id)) selected = data.date;
  view = startOfMonth(fromKey(selected));
  render();
  toast(editing ? 'Perubahan disimpan' : 'Item ditambahkan');
});

$('#cancelBtn').addEventListener('click', () => dialog.close());
form.weekly.addEventListener('change', syncRepeat);
$('#typePicker').addEventListener('click', (e) => {
  if (e.target.closest('[data-manage]')) { openCatManager(); return; }
  const b = e.target.closest('button[data-type]');
  if (b) setFormType(b.dataset.type, !editing);
});

$('#deleteBtn').addEventListener('click', async () => {
  const it = items.find((x) => x.id === editing.id);
  if (it.weekly) {
    const choice = await askRecurringDelete();
    if (choice === 'cancel') return;
    if (choice === 'one') {
      it.skip = [...new Set([...(it.skip || []), editing.occurrence])];
    } else items = items.filter((x) => x.id !== it.id);
  } else {
    if (!confirm(`Hapus "${it.title}"?`)) return;
    items = items.filter((x) => x.id !== it.id);
  }
  save();
  dialog.close();
  render();
  toast('Item dihapus');
});

function askRecurringDelete() {
  const d = $('#confirmDialog');
  return new Promise((resolve) => {
    d.returnValue = 'cancel';
    d.addEventListener('close', () => resolve(d.returnValue || 'cancel'), { once: true });
    d.showModal();
  });
}

// ---------- Interaksi ----------
grid.addEventListener('click', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell) return;
  const k = cell.dataset.key;
  selected = k;
  const d = fromKey(k);
  if (d.getMonth() !== view.getMonth()) view = startOfMonth(d);
  sideTab = 'day';
  showTab('day');
  render();
  if (window.matchMedia('(max-width: 1000px)').matches) $('.side').scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// Double click tanggal = langsung tambah item
grid.addEventListener('dblclick', (e) => { if (e.target.closest('.cell')) openForm(); });

function onListClick(e) {
  const li = e.target.closest('.item');
  if (!li) return;
  const it = items.find((x) => x.id === li.dataset.id);
  if (!it) return;
  if (e.target.closest('[data-focus]')) { toggleFocus(li.dataset.fd, it.id, li.dataset.key); return; }
  if (e.target.classList.contains('sub-check')) {
    const st = (it.subtasks || []).find((x) => x.id === e.target.dataset.sub);
    if (!st) return;
    st.done = e.target.checked;
    save();
    render();
    if (st.done && it.subtasks.every((x) => x.done) && !isDone(it, li.dataset.key)) {
      toast('Semua sub-tugas selesai. Jangan lupa centang tugas utamanya.');
    }
    return;
  }
  // Klik teks sub-tugas diteruskan browser ke checkbox-nya, jangan buka form
  if (e.target.closest('.subs')) return;
  if (e.target.matches('input[type="checkbox"]')) {
    setDone(it, li.dataset.key, e.target.checked);
    save();
    render();
    return;
  }
  if (e.target.closest('a')) return;
  openForm(it, li.dataset.key);
}
$('#dayItems').addEventListener('click', onListClick);
$('#dvBody').addEventListener('click', onListClick);

$('#weekBody').addEventListener('click', (e) => {
  const day = e.target.closest('[data-day]');
  if (day) { selected = day.dataset.day; setMode('day'); return; }
  const ev = e.target.closest('[data-id]');
  if (ev) {
    const it = items.find((x) => x.id === ev.dataset.id);
    if (it) openForm(it, ev.dataset.key);
    return;
  }
  const col = e.target.closest('.wk-col');
  if (col) {
    // Ubah posisi klik menjadi jam, dibulatkan ke 30 menit
    const minH = Number(col.parentElement.dataset.min);
    const y = e.clientY - col.getBoundingClientRect().top;
    const m = Math.min(minH * 60 + Math.floor(y / HOUR_PX * 2) * 30, 23 * 60 + 30);
    selected = col.dataset.key;
    openForm(null, selected, { date: col.dataset.key, time: `${pad(Math.floor(m / 60))}:${pad(m % 60)}` });
    return;
  }
  const allday = e.target.closest('.wk-allday');
  if (allday) {
    const i = [...allday.parentElement.querySelectorAll('.wk-allday')].indexOf(allday);
    const k = toKey(addDays(weekStart(selected), i));
    selected = k;
    openForm(null, k, { date: k });
  }
});
$('#upcomingItems').addEventListener('click', onListClick);

$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  renderDay();
});

for (const b of document.querySelectorAll('[data-add]')) b.addEventListener('click', () => openForm());
$('#prevBtn').addEventListener('click', () => nav(-1));
$('#nextBtn').addEventListener('click', () => nav(1));
$('#mainNav').addEventListener('click', (e) => { const b = e.target.closest('[data-page]'); if (b) setPage(b.dataset.page); });
$('#modeSeg').addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b) setMode(b.dataset.mode); });
$('#todayBtn').addEventListener('click', () => { selected = toKey(new Date()); view = startOfMonth(new Date()); render(); });

function showTab(name) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === name);
  $('#dayPanel').hidden = name !== 'day';
  $('#upcomingPanel').hidden = name !== 'upcoming';
}
for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => { sideTab = t.dataset.tab; showTab(sideTab); });

// Swipe kiri/kanan di tablet untuk pindah bulan atau hari
let touchX = null, touchY = null;
for (const el of [grid, $('#dayView')]) {
  el.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; touchY = e.touches[0].clientY; }, { passive: true });
  el.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    touchX = null;
    if (Math.abs(dx) < 60 || Math.abs(dy) > Math.abs(dx)) return;
    nav(dx < 0 ? 1 : -1);
  });
}

// Shortcut keyboard di laptop
document.addEventListener('keydown', (e) => {
  if (page !== 'cal' || document.querySelector('dialog[open]') || e.target.matches('input, textarea, select')) return;
  if (e.key === 'n') { e.preventDefault(); openForm(); }
  else if (e.key === 'ArrowLeft') nav(-1);
  else if (e.key === 'ArrowRight') nav(1);
  else if (e.key === 't') $('#todayBtn').click();
  else if (e.key === 'h') setMode('day');
  else if (e.key === 'm') setMode('week');
  else if (e.key === 'b') setMode('month');
});

// ---------- Pengingat ----------
function hasRemind(it) { return it.remind !== undefined && it.remind !== null && it.remind !== ''; }
function loadFired() {
  try {
    const data = JSON.parse(localStorage.getItem(FIRED_KEY)) || {};
    const cutoff = Date.now() - 30 * 86400000;
    for (const [key, t] of Object.entries(data)) if (t < cutoff) delete data[key];
    return data;
  } catch { return {}; }
}
let fired = loadFired();

function remindAt(it, k) {
  const d = fromKey(k);
  const t = it.time || '07:00';
  d.setHours(Number(t.slice(0, 2)), Number(t.slice(3, 5)), 0, 0);
  return d.getTime() - Number(it.remind) * 60000;
}

function checkReminders() {
  const now = Date.now();
  let changed = false;
  // H-3 paling jauh, jadi cukup periksa kemunculan sampai 4 hari ke depan
  for (let i = -1; i <= 4; i++) {
    const k = toKey(addDays(new Date(), i));
    for (const it of itemsOn(k)) {
      if (!hasRemind(it) || isDone(it, k)) continue;
      const at = remindAt(it, k);
      const key = `${it.id}|${k}|${it.remind}`;
      // Kalau aplikasi baru dibuka, pengingat yang terlewat kurang dari 12 jam tetap ditampilkan
      if (at <= now && now - at < 12 * 3600000 && at > (it.updated || 0) && !fired[key]) {
        fired[key] = now;
        changed = true;
        notify(it, k, key);
      }
    }
  }
  if (changed) try { localStorage.setItem(FIRED_KEY, JSON.stringify(fired)); } catch {}
}

function notify(it, k, tag) {
  const when = relDay(k) + (it.time ? `, pukul ${it.time}` : '');
  const body = `${labelOf(it)} · ${when}${it.place ? ' · ' + it.place : ''}`;
  showAlert(it, k, body);
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const opts = { body, tag, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' };
  // Notifikasi lewat service worker lebih andal di Android dan aplikasi yang di-install
  (navigator.serviceWorker ? navigator.serviceWorker.getRegistration() : Promise.resolve(null))
    .then((reg) => reg ? reg.showNotification(it.title, opts) : new Notification(it.title, opts))
    .catch(() => { try { new Notification(it.title, opts); } catch {} });
}

function showAlert(it, k, body) {
  const el = document.createElement('div');
  el.className = 'alert';
  el.style.setProperty('--c', cat(it.type).color);
  el.innerHTML = `<div class="alert-icon">&#128276;</div>
    <div class="alert-body"><b>${esc(it.title)}</b><span>${esc(body)}</span></div>
    <div class="alert-actions"><button class="btn small" data-open>Buka</button><button class="btn ghost small" data-close>Tutup</button></div>`;
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-open]')) {
      const cur = items.find((x) => x.id === it.id);
      if (cur) openForm(cur, k);
      el.remove();
    } else if (e.target.closest('[data-close]')) el.remove();
  });
  $('#alerts').appendChild(el);
}

function updateNotifBtn() {
  const b = $('#notifBtn');
  if (!('Notification' in window)) { b.textContent = 'Notifikasi: tidak didukung browser ini'; return; }
  b.textContent = { granted: 'Notifikasi: aktif (kirim tes)', denied: 'Notifikasi: diblokir browser', default: 'Aktifkan notifikasi' }[Notification.permission];
}

async function askNotifPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (Notification.permission === 'default') {
    try { await Notification.requestPermission(); } catch {}
  }
  updateNotifBtn();
  return Notification.permission;
}

$('#notifBtn').addEventListener('click', async () => {
  menu.hidden = true;
  const perm = await askNotifPermission();
  if (perm === 'granted') {
    notify({ id: 'test', title: 'Notifikasi aktif', type: cats[0].id, time: '' }, toKey(new Date()), 'test');
  } else if (perm === 'denied') {
    toast('Notifikasi diblokir. Izinkan lewat pengaturan situs di browser.');
  } else if (perm === 'unsupported') {
    toast('Browser ini tidak mendukung notifikasi. Pengingat tetap muncul di dalam aplikasi.');
  }
});

// Minta izin notifikasi saat pertama kali memasang pengingat
form.remind.addEventListener('change', () => { if (form.remind.value !== '') askNotifPermission(); });

// ---------- Kelola kategori ----------
const catDialog = $('#catDialog');

function catRowHtml(c) {
  return `<div class="cat-row" data-id="${esc(c.id)}">
    <input type="color" class="cat-color" value="${c.color}" aria-label="Warna">
    <input class="cat-name" value="${esc(c.label)}" maxlength="40" placeholder="Nama kategori" aria-label="Nama kategori">
    <span class="cat-move">
      <button type="button" class="icon-btn small" data-move="-1" aria-label="Naikkan">&#8593;</button>
      <button type="button" class="icon-btn small" data-move="1" aria-label="Turunkan">&#8595;</button>
      <button type="button" class="icon-btn small danger" data-del aria-label="Hapus kategori">&#215;</button>
    </span>
    <input class="cat-subs" value="${esc(c.subs.join(', '))}" maxlength="300" placeholder="Jenis (opsional), pisahkan dengan koma. Contoh: UTS, UAS, Kuis" aria-label="Jenis">
    <div class="cat-flags">
      <label class="check"><input type="checkbox" class="cat-check" ${c.checkable ? 'checked' : ''}> Bisa dicentang selesai</label>
      <label class="check"><input type="checkbox" class="cat-weekly" ${c.weekly ? 'checked' : ''}> Otomatis ulangi tiap minggu</label>
    </div>
  </div>`;
}

function openCatManager() {
  menu.hidden = true;
  $('#catList').innerHTML = cats.map(catRowHtml).join('');
  catDialog.showModal();
}

$('#catList').addEventListener('click', (e) => {
  const row = e.target.closest('.cat-row');
  if (!row) return;
  const mv = e.target.closest('[data-move]');
  if (mv) {
    const sib = mv.dataset.move === '-1' ? row.previousElementSibling : row.nextElementSibling;
    if (sib) mv.dataset.move === '-1' ? sib.before(row) : sib.after(row);
    return;
  }
  if (e.target.closest('[data-del]')) row.remove();
});

$('#addCatBtn').addEventListener('click', () => {
  const palette = ['#0ea5e9', '#ef4444', '#f97316', '#8b5cf6', '#10b981', '#eab308', '#ec4899', '#14b8a6', '#6366f1', '#84cc16'];
  const c = cleanCat({ id: uid(), label: '', color: palette[$('#catList').children.length % palette.length], checkable: true });
  $('#catList').insertAdjacentHTML('beforeend', catRowHtml(c));
  const row = $('#catList').lastElementChild;
  row.scrollIntoView({ block: 'nearest' });
  row.querySelector('.cat-name').focus();
});

$('#catCancel').addEventListener('click', () => catDialog.close());

$('#catForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const next = [...$('#catList').children].map((row) => cleanCat({
    id: row.dataset.id,
    label: row.querySelector('.cat-name').value,
    color: row.querySelector('.cat-color').value,
    checkable: row.querySelector('.cat-check').checked,
    weekly: row.querySelector('.cat-weekly').checked,
    subs: row.querySelector('.cat-subs').value.split(','),
  }));
  if (!next.length) { toast('Minimal harus ada satu kategori.'); return; }
  const kept = new Set(next.map((c) => c.id));
  const orphaned = items.filter((it) => cats.some((c) => c.id === it.type) && !kept.has(it.type));
  if (orphaned.length && !confirm(`${orphaned.length} item ada di kategori yang dihapus. Item tetap tersimpan sebagai "Tanpa kategori" dan bisa kamu pindahkan lewat edit. Lanjut?`)) return;
  cats = next;
  saveCats();
  buildTypePicker();
  renderLegend();
  render();
  // Kalau dibuka dari form tambah/edit, segarkan pilihan kategori di form
  if (dialog.open) {
    const same = kept.has(formType);
    setFormType(same ? formType : cats[0].id, false, same && !$('#subWrap').hidden ? form.sub.value : '');
  }
  catDialog.close();
  toast('Kategori disimpan');
});

// ---------- Menu: backup & tema ----------
const menu = $('#menu');
$('#menuBtn').addEventListener('click', (e) => { e.stopPropagation(); menu.hidden = !menu.hidden; });
document.addEventListener('click', (e) => { if (!menu.contains(e.target)) menu.hidden = true; });

$('#exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ app: 'elio-planner', version: 2, exported: new Date().toISOString(), categories: cats, focus, courses, items }, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `planner-backup-${toKey(new Date())}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  menu.hidden = true;
});

$('#catBtn').addEventListener('click', openCatManager);
$('#importBtn').addEventListener('click', () => { $('#importFile').click(); menu.hidden = true; });
$('#importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    const incoming = Array.isArray(data) ? data : data.items;
    if (!Array.isArray(incoming)) throw new Error('format');
    if (Array.isArray(data.categories)) {
      const byCat = new Map(cats.map((c) => [c.id, c]));
      for (const c of data.categories) if (c && c.id) byCat.set(String(c.id), cleanCat(c));
      cats = [...byCat.values()];
      saveCats();
      buildTypePicker();
      renderLegend();
    }
    if (Array.isArray(data.courses)) {
      const byCourse = new Map(courses.map((c) => [c.id, c]));
      for (const c of data.courses) if (c && c.id) byCourse.set(String(c.id), cleanCourse(c));
      courses = [...byCourse.values()];
      saveCourses();
    }
    if (data.focus && typeof data.focus === 'object') {
      for (const [d, list] of Object.entries(data.focus)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !Array.isArray(list)) continue;
        const merged = [...(focus[d] || [])];
        for (const f of list) if (f && f.id && f.k && !merged.some((x) => x.id === f.id && x.k === f.k)) merged.push({ id: String(f.id), k: String(f.k) });
        focus[d] = merged.slice(0, FOCUS_MAX);
      }
      saveFocus();
    }
    const valid = incoming.filter((it) => it && it.id && it.title && /^\d{4}-\d{2}-\d{2}$/.test(it.date));
    const byId = new Map(items.map((it) => [it.id, it]));
    for (const it of valid) byId.set(it.id, it);
    items = [...byId.values()];
    save();
    render();
    toast(`${valid.length} item diimpor`);
  } catch {
    toast('File backup tidak valid');
  }
});

function applyTheme(t) {
  if (t) document.documentElement.dataset.theme = t;
  else delete document.documentElement.dataset.theme;
}
$('#themeBtn').addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme
    ? document.documentElement.dataset.theme === 'dark'
    : window.matchMedia('(prefers-color-scheme: dark)').matches;
  const next = dark ? 'light' : 'dark';
  applyTheme(next);
  try { localStorage.setItem(THEME_KEY, next); } catch {}
  menu.hidden = true;
});

// ---------- Toast ----------
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

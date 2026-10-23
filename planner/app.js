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
const UPCOMING_DAYS = 14;
const CHIPS_PER_CELL = 3;

// ---------- State ----------
let items = load();
let cats = loadCats();
let view = startOfMonth(new Date());
let selected = toKey(new Date());
let filter = 'all';
let editing = null; // { id, occurrence } saat edit

// ---------- Util tanggal ----------
function pad(n) { return String(n).padStart(2, '0'); }
function toKey(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fromKey(k) { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); }
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
function diffDays(a, b) { return Math.round((fromKey(b) - fromKey(a)) / 86400000); }
function prettyDate(k) { const d = fromKey(k); return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function shortDate(k) { const d = fromKey(k); return `${DAYS[d.getDay()].slice(0, 3)}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; }

// ---------- Penyimpanan ----------
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
  const ta = a.time || '99:99', tb = b.time || '99:99';
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
  renderCalendar();
  renderDay();
  renderUpcoming();
}

function renderLegend() {
  $('#legend').innerHTML = cats
    .map((c) => `<span><i style="background:${c.color}"></i>${esc(c.label)}</span>`).join('');
  $('#weekdays').innerHTML = WEEK_ORDER.map((d) => `<div>${DAYS[d].slice(0, 3)}</div>`).join('');
}

function renderCalendar() {
  $('#monthLabel').textContent = `${MONTHS[view.getMonth()]} ${view.getFullYear()}`;
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
      `<div class="chip${isDone(it, k) ? ' done' : ''}" style="--c:${cat(it.type).color}">${it.time ? it.time + ' ' : ''}${esc(it.title)}</div>`
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
  const n = diffDays(toKey(new Date()), selected);
  $('#daySub').textContent = n === 0 ? 'Hari ini' : n === 1 ? 'Besok' : n === -1 ? 'Kemarin' : n > 0 ? `${n} hari lagi` : `${-n} hari yang lalu`;

  const all = itemsOn(selected);
  const types = [...new Set(all.map((it) => it.type))];
  if (filter !== 'all' && !types.includes(filter)) filter = 'all';
  $('#filters').innerHTML = types.length > 1
    ? [`<button data-f="all" class="${filter === 'all' ? 'on' : ''}">Semua (${all.length})</button>`,
       ...types.map((t) => `<button data-f="${esc(t)}" class="${filter === t ? 'on' : ''}">${esc(cat(t).label)}</button>`)].join('')
    : '';

  const list = filter === 'all' ? all : all.filter((it) => it.type === filter);
  $('#dayItems').innerHTML = list.length
    ? list.map((it) => itemHtml(it, selected)).join('')
    : `<li class="empty">Belum ada apa pun di tanggal ini.<br>Tekan <b>+ Tambah</b> untuk mulai.</li>`;
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
  if (overdue.length) groups.push({ label: 'Terlewat', rows: overdue.map((it) => itemHtml(it, it.date, true)) });

  for (let i = 0; i <= UPCOMING_DAYS; i++) {
    const k = toKey(addDays(fromKey(today), i));
    const rows = itemsOn(k)
      .filter((it) => !(it.weekly && !cat(it.type).checkable)) // jadwal rutin (kuliah, asistensi) tidak perlu memenuhi daftar ini
      .filter((it) => !isDone(it, k))
      .map((it) => itemHtml(it, k, true));
    if (rows.length) groups.push({ label: i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : shortDate(k), rows });
  }

  $('#upcomingItems').innerHTML = groups.length
    ? groups.map((g) => `<li class="group-label">${g.label}</li>${g.rows.join('')}`).join('')
    : `<li class="empty">Tidak ada yang mendesak dalam ${UPCOMING_DAYS} hari ke depan. Santai dulu.</li>`;
}

function itemHtml(it, k, showCountdown = false) {
  const t = cat(it.type);
  const done = isDone(it, k);
  const meta = [];
  meta.push(`<span class="badge" style="--c:${t.color}">${esc(labelOf(it))}</span>`);
  if (it.time) meta.push(`<span>${it.time}${it.endTime ? ' - ' + it.endTime : ''}</span>`);
  if (it.place) meta.push(`<span>${esc(it.place)}</span>`);
  if (it.weekly) meta.push(`<span>Tiap ${DAYS[fromKey(it.date).getDay()]}</span>`);
  if (showCountdown) {
    const n = diffDays(toKey(new Date()), k);
    const txt = n < 0 ? `Lewat ${-n} hari` : n === 0 ? 'Hari ini' : `H-${n}`;
    meta.push(`<span class="countdown${n > 3 ? ' far' : ''}">${txt}</span>`);
  }
  return `<li class="item${done ? ' done' : ''}" style="--c:${t.color}" data-id="${it.id}" data-key="${k}">
    ${t.checkable ? `<input type="checkbox" ${done ? 'checked' : ''} aria-label="Tandai selesai">` : ''}
    <div class="body">
      <div class="title">${esc(it.title)}</div>
      <div class="meta">${meta.join('')}</div>
      ${it.notes && !showCountdown ? `<div class="notes">${linkify(esc(it.notes))}</div>` : ''}
    </div>
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

function syncRepeat() { $('#untilWrap').style.visibility = form.weekly.checked ? 'visible' : 'hidden'; }

function openForm(it = null, occurrence = selected) {
  form.reset();
  editing = it ? { id: it.id, occurrence } : null;
  $('#formTitle').textContent = it ? 'Edit item' : 'Tambah item';
  $('#deleteBtn').hidden = !it;
  if (it) {
    form.title.value = it.title;
    form.date.value = it.date;
    form.time.value = it.time || '';
    form.endTime.value = it.endTime || '';
    form.place.value = it.place || '';
    form.notes.value = it.notes || '';
    form.weekly.checked = !!it.weekly;
    form.until.value = it.until || '';
    setFormType(it.type, false, it.sub);
  } else {
    form.date.value = selected;
    const t = filter !== 'all' ? filter : formType;
    setFormType(cats.some((c) => c.id === t) ? t : cats[0].id, true);
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
    until: form.weekly.checked ? form.until.value : '',
  };
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
$('#upcomingItems').addEventListener('click', onListClick);

$('#filters').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-f]');
  if (!b) return;
  filter = b.dataset.f;
  renderDay();
});

$('#addBtn').addEventListener('click', () => openForm());
$('#prevMonth').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() - 1, 1); renderCalendar(); });
$('#nextMonth').addEventListener('click', () => { view = new Date(view.getFullYear(), view.getMonth() + 1, 1); renderCalendar(); });
$('#todayBtn').addEventListener('click', () => { selected = toKey(new Date()); view = startOfMonth(new Date()); render(); });

function showTab(name) {
  for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t.dataset.tab === name);
  $('#dayPanel').hidden = name !== 'day';
  $('#upcomingPanel').hidden = name !== 'upcoming';
}
for (const t of document.querySelectorAll('.tab')) t.addEventListener('click', () => showTab(t.dataset.tab));

// Swipe kiri/kanan di tablet untuk ganti bulan
let touchX = null;
grid.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
grid.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) < 60) return;
  view = new Date(view.getFullYear(), view.getMonth() + (dx < 0 ? 1 : -1), 1);
  renderCalendar();
});

// Shortcut keyboard di laptop
document.addEventListener('keydown', (e) => {
  if (dialog.open || e.target.matches('input, textarea, select')) return;
  if (e.key === 'n') { e.preventDefault(); openForm(); }
  else if (e.key === 'ArrowLeft') $('#prevMonth').click();
  else if (e.key === 'ArrowRight') $('#nextMonth').click();
  else if (e.key === 't') $('#todayBtn').click();
});

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
  const blob = new Blob([JSON.stringify({ app: 'elio-planner', version: 2, exported: new Date().toISOString(), categories: cats, items }, null, 2)], { type: 'application/json' });
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

// ---------- Init ----------
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch {}
buildTypePicker();
renderLegend();
render();

// Ganti hari otomatis kalau aplikasi dibiarkan terbuka melewati tengah malam
let lastDay = toKey(new Date());
setInterval(() => {
  const now = toKey(new Date());
  if (now !== lastDay) { lastDay = now; render(); }
}, 60000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

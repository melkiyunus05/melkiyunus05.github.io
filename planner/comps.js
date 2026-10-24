'use strict';
// ---------- Pelacak lomba ----------
// Tiap lomba punya tahap (Incar, Persiapan, Menunggu hasil, Selesai), tanggal penting, dan checklist.
// Tanggal penting otomatis dibuatkan item kalender (compId + compDateId) supaya ikut muncul di
// kalender, daftar Mendatang, Fokus, dan pengingat.

const COMPS_KEY = 'elio-planner-comps-v1';
const STAGES = [
  { id: 'incar', label: 'Incar', hint: 'Lomba yang mau diikuti' },
  { id: 'persiapan', label: 'Persiapan', hint: 'Sudah daftar, sedang dikerjakan' },
  { id: 'menunggu', label: 'Menunggu hasil', hint: 'Karya sudah dikirim' },
  { id: 'selesai', label: 'Selesai', hint: 'Hasil sudah keluar' },
];
const DATE_KINDS = {
  deadline: { label: 'Deadline', cat: 'deadline', sub: 'Lomba', remind: 1440 },
  pengumuman: { label: 'Pengumuman', cat: 'pengumuman' },
  acara: { label: 'Acara', cat: 'acara' },
};
// Tanggal yang paling sering ada di guidebook, disiapkan sebagai baris kosong saat menambah lomba baru
const DATE_TEMPLATE = [['Batas pendaftaran', 'deadline'], ['Pengumpulan karya', 'deadline'], ['Pengumuman', 'pengumuman']];

let comps = loadComps();

function cleanComp(c) {
  return {
    id: String(c.id || uid()),
    name: String(c.name || '').trim().slice(0, 100) || 'Lomba',
    organizer: String(c.organizer || '').trim().slice(0, 100),
    field: String(c.field || '').trim().slice(0, 40),
    stage: STAGES.some((s) => s.id === c.stage) ? c.stage : 'incar',
    result: String(c.result || '').trim().slice(0, 60),
    link: c.link ? safeUrl(c.link) : '',
    fee: String(c.fee || '').trim().slice(0, 40),
    team: String(c.team || '').trim().slice(0, 200),
    notes: String(c.notes || '').slice(0, 3000),
    dates: Array.isArray(c.dates) ? c.dates.map((d) => ({
      id: String(d.id || uid()),
      label: String(d.label || '').trim().slice(0, 60),
      kind: DATE_KINDS[d.kind] ? d.kind : 'deadline',
      date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : '',
      time: /^\d{2}:\d{2}$/.test(d.time) ? d.time : '',
    })).filter((d) => d.label || d.date) : [],
    checklist: Array.isArray(c.checklist) ? c.checklist.map((x) => ({
      id: String(x.id || uid()), text: String(x.text || '').trim().slice(0, 120), done: !!x.done,
    })).filter((x) => x.text) : [],
    created: c.created || Date.now(),
    updated: c.updated || Date.now(),
  };
}
function loadComps() {
  try {
    const data = JSON.parse(localStorage.getItem(COMPS_KEY));
    return Array.isArray(data) ? data.map(cleanComp) : [];
  } catch { return []; }
}
function saveComps() {
  try { localStorage.setItem(COMPS_KEY, JSON.stringify(comps)); }
  catch { toast('Gagal menyimpan data lomba.'); }
  cloudDirty();
}
function compById(id) { return id ? comps.find((c) => c.id === id) : null; }

// ---------- Sinkron ke kalender ----------
function kindCat(kind) {
  const want = DATE_KINDS[kind].cat;
  if (cats.some((c) => c.id === want)) return want;
  const alt = kind === 'deadline' ? cats.find((c) => c.checkable) : null;
  return (alt || cats[0]).id;
}

function syncCompItems(comp) {
  const existing = items.filter((it) => it.compId === comp.id);
  const keep = new Set();
  for (const d of comp.dates) {
    if (!d.date) continue;
    const k = DATE_KINDS[d.kind];
    const data = {
      title: `${d.label || k.label} · ${comp.name}`,
      type: kindCat(d.kind),
      sub: k.sub && cat(kindCat(d.kind)).subs.includes(k.sub) ? k.sub : '',
      date: d.date,
      time: d.time,
      compId: comp.id,
      compDateId: d.id,
    };
    const it = existing.find((x) => x.compDateId === d.id);
    if (it) {
      // Status selesai, sub-tugas, pengingat, dan catatan yang diatur di kalender tetap dipertahankan
      if (it.date !== d.date || it.time !== d.time) it.updated = Date.now();
      Object.assign(it, data);
      keep.add(it.id);
    } else {
      const id = uid();
      items.push({
        id, done: false, created: Date.now(), updated: Date.now(), endTime: '', place: '', weekly: false,
        notes: `Dari pelacak lomba.${comp.link ? ' Guidebook: ' + comp.link : ''}`,
        remind: k.remind ?? '', ...data,
      });
      keep.add(id);
    }
  }
  items = items.filter((it) => it.compId !== comp.id || keep.has(it.id));
  save();
}

// Saat lomba maju tahap, deadline yang pasti sudah dilalui dicentang otomatis supaya tidak menumpuk
// di daftar "Terlewat": deadline yang tanggalnya lewat, semua deadline saat karya sudah dikirim
// (Menunggu hasil), dan semua tanggal saat lomba Selesai.
function autoCompleteCompItems(comp) {
  const today = toKey(new Date());
  const submitted = stageIndex(comp.stage) >= stageIndex('menunggu');
  for (const it of items) {
    if (it.compId !== comp.id || it.done) continue;
    const deadline = cat(it.type).checkable;
    if (comp.stage === 'selesai' || (deadline && (submitted || it.date < today))) it.done = true;
  }
  save();
}
function stageIndex(id) { return STAGES.findIndex((s) => s.id === id); }

// Dipanggil dari app.js saat item kalender milik lomba diubah atau dihapus
function onCompItemSaved(it) {
  const comp = compById(it.compId);
  const d = comp && comp.dates.find((x) => x.id === it.compDateId);
  if (!d) return;
  d.date = it.date;
  d.time = it.time;
  saveComps();
}
function onCompItemDeleted(it) {
  const comp = compById(it.compId);
  if (!comp) return;
  comp.dates = comp.dates.filter((x) => x.id !== it.compDateId);
  saveComps();
}
function compFormNote(it) {
  const comp = it && compById(it.compId);
  $('#formNote').hidden = !comp;
  if (comp) $('#formNote').textContent = `Dibuat otomatis dari lomba "${comp.name}". Perubahan tanggal di sini ikut tersimpan di halaman Lomba.`;
}

// ---------- Render ----------
function nextCompDate(comp) {
  const today = toKey(new Date());
  return comp.dates.filter((d) => d.date && d.date >= today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null;
}

function renderComps() {
  const running = comps.filter((c) => c.stage !== 'selesai').length;
  const finished = comps.length - running;
  let html = `<div class="page-head">
      <div><h2>Pelacak lomba</h2><p class="page-sub">${comps.length
        ? `${running} lomba berjalan · ${finished} selesai`
        : 'Pantau lomba dari incar sampai pengumuman, lengkap dengan tanggal penting dan berkas.'}</p></div>
      <button class="btn primary" data-new-comp>+ Lomba</button>
    </div>`;
  if (!comps.length) {
    html += `<div class="card empty-state">
      <h3>Belum ada lomba</h3>
      <p>Alurnya sederhana:</p>
      <ul>
        <li><b>Incar</b>: simpan lomba yang menarik beserta link guidebook dan batas pendaftaran</li>
        <li><b>Persiapan</b>: sudah daftar, kerjakan karya dan centang checklist berkas</li>
        <li><b>Menunggu hasil</b>: karya sudah dikirim, tinggal tunggu pengumuman</li>
        <li><b>Selesai</b>: catat hasilnya sebagai rekam jejak prestasi</li>
      </ul>
      <p>Tanggal penting otomatis masuk ke kalender, dan deadline diberi pengingat H-1.</p>
      <button class="btn primary" data-new-comp>+ Tambah lomba pertama</button>
    </div>`;
    $('#compsPage').innerHTML = html;
    return;
  }
  html += '<div class="board">';
  for (const [si, s] of STAGES.entries()) {
    let list = comps.filter((c) => c.stage === s.id);
    list = s.id === 'selesai'
      ? list.sort((a, b) => b.updated - a.updated)
      : list.sort((a, b) => ((nextCompDate(a) || {}).date || '9999').localeCompare((nextCompDate(b) || {}).date || '9999'));
    html += `<section class="board-col">
      <div class="col-head"><b>${s.label}</b><span class="col-count">${list.length}</span></div>
      <div class="col-hint">${s.hint}</div>
      ${list.map((c) => compCardHtml(c, si)).join('') || '<div class="col-empty">Kosong</div>'}
    </section>`;
  }
  $('#compsPage').innerHTML = html + '</div>';
}

function compCardHtml(c, si) {
  const today = toKey(new Date());
  const nd = nextCompDate(c);
  const done = c.checklist.filter((x) => x.done).length;
  const meta = [c.organizer, c.field].filter(Boolean).map(esc).join(' · ');
  let next = '';
  if (nd) {
    const n = diffDays(today, nd.date);
    const k = DATE_KINDS[nd.kind];
    next = `<div class="cp-next"><span class="badge" style="--c:${cat(kindCat(nd.kind)).color}">${esc(nd.label || k.label)}</span>
      <span>${shortDate(nd.date)}${nd.time ? ', ' + nd.time : ''}</span>
      <span class="countdown${n > 3 ? ' far' : ''}">${n === 0 ? 'Hari ini' : 'H-' + n}</span></div>`;
  } else if (c.stage !== 'selesai') next = '<div class="cp-next muted">Belum ada tanggal mendatang</div>';
  if (c.stage === 'selesai') next = '';
  return `<div class="comp-card" data-comp="${c.id}" tabindex="0" role="button">
    <div class="cp-title">${esc(c.name)}</div>
    ${meta ? `<div class="cp-meta">${meta}</div>` : ''}
    ${c.stage === 'selesai' && c.result ? `<div class="cp-result">${esc(c.result)}</div>` : ''}
    ${next}
    ${c.checklist.length ? `<div class="cp-row"><span class="prog" style="--c:var(--accent)"><i><b style="width:${done / c.checklist.length * 100}%"></b></i>${done}/${c.checklist.length} berkas</span></div>` : ''}
    ${c.team ? `<div class="cp-row muted">Tim: ${esc(c.team)}</div>` : ''}
    <div class="cp-move">
      ${si > 0 ? `<button type="button" class="btn ghost small" data-move="-1" aria-label="Pindah ke ${STAGES[si - 1].label}">&#8249; ${STAGES[si - 1].label}</button>` : '<span></span>'}
      ${si < STAGES.length - 1 ? `<button type="button" class="btn small" data-move="1" aria-label="Pindah ke ${STAGES[si + 1].label}">${STAGES[si + 1].label} &#8250;</button>` : ''}
    </div>
  </div>`;
}

// ---------- Form lomba ----------
const compDialog = $('#compDialog');
const compForm = $('#compForm');
let editingCompId = null;
let draftDates = [];
let draftChecks = [];

function openCompForm(c = null, focusResult = false) {
  compForm.reset();
  editingCompId = c ? c.id : null;
  $('#compFormTitle').textContent = c ? 'Edit lomba' : 'Tambah lomba';
  $('#compDeleteBtn').hidden = !c;
  compForm.stage.innerHTML = STAGES.map((s) => `<option value="${s.id}">${s.label}</option>`).join('');
  for (const f of ['name', 'organizer', 'field', 'result', 'link', 'fee', 'team', 'notes']) compForm[f].value = c ? c[f] : '';
  compForm.stage.value = c ? c.stage : 'incar';
  draftDates = c ? c.dates.map((d) => ({ ...d })) : DATE_TEMPLATE.map(([label, kind]) => ({ id: uid(), label, kind, date: '', time: '' }));
  draftChecks = c ? c.checklist.map((x) => ({ ...x })) : [];
  syncResultField();
  renderDraftDates();
  renderDraftChecks();
  renderCompFiles();
  compDialog.showModal();
  if (focusResult) compForm.result.focus();
  else if (!c) compForm.name.focus();
}

function syncResultField() { $('#resultWrap').hidden = compForm.stage.value !== 'selesai'; }
compForm.stage.addEventListener('change', syncResultField);

function renderDraftDates() {
  $('#compDates').innerHTML = draftDates.map((d, i) => `<li data-i="${i}">
    <input data-f="label" value="${esc(d.label)}" maxlength="60" placeholder="mis. Technical meeting" aria-label="Nama tanggal">
    <select data-f="kind" aria-label="Jenis">${Object.entries(DATE_KINDS).map(([k, v]) => `<option value="${k}" ${k === d.kind ? 'selected' : ''}>${v.label}</option>`).join('')}</select>
    <input data-f="date" type="date" value="${d.date}" aria-label="Tanggal">
    <input data-f="time" type="time" value="${d.time}" aria-label="Jam (opsional)">
    <button type="button" class="icon-btn small danger" data-rm aria-label="Hapus tanggal">&#215;</button>
  </li>`).join('');
}
$('#compDates').addEventListener('input', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li && e.target.dataset.f) draftDates[li.dataset.i][e.target.dataset.f] = e.target.value;
});
$('#compDates').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li && e.target.closest('[data-rm]')) { draftDates.splice(Number(li.dataset.i), 1); renderDraftDates(); }
});
$('#addCompDate').addEventListener('click', () => {
  draftDates.push({ id: uid(), label: '', kind: 'deadline', date: '', time: '' });
  renderDraftDates();
  $('#compDates').lastElementChild.querySelector('input').focus();
});

function renderDraftChecks() {
  const done = draftChecks.filter((x) => x.done).length;
  $('#compCheckCount').textContent = draftChecks.length ? `${done}/${draftChecks.length}` : '';
  $('#compChecklist').innerHTML = draftChecks.map((x, i) => `<li data-i="${i}">
    <input type="checkbox" ${x.done ? 'checked' : ''} aria-label="Selesai">
    <input class="st-text" value="${esc(x.text)}" maxlength="120" aria-label="Item checklist">
    <button type="button" class="icon-btn small danger" data-rm aria-label="Hapus">&#215;</button>
  </li>`).join('');
}
$('#compCheckInput').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  e.preventDefault();
  const text = e.target.value.trim();
  if (!text) return;
  draftChecks.push({ id: uid(), text, done: false });
  e.target.value = '';
  renderDraftChecks();
});
$('#compChecklist').addEventListener('input', (e) => {
  const li = e.target.closest('li[data-i]');
  if (li && e.target.classList.contains('st-text')) draftChecks[li.dataset.i].text = e.target.value;
});
$('#compChecklist').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.preventDefault(); });
$('#compChecklist').addEventListener('click', (e) => {
  const li = e.target.closest('li[data-i]');
  if (!li) return;
  const i = Number(li.dataset.i);
  if (e.target.matches('input[type="checkbox"]')) draftChecks[i].done = e.target.checked;
  else if (e.target.closest('[data-rm]')) draftChecks.splice(i, 1);
  else return;
  renderDraftChecks();
});

compForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = compForm.name.value.trim();
  if (!name) return;
  const pending = $('#compCheckInput').value.trim();
  if (pending) draftChecks.push({ id: uid(), text: pending, done: false });
  $('#compCheckInput').value = '';
  const old = compById(editingCompId);
  const comp = cleanComp({
    ...(old || {}),
    name,
    organizer: compForm.organizer.value,
    field: compForm.field.value,
    stage: compForm.stage.value,
    result: compForm.result.value,
    link: compForm.link.value,
    fee: compForm.fee.value,
    team: compForm.team.value,
    notes: compForm.notes.value,
    dates: draftDates,
    checklist: draftChecks,
    updated: Date.now(),
  });
  const movedForward = old && stageIndex(comp.stage) > stageIndex(old.stage);
  if (old) Object.assign(old, comp);
  else comps.push(comp);
  saveComps();
  syncCompItems(old || comp);
  if (movedForward) autoCompleteCompItems(old);
  compDialog.close();
  render();
  const n = comp.dates.filter((d) => d.date).length;
  toast(old ? 'Lomba disimpan' : `Lomba ditambahkan${n ? `, ${n} tanggal masuk kalender` : ''}`);
});

$('#compCancelBtn').addEventListener('click', () => compDialog.close());
$('#compDeleteBtn').addEventListener('click', () => {
  const c = compById(editingCompId);
  const n = items.filter((it) => it.compId === c.id).length;
  if (!confirm(`Hapus lomba "${c.name}"?${n ? ` ${n} tanggalnya di kalender juga ikut dihapus.` : ''}`)) return;
  items = items.filter((it) => it.compId !== c.id);
  save();
  comps = comps.filter((x) => x.id !== c.id);
  saveComps();
  compDialog.close();
  render();
  toast('Lomba dihapus');
});

// ---------- Interaksi papan ----------
const compsPage = $('#compsPage');
compsPage.addEventListener('click', (e) => {
  if (e.target.closest('[data-new-comp]')) { openCompForm(); return; }
  const card = e.target.closest('[data-comp]');
  if (!card) return;
  const c = compById(card.dataset.comp);
  const mv = e.target.closest('[data-move]');
  if (mv) {
    const i = stageIndex(c.stage) + Number(mv.dataset.move);
    c.stage = STAGES[i].id;
    c.updated = Date.now();
    saveComps();
    if (mv.dataset.move === '1') autoCompleteCompItems(c);
    render();
    if (c.stage === 'selesai') { openCompForm(c, true); toast('Catat hasilnya, ya.'); }
    else toast(`Dipindah ke ${STAGES[i].label}`);
    return;
  }
  openCompForm(c);
});
compsPage.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('[data-comp]')) openCompForm(compById(e.target.dataset.comp));
});

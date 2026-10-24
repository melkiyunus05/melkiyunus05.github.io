'use strict';
// ---------- File (lampiran tugas, matkul, lomba) ----------
// Isi file disimpan di Supabase Storage (folder milik akun sendiri), sedangkan datanya (nama, jenis,
// ukuran, tautan ke tugas/matkul/lomba) adalah record biasa yang ikut tersinkron.
// File yang dilampirkan ke tugas otomatis muncul di halaman matkul atau lomba dari tugas itu.

const FILE_KINDS_KEY = 'elio-planner-filekinds-v1';
const FILES_KEY = 'elio-planner-files-v1';
const MAX_FILE = 50 * 1024 * 1024; // batas per file paket gratis Supabase
const DEFAULT_FILE_KINDS = [
  ['soal', 'Soal / tugas'], ['jawaban', 'Jawaban saya'], ['materi', 'Slide & materi'], ['modul', 'Modul praktikum'],
  ['guidebook', 'Guidebook lomba'], ['berkas', 'Berkas pendaftaran'], ['sertifikat', 'Sertifikat'], ['lainnya', 'Lainnya'],
];

let fileKinds = readJSON(FILE_KINDS_KEY, null);
if (!Array.isArray(fileKinds) || !fileKinds.length) fileKinds = DEFAULT_FILE_KINDS.map(([id, label]) => ({ id, label }));
let files = readJSON(FILES_KEY, []);
if (!Array.isArray(files)) files = [];
let stagedFiles = []; // file yang dipilih di form item, diunggah saat Simpan

function saveFiles() { writeJSON(FILES_KEY, files); syncDirty(); }
function saveFileKinds() { writeJSON(FILE_KINDS_KEY, fileKinds); syncDirty(); }
function kindLabel(id) { const k = fileKinds.find((x) => x.id === id); return k ? k.label : 'Tanpa jenis'; }
function itemOf(f) { return f.itemId ? items.find((i) => i.id === f.itemId) : null; }
function filesForItem(id) { return files.filter((f) => f.itemId === id); }
function filesForCourse(id) { return files.filter((f) => f.courseId === id || (itemOf(f) && itemOf(f).courseId === id)); }
function filesForComp(id) { return files.filter((f) => f.compId === id || (itemOf(f) && itemOf(f).compId === id)); }

function extOf(name) { const m = /\.([a-z0-9]{1,5})$/i.exec(name || ''); return m ? m[1].toUpperCase() : 'FILE'; }
const EXT_COLOR = { PDF: '#ef4444', DOC: '#2563eb', DOCX: '#2563eb', PPT: '#f97316', PPTX: '#f97316', XLS: '#16a34a', XLSX: '#16a34a', CSV: '#16a34a', PNG: '#8b5cf6', JPG: '#8b5cf6', JPEG: '#8b5cf6', ZIP: '#64748b' };

function defaultKindFor(ctx) {
  if (ctx.compId) return 'guidebook';
  if (ctx.itemId) {
    const it = items.find((i) => i.id === ctx.itemId);
    if (it && it.compId) return 'berkas';
    return 'soal';
  }
  return 'materi';
}
function kindOptions(sel) {
  const ids = fileKinds.map((k) => k.id);
  return fileKinds.map((k) => `<option value="${esc(k.id)}" ${k.id === sel ? 'selected' : ''}>${esc(k.label)}</option>`).join('') +
    (sel && !ids.includes(sel) ? '<option value="" selected>Tanpa jenis</option>' : '');
}

// ---------- Unggah, buka, hapus ----------
function requireCloud() {
  if (sb && cloudUser) return true;
  toast('Masuk ke akun cloud dulu untuk menyimpan file.');
  openCloudDialog();
  return false;
}

async function uploadOne(file, meta) {
  if (file.size > MAX_FILE) throw new Error(`"${file.name}" lebih dari 50 MB`);
  const id = uid();
  const safe = file.name.replace(/[^\w.\-]+/g, '_').slice(-100) || 'file';
  const path = `${cloudUser.id}/${id}/${safe}`;
  const { error } = await sb.storage.from(FILES_BUCKET).upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false });
  if (error) throw error;
  const rec = {
    id, name: file.name.slice(0, 200), size: file.size, mime: file.type || '', path, created: Date.now(),
    kind: meta.kind || '', itemId: meta.itemId || '', courseId: meta.courseId || '', compId: meta.compId || '',
  };
  files.push(rec);
  saveFiles();
  return rec;
}

async function uploadMany(list, metaFor) {
  if (!list.length || !requireCloud()) return 0;
  let ok = 0;
  for (const [i, file] of list.entries()) {
    toast(`Mengunggah ${i + 1}/${list.length}: ${file.name}`);
    try { await uploadOne(file, metaFor(file)); ok++; }
    catch (e) { toast(`Gagal mengunggah: ${(e && e.message) || e}`); await new Promise((r) => setTimeout(r, 1500)); }
  }
  if (ok) toast(`${ok} file tersimpan`);
  render();
  return ok;
}

async function openFile(f, download = false) {
  if (!requireCloud()) return;
  // Buka tab dulu saat diklik supaya tidak diblokir browser, lalu arahkan ke link aman (berlaku 1 jam)
  const w = download ? null : window.open('', '_blank');
  const { data, error } = await sb.storage.from(FILES_BUCKET).createSignedUrl(f.path, 3600, download ? { download: f.name } : undefined);
  if (error || !data) {
    if (w) w.close();
    toast(navigator.onLine ? 'File tidak bisa dibuka. Mungkin sudah dihapus.' : 'Perlu internet untuk membuka file.');
    return;
  }
  if (w) w.location.href = data.signedUrl;
  else if (download) { const a = document.createElement('a'); a.href = data.signedUrl; a.download = f.name; a.click(); }
  else location.href = data.signedUrl;
}

async function deleteFile(f) {
  if (!confirm(`Hapus file "${f.name}"?`)) return;
  if (!requireCloud()) return;
  const { error } = await sb.storage.from(FILES_BUCKET).remove([f.path]);
  if (error && navigator.onLine) { toast('Gagal menghapus file.'); return; }
  files = files.filter((x) => x.id !== f.id);
  saveFiles();
  render();
  if (dialog.open) renderAttachments();
  if (compDialog.open) renderCompFiles();
  toast('File dihapus');
}

// Item dihapus: file tetap disimpan di matkul/lomba asalnya
function onItemDeletedFiles(it) {
  let changed = false;
  for (const f of files) {
    if (f.itemId !== it.id) continue;
    f.itemId = '';
    if (it.courseId && !f.courseId) f.courseId = it.courseId;
    if (it.compId && !f.compId) f.compId = it.compId;
    changed = true;
  }
  if (changed) saveFiles();
}

// ---------- Tampilan daftar file ----------
function fileRowHtml(f, opts = {}) {
  const ext = extOf(f.name);
  const src = itemOf(f);
  const meta = [fmtBytes(f.size || 0), shortDate(toKey(new Date(f.created)))];
  if (src && !opts.hideSource) meta.push(`dari "${esc(src.title)}"`);
  return `<li class="file-row" data-file="${esc(f.id)}">
    <span class="ficon" style="--fc:${EXT_COLOR[ext] || '#64748b'}">${ext.slice(0, 4)}</span>
    <div class="fbody"><button type="button" class="fname" data-fopen title="Buka">${esc(f.name)}</button><span class="fmeta">${meta.join(' · ')}</span></div>
    <select class="fkind" data-fkind aria-label="Jenis file">${kindOptions(f.kind)}</select>
    <button type="button" class="icon-btn small" data-fdl title="Unduh" aria-label="Unduh">&#8615;</button>
    <button type="button" class="icon-btn small danger" data-fdel title="Hapus" aria-label="Hapus file">&#215;</button>
  </li>`;
}

// Kelompokkan per jenis sesuai urutan di "Kelola jenis file"
function fileGroupsHtml(list, opts = {}) {
  if (!list.length) return `<p class="sec-empty">${opts.empty || 'Belum ada file.'}</p>`;
  const groups = [...fileKinds.map((k) => k.id), ''].map((kid) => [kid, list.filter((f) => (fileKinds.some((k) => k.id === f.kind) ? f.kind : '') === kid)])
    .filter(([, l]) => l.length);
  return `<div class="file-groups">${groups.map(([kid, l]) => `<div class="fgroup">
    <div class="fgroup-head">${esc(kindLabel(kid))}<span>${l.length}</span></div>
    <ul class="file-list">${l.sort((a, b) => b.created - a.created).map((f) => fileRowHtml(f, opts)).join('')}</ul></div>`).join('')}</div>`;
}

// Kotak file lengkap untuk halaman matkul dan dialog lomba
function filesBoxHtml(ctx, list) {
  const signed = sb && cloudUser;
  const used = list.reduce((a, f) => a + (f.size || 0), 0);
  return `<div class="files-box" data-ctx='${esc(JSON.stringify(ctx))}'>
    <div class="sec-head"><h3>File <span class="muted small-n">${list.length ? `${list.length} file · ${fmtBytes(used)}` : ''}</span></h3>
      <button type="button" class="btn ghost small" data-manage-kinds>Kelola jenis</button></div>
    ${signed ? `<div class="file-upload">
        <select data-up-kind aria-label="Jenis file yang diunggah">${kindOptions(defaultKindFor(ctx))}</select>
        <label class="btn small primary">+ Upload file<input type="file" multiple hidden data-upload></label>
      </div>` : `<p class="form-note">Masuk ke akun cloud untuk menyimpan file. <button type="button" class="link-btn" data-open-cloud>Hubungkan sekarang</button></p>`}
    ${fileGroupsHtml(list, { empty: 'Belum ada file. Upload di sini, atau lampirkan langsung di form tugas.' })}
  </div>`;
}

// Satu listener untuk semua daftar file di halaman mana pun
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-open-cloud]')) { openCloudDialog(); return; }
  if (e.target.closest('[data-manage-kinds]')) { openKindManager(); return; }
  const row = e.target.closest('[data-file]');
  if (!row) return;
  const f = files.find((x) => x.id === row.dataset.file);
  if (!f) return;
  if (e.target.closest('[data-fopen]')) openFile(f);
  else if (e.target.closest('[data-fdl]')) openFile(f, true);
  else if (e.target.closest('[data-fdel]')) deleteFile(f);
});
document.addEventListener('change', async (e) => {
  if (e.target.matches('[data-fkind]')) {
    const f = files.find((x) => x.id === e.target.closest('[data-file]').dataset.file);
    if (f) { f.kind = e.target.value; saveFiles(); render(); if (compDialog.open) renderCompFiles(); }
    return;
  }
  if (e.target.matches('[data-upload]')) {
    const box = e.target.closest('.files-box');
    const ctx = JSON.parse(box.dataset.ctx);
    const kind = box.querySelector('[data-up-kind]').value;
    const list = [...e.target.files];
    e.target.value = '';
    await uploadMany(list, () => ({ ...ctx, kind }));
    if (compDialog.open) renderCompFiles();
  }
});

// ---------- Lampiran di form item ----------
function renderAttachments() {
  const signed = sb && cloudUser;
  const existing = editing ? filesForItem(editing.id) : [];
  $('#attachBox').innerHTML = `
    ${existing.length ? `<ul class="file-list">${existing.map((f) => fileRowHtml(f, { hideSource: true })).join('')}</ul>` : ''}
    ${stagedFiles.length ? `<ul class="file-list staged">${stagedFiles.map((s, i) => `<li class="file-row" data-staged="${i}">
        <span class="ficon" style="--fc:${EXT_COLOR[extOf(s.file.name)] || '#64748b'}">${extOf(s.file.name).slice(0, 4)}</span>
        <div class="fbody"><span class="fname">${esc(s.file.name)}</span><span class="fmeta">${fmtBytes(s.file.size)} · diunggah saat Simpan</span></div>
        <select class="fkind" data-staged-kind aria-label="Jenis file">${kindOptions(s.kind)}</select>
        <button type="button" class="icon-btn small danger" data-unstage aria-label="Batal lampirkan">&#215;</button>
      </li>`).join('')}</ul>` : ''}
    ${signed ? '<label class="btn small">+ Lampirkan file<input type="file" multiple hidden id="attachInput"></label>'
      : '<p class="form-note">Masuk ke akun cloud untuk melampirkan file. <button type="button" class="link-btn" data-open-cloud>Hubungkan</button></p>'}`;
}
$('#attachBox').addEventListener('change', (e) => {
  if (e.target.id === 'attachInput') {
    // Lampiran tugas default-nya "Soal / tugas", kecuali tanggal dari pelacak lomba ("Berkas pendaftaran")
    const cur = editing && items.find((i) => i.id === editing.id);
    const kind = cur && cur.compId ? 'berkas' : 'soal';
    for (const file of e.target.files) {
      if (file.size > MAX_FILE) { toast(`"${file.name}" lebih dari 50 MB`); continue; }
      stagedFiles.push({ file, kind });
    }
    renderAttachments();
  } else if (e.target.matches('[data-staged-kind]')) {
    stagedFiles[e.target.closest('[data-staged]').dataset.staged].kind = e.target.value;
  }
});
$('#attachBox').addEventListener('click', (e) => {
  const st = e.target.closest('[data-staged]');
  if (st && e.target.closest('[data-unstage]')) { stagedFiles.splice(Number(st.dataset.staged), 1); renderAttachments(); }
});
function resetAttachments() { stagedFiles = []; renderAttachments(); }
// Dipanggil setelah item tersimpan (id sudah ada)
async function uploadStaged(itemId) {
  if (!stagedFiles.length) return;
  const list = stagedFiles;
  stagedFiles = [];
  const byFile = new Map(list.map((s) => [s.file, s.kind]));
  await uploadMany(list.map((s) => s.file), (file) => ({ itemId, kind: byFile.get(file) }));
}

// ---------- File di dialog lomba ----------
function renderCompFiles() {
  const box = $('#compFiles');
  if (!editingCompId) { box.innerHTML = '<p class="form-note">Simpan lomba dulu, lalu buka lagi untuk menambahkan file seperti guidebook dan berkas pendaftaran.</p>'; return; }
  box.innerHTML = filesBoxHtml({ compId: editingCompId }, filesForComp(editingCompId));
}

// ---------- Kelola jenis file ----------
const kindDialog = $('#kindDialog');
function openKindManager() {
  menu.hidden = true;
  $('#kindList').innerHTML = fileKinds.map(kindRowHtml).join('');
  kindDialog.showModal();
}
function kindRowHtml(k) {
  const n = files.filter((f) => f.kind === k.id).length;
  return `<li data-id="${esc(k.id)}">
    <input class="kind-name" value="${esc(k.label)}" maxlength="40" placeholder="Nama jenis" aria-label="Nama jenis">
    <span class="muted small-n">${n ? n + ' file' : ''}</span>
    <button type="button" class="icon-btn small" data-move="-1" aria-label="Naikkan">&#8593;</button>
    <button type="button" class="icon-btn small" data-move="1" aria-label="Turunkan">&#8595;</button>
    <button type="button" class="icon-btn small danger" data-del aria-label="Hapus jenis">&#215;</button>
  </li>`;
}
$('#kindList').addEventListener('click', (e) => {
  const li = e.target.closest('li');
  if (!li) return;
  const mv = e.target.closest('[data-move]');
  if (mv) {
    const sib = mv.dataset.move === '-1' ? li.previousElementSibling : li.nextElementSibling;
    if (sib) mv.dataset.move === '-1' ? sib.before(li) : sib.after(li);
  } else if (e.target.closest('[data-del]')) li.remove();
});
$('#addKindBtn').addEventListener('click', () => {
  $('#kindList').insertAdjacentHTML('beforeend', kindRowHtml({ id: uid(), label: '' }));
  $('#kindList').lastElementChild.querySelector('input').focus();
});
$('#kindCancel').addEventListener('click', () => kindDialog.close());
$('#kindForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const next = [...$('#kindList').children].map((li) => ({ id: li.dataset.id, label: li.querySelector('input').value.trim().slice(0, 40) }))
    .filter((k) => k.label);
  if (!next.length) { toast('Minimal harus ada satu jenis.'); return; }
  const kept = new Set(next.map((k) => k.id));
  const orphan = files.filter((f) => f.kind && !kept.has(f.kind)).length;
  if (orphan && !confirm(`${orphan} file memakai jenis yang dihapus. File tetap ada dan masuk ke "Tanpa jenis". Lanjut?`)) return;
  fileKinds = next;
  saveFileKinds();
  kindDialog.close();
  render();
  if (dialog.open) renderAttachments();
  if (compDialog.open) renderCompFiles();
  toast('Jenis file disimpan');
});
$('#kindMenuBtn').addEventListener('click', openKindManager);

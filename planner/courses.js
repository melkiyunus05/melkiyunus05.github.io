'use strict';
// ---------- Mata kuliah ----------
// Tugas, ujian, dan jadwal kuliah tetap disimpan sebagai item kalender biasa yang diberi courseId.
// Halaman ini hanya mengumpulkan item-item tersebut, ditambah info matkul, nilai, link, dan catatan.

const COURSES_KEY = 'elio-planner-courses-v1';
// Skala nilai Universitas Indonesia: [huruf, nilai minimum, bobot]
const GRADES = [['A', 85, 4], ['A-', 80, 3.7], ['B+', 75, 3.3], ['B', 70, 3], ['B-', 65, 2.7], ['C+', 60, 2.3], ['C', 55, 2], ['D', 40, 1], ['E', 0, 0]];
const DEFAULT_GRADING = [['Tugas', 20], ['Kuis', 10], ['UTS', 35], ['UAS', 35]];
const COURSE_COLORS = ['#8b5cf6', '#0ea5e9', '#10b981', '#f97316', '#ec4899', '#6366f1', '#14b8a6', '#eab308', '#ef4444', '#84cc16'];

let courses = loadCourses();
let openCourseId = null;

function num(v, fallback = '') {
  if (v === '' || v === null || v === undefined) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function safeUrl(u) {
  u = String(u || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  return u;
}

function cleanCourse(c) {
  return {
    id: String(c.id || uid()),
    name: String(c.name || '').trim().slice(0, 80) || 'Mata kuliah',
    code: String(c.code || '').trim().slice(0, 20),
    sks: Math.max(0, Math.min(24, num(c.sks, 0))),
    lecturer: String(c.lecturer || '').trim().slice(0, 120),
    room: String(c.room || '').trim().slice(0, 80),
    color: /^#[0-9a-f]{6}$/i.test(c.color) ? c.color : COURSE_COLORS[0],
    archived: !!c.archived,
    target: GRADES.some((g) => g[0] === c.target) ? c.target : 'A',
    grading: Array.isArray(c.grading) ? c.grading.map((g) => ({
      id: String(g.id || uid()),
      name: String(g.name || '').slice(0, 40),
      weight: Math.max(0, num(g.weight, 0)),
      score: g.score === '' || g.score === null || g.score === undefined ? '' : Math.max(0, Math.min(100, num(g.score, 0))),
    })) : [],
    links: Array.isArray(c.links) ? c.links.filter((l) => l && l.url).map((l) => ({
      id: String(l.id || uid()), label: String(l.label || '').slice(0, 60), url: safeUrl(l.url),
    })) : [],
    notes: String(c.notes || '').slice(0, 5000),
    created: c.created || Date.now(),
  };
}
function loadCourses() {
  try {
    const data = JSON.parse(localStorage.getItem(COURSES_KEY));
    return Array.isArray(data) ? data.map(cleanCourse) : [];
  } catch { return []; }
}
function saveCourses() {
  try { localStorage.setItem(COURSES_KEY, JSON.stringify(courses)); }
  catch { toast('Gagal menyimpan data matkul.'); }
  cloudDirty();
}
function courseById(id) { return id ? courses.find((c) => c.id === id) : null; }

// ---------- Hitungan nilai ----------
function gradeOf(score) { return GRADES.find((g) => score >= g[1]) || GRADES[GRADES.length - 1]; }
function fmt(n) { return (Math.round(n * 10) / 10).toLocaleString('id-ID'); }

function gradeStats(c) {
  const comps = c.grading.filter((g) => g.weight > 0);
  const W = comps.reduce((a, g) => a + g.weight, 0);
  const filled = comps.filter((g) => g.score !== '');
  const Wf = filled.reduce((a, g) => a + g.weight, 0);
  const S = filled.reduce((a, g) => a + g.weight * g.score, 0);
  const rest = comps.filter((g) => g.score === '');
  return {
    W, Wf, S,
    current: Wf > 0 ? S / Wf : null,              // rata-rata dari komponen yang sudah keluar
    final: W > 0 && !rest.length ? S / W : null,  // hanya kalau semua komponen terisi
    remaining: W - Wf,
    restNames: rest.map((g) => g.name || 'komponen').join(', '),
  };
}
// Rata-rata yang dibutuhkan di komponen tersisa supaya nilai akhir mencapai batas huruf tertentu
function neededFor(st, letter) {
  const min = GRADES.find((g) => g[0] === letter)[1];
  if (st.remaining <= 0) return null;
  return (min * st.W - st.S) / st.remaining;
}
function courseScore(c) { const st = gradeStats(c); return st.final ?? st.current; }

function semesterIP() {
  let sks = 0, pts = 0, n = 0;
  for (const c of courses) {
    if (c.archived || !c.sks) continue;
    const s = courseScore(c);
    if (s === null) continue;
    sks += c.sks; pts += c.sks * gradeOf(s)[2]; n++;
  }
  return n ? { ip: pts / sks, n } : null;
}

// ---------- Item yang tertaut ----------
function courseItems(c) { return items.filter((it) => it.courseId === c.id); }

// Pertemuan kuliah berikutnya dari jadwal mingguan matkul ini
function nextClass(c) {
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const k = toKey(addDays(today, i));
    const list = itemsOn(k).filter((it) => it.courseId === c.id && it.weekly && it.time);
    const hit = list.find((it) => i > 0 || endMin(it) > nowMin());
    if (hit) return { it: hit, k };
  }
  return null;
}
function nextTask(c) {
  const today = toKey(new Date());
  return courseItems(c)
    .filter((it) => !it.weekly && !isDone(it, it.date) && it.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date) || compareItems(a, b))[0] || null;
}

// ---------- Render ----------
function renderCourses() {
  const c = courseById(openCourseId);
  if (!c) openCourseId = null;
  $('#coursesPage').innerHTML = c ? courseDetailHtml(c) : courseListHtml();
}

function courseListHtml() {
  const active = courses.filter((c) => !c.archived);
  const archived = courses.filter((c) => c.archived);
  const totalSks = active.reduce((a, c) => a + (c.sks || 0), 0);
  const ip = semesterIP();
  const sub = active.length
    ? `${active.length} matkul · ${totalSks} SKS${ip ? ` · IP perkiraan <b>${ip.ip.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> <span class="muted">(dari nilai sementara ${ip.n} matkul)</span>` : ''}`
    : 'Kumpulkan jadwal, tugas, ujian, nilai, dan link materi tiap matkul di satu tempat.';
  let html = `<div class="page-head">
      <div><h2>Mata kuliah</h2><p class="page-sub">${sub}</p></div>
      <button class="btn primary" data-new-course>+ Matkul</button>
    </div>`;
  if (!courses.length) {
    html += `<div class="card empty-state">
      <h3>Belum ada mata kuliah</h3>
      <p>Tambahkan matkul semester ini. Setelah itu kamu bisa:</p>
      <ul>
        <li>Memasang jadwal kuliah mingguan yang otomatis muncul di kalender</li>
        <li>Mengumpulkan semua tugas dan ujian per matkul</li>
        <li>Menghitung nilai sementara dan nilai UAS yang dibutuhkan untuk target</li>
        <li>Menyimpan link materi, EMAS, drive, atau grup kelas</li>
      </ul>
      <button class="btn primary" data-new-course>+ Tambah matkul pertama</button>
    </div>`;
    return html;
  }
  html += `<div class="course-grid">${active.map(courseCardHtml).join('')}</div>`;
  if (!active.length) html += '<p class="muted">Semua matkul sudah diarsipkan.</p>';
  if (archived.length) {
    html += `<details class="archive"><summary>Arsip semester lalu (${archived.length})</summary>
      <div class="course-grid">${archived.map(courseCardHtml).join('')}</div></details>`;
  }
  return html;
}

function courseCardHtml(c) {
  const nc = nextClass(c);
  const nt = nextTask(c);
  const s = courseScore(c);
  const today = toKey(new Date());
  const classTxt = nc
    ? `${nc.k === today ? 'Hari ini' : diffDays(today, nc.k) === 1 ? 'Besok' : DAYS[fromKey(nc.k).getDay()]}, ${nc.it.time}${nc.it.place ? ' · ' + esc(nc.it.place) : ''}`
    : '<span class="muted">Belum ada jadwal</span>';
  const n = nt ? diffDays(today, nt.date) : 0;
  const taskTxt = nt
    ? `${esc(nt.title)} <span class="countdown${n > 3 ? ' far' : ''}">${n === 0 ? 'Hari ini' : 'H-' + n}</span>`
    : '<span class="muted">Tidak ada</span>';
  return `<button type="button" class="course-card" data-course="${c.id}" style="--c:${c.color}">
    <div class="cc-head"><b>${esc(c.name)}</b><span class="muted">${[c.code && esc(c.code), c.sks ? c.sks + ' SKS' : ''].filter(Boolean).join(' · ')}</span></div>
    <div class="cc-row"><span class="cc-label">Kuliah</span><span>${classTxt}</span></div>
    <div class="cc-row"><span class="cc-label">Tugas</span><span>${taskTxt}</span></div>
    <div class="cc-grade">${s === null ? '<span class="muted">Belum ada nilai</span>'
      : `<b class="grade-letter">${gradeOf(s)[0]}</b> ${fmt(s)} <span class="muted">${gradeStats(c).final !== null ? 'akhir' : 'sementara'}</span>`}</div>
  </button>`;
}

function courseDetailHtml(c) {
  const today = toKey(new Date());
  const linked = courseItems(c);
  const sched = linked.filter((it) => it.weekly).sort((a, b) => fromKey(a.date).getDay() - fromKey(b.date).getDay() || compareItems(a, b));
  const tasks = linked.filter((it) => !it.weekly);
  const open = tasks.filter((it) => !isDone(it, it.date)).sort((a, b) => a.date.localeCompare(b.date) || compareItems(a, b));
  const done = tasks.filter((it) => isDone(it, it.date)).sort((a, b) => b.date.localeCompare(a.date));
  const info = [c.code && esc(c.code), c.sks ? `${c.sks} SKS` : '', c.lecturer && `Dosen: ${esc(c.lecturer)}`, c.room && `Ruang: ${esc(c.room)}`].filter(Boolean);

  return `<div class="page-head">
      <button class="btn ghost" data-back>&#8249; Semua matkul</button>
      <button class="btn" data-edit-course>Edit matkul</button>
    </div>
    <div class="course-hero" style="--c:${c.color}">
      <h2>${esc(c.name)}${c.archived ? ' <span class="badge" style="--c:#64748b">Arsip</span>' : ''}</h2>
      <div class="muted">${info.join(' · ') || 'Lengkapi kode, SKS, dosen, dan ruang lewat Edit matkul.'}</div>
      <div class="study-line">
        <span>Waktu belajar: <b>${fmtDur(courseMinutes(c.id, toKey(weekStart(today))))}</b> minggu ini · ${fmtDur(courseMinutes(c.id))} total</span>
        <button class="btn small primary" data-study>&#9654; Mulai belajar</button>
      </div>
    </div>
    <div class="course-layout">
      <div class="course-col">
        <section class="card pad">
          <div class="sec-head"><h3>Jadwal kuliah</h3><button class="btn small" data-add-sched>+ Jadwal</button></div>
          ${sched.length ? `<ul class="items">${sched.map((it) => itemHtml(it, it.date, { hideCourse: true })).join('')}</ul>`
            : '<p class="sec-empty">Belum ada jadwal. Tambahkan supaya muncul otomatis di kalender tiap minggu.</p>'}
        </section>
        <section class="card pad">
          <div class="sec-head"><h3>Tugas dan ujian</h3><button class="btn small" data-add-task>+ Tugas / ujian</button></div>
          ${open.length ? `<ul class="items">${open.map((it) => itemHtml(it, it.date, { countdown: true, focusDate: today, hideCourse: true })).join('')}</ul>`
            : '<p class="sec-empty">Tidak ada tugas atau ujian yang belum selesai.</p>'}
          ${done.length ? `<details class="done-list"><summary>Selesai (${done.length})</summary>
            <ul class="items">${done.map((it) => itemHtml(it, it.date, { hideCourse: true })).join('')}</ul></details>` : ''}
        </section>
        <section class="card pad">${filesBoxHtml({ courseId: c.id }, filesForCourse(c.id))}</section>
      </div>
      <div class="course-col">
        <section class="card pad">
          <div class="sec-head"><h3>Nilai</h3>
            <label class="inline-field">Target
              <select data-target>${GRADES.slice(0, 7).map((g) => `<option ${g[0] === c.target ? 'selected' : ''}>${g[0]}</option>`).join('')}</select>
            </label>
          </div>
          <div class="grade-wrap">
            <table class="grade-table">
              <thead><tr><th>Komponen</th><th>Bobot (%)</th><th>Nilai</th><th></th></tr></thead>
              <tbody>${c.grading.map((g) => `<tr data-g="${g.id}">
                <td><input data-f="name" value="${esc(g.name)}" maxlength="40" placeholder="mis. UTS" aria-label="Nama komponen"></td>
                <td><input data-f="weight" type="number" inputmode="decimal" min="0" max="100" step="any" value="${g.weight}" aria-label="Bobot"></td>
                <td><input data-f="score" type="number" inputmode="decimal" min="0" max="100" step="any" value="${g.score}" placeholder="belum" aria-label="Nilai"></td>
                <td><button type="button" class="icon-btn small danger" data-rm-grade aria-label="Hapus komponen">&#215;</button></td>
              </tr>`).join('')}</tbody>
            </table>
          </div>
          <button class="btn small" data-add-grade>+ Komponen</button>
          <div class="grade-summary" id="gradeSummary">${gradeSummaryHtml(c)}</div>
        </section>
        <section class="card pad">
          <h3>Link penting</h3>
          ${c.links.length ? `<ul class="link-list">${c.links.map((l) => `<li>
            <a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label || l.url)}</a>
            <button type="button" class="icon-btn small danger" data-rm-link="${l.id}" aria-label="Hapus link">&#215;</button></li>`).join('')}</ul>`
            : '<p class="sec-empty">Simpan link materi, EMAS, drive, atau grup kelas di sini.</p>'}
          <div class="link-add">
            <input id="linkLabel" maxlength="60" placeholder="Nama (mis. Slide kuliah)">
            <input id="linkUrl" maxlength="500" placeholder="https://..." inputmode="url">
            <button class="btn small" data-add-link>Tambah</button>
          </div>
        </section>
        <section class="card pad">
          <h3>Catatan</h3>
          <textarea class="course-notes" data-course-notes rows="5" placeholder="Kontrak kuliah, aturan dosen, bab yang keluar di ujian, dll. Tersimpan otomatis.">${esc(c.notes)}</textarea>
        </section>
      </div>
    </div>`;
}

function gradeSummaryHtml(c) {
  if (!c.grading.length) return '<p class="muted">Tambahkan komponen nilai sesuai kontrak kuliah atau RPS.</p>';
  const st = gradeStats(c);
  const out = [];
  if (Math.abs(st.W - 100) > 0.01) out.push(`<p class="warn">Total bobot ${fmt(st.W)}%, seharusnya 100%.</p>`);
  if (st.final !== null) {
    out.push(`<p class="grade-big"><b class="grade-letter">${gradeOf(st.final)[0]}</b> Nilai akhir ${fmt(st.final)}</p>`);
    return out.join('');
  }
  out.push(st.current !== null
    ? `<p class="grade-big"><b class="grade-letter">${gradeOf(st.current)[0]}</b> Nilai sementara ${fmt(st.current)} <span class="muted">dari ${fmt(st.Wf)}% komponen</span></p>`
    : '<p class="muted">Belum ada nilai yang keluar. Isi kolom nilai begitu hasilnya keluar.</p>');

  const need = neededFor(st, c.target);
  const rest = `${esc(st.restNames)} (${fmt(st.remaining)}%)`;
  if (need <= 0) out.push(`<p class="ok">Target <b>${c.target}</b> sudah pasti tercapai, bahkan kalau ${rest} dapat 0.</p>`);
  else if (need > 100) {
    const best = GRADES.find((g) => neededFor(st, g[0]) <= 100);
    out.push(`<p class="warn">Target <b>${c.target}</b> sudah tidak bisa dicapai.${best
      ? ` Paling tinggi masih bisa <b>${best[0]}</b>, butuh rata-rata ${fmt(Math.max(0, neededFor(st, best[0])))} di ${rest}.` : ''}</p>`);
  } else out.push(`<p>Untuk dapat <b>${c.target}</b>, kamu butuh rata-rata <b class="need">${fmt(need)}</b> di ${rest}.</p>`);

  // Tabel kecil "kalau mau dapat X, butuh berapa" untuk beberapa huruf di sekitar target
  const chips = GRADES.slice(0, 7).map((g) => [g[0], neededFor(st, g[0])]).filter(([, n]) => n > 0 && n <= 100);
  if (chips.length) {
    out.push(`<div class="need-chips"><span class="muted">Butuh rata-rata:</span>${chips.map(([l, n]) =>
      `<span class="need-chip${l === c.target ? ' on' : ''}">${l} &#8805; ${fmt(n)}</span>`).join('')}</div>`);
  }
  return out.join('');
}

// ---------- Form matkul ----------
const courseDialog = $('#courseDialog');
const courseForm = $('#courseForm');
let editingCourseId = null;

function openCourseForm(c = null) {
  courseForm.reset();
  editingCourseId = c ? c.id : null;
  $('#courseFormTitle').textContent = c ? 'Edit mata kuliah' : 'Tambah mata kuliah';
  $('#courseDeleteBtn').hidden = !c;
  $('#courseArchiveWrap').hidden = !c;
  $('#courseNewHint').hidden = !!c;
  courseForm.name.value = c ? c.name : '';
  courseForm.code.value = c ? c.code : '';
  courseForm.sks.value = c && c.sks ? c.sks : '';
  courseForm.lecturer.value = c ? c.lecturer : '';
  courseForm.room.value = c ? c.room : '';
  courseForm.color.value = c ? c.color : COURSE_COLORS[courses.length % COURSE_COLORS.length];
  courseForm.archived.checked = c ? c.archived : false;
  courseDialog.showModal();
  if (!c) courseForm.name.focus();
}

courseForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = courseForm.name.value.trim();
  if (!name) return;
  const data = {
    name,
    code: courseForm.code.value,
    sks: courseForm.sks.value,
    lecturer: courseForm.lecturer.value,
    room: courseForm.room.value,
    color: courseForm.color.value,
    archived: courseForm.archived.checked,
  };
  if (editingCourseId) {
    const c = courseById(editingCourseId);
    Object.assign(c, cleanCourse({ ...c, ...data }));
    toast('Matkul disimpan');
  } else {
    const c = cleanCourse({ ...data, grading: DEFAULT_GRADING.map(([n, w]) => ({ name: n, weight: w, score: '' })) });
    courses.push(c);
    openCourseId = c.id;
    // Tautkan otomatis jadwal atau tugas lama yang judulnya sama persis dengan nama matkul
    const lower = name.toLowerCase();
    const matched = items.filter((it) => !it.courseId && it.title.trim().toLowerCase() === lower);
    for (const it of matched) it.courseId = c.id;
    if (matched.length) save();
    toast(matched.length ? `Matkul dibuat. ${matched.length} item lama dengan nama sama otomatis ditautkan.` : 'Matkul dibuat');
  }
  saveCourses();
  courseDialog.close();
  render();
});

$('#courseCancelBtn').addEventListener('click', () => courseDialog.close());
$('#courseDeleteBtn').addEventListener('click', () => {
  const c = courseById(editingCourseId);
  const n = courseItems(c).length;
  if (!confirm(`Hapus matkul "${c.name}"?${n ? ` ${n} jadwal/tugas yang tertaut tetap ada di kalender, hanya tidak lagi terhubung ke matkul ini.` : ''}`)) return;
  for (const it of courseItems(c)) it.courseId = '';
  save();
  courses = courses.filter((x) => x.id !== c.id);
  saveCourses();
  openCourseId = null;
  courseDialog.close();
  render();
  toast('Matkul dihapus');
});

// ---------- Interaksi halaman ----------
const coursesPage = $('#coursesPage');

function presetType(id, weeklyFallback) {
  if (cats.some((c) => c.id === id)) return id;
  const alt = cats.find((c) => (weeklyFallback ? c.weekly : c.checkable));
  return (alt || cats[0]).id;
}

coursesPage.addEventListener('click', (e) => {
  const c = courseById(openCourseId);
  const t = e.target;
  if (t.closest('[data-new-course]')) { openCourseForm(); return; }
  const card = t.closest('[data-course]');
  if (card) { openCourseId = card.dataset.course; renderCourses(); window.scrollTo(0, 0); return; }
  if (t.closest('[data-back]')) { openCourseId = null; renderCourses(); return; }
  if (!c) return;
  if (t.closest('[data-edit-course]')) { openCourseForm(c); return; }
  if (t.closest('[data-add-sched]')) {
    openForm(null, toKey(new Date()), { date: toKey(new Date()), type: presetType('kuliah', true), weekly: true, title: c.name, place: c.room, courseId: c.id });
    return;
  }
  if (t.closest('[data-add-task]')) {
    openForm(null, toKey(new Date()), { date: toKey(new Date()), type: presetType('deadline', false), courseId: c.id });
    return;
  }
  if (t.closest('[data-study]')) { startTimerFor({ kind: 'course', id: c.id }); return; }
  if (t.closest('[data-add-grade]')) {
    c.grading.push({ id: uid(), name: '', weight: 0, score: '' });
    saveCourses();
    renderCourses();
    const inputs = coursesPage.querySelectorAll('.grade-table input[data-f="name"]');
    inputs[inputs.length - 1].focus();
    return;
  }
  const rmGrade = t.closest('[data-rm-grade]');
  if (rmGrade) {
    c.grading = c.grading.filter((g) => g.id !== rmGrade.closest('tr').dataset.g);
    saveCourses();
    renderCourses();
    return;
  }
  if (t.closest('[data-add-link]')) { addLink(c); return; }
  const rmLink = t.closest('[data-rm-link]');
  if (rmLink) {
    c.links = c.links.filter((l) => l.id !== rmLink.dataset.rmLink);
    saveCourses();
    renderCourses();
    return;
  }
  if (t.closest('.item')) onListClick(e);
});

function addLink(c) {
  const url = $('#linkUrl').value.trim();
  if (!url) { $('#linkUrl').focus(); return; }
  c.links.push({ id: uid(), label: $('#linkLabel').value.trim(), url: safeUrl(url) });
  saveCourses();
  renderCourses();
}

coursesPage.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.target.id === 'linkUrl' || e.target.id === 'linkLabel')) {
    e.preventDefault();
    const c = courseById(openCourseId);
    if (c) addLink(c);
  }
});

// Edit nilai langsung di tabel. Hanya ringkasan yang digambar ulang supaya fokus input tidak hilang.
coursesPage.addEventListener('input', (e) => {
  const c = courseById(openCourseId);
  if (!c) return;
  const row = e.target.closest('tr[data-g]');
  if (row) {
    const g = c.grading.find((x) => x.id === row.dataset.g);
    const f = e.target.dataset.f;
    if (f === 'name') g.name = e.target.value.slice(0, 40);
    else if (f === 'weight') g.weight = Math.max(0, num(e.target.value, 0));
    else if (f === 'score') g.score = e.target.value === '' ? '' : Math.max(0, Math.min(100, num(e.target.value, 0)));
    saveCourses();
    $('#gradeSummary').innerHTML = gradeSummaryHtml(c);
    return;
  }
  if (e.target.matches('[data-course-notes]')) {
    c.notes = e.target.value.slice(0, 5000);
    clearTimeout(coursesPage.notesTimer);
    coursesPage.notesTimer = setTimeout(saveCourses, 400);
  }
});
coursesPage.addEventListener('change', (e) => {
  const c = courseById(openCourseId);
  if (c && e.target.matches('[data-target]')) {
    c.target = e.target.value;
    saveCourses();
    $('#gradeSummary').innerHTML = gradeSummaryHtml(c);
  }
});

// ---------- Pilihan matkul di form item ----------
function fillCourseSelect(currentId) {
  const list = courses.filter((c) => !c.archived || c.id === currentId);
  $('#courseWrap').hidden = !list.length;
  form.course.innerHTML = '<option value="">Tidak terkait matkul</option>' +
    list.map((c) => `<option value="${c.id}">${esc(c.name)}${c.code ? ' (' + esc(c.code) + ')' : ''}</option>`).join('');
  form.course.value = list.some((c) => c.id === currentId) ? currentId : '';
}

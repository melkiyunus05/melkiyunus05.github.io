'use strict';
// ---------- Catatan Belajar (per hari) ----------
// Dibuka dengan mengetuk bar hari di grafik halaman Timer. Isinya: ringkasan hari itu, jam dinding berisi
// sesi fokus, waktu per mata kuliah, daftar sesi dengan kolom catatan, dan catatan bebas untuk hari itu.
// Catatan per sesi disimpan di data sesi Timer (sessions[].note); catatan harian di dayNotes.

const DAY_NOTES_KEY = 'elio-planner-daynotes-v1';
let dayNotes = readJSON(DAY_NOTES_KEY, []);
if (!Array.isArray(dayNotes)) dayNotes = [];
let noteSaveTimer = null;

function saveDayNotes() { writeJSON(DAY_NOTES_KEY, dayNotes); cloudDirty(); }
function dayNote(k) { const n = dayNotes.find((x) => x.id === k); return n ? n.text : ''; }
function daySessions(k) { return sessions.filter((s) => sessionDay(s) === k).sort((a, b) => a.start - b.start); }
function hasStudyNotes(k) { return !!dayNote(k) || daySessions(k).some((s) => s.note); }

function weekLabel(ws) {
  if (weekOffset === 0) return 'Minggu ini';
  if (weekOffset === -1) return 'Minggu lalu';
  const a = fromKey(ws), b = addDays(a, 6);
  return a.getMonth() === b.getMonth()
    ? `${a.getDate()} - ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)}`
    : `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} - ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)}`;
}

function openStudyDay(k) {
  studyDay = k;
  renderTimer();
  window.scrollTo(0, 0);
}
function closeStudyDay() {
  // Kembali ke minggu tempat hari itu berada
  const today = toKey(new Date());
  weekOffset = Math.min(0, Math.round(diffDays(toKey(weekStart(today)), toKey(weekStart(studyDay))) / 7));
  studyDay = null;
  renderTimer();
  window.scrollTo(0, 0);
}

function fmtClock(ts) { const d = new Date(ts); return `${pad(d.getHours())}.${pad(d.getMinutes())}`; }
function sessColor(s) { const c = courseById(s.courseId); return c ? c.color : 'var(--accent)'; }

function renderStudyDay(k) {
  const today = toKey(new Date());
  const list = daySessions(k);
  const total = list.reduce((a, s) => a + s.min, 0);
  const longest = list.reduce((m, s) => (s.min > (m ? m.min : 0) ? s : m), null);
  const pct = Math.min(100, total / tset.goal * 100);

  // Sesi digambar di jam dinding (sesi yang melewati tengah malam dipotong di 24.00)
  const blocks = list.map((s) => {
    const a = new Date(s.start);
    const st = a.getHours() * 60 + a.getMinutes();
    return { kind: 'study', id: s.id, s: st, e: Math.min(1440, Math.max(st + 5, st + Math.round(s.min))), color: sessColor(s), title: s.title };
  });

  const byCourse = new Map();
  for (const s of list) { const key = courseById(s.courseId) ? s.courseId : ''; byCourse.set(key, (byCourse.get(key) || 0) + s.min); }
  const rows = [...byCourse.entries()].sort((a, b) => b[1] - a[1]);
  const maxC = Math.max(1, ...rows.map((r) => r[1]));

  // Pertahankan kursor kalau tampilan diperbarui saat sedang mengetik (misalnya karena sinkron)
  const act = document.activeElement;
  const focusKey = act && act.dataset ? (act.dataset.noteSess || (act.dataset.noteDay ? 'day' : '')) : '';
  const caret = focusKey ? [act.selectionStart, act.selectionEnd] : null;

  $('#timerPage').innerHTML = `<div class="page-head study-head">
      <button type="button" class="btn ghost" data-study-back>&#8249; Timer</button>
      <div class="study-nav">
        <button type="button" class="icon-btn small" data-study-nav="-1" aria-label="Hari sebelumnya">&#8249;</button>
        <div><h2>Catatan belajar</h2><p class="page-sub">${prettyDate(k)}${k === today ? ' · hari ini' : ''}</p></div>
        <button type="button" class="icon-btn small" data-study-nav="1" aria-label="Hari berikutnya" ${k >= today ? 'disabled' : ''}>&#8250;</button>
      </div>
    </div>
    <div class="study-summary card pad">
      <div><b class="big-n">${fmtDur(total)}</b><span class="muted"> dari target ${fmtDur(tset.goal)}</span>
        <div class="goal-bar${pct >= 100 ? ' done' : ''}"><i style="width:${pct}%"></i></div></div>
      <div class="sum-cell"><b>${list.length}</b><span>sesi</span></div>
      <div class="sum-cell"><b>${longest ? fmtDur(longest.min) : '-'}</b><span>sesi terpanjang</span></div>
    </div>
    <div class="study-grid">
      <section class="card pad study-left">
        <h3>Jam belajar</h3>
        ${clockSvg(k, { blocks })}
        ${rows.length ? `<h3>Per mata kuliah</h3><div class="cr-list">${rows.map(([id, m]) => {
          const c = courseById(id);
          return `<div class="cr-row"><span class="cr-name">${c ? esc(c.name) : 'Di luar matkul'}</span>
            <span class="cr-bar"><i style="width:${m / maxC * 100}%;background:${c ? c.color : 'var(--muted)'}"></i></span>
            <span class="cr-min">${fmtDur(m)}</span></div>`;
        }).join('')}</div>` : ''}
      </section>
      <section class="card pad study-right">
        <h3>Sesi ${list.length ? `<span class="muted small-n">${list.length}</span>` : ''}</h3>
        ${list.length ? `<ul class="study-list">${list.map((s) => `<li class="study-sess" style="--sc:${sessColor(s)}" data-study-row="${s.id}">
            <div class="ss-top"><span class="ss-time">${fmtClock(s.start)} - ${fmtClock(s.end)}</span><b class="ss-title">${esc(s.title)}</b>
              <span class="ss-min">${fmtDur(s.min)}</span>
              <button type="button" class="icon-btn small danger" data-del-sess="${s.id}" aria-label="Hapus sesi">&#215;</button></div>
            <textarea class="study-note" data-note-sess="${s.id}" rows="2" maxlength="2000" placeholder="Apa yang kamu pelajari di sesi ini?">${esc(s.note || '')}</textarea>
          </li>`).join('')}</ul>`
          : `<p class="sec-empty">Tidak ada sesi Timer di hari ini.</p>`}
        <h3>Catatan hari ini</h3>
        <textarea class="study-note day" data-note-day="${k}" rows="4" maxlength="5000" placeholder="Refleksi bebas: apa yang berjalan baik, apa yang mau diperbaiki besok.">${esc(dayNote(k))}</textarea>
        <p class="form-note">Tersimpan otomatis.</p>
      </section>
    </div>`;

  if (focusKey) {
    const el = focusKey === 'day' ? $('[data-note-day]') : $(`[data-note-sess="${focusKey}"]`);
    if (el) { el.focus(); try { el.setSelectionRange(caret[0], caret[1]); } catch {} }
  }
}

// ---------- Interaksi ----------
timerPage.addEventListener('click', (e) => {
  if (!studyDay) return;
  if (e.target.closest('[data-study-back]')) { closeStudyDay(); return; }
  const nv = e.target.closest('[data-study-nav]');
  if (nv) {
    const next = toKey(addDays(fromKey(studyDay), Number(nv.dataset.studyNav)));
    if (next <= toKey(new Date())) openStudyDay(next);
    return;
  }
  // Ketuk sesi di jam: lompat ke kolom catatannya
  const seg = e.target.closest('[data-study-sess]');
  if (seg) {
    const ta = $(`[data-note-sess="${seg.dataset.studySess}"]`);
    if (ta) { ta.scrollIntoView({ behavior: 'smooth', block: 'center' }); ta.focus(); }
  }
});

// Simpan otomatis sambil mengetik (tanpa menggambar ulang halaman supaya kursor tidak lompat)
timerPage.addEventListener('input', (e) => {
  const sid = e.target.dataset.noteSess;
  const dk = e.target.dataset.noteDay;
  if (!sid && !dk) return;
  if (sid) {
    const s = sessions.find((x) => x.id === sid);
    if (s) s.note = e.target.value.slice(0, 2000);
  } else {
    const text = e.target.value.slice(0, 5000);
    const n = dayNotes.find((x) => x.id === dk);
    if (n) { n.text = text; n.updated = Date.now(); } else dayNotes.push({ id: dk, text, updated: Date.now() });
    if (!text.trim()) dayNotes = dayNotes.filter((x) => x.id !== dk || x.text.trim());
  }
  // Simpan keduanya sekaligus, supaya pindah cepat dari catatan sesi ke catatan harian tidak menghilangkan apa pun
  clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => { saveSessions(); saveDayNotes(); }, 500);
});

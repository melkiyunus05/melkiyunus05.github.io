'use strict';
// ---------- Timer fokus (Pomodoro) ----------
// Waktu selesai disimpan sebagai jam absolut (endsAt), jadi timer tetap akurat walaupun tab
// di latar belakang, aplikasi di-refresh, atau perangkat sempat tertidur.
// Setiap sesi fokus dicatat (sessions) dan dihubungkan ke tugas dan/atau mata kuliah.

const TIMER_KEY = 'elio-planner-timer-v1';
const SESSIONS_KEY = 'elio-planner-sessions-v1';
const TSET_KEY = 'elio-planner-timer-settings-v1';
const PHASES = {
  focus: { label: 'Fokus', color: 'var(--accent)' },
  short: { label: 'Istirahat', color: '#10b981' },
  long: { label: 'Istirahat panjang', color: '#0ea5e9' },
};
const DEFAULT_TSET = { focus: 25, short: 5, long: 15, every: 4, goal: 120, sound: true, wake: true };

let tset = { ...DEFAULT_TSET, ...readJSON(TSET_KEY, {}) };
let sessions = readJSON(SESSIONS_KEY, []);
if (!Array.isArray(sessions)) sessions = [];
let timer = readJSON(TIMER_KEY, null) || idleTimer();
let audioCtx = null;
let wakeLock = null;

function readJSON(key, fallback) {
  try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; }
}
function writeJSON(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} }
function saveTimer() { writeJSON(TIMER_KEY, timer); }
function saveSessions() { writeJSON(SESSIONS_KEY, sessions); cloudDirty(); }

function idleTimer(target = { kind: 'none' }, cycle = 0) {
  return { phase: 'focus', status: 'idle', duration: tset.focus * 60000, endsAt: 0, remaining: tset.focus * 60000, target, cycle };
}
function phaseMs(phase) { return (phase === 'focus' ? tset.focus : phase === 'short' ? tset.short : tset.long) * 60000; }
function remainingMs() {
  if (timer.status === 'running') return Math.max(0, timer.endsAt - Date.now());
  if (timer.status === 'paused') return timer.remaining;
  return timer.duration;
}
function mmss(ms) {
  const s = Math.ceil(ms / 1000);
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}
function fmtDur(min) {
  min = Math.round(min);
  if (min < 60) return `${min} mnt`;
  return `${Math.floor(min / 60)}j${min % 60 ? ' ' + (min % 60) + 'm' : ''}`;
}

// ---------- Target (sedang mengerjakan apa) ----------
function targetInfo(t = timer.target) {
  if (t.kind === 'item') {
    const it = items.find((x) => x.id === t.id);
    if (it) return { title: it.title, itemId: it.id, k: t.k, courseId: it.courseId || '', color: cat(it.type).color };
  }
  if (t.kind === 'course') {
    const c = courseById(t.id);
    if (c) return { title: `Belajar ${c.name}`, itemId: '', k: '', courseId: c.id, color: c.color };
  }
  if (t.kind === 'session') {
    const p = planById(t.id);
    const d = p && planDay(p, t.k);
    const i = d ? d.sessions.findIndex((x) => x.id === t.s) : -1;
    if (i >= 0) {
      const link = p.linkId && items.find((x) => x.id === p.linkId);
      return { title: `${p.title} · Sesi ${i + 1}`, itemId: link ? link.id : '', k: link ? link.date : '', courseId: link ? link.courseId || '' : '',
        color: planColor(p), planId: p.id, sessId: t.s, planDate: t.k };
    }
  }
  return { title: 'Fokus tanpa tugas', itemId: '', k: '', courseId: '', color: 'var(--accent)' };
}
function targetValue(t) {
  if (t.kind === 'session') return `sess:${t.id}|${t.k}|${t.s}`;
  return t.kind === 'item' ? `item:${t.id}|${t.k}` : t.kind === 'course' ? `course:${t.id}` : '';
}
function parseTarget(v) {
  if (v.startsWith('item:')) { const [id, k] = v.slice(5).split('|'); return { kind: 'item', id, k }; }
  if (v.startsWith('course:')) return { kind: 'course', id: v.slice(7) };
  if (v.startsWith('sess:')) { const [id, k, s] = v.slice(5).split('|'); return { kind: 'session', id, k, s }; }
  return { kind: 'none' };
}

// ---------- Kontrol ----------
function start(phase = 'focus') {
  unlockAudio();
  timer.phase = phase;
  timer.duration = phaseMs(phase);
  timer.endsAt = Date.now() + timer.duration;
  timer.status = 'running';
  saveTimer();
  keepAwake();
  render();
}
function pauseTimer() {
  timer.remaining = Math.max(0, timer.endsAt - Date.now());
  timer.status = 'paused';
  saveTimer();
  releaseWake();
  render();
}
function resumeTimer() {
  unlockAudio();
  timer.endsAt = Date.now() + timer.remaining;
  timer.status = 'running';
  saveTimer();
  keepAwake();
  render();
}
// Selesai lebih awal: catat waktu fokus yang sudah berjalan (minimal 1 menit)
function finishFocus() {
  const elapsed = timer.duration - remainingMs();
  if (timer.phase === 'focus' && elapsed >= 60000) {
    logSession(elapsed, Date.now());
    toast(`${fmtDur(elapsed / 60000)} fokus tercatat`);
  } else if (timer.phase === 'focus') toast('Kurang dari 1 menit, tidak dicatat');
  timer = idleTimer(timer.target, timer.cycle);
  saveTimer();
  releaseWake();
  render();
}
function cancelTimer() {
  timer = idleTimer(timer.target, timer.cycle);
  saveTimer();
  releaseWake();
  render();
}
function skipBreak() {
  timer = idleTimer(timer.target, timer.cycle);
  saveTimer();
  releaseWake();
  render();
}

function logSession(ms, endTs) {
  const info = targetInfo();
  sessions.push({
    id: uid(), start: endTs - ms, end: endTs, min: Math.round(ms / 6000) / 10,
    title: info.title, itemId: info.itemId, k: info.planId ? info.planDate : info.k, courseId: info.courseId,
    planId: info.planId || '', sessId: info.sessId || '',
  });
  saveSessions();
  onFocusLogged(sessions[sessions.length - 1]);
}

// Dipanggil tiap detik. Kalau fase sudah habis (termasuk saat aplikasi baru dibuka lagi), lanjutkan siklusnya.
function tickTimer() {
  // Bisa lebih dari satu fase yang terlewat (fokus lalu istirahat) kalau aplikasi lama ditutup
  for (let i = 0; i < 3 && timer.status === 'running' && Date.now() >= timer.endsAt; i++) completePhase();
  updateTimerDisplay();
}

function completePhase() {
  const endedAt = timer.endsAt;
  if (timer.phase === 'focus') {
    logSession(timer.duration, endedAt);
    timer.cycle += 1;
    const next = timer.cycle % tset.every === 0 ? 'long' : 'short';
    // Istirahat langsung berjalan, dihitung dari saat fokus selesai
    timer.phase = next;
    timer.duration = phaseMs(next);
    timer.endsAt = endedAt + timer.duration;
    timer.status = 'running';
    saveTimer();
    if (Date.now() < timer.endsAt) {
      chime(3);
      const msg = `Kerja bagus! Waktunya ${PHASES[next].label.toLowerCase()} ${phaseMs(next) / 60000} menit.`;
      timerAlert('Sesi fokus selesai', msg, [{ label: 'Lewati istirahat', fn: skipBreak }]);
      systemNotify('Sesi fokus selesai', msg, 'timer');
    }
  } else {
    timer = idleTimer(timer.target, timer.phase === 'long' ? 0 : timer.cycle);
    saveTimer();
    releaseWake();
    chime(2);
    timerAlert('Istirahat selesai', 'Siap fokus lagi?', [{ label: 'Mulai fokus', primary: true, fn: () => start('focus') }]);
    systemNotify('Istirahat selesai', 'Siap fokus lagi?', 'timer');
  }
  render();
}

// ---------- Mulai dari tugas atau matkul ----------
function startTimerFor(target) {
  const focusing = timer.status !== 'idle' && timer.phase === 'focus';
  // Tugas yang sama sedang berjalan: cukup buka halaman timer
  if (focusing && targetValue(timer.target) === targetValue(target)) { setPage('timer'); return; }
  if (focusing) {
    if (!confirm(`Timer sedang berjalan untuk "${targetInfo().title}". Simpan sesi itu dan mulai yang baru?`)) return;
    finishFocus();
  }
  timer.target = target;
  start('focus'); // kalau sedang istirahat, istirahatnya diakhiri
  setPage('timer');
}

// ---------- Statistik ----------
function sessionDay(s) { return toKey(new Date(s.start)); }
function minutesOn(k) { return sessions.filter((s) => sessionDay(s) === k).reduce((a, s) => a + s.min, 0); }
function itemMinutes(id) { return sessions.filter((s) => s.itemId === id).reduce((a, s) => a + s.min, 0); }
function courseMinutes(id, fromKey) {
  return sessions.filter((s) => s.courseId === id && (!fromKey || sessionDay(s) >= fromKey)).reduce((a, s) => a + s.min, 0);
}

// ---------- Render ----------
function renderTimer() {
  const today = toKey(new Date());
  const ws = toKey(weekStart(today));
  const todayMin = minutesOn(today);
  const todaySessions = sessions.filter((s) => sessionDay(s) === today).sort((a, b) => b.start - a.start);
  const goalPct = Math.min(100, todayMin / tset.goal * 100);

  // Grafik 7 hari minggu ini
  const days = Array.from({ length: 7 }, (_, i) => toKey(addDays(fromKey(ws), i)));
  const dayMin = days.map(minutesOn);
  const maxMin = Math.max(tset.goal, ...dayMin, 1);
  const weekTotal = dayMin.reduce((a, b) => a + b, 0);

  // Per mata kuliah minggu ini
  const byCourse = new Map();
  for (const s of sessions) {
    if (sessionDay(s) < ws) continue;
    const key = courseById(s.courseId) ? s.courseId : '';
    byCourse.set(key, (byCourse.get(key) || 0) + s.min);
  }
  const courseRows = [...byCourse.entries()].sort((a, b) => b[1] - a[1]);
  const courseMax = Math.max(1, ...courseRows.map((r) => r[1]));

  $('#timerPage').innerHTML = `<div class="page-head">
      <div><h2>Timer fokus</h2><p class="page-sub">Fokus ${tset.focus} menit, istirahat ${tset.short} menit. Setiap ${tset.every} sesi, istirahat panjang ${tset.long} menit.</p></div>
    </div>
    <div class="timer-layout">
      <section class="card pad timer-card">
        <div class="phase-tabs">${Object.entries(PHASES).map(([k, p]) => `<span data-ph="${k}">${p.label}</span>`).join('')}</div>
        <div class="ring-wrap">
          <svg class="ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle cx="60" cy="60" r="54" class="ring-bg"/>
            <circle cx="60" cy="60" r="54" class="ring-fg" id="tmRing"/>
          </svg>
          <div class="ring-text"><div class="tm-time" id="tmTime"></div><div class="tm-phase" id="tmPhase"></div></div>
        </div>
        <div class="cycle-dots" id="tmCycle"></div>
        <label class="tm-target">Sedang mengerjakan
          <select id="tmTarget" ${timer.status !== 'idle' && timer.phase === 'focus' ? 'disabled' : ''}>${targetOptions()}</select>
        </label>
        <div class="tm-controls" id="tmControls"></div>
        <details class="tm-settings">
          <summary>Atur durasi dan target harian</summary>
          <div class="tm-set-grid">
            <label>Fokus (menit)<input type="number" min="1" max="180" data-set="focus" value="${tset.focus}"></label>
            <label>Istirahat (menit)<input type="number" min="1" max="60" data-set="short" value="${tset.short}"></label>
            <label>Istirahat panjang<input type="number" min="1" max="90" data-set="long" value="${tset.long}"></label>
            <label>Istirahat panjang tiap<input type="number" min="2" max="10" data-set="every" value="${tset.every}"></label>
            <label>Target harian (menit)<input type="number" min="10" max="900" step="10" data-set="goal" value="${tset.goal}"></label>
          </div>
          <div class="tm-presets"><span class="muted">Cepat:</span>
            <button type="button" class="btn small" data-preset="25,5,15">25 / 5</button>
            <button type="button" class="btn small" data-preset="50,10,20">50 / 10</button>
            <button type="button" class="btn small" data-preset="90,15,30">90 / 15</button>
          </div>
          <label class="check"><input type="checkbox" data-set="sound" ${tset.sound ? 'checked' : ''}> Bunyi saat sesi berakhir</label>
          <label class="check"><input type="checkbox" data-set="wake" ${tset.wake ? 'checked' : ''}> Layar tetap menyala selama timer berjalan</label>
        </details>
      </section>

      <section class="card pad tm-stats">
        <h3>Hari ini</h3>
        <div class="today-total"><b>${fmtDur(todayMin)}</b><span class="muted"> dari target ${fmtDur(tset.goal)} · ${todaySessions.length} sesi</span></div>
        <div class="goal-bar${goalPct >= 100 ? ' done' : ''}"><i style="width:${goalPct}%"></i></div>
        ${goalPct >= 100 ? '<p class="ok-text">Target harian tercapai. Mantap!</p>' : ''}

        <h3>Minggu ini <span class="muted small-n">${fmtDur(weekTotal)}</span></h3>
        <div class="week-bars">${days.map((k, i) => `<div class="wb${k === today ? ' today' : ''}" title="${shortDate(k)}: ${fmtDur(dayMin[i])}">
          <div class="wb-col"><i style="height:${dayMin[i] / maxMin * 100}%"></i><span class="wb-goal" style="bottom:${tset.goal / maxMin * 100}%"></span></div>
          <span>${DAYS[fromKey(k).getDay()].slice(0, 3)}</span></div>`).join('')}</div>

        <h3>Per mata kuliah (minggu ini)</h3>
        ${courseRows.length ? `<div class="cr-list">${courseRows.map(([id, m]) => {
          const c = courseById(id);
          return `<div class="cr-row"><span class="cr-name">${c ? esc(c.name) : 'Di luar matkul'}</span>
            <span class="cr-bar"><i style="width:${m / courseMax * 100}%;background:${c ? c.color : 'var(--muted)'}"></i></span>
            <span class="cr-min">${fmtDur(m)}</span></div>`;
        }).join('')}</div>` : '<p class="sec-empty">Belum ada sesi minggu ini.</p>'}

        <h3>Riwayat hari ini</h3>
        ${todaySessions.length ? `<ul class="sess-list">${todaySessions.map((s) => {
          const a = new Date(s.start), b = new Date(s.end);
          return `<li><span class="muted">${pad(a.getHours())}.${pad(a.getMinutes())} - ${pad(b.getHours())}.${pad(b.getMinutes())}</span>
            <span class="sess-title">${esc(s.title)}</span><b>${fmtDur(s.min)}</b>
            <button type="button" class="icon-btn small danger" data-del-sess="${s.id}" aria-label="Hapus sesi">&#215;</button></li>`;
        }).join('')}</ul>` : '<p class="sec-empty">Belum ada sesi hari ini. Pilih tugas lalu tekan Mulai fokus.</p>'}
      </section>
    </div>`;
  updateTimerDisplay();
}

function targetOptions() {
  const today = toKey(new Date());
  const limit = toKey(addDays(new Date(), 14));
  const seen = new Set();
  const opt = (t, label) => { const v = targetValue(t); seen.add(v); return `<option value="${esc(v)}">${esc(label)}</option>`; };
  const groups = [];

  const fl = focusOn(today).map((f) => ({ it: items.find((x) => x.id === f.id), k: f.k })).filter((f) => f.it && !isDone(f.it, f.k));
  if (fl.length) groups.push(['Fokus hari ini', fl.map((f) => opt({ kind: 'item', id: f.it.id, k: f.k }, f.it.title))]);

  const sessOpts = [];
  for (const p of plansOn(today)) planDay(p, today).sessions.forEach((x, i) => {
    if (!x.done && sessDoneMin(x) < x.min) sessOpts.push(opt({ kind: 'session', id: p.id, k: today, s: x.id }, `${p.title} · Sesi ${i + 1} (${fmtH(x.min)})`));
  });
  if (sessOpts.length) groups.push(['Rencana hari ini', sessOpts]);

  const tasks = items.filter((it) => !it.weekly && cat(it.type).checkable && !it.done && it.date <= limit)
    .sort((a, b) => a.date.localeCompare(b.date))
    .filter((it) => !seen.has(`item:${it.id}|${it.date}`));
  if (tasks.length) {
    groups.push(['Tugas 14 hari ke depan', tasks.map((it) => {
      const n = diffDays(today, it.date);
      return opt({ kind: 'item', id: it.id, k: it.date }, `${it.title} (${n < 0 ? 'lewat ' + -n + ' hari' : n === 0 ? 'hari ini' : 'H-' + n})`);
    })]);
  }
  const cs = courses.filter((c) => !c.archived);
  if (cs.length) groups.push(['Belajar mandiri', cs.map((c) => opt({ kind: 'course', id: c.id }, `Belajar ${c.name}`))]);

  // Target yang sedang dipakai tetap ada di pilihan walaupun di luar daftar di atas
  const cur = targetValue(timer.target);
  let extra = '';
  if (cur && !seen.has(cur) && targetInfo().title !== 'Fokus tanpa tugas') extra = `<option value="${esc(cur)}">${esc(targetInfo().title)}</option>`;
  const html = '<option value="">Fokus tanpa tugas</option>' + extra +
    groups.map(([label, opts]) => `<optgroup label="${label}">${opts.join('')}</optgroup>`).join('');
  return html.replace(`value="${esc(cur)}"`, `value="${esc(cur)}" selected`);
}

function controlsHtml() {
  const f = timer.phase === 'focus';
  if (timer.status === 'idle') return '<button type="button" class="btn primary big" data-tm="start">&#9654; Mulai fokus</button>';
  const main = timer.status === 'running'
    ? '<button type="button" class="btn big" data-tm="pause">Jeda</button>'
    : '<button type="button" class="btn primary big" data-tm="resume">&#9654; Lanjut</button>';
  return f
    ? `${main}<button type="button" class="btn big" data-tm="finish">Selesai</button><button type="button" class="btn ghost" data-tm="cancel">Batal</button>`
    : `${main}<button type="button" class="btn big" data-tm="skip">Lewati istirahat</button>`;
}

// Hanya bagian yang berubah tiap detik yang digambar ulang, supaya pilihan tugas dan input tidak terganggu
function updateTimerDisplay() {
  const rem = remainingMs();
  const ph = PHASES[timer.phase];
  document.title = timer.status === 'idle' ? 'Elio Planner' : `${mmss(rem)} · ${ph.label}${timer.status === 'paused' ? ' (jeda)' : ''}`;
  updateMiniTimer();
  if (page !== 'timer' || !$('#tmTime')) return;
  $('#tmTime').textContent = mmss(rem);
  $('#tmPhase').textContent = timer.status === 'paused' ? `${ph.label} (dijeda)` : ph.label;
  const ring = $('#tmRing');
  const C = 2 * Math.PI * 54;
  ring.style.strokeDasharray = C;
  ring.style.strokeDashoffset = C * (1 - (timer.duration ? rem / timer.duration : 1));
  ring.style.stroke = ph.color;
  for (const s of document.querySelectorAll('.phase-tabs span')) s.classList.toggle('on', s.dataset.ph === timer.phase);
  const done = timer.cycle % tset.every;
  $('#tmCycle').innerHTML = Array.from({ length: tset.every }, (_, i) => `<i class="${i < done ? 'on' : ''}"></i>`).join('') +
    `<span>${timer.cycle ? `${timer.cycle} sesi selesai` : 'Sesi pertama'}</span>`;
  const ctl = controlsHtml();
  if ($('#tmControls').dataset.html !== ctl) { $('#tmControls').innerHTML = ctl; $('#tmControls').dataset.html = ctl; }
}

function updateMiniTimer() {
  const el = $('#miniTimer');
  if (!el) return;
  const show = timer.status !== 'idle' && page !== 'timer';
  el.hidden = !show;
  if (!show) return;
  const ph = PHASES[timer.phase];
  el.style.setProperty('--pc', ph.color);
  el.innerHTML = `<span class="mt-dot${timer.status === 'running' ? ' live' : ''}"></span>
    <span class="mt-time">${mmss(remainingMs())}</span>
    <span class="mt-label">${timer.phase === 'focus' ? esc(targetInfo().title) : ph.label}</span>
    <button type="button" class="icon-btn small" data-mt="${timer.status === 'running' ? 'pause' : 'resume'}" aria-label="${timer.status === 'running' ? 'Jeda' : 'Lanjut'}">${timer.status === 'running' ? '&#10074;&#10074;' : '&#9654;'}</button>`;
}

// ---------- Notifikasi dalam aplikasi, bunyi, layar menyala ----------
function timerAlert(title, body, actions = []) {
  for (const old of document.querySelectorAll('.alert.timer-alert')) old.remove();
  const el = document.createElement('div');
  el.className = 'alert timer-alert';
  el.style.setProperty('--c', PHASES[timer.phase].color);
  el.innerHTML = `<div class="alert-icon">&#9201;</div>
    <div class="alert-body"><b>${esc(title)}</b><span>${esc(body)}</span></div>
    <div class="alert-actions">${actions.map((a, i) => `<button class="btn small${a.primary ? ' primary' : ''}" data-a="${i}">${esc(a.label)}</button>`).join('')}
      <button class="btn ghost small" data-close>Tutup</button></div>`;
  el.addEventListener('click', (e) => {
    const a = e.target.closest('[data-a]');
    if (a) { actions[a.dataset.a].fn(); el.remove(); }
    else if (e.target.closest('[data-close]')) el.remove();
  });
  $('#alerts').appendChild(el);
}

function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}
function chime(n) {
  if (!tset.sound || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    for (let i = 0; i < n; i++) {
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.frequency.value = i === n - 1 ? 880 : 660;
      g.gain.setValueAtTime(0.0001, t0 + i * 0.35);
      g.gain.exponentialRampToValueAtTime(0.25, t0 + i * 0.35 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.35 + 0.3);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + i * 0.35);
      o.stop(t0 + i * 0.35 + 0.32);
    }
  } catch {}
}
async function keepAwake() {
  if (!tset.wake || !('wakeLock' in navigator) || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch { wakeLock = null; }
}
function releaseWake() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }

// ---------- Interaksi ----------
const timerPage = $('#timerPage');
timerPage.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tm]');
  if (b) {
    const a = b.dataset.tm;
    if (a === 'start') start('focus');
    else if (a === 'pause') pauseTimer();
    else if (a === 'resume') resumeTimer();
    else if (a === 'finish') finishFocus();
    else if (a === 'skip') skipBreak();
    else if (a === 'cancel' && confirm('Batalkan sesi ini tanpa dicatat?')) cancelTimer();
    return;
  }
  const pr = e.target.closest('[data-preset]');
  if (pr) {
    const [f, s, l] = pr.dataset.preset.split(',').map(Number);
    Object.assign(tset, { focus: f, short: s, long: l });
    applySettings();
    return;
  }
  const del = e.target.closest('[data-del-sess]');
  if (del && confirm('Hapus sesi ini dari catatan?')) {
    sessions = sessions.filter((s) => s.id !== del.dataset.delSess);
    saveSessions();
    render();
  }
});
timerPage.addEventListener('change', (e) => {
  if (e.target.id === 'tmTarget') {
    timer.target = parseTarget(e.target.value);
    saveTimer();
    return;
  }
  const key = e.target.dataset.set;
  if (!key) return;
  if (e.target.type === 'checkbox') tset[key] = e.target.checked;
  else {
    const lim = { focus: [1, 180], short: [1, 60], long: [1, 90], every: [2, 10], goal: [10, 900] }[key];
    tset[key] = Math.min(lim[1], Math.max(lim[0], Math.round(Number(e.target.value) || DEFAULT_TSET[key])));
  }
  applySettings();
});
function applySettings() {
  writeJSON(TSET_KEY, tset);
  cloudDirty();
  // Durasi baru langsung terlihat kalau timer belum berjalan
  if (timer.status === 'idle') { timer.duration = phaseMs('focus'); timer.remaining = timer.duration; saveTimer(); }
  render();
  const det = $('.tm-settings');
  if (det) det.open = true;
}

$('#miniTimer').addEventListener('click', (e) => {
  const b = e.target.closest('[data-mt]');
  if (b) { b.dataset.mt === 'pause' ? pauseTimer() : resumeTimer(); return; }
  setPage('timer');
});

// Tombol ▶ di daftar tugas
function onTimerButton(it, k) { startTimerFor({ kind: 'item', id: it.id, k }); }

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  tickTimer();
  if (timer.status === 'running') keepAwake();
});

'use strict';
// ---------- To-do harian dan Rencana kerja ----------
// todos : to-do kecil per tanggal, tanpa kategori atau matkul.
// plans : pekerjaan yang dicicil beberapa hari. Tiap hari punya satu atau lebih sesi berdurasi,
//         dan tiap sesi boleh diberi jam mulai (supaya tampil di Jam Harian) atau dibiarkan tanpa jam.
// Waktu fokus dari Timer yang memakai sebuah sesi otomatis dihitung sebagai progres sesi itu.

const TODOS_KEY = 'elio-planner-todos-v1';
const PLANS_KEY = 'elio-planner-plans-v1';
const DSET_KEY = 'elio-planner-day-settings-v1';
const CARRY_KEY = 'elio-planner-carry-dismissed';
const DEFAULT_DSET = { sleepStart: '23:00', sleepEnd: '06:00', loadWarn: 8, loadMax: 10 };
const PLAN_COLORS = ['#f97316', '#8b5cf6', '#0ea5e9', '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#eab308'];
const DAY_ALIASES = [
  [1, ['sen', 'senin']], [2, ['sel', 'selasa']], [3, ['rab', 'rabu']], [4, ['kam', 'kamis']],
  [5, ['jum', 'jumat', "jum'at"]], [6, ['sab', 'sabtu']], [0, ['min', 'minggu', 'ahad']],
];

let todos = readJSON(TODOS_KEY, []);
if (!Array.isArray(todos)) todos = [];
let plans = readJSON(PLANS_KEY, []);
if (!Array.isArray(plans)) plans = [];
let dset = { ...DEFAULT_DSET, ...readJSON(DSET_KEY, {}) };

function saveTodos() { writeJSON(TODOS_KEY, todos); cloudDirty(); }
function savePlans() { writeJSON(PLANS_KEY, plans); cloudDirty(); }
function saveDset() { writeJSON(DSET_KEY, dset); cloudDirty(); }

// ---------- Format waktu ----------
function fmtH(min) {
  min = Math.round(min);
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} mnt`;
  if (!m) return `${h} jam`;
  if (m === 30) return `${h},5 jam`;
  return `${h} j ${m} m`;
}
// Bentuk pendek untuk kartu kecil: 2j, 1,5j, 45m
function fmtShort(min) {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.round(min / 6) / 10;
  return `${String(h).replace('.', ',')}j`;
}
// Progres dalam jam tanpa satuan di depan: "1,5/4 jam"
function fmtProg(done, total) {
  const h = (m) => String(Math.round(m / 6) / 10).replace('.', ',');
  return `${h(done)}/${h(total)} jam`;
}
function hhmm(min) { return `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`; }
function dotTime(t) { return t.replace(':', '.'); }

// ---------- Query ----------
function planById(id) { return plans.find((p) => p.id === id); }
function planDay(p, k) { return p.days.find((d) => d.date === k); }
function plansOn(k) { return plans.filter((p) => planDay(p, k) && planDay(p, k).sessions.length); }
function todosOn(k) { return todos.filter((t) => t.date === k); }
function sessLogged(sid) { return sessions.filter((s) => s.sessId === sid).reduce((a, s) => a + s.min, 0); }
function sessDoneMin(s) { return s.done ? s.min : Math.min(s.min, sessLogged(s.id)); }
function dayLoad(k, extra = null) {
  let total = 0;
  for (const p of plans) {
    if (extra && p.id === extra.id) continue;
    const d = planDay(p, k);
    if (d) total += d.sessions.reduce((a, s) => a + s.min, 0);
  }
  if (extra) { const d = extra.days.find((x) => x.date === k); if (d) total += d.sessions.reduce((a, s) => a + s.min, 0); }
  return total;
}
function loadLevel(min) { return min > dset.loadMax * 60 ? 'over' : min >= dset.loadWarn * 60 ? 'warn' : 'ok'; }
function planTotals(p) {
  let total = 0, done = 0;
  for (const d of p.days) for (const s of d.sessions) { total += s.min; done += sessDoneMin(s); }
  return { total, done };
}
function planDayIndex(p, k) {
  const ds = p.days.filter((d) => d.sessions.length).map((d) => d.date).sort();
  return { i: ds.indexOf(k) + 1, n: ds.length };
}
function planColor(p) {
  const it = p.linkId && items.find((i) => i.id === p.linkId);
  return p.color || (it ? cat(it.type).color : PLAN_COLORS[0]);
}
function planTag(p) {
  const it = p.linkId && items.find((i) => i.id === p.linkId);
  const c = it && courseById(it.courseId);
  return c ? c.name : it ? labelOf(it) : 'Rencana';
}

// ---------- Parser gaya catatan WA ----------
// Contoh: "Modul 3 TP: Sen 1, Sel 1, Rab 2, Kam 1"
//         "Laprak mod 3: Sab (2 jam)(1 jam)(1 jam)"  atau  "Sab 2+1+1"
//         "Belajar: Jum 1,5, Sab 90m"
function dayOfToken(tok) {
  tok = tok.toLowerCase().replace(/[^a-z']/g, '');
  for (const [d, names] of DAY_ALIASES) if (names.includes(tok)) return d;
  return null;
}
function parseAmounts(text) {
  const out = [];
  const re = /(\d+(?:[.,]\d+)?)\s*(jam|j|h|menit|mnt|m)?/gi;
  let m;
  while ((m = re.exec(text))) {
    const v = parseFloat(m[1].replace(',', '.'));
    if (!(v > 0)) continue;
    const unit = (m[2] || 'jam').toLowerCase();
    const min = /^(menit|mnt|m)$/.test(unit) ? v : v * 60;
    if (min >= 5 && min <= 16 * 60) out.push(Math.round(min / 5) * 5);
  }
  return out;
}
function parsePlanText(text, baseKey = toKey(new Date())) {
  const i = text.indexOf(':');
  if (i < 1) return null;
  const title = text.slice(0, i).trim();
  const rest = text.slice(i + 1);
  // Pisahkan per hari: cari setiap nama hari, ambil teks sampai nama hari berikutnya
  const re = /\b(senin|selasa|rabu|kamis|jum'?at|sabtu|minggu|ahad|sen|sel|rab|kam|jum|sab|min)\b/gi;
  const hits = [];
  let m;
  while ((m = re.exec(rest))) hits.push({ day: dayOfToken(m[1]), at: m.index, end: re.lastIndex });
  if (!title || !hits.length) return null;
  const days = [];
  let cur = baseKey; // hari pertama dicari mulai dari tanggal acuan, hari berikutnya tidak boleh mundur
  for (const [n, h] of hits.entries()) {
    const seg = rest.slice(h.end, n + 1 < hits.length ? hits[n + 1].at : undefined);
    const amounts = parseAmounts(seg);
    // Hari berikutnya yang namanya cocok, tidak boleh mundur dari hari sebelumnya
    let d = fromKey(cur);
    for (let k = 0; k < 7 && d.getDay() !== h.day; k++) d = addDays(d, 1);
    const key = toKey(d);
    cur = key;
    const sessionsList = (amounts.length ? amounts : [60]).map((min) => ({ id: uid(), min, time: '', done: false }));
    const existing = days.find((x) => x.date === key);
    if (existing) existing.sessions.push(...sessionsList);
    else days.push({ date: key, sessions: sessionsList });
  }
  return { title, days };
}

// ---------- To-do harian ----------
function addTodo(text, k) {
  text = text.trim().slice(0, 200);
  if (!text) return;
  todos.push({ id: uid(), text, date: k, done: false, created: Date.now() });
  saveTodos();
  render();
}
function pendingCarry() {
  const today = toKey(new Date());
  const from = toKey(addDays(new Date(), -7));
  return todos.filter((t) => !t.done && t.date < today && t.date >= from);
}
function carryDismissed() { return readPref(CARRY_KEY, '') === toKey(new Date()); }
function moveTodos(list) {
  const today = toKey(new Date());
  for (const t of list) { t.carriedFrom = t.carriedFrom || t.date; t.date = today; }
  saveTodos();
  render();
  toast(`${list.length} to-do dipindahkan ke hari ini`);
}

function carryBannerHtml(k) {
  if (k !== toKey(new Date()) || carryDismissed()) return '';
  const list = pendingCarry();
  if (!list.length) return '';
  const names = list.slice(0, 3).map((t) => esc(t.text)).join(' · ') + (list.length > 3 ? ` · +${list.length - 3} lagi` : '');
  const when = list.every((t) => diffDays(t.date, k) === 1) ? 'kemarin' : 'sebelumnya';
  return `<div class="carry">
    <div class="txt"><b>${list.length} to-do ${when} belum selesai</b><span>${names}</span></div>
    <button type="button" class="btn small" data-carry="pick">Pilih</button>
    <button type="button" class="btn small primary" data-carry="all">Pindahkan ke hari ini</button>
    <button type="button" class="btn ghost small" data-carry="skip">Abaikan</button>
  </div>`;
}

// ---------- Kotak "To-do hari ini" ----------
function todoBoxHtml(k) {
  const load = dayLoad(k);
  const lvl = loadLevel(load);
  const scale = Math.max(dset.loadMax + 2, load / 60 + 1) * 60;
  const ps = plansOn(k);
  const ts = todosOn(k).sort((a, b) => a.done - b.done || a.created - b.created);
  const running = timer.status !== 'idle' && timer.phase === 'focus' && timer.target.kind === 'session' ? timer.target : null;

  const planCards = ps.map((p) => {
    const day = planDay(p, k);
    const color = planColor(p);
    const { i, n } = planDayIndex(p, k);
    const tot = planTotals(p);
    const dayTot = day.sessions.reduce((a, s) => a + s.min, 0);
    const dayDone = day.sessions.reduce((a, s) => a + sessDoneMin(s), 0);
    const it = p.linkId && items.find((x) => x.id === p.linkId);
    const meta = [`<span class="tag">${esc(planTag(p))}</span>`];
    if (n > 1) meta.push(`<span>Hari ke-${i} dari ${n}</span>`);
    if (day.sessions.length > 1) meta.push(`<span>${day.sessions.length} sesi hari ini</span>`);
    if (it) meta.push(`<span>${esc(it.title)}: ${shortDate(it.date)}</span>`);
    const prog = n > 1
      ? `<b>${fmtProg(tot.done, tot.total)}</b>total<div class="mini-bar"><i style="width:${tot.total ? tot.done / tot.total * 100 : 0}%"></i></div>`
      : `<b>${fmtProg(dayDone, dayTot)}</b>hari ini<div class="mini-bar"><i style="width:${dayTot ? dayDone / dayTot * 100 : 0}%"></i></div>`;
    const chips = day.sessions.map((s, si) => {
      const run = running && running.s === s.id;
      const done = s.done || sessDoneMin(s) >= s.min;
      const logged = sessLogged(s.id);
      const extra = run ? `<small>timer ${mmss(remainingMs())}</small>` : done ? '<small>selesai</small>'
        : logged >= 1 ? `<small>${fmtShort(logged)} jalan</small>` : s.time ? `<small>${dotTime(s.time)}</small>` : '';
      const lead = done ? '<span class="ck" data-sess-toggle>&#10003;</span>'
        : `<button type="button" class="pl" data-sess-play aria-label="Mulai timer">${run ? '&#10074;&#10074;' : '&#9654;'}</button>`;
      return `<span class="sess${done ? ' done' : ''}${run ? ' run' : ''}" data-plan="${p.id}" data-day="${k}" data-sess="${s.id}">
        ${lead}<button type="button" class="t" data-sess-open>Sesi ${si + 1} · ${fmtH(s.min)}</button>${extra}</span>`;
    }).join('');
    return `<div class="plan" style="--pc:${color}" data-plan="${p.id}">
      <div class="plan-top">
        <div><button type="button" class="plan-title" data-plan-open>${esc(p.title)}</button><div class="plan-meta">${meta.join('')}</div></div>
        <div class="plan-prog">${prog}</div>
      </div>
      <div class="sessions">${chips}</div>
    </div>`;
  }).join('');

  const todoRows = ts.map((t) => `<li class="todo-row${t.done ? ' done' : ''}" data-todo="${t.id}">
    <input type="checkbox" ${t.done ? 'checked' : ''} aria-label="Selesai">
    <span class="todo-text" data-todo-edit>${esc(t.text)}</span>
    ${t.carriedFrom && !t.done ? `<span class="from">dari ${diffDays(t.carriedFrom, k) === 1 ? 'kemarin' : shortDate(t.carriedFrom)}</span>` : ''}
    <button type="button" class="icon-btn small danger" data-todo-del aria-label="Hapus">&#215;</button>
  </li>`).join('');

  return `<div class="todo-box">
    <div class="todo-head">
      <h3 class="sec-title">To-do${k === toKey(new Date()) ? ' hari ini' : ''}</h3>
      <div class="load ${lvl}" title="Total jam sesi rencana kerja di hari ini">
        <span><b>${load ? fmtH(load) : '0 jam'}</b> direncanakan</span>
        <span class="load-bar"><i style="width:${Math.min(100, load / scale * 100)}%"></i>
          <span class="lim" style="left:${dset.loadWarn * 60 / scale * 100}%"></span><span class="lim" style="left:${dset.loadMax * 60 / scale * 100}%"></span></span>
        <span>batas ${dset.loadWarn} sampai ${dset.loadMax} jam</span>
      </div>
    </div>
    <div class="quick">
      <input id="quickTodo" maxlength="300" placeholder='Ketik to-do, atau rencana: "Modul 3 TP: Sen 1, Sel 1, Rab 2, Kam 1"' aria-label="Tambah to-do atau rencana">
      <button type="button" class="btn" data-new-plan>+ Rencana</button>
    </div>
    ${planCards}
    ${ts.length ? `<div class="sub-label">To-do kecil</div><ul class="todo-list">${todoRows}</ul>` : ''}
    ${!ps.length && !ts.length ? '<p class="sec-empty">Belum ada to-do. Ketik di atas lalu tekan Enter.</p>' : ''}
  </div>`;
}

// ---------- Interaksi di tampilan Hari ----------
$('#dvBody').addEventListener('keydown', (e) => {
  if (e.target.id !== 'quickTodo' || e.key !== 'Enter') return;
  e.preventDefault();
  const text = e.target.value.trim();
  if (!text) return;
  const parsed = parsePlanText(text, selected < toKey(new Date()) ? toKey(new Date()) : selected);
  if (parsed) { e.target.value = ''; openPlanForm(null, parsed, text); return; }
  addTodo(text, selected);
  setTimeout(() => { const q = $('#quickTodo'); if (q) q.focus(); }, 0);
});

$('#dvBody').addEventListener('click', (e) => {
  const t = e.target;
  const carry = t.closest('[data-carry]');
  if (carry) {
    const a = carry.dataset.carry;
    if (a === 'all') moveTodos(pendingCarry());
    else if (a === 'skip') { writePref(CARRY_KEY, toKey(new Date())); render(); }
    else openCarryPicker();
    return;
  }
  if (t.closest('[data-new-plan]')) {
    const q = $('#quickTodo');
    const parsed = q && q.value.includes(':') ? parsePlanText(q.value, selected) : null;
    openPlanForm(null, parsed, q ? q.value : '');
    return;
  }
  const todo = t.closest('[data-todo]');
  if (todo) {
    const td = todos.find((x) => x.id === todo.dataset.todo);
    if (!td) return;
    if (t.matches('input[type="checkbox"]')) { td.done = t.checked; saveTodos(); render(); }
    else if (t.closest('[data-todo-del]')) { todos = todos.filter((x) => x.id !== td.id); saveTodos(); render(); }
    else if (t.closest('[data-todo-edit]')) {
      const v = prompt('Ubah to-do:', td.text);
      if (v !== null && v.trim()) { td.text = v.trim().slice(0, 200); saveTodos(); render(); }
    }
    return;
  }
  const sess = t.closest('[data-sess]');
  if (sess) {
    const p = planById(sess.dataset.plan);
    const s = p && planDay(p, sess.dataset.day).sessions.find((x) => x.id === sess.dataset.sess);
    if (!s) return;
    if (t.closest('[data-sess-play]')) startSessionTimer(p, sess.dataset.day, s);
    else if (t.closest('[data-sess-toggle]')) { s.done = false; savePlans(); render(); }
    else openSessForm(p, sess.dataset.day, s);
    return;
  }
  const pc = t.closest('[data-plan-open]');
  if (pc) openPlanForm(planById(pc.closest('[data-plan]').dataset.plan));
});

function startSessionTimer(p, k, s) {
  const tgt = { kind: 'session', id: p.id, k, s: s.id };
  if (timer.status !== 'idle' && timer.phase === 'focus' && targetValue(timer.target) === targetValue(tgt)) {
    timer.status === 'running' ? pauseTimer() : resumeTimer();
    return;
  }
  startTimerFor(tgt);
}

// Dipanggil timer.js setiap kali sesi fokus tercatat
function onFocusLogged(rec) {
  if (!rec.sessId) return;
  const p = planById(rec.planId);
  const d = p && planDay(p, rec.k);
  const s = d && d.sessions.find((x) => x.id === rec.sessId);
  if (s && !s.done && sessLogged(s.id) >= s.min - 0.5) {
    s.done = true;
    savePlans();
    toast(`${p.title}: sesi selesai`);
  }
}

// ---------- Dialog pindahkan to-do ----------
const carryDialog = $('#carryDialog');
function openCarryPicker() {
  $('#carryList').innerHTML = pendingCarry().map((t) => `<li><label class="check"><input type="checkbox" value="${t.id}" checked>
    <span>${esc(t.text)} <small class="muted">· ${shortDate(t.date)}</small></span></label></li>`).join('');
  carryDialog.showModal();
}
$('#carryForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const ids = [...$('#carryList').querySelectorAll('input:checked')].map((x) => x.value);
  carryDialog.close();
  if (ids.length) moveTodos(todos.filter((t) => ids.includes(t.id)));
  writePref(CARRY_KEY, toKey(new Date())); // sisanya tidak ditanyakan lagi hari ini
  render();
});
$('#carryCancel').addEventListener('click', () => carryDialog.close());

// ---------- Dialog rencana kerja ----------
const planDialog = $('#planDialog');
const planForm = $('#planForm');
let draftPlan = null;   // salinan rencana yang sedang diedit
let draftStart = null;  // tanggal awal jendela 7 hari di dialog
const DUR_OPTIONS = [15, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360];

function openPlanForm(p = null, parsed = null, quickText = '') {
  draftPlan = p ? JSON.parse(JSON.stringify(p)) : { id: uid(), title: '', linkId: '', color: '', days: [], created: Date.now() };
  if (parsed) { draftPlan.title = draftPlan.title || parsed.title; draftPlan.days = parsed.days; }
  // Jendela 7 hari di dialog dimulai dari hari pertama rencana, atau dari tanggal yang sedang dibuka
  draftStart = draftPlan.days.map((d) => d.date).sort()[0] || selected || toKey(new Date());
  $('#planFormTitle').textContent = p ? 'Edit rencana kerja' : 'Rencana kerja baru';
  $('#planDeleteBtn').hidden = !p;
  planForm.quick.value = quickText;
  planForm.title.value = draftPlan.title;
  fillPlanLink();
  renderPlanDraft();
  planDialog.showModal();
  if (!p && !parsed) planForm.quick.focus();
}

function fillPlanLink() {
  const today = toKey(new Date());
  const opts = items.filter((it) => !it.weekly && cat(it.type).checkable && !it.done && it.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date)).slice(0, 60);
  const cur = draftPlan.linkId && items.find((i) => i.id === draftPlan.linkId);
  if (cur && !opts.includes(cur)) opts.unshift(cur);
  planForm.link.innerHTML = '<option value="">Tidak ditautkan</option>' +
    opts.map((it) => `<option value="${it.id}">${esc(it.title)} · ${shortDate(it.date)}</option>`).join('');
  planForm.link.value = draftPlan.linkId || '';
}

function renderPlanDraft() {
  const dates = new Set(Array.from({ length: 7 }, (_, i) => toKey(addDays(fromKey(draftStart), i))));
  for (const d of draftPlan.days) if (d.sessions.length) dates.add(d.date);
  const rows = [...dates].sort().map((k) => {
    const day = draftPlan.days.find((d) => d.date === k);
    const ss = day ? day.sessions : [];
    const load = dayLoad(k, draftPlan);
    const dd = fromKey(k);
    return `<div class="day-row${ss.length ? '' : ' off'}" data-k="${k}">
      <div class="dn">${DAYS[dd.getDay()].slice(0, 3)}<small>${dd.getDate()} ${MONTHS[dd.getMonth()].slice(0, 3)}</small></div>
      <div class="chips">${ss.map((s, i) => `<span class="chip-s" data-i="${i}">
          <select data-dur aria-label="Durasi sesi">${DUR_OPTIONS.concat(DUR_OPTIONS.includes(s.min) ? [] : [s.min]).sort((a, b) => a - b)
            .map((m) => `<option value="${m}" ${m === s.min ? 'selected' : ''}>${fmtH(m)}</option>`).join('')}</select>
          <button type="button" data-rm-sess aria-label="Hapus sesi">&#215;</button></span>`).join('')}
        <button type="button" class="add-s" data-add-sess>+ sesi</button></div>
      <span class="day-load ${loadLevel(load) === 'ok' ? '' : loadLevel(load)}" title="Total beban hari itu setelah rencana ini disimpan">${load ? fmtH(load) : '-'}</span>
    </div>`;
  }).join('');
  $('#planDays').innerHTML = rows;
  const tot = draftPlan.days.reduce((a, d) => a + d.sessions.reduce((b, s) => b + s.min, 0), 0);
  const n = draftPlan.days.filter((d) => d.sessions.length).length;
  $('#planTotal').textContent = n ? `${n} hari · ${fmtH(tot)}` : 'Belum ada sesi';
  const parsed = planForm.quick.value.trim() ? parsePlanText(planForm.quick.value, draftStart) : null;
  $('#planParseMsg').innerHTML = !planForm.quick.value.trim() ? 'Contoh: <b>Modul 3 TP: Sen 1, Sel 1, Rab 2, Kam 1</b> atau <b>Laprak: Sab 2+1+1</b>'
    : parsed ? `<span class="ok">&#10003; Terbaca: ${parsed.days.length} hari, total ${fmtH(parsed.days.reduce((a, d) => a + d.sessions.reduce((b, s) => b + s.min, 0), 0))}.</span>`
    : '<span class="warn-text">Belum terbaca. Format: Judul: Hari jam, Hari jam</span>';
}

planForm.quick.addEventListener('input', () => {
  const parsed = parsePlanText(planForm.quick.value, toKey(new Date()) > selected ? toKey(new Date()) : selected);
  if (parsed) {
    draftPlan.title = parsed.title;
    planForm.title.value = parsed.title;
    draftPlan.days = parsed.days;
    draftStart = parsed.days.map((d) => d.date).sort()[0];
  }
  renderPlanDraft();
});
planForm.title.addEventListener('input', () => { draftPlan.title = planForm.title.value; });
planForm.link.addEventListener('change', () => { draftPlan.linkId = planForm.link.value; });
$('#planPrev').addEventListener('click', () => { draftStart = toKey(addDays(fromKey(draftStart), -7)); renderPlanDraft(); });
$('#planNext').addEventListener('click', () => { draftStart = toKey(addDays(fromKey(draftStart), 7)); renderPlanDraft(); });

$('#planDays').addEventListener('click', (e) => {
  const row = e.target.closest('[data-k]');
  if (!row) return;
  const k = row.dataset.k;
  let day = draftPlan.days.find((d) => d.date === k);
  if (e.target.closest('[data-add-sess]')) {
    if (!day) { day = { date: k, sessions: [] }; draftPlan.days.push(day); }
    day.sessions.push({ id: uid(), min: 60, time: '', done: false });
  } else if (e.target.closest('[data-rm-sess]')) {
    day.sessions.splice(Number(e.target.closest('[data-i]').dataset.i), 1);
  } else return;
  renderPlanDraft();
});
$('#planDays').addEventListener('change', (e) => {
  if (!e.target.matches('[data-dur]')) return;
  const k = e.target.closest('[data-k]').dataset.k;
  const day = draftPlan.days.find((d) => d.date === k);
  day.sessions[Number(e.target.closest('[data-i]').dataset.i)].min = Number(e.target.value);
  renderPlanDraft();
});

planForm.addEventListener('submit', (e) => {
  e.preventDefault();
  draftPlan.title = planForm.title.value.trim().slice(0, 120);
  if (!draftPlan.title) { toast('Isi judul rencana.'); planForm.title.focus(); return; }
  draftPlan.days = draftPlan.days.filter((d) => d.sessions.length).sort((a, b) => a.date.localeCompare(b.date));
  if (!draftPlan.days.length) { toast('Tambahkan minimal satu sesi.'); return; }
  if (!draftPlan.color) draftPlan.color = draftPlan.linkId ? '' : PLAN_COLORS[plans.length % PLAN_COLORS.length];
  const i = plans.findIndex((p) => p.id === draftPlan.id);
  if (i >= 0) plans[i] = draftPlan; else plans.push(draftPlan);
  savePlans();
  planDialog.close();
  render();
  const over = draftPlan.days.filter((d) => loadLevel(dayLoad(d.date)) === 'over');
  toast(over.length ? `Rencana disimpan. ${over.map((d) => shortDate(d.date)).join(', ')} melebihi ${dset.loadMax} jam.` : 'Rencana disimpan');
});
$('#planCancel').addEventListener('click', () => planDialog.close());
$('#planDeleteBtn').addEventListener('click', () => {
  if (!confirm(`Hapus rencana "${draftPlan.title}"? Catatan waktu fokusnya di Timer tetap ada.`)) return;
  plans = plans.filter((p) => p.id !== draftPlan.id);
  savePlans();
  planDialog.close();
  render();
  toast('Rencana dihapus');
});

// ---------- Dialog satu sesi ----------
const sessDialog = $('#sessDialog');
const sessForm = $('#sessForm');
let editingSess = null; // { planId, k, id }

function openSessForm(p, k, s) {
  editingSess = { planId: p.id, k, id: s.id };
  const day = planDay(p, k);
  $('#sessTitle').textContent = `${p.title} · Sesi ${day.sessions.indexOf(s) + 1}`;
  $('#sessSub').textContent = `${prettyDate(k)}${sessLogged(s.id) >= 1 ? ` · sudah ${fmtH(sessLogged(s.id))} di Timer` : ''}`;
  sessForm.time.value = s.time || '';
  sessForm.dur.innerHTML = DUR_OPTIONS.concat(DUR_OPTIONS.includes(s.min) ? [] : [s.min]).sort((a, b) => a - b)
    .map((m) => `<option value="${m}" ${m === s.min ? 'selected' : ''}>${fmtH(m)}</option>`).join('');
  sessForm.done.checked = !!s.done;
  sessDialog.showModal();
}
function editingSession() {
  const p = planById(editingSess.planId);
  const d = p && planDay(p, editingSess.k);
  return { p, d, s: d && d.sessions.find((x) => x.id === editingSess.id) };
}
sessForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const { s } = editingSession();
  if (!s) { sessDialog.close(); return; }
  s.time = sessForm.time.value;
  s.min = Number(sessForm.dur.value);
  s.done = sessForm.done.checked;
  savePlans();
  sessDialog.close();
  render();
});
$('#sessClearTime').addEventListener('click', () => { sessForm.time.value = ''; });
$('#sessCancel').addEventListener('click', () => sessDialog.close());
$('#sessPlay').addEventListener('click', () => {
  const { p, s } = editingSession();
  sessDialog.close();
  if (s) startSessionTimer(p, editingSess.k, s);
});
$('#sessEditPlan').addEventListener('click', () => { const { p } = editingSession(); sessDialog.close(); if (p) openPlanForm(p); });
$('#sessDelete').addEventListener('click', () => {
  const { p, d, s } = editingSession();
  if (!s || !confirm('Hapus sesi ini?')) return;
  d.sessions = d.sessions.filter((x) => x.id !== s.id);
  p.days = p.days.filter((x) => x.sessions.length);
  if (!p.days.length) plans = plans.filter((x) => x.id !== p.id);
  savePlans();
  sessDialog.close();
  render();
});

// ---------- Pengaturan hari (jam tidur, batas beban) ----------
const daySetDialog = $('#daySetDialog');
function openDaySettings() {
  const f = $('#daySetForm');
  f.sleepStart.value = dset.sleepStart;
  f.sleepEnd.value = dset.sleepEnd;
  f.loadWarn.value = dset.loadWarn;
  f.loadMax.value = dset.loadMax;
  daySetDialog.showModal();
}
$('#daySetForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const warn = Math.min(16, Math.max(1, Number(f.loadWarn.value) || 8));
  const max = Math.min(18, Math.max(warn, Number(f.loadMax.value) || 10));
  dset = { sleepStart: f.sleepStart.value || '23:00', sleepEnd: f.sleepEnd.value || '06:00', loadWarn: warn, loadMax: max };
  saveDset();
  daySetDialog.close();
  render();
  toast('Pengaturan hari disimpan');
});
$('#daySetCancel').addEventListener('click', () => daySetDialog.close());
$('#daySetMenuBtn').addEventListener('click', () => { menu.hidden = true; openDaySettings(); });

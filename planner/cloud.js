'use strict';
// ---------- Cloud: akun dan sinkronisasi (Supabase) ----------
// Setiap data (item, kategori, matkul, lomba, sesi timer, file, dll.) disimpan sebagai satu baris di
// tabel planner_records. Yang dikirim hanya baris yang berubah sejak sinkron terakhir, dideteksi dengan
// membandingkan hash tiap data dengan "shadow" (hash saat terakhir tersinkron). Aplikasi tetap bekerja
// offline; perubahan dikirim begitu online lagi. Kalau dua perangkat mengubah data yang sama,
// perubahan terakhir yang menang.

const CLOUD_CFG_KEY = 'elio-cloud-config';
const SYNC_STATE_KEY = 'elio-sync-state-v1';
const SUPABASE_JS = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
  'https://unpkg.com/@supabase/supabase-js@2.45.4/dist/umd/supabase.js',
];
const RECORDS_TABLE = 'planner_records';
const FILES_BUCKET = 'planner-files';
const FREE_STORAGE = 1024 * 1024 * 1024; // kuota file paket gratis Supabase
const SETUP_GUIDE = 'https://github.com/melkiyunus05/melkiyunus05.github.io/blob/main/planner/SETUP-CLOUD.md';

let cloudCfg = readJSON(CLOUD_CFG_KEY, null);
let sb = null;
let cloudUser = null;
let syncState = readJSON(SYNC_STATE_KEY, null) || { last: null, shadow: {}, uid: null, at: 0 };
let syncStatus = 'off'; // off | signedout | syncing | idle | offline | error
let syncError = '';
let syncing = false, syncAgain = false, pushTimer = null;

// ---------- Data yang disinkronkan ----------
// records(): ubah state lokal menjadi daftar { id, ... }. apply(list): pasang kembali dari daftar.
const ordered = (list) => list.map((x, i) => ({ ...x, __pos: i }));
const unordered = (list) => [...list].sort((a, b) => (a.__pos ?? 0) - (b.__pos ?? 0)).map(({ __pos, ...x }) => x);
const SYNC_COLLECTIONS = {
  items: { records: () => items, apply: (l) => { items = l; save(); } },
  cats: { records: () => ordered(cats), apply: (l) => { if (l.length) { cats = unordered(l).map(cleanCat); saveCats(); buildTypePicker(); renderLegend(); } } },
  courses: { records: () => courses, apply: (l) => { courses = l.map(cleanCourse); saveCourses(); } },
  comps: { records: () => comps, apply: (l) => { comps = l.map(cleanComp); saveComps(); } },
  sessions: { records: () => sessions, apply: (l) => { sessions = l; saveSessions(); } },
  focus: {
    records: () => Object.entries(focus).map(([id, list]) => ({ id, list })),
    apply: (l) => { focus = Object.fromEntries(l.filter((r) => Array.isArray(r.list)).map((r) => [r.id, r.list])); saveFocus(); },
  },
  settings: {
    records: () => [{ id: 'timer', ...tset }],
    apply: (l) => { const t = l.find((r) => r.id === 'timer'); if (t) { const { id, ...rest } = t; tset = { ...DEFAULT_TSET, ...rest }; writeJSON(TSET_KEY, tset); } },
  },
  fileKinds: { records: () => ordered(fileKinds), apply: (l) => { if (l.length) { fileKinds = unordered(l); saveFileKinds(); } } },
  files: { records: () => files, apply: (l) => { files = l; saveFiles(); } },
};

// JSON dengan urutan key tetap, supaya hash sama walaupun database (jsonb) mengubah urutan key
function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  return JSON.stringify(v ?? null);
}
function hashOf(v) {
  const s = stableStringify(v);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36) + s.length.toString(36);
}
function saveSyncState() { writeJSON(SYNC_STATE_KEY, syncState); }

// Dipanggil setiap kali data lokal disimpan
function syncDirty() {
  if (!cloudUser) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(syncNow, 1500);
}

async function syncNow() {
  if (!sb || !cloudUser) return;
  if (syncing) { syncAgain = true; return; }
  if (!navigator.onLine) { setSyncStatus('offline'); return; }
  syncing = true;
  setSyncStatus('syncing');
  try {
    // Sinkron pertama di perangkat ini: ambil dulu dari cloud supaya data bawaan perangkat baru
    // (kategori default, pengaturan timer) tidak menimpa data yang sudah diatur di perangkat lain
    if (!syncState.last) { await pullChanges(); await pushChanges(); }
    else { await pushChanges(); await pullChanges(); }
    syncState.at = Date.now();
    saveSyncState();
    setSyncStatus('idle');
  } catch (e) {
    syncError = (e && e.message) || String(e);
    setSyncStatus(navigator.onLine ? 'error' : 'offline');
  }
  syncing = false;
  if (syncAgain) { syncAgain = false; syncNow(); }
}

async function pushChanges() {
  const rows = [];
  const nextShadow = {};
  for (const [col, def] of Object.entries(SYNC_COLLECTIONS)) {
    const old = syncState.shadow[col] || {};
    const now = {};
    for (const r of def.records()) {
      if (!r || r.id === undefined || r.id === null || r.id === '') continue;
      const id = String(r.id);
      const h = hashOf(r);
      now[id] = h;
      if (old[id] !== h) rows.push({ user_id: cloudUser.id, collection: col, id, data: r, deleted: false });
    }
    for (const id of Object.keys(old)) if (!(id in now)) rows.push({ user_id: cloudUser.id, collection: col, id, data: null, deleted: true });
    nextShadow[col] = now;
  }
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from(RECORDS_TABLE).upsert(rows.slice(i, i + 500), { onConflict: 'user_id,collection,id' });
    if (error) throw error;
  }
  syncState.shadow = nextShadow;
  saveSyncState();
}

async function pullChanges() {
  // Ambil dengan jeda tumpang-tindih 5 menit supaya perubahan dari perangkat lain yang tersimpan
  // hampir bersamaan tidak terlewat. Baris yang sudah sama dilewati lewat hash.
  const since = syncState.last ? new Date(Date.parse(syncState.last) - 5 * 60000).toISOString() : null;
  const changes = {};
  let maxTs = syncState.last;
  for (let page = 0; ; page++) {
    let q = sb.from(RECORDS_TABLE).select('collection,id,data,deleted,updated_at');
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q.order('updated_at', { ascending: true }).range(page * 1000, page * 1000 + 999);
    if (error) throw error;
    for (const row of data) {
      if (!SYNC_COLLECTIONS[row.collection]) continue;
      (changes[row.collection] = changes[row.collection] || []).push(row);
      if (!maxTs || row.updated_at > maxTs) maxTs = row.updated_at;
    }
    if (data.length < 1000) break;
  }
  let touched = false;
  for (const [col, rows] of Object.entries(changes)) {
    const def = SYNC_COLLECTIONS[col];
    const shadow = syncState.shadow[col] = syncState.shadow[col] || {};
    const local = new Map(def.records().map((r) => [String(r.id), r]));
    let changed = false;
    for (const row of rows) {
      if (row.deleted) {
        if (local.has(row.id)) { local.delete(row.id); changed = true; }
        delete shadow[row.id];
      } else {
        const h = hashOf(row.data);
        if (shadow[row.id] === h && local.has(row.id)) continue; // sudah sama
        local.set(row.id, row.data);
        shadow[row.id] = h;
        changed = true;
      }
    }
    if (changed) { def.apply([...local.values()]); touched = true; }
  }
  syncState.last = maxTs;
  saveSyncState();
  if (touched) render();
}

// ---------- Koneksi dan akun ----------
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function loadSupabase() {
  if (window.supabase && window.supabase.createClient) return;
  for (const src of SUPABASE_JS) {
    try { await loadScript(src); if (window.supabase && window.supabase.createClient) return; } catch {}
  }
  throw new Error('Gagal memuat koneksi cloud. Periksa internet kamu.');
}

function parseConnectCode(text) {
  text = String(text || '').trim();
  const m = text.match(/#connect=([\w\-+/=%]+)/);
  const code = m ? decodeURIComponent(m[1]) : text;
  try {
    const cfg = JSON.parse(atob(code.replace(/-/g, '+').replace(/_/g, '/')));
    if (cfg && cfg.u && cfg.k) return { url: cfg.u, key: cfg.k };
  } catch {}
  return null;
}
function connectCode() {
  return btoa(JSON.stringify({ u: cloudCfg.url, k: cloudCfg.key })).replace(/\+/g, '-').replace(/\//g, '_');
}
function connectLink() { return `${location.origin}${location.pathname}#connect=${connectCode()}`; }

// Link koneksi dari perangkat lain: ...#connect=KODE
function takeConnectHash() {
  if (!location.hash.startsWith('#connect=')) return false;
  const cfg = parseConnectCode(location.hash);
  history.replaceState(null, '', location.pathname + location.search);
  if (!cfg) { toast('Link koneksi tidak valid.'); return false; }
  cloudCfg = cfg;
  writeJSON(CLOUD_CFG_KEY, cfg);
  toast('Cloud terhubung. Masuk dengan akunmu untuk mulai sinkron.');
  setTimeout(openCloudDialog, 400);
  return true;
}

async function initCloud() {
  takeConnectHash();
  if (!cloudCfg) { setSyncStatus('off'); return; }
  try { await loadSupabase(); } catch (e) { syncError = e.message; setSyncStatus('offline'); return; }
  sb = window.supabase.createClient(cloudCfg.url, cloudCfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'elio-cloud-auth' },
  });
  const { data } = await sb.auth.getSession();
  setUser(data && data.session ? data.session.user : null);
  sb.auth.onAuthStateChange((_event, session) => setUser(session ? session.user : null));
}

function setUser(user) {
  const before = cloudUser && cloudUser.id;
  cloudUser = user;
  if (!user) { setSyncStatus('signedout'); return; }
  if (user.id === before) return;
  // Akun lain di perangkat yang sama: mulai sinkron dari awal
  if (syncState.uid && syncState.uid !== user.id) syncState = { last: null, shadow: {}, uid: user.id, at: 0 };
  syncState.uid = user.id;
  saveSyncState();
  syncNow();
}

function setSyncStatus(s) {
  syncStatus = s;
  const b = $('#cloudBtn');
  if (b) {
    b.dataset.state = s;
    b.title = {
      off: 'Cloud belum terhubung', signedout: 'Belum masuk akun', syncing: 'Menyinkronkan...',
      idle: 'Tersinkron', offline: 'Offline, perubahan akan dikirim saat online', error: 'Sinkron gagal',
    }[s];
  }
  if (cloudDialog.open) renderCloudDialog();
}

const AUTH_ERRORS = {
  'Invalid login credentials': 'Email atau password salah.',
  'Email not confirmed': 'Email belum dikonfirmasi. Buka link konfirmasi di inbox kamu dulu.',
  'User already registered': 'Email ini sudah terdaftar. Silakan Masuk.',
  'Signups not allowed for this instance': 'Pendaftaran akun baru dimatikan di project ini.',
};
function authMsg(e) {
  const m = (e && e.message) || String(e);
  for (const [k, v] of Object.entries(AUTH_ERRORS)) if (m.includes(k)) return v;
  if (/password/i.test(m) && /6/.test(m)) return 'Password minimal 6 karakter.';
  return m;
}

// ---------- Dialog akun ----------
const cloudDialog = $('#cloudDialog');
function openCloudDialog() { menu.hidden = true; renderCloudDialog(); if (!cloudDialog.open) cloudDialog.showModal(); }

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toLocaleString('id-ID', { maximumFractionDigits: 0 })} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toLocaleString('id-ID', { maximumFractionDigits: 1 })} MB`;
  return `${(n / 1024 ** 3).toLocaleString('id-ID', { maximumFractionDigits: 2 })} GB`;
}

function renderCloudDialog() {
  const body = $('#cloudBody');
  if (!cloudCfg) {
    body.innerHTML = `<p>Hubungkan ke cloud supaya kalender, matkul, lomba, timer, dan <b>file</b> tersinkron otomatis antara laptop dan tablet.</p>
      <ol class="steps">
        <li>Buat project Supabase gratis dan jalankan skrip pengaturannya. <a href="${SETUP_GUIDE}" target="_blank" rel="noopener">Buka panduan langkah demi langkah</a></li>
        <li>Tempel <b>Project URL</b> dan <b>anon / publishable key</b> di bawah.</li>
      </ol>
      <label>Project URL<input id="cfgUrl" inputmode="url" placeholder="https://xxxxxxxx.supabase.co" autocomplete="off"></label>
      <label>Anon / publishable key<input id="cfgKey" placeholder="eyJhbGciOi... atau sb_publishable_..." autocomplete="off"></label>
      <p class="form-note">Sudah menghubungkan perangkat lain? Tempel <b>kode koneksi</b> dari perangkat itu di kolom Project URL.</p>
      <div class="form-actions"><span class="spacer"></span><button type="button" class="btn ghost" data-cloud="close">Tutup</button><button type="button" class="btn primary" data-cloud="connect">Hubungkan</button></div>`;
    return;
  }
  const host = cloudCfg.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!sb) {
    body.innerHTML = `<p>Project <b>${esc(host)}</b> belum bisa dihubungi.</p>
      <p class="warn-text">${esc(syncError || 'Periksa koneksi internet kamu.')}</p>
      <p class="form-note">Aplikasi tetap bisa dipakai seperti biasa. Perubahan akan disinkronkan setelah terhubung.</p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-cloud="disconnect">Ganti project</button><span class="spacer"></span>
        <button type="button" class="btn ghost" data-cloud="close">Tutup</button>
        <button type="button" class="btn primary" data-cloud="retry">Coba lagi</button>
      </div>`;
    return;
  }
  if (!cloudUser) {
    body.innerHTML = `<p>Terhubung ke project <b>${esc(host)}</b>. Masuk untuk mulai sinkron.</p>
      ${syncStatus === 'offline' ? `<p class="warn-text">${esc(syncError || 'Sedang offline.')}</p>` : ''}
      <label>Email<input id="authEmail" type="email" autocomplete="email" placeholder="nama@ui.ac.id"></label>
      <label>Password<input id="authPass" type="password" autocomplete="current-password" placeholder="minimal 6 karakter"></label>
      <p class="form-note" id="authMsg"></p>
      <div class="form-actions">
        <button type="button" class="btn ghost" data-cloud="disconnect">Ganti project</button><span class="spacer"></span>
        <button type="button" class="btn" data-cloud="signup">Daftar akun baru</button>
        <button type="button" class="btn primary" data-cloud="signin">Masuk</button>
      </div>`;
    return;
  }
  const used = files.reduce((a, f) => a + (f.size || 0), 0);
  const statusTxt = {
    syncing: 'Menyinkronkan...',
    idle: `Tersinkron${syncState.at ? ` · terakhir ${new Date(syncState.at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''}`,
    offline: 'Offline. Perubahan akan dikirim otomatis saat online.',
    error: `Sinkron gagal: ${esc(syncError)}`,
  }[syncStatus] || '';
  body.innerHTML = `<p>Masuk sebagai <b>${esc(cloudUser.email || '')}</b></p>
    <div class="sync-status" data-state="${syncStatus}"><span class="dot"></span>${statusTxt}</div>
    <div class="usage"><div class="usage-head"><span>Penyimpanan file</span><span>${fmtBytes(used)} dari ${fmtBytes(FREE_STORAGE)}</span></div>
      <div class="goal-bar"><i style="width:${Math.min(100, used / FREE_STORAGE * 100)}%"></i></div></div>
    <div class="connect-box">
      <b>Hubungkan tablet atau perangkat lain</b>
      <p class="form-note">Kirim link ini ke perangkat lain lalu buka. Untuk aplikasi yang sudah di-install di iPad, salin <b>kode</b>-nya lalu tempel di kolom Project URL. Setelah itu masuk dengan akun yang sama.</p>
      <div class="connect-actions"><button type="button" class="btn small" data-cloud="copylink">Salin link koneksi</button><button type="button" class="btn small" data-cloud="copycode">Salin kode</button></div>
    </div>
    <div class="form-actions">
      <button type="button" class="btn ghost" data-cloud="signout">Keluar</button><span class="spacer"></span>
      <button type="button" class="btn ghost" data-cloud="close">Tutup</button>
      <button type="button" class="btn primary" data-cloud="sync">Sinkron sekarang</button>
    </div>`;
}

async function copyText(t, okMsg) {
  try { await navigator.clipboard.writeText(t); toast(okMsg); }
  catch { prompt('Salin teks ini:', t); }
}

cloudDialog.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-cloud]');
  if (!b) return;
  const a = b.dataset.cloud;
  const msg = (t) => { const el = $('#authMsg'); if (el) el.textContent = t; };
  if (a === 'close') cloudDialog.close();
  else if (a === 'connect') {
    const urlIn = $('#cfgUrl').value.trim();
    const fromCode = parseConnectCode(urlIn);
    const url = fromCode ? fromCode.url : urlIn.replace(/\/+$/, '');
    const key = fromCode ? fromCode.key : $('#cfgKey').value.trim();
    if (!/^https:\/\/[\w.-]+/.test(url) || key.length < 20) { toast('Isi Project URL dan key dengan benar.'); return; }
    cloudCfg = { url, key };
    writeJSON(CLOUD_CFG_KEY, cloudCfg);
    b.disabled = true;
    await initCloud();
    renderCloudDialog();
  } else if (a === 'disconnect') {
    if (!confirm('Putuskan dari project ini? Data di perangkat ini tetap ada.')) return;
    try { if (sb) await sb.auth.signOut(); } catch {}
    cloudCfg = null; sb = null; cloudUser = null;
    localStorage.removeItem(CLOUD_CFG_KEY);
    syncState = { last: null, shadow: {}, uid: null, at: 0 };
    saveSyncState();
    setSyncStatus('off');
    renderCloudDialog();
  } else if (a === 'signin' || a === 'signup') {
    const email = $('#authEmail').value.trim(), password = $('#authPass').value;
    if (!email || !password) { msg('Isi email dan password.'); return; }
    b.disabled = true;
    msg(a === 'signin' ? 'Masuk...' : 'Mendaftarkan...');
    try {
      if (a === 'signin') {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast('Berhasil masuk. Menyinkronkan data...');
        renderCloudDialog();
      } else {
        const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        if (data && data.session) { toast('Akun dibuat dan sudah masuk.'); renderCloudDialog(); }
        else msg('Akun dibuat. Buka email konfirmasi dari Supabase, klik link-nya, lalu kembali ke sini dan tekan Masuk.');
      }
    } catch (err) { msg(authMsg(err)); }
    b.disabled = false;
  } else if (a === 'signout') {
    if (!confirm('Keluar dari akun? Data di perangkat ini tetap ada, hanya tidak tersinkron lagi.')) return;
    await sb.auth.signOut();
    renderCloudDialog();
  } else if (a === 'sync') syncNow();
  else if (a === 'retry') { b.disabled = true; await initCloud(); renderCloudDialog(); }
  else if (a === 'copylink') copyText(connectLink(), 'Link koneksi disalin');
  else if (a === 'copycode') copyText(connectCode(), 'Kode koneksi disalin');
});

$('#cloudBtn').addEventListener('click', openCloudDialog);
$('#cloudMenuBtn').addEventListener('click', openCloudDialog);
window.addEventListener('hashchange', () => { if (location.hash.startsWith('#connect=')) initCloud(); });
window.addEventListener('online', () => { if (cloudCfg && !sb) initCloud(); else syncNow(); });
window.addEventListener('offline', () => { if (cloudUser) setSyncStatus('offline'); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
setInterval(() => { if (cloudUser && !document.hidden) syncNow(); }, 60000);

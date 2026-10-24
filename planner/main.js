'use strict';
// Dimuat paling akhir, setelah app.js, courses.js, dan comps.js

// ---------- Init ----------
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch {}
buildTypePicker();
renderLegend();
applyMode();
setPage(page);
updateNotifBtn();
checkReminders();
setInterval(checkReminders, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkReminders(); });

// Ganti hari otomatis kalau aplikasi dibiarkan terbuka melewati tengah malam
let lastDay = toKey(new Date());
setInterval(() => {
  const now = toKey(new Date());
  if (now !== lastDay) { lastDay = now; render(); }
}, 60000);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

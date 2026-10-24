'use strict';
// Dimuat paling akhir, setelah app.js, courses.js, comps.js, timer.js, files.js, dan cloud.js

// ---------- Init ----------
try { applyTheme(localStorage.getItem(THEME_KEY)); } catch {}
buildTypePicker();
renderLegend();
applyMode();
tickTimer(); // selesaikan fase timer yang habis saat aplikasi tertutup
setPage(page);
setInterval(tickTimer, 1000);
updateNotifBtn();
initCloud();
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

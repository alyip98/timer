const $ = id => document.getElementById(id);
const els = { time: $('time'), bar: $('bar'), h: $('h'), m: $('m'), s: $('s'), start: $('start'), reset: $('reset'), float: $('float'), note: $('note'), install: $('install'), root: document.querySelector('.app') };

const state = { mode: 'timer', running: false, total: 0, remaining: 0, elapsed: 0, endAt: 0, startAt: 0, tick: null };
let pip = null; // { win, time, bar, start }

const pad = n => String(n).padStart(2, '0');
function fmt(ms) {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(s % 60);
}
const inputMs = () => ((+els.h.value || 0) * 3600 + (+els.m.value || 0) * 60 + (+els.s.value || 0)) * 1000;

function current() {
  if (state.mode === 'stopwatch') return state.running ? state.elapsed + Date.now() - state.startAt : state.elapsed;
  return state.running ? Math.max(0, state.endAt - Date.now()) : state.remaining;
}

function render() {
  const ms = current();
  const text = fmt(state.mode === 'stopwatch' ? Math.floor(ms / 1000) * 1000 : ms);
  const frac = state.mode === 'timer' && state.total ? ms / state.total : 1;
  const finished = state.mode === 'timer' && state.total > 0 && ms === 0 && !state.running;
  els.time.textContent = text;
  els.bar.style.transform = `scaleX(${frac})`;
  els.start.textContent = state.running ? 'Pause' : (state.mode === 'timer' && state.remaining > 0 && state.remaining < state.total) || (state.mode === 'stopwatch' && state.elapsed) ? 'Resume' : 'Start';
  els.root.classList.toggle('running', state.running || (state.mode === 'timer' && state.remaining > 0 && state.remaining < state.total));
  els.root.classList.toggle('stopwatch', state.mode === 'stopwatch');
  els.root.classList.toggle('done', finished);
  document.title = state.running || finished ? `${text} · Float Timer` : 'Float Timer';
  if (pip) {
    pip.time.textContent = text;
    pip.bar.style.transform = `scaleX(${frac})`;
    pip.start.textContent = state.running ? '⏸' : '▶';
    pip.win.document.body.classList.toggle('done', finished);
  }
  return ms;
}

function loop() {
  const ms = render();
  if (state.mode === 'timer' && state.running && ms === 0) { state.running = false; state.remaining = 0; clearInterval(state.tick); render(); finish(); }
}

function start() {
  if (state.running) return;
  if (state.mode === 'timer') {
    if (state.remaining <= 0) { state.total = state.remaining = inputMs(); }
    if (state.remaining <= 0) return;
    state.endAt = Date.now() + state.remaining;
  } else state.startAt = Date.now();
  state.running = true;
  state.tick = setInterval(loop, 200);
  loop();
}

function pause() {
  if (!state.running) return;
  if (state.mode === 'timer') state.remaining = Math.max(0, state.endAt - Date.now());
  else state.elapsed += Date.now() - state.startAt;
  state.running = false;
  clearInterval(state.tick);
  render();
}

function reset() {
  pause();
  state.remaining = 0; state.elapsed = 0; state.total = 0;
  if (state.mode === 'timer') { els.time.textContent = fmt(inputMs()); }
  render();
  if (state.mode === 'timer') { els.time.textContent = fmt(inputMs()); if (pip) pip.time.textContent = fmt(inputMs()); }
}

function toggle() { state.running ? pause() : start(); }

function finish() {
  try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch {}
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.25, 0.5].forEach(t => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.2, ctx.currentTime + t); g.gain.setValueAtTime(0, ctx.currentTime + t + 0.15);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {}
  if ('Notification' in window && Notification.permission === 'granted') new Notification('Timer finished', { icon: 'icon-192.png' });
}

els.start.onclick = () => {
  if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  toggle();
};
els.reset.onclick = reset;
[els.h, els.m, els.s].forEach(i => i.oninput = () => { if (!state.running && !state.remaining) { els.time.textContent = fmt(inputMs()); } });
document.querySelectorAll('.presets button').forEach(b => b.onclick = () => {
  const min = +b.dataset.min; els.h.value = Math.floor(min / 60); els.m.value = min % 60; els.s.value = 0;
  reset();
});
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  if (b.dataset.mode === state.mode) return;
  pause(); reset();
  state.mode = b.dataset.mode;
  document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  reset();
});

// ---- Always on top: Document Picture-in-Picture (Chromium 116+) ----
async function openFloat() {
  if (pip) { pip.win.close(); return; }
  if (!('documentPictureInPicture' in window)) { els.note.textContent = 'Always-on-top needs a Chromium browser (Chrome, Edge, Brave) on desktop.'; return; }
  try {
    const win = await documentPictureInPicture.requestWindow({ width: 260, height: 130 });
    for (const sheet of document.styleSheets) {
      const link = win.document.createElement('link');
      link.rel = 'stylesheet'; link.href = sheet.href; win.document.head.append(link);
    }
    win.document.body.classList.add('pip');
    win.document.body.append($('mini-tpl').content.cloneNode(true));
    const q = s => win.document.querySelector(s);
    pip = { win, time: q('.mini-time'), bar: q('.mini-bar'), start: q('.mini-start') };
    q('.mini-start').onclick = toggle;
    q('.mini-reset').onclick = reset;
    q('.mini-back').onclick = () => win.close();
    win.addEventListener('pagehide', () => { pip = null; els.float.hidden = false; window.focus(); });
    els.note.textContent = 'Floating. Close the small window or press ⤢ to come back.';
    render();
  } catch (e) {
    els.note.textContent = 'Could not open the floating window: ' + e.message;
  }
}
els.float.onclick = openFloat;
if (!('documentPictureInPicture' in window)) els.note.textContent = 'Tip: open in Chrome or Edge on desktop to use Always on top.';

// Auto-minimize to the floating window when the user switches away while a timer runs
if ('documentPictureInPicture' in window && 'mediaSession' in navigator) {
  try { navigator.mediaSession.setActionHandler('enterpictureinpicture', () => { if (!pip) openFloat(); }); } catch {}
}

// ---- Install + service worker ----
let deferred;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; els.install.hidden = false; });
els.install.onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; els.install.hidden = true; };
window.addEventListener('appinstalled', () => els.install.hidden = true);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

reset();

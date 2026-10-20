// Bump together with the release tag (the desktop build takes its version from the tag).
const VERSION = '1.2.0';

const $ = id => document.getElementById(id);
const els = { sound: $('sound'), time: $('time'), bar: $('bar'), start: $('start'), clear: $('clear'), float: $('float'), note: $('note'), install: $('install'), root: document.querySelector('.app') };

const state = { mode: 'timer', running: false, total: 0, remaining: 0, elapsed: 0, endAt: 0, startAt: 0, tick: null };
let pip = null; // { win, time, start }

const pad = n => String(n).padStart(2, '0');
function fmt(ms) {
  const s = Math.ceil(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
  return (h ? pad(h) + ':' : '') + pad(m) + ':' + pad(s % 60);
}

// "5:30", "1:02:03" or bare digits typed calculator-style ("130" -> 1:30). Returns ms or null.
function parseTime(str) {
  str = str.trim();
  if (!str) return 0;
  let parts;
  if (str.includes(':')) {
    parts = str.split(':').map(p => p.trim() === '' ? 0 : Number(p));
  } else {
    const d = str.replace(/\D/g, '').padStart(6, '0').slice(-6);
    if (!/^\d+$/.test(str)) return null;
    parts = [+d.slice(0, 2), +d.slice(2, 4), +d.slice(4)];
  }
  if (parts.length > 3 || parts.some(n => !Number.isFinite(n) || n < 0)) return null;
  while (parts.length < 3) parts.unshift(0);
  return ((parts[0] * 60 + parts[1]) * 60 + parts[2]) * 1000;
}

function current() {
  if (state.mode === 'stopwatch') return state.running ? state.elapsed + Date.now() - state.startAt : state.elapsed;
  return state.running ? Math.max(0, state.endAt - Date.now()) : state.remaining;
}

function render() {
  const ms = current();
  const text = fmt(state.mode === 'stopwatch' ? Math.floor(ms / 1000) * 1000 : ms);
  const frac = state.mode === 'timer' && state.total ? Math.min(1, ms / state.total) : 1;
  const finished = state.mode === 'timer' && state.total > 0 && ms === 0 && !state.running;
  if (document.activeElement !== els.time) els.time.value = text;
  els.bar.style.transform = `scaleX(${frac})`;
  const paused = (state.mode === 'timer' && state.remaining > 0 && state.remaining < state.total) || (state.mode === 'stopwatch' && state.elapsed > 0);
  els.start.textContent = state.running ? 'Pause' : paused ? 'Resume' : 'Start';
  els.root.classList.toggle('stopwatch', state.mode === 'stopwatch');
  els.root.classList.toggle('done', finished);
  document.title = state.running || finished ? `${text} · Float Timer` : 'Float Timer';
  if (pip) {
    if (pip.win.document.activeElement !== pip.time) pip.time.value = text;
    pip.start.textContent = state.running ? '⏸' : '▶';
    pip.fill.style.transform = `scaleX(${state.mode === 'timer' ? frac : 0})`;
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

// Set the clock to an exact value without stopping it if it is running.
function setTime(ms) {
  if (state.mode === 'stopwatch') {
    if (state.running) state.startAt = Date.now(), state.elapsed = ms; else state.elapsed = ms;
  } else {
    state.total = state.remaining = ms;
    if (state.running) { if (ms > 0) state.endAt = Date.now() + ms; else pause(); }
  }
  render();
}

// Presets add to the clock, running or not.
function addTime(ms) {
  if (state.mode !== 'timer') return;
  const left = current();
  if (state.running) { state.endAt += ms; state.total += ms; }
  else if (left === 0) { state.total = state.remaining = ms; }
  else { state.remaining += ms; state.total += ms; }
  render();
}

function clear() {
  pause();
  state.remaining = 0; state.elapsed = 0; state.total = 0;
  render();
}

function toggle() { state.running ? pause() : start(); }

let soundOn = true;
try { soundOn = localStorage.getItem('soundOn') !== '0'; } catch {}
function renderSound() {
  els.sound.textContent = soundOn ? '🔔 Alarm sound: on' : '🔕 Alarm sound: off';
  els.sound.setAttribute('aria-pressed', soundOn);
}
els.sound.onclick = () => {
  soundOn = !soundOn;
  try { localStorage.setItem('soundOn', soundOn ? '1' : '0'); } catch {}
  renderSound();
};
renderSound();

function finish() {
  try { navigator.vibrate && navigator.vibrate([300, 150, 300]); } catch {}
  if (soundOn) try {
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
els.clear.onclick = clear;

// Editable clock (main and floating): Enter/blur applies, Escape cancels.
function bindClock(input) {
  input.onfocus = () => input.select();
  input.onkeydown = e => {
    if (e.key === 'Enter') input.blur();
    if (e.key === 'Escape') { input.value = fmt(current()); input.blur(); }
  };
  input.onblur = () => {
    const ms = parseTime(input.value);
    if (ms !== null) setTime(ms);
    input.value = fmt(current());
    render();
  };
}
bindClock(els.time);

document.querySelectorAll('.presets button').forEach(b => b.onclick = () => addTime(+b.dataset.min * 60000));
document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
  if (b.dataset.mode === state.mode) return;
  clear();
  state.mode = b.dataset.mode;
  document.querySelectorAll('.tabs button').forEach(x => x.setAttribute('aria-selected', x === b));
  render();
});

// ---- Keyboard shortcuts: Space start/pause, R clear (ignored while typing in the clock) ----
function bindKeys(doc) {
  const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  doc.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) { if (e.target.blur) e.target.blur(); toggle(); } }
    else if (e.code === 'KeyR' && !e.repeat) { e.preventDefault(); clear(); }
  });
  // stop a focused button from also "clicking" on Space release
  doc.addEventListener('keyup', e => { if (e.code === 'Space' && !typing(e.target)) e.preventDefault(); });
}
bindKeys(document);

// ---- Always on top: Document Picture-in-Picture (Chromium 116+) ----
function enterDesktopMini() {
  const root = $('mini-root');
  root.append($('mini-tpl').content.cloneNode(true));
  document.body.classList.add('pip');
  els.root.hidden = true; root.hidden = false;
  pip = { win: window, fill: root.querySelector('.mini-fill'), time: root.querySelector('.mini-time'), start: root.querySelector('.mini-start') };
  bindClock(pip.time);
  pip.start.onclick = toggle;
  root.ondblclick = e => { if (e.target === root.firstElementChild || e.target === root) exitDesktopMini(); };
  window.desktop.setMini(true);
  render();
}
function exitDesktopMini() {
  const root = $('mini-root');
  root.replaceChildren(); root.hidden = true; els.root.hidden = false;
  document.body.classList.remove('pip');
  pip = null;
  window.desktop.setMini(false);
  render();
}

async function openFloat() {
  if (window.desktop) { pip ? exitDesktopMini() : enterDesktopMini(); return; }
  if (pip) { pip.win.close(); return; }
  if (!('documentPictureInPicture' in window)) { els.note.textContent = 'Always-on-top needs a Chromium browser (Chrome, Edge, Brave) on desktop.'; return; }
  try {
    const win = await documentPictureInPicture.requestWindow({ width: 240, height: 64 });
    for (const sheet of document.styleSheets) {
      const link = win.document.createElement('link');
      link.rel = 'stylesheet'; link.href = sheet.href; win.document.head.append(link);
    }
    win.document.body.classList.add('pip');
    win.document.body.append($('mini-tpl').content.cloneNode(true));
    const q = s => win.document.querySelector(s);
    pip = { win, fill: q('.mini-fill'), time: q('.mini-time'), start: q('.mini-start') };
    bindClock(pip.time);
    bindKeys(win.document);
    q('.mini-start').onclick = toggle;
    win.addEventListener('pagehide', () => { pip = null; els.float.hidden = false; window.focus(); });
    els.note.textContent = 'Floating. Close the small window to come back.';
    render();
  } catch (e) {
    els.note.textContent = 'Could not open the floating window: ' + e.message;
  }
}
els.float.onclick = openFloat;
if (window.desktop) { document.body.classList.add('electron'); els.note.textContent = 'Always on top shrinks to a small floating clock. Double-click beside the time to restore.'; }
else if (!('documentPictureInPicture' in window)) els.note.textContent = 'Tip: open in Chrome or Edge on desktop to use Always on top.';

// Auto-minimize to the floating window when the user switches away while a timer runs
if (!window.desktop && 'documentPictureInPicture' in window && 'mediaSession' in navigator) {
  try { navigator.mediaSession.setActionHandler('enterpictureinpicture', () => { if (!pip) openFloat(); }); } catch {}
}

// ---- Install + service worker ----
let deferred;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; els.install.hidden = false; });
els.install.onclick = async () => { if (!deferred) return; deferred.prompt(); await deferred.userChoice; deferred = null; els.install.hidden = true; };
window.addEventListener('appinstalled', () => els.install.hidden = true);
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});

render();

if (window.desktop) {
  $('win-min').onclick = () => window.desktop.minimize();
  $('win-close').onclick = () => window.desktop.close();
}

// ---- Desktop: configurable global show/hide shortcut ----
if (window.desktop) {
  const box = $('hotkey'), btn = $('hotkey-btn'), hint = $('hotkey-hint');
  const mac = /Mac/.test(navigator.platform);
  const label = a => a.split('+').map(k => (mac ? { Alt: 'Option', Ctrl: 'Control', Cmd: 'Command' } : {})[k] || k).join('+');
  const setHint = (info, error) => {
    hint.classList.toggle('error', !!error);
    hint.textContent = error || (info.holdSupported ? 'Tap to toggle the floating clock, hold to peek.' : 'Tap to toggle the floating clock. Hold-to-peek needs ' + (mac ? 'Accessibility permission (System Settings > Privacy & Security).' : 'X11/Windows input access.'));
  };
  const show = info => { btn.textContent = label(info.accelerator); setHint(info); };
  box.hidden = false;
  window.desktop.getHotkey().then(show);

  const KEYS = { ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right', Space: 'Space', Enter: 'Enter', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert' };
  const keyName = code => KEYS[code] || (/^Key[A-Z]$/.test(code) ? code.slice(3) : /^Digit\d$/.test(code) ? code.slice(5) : /^F\d{1,2}$/.test(code) ? code : null);

  let recording = false, before = '';
  const stop = () => { recording = false; btn.classList.remove('recording'); window.removeEventListener('keydown', onKey, true); };
  async function onKey(e) {
    e.preventDefault(); e.stopPropagation();
    if (e.key === 'Escape') { btn.textContent = before; stop(); return; }
    const name = keyName(e.code);
    if (!name) return; // modifier alone, keep listening
    if (!(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey)) { hint.classList.add('error'); hint.textContent = 'Include at least one modifier (Ctrl, Alt, Shift or Cmd).'; return; }
    const accel = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Cmd', name].filter(Boolean).join('+');
    stop();
    const res = await window.desktop.setHotkey(accel);
    if (res.ok) show(res); else { btn.textContent = label(res.accelerator || accel); setHint(res, res.error); }
  }
  btn.onclick = () => {
    if (recording) { btn.textContent = before; stop(); return; }
    recording = true; before = btn.textContent; btn.textContent = 'Press shortcut…'; btn.classList.add('recording');
    window.addEventListener('keydown', onKey, true);
  };
}

$('version').textContent = 'v' + VERSION;

// Global show/hide shortcut: tap toggles, hold shows temporarily (hidden -> visible while held).
//
// Electron's globalShortcut only reports key-down, so it handles the toggle on its own. Key-up (needed for
// "hold") comes from uiohook-napi when it can load, which on macOS needs the Accessibility permission.
// Without it the shortcut still works as a plain toggle.
const { globalShortcut, systemPreferences } = require('electron');

const HOLD_MS = 250;
const REPEAT_GUARD_MS = 700; // no key-up info: ignore OS auto-repeat bursts

const UIO_NAMES = { Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight', Return: 'Enter', Esc: 'Escape' };

let uio = null;
let started = false;

function loadUiohook() {
  if (uio !== null) return uio;
  uio = false;
  try {
    if (process.platform === 'darwin' && !systemPreferences.isTrustedAccessibilityClient(true)) return uio;
    uio = require('uiohook-napi');
  } catch {}
  return uio;
}

function mainKeyOf(accelerator) {
  const key = accelerator.split('+').pop();
  return UIO_NAMES[key] || key;
}

function valid(accelerator) {
  const parts = accelerator.split('+');
  const mods = parts.slice(0, -1);
  return parts.length >= 2 && mods.every(m => ['Ctrl', 'Alt', 'Shift', 'Cmd', 'Meta', 'Super', 'Control', 'Option', 'Command', 'CommandOrControl', 'CmdOrCtrl'].includes(m));
}

function create({ isVisible, show, hide }) {
  let accelerator = null;
  let state = null; // { shownByPress, at } while the key is down
  let lastPress = 0;
  let keyCode = null;

  const onPress = () => {
    const now = Date.now();
    const uiohookOn = uio && started;
    if (uiohookOn && state) return; // auto-repeat while held
    if (!uiohookOn && now - lastPress < REPEAT_GUARD_MS) { lastPress = now; return; }
    lastPress = now;
    if (isVisible()) { hide(); state = uiohookOn ? { shownByPress: false, at: now } : null; return; }
    show();
    state = uiohookOn ? { shownByPress: true, at: now } : null;
  };

  const onRelease = () => {
    if (!state) return;
    const { shownByPress, at } = state;
    state = null;
    if (shownByPress && Date.now() - at >= HOLD_MS) hide();
  };

  function startHook() {
    const lib = loadUiohook();
    if (!lib || started) return;
    lib.uIOhook.on('keyup', e => { if (keyCode !== null && e.keycode === keyCode) onRelease(); });
    try { lib.uIOhook.start(); started = true; } catch { uio = false; }
  }

  return {
    current: () => accelerator,
    holdSupported: () => !!(uio && started),
    // Returns { ok, accelerator, error }.
    set(next) {
      if (!valid(next)) return { ok: false, accelerator, error: 'Use at least one modifier plus a key.' };
      const prev = accelerator;
      if (prev) globalShortcut.unregister(prev);
      let ok = false;
      try { ok = globalShortcut.register(next, onPress); } catch {}
      if (!ok) {
        if (prev) { try { globalShortcut.register(prev, onPress); } catch {} }
        return { ok: false, accelerator: prev, error: 'That shortcut is taken by the system or another app.' };
      }
      accelerator = next;
      const lib = loadUiohook();
      keyCode = lib ? lib.UiohookKey[mainKeyOf(next)] ?? null : null;
      startHook();
      return { ok: true, accelerator };
    },
    dispose() {
      globalShortcut.unregisterAll();
      if (uio && started) { try { uio.uIOhook.stop(); } catch {} }
    },
  };
}

module.exports = { create };

// Sonido de Simulación: música y efectos sintetizados al momento (sin archivos, melodías originales).
// Cada juego tiene su propio carácter musical. Casi no gasta batería: se programan pocas notas cada medio segundo
// y todo se para cuando la app no está a la vista.
const KEY = 'sim_sound';
const prefs = () => { try { return { music: true, sfx: true, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return { music: true, sfx: true }; } };
let ctx = null, master = null, musicBus = null, sfxBus = null, echo = null, style = null, timer = null, nextT = 0, step = 0, ambT = 0;

// Estilos: escala (semitonos), tempo, timbre y ambiente
const STYLES = {
  zoo: { root: 62, scale: [0, 2, 4, 7, 9, 12, 14, 16], bpm: 104, wave: 'triangle', bass: true, perc: true, amb: 'birds', vol: 0.11 },
  acuario: { root: 57, scale: [0, 2, 4, 6, 7, 11, 12, 14], bpm: 70, wave: 'sine', bass: false, perc: false, amb: 'bubbles', vol: 0.12, echo: true },
  vidas: { root: 60, scale: [0, 2, 4, 5, 7, 9, 11, 12], bpm: 88, wave: 'triangle', bass: true, perc: false, amb: null, vol: 0.1, chords: true },
  hub: { root: 60, scale: [0, 4, 7, 9, 12], bpm: 80, wave: 'sine', bass: false, perc: false, amb: null, vol: 0.08 },
};
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
  ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
  musicBus = ctx.createGain(); sfxBus = ctx.createGain(); musicBus.connect(master); sfxBus.connect(master);
  // eco suave para el acuario
  echo = ctx.createDelay(1); echo.delayTime.value = 0.32; const fb = ctx.createGain(); fb.gain.value = 0.32; const wet = ctx.createGain(); wet.gain.value = 0.35;
  echo.connect(fb); fb.connect(echo); echo.connect(wet); wet.connect(musicBus);
  apply(); return ctx;
}
function apply() { if (!ctx) return; const p = prefs(); musicBus.gain.value = p.music ? (style?.vol ?? 0.1) : 0; sfxBus.gain.value = p.sfx ? 0.5 : 0; }

function note(freq, t, dur, { type = 'triangle', gain = 0.3, bus = musicBus, attack = 0.01, toEcho = false, slide = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); if (toEcho && echo) g.connect(echo); o.start(t); o.stop(t + dur + 0.05);
}
function noise(t, dur, gain, bus = musicBus, hp = 3000) {
  const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const s = ctx.createBufferSource(); s.buffer = b; const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = hp; const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(bus); s.start(t);
}

// Compositor: frases de 8 pasos que se repiten con variaciones (suena a melodía, no a notas al azar)
let phrase = [];
function newPhrase(S) { let i = 2; phrase = Array.from({ length: 8 }, (_, k) => { if (k % 2 && Math.random() < 0.35) return null; i = Math.max(0, Math.min(S.scale.length - 1, i + [-2, -1, 1, 1, 2, 0][Math.floor(Math.random() * 6)])); return i; }); }
function schedule() {
  if (!ctx || !style || document.hidden) return;
  const S = style, beat = 60 / S.bpm / 2; const p = prefs();
  while (nextT < ctx.currentTime + 0.6) {
    if (p.music) {
      if (step % 32 === 0) newPhrase(S);
      const k = step % 8, bar = Math.floor(step / 8) % 4; const deg = phrase[k];
      if (deg != null) note(hz(S.root + 12 + S.scale[deg] + (bar === 3 && k > 5 ? 2 : 0)), nextT, beat * 1.8, { type: S.wave, gain: 0.22, toEcho: !!S.echo, attack: S.echo ? 0.06 : 0.01 });
      if (S.bass && k % 4 === 0) note(hz(S.root - 12 + [0, 5, 7, 4][bar]), nextT, beat * 3.5, { type: 'sine', gain: 0.32 });
      if (S.chords && k === 0) for (const iv of [0, 4, 7]) note(hz(S.root + [0, 5, 7, 4][bar] + iv), nextT, beat * 7, { type: 'sine', gain: 0.07, attack: 0.2 });
      if (S.echo && k === 0) for (const iv of [0, 7, 11]) note(hz(S.root + [0, 2, -3, 5][bar] + iv), nextT, beat * 8, { type: 'sine', gain: 0.05, attack: 0.6, toEcho: true });
      if (S.perc && k % 2 === 1) noise(nextT, 0.04, 0.05, musicBus, 6000);
    }
    nextT += beat; step++;
  }
  // ambiente
  if (p.sfx && style.amb && ctx.currentTime > ambT) {
    const t = ctx.currentTime + 0.05;
    if (style.amb === 'birds') { const f = 2200 + Math.random() * 1600; for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) note(f * (1 + Math.random() * 0.2), t + i * 0.11, 0.09, { type: 'sine', gain: 0.05, bus: sfxBus, slide: 1.25 }); ambT = ctx.currentTime + 3 + Math.random() * 6; }
    if (style.amb === 'bubbles') { for (let i = 0; i < 3; i++) note(500 + Math.random() * 500, t + i * 0.09, 0.07, { type: 'sine', gain: 0.05, bus: sfxBus, slide: 2.2 }); ambT = ctx.currentTime + 2 + Math.random() * 4; }
  }
}

export const Sound = {
  // Empieza con el primer toque (los navegadores no dejan sonar antes)
  init(game) {
    style = STYLES[game] || STYLES.hub;
    const start = () => { if (!ensure()) return; ctx.resume?.(); apply(); if (!timer) { nextT = ctx.currentTime + 0.1; timer = setInterval(schedule, 250); } };
    window.addEventListener('pointerdown', start, { once: true, capture: true });
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend?.(); else { ctx.resume?.(); nextT = ctx.currentTime + 0.1; } });
  },
  prefs,
  set(k, v) { const p = prefs(); p[k] = v; localStorage.setItem(KEY, JSON.stringify(p)); apply(); },
  // Efectos
  play(name) {
    if (!ctx || !prefs().sfx) return; const t = ctx.currentTime + 0.01; const o = { bus: sfxBus };
    if (name === 'tap') note(880, t, 0.05, { ...o, type: 'sine', gain: 0.12 });
    else if (name === 'good') [0, 4, 7, 12].forEach((s, i) => note(hz(72 + s), t + i * 0.07, 0.25, { ...o, gain: 0.18 }));
    else if (name === 'coin') { note(hz(83), t, 0.08, { ...o, type: 'square', gain: 0.06 }); note(hz(88), t + 0.07, 0.25, { ...o, type: 'square', gain: 0.06 }); }
    else if (name === 'warn') { note(hz(64), t, 0.14, { ...o, gain: 0.16 }); note(hz(60), t + 0.13, 0.22, { ...o, gain: 0.16 }); }
    else if (name === 'baby') [0, 7, 12, 16, 19].forEach((s, i) => note(hz(76 + s), t + i * 0.1, 0.5, { ...o, type: 'sine', gain: 0.14 }));
    else if (name === 'place') { note(140, t, 0.12, { ...o, type: 'sine', gain: 0.3, slide: 0.5 }); noise(t, 0.05, 0.08, sfxBus, 1500); }
    else if (name === 'lift') note(300, t, 0.12, { ...o, type: 'sine', gain: 0.15, slide: 2 });
    else if (name === 'trash') { noise(t, 0.25, 0.15, sfxBus, 800); note(220, t, 0.2, { ...o, type: 'sine', gain: 0.1, slide: 0.4 }); }
    else if (name === 'pop') note(600, t, 0.08, { ...o, type: 'sine', gain: 0.15, slide: 2.4 });
    else if (name === 'page') noise(t, 0.18, 0.08, sfxBus, 2500);
  },
};

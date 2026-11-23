// Interfaz DOM: HUD, paneles, menús contextuales, modales y creador de personajes.
import {
  NEEDS, BABY_NEEDS, NEED_INFO, NEED_IC, NEED_COLOR, TRAITS, AGES, OBJECTS, OBJ_IC, CATEGORIES, CAREERS, SCHOOL, MOODLETS, WORRIES,
  DAYS, SKINS, HAIR_COLORS, CLOTHES, HAIR_STYLES, GENDERS, BODY_STYLES, inflect, FLOOR_STYLES, WALL_COLORS, WALL_PATTERNS, EYE_STYLES, EYE_COLORS, SKILLS, ASPIRATIONS, REWARDS, OUTINGS, PETS, PET_NEEDS, PET_NAMES, WEATHER, WINDOW_PRICE,
} from './data.js';
import * as Sim from './sim.js';
import { drawPortrait } from './render.js';
import { catalogThumbs, webglAvailable } from './render3d.js';
import { icon } from './icons.js';
import * as Cloud from './cloud.js';
import * as Notify from './notify.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const noEmoji = (t) => String(t).replace(/[\p{Extended_Pictographic}]️?(‍[\p{Extended_Pictographic}]️?)*/gu, '').replace(/\s{2,}/g, ' ').trim();
export const moodColor = (m) => (m >= 70 ? '#25c48f' : m >= 45 ? '#f5c13a' : m >= 25 ? '#f08a3c' : '#e5484d');
const moodIcon = (m) => (m >= 60 ? 'smile' : m >= 35 ? 'meh' : 'frown');
const moodWord = (m) => (m >= 80 ? 'Feliz' : m >= 60 ? 'Bien' : m >= 40 ? 'Regular' : m >= 20 ? 'Mal' : 'Fatal');
const PANELS = [['needs', 'heart', 'Estado'], ['rels', 'users', 'Gente'], ['barrio', 'map', 'Barrio'], ['build', 'hammer', 'Construir'], ['menu', 'menu', 'Menú']];
const SPEED_IC = ['pause', 'play', 'ff', 'fff'];
const KIND_IC = { info: 'bell', good: 'check', warn: 'alert', bad: 'alert', worry: 'cloud' };
const PRIDE = ['#e40303', '#ff8c00', '#ffed00', '#008026', '#24408e', '#732982', '#5bcefa', '#f5a9b8', '#ffffff'];

export class UI {
  constructor(game) {
    this.g = game; this.panel = null; this.sig = ''; this.toastEls = [];
    $('#money .badge').innerHTML = icon('coin');
    $('#speeds').insertAdjacentHTML('beforeend', SPEED_IC.map((ic, i) => `<button data-s="${i}" aria-label="Velocidad ${i}">${icon(ic)}</button>`).join(''));
    $('#speeds').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.g.setSpeed(+b.dataset.s); });
    $('#tabbar').insertAdjacentHTML('beforeend', PANELS.map(([id, ic, l]) => `<button data-panel="${id}">${icon(ic)}<span>${l}</span></button>`).join(''));
    $('#tabbar').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.togglePanel(b.dataset.panel); });
    $('#sheet .close').innerHTML = icon('x');
    $('#sheet .close').addEventListener('click', () => this.closePanel());
    $('#fade').innerHTML = icon('hearts');
    document.addEventListener('pointerdown', (e) => { if (!$('#pie').hidden && !e.target.closest('#pie')) this.hidePie(); }, true);
    window.addEventListener('resize', () => this.movePill());
    if (game.is3D) {
      const cc = document.createElement('div'); cc.id = 'camctl'; cc.hidden = true;
      cc.innerHTML = `<button class="glass" data-w="1" aria-label="Subir o bajar paredes">${icon('walls')}</button><button class="glass" data-p="1" aria-label="Hacer foto">${icon('camera')}</button><button class="glass" data-a="1" aria-label="Girar a la izquierda">${icon('rotate')}</button><button class="glass" data-a="-1" aria-label="Girar a la derecha" style="transform:scaleX(-1)">${icon('rotate')}</button>`;
      cc.onclick = (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.dataset.w) { const r = this.g.renderer; r.setWallsUp(!r.wallsUp); this.toast(r.wallsUp ? 'Paredes altas' : 'Paredes bajas: se ve mejor el interior', 'info'); return; }
        if (b.dataset.p) return this.g.takePhoto();
        this.g.renderer.spin(+b.dataset.a * Math.PI / 4);
      };
      document.body.appendChild(cc);
    }
  }
  get state() { return this.g.state; }
  get active() { return this.state?.sims[this.state.active]; }
  showHud(on) { $('#top').hidden = !on; $('#bottom').hidden = !on; if ($('#camctl')) $('#camctl').hidden = !on; if (on) requestAnimationFrame(() => this.movePill()); }

  // ---------- HUD ----------
  update() {
    const st = this.state; if (!st) return;
    $('#money b').textContent = `${st.money.toLocaleString('es-ES')} €`;
    const hr = Sim.hourOf(st.time), h = Math.floor(hr), m = Math.floor(st.time % 60);
    const night = hr < 7 || hr >= 20;
    const clock = $('#clock'); clock.classList.toggle('night', night);
    const badge = night ? 'moon' : 'sun';
    if (clock.dataset.b !== badge) { clock.dataset.b = badge; clock.querySelector('.badge').innerHTML = icon(badge); }
    clock.querySelector('.t b').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const wt = Sim.weatherOf(st).type;
    clock.querySelector('.t span').textContent = `${DAYS[Sim.dowOf(st.time)]} · Día ${Sim.dayOf(st.time) + 1} · ${Sim.seasonOf(st).label} · ${WEATHER[wt].label}${st.powerOff ? ' · Sin luz' : ''}`;
    if (!night && wt !== 'sol' && clock.dataset.b !== wt) { clock.dataset.b = wt; clock.querySelector('.badge').innerHTML = icon(WEATHER[wt].ic); }
    $('#speeds').classList.toggle('real', !!st.settings.realTime);
    document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('on', +b.dataset.s === st.speed));
    $('#speeds .thumb').style.transform = `translateX(${st.speed * 34}px)`;
    this.renderFamily(); this.renderQueue();
    if (this.panel === 'needs') this.renderNeeds();
    if (this.panel === 'rels') this.renderRels(false);
    if (this.panel === 'barrio') this.renderBarrio(false);
  }
  movePill() {
    const bar = $('#tabbar'); const on = bar.querySelector('button.on'); const pill = bar.querySelector('.pill');
    bar.classList.toggle('has-on', !!on);
    if (on) { pill.style.width = on.offsetWidth + 'px'; pill.style.height = on.offsetHeight + 'px'; pill.style.transform = `translate(${on.offsetLeft - 6}px, ${on.offsetTop - 6}px)`; }
  }
  setTab(name) {
    document.querySelectorAll('#tabbar button').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
    this.movePill();
  }
  renderFamily() {
    const st = this.state; const el = $('#family'); const sims = Sim.householdSims(st);
    const sig = sims.map((s) => s.id + s.age + s.name + s.look.hair).join('|');
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig; el.innerHTML = '';
      for (const s of sims) {
        const b = document.createElement('button'); b.className = 'fam'; b.dataset.id = s.id; b.setAttribute('aria-label', s.name);
        b.innerHTML = `<canvas></canvas><span class="alert" hidden>!</span><span class="away" hidden></span>`;
        b.onclick = () => this.g.selectSim(s.id, true);
        el.appendChild(b);
      }
    }
    for (const b of el.children) {
      const s = st.sims[b.dataset.id]; if (!s) continue;
      b.classList.toggle('on', s.id === st.active); b.dataset.name = s.name;
      b.style.setProperty('--p', Math.round(s.mood)); b.style.setProperty('--c', moodColor(s.mood));
      const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
      b.querySelector('.alert').hidden = !(list.some((n) => s.needs[n] < 20) || s.crying);
      const away = b.querySelector('.away'); away.hidden = s.location === 'casa';
      const aw = s.location === 'escuela' ? 'backpack' : s.location === 'salida' ? 'pin' : 'briefcase';
      if (away.dataset.i !== aw) { away.dataset.i = aw; away.innerHTML = icon(aw); }
      const mb = s.mood >= 60 ? 2 : s.mood >= 35 ? 1 : 0;
      if (b.dataset.mb !== String(mb)) { b.dataset.mb = mb; drawPortrait(b.querySelector('canvas'), s, 46); }
    }
  }
  renderQueue() {
    const s = this.active; const el = $('#queue');
    if (!s || this.g.view.build) { el.innerHTML = ''; el.dataset.sig = ''; return; }
    const items = [];
    if (s.cur) items.push({ cur: true, icon: s.cur.icon || 'clock', label: inflect(s.cur.label || '', s), idx: -1, cancel: !['ko', 'leave', 'partner'].includes(s.cur.kind) });
    s.queue.forEach((q, i) => items.push({ icon: q.icon, label: q.label, idx: i, cancel: true }));
    const sig = s.id + items.map((i) => i.icon + i.label + i.idx).join('|');
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig; el.innerHTML = '';
    for (const it of items) {
      const c = document.createElement('div'); c.className = 'qchip glass' + (it.cur ? ' cur' : '');
      const label = it.label.length > 24 ? it.label.slice(0, 23) + '…' : it.label;
      c.innerHTML = `<span class="tile">${icon(it.icon)}</span><span>${esc(label)}</span>${it.cancel ? `<button class="x" aria-label="Cancelar">${icon('x')}</button>` : ''}`;
      if (it.cancel) c.querySelector('.x').onclick = () => { Sim.cancelItem(this.state, s, it.idx); el.dataset.sig = ''; this.renderQueue(); };
      el.appendChild(c);
    }
  }

  // ---------- avisos ----------
  toast(msg, kind = 'info', simId = null) {
    const st = this.state; const sim = simId && st?.sims[simId];
    const text = noEmoji(inflect(msg, sim));
    const el = document.createElement('div'); el.className = `toast glass ${kind}${sim ? ' has-face' : ''}`;
    el.innerHTML = `<span class="tile">${sim ? '<canvas></canvas>' : icon(KIND_IC[kind] || 'bell')}</span><span>${esc(text)}</span>`;
    if (sim) drawPortrait(el.querySelector('canvas'), sim, 34);
    if (sim) el.onclick = () => { if (sim.home) this.g.selectSim(simId, true); else this.g.centerOnSim(simId); };
    $('#toasts').prepend(el); this.toastEls.unshift(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
    while (this.toastEls.length > 3) this.toastEls.pop().remove();
    const life = kind === 'bad' || kind === 'worry' ? 6500 : 4200;
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); this.toastEls = this.toastEls.filter((x) => x !== el); }, 220); }, life);
    if (kind === 'bad' && navigator.vibrate) navigator.vibrate(40);
  }
  fade() { const f = $('#fade'); f.classList.add('on'); setTimeout(() => f.classList.remove('on'), 1900); }

  // ---------- menú contextual ----------
  showPie(x, y, head, options) {
    const pie = $('#pie');
    pie.innerHTML = `<div class="ttl">${head.sim ? '<canvas></canvas>' : `<span class="tilebox">${icon(head.icon || 'pin')}</span>`}<div><b>${esc(head.title)}</b>${head.sub ? `<span>${esc(head.sub)}</span>` : ''}</div></div>`;
    if (head.sim) drawPortrait(pie.querySelector('.ttl canvas'), head.sim, 36);
    if (!options.length) pie.insertAdjacentHTML('beforeend', '<div class="empty">No hay nada que hacer aquí ahora.</div>');
    for (const o of options) {
      const b = document.createElement('button'); b.className = 'opt ' + (o.cls || '');
      b.innerHTML = `<span class="tilebox">${icon(o.icon)}</span><span>${esc(o.label)}${o.disabled ? `<small>${esc(o.disabled)}</small>` : ''}</span>`;
      b.disabled = !!o.disabled;
      b.onclick = () => { this.hidePie(); o.run(); };
      pie.appendChild(b);
    }
    pie.hidden = false; pie.classList.add('enter');
    const r = pie.getBoundingClientRect();
    const left = Math.max(10, Math.min(window.innerWidth - r.width - 10, x - r.width / 2));
    const above = y - r.height - 24 > 70;
    const floor = window.innerHeight - ($('#bottom').offsetHeight || 0) - 8;
    const top = above ? y - r.height - 24 : Math.min(floor - r.height, y + 24);
    pie.style.left = left + 'px'; pie.style.top = Math.max(70, top) + 'px';
    pie.style.transformOrigin = `${x - left}px ${above ? r.height + 24 : -24}px`;
    requestAnimationFrame(() => pie.classList.remove('enter'));
  }
  hidePie() { $('#pie').hidden = true; }

  // ---------- paneles ----------
  togglePanel(name) {
    if (this.panel === name) return this.closePanel();
    if (name === 'build') { this.g.enterBuild(); return this.openPanel('build'); }
    if (this.g.view.build) this.g.exitBuild();
    this.openPanel(name);
  }
  openPanel(name) {
    this.panel = name; this.sig = '';
    this.setTab(name);
    const sh = $('#sheet'); sh.classList.remove('closed'); sh.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sheet-open');
    $('#sheet h2').textContent = { needs: 'Estado', rels: 'Gente', barrio: 'Barrio', build: 'Catálogo', menu: 'Menú' }[name];
    $('#sheet .sheet-body').scrollTop = 0;
    this.reframe(true);
    if (name === 'needs') this.renderNeeds();
    if (name === 'rels') this.renderRels(true);
    if (name === 'barrio') this.renderBarrio(true);
    if (name === 'build') this.renderBuild();
    if (name === 'menu') this.renderMenu();
  }
  closePanel() {
    this.hideSheetOnly();
    this.setTab(this.g.view.build ? 'build' : null);
  }
  hideSheetOnly() {
    this.panel = null; const sh = $('#sheet'); sh.classList.add('closed'); sh.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('sheet-open');
    this.reframe(false);
  }
  // En horizontal, la casa se aparta para no quedar debajo del panel lateral
  reframe(open) {
    const r = this.g.renderer; const landscape = window.innerWidth > window.innerHeight && window.innerHeight <= 560;
    const inset = open && landscape ? $('#sheet').offsetWidth + 20 : 0;
    if (r.insetRight === inset) return;
    r.insetRight = inset;
    if (landscape && this.g.state) r.centerOn(4.5, 4.5);
  }

  renderNeeds() {
    const s = this.active; const body = $('#sheet .sheet-body'); const st = this.state; if (!s) return;
    const der = Sim.derivedMoodlets(st, s);
    const sig = [s.id, s.age, s.name, s.diary?.length, s.diary?.[0]?.day, s.aspDone, s.points, (s.rewards || []).join(), Object.values(s.skills || {}).map(Math.floor).join(), s.paintings, s.worries.join(), s.moodlets.map((m) => m.id).join(), der.map((d) => d.label).join(), s.job?.id, s.job?.level, s.pregnant ? 1 : 0, s.location, s.partner, s.skipDay === Sim.dayOf(st.time)].join('|');
    if (sig !== this.sig) {
      this.sig = sig;
      const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
      const partner = s.partner && st.sims[s.partner];
      let h = `<div class="who"><canvas id="np"></canvas><div><div class="n">${esc(s.name)} ${esc(s.surname || '')}</div>
        <div class="s">${inflect(AGES[s.age].label, s)} · ${GENDERS[s.gender].label}${partner ? ` · ${s.married ? inflect('Casado/a', s) + ' con' : 'Pareja de'} ${esc(partner.name)}` : ''}</div>
        <div class="chips" style="margin-top:6px">${s.traits.map((t) => `<span class="chip">${inflect(TRAITS[t].label, s)}</span>`).join('')}</div></div></div>`;
      h += `<div class="mood"><span class="face" id="nface"></span><div style="flex:1"><div class="lbl">Ánimo</div><div class="val" id="nmoodw"></div></div><div class="bar" style="flex:1.4"><i id="nmoodbar"></i></div></div>`;
      h += `<div class="sec">Necesidades</div>` + list.map((n) => `<div class="need"><span class="tile" style="background:${NEED_COLOR[n]}">${icon(NEED_IC[n])}</span><span>${NEED_INFO[n].label}</span><div class="bar"><i data-n="${n}"></i></div></div>`).join('');
      if (s.pregnant) h += `<div class="card"><div class="h"><span class="tilebox" style="background:#ffe6ee;color:#e0336f">${icon('baby')}</span><div><b>Bebé en camino</b><div class="hint">Nacerá en <span id="npreg"></span></div></div></div></div>`;
      if (s.worries.length) h += `<div class="sec">${icon('cloud')} Preocupaciones</div>` + s.worries.map((w) => `<div class="card"><div class="h"><span class="tilebox" style="background:#efe7fe;color:#6230c9">${icon('cloud')}</span><div><b>${inflect(WORRIES[w].label, s)}</b><div class="hint">${WORRIES[w].hint}</div></div></div></div>`).join('');
      const ml = [...s.moodlets.map((m) => MOODLETS[m.id]).filter(Boolean), ...der];
      if (ml.length) h += `<div class="sec">Sensaciones</div><div class="chips">` + ml.map((m) => `<span class="chip ${m.mood >= 0 ? 'good' : 'bad'}">${inflect(m.label, s)} ${m.mood > 0 ? '+' : ''}${m.mood}</span>`).join('') + '</div>';
      if (s.age === 'bebe') h += `<div class="sec">Cuidados</div><p class="hint">Los bebés dependen de ti. Elige a una persona adulta y toca al bebé para darle el biberón, cambiarle el pañal o acunarle. Con una cuna duerme mucho mejor.</p>`;
      if (s.school && s.age === 'nino') h += `<div class="sec">${icon('backpack')} Colegio</div><div class="card"><div class="hint">Lunes a viernes, de ${SCHOOL.start}:00 a ${SCHOOL.end}:00</div><div style="margin-top:4px">Nota media: <b id="ngrade"></b></div></div>`;
      if (Sim.isAdult(s)) {
        h += `<div class="sec">${icon('briefcase')} Trabajo</div>`;
        if (s.job) {
          const c = CAREERS[s.job.id];
          h += `<div class="card"><div class="h"><span class="tilebox" style="background:#fff">${icon('briefcase')}</span><div style="flex:1"><b>${inflect(c.levels[s.job.level], s)}</b><div class="hint">${c.label} · ${c.pay[s.job.level]} € al día · L–V ${c.start}:00–${c.end}:00</div></div></div>
            <div class="hint" style="margin:10px 0 4px">Rendimiento</div><div class="bar"><i id="nperf"></i></div></div>
            <div class="row" style="margin-top:8px"><button class="btn alt" id="nskip" ${s.skipDay === Sim.dayOf(st.time) ? 'disabled' : ''}>${icon('moon')} Faltar hoy</button><button class="btn alt" id="nquit">${icon('logout')} Dejarlo</button></div>`;
        } else h += `<p class="hint">Sin trabajo. Usa el ordenador o el teléfono para buscar uno.</p>`;
      }
      if (s.aspiration && ASPIRATIONS[s.aspiration]) {
        const A = ASPIRATIONS[s.aspiration];
        h += `<div class="sec">${icon('flag')} Aspiración</div><div class="card"><div class="h"><span class="tilebox" style="background:#fff3dc;color:#b7791f">${icon(A.ic)}</span><div style="flex:1"><b>${A.label}</b><div class="hint">${s.points || 0} puntos para recompensas</div></div></div>
          <div style="margin-top:8px">${A.steps.map((st, i) => `<div class="hint" style="display:flex;gap:8px;align-items:center;margin:4px 0;color:${i < s.aspDone ? '#127a52' : 'inherit'}">${icon(i < s.aspDone ? 'check' : i === s.aspDone ? 'flag' : 'clock')}<span>${st}</span></div>`).join('')}</div></div>`;
        h += `<div class="chips" style="margin-top:6px">${Object.entries(REWARDS).map(([k, r]) => (s.rewards || []).includes(k) ? `<span class="chip good" title="${esc(r.desc)}">${icon('check')} ${r.label}</span>` : `<button class="chip" data-rw="${k}" title="${esc(r.desc)}" ${(s.points || 0) < r.cost ? 'style="opacity:.5"' : ''}>${r.label} · ${r.cost}</button>`).join('')}</div>`;
      }
      if (s.age !== 'bebe') {
        h += `<div class="sec">${icon('star')} Habilidades</div>` + Object.entries(SKILLS).map(([k, sk]) => { const v = s.skills?.[k] || 0; return `<div class="need"><span class="tile" style="background:#8b7cf6">${icon(sk.ic)}</span><span>${sk.label} <b style="color:var(--ink-3)">${Math.floor(v)}</b></span><div class="bar"><i style="transform:scaleX(${v / 10});background:#8b7cf6"></i></div></div>`; }).join('');
        if (s.paintings) h += `<p class="hint">Cuadros vendidos: <b>${s.paintings}</b></p>`;
      }
      if (s.diary?.length) h += `<div class="sec">${icon('pencil')} Diario de ${esc(s.name)}</div>` + s.diary.slice(0, 5).map((d) => `<div class="card diary"><div class="hint">Día ${d.day + 1}</div><div>${esc(inflect(d.text, s))}</div></div>`).join('');
      if (s.home) h += `<div class="row" style="margin-top:16px"><button class="btn alt" id="nlook">${icon('sparkle')} Cambiar aspecto</button></div>`;
      body.innerHTML = h;
      drawPortrait(body.querySelector('#np'), s, 60);
      const lk = body.querySelector('#nlook'); if (lk) lk.onclick = () => this.editLook(s);
      body.querySelectorAll('[data-rw]').forEach((b) => (b.onclick = () => { const r = REWARDS[b.dataset.rw]; this.confirm(`¿Canjear ${r.cost} puntos por «${r.label}»? ${r.desc}.`, () => { if (Sim.buyReward(st, s, b.dataset.rw)) { this.sig = ''; this.renderNeeds(); } }); }));
      const sk = body.querySelector('#nskip'); if (sk) sk.onclick = () => { Sim.skipToday(st, s); this.toast(`${s.name} se queda hoy en casa (bajará su rendimiento)`, 'warn', s.id); this.sig = ''; };
      const q = body.querySelector('#nquit'); if (q) q.onclick = () => this.confirm(`¿Seguro que ${s.name} deja su trabajo?`, () => { Sim.setJob(st, s, null); this.sig = ''; });
    }
    const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
    for (const n of list) { const i = body.querySelector(`i[data-n="${n}"]`); if (i) { i.style.transform = `scaleX(${s.needs[n] / 100})`; i.style.backgroundColor = s.needs[n] < 20 ? '#e5484d' : NEED_COLOR[n]; } }
    const mb = body.querySelector('#nmoodbar'); if (mb) { mb.style.transform = `scaleX(${s.mood / 100})`; mb.style.backgroundColor = moodColor(s.mood); }
    const face = body.querySelector('#nface'); if (face && face.dataset.i !== moodIcon(s.mood)) { face.dataset.i = moodIcon(s.mood); face.innerHTML = icon(moodIcon(s.mood)); }
    if (face) face.style.color = moodColor(s.mood);
    const mw = body.querySelector('#nmoodw'); if (mw) mw.textContent = moodWord(s.mood);
    const pf = body.querySelector('#nperf'); if (pf && s.job) { pf.style.transform = `scaleX(${s.job.perf / 100})`; pf.style.backgroundColor = moodColor(s.job.perf); }
    const gr = body.querySelector('#ngrade'); if (gr) gr.textContent = (s.school.grade / 10).toFixed(1).replace('.', ',');
    const pr = body.querySelector('#npreg'); if (pr && s.pregnant) { const left = Math.max(0, s.pregnant.due - st.time); pr.textContent = `${Math.floor(left / 1440)} d ${Math.floor((left % 1440) / 60)} h`; }
  }

  renderRels(force) {
    const s = this.active; const body = $('#sheet .sheet-body'); const st = this.state; if (!s) return;
    if (this.relTab === 'mem') return force ? this.renderMemories(body) : undefined;
    const others = Object.values(st.sims).filter((o) => o !== s && (o.home || s.rel[o.id]));
    others.sort((a, b) => (b.home - a.home) || (Sim.getRel(s, b).a + Sim.getRel(s, b).r) - (Sim.getRel(s, a).a + Sim.getRel(s, a).r));
    const sig = s.id + (st.pets || []).map((p) => p.id + Object.values(p.needs).map((v) => Math.round(v / 10)).join('') + p.out + p.sleeping).join() + others.map((o) => o.id + o.location + Math.round(Sim.getRel(s, o).a / 5) + Math.round(Sim.getRel(s, o).r / 5) + Sim.relLabel(st, s, o)).join();
    if (!force && sig === this.sig) return;
    this.sig = sig;
    body.innerHTML = `${this.relTabs()}<p class="hint" style="margin-top:0">Las relaciones de <b>${esc(s.name)}</b>. Invita a gente desde el teléfono.</p>`;
    this.bindRelTabs(body);
    for (const p of st.pets || []) {
      const row = document.createElement('div'); row.className = 'relrow';
      row.innerHTML = `<span class="tilebox" style="width:48px;height:48px;border-radius:16px;background:${p.color};color:#fff;font-size:22px">${icon('heart')}</span><div><div class="top"><b>${esc(p.name)}</b><span class="chip">${PETS[p.species].label}</span><span class="where">${p.out ? 'De paseo' : p.sleeping ? 'Durmiendo' : 'En casa'}</span></div>
        <div class="bars" style="grid-template-columns:70px 1fr">${Object.entries(PET_NEEDS).map(([k, l]) => `<span>${l}</span><div class="bar"><i style="transform:scaleX(${p.needs[k] / 100});background:${p.needs[k] < 25 ? '#e5484d' : '#f0a04a'}"></i></div>`).join('')}</div></div>`;
      body.appendChild(row);
    }
    for (const o of others) {
      const r = Sim.getRel(s, o);
      const row = document.createElement('div'); row.className = 'relrow';
      const where = o.location === 'casa' ? (o.home ? 'En casa' : 'De visita') : o.location === 'trabajo' ? 'Trabajando' : o.location === 'escuela' ? 'En el cole' : 'En su casa';
      const romance = Sim.isAdult(s) && Sim.isAdult(o) && (r.r > 0 || s.partner === o.id);
      row.innerHTML = `<canvas></canvas><div><div class="top"><b>${esc(o.name)}</b><span class="chip">${Sim.relLabel(st, s, o)}</span><span class="where">${where}</span></div>
        <div class="bars"><span style="color:${r.a >= 0 ? '#17a676' : '#e5484d'}">${icon('smile')}</span><div class="bar"><i style="transform:scaleX(${(r.a + 100) / 200});background:${r.a >= 0 ? '#25c48f' : '#e5484d'}"></i></div>
        ${romance ? `<span style="color:#e0336f">${icon('heart')}</span><div class="bar"><i style="transform:scaleX(${r.r / 100});background:#ff5c8a"></i></div>` : ''}</div></div>`;
      drawPortrait(row.querySelector('canvas'), o, 48);
      if (o.location === 'casa') row.onclick = () => this.g.centerOnSim(o.id);
      body.appendChild(row);
    }
  }

  // ---------- el barrio ----------
  renderBarrio(force) {
    const st = this.state; const body = $('#sheet .sheet-body');
    const fam = Sim.householdSims(st); const ns = Sim.neighbors(st);
    const placeOf = (s) => s.location === 'casa' ? 'casa' : s.location === 'trabajo' ? 'trabajo' : s.location === 'escuela' ? 'cole' : s.location === 'salida' ? (s.outing?.dest === 'visita' ? 'n:' + s.outing.host : s.outing?.dest === 'paseo' ? 'parque' : s.outing?.dest) : 'casa';
    const sig = fam.map((s) => s.id + placeOf(s)).join() + ns.map((n) => n.id + n.location + Sim.whereIs(st, n)).join() + (st.news?.length || 0) + (st.news?.[0]?.t || 0);
    if (!force && sig === this.sig) return; this.sig = sig;
    const who = (key) => fam.filter((s) => placeOf(s) === key);
    const P = { casa: [50, 50, 'home', `Casa ${st.surname}`], parque: [24, 38, 'tree', 'Parque'], cine: [76, 38, 'tv', 'Cine'], restaurante: [27, 78, 'food', 'Restaurante'], gimnasio: [73, 78, 'zap', 'Gimnasio'], trabajo: [91, 60, 'briefcase', 'Trabajo'], cole: [9, 60, 'backpack', 'Cole'] };
    const NPOS = [[14, 13], [38, 11], [62, 11], [86, 13], [50, 92]];
    let pins = '';
    const pin = (key, x, y, ic, label, cls = '', color = '') => `<button class="pin ${cls}" data-k="${key}" style="left:${x}%;top:${y}%"><span class="pi" ${color ? `style="background:${color};color:#fff"` : ''}>${icon(ic)}</span><span class="pl">${esc(label)}</span><span class="pw">${who(key).map((s) => `<canvas data-face="${s.id}"></canvas>`).join('')}</span></button>`;
    for (const [k, [x, y, ic, l]] of Object.entries(P)) pins += pin(k, x, y, ic, l, k === 'casa' ? 'home' : '');
    const HOUSE_COLORS = ['#e07a5a', '#5a8ad0', '#6ab07a', '#c9a04a', '#9a6ac0'];
    ns.forEach((n, i) => { const [x, y] = NPOS[i % NPOS.length]; pins += pin('n:' + n.id, x, y, 'home', n.name, 'nb', HOUSE_COLORS[i % 5]); });
    let h = `<div class="map">${pins}</div><p class="hint">Toca un sitio para ir, o la casa de un vecino para invitarle o hacerle una visita.</p>`;
    h += `<div class="sec">${icon('users')} Vecinos</div>` + ns.map((n) => `<button class="relrow nbrow" data-n="${n.id}"><canvas data-face="${n.id}" class="big"></canvas><div style="text-align:left"><div class="top"><b>${esc(n.name)}</b><span class="chip">${Sim.relLabel(st, this.active, n)}</span></div><div class="hint">${esc(Sim.whereIs(st, n))}${n.partner && st.sims[n.partner] ? ` · ${n.married ? 'casado/a con' : 'sale con'} ${esc(st.sims[n.partner].name)}` : ''}</div></div></button>`).join('');
    h += `<div class="sec">${icon('news')} Periódico del barrio</div>` + ((st.news || []).length ? st.news.slice(0, 8).map((x) => `<div class="memo"><span class="tilebox">${icon('news')}</span><div><b>${esc(x.text.replace(/[\p{Extended_Pictographic}]\uFE0F?/gu, '').trim())}</b><div class="hint">Día ${Sim.dayOf(x.t) + 1}</div></div></div>`).join('') : '<p class="hint">Aún no hay noticias. Los vecinos tienen su propia vida: se enamoran, ascienden, cambian de trabajo… y aquí te enterarás.</p>');
    body.innerHTML = h;
    body.querySelectorAll('canvas[data-face]').forEach((c) => drawPortrait(c, st.sims[c.dataset.face], c.classList.contains('big') ? 48 : 22));
    body.querySelectorAll('.pin').forEach((b) => (b.onclick = () => this.barrioTap(b.dataset.k)));
    body.querySelectorAll('.nbrow').forEach((b) => (b.onclick = () => this.neighborCard(b.dataset.n)));
  }
  barrioTap(k) {
    const st = this.state;
    if (k === 'casa') { this.closePanel(); return this.g.renderer.centerOn(4.5, 4.5); }
    if (k.startsWith('n:')) return this.neighborCard(k.slice(2));
    if (k === 'trabajo' || k === 'cole') { const there = Sim.householdSims(st).filter((s) => s.location === (k === 'cole' ? 'escuela' : 'trabajo')); return this.toast(there.length ? there.map((s) => `${s.name}: ${Sim.whereIs(st, s)}`).join(' · ') : k === 'cole' ? 'Nadie está en el cole ahora' : 'Nadie está trabajando ahora', 'info'); }
    const me = this.active;
    if (!me || !Sim.isAdult(me) || !Sim.canGoOut(st, me)) return this.toast(me ? `${me.name} está ${Sim.whereIs(st, me)}` : 'Elige a alguien de la familia', 'warn');
    this.chooseOuting(me.id);
  }
  neighborCard(id) {
    const st = this.state; const n = st.sims[id]; const me = this.active; if (!n) return;
    const where = Sim.whereIs(st, n); const r = Sim.getRel(me, n); const home = where === 'en su casa';
    const box = this.modal(`<div class="who"><canvas id="ncard"></canvas><div><div class="n">${esc(n.name)}</div><div class="s">${Sim.relLabel(st, me, n)} · ${GENDERS[n.gender].label} · ${esc(where)}</div>
      <div class="chips" style="margin-top:6px">${n.traits.map((t) => `<span class="chip">${inflect(TRAITS[t].label, n)}</span>`).join('')}${n.job ? `<span class="chip">${inflect(CAREERS[n.job.id].levels[n.job.level], n)}</span>` : ''}</div></div></div>
      <div class="bars" style="display:grid;grid-template-columns:20px 1fr;gap:6px;align-items:center;margin-top:14px"><span>${icon('smile')}</span><div class="bar"><i style="transform:scaleX(${(r.a + 100) / 200});background:${r.a >= 0 ? '#25c48f' : '#e5484d'}"></i></div></div>
      <div class="actions" style="flex-direction:column">
        <button class="btn coral" id="nvisit" ${home && n.location === 'fuera' ? '' : 'disabled'}>${icon('home')} Ir de visita con ${esc(me.name)}</button>
        <button class="btn alt" id="ninvite" ${n.location === 'fuera' ? '' : 'disabled'}>${icon('phone')} Invitar a casa</button>
        <button class="btn alt" id="nclose">Cerrar</button></div>`);
    drawPortrait(box.querySelector('#ncard'), n, 60);
    box.querySelector('#nclose').onclick = () => this.closeModal();
    box.querySelector('#ninvite').onclick = () => { this.closeModal(); Sim.inviteNeighbor(st, n.id); };
    box.querySelector('#nvisit').onclick = () => {
      if (!Sim.isAdult(me) || !Sim.canGoOut(st, me)) return this.toast(`${me.name} está ${Sim.whereIs(st, me)}`, 'warn');
      const h = Sim.hourOf(st.time); if (h >= 22 || h < 9) return this.toast('Es muy tarde para ir de visita', 'warn');
      this.closeModal(); Sim.startOuting(st, [me], 'visita', n.id); this.sig = ''; this.update();
    };
  }
  relTabs() { const t = this.relTab || 'rel'; return `<div class="tabs" id="rtabs"><button data-t="rel" class="${t === 'rel' ? 'on' : ''}">Relaciones</button><button data-t="mem" class="${t === 'mem' ? 'on' : ''}">Recuerdos</button></div>`; }
  bindRelTabs(body) { body.querySelector('#rtabs').onclick = (e) => { const b = e.target.closest('button'); if (b) { this.relTab = b.dataset.t; this.sig = ''; this.renderRels(true); } }; }
  renderMemories(body) {
    const st = this.state; const photos = this.g.photos();
    let h = this.relTabs();
    h += `<button class="btn coral" id="mphoto" style="width:100%;margin-bottom:10px">${icon('camera')} Hacer una foto ahora</button>`;
    if (photos.length) h += `<div class="photos">${photos.map((p, i) => `<figure><img src="${p.img}" alt=""><figcaption>Día ${Sim.dayOf(p.t) + 1}</figcaption><button data-del="${i}" aria-label="Borrar">${icon('x')}</button></figure>`).join('')}</div>`;
    const mem = st.memories || [];
    h += `<div class="sec">${icon('book')} Diario de la familia</div>`;
    h += mem.length ? mem.map((m) => `<div class="memo"><span class="tilebox">${icon(m.ic)}</span><div><b>${esc(m.text)}</b><div class="hint">Día ${Sim.dayOf(m.t) + 1} · ${DAYS[Sim.dowOf(m.t)]}</div></div></div>`).join('') : '<p class="hint">Aquí se irán guardando los grandes momentos: parejas, bodas, nacimientos, ascensos, cumpleaños…</p>';
    body.innerHTML = h; this.bindRelTabs(body);
    body.querySelector('#mphoto').onclick = () => { this.hideSheetOnly(); this.setTab(null); setTimeout(() => this.g.takePhoto(), 350); };
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => this.confirm('¿Borrar esta foto?', () => { this.g.deletePhoto(+b.dataset.del); this.renderMemories(body); })));
  }
  chooseEvent(ev) {
    const box = this.modal(`<h2>${esc(ev.title)}</h2><p>${esc(inflect(ev.text, this.state.sims[ev.who]))}</p><div class="actions" style="flex-direction:column">${ev.options.map((o, i) => `<button class="btn ${i ? 'alt' : 'coral'}" data-i="${i}">${esc(o)}</button>`).join('')}</div>`);
    box.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { this.closeModal(); Sim.resolveEvent(this.state, ev, +b.dataset.i); this.update(); }));
  }
  renderBuild(cat = this.buildCat || CATEGORIES[0]) {
    this.buildCat = cat; const st = this.state; const body = $('#sheet .sheet-body');
    body.innerHTML = `<div class="tabs">${CATEGORIES.map((c) => `<button data-c="${c}" class="${c === cat ? 'on' : ''}">${c}</button>`).join('')}</div><div class="grid"></div><p class="hint">Toca un mueble de la casa para moverlo o venderlo. El tiempo se para mientras construyes.</p>`;
    body.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) this.renderBuild(b.dataset.c); };
    const grid = body.querySelector('.grid');
    if (cat === 'Estilo') return this.renderStyle(body, grid);
    if (cat === 'Paredes') return this.renderWallTools(body, grid);
    const thumbs = webglAvailable() ? catalogThumbs() : {};
    for (const [id, d] of Object.entries(OBJECTS)) {
      if (d.cat !== cat) continue;
      const b = document.createElement('button'); b.className = 'item'; b.disabled = st.money < d.price;
      b.innerHTML = `${thumbs[id] ? `<img class="thumb" src="${thumbs[id]}" alt="">` : `<span class="tilebox">${icon(OBJ_IC[id] || 'box')}</span>`}${d.name}<span class="p">${d.price} €</span>${d.decor ? `<span class="d">Decoración +${d.decor}</span>` : ''}`;
      b.onclick = () => { this.hideSheetOnly(); this.g.startPlacing(id); };
      grid.appendChild(b);
    }
  }
  renderWallTools(body, grid) {
    body.querySelector('.hint').textContent = 'Separa habitaciones con paredes y pon puertas para poder pasar. Nadie atraviesa una pared sin puerta.';
    const tools = [['wall', 'Pared', `${Sim.WALL_PRICE} € por tramo`, 'Arrastra el dedo por los bordes'], ['door', 'Puerta', `${Sim.DOOR_PRICE} €`, 'Toca una pared'], ['window', 'Ventana', `${WINDOW_PRICE} €`, 'Toca una pared'], ['erase', 'Quitar', 'Devuelve la mitad', 'Toca una pared o puerta']];
    for (const [id, name, price, how] of tools) {
      const b = document.createElement('button'); b.className = 'item';
      b.innerHTML = `<span class="tilebox">${icon(id === 'wall' ? 'box' : id === 'door' ? 'logout' : id === 'window' ? 'sun' : 'trash')}</span>${name}<span class="p">${price}</span><span class="d">${how}</span>`;
      b.onclick = () => { this.hideSheetOnly(); this.g.setWallTool(id); };
      grid.appendChild(b);
    }
  }
  renderStyle(body, grid) {
    const st = this.state; const H = st.house || {}; const cur = H.floor || 'roble'; const wall = H.wall || { color: '#f3e7d6', pattern: 'rayas' };
    body.querySelector('.hint').textContent = 'Cambia el suelo y las paredes de toda la casa.';
    const sec = (t) => { const h = document.createElement('div'); h.className = 'sec'; h.style.gridColumn = '1 / -1'; h.textContent = t; grid.appendChild(h); };
    const item = (html, on, price, fn) => {
      const b = document.createElement('button'); b.className = 'item'; if (on) b.style.boxShadow = '0 0 0 2px var(--ink)';
      b.innerHTML = html + (on ? '<span class="d">Actual</span>' : `<span class="p">${price} €</span>`);
      b.disabled = !on && st.money < price; b.onclick = () => { if (!on && fn()) { this.renderBuild('Estilo'); this.update(); } };
      grid.appendChild(b);
    };
    sec('Suelo');
    for (const f of FLOOR_STYLES) item(`<span class="tilebox" style="background:${f.type === 'baldosa' ? `repeating-conic-gradient(${f.a} 0 25%, ${f.b} 0 50%) 0 0/20px 20px` : f.type === 'madera' ? `repeating-linear-gradient(90deg, ${f.a} 0 10px, ${f.b} 10px 11px)` : f.a}"></span>${f.name}`, f.id === cur, 300, () => Sim.setHouseStyle(st, { floor: f.id }, 300));
    sec('Color de las paredes');
    for (const c of WALL_COLORS) item(`<span class="tilebox" style="background:${c}"></span>`, c === wall.color, 200, () => Sim.setHouseStyle(st, { wall: { color: c } }, 200));
    sec('Papel pintado');
    for (const [k, l] of Object.entries(WALL_PATTERNS)) item(`<span class="tilebox" style="background:${wall.color};font-size:12px;color:var(--ink-2)">${{ liso: '', rayas: '┃┃┃', topos: '•••', rombos: '◇◇' }[k]}</span>${l}`, k === wall.pattern, 150, () => Sim.setHouseStyle(st, { wall: { pattern: k } }, 150));
  }
  renderBuildBar() {
    const v = this.g.view; const bar = $('#buildbar');
    if (!v.build) { bar.hidden = true; return; }
    bar.hidden = false;
    const btn = (ic, label, fn, cls = '') => ({ ic, label, fn, cls });
    let info = '', acts = [];
    if (v.wallTool) {
      const how = { wall: `Arrastra el dedo por los bordes del suelo · ${Sim.WALL_PRICE} € por tramo`, door: `Toca una pared para poner o quitar una puerta · ${Sim.DOOR_PRICE} €`, window: `Toca una pared para poner o quitar una ventana · ${WINDOW_PRICE} €`, erase: 'Toca una pared o puerta para quitarla' }[v.wallTool];
      info = `${icon('box')} ${how}`;
      acts = [btn('box', 'Pared', () => this.g.setWallTool('wall'), v.wallTool === 'wall' ? 'primary' : ''), btn('logout', 'Puerta', () => this.g.setWallTool('door'), v.wallTool === 'door' ? 'primary' : ''), btn('sun', 'Ventana', () => this.g.setWallTool('window'), v.wallTool === 'window' ? 'primary' : ''), btn('trash', 'Quitar', () => this.g.setWallTool('erase'), v.wallTool === 'erase' ? 'red' : ''), btn('check', 'Listo', () => this.g.setWallTool(null))];
    } else if (v.ghost) {
      const d = OBJECTS[v.ghost.type];
      info = `${icon(OBJ_IC[v.ghost.type] || 'box')} <b>${d.name}</b>${v.ghost.mode === 'new' ? ` · ${d.price} €` : ''} · toca el suelo`;
      acts = [btn('rotate', 'Girar', () => this.g.rotateGhost()), btn('check', 'Colocar', () => this.g.confirmGhost(), 'primary'), btn('x', '', () => this.g.cancelGhost())];
    } else if (v.selected) {
      const o = Sim.objById(this.state, v.selected); if (!o) { v.selected = null; return this.renderBuildBar(); }
      const d = OBJECTS[o.type];
      info = `${icon(OBJ_IC[o.type] || 'box')} <b>${d.name}</b>`;
      acts = [btn('move', 'Mover', () => this.g.moveSelected())];
      if (d.tint) acts.push(btn('sparkle', 'Color', () => { Sim.recolorObject(this.state, o); }));
      if (!d.fixed) acts.push(btn('coin', `Vender · ${Math.round(d.price * 0.7)} €`, () => this.g.sellSelected(), 'red'));
      acts.push(btn('x', '', () => { v.selected = null; this.renderBuildBar(); }));
    } else {
      info = `${icon('hammer')} Modo construcción`;
      acts = [btn('box', 'Catálogo', () => this.openPanel('build')), btn('check', 'Terminar', () => { this.closePanel(); this.g.exitBuild(); }, 'primary')];
    }
    bar.innerHTML = `<div class="info glass">${info}</div><div class="acts"></div>`;
    const wrap = bar.querySelector('.acts');
    for (const a of acts) {
      const b = document.createElement('button'); b.className = a.cls; b.innerHTML = icon(a.ic) + (a.label ? `<span>${esc(a.label)}</span>` : '');
      if (!a.label) b.setAttribute('aria-label', 'Cerrar');
      b.onclick = a.fn; wrap.appendChild(b);
    }
  }

  renderMenu() {
    const st = this.state; const body = $('#sheet .sheet-body');
    body.innerHTML = `
      <div class="field"><label>Autonomía de tu familia</label><div class="seg" id="aut"><button data-v="total">Hacen su vida</button><button data-v="normal">Normal</button><button data-v="baja">Baja · estate pendiente</button></div>
        <p class="hint">Con «Hacen su vida» se cuidan solos, trabajan, salen, ven a los vecinos y persiguen sus sueños; tú decides cuando quieras. Sea cual sea la opción, si dejas el móvil un minuto o cierras la app, siguen con su vida.</p></div>
      <div class="field"><label>Reloj</label><div class="seg" id="rt"><button data-v="0">Tiempo de juego</button><button data-v="1">Reloj real</button></div>
        <p class="hint">Con el reloj real el juego va a tu misma hora: si es de noche donde estás, tu familia duerme. El tiempo avanza como en la vida (sin acelerar).</p></div>
      <div class="field"><label>Envejecimiento</label><div class="seg" id="age"><button data-v="1">Activado</button><button data-v="0">Desactivado</button></div></div>
      <p class="hint">Con la app cerrada el tiempo pasa más despacio (1 hora real son unas 6 horas de juego, como mucho 2 días) y tu familia sigue con su vida: al volver te contamos qué han hecho.</p>
      <div class="field"><label>Calidad gráfica</label><div class="seg" id="qual"><button data-v="ligera">Ligera (2D)</button><button data-v="equilibrada">Equilibrada</button><button data-v="alta">Alta</button></div>
        <p class="hint">Si el móvil se calienta o va lento, usa Ligera o Equilibrada. Cambiarla recarga el juego (la partida se guarda).</p></div>
      <div class="sec">${icon('bell')} Notificaciones</div><div id="notif"></div>
      <div class="sec">${icon('cloud')} Copia en la nube</div><div id="cloud"></div>
      <div class="sec">Simulación</div>
      <a class="btn alt" href="../" style="text-decoration:none">${icon('home')} Volver al menú de juegos</a>
      <div class="sec">Partida</div>
      <div class="row"><button class="btn alt" id="msave">${icon('save')} Guardar</button><button class="btn red" id="mnew">${icon('trash')} Nueva</button></div>
      <div class="sec">Cómo se juega</div>
      <p class="hint">Toca a alguien de tu familia (abajo) para controlarle. Toca muebles, personas o el suelo para darle órdenes. Vigila sus necesidades, sus preocupaciones y a los bebés. Trabaja para ganar dinero, paga las facturas en el buzón, invita a gente por teléfono, haz amistades, enamórate y forma una familia de hasta 4.</p>`;
    const seg = (id, val, fn) => { const el = body.querySelector(id); el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === val)); el.onclick = (e) => { const b = e.target.closest('button'); if (b) { fn(b.dataset.v); this.renderMenu(); } }; };
    seg('#aut', st.settings.autonomy, (v) => (st.settings.autonomy = v));
    seg('#age', st.settings.aging ? '1' : '0', (v) => (st.settings.aging = v === '1'));
    seg('#rt', st.settings.realTime ? '1' : '0', (v) => { st.settings.realTime = v === '1'; if (st.settings.realTime) { Sim.syncRealTime(st); st.speed = 1; this.toast('Reloj real activado: ahora vivís a tu misma hora', 'good'); } this.update(); });
    const q = body.querySelector('#qual'); q.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === this.g.quality));
    q.onclick = (e) => { const b = e.target.closest('button'); if (b && b.dataset.v !== this.g.quality) this.g.setQuality(b.dataset.v); };
    this.renderCloud(body.querySelector('#cloud'));
    const nf = body.querySelector('#notif');
    if (!Notify.supported()) nf.innerHTML = `<p class="hint">Este navegador no admite notificaciones.</p>`;
    else if (Notify.enabled()) {
      nf.innerHTML = `<div class="card"><div class="h"><span class="tilebox" style="background:#e3f7ee;color:#127a52">${icon('bell')}</span><div><b>Activadas</b><div class="hint">${Cloud.session() ? 'Te avisaremos aunque cierres la app.' : 'Inicia sesión en la nube para recibirlas también con la app cerrada.'}</div></div></div></div><div class="row" style="margin-top:8px"><button class="btn alt" id="noff">Desactivar</button></div>`;
      nf.querySelector('#noff').onclick = () => { Notify.disable(); this.renderMenu(); };
    } else {
      nf.innerHTML = `<p class="hint" style="margin-top:0">Te avisa cuando tu familia te necesita: hambre, bebés llorando, facturas, nacimientos…</p><button class="btn coral" id="non" style="width:100%">${icon('bell')} Activar notificaciones</button>`;
      nf.querySelector('#non').onclick = () => this.g.enableNotifications();
    }
    body.querySelector('#msave').onclick = () => { this.g.save(); this.toast('Partida guardada', 'good'); };
    body.querySelector('#mnew').onclick = () => this.confirm('Se borrará la partida actual. ¿Empezar de nuevo?', () => this.g.newGame());
  }

  renderCloud(el) {
    if (!Cloud.configured()) { el.innerHTML = `<p class="hint">La copia en la nube aún no está activada en esta versión. Mientras, la partida se guarda en este móvil.</p>`; return; }
    const s = Cloud.session();
    if (!s) {
      el.innerHTML = `<p class="hint" style="margin-top:0">Crea una cuenta para guardar tu partida fuera del móvil y seguir en otro dispositivo. Sin conexión se guarda aquí y se sube sola al volver internet.</p>
        <div class="field"><input type="text" id="cem" inputmode="email" autocomplete="email" autocapitalize="none" autocorrect="off" placeholder="Email"></div>
        <div class="field"><input type="text" id="cpw" autocomplete="current-password" placeholder="Contraseña (mín. 6)" style="-webkit-text-security:disc"></div>
        <div class="row"><button class="btn coral" id="cin">Entrar</button><button class="btn alt" id="cup">Crear cuenta</button></div>
        <p style="text-align:center;margin:10px 0 0"><button class="hint" id="cfg" style="text-decoration:underline">He olvidado la contraseña</button></p>`;
      const v = () => [el.querySelector('#cem').value.trim(), el.querySelector('#cpw').value];
      el.querySelector('#cpw').type = 'password';
      const go = (mode) => { const [e, p] = v(); if (!e || !p) return this.toast('Escribe tu email y una contraseña', 'warn'); el.querySelectorAll('button').forEach((b) => (b.disabled = true)); this.g.cloudLogin(mode, e, p); };
      el.querySelector('#cin').onclick = () => go('in'); el.querySelector('#cup').onclick = () => go('up');
      el.querySelector('#cfg').onclick = async () => { const [e] = v(); if (!e) return this.toast('Escribe tu email primero', 'warn'); try { await Cloud.resetPassword(e); this.toast('Te hemos enviado un email para cambiarla', 'good'); } catch (err) { this.toast(err.message, 'bad'); } };
      return;
    }
    const m = Cloud.meta();
    const ago = m.syncedAt ? Math.max(0, Math.round((Date.now() - m.syncedAt) / 60000)) : null;
    const status = m.pending ? (navigator.onLine ? 'Hay cambios por subir' : 'Sin conexión: se subirá al volver internet') : ago === null ? 'Aún no se ha subido' : ago < 1 ? 'Sincronizada ahora mismo' : `Sincronizada hace ${ago} min`;
    el.innerHTML = `<div class="card"><div class="h"><span class="tilebox" style="background:${m.pending ? '#fff3dc' : '#e3f7ee'};color:${m.pending ? '#b7791f' : '#127a52'}">${icon(m.pending ? 'clock' : 'check')}</span><div style="min-width:0"><b>${esc(s.email)}</b><div class="hint">${status}</div></div></div></div>
      <div class="row" style="margin-top:8px"><button class="btn alt" id="cpush">${icon('cloud')} Subir ahora</button><button class="btn alt" id="cout">${icon('logout')} Salir</button></div>`;
    el.querySelector('#cpush').onclick = () => { this.g.save(); this.g.cloudPush(true); };
    el.querySelector('#cout').onclick = () => this.confirm('¿Cerrar sesión en la nube? La partida seguirá guardada en este móvil.', () => this.g.cloudLogout());
  }

  // ---------- modales ----------
  modal(html) { const m = $('#modal'); m.hidden = false; const box = m.querySelector('.modal-box'); box.innerHTML = html; box.scrollTop = 0; return box; }
  closeModal() { $('#modal').hidden = true; }
  confirm(text, yes) {
    const box = this.modal(`<h2>¿Seguro?</h2><p>${esc(text)}</p><div class="actions"><button class="btn alt" id="cno">Cancelar</button><button class="btn coral" id="cyes">Sí</button></div>`);
    box.querySelector('#cno').onclick = () => this.closeModal();
    box.querySelector('#cyes').onclick = () => { this.closeModal(); yes(); };
  }
  info(title, html, btn = 'Vale', cb) {
    const box = this.modal(`<h2>${title}</h2>${html}<div class="actions"><button class="btn coral" id="iok">${btn}</button></div>`);
    box.querySelector('#iok').onclick = () => { this.closeModal(); cb && cb(); };
  }
  choose(title, text, opts) {
    const box = this.modal(`<h2>${esc(title)}</h2><p>${esc(text)}</p><div class="actions" style="flex-direction:column">${opts.map(([l], i) => `<button class="btn ${i ? 'alt' : 'coral'}" data-i="${i}">${esc(l)}</button>`).join('')}</div>`);
    box.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { this.closeModal(); opts[+b.dataset.i][1](); }));
  }
  li(ic, html) { return `<li><span class="tilebox">${icon(ic)}</span><span>${html}</span></li>`; }

  showOffline(sum) {
    const st = this.state; const hrs = Math.round(sum.mins / 60); const low = [];
    for (const s of Sim.householdSims(st)) {
      const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
      const bad = list.filter((n) => s.needs[n] < 35);
      if (bad.length) low.push(`<b>${esc(s.name)}</b> necesita: ${bad.map((n) => NEED_INFO[n].label.toLowerCase()).join(', ')}`);
    }
    let html = `<p>Han pasado <b>${hrs} h</b> de juego y tu familia ha seguido con su vida:</p><ul>`;
    if (sum.money) html += this.li('coin', `Dinero: <b>${sum.money > 0 ? '+' : ''}${sum.money} €</b>`);
    for (const m of sum.memories || []) html += this.li('star', esc(m));
    for (const l of sum.log) html += this.li('bell', esc(noEmoji(l)));
    for (const l of low) html += this.li('alert', l);
    html += '</ul>';
    this.info('Mientras no estabas…', html, 'Seguir jugando');
  }
  chooseJob(simId) {
    const st = this.state; const s = st.sims[simId];
    let html = `<p class="hint">Elige trabajo para ${esc(s.name)}. Se trabaja de lunes a viernes.</p><div class="list">`;
    for (const [id, c] of Object.entries(CAREERS)) {
      html += `<button class="li ${s.job?.id === id ? 'on' : ''}" data-id="${id}"><span class="tilebox">${icon('briefcase')}</span><div><b>${c.label}</b> · ${inflect(c.levels[0], s)}<div class="hint">${c.start}:00–${c.end}:00 · empieza con ${c.pay[0]} €/día, hasta ${c.pay[4]} €</div></div></button>`;
    }
    html += `</div><div class="actions"><button class="btn alt" id="jc">Cancelar</button></div>`;
    const box = this.modal(`<h2>Ofertas de trabajo</h2>${html}`);
    box.querySelector('#jc').onclick = () => this.closeModal();
    box.querySelectorAll('.li').forEach((b) => (b.onclick = () => { this.closeModal(); if (s.job?.id !== b.dataset.id) Sim.setJob(st, s, b.dataset.id); }));
  }
  chooseInvite() {
    const st = this.state; const me = this.active;
    const ns = Sim.neighbors(st).filter((n) => n.location !== 'casa');
    let html = `<div class="list">` + (ns.length ? '' : '<p class="hint">Todo el vecindario está ya en tu casa.</p>');
    for (const n of ns) html += `<button class="li" data-id="${n.id}"><canvas></canvas><div><b>${esc(n.name)}</b><div class="hint">${Sim.relLabel(st, me, n)} · ${GENDERS[n.gender].label}</div></div></button>`;
    html += `</div><div class="actions"><button class="btn alt" id="ic">Cancelar</button></div>`;
    const box = this.modal(`<h2>¿A quién llamas?</h2>${html}`);
    box.querySelectorAll('.li').forEach((b) => { drawPortrait(b.querySelector('canvas'), st.sims[b.dataset.id], 42); b.onclick = () => { this.closeModal(); Sim.inviteNeighbor(st, b.dataset.id); }; });
    box.querySelector('#ic').onclick = () => this.closeModal();
  }
  chooseOuting(simId) {
    const st = this.state; const me = st.sims[simId];
    const fam = Sim.householdSims(st).filter((s) => s !== me && Sim.canGoOut(st, s));
    const pick = new Set();
    const render = () => {
      let h = `<p class="hint">¿A dónde va ${esc(me.name)}? Puede ir con más gente de la familia.</p><div class="list">`;
      for (const [k, o] of Object.entries(OUTINGS)) if (!o.hidden) h += `<button class="li" data-d="${k}"><span class="tilebox">${icon(o.ic)}</span><div><b>${o.label}</b><div class="hint">${Math.round(o.dur / 60 * 10) / 10} h · ${o.cost ? o.cost + ' € por persona' : 'Gratis'}${o.outdoor && ['lluvia', 'nieve'].includes(Sim.weatherOf(st).type) ? ' · hoy hace mal tiempo' : ''}</div></div></button>`;
      h += '</div>';
      if (fam.length) h += `<div class="field"><label>Acompañantes</label><div class="seg" id="ocomp">${fam.map((s) => `<button data-id="${s.id}" class="${pick.has(s.id) ? 'on' : ''}">${esc(s.name)}</button>`).join('')}</div></div>`;
      h += `<div class="actions"><button class="btn alt" id="oc">Cancelar</button></div>`;
      const box = this.modal(`<h2>Salir de casa</h2>${h}`);
      const comp = box.querySelector('#ocomp'); if (comp) comp.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; pick.has(b.dataset.id) ? pick.delete(b.dataset.id) : pick.add(b.dataset.id); render(); };
      box.querySelector('#oc').onclick = () => this.closeModal();
      box.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { const group = [me, ...[...pick].map((id) => st.sims[id])]; if (group.some((g) => g.age === 'nino') && group.length === 1) return; this.closeModal(); Sim.startOuting(st, group, b.dataset.d); this.update(); }));
    };
    render();
  }
  choosePet() {
    const st = this.state; let species = 'perro', color = PETS.perro.colors[0], name = PET_NAMES[Math.floor(Math.random() * PET_NAMES.length)];
    const render = () => {
      const box = this.modal(`<h2>Adoptar una mascota</h2><p class="hint">Cuesta 200 €. Necesita comida, cariño y jugar. Si nadie la cuida, puede escaparse.</p>
        <div class="field"><label>Especie</label><div class="seg" id="ps">${Object.entries(PETS).map(([k, p]) => `<button data-v="${k}" class="${k === species ? 'on' : ''}">${p.label}</button>`).join('')}</div></div>
        <div class="field"><label>Color</label><div class="sw" id="pc">${PETS[species].colors.map((c) => `<button data-v="${c}" class="${c === color ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div></div>
        <div class="field"><label>Nombre</label><input type="text" id="pn" maxlength="12" value="${esc(name)}" autocomplete="off"></div>
        <div class="actions"><button class="btn alt" id="pno">Cancelar</button><button class="btn coral" id="pok">${icon('heart')} Adoptar</button></div>`);
      box.querySelector('#pn').oninput = (e) => (name = e.target.value);
      box.querySelector('#ps').onclick = (e) => { const b = e.target.closest('button'); if (b) { species = b.dataset.v; color = PETS[species].colors[0]; render(); } };
      box.querySelector('#pc').onclick = (e) => { const b = e.target.closest('button'); if (b) { color = b.dataset.v; render(); } };
      box.querySelector('#pno').onclick = () => this.closeModal();
      box.querySelector('#pok').onclick = () => { this.closeModal(); Sim.adoptPet(st, species, name.trim(), color); this.update(); };
    };
    render();
  }
  writeLetter(simId) {
    const st = this.state; const me = st.sims[simId];
    const kids = Sim.householdSims(st).filter((s) => s !== me && (s.age === 'bebe' || s.age === 'nino'));
    let to = kids[0]?.id || 'familia';
    const box = this.modal(`<h2>Carta al futuro</h2><p class="hint">Escribe lo que ${esc(me.name)} quiere decir. ${kids.length ? 'A un hijo o hija se le entregará cuando sea adulto/a.' : ''} La cápsula del tiempo familiar se abre dentro de 7 días.</p>
      <div class="field"><label>Para</label><div class="seg" id="lt">${kids.map((k) => `<button data-v="${k.id}">${esc(k.name)}</button>`).join('')}<button data-v="familia">Cápsula del tiempo</button></div></div>
      <div class="field"><textarea id="ltx" maxlength="400" rows="6" placeholder="Querida familia…"></textarea></div>
      <div class="actions"><button class="btn alt" id="lno">Cancelar</button><button class="btn coral" id="lok">${icon('pencil')} Guardar carta</button></div>`);
    const seg = box.querySelector('#lt'); const mark = () => seg.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === to)); mark();
    seg.onclick = (e) => { const b = e.target.closest('button'); if (b) { to = b.dataset.v; mark(); } };
    box.querySelector('#lno').onclick = () => this.closeModal();
    box.querySelector('#lok').onclick = () => { const t = box.querySelector('#ltx').value.trim(); if (!t) return this.toast('Escribe algo en la carta', 'warn'); this.closeModal(); Sim.writeLetter(st, me, to, t); };
  }
  readLetter(L) {
    const st = this.state; const rec = L.to === 'familia' ? 'toda la familia' : st.sims[L.to]?.name;
    this.info('Una carta del pasado', `<p class="hint">De ${esc(L.fromName)} para ${esc(rec || '')} · escrita el día ${Sim.dayOf(L.t) + 1}</p><div class="letter">${esc(L.text).replace(/\n/g, '<br>')}</div>`, 'Guardarla en el corazón');
  }
  confirmAdopt() { this.confirm('Adoptar un bebé cuesta 1000 €. ¿Seguro?', () => Sim.adoptBaby(this.state)); }
  nameBaby(babyId, adopted) {
    const st = this.state; const b = st.sims[babyId]; if (!b) return;
    const prevSpeed = st.speed; this.g.setSpeed(0);
    const box = this.modal(`<h2>${adopted ? '¡Habéis adoptado!' : '¡Ha nacido un bebé!'}</h2><div class="preview"><canvas></canvas></div>
      <div class="field"><label>Nombre</label><input type="text" id="bn" maxlength="14" value="${esc(b.name)}" autocomplete="off" enterkeyhint="done"></div>
      <div class="field"><label>Género</label><div class="seg" id="bg">${Object.entries(GENDERS).map(([k, g]) => `<button data-v="${k}">${g.label}</button>`).join('')}</div></div>
      <p class="hint">Necesitará una cuna, biberón, pañales limpios y muchos mimos.</p><div class="actions"><button class="btn coral" id="bok">Listo</button></div>`);
    drawPortrait(box.querySelector('canvas'), b, 110);
    const seg = box.querySelector('#bg');
    const mark = () => seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x.dataset.v === b.gender));
    mark(); seg.onclick = (e) => { const x = e.target.closest('button'); if (x) { b.gender = x.dataset.v; Object.assign(b, Sim.defaultFertility(b.gender)); mark(); } };
    box.querySelector('#bok').onclick = () => { const v = box.querySelector('#bn').value.trim(); if (v) b.name = v; this.closeModal(); this.g.setSpeed(prevSpeed || 1); $('#family').dataset.sig = ''; this.renderFamily(); };
  }

  // ---------- pantalla de título ----------
  showTitle(hasSave, onContinue, onNew, cloudFamily) {
    const t = $('#title'); t.hidden = false; t.classList.remove('out');
    t.innerHTML = `<div class="logo"><div class="mark">${icon('home')}</div><h1>Vidas</h1><p>Cuida de tu familia, día a día.</p>
      <div class="pride">${PRIDE.map((c) => `<i style="background:${c}"></i>`).join('')}</div></div>
      <a href="../" class="backhub">${icon('logout')} Simulación</a>
      <div class="acts">${hasSave ? `<button class="btn coral" id="tcont">${icon(cloudFamily ? 'cloud' : 'play')} Continuar${cloudFamily ? ` · familia ${esc(cloudFamily)}` : ''}</button>` : ''}<button class="btn ${hasSave ? 'ghost' : 'coral'}" id="tnew">${icon('plus')} Nueva familia</button></div>`;
    const hide = () => { t.classList.add('out'); setTimeout(() => (t.hidden = true), 400); };
    if (hasSave) t.querySelector('#tcont').onclick = () => { hide(); onContinue(); };
    t.querySelector('#tnew').onclick = () => {
      if (hasSave) this.confirm('Se borrará tu partida guardada. ¿Crear una familia nueva?', () => { hide(); onNew(); });
      else { hide(); onNew(); }
    };
  }

  // ---------- cambiar el aspecto de alguien de la familia ----------
  editLook(sim) {
    const look = { eyes: 'redondos', eyeColor: '#4a2e1c', ...sim.look }; let name = sim.name;
    const segH = (id, opts) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>`;
    const swH = (id, cols) => `<div class="sw" id="${id}">${cols.map((c) => `<button data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
    const render = (scroll = 0) => {
      const box = this.modal(`<h2>Cambiar aspecto</h2><div class="preview"><canvas id="lp"></canvas></div>
        <div class="group">
          <div class="field"><label>Nombre</label><input type="text" id="ln" maxlength="14" value="${esc(name)}" autocomplete="off"></div>
          <div class="field"><label>Ojos</label>${segH('ley', Object.entries(EYE_STYLES))}</div>
          <div class="field"><label>Color de ojos</label>${swH('lec', EYE_COLORS)}</div>
        </div>
        <div class="group">
          <div class="field"><label>Peinado</label>${segH('lh', HAIR_STYLES.map((n, i) => [i, n]))}</div>
          <div class="field"><label>Pelo</label>${swH('lhc', HAIR_COLORS)}</div>
          <div class="field"><label>Piel</label>${swH('lsk', SKINS)}</div>
        </div>
        <div class="group">
          <div class="field"><label>Silueta</label>${segH('lb', Object.entries(BODY_STYLES))}</div>
          <div class="field"><label>Parte de arriba</label>${swH('lsh', CLOTHES)}</div>
          <div class="field"><label>Parte de abajo</label>${swH('lpa', CLOTHES)}</div>
        </div>
        <div class="actions"><button class="btn alt" id="lno">Cancelar</button><button class="btn coral" id="lok">${icon('check')} Guardar</button></div>`);
      box.scrollTop = scroll;
      drawPortrait(box.querySelector('#lp'), { look, age: sim.age, mood: 80 }, 110);
      box.querySelector('#ln').oninput = (e) => (name = e.target.value);
      const seg = (id, val, fn) => {
        const el = box.querySelector(id);
        el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(val) === b.dataset.v));
        el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; fn(b.dataset.v); render(box.scrollTop); };
      };
      seg('#ley', look.eyes, (v) => (look.eyes = v)); seg('#lec', look.eyeColor, (v) => (look.eyeColor = v));
      seg('#lh', look.hair, (v) => (look.hair = +v)); seg('#lhc', look.hairColor, (v) => (look.hairColor = v)); seg('#lsk', look.skin, (v) => (look.skin = v));
      seg('#lb', look.body, (v) => (look.body = v)); seg('#lsh', look.shirt, (v) => (look.shirt = v)); seg('#lpa', look.pants, (v) => (look.pants = v));
      box.querySelector('#lno').onclick = () => this.closeModal();
      box.querySelector('#lok').onclick = () => {
        sim.look = look; if (name.trim()) sim.name = name.trim();
        this.closeModal(); $('#family').dataset.sig = ''; this.sig = ''; this.update(); this.g.save();
        this.toast(`${sim.name} tiene nuevo aspecto`, 'good', sim.id);
      };
    };
    render();
  }

  // ---------- creador de familia ----------
  createFamily(onDone, onCancel) {
    const defs = [this.newMember('f')];
    let sel = 0; let surname = 'García'; let married = true;
    const render = (keepScroll = 0) => {
      const d = defs[sel];
      const adults = defs.filter((x) => x.age !== 'nino');
      const segH = (id, opts) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}">${l}</button>`).join('')}</div>`;
      const swH = (id, cols) => `<div class="sw" id="${id}">${cols.map((c) => `<button data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')}</div>`;
      const box = this.modal(`
        <h2>Crea tu familia</h2>
        <div class="field"><label>Apellido</label><input type="text" id="fs" maxlength="16" value="${esc(surname)}" autocomplete="off"></div>
        <div class="members">${defs.map((x, i) => `<button class="m ${i === sel ? 'on' : ''}" data-i="${i}" aria-label="${esc(x.name)}"><canvas></canvas></button>`).join('')}${defs.length < 4 ? `<button class="add" id="fadd" aria-label="Añadir">${icon('plus')}</button>` : ''}</div>
        <div class="preview"><canvas id="fp"></canvas></div>
        <div class="group">
          <div class="field"><label>Nombre</label><input type="text" id="fn" maxlength="14" value="${esc(d.name)}" autocomplete="off"></div>
          <div class="field"><label>Género</label>${segH('fg', Object.entries(GENDERS).map(([k, g]) => [k, g.label]))}</div>
          <div class="field"><label>Etapa de la vida</label>${segH('fa', [['adulto', 'Adulta'], ['nino', 'Infancia'], ['anciano', 'Mayor']])}</div>
        </div>
        <div class="group">
          <div class="field"><label>Piel</label>${swH('fskin', SKINS)}</div>
          <div class="field"><label>Silueta</label>${segH('fb', Object.entries(BODY_STYLES))}</div>
          <div class="field"><label>Peinado</label>${segH('fh', HAIR_STYLES.map((n, i) => [i, n]))}</div>
          <div class="field"><label>Pelo</label>${swH('fhc', HAIR_COLORS)}</div>
          <div class="field"><label>Ojos</label>${segH('fey', Object.entries(EYE_STYLES))}</div>
          <div class="field"><label>Color de ojos</label>${swH('fec', EYE_COLORS)}</div>
          <div class="field"><label>Parte de arriba</label>${swH('fsh', CLOTHES)}</div>
          <div class="field"><label>Parte de abajo</label>${swH('fpa', CLOTHES)}</div>
        </div>
        <div class="group">
          <div class="field"><label>Personalidad · elige 2</label>${segH('ft', Object.entries(TRAITS).map(([k, t]) => [k, inflect(t.label, d)]))}<p class="hint" id="ftd"></p></div>
          ${d.age !== 'nino' ? `<div class="field"><label>Aspiración en la vida</label>${segH('fasp', Object.entries(ASPIRATIONS).map(([k, a]) => [k, a.label]))}<p class="hint">${d.aspiration ? ASPIRATIONS[d.aspiration].steps.join(' → ') : ''}</p></div>` : ''}
        </div>
        ${d.age !== 'nino' ? `<div class="group">
          <div class="field"><label>Le atraen</label>${segH('fat', [['f', 'Mujeres'], ['m', 'Hombres'], ['x', 'Personas no binarias']])}<p class="hint">Sin ninguna marcada: no siente atracción romántica.</p></div>
          <div class="field"><label>Puede gestar un bebé</label>${segH('fcc', [['1', 'Sí'], ['0', 'No']])}</div>
          <div class="field"><label>Puede aportar para un embarazo</label>${segH('fcs', [['1', 'Sí'], ['0', 'No']])}</div>
          <p class="hint">Cualquier pareja puede tener hijos si una persona puede gestar y la otra aportar. Si no, siempre podéis adoptar.</p>
        </div>` : ''}
        ${adults.length >= 2 ? `<div class="field"><label>Las dos primeras personas adultas</label>${segH('fm', [['1', 'Están casadas'], ['0', 'Comparten piso']])}</div>` : ''}
        <div class="actions">${defs.length > 1 ? `<button class="btn alt" id="fdel">${icon('trash')} Quitar</button>` : onCancel ? `<button class="btn alt" id="fcan">Volver</button>` : ''}<button class="btn coral" id="fok">${icon('play')} Empezar</button></div>`);
      box.scrollTop = keepScroll;
      const keep = () => { surname = box.querySelector('#fs').value.trim() || surname; d.name = box.querySelector('#fn').value.trim() || d.name; };
      box.querySelectorAll('.members .m').forEach((b) => { drawPortrait(b.querySelector('canvas'), { look: defs[b.dataset.i].look, age: defs[b.dataset.i].age }, 58); b.onclick = () => { keep(); sel = +b.dataset.i; render(); }; });
      drawPortrait(box.querySelector('#fp'), { look: d.look, age: d.age }, 110);
      box.querySelector('#fs').oninput = keep;
      box.querySelector('#fn').oninput = () => { d.nameAuto = false; keep(); };
      const seg = (id, val, fn) => {
        const el = box.querySelector(id); if (!el) return;
        el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Array.isArray(val) ? val.includes(b.dataset.v) : String(val) === b.dataset.v));
        el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; keep(); fn(b.dataset.v); render(box.scrollTop); };
      };
      seg('#fg', d.gender, (v) => { d.gender = v; Object.assign(d, Sim.defaultFertility(v)); if (d.nameAuto) d.name = Sim.randomName(v); });
      seg('#fa', d.age, (v) => (d.age = v));
      seg('#fskin', d.look.skin, (v) => (d.look.skin = v));
      seg('#fb', d.look.body, (v) => (d.look.body = v));
      seg('#fh', d.look.hair, (v) => (d.look.hair = +v));
      seg('#fhc', d.look.hairColor, (v) => (d.look.hairColor = v));
      seg('#fey', d.look.eyes || 'redondos', (v) => (d.look.eyes = v));
      seg('#fec', d.look.eyeColor, (v) => (d.look.eyeColor = v));
      seg('#fsh', d.look.shirt, (v) => (d.look.shirt = v));
      seg('#fpa', d.look.pants, (v) => (d.look.pants = v));
      seg('#ft', d.traits, (v) => { if (d.traits.includes(v)) d.traits = d.traits.filter((t) => t !== v); else { d.traits.push(v); if (d.traits.length > 2) d.traits.shift(); } });
      seg('#fasp', d.aspiration, (v) => (d.aspiration = v));
      seg('#fat', d.attraction, (v) => { d.attraction = d.attraction.includes(v) ? d.attraction.filter((x) => x !== v) : [...d.attraction, v]; });
      seg('#fcc', d.canCarry ? '1' : '0', (v) => (d.canCarry = v === '1'));
      seg('#fcs', d.canSire ? '1' : '0', (v) => (d.canSire = v === '1'));
      seg('#fm', married ? '1' : '0', (v) => (married = v === '1'));
      box.querySelector('#ftd').textContent = d.traits.map((t) => `${inflect(TRAITS[t].label, d)}: ${TRAITS[t].desc.toLowerCase()}`).join(' · ');
      const add = box.querySelector('#fadd'); if (add) add.onclick = () => { keep(); defs.push(this.newMember(['m', 'x', 'f'][(defs.length - 1) % 3])); sel = defs.length - 1; render(); };
      const del = box.querySelector('#fdel'); if (del) del.onclick = () => { defs.splice(sel, 1); sel = 0; render(); };
      const can = box.querySelector('#fcan'); if (can) can.onclick = () => { this.closeModal(); onCancel(); };
      box.querySelector('#fok').onclick = () => {
        keep();
        if (!defs.some((x) => x.age !== 'nino')) return this.toast('La familia necesita al menos una persona adulta', 'warn');
        const ad = defs.map((x, i) => [x, i]).filter(([x]) => x.age !== 'nino');
        defs.forEach((x) => delete x.partnerIdx);
        if (married && ad.length >= 2) { ad[0][0].partnerIdx = ad[1][1]; ad[1][0].partnerIdx = ad[0][1]; }
        this.closeModal(); onDone(defs, surname);
      };
    };
    render();
  }
  newMember(g) {
    return { aspiration: Object.keys(ASPIRATIONS)[Math.floor(Math.random() * 5)], name: Sim.randomName(g), nameAuto: true, gender: g, age: 'adulto', look: Sim.randomLook(g), traits: [], attraction: [...Sim.ALL_GENDERS], ...Sim.defaultFertility(g) };
  }
}

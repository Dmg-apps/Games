// Interfaz DOM: barras, paneles, menús contextuales, modales.
import { NEEDS, BABY_NEEDS, NEED_INFO, TRAITS, AGES, OBJECTS, CATEGORIES, CAREERS, SCHOOL, MOODLETS, WORRIES, DAYS, SKINS, HAIR_COLORS, CLOTHES, HAIR_STYLES } from './data.js';
import * as Sim from './sim.js';
import { drawPortrait } from './render.js';

const $ = (s) => document.querySelector(s);
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const OBJ_ICON = { nevera: '🧊', cocina: '🍳', mesa: '🍽️', cama: '🛏️', camita: '🛌', cuna: '👶', vater: '🚽', ducha: '🚿', sofa: '🛋️', tele: '📺', equipo: '🎵', estanteria: '📚', ordenador: '💻', juguetes: '🧸', telefono: '☎️', planta: '🪴', lampara: '💡', cuadro: '🟥', arbol: '🌳', buzon: '📬' };
export const moodColor = (m) => (m >= 70 ? '#2bb85b' : m >= 45 ? '#e8c43a' : m >= 25 ? '#e8893a' : '#e04848');
const moodFace = (m) => (m >= 80 ? '😄' : m >= 60 ? '🙂' : m >= 40 ? '😐' : m >= 20 ? '😟' : '😢');
const needColor = (v) => (v >= 60 ? '#2bb85b' : v >= 35 ? '#e8c43a' : v >= 15 ? '#e8893a' : '#e04848');

export class UI {
  constructor(game) {
    this.g = game; this.panel = null; this.sig = '';
    this.toastEls = [];
    $('#speeds').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.g.setSpeed(+b.dataset.s); });
    $('#modes').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) this.togglePanel(b.dataset.panel); });
    $('#sheet .close').addEventListener('click', () => this.closePanel());
    document.addEventListener('pointerdown', (e) => { if (!$('#pie').hidden && !e.target.closest('#pie')) this.hidePie(); }, true);
  }
  get state() { return this.g.state; }
  get active() { return this.state.sims[this.state.active]; }

  // ---------- barra superior / familia / cola ----------
  update() {
    const st = this.state; if (!st) return;
    $('#money').textContent = `💰 ${st.money.toLocaleString('es-ES')} €`;
    const h = Math.floor(Sim.hourOf(st.time)), m = Math.floor(st.time % 60);
    $('#clock').textContent = `${DAYS[Sim.dowOf(st.time)]} · Día ${Sim.dayOf(st.time) + 1} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${st.powerOff ? ' 🔌' : ''}`;
    document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('on', +b.dataset.s === st.speed));
    this.renderFamily(); this.renderQueue();
    if (this.panel === 'needs') this.renderNeeds();
    if (this.panel === 'rels') this.renderRels(false);
  }
  renderFamily() {
    const st = this.state; const el = $('#family');
    const sims = Sim.householdSims(st);
    const sig = sims.map((s) => s.id + s.age + s.look.hair).join('|');
    if (el.dataset.sig !== sig) {
      el.dataset.sig = sig; el.innerHTML = '';
      for (const s of sims) {
        const b = document.createElement('button'); b.className = 'fam'; b.dataset.id = s.id;
        b.innerHTML = '<canvas></canvas><span class="ring"></span><span class="alert" hidden>❗</span><span class="away" hidden>💼</span>';
        b.onclick = () => this.g.selectSim(s.id, true);
        el.appendChild(b);
      }
    }
    for (const b of el.children) {
      const s = st.sims[b.dataset.id]; if (!s) continue;
      b.classList.toggle('on', s.id === st.active);
      const ring = b.querySelector('.ring'); ring.style.background = moodColor(s.mood); ring.textContent = '';
      const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
      const alert = list.some((n) => s.needs[n] < 20) || s.crying || s.worries.length > 0;
      b.querySelector('.alert').hidden = !alert;
      const away = b.querySelector('.away'); away.hidden = s.location === 'casa';
      away.textContent = s.location === 'escuela' ? '🎒' : '💼';
      const moodBucket = s.mood >= 50 ? 1 : 0;
      if (b.dataset.mb !== String(moodBucket)) { b.dataset.mb = moodBucket; drawPortrait(b.querySelector('canvas'), s, 54); }
    }
  }
  renderQueue() {
    const s = this.active; const el = $('#queue');
    if (!s) { el.innerHTML = ''; return; }
    const items = [];
    if (s.cur && s.cur.kind !== 'partner') {
      items.push({ cur: true, icon: s.cur.icon || '•', label: s.cur.label || '', idx: -1, cancel: s.cur.kind !== 'ko' && s.cur.kind !== 'leave' });
    } else if (s.cur?.kind === 'partner') items.push({ cur: true, icon: s.cur.icon, label: s.cur.label, idx: -2, cancel: false });
    s.queue.forEach((q, i) => items.push({ icon: q.icon, label: q.label, idx: i, cancel: true }));
    const sig = s.id + items.map((i) => i.icon + i.label + i.idx).join('|');
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig; el.innerHTML = '';
    for (const it of items) {
      const c = document.createElement('div'); c.className = 'qchip' + (it.cur ? ' cur' : '');
      c.innerHTML = `<b>${it.icon}</b><span>${esc(it.label.length > 22 ? it.label.slice(0, 21) + '…' : it.label)}</span>${it.cancel ? '<button class="x">✕</button>' : ''}`;
      if (it.cancel) c.querySelector('.x').onclick = () => { Sim.cancelItem(this.state, s, it.idx); el.dataset.sig = ''; this.renderQueue(); };
      el.appendChild(c);
    }
  }

  // ---------- avisos ----------
  toast(msg, kind = 'info', simId = null) {
    const el = document.createElement('div'); el.className = 'toast ' + kind; el.textContent = msg;
    if (simId) el.onclick = () => { if (this.state.sims[simId]?.home) this.g.selectSim(simId, true); else this.g.centerOnSim(simId); };
    $('#toasts').prepend(el); this.toastEls.unshift(el);
    while (this.toastEls.length > 4) this.toastEls.pop().remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.remove(); this.toastEls = this.toastEls.filter((x) => x !== el); }, 320); }, kind === 'bad' || kind === 'worry' ? 6500 : 4500);
    if (kind === 'bad' && navigator.vibrate) navigator.vibrate(60);
  }
  fade() {
    const f = $('#fade'); f.classList.add('on');
    setTimeout(() => f.classList.remove('on'), 1800);
  }

  // ---------- menú contextual ----------
  showPie(x, y, title, options) {
    const pie = $('#pie'); pie.innerHTML = `<div class="ttl">${esc(title)}</div>`;
    if (!options.length) pie.innerHTML += '<div class="small" style="padding:8px 10px">No hay nada que hacer aquí</div>';
    for (const o of options) {
      const b = document.createElement('button');
      b.innerHTML = `<b>${o.icon}</b><span>${esc(o.label)}${o.disabled ? `<small>${esc(o.disabled)}</small>` : ''}</span>`;
      b.disabled = !!o.disabled;
      b.onclick = () => { this.hidePie(); o.run(); };
      pie.appendChild(b);
    }
    pie.hidden = false;
    const r = pie.getBoundingClientRect();
    pie.style.left = Math.max(8, Math.min(window.innerWidth - r.width - 8, x - r.width / 2)) + 'px';
    pie.style.top = Math.max(60, Math.min(window.innerHeight - r.height - 8, y - r.height - 20)) + 'px';
  }
  hidePie() { $('#pie').hidden = true; }

  // ---------- paneles ----------
  togglePanel(name) {
    if (this.panel === name) return this.closePanel();
    if (name === 'build') { this.closePanel(); this.g.enterBuild(); return this.openPanel('build'); }
    if (this.g.view.build) this.g.exitBuild();
    this.openPanel(name);
  }
  openPanel(name) {
    this.panel = name; this.sig = '';
    document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', b.dataset.panel === name));
    $('#sheet').hidden = false; document.body.classList.add('sheet-open');
    const titles = { needs: 'Estado', rels: 'Relaciones', build: 'Catálogo', menu: 'Menú' };
    $('#sheet h2').textContent = titles[name];
    if (name === 'needs') this.renderNeeds();
    if (name === 'rels') this.renderRels(true);
    if (name === 'build') this.renderBuild();
    if (name === 'menu') this.renderMenu();
  }
  closePanel() {
    if (this.panel === 'build' && !this.g.view.ghost) this.g.exitBuild();
    this.panel = null; $('#sheet').hidden = true; document.body.classList.remove('sheet-open');
    document.querySelectorAll('#modes button').forEach((b) => b.classList.toggle('on', this.g.view.build && b.dataset.panel === 'build'));
  }
  hideSheetOnly() { $('#sheet').hidden = true; this.panel = null; document.body.classList.remove('sheet-open'); }

  renderNeeds() {
    const s = this.active; const body = $('#sheet .sheet-body'); const st = this.state;
    if (!s) return;
    const sig = [s.id, s.age, s.worries.join(), s.moodlets.map((m) => m.id).join(), Sim.derivedMoodlets(st, s).map((d) => d.label).join(), s.job?.id, s.job?.level, s.pregnant ? 1 : 0, s.location, s.partner, s.skipDay === Sim.dayOf(st.time)].join('|');
    if (sig !== this.sig) {
      this.sig = sig;
      const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
      let h = `<div class="row"><canvas id="np" style="width:56px;height:56px;border-radius:50%;background:#eef3fa"></canvas><div style="flex:1"><b style="font-size:17px">${esc(s.name)} ${esc(s.surname || '')}</b><div class="small">${AGES[s.age].label} · ${s.gender === 'f' ? '♀' : '♂'}${s.partner && st.sims[s.partner] ? ` · ${s.married ? 'Casado/a con' : 'Pareja de'} ${esc(st.sims[s.partner].name)}` : ''}</div><div>${s.traits.map((t) => `<span class="tag" title="${esc(TRAITS[t].desc)}">${TRAITS[t].label}</span>`).join('')}</div></div></div>`;
      h += `<h3>Ánimo <span id="nmood"></span></h3><div class="meter"><i id="nmoodbar"></i></div>`;
      h += `<h3>Necesidades</h3>` + list.map((n) => `<div class="need"><span>${NEED_INFO[n].icon}</span><span>${NEED_INFO[n].label}</span><div class="b"><i data-n="${n}"></i></div></div>`).join('');
      if (s.pregnant) h += `<p class="tag good">🤰 Bebé en camino: nacerá en <span id="npreg"></span></p>`;
      if (s.worries.length) h += `<h3>Preocupaciones</h3>` + s.worries.map((w) => `<div><span class="tag worry">💭 ${WORRIES[w].label}</span> <span class="small">${WORRIES[w].hint}</span></div>`).join('');
      const ml = [...s.moodlets.map((m) => MOODLETS[m.id]).filter(Boolean), ...Sim.derivedMoodlets(st, s)];
      if (ml.length) h += `<h3>Sensaciones</h3>` + ml.map((m) => `<span class="tag ${m.mood >= 0 ? 'good' : 'bad'}">${m.label} ${m.mood > 0 ? '+' : ''}${m.mood}</span>`).join('');
      if (s.age === 'bebe') h += `<h3>Cuidados</h3><p class="small">Los bebés dependen de ti. Selecciona a un adulto y toca al bebé para darle el biberón, cambiarle el pañal o acunarlo. Con una cuna duerme mejor.</p>`;
      if (s.school && s.age === 'nino') h += `<h3>Colegio</h3><div class="small">Lun–Vie de ${SCHOOL.start}:00 a ${SCHOOL.end}:00 · Nota: <b id="ngrade"></b></div>`;
      if (Sim.isAdult(s)) {
        h += `<h3>Trabajo</h3>`;
        if (s.job) {
          const c = CAREERS[s.job.id];
          h += `<div>${c.icon} <b>${c.levels[s.job.level]}</b> (${c.label}) · ${c.pay[s.job.level]} €/día<div class="small">Lun–Vie de ${c.start}:00 a ${c.end}:00</div><div class="small">Rendimiento</div><div class="meter"><i id="nperf"></i></div></div>`;
          h += `<div class="actions"><button class="btn alt" id="nskip" ${s.skipDay === Sim.dayOf(st.time) ? 'disabled' : ''}>🛌 Faltar hoy</button><button class="btn alt" id="nquit">🚪 Dejarlo</button></div>`;
        } else h += `<p class="small">Sin trabajo. Usa el ordenador o el teléfono para buscar uno.</p>`;
      }
      body.innerHTML = h;
      drawPortrait(body.querySelector('#np'), s, 56);
      const sk = body.querySelector('#nskip'); if (sk) sk.onclick = () => { Sim.skipToday(st, s); this.toast(`${s.name} se queda hoy en casa (bajará su rendimiento)`, 'warn'); this.sig = ''; };
      const q = body.querySelector('#nquit'); if (q) q.onclick = () => this.confirm(`¿Seguro que ${s.name} deja su trabajo?`, () => { Sim.setJob(st, s, null); this.sig = ''; });
    }
    const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
    for (const n of list) { const i = body.querySelector(`i[data-n="${n}"]`); if (i) { i.style.width = s.needs[n] + '%'; i.style.background = needColor(s.needs[n]); } }
    const mb = body.querySelector('#nmoodbar'); if (mb) { mb.style.width = s.mood + '%'; mb.style.background = moodColor(s.mood); }
    const mt = body.querySelector('#nmood'); if (mt) mt.textContent = moodFace(s.mood);
    const pf = body.querySelector('#nperf'); if (pf && s.job) { pf.style.width = s.job.perf + '%'; pf.style.background = moodColor(s.job.perf); }
    const gr = body.querySelector('#ngrade'); if (gr) gr.textContent = (s.school.grade / 10).toFixed(1);
    const pr = body.querySelector('#npreg'); if (pr && s.pregnant) { const left = Math.max(0, s.pregnant.due - st.time); pr.textContent = `${Math.floor(left / 1440)} d ${Math.floor((left % 1440) / 60)} h`; }
  }

  renderRels(force) {
    const s = this.active; const body = $('#sheet .sheet-body'); const st = this.state; if (!s) return;
    const others = Object.values(st.sims).filter((o) => o !== s && (o.home || s.rel[o.id]));
    others.sort((a, b) => (b.home - a.home) || (Sim.getRel(s, b).a + Sim.getRel(s, b).r) - (Sim.getRel(s, a).a + Sim.getRel(s, a).r));
    const sig = s.id + others.map((o) => o.id + o.location + Math.round(Sim.getRel(s, o).a / 5) + Math.round(Sim.getRel(s, o).r / 5) + Sim.relLabel(st, s, o)).join();
    if (!force && sig === this.sig) return;
    this.sig = sig;
    body.innerHTML = `<p class="small">Relaciones de <b>${esc(s.name)}</b>. Invita a vecinos desde el teléfono.</p>`;
    for (const o of others) {
      const r = Sim.getRel(s, o);
      const row = document.createElement('div'); row.className = 'relrow';
      const where = o.location === 'casa' ? (o.home ? '🏠 En casa' : '🏠 De visita') : o.location === 'trabajo' ? '💼 Trabajando' : o.location === 'escuela' ? '🎒 En el cole' : '🏘️ En su casa';
      row.innerHTML = `<canvas></canvas><div><div class="row"><b>${esc(o.name)}</b><span class="tag">${Sim.relLabel(st, s, o)}</span><span class="small">${where}</span></div>
        <div class="small">Amistad ${Math.round(r.a)}</div><div class="meter"><i style="width:${(r.a + 100) / 2}%;background:${r.a >= 0 ? '#2bb85b' : '#e04848'}"></i></div>
        ${Sim.isAdult(s) && Sim.isAdult(o) ? `<div class="small">Romance ${Math.round(r.r)}</div><div class="meter"><i style="width:${r.r}%;background:#e05a9a"></i></div>` : ''}</div>`;
      drawPortrait(row.querySelector('canvas'), o, 44);
      if (o.location === 'casa') row.onclick = () => this.g.centerOnSim(o.id);
      body.appendChild(row);
    }
  }

  renderBuild(cat = this.buildCat || CATEGORIES[0]) {
    this.buildCat = cat; const st = this.state; const body = $('#sheet .sheet-body');
    body.innerHTML = `<div class="tabs">${CATEGORIES.map((c) => `<button data-c="${c}" class="${c === cat ? 'on' : ''}">${c}</button>`).join('')}</div><div class="grid"></div><p class="small">Toca un objeto de la casa para moverlo o venderlo. El tiempo se detiene mientras construyes.</p>`;
    body.querySelector('.tabs').onclick = (e) => { const b = e.target.closest('button'); if (b) this.renderBuild(b.dataset.c); };
    const grid = body.querySelector('.grid');
    for (const [id, d] of Object.entries(OBJECTS)) {
      if (d.cat !== cat) continue;
      const b = document.createElement('button'); b.className = 'item'; b.disabled = st.money < d.price;
      b.innerHTML = `<b>${OBJ_ICON[id] || '📦'}</b>${d.name}<div class="p">${d.price} €</div>${d.decor ? `<div class="small">✨ +${d.decor}</div>` : ''}`;
      b.onclick = () => { this.hideSheetOnly(); this.g.startPlacing(id); };
      grid.appendChild(b);
    }
  }
  renderBuildBar() {
    const v = this.g.view; const bar = $('#buildbar');
    if (!v.build) { bar.hidden = true; return; }
    bar.hidden = false; bar.innerHTML = '';
    const add = (label, fn, cls = '') => { const b = document.createElement('button'); b.textContent = label; b.className = cls; b.onclick = fn; bar.appendChild(b); return b; };
    if (v.ghost) {
      const d = OBJECTS[v.ghost.type];
      bar.innerHTML = `<div class="info">${OBJ_ICON[v.ghost.type] || ''} ${d.name}${v.ghost.mode === 'new' ? ` · ${d.price} €` : ''} — toca el suelo para colocarlo</div>`;
      add('↻ Girar', () => this.g.rotateGhost());
      add('✔ Colocar', () => this.g.confirmGhost(), 'primary');
      add('✖ Cancelar', () => this.g.cancelGhost());
    } else if (v.selected) {
      const o = Sim.objById(this.state, v.selected); if (!o) { v.selected = null; return this.renderBuildBar(); }
      const d = OBJECTS[o.type];
      bar.innerHTML = `<div class="info">${OBJ_ICON[o.type] || ''} ${d.name}</div>`;
      add('✋ Mover', () => this.g.moveSelected());
      if (!d.fixed) add(`💰 Vender (+${Math.round(d.price * 0.7)} €)`, () => this.g.sellSelected(), 'red');
      add('✖', () => { v.selected = null; this.renderBuildBar(); });
    } else {
      add('📦 Catálogo', () => this.openPanel('build'));
      add('✔ Terminar', () => { this.closePanel(); this.g.exitBuild(); }, 'primary');
    }
  }

  renderMenu() {
    const st = this.state; const body = $('#sheet .sheet-body');
    body.innerHTML = `
      <h3>Modo de juego</h3>
      <div class="field"><label>Autonomía de tu familia</label><div class="seg" id="aut">
        <button data-v="baja">🐣 Baja (tienes que estar pendiente)</button><button data-v="normal">🙂 Normal</button></div></div>
      <div class="field"><label>Envejecimiento</label><div class="seg" id="age"><button data-v="1">Activado</button><button data-v="0">Desactivado</button></div></div>
      <p class="small">Con la app cerrada el tiempo pasa más despacio (1 hora real ≈ 6 horas de juego, máx. 2 días) y las necesidades nunca bajan del todo.</p>
      <h3>Partida</h3>
      <div class="actions"><button class="btn alt" id="msave">💾 Guardar</button><button class="btn red" id="mnew">🗑️ Nueva partida</button></div>
      <h3>Cómo se juega</h3>
      <p class="small">Toca a un miembro de tu familia (abajo) para controlarlo. Toca objetos, personas o el suelo para darle órdenes. Vigila sus necesidades, sus preocupaciones y a los bebés: dependen de ti. Ve a trabajar para ganar dinero, paga las facturas en el buzón, invita a vecinos por teléfono, haz amigos, enamórate y forma una familia de hasta 4 miembros.</p>`;
    const seg = (id, val, fn) => { const el = body.querySelector(id); el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === val)); el.onclick = (e) => { const b = e.target.closest('button'); if (b) { fn(b.dataset.v); this.renderMenu(); } }; };
    seg('#aut', st.settings.autonomy, (v) => (st.settings.autonomy = v));
    seg('#age', st.settings.aging ? '1' : '0', (v) => (st.settings.aging = v === '1'));
    body.querySelector('#msave').onclick = () => { this.g.save(); this.toast('Partida guardada', 'good'); };
    body.querySelector('#mnew').onclick = () => this.confirm('Se borrará la partida actual. ¿Empezar de nuevo?', () => this.g.newGame());
  }

  // ---------- modales ----------
  modal(html) { const m = $('#modal'); m.hidden = false; const box = m.querySelector('.modal-box'); box.innerHTML = html; box.scrollTop = 0; return box; }
  closeModal() { $('#modal').hidden = true; }
  confirm(text, yes) {
    const box = this.modal(`<h2>¿Seguro?</h2><p>${esc(text)}</p><div class="actions"><button class="btn alt" id="cno">Cancelar</button><button class="btn" id="cyes">Sí</button></div>`);
    box.querySelector('#cno').onclick = () => this.closeModal();
    box.querySelector('#cyes').onclick = () => { this.closeModal(); yes(); };
  }
  info(title, html, btn = 'Vale', cb) {
    const box = this.modal(`<h2>${title}</h2>${html}<div class="actions"><button class="btn" id="iok">${btn}</button></div>`);
    box.querySelector('#iok').onclick = () => { this.closeModal(); cb && cb(); };
  }

  showOffline(sum) {
    const st = this.state;
    const hrs = Math.round(sum.mins / 60);
    const low = [];
    for (const s of Sim.householdSims(st)) {
      const list = s.age === 'bebe' ? BABY_NEEDS : NEEDS;
      const bad = list.filter((n) => s.needs[n] < 35);
      if (bad.length) low.push(`${s.name}: ${bad.map((n) => NEED_INFO[n].icon).join(' ')}`);
    }
    let html = `<p>Han pasado <b>${hrs} h</b> de juego mientras no estabas.</p>`;
    if (sum.money) html += `<p>💰 Dinero: <b>${sum.money > 0 ? '+' : ''}${sum.money} €</b></p>`;
    if (sum.log.length) html += `<ul>${sum.log.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`;
    if (low.length) html += `<p><b>Te necesitan:</b><br>${low.map(esc).join('<br>')}</p>`;
    this.info('¡Has vuelto! 👋', html, 'A jugar');
  }

  chooseJob(simId) {
    const st = this.state; const s = st.sims[simId];
    let html = `<p class="small">Elige trabajo para ${esc(s.name)}. Se trabaja de lunes a viernes.</p><div class="list">`;
    for (const [id, c] of Object.entries(CAREERS)) {
      html += `<button class="li ${s.job?.id === id ? 'on' : ''}" data-id="${id}"><b>${c.icon}</b><div><b style="font-size:15px">${c.label}</b> — ${c.levels[0]}<div class="small">${c.start}:00–${c.end}:00 · ${c.pay[0]} €/día al empezar · hasta ${c.pay[4]} €</div></div></button>`;
    }
    html += `</div><div class="actions"><button class="btn alt" id="jc">Cancelar</button></div>`;
    const box = this.modal(`<h2>💼 Ofertas de trabajo</h2>${html}`);
    box.querySelector('#jc').onclick = () => this.closeModal();
    box.querySelectorAll('.li').forEach((b) => (b.onclick = () => { this.closeModal(); if (s.job?.id !== b.dataset.id) Sim.setJob(st, s, b.dataset.id); }));
  }
  chooseInvite() {
    const st = this.state; const me = this.active;
    const ns = Sim.neighbors(st).filter((n) => n.location !== 'casa');
    let html = `<div class="list">` + (ns.length ? '' : '<p class="small">Todos los vecinos están ya en casa.</p>');
    for (const n of ns) html += `<button class="li" data-id="${n.id}"><canvas style="width:40px;height:40px;border-radius:50%"></canvas><div><b>${esc(n.name)}</b><div class="small">${Sim.relLabel(st, me, n)} · Amistad ${Math.round(Sim.getRel(me, n).a)}</div></div></button>`;
    html += `</div><div class="actions"><button class="btn alt" id="ic">Cancelar</button></div>`;
    const box = this.modal(`<h2>📞 ¿A quién llamas?</h2>${html}`);
    box.querySelectorAll('.li').forEach((b) => { drawPortrait(b.querySelector('canvas'), st.sims[b.dataset.id], 40); b.onclick = () => { this.closeModal(); Sim.inviteNeighbor(st, b.dataset.id); }; });
    box.querySelector('#ic').onclick = () => this.closeModal();
  }
  confirmAdopt() { this.confirm('Adoptar un bebé cuesta 1000 €. ¿Seguro?', () => Sim.adoptBaby(this.state)); }
  nameBaby(babyId, adopted) {
    const st = this.state; const b = st.sims[babyId]; if (!b) return;
    const prevSpeed = st.speed; this.g.setSpeed(0);
    const box = this.modal(`<h2>👶 ${adopted ? '¡Habéis adoptado un bebé!' : '¡Ha nacido un bebé!'}</h2><div class="preview"><canvas></canvas></div><p style="text-align:center">Es ${b.gender === 'f' ? 'una niña' : 'un niño'}. ¿Cómo se llamará?</p>
      <div class="field"><input type="text" id="bn" maxlength="14" value="${esc(b.name)}"></div><p class="small">Recuerda: necesita una cuna y que le des biberón, cambies el pañal y lo acunes.</p><div class="actions"><button class="btn" id="bok">Listo</button></div>`);
    drawPortrait(box.querySelector('canvas'), b, 96);
    box.querySelector('#bok').onclick = () => { const v = box.querySelector('#bn').value.trim(); if (v) b.name = v; this.closeModal(); this.g.setSpeed(prevSpeed || 1); this.renderFamily(); };
  }

  // ---------- creador de familia ----------
  createFamily(onDone) {
    const defs = [this.newMember('f')];
    let sel = 0; let surname = 'García'; let married = true;
    const render = () => {
      const d = defs[sel];
      const adults = defs.filter((x) => x.age !== 'nino');
      const box = this.modal(`
        <h2>🏡 Crea tu familia</h2>
        <div class="field"><label>Apellido de la familia</label><input type="text" id="fs" maxlength="16" value="${esc(surname)}"></div>
        <div class="members">${defs.map((x, i) => `<button class="m ${i === sel ? 'on' : ''}" data-i="${i}"><canvas></canvas></button>`).join('')}${defs.length < 4 ? '<button class="add" id="fadd">＋</button>' : ''}</div>
        <div class="preview"><canvas id="fp"></canvas></div>
        <div class="field"><label>Nombre</label><input type="text" id="fn" maxlength="14" value="${esc(d.name)}"></div>
        <div class="field"><label>Sexo</label><div class="seg" id="fg"><button data-v="f">♀ Mujer</button><button data-v="m">♂ Hombre</button></div></div>
        <div class="field"><label>Edad</label><div class="seg" id="fa"><button data-v="adulto">Adulto/a</button><button data-v="nino">Niño/a</button><button data-v="anciano">Anciano/a</button></div></div>
        <div class="field"><label>Piel</label><div class="sw" id="fskin">${SKINS.map((c) => `<button data-v="${c}" style="background:${c}"></button>`).join('')}</div></div>
        <div class="field"><label>Peinado</label><div class="seg" id="fh">${HAIR_STYLES.map((n, i) => `<button data-v="${i}">${n}</button>`).join('')}</div></div>
        <div class="field"><label>Color de pelo</label><div class="sw" id="fhc">${HAIR_COLORS.map((c) => `<button data-v="${c}" style="background:${c}"></button>`).join('')}</div></div>
        <div class="field"><label>Camiseta</label><div class="sw" id="fsh">${CLOTHES.map((c) => `<button data-v="${c}" style="background:${c}"></button>`).join('')}</div></div>
        <div class="field"><label>Pantalón</label><div class="sw" id="fpa">${CLOTHES.map((c) => `<button data-v="${c}" style="background:${c}"></button>`).join('')}</div></div>
        <div class="field"><label>Rasgos (elige 2)</label><div class="seg" id="ft">${Object.entries(TRAITS).map(([k, t]) => `<button data-v="${k}">${t.label}</button>`).join('')}</div><div class="small" id="ftd"></div></div>
        ${adults.length >= 2 ? `<div class="field"><label>Los dos primeros adultos</label><div class="seg" id="fm"><button data-v="1">💍 Casados</button><button data-v="0">Solo compañeros de piso</button></div></div>` : ''}
        <div class="actions">${defs.length > 1 ? '<button class="btn alt" id="fdel">Quitar</button>' : ''}<button class="btn" id="fok">Empezar a jugar</button></div>`);
      box.querySelectorAll('.members .m').forEach((b) => { drawPortrait(b.querySelector('canvas'), { look: defs[b.dataset.i].look, age: defs[b.dataset.i].age }, 56); b.onclick = () => { sel = +b.dataset.i; render(); }; });
      drawPortrait(box.querySelector('#fp'), { look: d.look, age: d.age }, 96);
      const keep = () => { surname = box.querySelector('#fs').value.trim() || surname; d.name = box.querySelector('#fn').value.trim() || d.name; };
      box.querySelector('#fs').oninput = () => keep();
      box.querySelector('#fn').oninput = () => keep();
      const seg = (id, val, fn) => {
        const el = box.querySelector(id); if (!el) return;
        el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Array.isArray(val) ? val.includes(b.dataset.v) : String(val) === b.dataset.v));
        el.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; keep(); fn(b.dataset.v); const top = box.scrollTop; render(); $('#modal .modal-box').scrollTop = top; };
      };
      seg('#fg', d.gender, (v) => (d.gender = v));
      seg('#fa', d.age, (v) => (d.age = v));
      seg('#fskin', d.look.skin, (v) => (d.look.skin = v));
      seg('#fh', d.look.hair, (v) => (d.look.hair = +v));
      seg('#fhc', d.look.hairColor, (v) => (d.look.hairColor = v));
      seg('#fsh', d.look.shirt, (v) => (d.look.shirt = v));
      seg('#fpa', d.look.pants, (v) => (d.look.pants = v));
      seg('#ft', d.traits, (v) => { if (d.traits.includes(v)) d.traits = d.traits.filter((t) => t !== v); else { d.traits.push(v); if (d.traits.length > 2) d.traits.shift(); } });
      seg('#fm', married ? '1' : '0', (v) => (married = v === '1'));
      box.querySelector('#ftd').textContent = d.traits.map((t) => `${TRAITS[t].label}: ${TRAITS[t].desc}`).join(' · ');
      const add = box.querySelector('#fadd'); if (add) add.onclick = () => { keep(); defs.push(this.newMember(Math.random() < 0.5 ? 'f' : 'm')); sel = defs.length - 1; render(); };
      const del = box.querySelector('#fdel'); if (del) del.onclick = () => { defs.splice(sel, 1); sel = 0; render(); };
      box.querySelector('#fok').onclick = () => {
        keep();
        if (!defs.some((x) => x.age !== 'nino')) return this.toast('La familia necesita al menos un adulto', 'warn');
        const ad = defs.map((x, i) => [x, i]).filter(([x]) => x.age !== 'nino');
        if (married && ad.length >= 2) { ad[0][0].partnerIdx = ad[1][1]; ad[1][0].partnerIdx = ad[0][1]; }
        this.closeModal(); onDone(defs, surname);
      };
    };
    render();
  }
  newMember(g) {
    const look = Sim.randomLook(g);
    return { name: Sim.randomName(g), gender: g, age: 'adulto', look, traits: [] };
  }
}

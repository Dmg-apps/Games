// Datos estáticos del juego: necesidades, rasgos, objetos, acciones, interacciones, trabajos.

export const NEEDS = ['hambre', 'energia', 'higiene', 'diversion', 'social', 'vejiga'];
export const BABY_NEEDS = ['hambre', 'energia', 'higiene', 'social'];

export const NEED_INFO = {
  hambre: { label: 'Hambre', icon: '🍔' },
  energia: { label: 'Energía', icon: '😴' },
  higiene: { label: 'Higiene', icon: '🚿' },
  diversion: { label: 'Diversión', icon: '🎮' },
  social: { label: 'Social', icon: '💬' },
  vejiga: { label: 'Vejiga', icon: '🚽' },
};

// Pérdida por hora de juego
export const DECAY = { hambre: 5, energia: 4, higiene: 3, diversion: 5, social: 3.5, vejiga: 7 };
export const BABY_DECAY = { hambre: 8, energia: 4, higiene: 6, social: 6 };

export const TRAITS = {
  gloton: { label: 'De buen comer', desc: 'Le entra hambre más a menudo', decay: { hambre: 1.4 } },
  perezoso: { label: 'Perezoso/a', desc: 'Se cansa antes y rinde menos', decay: { energia: 1.3 }, work: 0.8 },
  pulcro: { label: 'Pulcro/a', desc: 'Necesita ducharse más', decay: { higiene: 1.4 } },
  sociable: { label: 'Sociable', desc: 'Necesita gente, cae bien', decay: { social: 1.4 }, social: 1.25 },
  solitario: { label: 'Solitario/a', desc: 'Apenas necesita compañía', decay: { social: 0.6 }, social: 0.85 },
  jugueton: { label: 'Bromista', desc: 'Se aburre rápido, gran humor', decay: { diversion: 1.4 }, joke: 1.3 },
  romantico: { label: 'Romántico/a', desc: 'Liga con facilidad', romance: 1.5 },
  ambicioso: { label: 'Ambicioso/a', desc: 'Rinde más en el trabajo', work: 1.3 },
  alegre: { label: 'Alegre', desc: 'Siempre de buen humor', mood: 10 },
  grunon: { label: 'Cascarrabias', desc: 'Mal humor y peor trato', mood: -6, social: 0.85 },
};

export const AGES = {
  bebe: { label: 'Bebé', days: 3, scale: 0.45 },
  nino: { label: 'Niño/a', days: 8, scale: 0.72 },
  adulto: { label: 'Adulto/a', days: 28, scale: 1 },
  anciano: { label: 'Anciano/a', days: Infinity, scale: 0.95 },
};
export const AGE_ORDER = ['bebe', 'nino', 'adulto', 'anciano'];

export const SKINS = ['#f6d7c3', '#eac1a0', '#d29b74', '#a8704a', '#7a4b2c', '#4e2e1a'];
export const HAIR_COLORS = ['#1d1a18', '#4a2f1d', '#8a5a2b', '#d9b26a', '#b5462a', '#9a9a9a', '#5b3fa8', '#2d7a6e'];
export const CLOTHES = ['#e05a5a', '#e8964a', '#e8cf4a', '#5ab06a', '#4a9ae0', '#6a5ae0', '#c45ab0', '#f2f2f2', '#3a3a44', '#7a5a3a'];
export const HAIR_STYLES = ['Corto', 'Largo', 'Moño', 'Rapado'];
export const EYE_STYLES = { redondos: 'Redondos', grandes: 'Grandes', almendrados: 'Almendrados', pestanas: 'Con pestañas' };
export const EYE_COLORS = ['#4a2e1c', '#7a5230', '#2f6fb0', '#3a8a5a', '#7d8794', '#1d1a18', '#6b8f3a', '#8a5ab0'];

export const NAMES_F = ['Lucía', 'Marta', 'Sofía', 'Carmen', 'Elena', 'Paula', 'Julia', 'Alba', 'Noa', 'Irene', 'Sara', 'Vera', 'Inés', 'Lola', 'Aitana'];
export const NAMES_M = ['Hugo', 'Mateo', 'Pablo', 'Daniel', 'Álvaro', 'Leo', 'Marcos', 'Javier', 'Bruno', 'Iker', 'Adrián', 'Diego', 'Nico', 'Tomás', 'Unai'];

// Cajas para dibujar en isométrico: [x, y, ancho, fondo, z(px), alto(px), color]
// Coordenadas relativas a la huella del objeto (en casillas) con rotación 0.
export const OBJECTS = {
  nevera: { name: 'Nevera', price: 450, cat: 'Cocina', w: 1, h: 1, decor: 0, acts: ['picar'],
    boxes: [[0.15, 0.15, 0.7, 0.7, 0, 78, '#e9eef2'], [0.83, 0.2, 0.04, 0.12, 40, 22, '#9aa4ad']] },
  cocina: { name: 'Fogones', price: 400, cat: 'Cocina', w: 1, h: 1, decor: 0, acts: ['cocinar'], power: true,
    boxes: [[0.1, 0.1, 0.8, 0.8, 0, 36, '#d9d4cc'], [0.2, 0.2, 0.25, 0.25, 36, 2, '#333'], [0.55, 0.55, 0.25, 0.25, 36, 2, '#333']] },
  mesa: { name: 'Mesa de comedor', price: 220, cat: 'Cocina', w: 2, h: 1, decor: 2, acts: [],
    boxes: [[0.1, 0.15, 1.8, 0.7, 26, 5, '#a8784a'], [0.15, 0.2, 0.1, 0.1, 0, 26, '#7a5432'], [1.75, 0.7, 0.1, 0.1, 0, 26, '#7a5432']] },
  cama: { name: 'Cama doble', price: 650, cat: 'Dormitorio', w: 2, h: 1, decor: 1, cap: 2, onObj: true, acts: ['dormir'],
    boxes: [[0.05, 0.05, 1.9, 0.9, 0, 18, '#7a5a3a'], [0.1, 0.1, 1.5, 0.8, 18, 6, '#6a8fd0'], [1.55, 0.1, 0.35, 0.8, 18, 9, '#f4f4f4'], [1.9, 0.05, 0.08, 0.9, 0, 40, '#6a4a2a']] },
  camita: { name: 'Cama individual', price: 350, cat: 'Dormitorio', w: 2, h: 1, decor: 0, cap: 1, onObj: true, acts: ['dormir'],
    boxes: [[0.05, 0.2, 1.9, 0.6, 0, 16, '#9a7a5a'], [0.1, 0.25, 1.5, 0.5, 16, 6, '#e07a7a'], [1.55, 0.25, 0.35, 0.5, 16, 8, '#f4f4f4']] },
  cuna: { name: 'Cuna', price: 300, cat: 'Dormitorio', w: 1, h: 1, decor: 1, acts: [], crib: true,
    boxes: [[0.15, 0.15, 0.7, 0.7, 0, 10, '#f2e6d0'], [0.15, 0.15, 0.7, 0.05, 10, 22, '#e8d5b0'], [0.15, 0.8, 0.7, 0.05, 10, 22, '#e8d5b0'], [0.15, 0.15, 0.05, 0.7, 10, 22, '#e8d5b0'], [0.8, 0.15, 0.05, 0.7, 10, 22, '#e8d5b0']] },
  vater: { name: 'Váter', price: 250, cat: 'Baño', w: 1, h: 1, decor: 0, onObj: true, acts: ['vater'],
    boxes: [[0.3, 0.25, 0.4, 0.5, 0, 22, '#f4f6f8'], [0.15, 0.3, 0.15, 0.4, 0, 44, '#e6eaee']] },
  ducha: { name: 'Ducha', price: 500, cat: 'Baño', w: 1, h: 1, decor: 0, onObj: true, acts: ['ducha'],
    boxes: [[0.05, 0.05, 0.9, 0.9, 0, 4, '#cfe3ee'], [0.05, 0.05, 0.9, 0.04, 4, 80, 'rgba(170,210,235,0.55)'], [0.05, 0.05, 0.04, 0.9, 4, 80, 'rgba(170,210,235,0.55)']] },
  sofa: { name: 'Sofá', price: 450, cat: 'Salón', w: 2, h: 1, decor: 2, cap: 2, onObj: true, acts: ['relajarse', 'siesta'],
    boxes: [[0.05, 0.2, 1.9, 0.7, 0, 16, '#5a7ab0'], [0.05, 0.1, 1.9, 0.2, 0, 34, '#4a6aa0'], [0.05, 0.1, 0.15, 0.8, 0, 24, '#4a6aa0'], [1.8, 0.1, 0.15, 0.8, 0, 24, '#4a6aa0']] },
  tele: { name: 'Televisor', price: 350, cat: 'Salón', w: 1, h: 1, decor: 0, acts: ['tele'], power: true,
    boxes: [[0.1, 0.25, 0.8, 0.5, 0, 24, '#6a4a32'], [0.15, 0.4, 0.7, 0.08, 24, 34, '#1a1a22']] },
  equipo: { name: 'Equipo de música', price: 300, cat: 'Salón', w: 1, h: 1, decor: 1, acts: ['bailar'], power: true,
    boxes: [[0.25, 0.3, 0.5, 0.4, 0, 30, '#2a2a30'], [0.3, 0.68, 0.15, 0.03, 8, 14, '#666'], [0.55, 0.68, 0.15, 0.03, 8, 14, '#666']] },
  estanteria: { name: 'Estantería', price: 250, cat: 'Salón', w: 1, h: 1, decor: 2, acts: ['leer'],
    boxes: [[0.1, 0.1, 0.8, 0.35, 0, 70, '#8a6a4a'], [0.15, 0.4, 0.2, 0.05, 20, 14, '#c05050'], [0.4, 0.4, 0.2, 0.05, 20, 14, '#5080c0'], [0.6, 0.4, 0.2, 0.05, 44, 14, '#50a060']] },
  ordenador: { name: 'Escritorio con ordenador', price: 800, cat: 'Salón', w: 1, h: 1, decor: 0, acts: ['jugarpc', 'buscartrabajo', 'deberes'], power: true,
    boxes: [[0.1, 0.1, 0.8, 0.8, 26, 4, '#b08a5a'], [0.12, 0.12, 0.08, 0.08, 0, 26, '#8a6a42'], [0.8, 0.8, 0.08, 0.08, 0, 26, '#8a6a42'], [0.25, 0.25, 0.45, 0.1, 30, 22, '#1e1e26']] },
  juguetes: { name: 'Caja de juguetes', price: 150, cat: 'Salón', w: 1, h: 1, decor: 1, acts: ['juguetes'],
    boxes: [[0.2, 0.2, 0.6, 0.6, 0, 20, '#e8c04a'], [0.3, 0.3, 0.2, 0.2, 20, 10, '#e05050'], [0.55, 0.45, 0.15, 0.15, 20, 8, '#4a9ae0']] },
  telefono: { name: 'Teléfono', price: 100, cat: 'Salón', w: 1, h: 1, decor: 0, acts: ['invitar', 'pizza', 'buscartrabajo', 'adoptar'],
    boxes: [[0.3, 0.3, 0.4, 0.4, 0, 30, '#7a5a3a'], [0.35, 0.35, 0.3, 0.3, 30, 6, '#d04040']] },
  planta: { name: 'Planta', price: 80, cat: 'Decoración', w: 1, h: 1, decor: 3, acts: ['regar'],
    boxes: [[0.35, 0.35, 0.3, 0.3, 0, 16, '#b0603a'], [0.25, 0.25, 0.5, 0.5, 16, 28, '#4a9a4a'], [0.35, 0.35, 0.3, 0.3, 44, 12, '#5ab05a']] },
  lampara: { name: 'Lámpara de pie', price: 120, cat: 'Decoración', w: 1, h: 1, decor: 2, acts: [],
    boxes: [[0.4, 0.4, 0.2, 0.2, 0, 4, '#444'], [0.47, 0.47, 0.06, 0.06, 4, 50, '#666'], [0.3, 0.3, 0.4, 0.4, 54, 18, '#f4e2a0']] },
  cuadro: { name: 'Alfombra', price: 140, cat: 'Decoración', w: 2, h: 1, decor: 3, acts: [], walkable: true,
    boxes: [[0.05, 0.1, 1.9, 0.8, 0, 1, '#b05a5a'], [0.2, 0.25, 1.6, 0.5, 1, 1, '#d08a6a']] },
  arbol: { name: 'Árbol', price: 200, cat: 'Decoración', w: 1, h: 1, decor: 4, acts: [],
    boxes: [[0.42, 0.42, 0.16, 0.16, 0, 34, '#7a5232'], [0.15, 0.15, 0.7, 0.7, 30, 40, '#3e8a3e'], [0.25, 0.25, 0.5, 0.5, 70, 20, '#4ea04e']] },
  buzon: { name: 'Buzón', price: 0, cat: null, w: 1, h: 1, decor: 0, acts: ['pagar'], fixed: true,
    boxes: [[0.45, 0.45, 0.1, 0.1, 0, 30, '#555'], [0.3, 0.35, 0.4, 0.3, 30, 18, '#3a6ac0']] },
};

export const CATEGORIES = ['Cocina', 'Dormitorio', 'Baño', 'Salón', 'Decoración'];

// Acciones sobre objetos. rate = cambio por minuto de juego.
export const ACTIONS = {
  picar: { label: 'Picar algo', icon: '🥪', dur: 15, rate: { hambre: 2.4 }, ages: ['nino', 'adulto', 'anciano'], cost: 5 },
  cocinar: { label: 'Cocinar y comer', icon: '🍳', dur: 50, rate: { hambre: 2.6, diversion: 0.15 }, ages: ['adulto', 'anciano'], cost: 12, moodlet: 'comida_rica' },
  dormir: { label: 'Dormir', icon: '💤', until: 'energia', dur: 600, minDur: 60, rate: { energia: 0.28 }, ages: ['nino', 'adulto', 'anciano'], sleep: true },
  relajarse: { label: 'Relajarse', icon: '🛋️', dur: 45, rate: { diversion: 0.5, energia: 0.05 }, ages: ['nino', 'adulto', 'anciano'] },
  siesta: { label: 'Echar una siesta', icon: '😪', dur: 90, rate: { energia: 0.2 }, ages: ['nino', 'adulto', 'anciano'], sleep: true },
  vater: { label: 'Usar el váter', icon: '🚽', dur: 8, rate: { vejiga: 13 }, ages: ['nino', 'adulto', 'anciano'] },
  ducha: { label: 'Ducharse', icon: '🚿', dur: 20, rate: { higiene: 5.5 }, ages: ['nino', 'adulto', 'anciano'], moodlet: 'fresco' },
  tele: { label: 'Ver la tele', icon: '📺', until: 'diversion', dur: 150, minDur: 20, rate: { diversion: 1.2 }, ages: ['nino', 'adulto', 'anciano'] },
  bailar: { label: 'Bailar', icon: '💃', dur: 40, rate: { diversion: 1.4, energia: -0.1 }, ages: ['nino', 'adulto', 'anciano'] },
  leer: { label: 'Leer un libro', icon: '📖', dur: 60, rate: { diversion: 0.9 }, ages: ['nino', 'adulto', 'anciano'] },
  jugarpc: { label: 'Jugar a videojuegos', icon: '🎮', until: 'diversion', dur: 150, minDur: 20, rate: { diversion: 1.5 }, ages: ['nino', 'adulto', 'anciano'] },
  buscartrabajo: { label: 'Buscar trabajo', icon: '💼', dur: 10, ages: ['adulto', 'anciano'], ui: 'job' },
  deberes: { label: 'Hacer los deberes', icon: '📝', dur: 60, rate: { diversion: -0.2 }, ages: ['nino'], resolves: 'deberes' },
  juguetes: { label: 'Jugar con juguetes', icon: '🧸', dur: 45, rate: { diversion: 2 }, ages: ['nino'] },
  invitar: { label: 'Invitar a alguien', icon: '📞', dur: 5, ages: ['adulto', 'anciano'], ui: 'invite' },
  pizza: { label: 'Pedir pizza (40 €)', icon: '🍕', dur: 40, rate: { hambre: 2.2 }, ages: ['adulto', 'anciano'], cost: 40, moodlet: 'comida_rica' },
  adoptar: { label: 'Adoptar un bebé (1000 €)', icon: '👶', dur: 10, ages: ['adulto', 'anciano'], ui: 'adopt' },
  regar: { label: 'Regar', icon: '💧', dur: 5, ages: ['nino', 'adulto', 'anciano'] },
  medico: { label: 'Llamar al médico (60 €)', icon: '🩺', dur: 20, ages: ['adulto', 'anciano'], cost: 60, resolves: 'resfriado' },
  pagar: { label: 'Pagar facturas', icon: '🧾', dur: 5, ages: ['adulto', 'anciano'], pay: true },
};

// Interacciones sociales
// req(actor, target, rel, ctx) -> true | string (motivo de bloqueo) | false (oculta)
export const SOCIALS = {
  charlar: { label: 'Charlar', icon: '💬', dur: 20, a: 5, social: 30, chance: 0.92 },
  chiste: { label: 'Contar un chiste', icon: '😂', dur: 12, a: 7, social: 15, fun: 15, chance: 0.75, joke: true },
  halagar: { label: 'Hacer un cumplido', icon: '🌟', dur: 8, a: 6, social: 12, chance: 0.82 },
  abrazar: { label: 'Abrazar', icon: '🤗', dur: 6, a: 8, social: 15, chance: 0.85, minA: 30 },
  desahogarse: { label: 'Desahogarse', icon: '😮‍💨', dur: 25, a: 4, social: 25, chance: 0.9, minA: 15, resolves: 'estres' },
  discutir: { label: 'Discutir', icon: '💢', dur: 15, a: -15, social: 5, chance: 1, bad: true },
  coquetear: { label: 'Coquetear', icon: '😘', dur: 10, a: 3, r: 9, social: 15, chance: 0.7, romantic: true, minA: 10 },
  besar: { label: 'Besar', icon: '💋', dur: 6, a: 3, r: 12, social: 20, chance: 0.8, romantic: true, minR: 35, moodlet: 'beso' },
  pedirsalir: { label: 'Pedir salir', icon: '💌', dur: 10, r: 10, social: 10, chance: 0.85, romantic: true, minR: 50, special: 'pareja' },
  casarse: { label: 'Pedir matrimonio', icon: '💍', dur: 15, r: 10, social: 20, chance: 0.85, romantic: true, minR: 80, special: 'boda' },
  romper: { label: 'Romper la relación', icon: '💔', dur: 10, a: -30, r: -60, chance: 1, special: 'romper', bad: true },
  intimidad: { label: 'Momento íntimo', icon: '💕', dur: 60, a: 4, r: 8, social: 40, fun: 40, chance: 0.95, romantic: true, minR: 60, bed: true, moodlet: 'intimidad' },
  bebe: { label: 'Intentar tener un bebé', icon: '🍼', dur: 60, a: 4, r: 8, social: 40, fun: 30, chance: 0.95, romantic: true, minR: 60, bed: true, moodlet: 'intimidad', special: 'embarazo' },
  mudarse: { label: 'Proponer vivir juntos', icon: '🏠', dur: 10, a: 5, chance: 0.9, special: 'mudarse' },
  consolar: { label: 'Consolar', icon: '🫂', dur: 15, a: 8, social: 25, chance: 1, resolves: 'miedo' },
  jugarnino: { label: 'Jugar juntos', icon: '🪀', dur: 30, a: 7, social: 20, fun: 35, chance: 0.95 },
  despedir: { label: 'Despedirse', icon: '👋', dur: 3, chance: 1, special: 'despedir' },
  // Cuidado del bebé
  biberon: { label: 'Dar el biberón', icon: '🍼', dur: 15, baby: { hambre: 70 }, chance: 1, care: true },
  panal: { label: 'Cambiar el pañal', icon: '🧷', dur: 10, baby: { higiene: 80 }, chance: 1, care: true },
  acunar: { label: 'Acunar y mimar', icon: '🥰', dur: 15, baby: { social: 60, energia: 10 }, a: 6, chance: 1, care: true },
};

export const CAREERS = {
  oficina: { label: 'Oficina', icon: '🗂️', start: 9, end: 17, levels: ['Becario/a', 'Administrativo/a', 'Jefe/a de equipo', 'Gerente', 'Director/a'], pay: [110, 180, 290, 430, 650] },
  cocina: { label: 'Restauración', icon: '👨‍🍳', start: 15, end: 23, levels: ['Friegaplatos', 'Pinche', 'Cocinero/a', 'Jefe/a de cocina', 'Chef estrella'], pay: [90, 150, 250, 380, 600] },
  medicina: { label: 'Medicina', icon: '🩺', start: 7, end: 15, levels: ['Celador/a', 'Enfermero/a', 'Médico/a residente', 'Médico/a', 'Cirujano/a jefe'], pay: [120, 200, 330, 500, 760] },
  arte: { label: 'Arte', icon: '🎨', start: 11, end: 17, levels: ['Aprendiz', 'Ilustrador/a', 'Artista', 'Artista reconocido/a', 'Leyenda del arte'], pay: [70, 120, 210, 340, 560], fun: true },
};
export const SCHOOL = { start: 8, end: 14 };

export const MOODLETS = {
  comida_rica: { label: 'Comida rica', mood: 8, dur: 240 },
  fresco: { label: 'Recién duchado', mood: 6, dur: 180 },
  beso: { label: 'Un beso bonito', mood: 12, dur: 240 },
  intimidad: { label: 'Muy enamorado', mood: 22, dur: 480 },
  rechazo: { label: 'Rechazado/a', mood: -12, dur: 180 },
  discusion: { label: 'Ha discutido', mood: -10, dur: 240 },
  desmayo: { label: 'Se ha desmayado', mood: -20, dur: 360 },
  humillado: { label: 'Humillado/a', mood: -25, dur: 360 },
  suelo: { label: 'Ha dormido en el suelo', mood: -15, dur: 360 },
  boda: { label: '¡Recién casados!', mood: 30, dur: 1440 },
  pareja: { label: 'Tiene pareja nueva', mood: 15, dur: 720 },
  ruptura: { label: 'Corazón roto', mood: -30, dur: 1440 },
  nacimiento: { label: '¡Nuevo bebé!', mood: 25, dur: 1440 },
  ascenso: { label: '¡Ascendido/a!', mood: 20, dur: 720 },
  despedido: { label: 'Despedido/a', mood: -25, dur: 1440 },
  crecer: { label: 'Ha crecido', mood: 10, dur: 720 },
  embarazo: { label: 'Esperando un bebé', mood: 10, dur: 99999 },
};

export const WORRIES = {
  facturas: { label: 'Facturas sin pagar', hint: 'Paga en el buzón', mood: -12, ages: ['adulto', 'anciano'] },
  soledad: { label: 'Se siente solo/a', hint: 'Que charle con alguien hasta llenar Social', mood: -10, ages: ['nino', 'adulto', 'anciano'] },
  estres: { label: 'Estrés', hint: 'Que se desahogue con alguien de confianza', mood: -12, ages: ['adulto', 'anciano'] },
  quiere_hijo: { label: 'Quiere tener un hijo', hint: 'Bebé biológico o adoptado', mood: -6, ages: ['adulto'] },
  ascenso: { label: 'Quiere un ascenso', hint: 'Ve al trabajo de buen humor', mood: -6, ages: ['adulto', 'anciano'] },
  sin_trabajo: { label: 'Preocupado/a por el dinero', hint: 'Busca trabajo en el ordenador o el teléfono', mood: -8, ages: ['adulto'] },
  casa_fea: { label: 'La casa le parece fea', hint: 'Compra decoración', mood: -8, ages: ['adulto', 'anciano'] },
  miedo: { label: 'Tiene miedo', hint: 'Un adulto debe consolarle', mood: -14, ages: ['nino'] },
  deberes: { label: 'Deberes pendientes', hint: 'Hacer los deberes en el ordenador', mood: -6, ages: ['nino'] },
  aburrido: { label: 'Se aburre', hint: 'Llena la Diversión', mood: -8, ages: ['nino', 'adulto', 'anciano'] },
  resfriado: { label: 'Está resfriado/a', hint: 'Llama al médico con el teléfono o que duerma bien en una cama', mood: -12, ages: ['nino', 'adulto', 'anciano'] },
};

export const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

// ---------- Identidad y diversidad ----------
export const GENDERS = {
  f: { label: 'Mujer' },
  m: { label: 'Hombre' },
  x: { label: 'No binarie' },
};
export const NAMES_X = ['Alex', 'Ariel', 'Sasha', 'Noa', 'Andrea', 'Cris', 'Dani', 'Eli', 'Gael', 'Izan', 'Mar', 'Río', 'Sol', 'Uma', 'Zoe'];
export const BODY_STYLES = { recto: 'Recta', vestido: 'Con vestido' };

// Concordancia de género en los textos: "agotado/a" → agotado | agotada | agotade
export function inflect(text, s) {
  if (!s || !text) return text;
  const g = s.gender;
  return String(text)
    .replace(/([A-Za-zÁÉÍÓÚáéíóúñÑ]+)o\/a\b/g, (_, st) => st + (g === 'f' ? 'a' : g === 'x' ? 'e' : 'o'))
    .replace(/([A-Za-zÁÉÍÓÚáéíóúñÑ]+)\/a\b/g, (_, st) => {
      if (g === 'm') return st;
      if (st.endsWith('e')) return g === 'f' ? st.slice(0, -1) + 'a' : st;
      return st + (g === 'f' ? 'a' : 'e');
    });
}
export const gx = (s, m, f, x) => (s?.gender === 'f' ? f : s?.gender === 'x' ? x : m);

// Iconos (ver icons.js) para acciones e interacciones
export const ACTION_IC = { medico: 'heart', picar: 'food', cocinar: 'food', dormir: 'moon', relajarse: 'sofa', siesta: 'moon', vater: 'toilet', ducha: 'drop', tele: 'tv', bailar: 'music', leer: 'book', jugarpc: 'game', buscartrabajo: 'briefcase', deberes: 'pencil', juguetes: 'ball', invitar: 'phone', pizza: 'pizza', adoptar: 'baby', regar: 'leaf', pagar: 'receipt' };
export const SOCIAL_IC = { charlar: 'chat', chiste: 'smile', halagar: 'star', abrazar: 'users', desahogarse: 'cloud', discutir: 'zap', coquetear: 'sparkle', besar: 'heart', pedirsalir: 'heart', casarse: 'ring', romper: 'heartbreak', intimidad: 'hearts', bebe: 'baby', mudarse: 'home', consolar: 'users', jugarnino: 'ball', despedir: 'logout', biberon: 'bottle', panal: 'drop', acunar: 'heart' };
for (const [k, v] of Object.entries(ACTION_IC)) ACTIONS[k].ic = v;
for (const [k, v] of Object.entries(SOCIAL_IC)) SOCIALS[k].ic = v;
export const OBJ_IC = { nevera: 'fridge', cocina: 'food', mesa: 'table', cama: 'bed', camita: 'bed', cuna: 'baby', vater: 'toilet', ducha: 'drop', sofa: 'sofa', tele: 'tv', equipo: 'music', estanteria: 'book', ordenador: 'monitor', juguetes: 'ball', telefono: 'phone', planta: 'leaf', lampara: 'lamp', cuadro: 'rug', arbol: 'tree', buzon: 'receipt' };
export const NEED_IC = { hambre: 'food', energia: 'moon', higiene: 'drop', diversion: 'game', social: 'chat', vejiga: 'toilet' };
export const NEED_COLOR = { hambre: '#f08a3c', energia: '#6d6ae0', higiene: '#2fa8e0', diversion: '#e0559a', social: '#2fb37a', vejiga: '#d9a520' };

// ---------- Estilos de casa ----------
export const FLOOR_STYLES = [
  { id: 'roble', name: 'Roble', type: 'madera', a: '#d7a873', b: '#cf9d68' },
  { id: 'nogal', name: 'Nogal', type: 'madera', a: '#9a6844', b: '#8f5f3c' },
  { id: 'gris', name: 'Madera gris', type: 'madera', a: '#bdb5aa', b: '#b2aa9e' },
  { id: 'clara', name: 'Baldosa clara', type: 'baldosa', a: '#f1ede6', b: '#ddd6ca' },
  { id: 'barro', name: 'Barro', type: 'baldosa', a: '#cc7a52', b: '#bd6d45' },
  { id: 'ajedrez', name: 'Ajedrez', type: 'baldosa', a: '#eef1f4', b: '#4a5060' },
  { id: 'verde', name: 'Moqueta verde', type: 'moqueta', a: '#a9c6a1', b: '#a2bf9a' },
  { id: 'lila', name: 'Moqueta lila', type: 'moqueta', a: '#c8b3d8', b: '#c0abd0' },
  { id: 'azul', name: 'Moqueta azul', type: 'moqueta', a: '#a3bcd9', b: '#9bb4d1' },
];
export const WALL_COLORS = ['#f3e7d6', '#e7f0e8', '#e4edf7', '#f7e2df', '#f5eed6', '#ebe2f4', '#dce9e6', '#faf7f1', '#f0d9c4', '#d9e4ef'];
export const WALL_PATTERNS = { liso: 'Lisa', rayas: 'Rayas', topos: 'Topos', rombos: 'Rombos' };
export const TINTS = ['#5a7ab0', '#b0605a', '#5aa070', '#c9a04a', '#8a6ab0', '#4a8a90', '#d07a9a', '#6f6f78', '#e08a4a', '#3f5a8a'];
// Colores que se pueden personalizar en cada mueble (el primero es el principal)
OBJECTS.sofa.tint = ['#5a7ab0', '#4a6aa0'];
OBJECTS.cama.tint = ['#6a8fd0'];
OBJECTS.camita.tint = ['#e07a7a'];
OBJECTS.cuadro.tint = ['#b05a5a', '#d08a6a'];
OBJECTS.juguetes.tint = ['#e8c04a'];
CATEGORIES.push('Paredes', 'Estilo');

// ---------- Habilidades ----------
export const SKILLS = {
  cocina: { label: 'Cocina', ic: 'food' },
  carisma: { label: 'Carisma', ic: 'chat' },
  logica: { label: 'Lógica', ic: 'book' },
  forma: { label: 'Forma física', ic: 'zap' },
  creatividad: { label: 'Creatividad', ic: 'brush' },
};
// Qué habilidad mejora cada acción y a qué ritmo (por minuto de juego)
const SKILL_OF = { cocinar: ['cocina', 0.03], leer: ['logica', 0.025], deberes: ['logica', 0.02], jugarpc: ['logica', 0.008], bailar: ['forma', 0.03], juguetes: ['creatividad', 0.025] };
for (const [k, v] of Object.entries(SKILL_OF)) ACTIONS[k].skill = v;
CAREERS.oficina.skill = 'logica'; CAREERS.cocina.skill = 'cocina'; CAREERS.medicina.skill = 'logica'; CAREERS.arte.skill = 'creatividad';

// Pintar: mejora la creatividad y los cuadros se venden
OBJECTS.caballete = { name: 'Caballete', price: 350, cat: 'Salón', w: 1, h: 1, decor: 2, acts: ['pintar'],
  boxes: [[0.45, 0.62, 0.08, 0.08, 0, 62, '#8a6a42'], [0.2, 0.3, 0.07, 0.07, 0, 56, '#8a6a42'], [0.73, 0.3, 0.07, 0.07, 0, 56, '#8a6a42'],
    [0.14, 0.27, 0.72, 0.05, 26, 3, '#8a6a42'], [0.16, 0.24, 0.68, 0.04, 29, 34, '#f6f1e7'], [0.24, 0.23, 0.5, 0.02, 34, 22, '#e8a05a']] };
ACTIONS.pintar = { label: 'Pintar un cuadro', icon: '🎨', dur: 90, rate: { diversion: 0.6 }, ages: ['nino', 'adulto', 'anciano'], skill: ['creatividad', 0.025], sells: true, ic: 'brush' };
OBJ_IC.caballete = 'brush';

// ---------- Aspiraciones (objetivos de vida) ----------
export const ASPIRATIONS = {
  familia: { label: 'Gran familia', ic: 'home', steps: ['Tener pareja', 'Casarse', 'Tener un hijo o hija', 'Familia de 4'] },
  fortuna: { label: 'Fortuna', ic: 'coin', steps: ['Ahorrar 8.000 €', 'Ahorrar 20.000 €', 'Casa preciosa (decoración 30)', 'Ahorrar 50.000 €'] },
  social: { label: 'Alma social', ic: 'users', steps: ['3 amistades', 'Una mejor amistad', 'Carisma nivel 5', '6 amistades'] },
  carrera: { label: 'Cima profesional', ic: 'briefcase', steps: ['Conseguir trabajo', 'Llegar al nivel 3', 'Llegar a lo más alto', 'Habilidad de su trabajo a 8'] },
  artista: { label: 'Artista', ic: 'brush', steps: ['Creatividad nivel 3', 'Vender 5 cuadros', 'Creatividad nivel 7', 'Vender 25 cuadros'] },
};
export const REWARDS = {
  metabolismo: { label: 'Metabolismo rápido', desc: 'El hambre baja un 30% más despacio', cost: 300, decay: { hambre: 0.7 } },
  incansable: { label: 'Incansable', desc: 'La energía dura un 25% más', cost: 400, decay: { energia: 0.75 } },
  encanto: { label: 'Encanto natural', desc: 'Las interacciones salen mejor', cost: 350, social: 1.15 },
  aprendiz: { label: 'Aprende rápido', desc: 'Sube habilidades un 50% más rápido', cost: 450, learn: 1.5 },
  optimista: { label: 'Optimista', desc: '+8 de ánimo siempre', cost: 500, mood: 8 },
};
Object.assign(MOODLETS, {
  objetivo: { label: '¡Objetivo cumplido!', mood: 15, dur: 720 },
  gourmet: { label: 'Comida de chef', mood: 15, dur: 300 },
  quemada: { label: 'Se le quemó la comida', mood: -8, dur: 180 },
  buena_persona: { label: 'Ha hecho lo correcto', mood: 10, dur: 720 },
  culpa: { label: 'Se siente culpable', mood: -8, dur: 720 },
  frustrado: { label: 'Frustrado/a', mood: -10, dur: 360 },
  ternura: { label: 'Le ha dado ternura', mood: 12, dur: 360 },
  premio: { label: '¡Le ha tocado la lotería!', mood: 30, dur: 1440 },
  inspirado: { label: 'Inspirado/a', mood: 10, dur: 360 },
});

// ---------- Salidas fuera de casa ----------
export const OUTINGS = {
  parque: { label: 'Parque', ic: 'tree', dur: 120, cost: 0, rate: { diversion: 0.5, social: 0.3, energia: -0.1 }, skill: ['forma', 0.015], outdoor: true, moodlet: 'aire_libre' },
  restaurante: { label: 'Restaurante', ic: 'food', dur: 90, cost: 25, rate: { hambre: 1.3, social: 0.45, diversion: 0.2 }, moodlet: 'comida_rica' },
  gimnasio: { label: 'Gimnasio', ic: 'zap', dur: 90, cost: 10, rate: { energia: -0.3, higiene: -0.4, diversion: 0.15 }, skill: ['forma', 0.045], moodlet: 'en_forma' },
  cine: { label: 'Cine', ic: 'tv', dur: 150, cost: 12, rate: { diversion: 0.6, social: 0.2 }, moodlet: 'peli' },
};
// ---------- Mascotas ----------
export const PETS = {
  perro: { label: 'Perro', colors: ['#c8914f', '#3a2c22', '#f0e6d6', '#8a8a8a', '#d9b37a'], decay: { hambre: 3.5, carino: 2.5, diversion: 3.5 } },
  gato: { label: 'Gato', colors: ['#e09040', '#2a2a2a', '#f4f0ea', '#9a9aa0', '#c8a070'], decay: { hambre: 3, carino: 1.8, diversion: 2.5 } },
};
export const PET_NEEDS = { hambre: 'Hambre', carino: 'Cariño', diversion: 'Diversión' };
export const PET_NAMES = ['Luna', 'Toby', 'Coco', 'Nala', 'Rocky', 'Kira', 'Simba', 'Lola', 'Bruno', 'Mía', 'Thor', 'Canela'];
// ---------- Clima y estaciones ----------
export const SEASONS = [
  { id: 'primavera', label: 'Primavera', grass: '#86c565', leaves: '#4ea04e', w: { sol: 5, nubes: 3, lluvia: 2 } },
  { id: 'verano', label: 'Verano', grass: '#9cc45a', leaves: '#5a9a3e', w: { sol: 8, nubes: 2, lluvia: 1 } },
  { id: 'otono', label: 'Otoño', grass: '#a8b860', leaves: '#d0862e', w: { sol: 3, nubes: 4, lluvia: 4 } },
  { id: 'invierno', label: 'Invierno', grass: '#c8d4cf', leaves: '#7a9a8a', w: { sol: 3, nubes: 4, lluvia: 1, nieve: 4 } },
];
export const WEATHER = { sol: { label: 'Soleado', ic: 'sun' }, nubes: { label: 'Nublado', ic: 'cloud' }, lluvia: { label: 'Lluvia', ic: 'drop' }, nieve: { label: 'Nieve', ic: 'sparkle' } };
export const WINDOW_PRICE = 100;
OUTINGS.visita = { label: 'Casa de un vecino', ic: 'home', dur: 120, cost: 0, rate: { social: 0.55, diversion: 0.3, hambre: 0.25 }, moodlet: 'visita', hidden: true };
MOODLETS.visita = { label: 'Buena visita', mood: 10, dur: 360 };
ACTIONS.salir = { label: 'Salir (parque, cine…)', icon: '🚶', dur: 3, ages: ['adulto', 'anciano'], ui: 'outing', ic: 'pin' };
ACTIONS.mascota = { label: 'Adoptar mascota (200 €)', icon: '🐾', dur: 5, ages: ['adulto', 'anciano'], ui: 'pet', ic: 'heart' };
ACTIONS.carta = { label: 'Escribir carta al futuro', icon: '✉️', dur: 30, ages: ['adulto', 'anciano'], ui: 'letter', ic: 'pencil' };
OBJECTS.telefono.acts.push('salir', 'mascota', 'medico');
OBJECTS.ordenador.acts.push('carta');
Object.assign(MOODLETS, {
  aire_libre: { label: 'Un día al aire libre', mood: 10, dur: 360 },
  en_forma: { label: 'Se siente en forma', mood: 8, dur: 360 },
  peli: { label: 'Qué buena peli', mood: 8, dur: 300 },
  mascota: { label: 'Mimos con la mascota', mood: 8, dur: 240 },
  mascota_triste: { label: 'La mascota está triste', mood: -6, dur: 120 },
  acogedor: { label: 'Tarde acogedora', mood: 5, dur: 120 },
  gris: { label: 'Día gris', mood: -4, dur: 120 },
  carta: { label: 'Ha leído una carta muy especial', mood: 25, dur: 1440 },
  paseo: { label: 'Buen paseo', mood: 8, dur: 240 },
});

// ---------- Estilos de muebles ----------
// Cada mueble puede tener un estilo: cambia la madera, los electrodomésticos, la tela y la forma de las esquinas.
export const FURN_STYLES = {
  moderno: { label: 'Moderno', desc: 'El de siempre: líneas limpias' },
  nordico: { label: 'Nórdico', desc: 'Madera clara, blanco y gris suave', wood: '#d9c09a', appl: '#f7f6f1', fabric: '#b9c0c8', radius: 0.07 },
  rustico: { label: 'Rústico', desc: 'Madera oscura, cuadrados y robustos', wood: '#6e4524', appl: '#efe3c8', fabric: '#a5493a', radius: 0.01, rough: 0.95 },
  clasico: { label: 'Clásico', desc: 'Nogal, terciopelo y remates dorados', wood: '#5a2f1d', appl: '#f2e9d6', fabric: '#7a2a40', trim: '#c9a24a' },
  retro: { label: 'Retro', desc: 'Colores alegres de los años 60', wood: '#a0602f', appl: '#9fd6c4', fabric: '#e2a12c', radius: 0.055 },
  industrial: { label: 'Industrial', desc: 'Metal negro, hormigón y cuero', wood: '#3c3b3e', appl: '#8d949b', fabric: '#7a4a2e', radius: 0.015, metal: true },
};
const WOODS = new Set(['#a8784a', '#7a5432', '#7a5a3a', '#6a4a2a', '#9a7a5a', '#8a6a4a', '#b08a5a', '#8a6a42', '#6a4a32', '#f2e6d0', '#e8d5b0']);
const APPLS = new Set(['#e9eef2', '#d9d4cc', '#f4f6f8', '#e6eaee', '#cfe3ee']);
const hx = (c) => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = (c) => { const [r, g, b] = hx(c); return (r * 0.3 + g * 0.59 + b * 0.11) / 255; };
const toHex = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
// Ajusta el brillo de un color manteniendo su tono
function relight(base, l) { const [r, g, b] = hx(base); const k = l / Math.max(0.05, lum(base)); return toHex(r * k, g * k, b * k); }
// Color final de una caja de un mueble según su estilo y su color personalizado
export function styledColor(def, o, col) {
  if (o.tint && def.tint) { const ti = def.tint.indexOf(col); if (ti >= 0) return ti === 0 ? o.tint : relight(o.tint, lum(o.tint) * (1 - 0.12 * ti)); }
  const S = FURN_STYLES[o.style]; if (!S || !S.wood || !col.startsWith('#')) return col;
  if (def.tint) { const ti = def.tint.indexOf(col); if (ti >= 0) return ti === 0 ? S.fabric : relight(S.fabric, lum(S.fabric) * (1 - 0.12 * ti)); }
  if (WOODS.has(col)) { const ref = lum('#8a6a4a'); return relight(S.wood, Math.min(0.92, lum(S.wood) * (lum(col) / ref) ** 0.8)); }
  if (APPLS.has(col)) return S.appl;
  return col;
}

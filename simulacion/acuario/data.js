// Arrecife: datos del juego
export const COLORS = [
  { id: 'rojo', label: 'rojo', hex: '#e8443a', r: 1 }, { id: 'naranja', label: 'naranja', hex: '#f5902a', r: 1 },
  { id: 'amarillo', label: 'amarillo', hex: '#f5d03a', r: 1 }, { id: 'azul', label: 'azul', hex: '#3a8ae8', r: 1 },
  { id: 'verde', label: 'verde', hex: '#3ac07a', r: 1.6 }, { id: 'rosa', label: 'rosa', hex: '#f07ab4', r: 1.6 },
  { id: 'violeta', label: 'violeta', hex: '#8a5ae0', r: 2.4 }, { id: 'blanco', label: 'blanco perla', hex: '#f4f0ea', r: 2.4 },
];
export const PATTERNS = [{ id: 'liso', label: 'liso', r: 1 }, { id: 'rayas', label: 'rayado', r: 1.2 }, { id: 'lunares', label: 'moteado', r: 1.6 }, { id: 'degradado', label: 'degradado', r: 2.2 }];
export const FINS = [{ id: 'corta', label: 'Aleta corta', short: 'Corta', r: 1 }, { id: 'larga', label: 'Aleta larga', short: 'Larga', r: 1.5 }, { id: 'velo', label: 'Cola de velo', short: 'Velo', r: 2.2 }];
// (se calcula más abajo, con todas las especies)

// Decoración: cada una puede ser de varios colores (el primero es el de siempre)
export const DECOS = {
  planta: { label: 'Planta', price: 20, happy: 6, ic: 'leaf', colors: [['Verde', '#3a9a5a'], ['Lima', '#8ac43a'], ['Rojiza', '#b04a3a'], ['Morada', '#7a4aa0']] },
  roca: { label: 'Rocas', price: 15, happy: 4, ic: 'box', colors: [['Gris', '#8a857e'], ['Arena', '#c8b088'], ['Volcánica', '#4a4a50'], ['Roja', '#a0583a']] },
  castillo: { label: 'Castillo', price: 60, happy: 10, ic: 'home', colors: [['Arena', '#d8c8a8'], ['Rosa', '#e8b0c0'], ['Blanco', '#f0efe8'], ['Azul', '#9ab8d8']] },
  cofre: { label: 'Cofre del tesoro', price: 80, happy: 10, ic: 'star', colors: [['Madera', '#8a5a2a'], ['Rojo', '#a03a2a'], ['Negro', '#3a3030'], ['Verde', '#3a6a4a']] },
  burbujas: { label: 'Burbujas', price: 50, happy: 12, ic: 'bubbles', colors: [['Gris', '#555555'], ['Dorado', '#c9a24a'], ['Azul', '#3a6ab0']] },
  coral: { label: 'Coral', price: 40, happy: 8, ic: 'sparkle', colors: [['Coral', '#f07a6a'], ['Rosa', '#f59ab8'], ['Naranja', '#f5b860'], ['Violeta', '#a07ae0']] },
  barco: { label: 'Barco hundido', price: 120, happy: 14, ic: 'box', colors: [['Madera', '#7a5232'], ['Musgo', '#5a7a5a'], ['Gris', '#6a6a70']] },
  anfora: { label: 'Ánfora', price: 35, happy: 6, ic: 'drop', colors: [['Terracota', '#c0683a'], ['Azul', '#3a6aa0'], ['Blanca', '#e8e0d0']] },
  concha: { label: 'Concha gigante', price: 70, happy: 9, ic: 'sparkle', colors: [['Perla', '#f0e6dc'], ['Rosa', '#f0b4c4'], ['Azul', '#a8c8e8']] },
  estrella: { label: 'Estrella de mar', price: 25, happy: 5, ic: 'star', colors: [['Naranja', '#f08a3a'], ['Roja', '#d8443a'], ['Morada', '#9a5ac0'], ['Amarilla', '#f2c83a']] },
};
// Mejoras de la tienda. req: hace falta tener antes otra mejora.
export const UPGRADES = {
  comedero: { label: 'Comedero automático', desc: 'Echa comida sola cuando baja de la mitad (2 € cada vez). Se acabó el hambre.', price: 200, ic: 'food' },
  comedero2: { label: 'Dispensador inteligente', desc: 'La comida nunca baja del 70 % y se aprovecha el doble.', price: 450, ic: 'food', req: 'comedero' },
  filtro: { label: 'Filtro potente', desc: 'El agua se ensucia la mitad de rápido.', price: 150, ic: 'drop' },
  filtro2: { label: 'Filtro biológico', desc: 'El agua casi no se ensucia y se limpia sola poco a poco.', price: 400, ic: 'drop', req: 'filtro' },
  robot: { label: 'Robot limpiador', desc: 'Limpia el acuario solo cuando el agua baja del 50 % (5 € cada vez).', price: 320, ic: 'sparkle' },
  calefactor: { label: 'Calefactor automático', desc: 'Mantiene la temperatura perfecta.', price: 120, ic: 'thermo' },
  vitaminas: { label: 'Vitaminas en el agua', desc: 'Tienen menos hambre y se recuperan antes cuando enferman.', price: 260, ic: 'heart' },
  botiquin: { label: 'Botiquín', desc: 'Enferman menos y la medicina cuesta la mitad.', price: 180, ic: 'heart' },
  luces: { label: 'Luces de colores', desc: 'Peces más felices y más crías.', price: 140, ic: 'sun' },
  luces2: { label: 'Luces de arrecife', desc: 'Aún más ánimo, más crías y más variedades raras.', price: 380, ic: 'sun', req: 'luces' },
  incubadora: { label: 'Incubadora', desc: 'Los huevos eclosionan el doble de rápido y nace una cría más.', price: 300, ic: 'egg' },
  escaparate: { label: 'Escaparate iluminado', desc: 'Vienen más clientes y pagan un 20 % más.', price: 350, ic: 'shop' },
};
// Animales del acuario. eat: cuánto comen; clean: cuánto limpian el agua; move: cómo se mueven; rep: reputación para desbloquearlos.
// colors/pats: índices de COLORS y PATTERNS que puede tener cada especie.
export const SPECIES = {
  pez: { label: 'Pez', plural: 'Peces', price: 15, val: 1, eat: 1, move: 'swim', rep: 0, desc: 'Colores, dibujos y aletas: el que más variedades tiene.' },
  gamba: { label: 'Gamba', plural: 'Gambas', price: 25, val: 1.3, eat: 0.3, clean: 0.12, move: 'bottom', rep: 0, colors: [0, 1, 3, 5, 7], pats: [0, 1], desc: 'Recoge los restos del fondo: el agua se ensucia menos.' },
  caracol: { label: 'Caracol', plural: 'Caracoles', price: 20, val: 1.1, eat: 0.2, clean: 0.15, move: 'crawl', rep: 0, colors: [1, 2, 4, 6, 7], pats: [0, 1, 2], desc: 'Lento y tranquilo. Se come las algas del cristal.' },
  cangrejo: { label: 'Cangrejo', plural: 'Cangrejos', price: 45, val: 1.8, eat: 0.5, clean: 0.08, move: 'bottom', rep: 3, colors: [0, 1, 3, 4, 6], pats: [0, 2], desc: 'Camina de lado por la arena y limpia lo que encuentra.' },
  globo: { label: 'Pez globo', plural: 'Peces globo', price: 70, val: 2.6, eat: 1.1, move: 'swim', rep: 6, colors: [2, 1, 4, 3, 7], pats: [0, 2], desc: 'Se hincha como una pelota cuando algo le asusta.' },
  caballito: { label: 'Caballito de mar', plural: 'Caballitos de mar', price: 90, val: 3.2, eat: 0.7, move: 'upright', rep: 10, colors: [2, 1, 5, 6, 0], pats: [0, 2, 3], desc: 'Nada de pie, muy despacio. Los clientes lo adoran.' },
  medusa: { label: 'Medusa', plural: 'Medusas', price: 120, val: 4, eat: 0.4, move: 'drift', rep: 15, colors: [7, 5, 3, 6], pats: [0, 3], desc: 'Flota latiendo y brilla en la oscuridad.' },
};
export const MAX_TANKS = 6, TANK_CAP = 8;
export const TANK_PRICE = (n) => Math.round(220 * Math.pow(1.6, n - 1));
export const FISH_NAMES = ['Burbuja', 'Nemo', 'Coral', 'Perla', 'Aleta', 'Chispa', 'Lucero', 'Sirena', 'Tiburón', 'Gota', 'Marea', 'Ola', 'Nácar', 'Brisa', 'Azul', 'Rubí', 'Jade', 'Kiwi', 'Mango', 'Pipo'];

// Carácter de cada pez: cambia cómo nada
export const FISH_TRAITS = {
  timido: { m: 'Tímido', f: 'Tímida', desc: 'Se esconde entre las plantas y la decoración.' },
  sociable: { m: 'Sociable', f: 'Sociable', desc: 'Siempre nada en compañía.' },
  curioso: { m: 'Curioso', f: 'Curiosa', desc: 'Se acerca al cristal cuando lo miras de cerca.' },
  gloton: { m: 'Glotón', f: 'Glotona', desc: 'El primero en llegar a la comida.' },
  veloz: { m: 'Veloz', f: 'Veloz', desc: 'Nada a toda velocidad de un lado a otro.' },
};
// Clientes habituales, cada uno con su manera de pedir y de despedirse
export const CUSTOMERS = [
  { name: 'Doña Remedios', look: { skin: '#f0c8a8', hair: '#d8d8d8', bun: true, glasses: true, shirt: '#8a4a7a', bg: '#f6e6f2' }, ask: 'Busco {pez}. Que combine con mis cortinas, ¿eh?', bye: '¡Qué preciosidad! Se lo voy a enseñar a todo el edificio.' },
  { name: 'Dani', look: { skin: '#c98e66', hair: '#2a1a10', shirt: '#e5484d', bg: '#fde8e8' }, ask: '¡Quiero {pez}! He ahorrado toda la semana.', bye: '¡Le voy a llamar Capitán! ¡Gracias!' },
  { name: 'Sr. Ortega', look: { skin: '#e8b894', hair: '#3a3a3a', beard: true, shirt: '#f4f4f0', bg: '#e6f2f6' }, ask: 'Para la sala de espera de mi consulta: {pez}. Que relaje.', bye: 'Perfecto. Mis pacientes estarán más tranquilos.' },
  { name: 'Valeria', look: { skin: '#a8704a', hair: '#1a1010', curls: true, hat: 'band', hatC: '#25c48f', shirt: '#f5a524', bg: '#fff3dc' }, ask: 'Necesito {pez} para un vídeo. ¡Que quede bonito en cámara!', bye: '¡Va a ser viral! Te nombraré en el vídeo.' },
  { name: 'Profesora Inés', look: { skin: '#f6d7c3', hair: '#8a5a30', glasses: true, shirt: '#2f6f8f', bg: '#e2eefa' }, ask: 'Estudio cómo se heredan los colores: me interesa {pez}.', bye: 'Un ejemplar magnífico. Lo mencionaré en mi artículo.' },
  { name: 'Tomás', look: { skin: '#b07a50', hair: '#e8e8e8', beard: true, hat: 'beanie', hatC: '#2f4a6a', shirt: '#4a6a8a', bg: '#e4ecf4' }, ask: 'Toda la vida pescando y ahora quiero uno para mirarlo: {pez}.', bye: 'Este no se pesca. Este se cuida. Gracias.' },
  { name: 'Lu', look: { skin: '#e8b894', hair: '#5a2a8a', shirt: '#25c48f', bg: '#e2f7ee' }, ask: 'Para mi piso compartido: {pez}, que no dé guerra.', bye: '¡Mis compis van a flipar!' },
];

// Total de variedades del álbum: peces (color × dibujo × aleta) y el resto (color × dibujo)
export const TOTAL_COMBOS = Object.entries(SPECIES).reduce((n, [k, S]) => n + (k === 'pez' ? COLORS.length * PATTERNS.length * FINS.length : S.colors.length * S.pats.length), 0);

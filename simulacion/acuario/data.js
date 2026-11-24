// Arrecife: datos del juego
export const COLORS = [
  { id: 'rojo', label: 'rojo', hex: '#e8443a', r: 1 }, { id: 'naranja', label: 'naranja', hex: '#f5902a', r: 1 },
  { id: 'amarillo', label: 'amarillo', hex: '#f5d03a', r: 1 }, { id: 'azul', label: 'azul', hex: '#3a8ae8', r: 1 },
  { id: 'verde', label: 'verde', hex: '#3ac07a', r: 1.6 }, { id: 'rosa', label: 'rosa', hex: '#f07ab4', r: 1.6 },
  { id: 'violeta', label: 'violeta', hex: '#8a5ae0', r: 2.4 }, { id: 'blanco', label: 'blanco perla', hex: '#f4f0ea', r: 2.4 },
];
export const PATTERNS = [{ id: 'liso', label: 'liso', r: 1 }, { id: 'rayas', label: 'rayado', r: 1.2 }, { id: 'lunares', label: 'moteado', r: 1.6 }, { id: 'degradado', label: 'degradado', r: 2.2 }];
export const FINS = [{ id: 'corta', label: 'Aleta corta', short: 'Corta', r: 1 }, { id: 'larga', label: 'Aleta larga', short: 'Larga', r: 1.5 }, { id: 'velo', label: 'Cola de velo', short: 'Velo', r: 2.2 }];
export const TOTAL_COMBOS = COLORS.length * PATTERNS.length * FINS.length;

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
export const UPGRADES = {
  filtro: { label: 'Filtro potente', desc: 'El agua se ensucia la mitad de rápido', price: 150, ic: 'drop' },
  calefactor: { label: 'Calefactor automático', desc: 'Mantiene la temperatura perfecta', price: 120, ic: 'thermo' },
  luces: { label: 'Luces de colores', desc: 'Peces más felices y más crías', price: 140, ic: 'sun' },
  comedero: { label: 'Comedero automático', desc: 'Da de comer solo una vez al día', price: 200, ic: 'food' },
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

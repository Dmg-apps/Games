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

export const DECOS = {
  planta: { label: 'Planta', price: 20, happy: 6, ic: 'leaf' },
  roca: { label: 'Rocas', price: 15, happy: 4, ic: 'box' },
  castillo: { label: 'Castillo', price: 60, happy: 10, ic: 'home' },
  cofre: { label: 'Cofre del tesoro', price: 80, happy: 10, ic: 'star' },
  burbujas: { label: 'Burbujas', price: 50, happy: 12, ic: 'bubbles' },
  coral: { label: 'Coral', price: 40, happy: 8, ic: 'sparkle' },
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

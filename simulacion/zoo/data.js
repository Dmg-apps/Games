// Parque Salvaje: datos del juego
export const N = 22; // tamaño del terreno (casillas)
export const ENTRANCE = { x: 11, z: 21 };

export const BIOMES = {
  granja: { label: 'Granja', color: '#9cc46a', ic: 'home' },
  sabana: { label: 'Sabana', color: '#d6c27a', ic: 'sun' },
  selva: { label: 'Selva', color: '#4f9a4a', ic: 'tree' },
  artico: { label: 'Ártico', color: '#e9f1f6', ic: 'sparkle' },
  humedal: { label: 'Humedal', color: '#8cc0b0', ic: 'drop' },
};
export const SIZES = { S: { label: 'Pequeño', n: 4, price: 400 }, M: { label: 'Mediano', n: 6, price: 800 }, L: { label: 'Grande', n: 8, price: 1400 } };

// Especies originales. Cuerpo [largo, alto, ancho], patas, cuello, cabeza; colores; rasgos para el modelo 3D.
export const SPECIES = {
  cabra: { label: 'Cabra', biome: 'granja', price: 250, appeal: 1, fame: 0, space: 3, social: true, body: [0.55, 0.32, 0.28], legs: 0.32, neck: 0.12, head: 0.13, colors: ['#f0ece2', '#e0d8c8', '#6a5a4a'], feat: ['horns', 'beard'] },
  alpaca: { label: 'Alpaca', biome: 'granja', price: 400, appeal: 2, fame: 0, space: 3, social: true, body: [0.6, 0.4, 0.34], legs: 0.4, neck: 0.42, head: 0.13, colors: ['#e8d4b0', '#f4e8d0', '#3a2a20'], feat: ['fluffy', 'ears_up'] },
  flamenco: { eggs: true, label: 'Flamenco', biome: 'humedal', price: 450, appeal: 2, fame: 0, space: 2, social: true, biped: true, body: [0.36, 0.26, 0.22], legs: 0.62, neck: 0.5, head: 0.07, colors: ['#f48aa8', '#f8b4c8', '#2a2a2a'], feat: ['beak'] },
  tortuga: { eggs: true, label: 'Tortuga gigante', biome: 'selva', price: 500, appeal: 2, fame: 1, space: 3, body: [0.7, 0.32, 0.55], legs: 0.12, neck: 0.12, head: 0.1, colors: ['#7a6a3a', '#8a9a5a', '#5a5040'], feat: ['shell'] },
  cebra: { label: 'Cebra', biome: 'sabana', price: 700, appeal: 3, fame: 1, space: 4, social: true, body: [0.85, 0.42, 0.32], legs: 0.62, neck: 0.38, head: 0.15, colors: ['#f6f6f2', '#1c1c1c', '#1c1c1c'], feat: ['stripes', 'mane_short'] },
  canguro: { label: 'Canguro', biome: 'sabana', price: 800, appeal: 3, fame: 1, space: 4, social: true, hop: true, body: [0.5, 0.55, 0.34], legs: 0.4, neck: 0.18, head: 0.13, colors: ['#c8885a', '#e8c09a', '#4a3020'], feat: ['ears_up', 'tail_long'] },
  mono: { label: 'Mono', biome: 'selva', price: 900, appeal: 4, fame: 2, space: 3, social: true, body: [0.34, 0.36, 0.26], legs: 0.3, neck: 0.06, head: 0.14, colors: ['#7a5232', '#e8c8a0', '#3a2414'], feat: ['tail_long', 'face'] },
  pinguino: { eggs: true, label: 'Pingüino', biome: 'artico', price: 900, appeal: 4, fame: 2, space: 2, social: true, biped: true, body: [0.3, 0.42, 0.28], legs: 0.08, neck: 0.04, head: 0.11, colors: ['#1c1f2a', '#f4f4f0', '#f0a030'], feat: ['beak', 'penguin'] },
  jirafa: { label: 'Jirafa', biome: 'sabana', price: 1500, appeal: 5, fame: 2, space: 6, social: true, body: [0.9, 0.5, 0.36], legs: 1.0, neck: 1.1, head: 0.14, colors: ['#e8b05a', '#7a4a20', '#5a3a1a'], feat: ['spots', 'ossicones'] },
  leon: { label: 'León', biome: 'sabana', price: 2200, appeal: 6, fame: 3, space: 6, body: [0.95, 0.5, 0.4], legs: 0.5, neck: 0.15, head: 0.2, colors: ['#d8a050', '#e8c080', '#7a4a1a'], feat: ['mane', 'tail_long'] },
  osopolar: { label: 'Oso polar', biome: 'artico', price: 2500, appeal: 6, fame: 3, space: 7, body: [1.05, 0.6, 0.55], legs: 0.42, neck: 0.18, head: 0.22, colors: ['#f4f2ea', '#e8e4d8', '#222'], feat: ['ears_round'] },
  elefante: { label: 'Elefante', biome: 'sabana', price: 3500, appeal: 7, fame: 4, space: 9, social: true, body: [1.3, 0.95, 0.8], legs: 0.7, neck: 0.15, head: 0.42, colors: ['#9a9aa0', '#a8a8ae', '#6a6a70'], feat: ['trunk', 'ears_big', 'tusks'] },
  panda: { label: 'Panda', biome: 'selva', price: 5000, appeal: 9, fame: 4.5, space: 6, body: [0.8, 0.55, 0.5], legs: 0.34, neck: 0.15, head: 0.26, colors: ['#f6f4ee', '#1c1c1c', '#1c1c1c'], feat: ['panda', 'ears_round'] },
};

// Objetos dentro de los recintos (enriquecimiento)
export const ENRICH = {
  arbol: { label: 'Árbol', price: 120, ic: 'tree' },
  roca: { label: 'Rocas', price: 90, ic: 'box' },
  charca: { label: 'Charca', price: 200, ic: 'drop' },
  juguete: { label: 'Pelota gigante', price: 80, ic: 'ball' },
  bambu: { label: 'Bambú', price: 100, ic: 'leaf' },
};
// Edificios y decoración del parque (junto a un camino)
export const BUILDINGS = {
  helados: { label: 'Helados', price: 300, cat: 'Tiendas', sells: 4, need: 'hambre', amount: 25, color: '#f49ac0', ic: 'shop' },
  comida: { label: 'Hamburguesas', price: 500, cat: 'Tiendas', sells: 8, need: 'hambre', amount: 60, color: '#f0a040', ic: 'food' },
  bebidas: { label: 'Bebidas', price: 300, cat: 'Tiendas', sells: 3, need: 'sed', amount: 60, color: '#5aa8e8', ic: 'drop' },
  banos: { label: 'Aseos', price: 600, cat: 'Tiendas', sells: 0, need: 'vejiga', amount: 100, color: '#8a9ab0', ic: 'toilet' },
  regalos: { label: 'Regalos', price: 700, cat: 'Tiendas', sells: 10, need: 'recuerdo', amount: 100, color: '#a07ad0', ic: 'star' },
  banco: { label: 'Banco', price: 80, cat: 'Decoración', decor: 2, ic: 'sofa' },
  papelera: { label: 'Papelera', price: 40, cat: 'Decoración', decor: 0, bin: true, ic: 'trash' },
  farola: { label: 'Farola', price: 60, cat: 'Decoración', decor: 1, ic: 'lamp' },
  flores: { label: 'Flores', price: 30, cat: 'Decoración', decor: 2, ic: 'leaf' },
  arbolp: { label: 'Árbol', price: 100, cat: 'Decoración', decor: 3, ic: 'tree' },
  fuente: { label: 'Fuente', price: 900, cat: 'Decoración', decor: 8, ic: 'drop' },
};
export const PATH_PRICE = 10;
export const WAGES = { keeper: 120, cleaner: 90 };
export const FOOD_COST = 15;

export const ANIMAL_NAMES = ['Luna', 'Kiko', 'Nala', 'Bruno', 'Coco', 'Tula', 'Simba', 'Maya', 'Rufo', 'Kira', 'Toto', 'Lola', 'Bamba', 'Nube', 'Pipa', 'Zuri', 'Oto', 'Sol', 'Mora', 'Chispa', 'Duna', 'Leo', 'Nilo', 'Tara'];
export const CARNIVORES = ['leon', 'osopolar'];

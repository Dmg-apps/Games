// Parque Salvaje: datos del juego
export const N = 22; // tamaño del terreno (casillas)
export const ENTRANCE = { x: 11, z: 21 };

export const BIOMES = {
  granja: { label: 'Granja', color: '#9cc46a', ic: 'home' },
  sabana: { label: 'Sabana', color: '#d6c27a', ic: 'sun' },
  selva: { label: 'Selva', color: '#4f9a4a', ic: 'tree' },
  artico: { label: 'Ártico', color: '#e9f1f6', ic: 'sparkle' },
  humedal: { label: 'Humedal', color: '#8cc0b0', ic: 'drop' },
  bosque: { label: 'Bosque', color: '#6e9a56', ic: 'tree' },
};
// Enfermedades posibles de los animales (todas se curan con el veterinario)
export const ILLNESS = { resfriado: 'Resfriado', tripa: 'Dolor de tripa', pulgas: 'Pulgas', pata: 'Cojea de una pata' };
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
  caballo: { label: 'Caballo', biome: 'granja', price: 600, appeal: 2, fame: 0.5, space: 4, social: true, body: [0.92, 0.46, 0.34], legs: 0.64, neck: 0.42, head: 0.14, colors: ['#8a5634', '#9a6640', '#2a180c'], feat: ['mane_short', 'tail_long'] },
  burro: { label: 'Burro', biome: 'granja', price: 350, appeal: 1, fame: 0, space: 3, social: true, body: [0.68, 0.38, 0.3], legs: 0.44, neck: 0.28, head: 0.13, colors: ['#8d8780', '#d8d2c8', '#2a2420'], feat: ['ears_up'] },
  llama: { label: 'Llama', biome: 'granja', price: 500, appeal: 2, fame: 0.5, space: 3, social: true, body: [0.64, 0.4, 0.33], legs: 0.5, neck: 0.55, head: 0.13, colors: ['#f2ece0', '#c8a880', '#3a2a20'], feat: ['fluffy', 'ears_up'] },
  tigre: { label: 'Tigre', biome: 'selva', price: 2600, appeal: 7, fame: 3, space: 6, body: [1.0, 0.47, 0.37], legs: 0.46, neck: 0.15, head: 0.19, colors: ['#e8862a', '#f8f0e2', '#171210'], feat: ['tail_long'] },
  osopardo: { label: 'Oso pardo', biome: 'bosque', price: 2300, appeal: 6, fame: 3, space: 7, body: [1.0, 0.6, 0.55], legs: 0.42, neck: 0.18, head: 0.22, colors: ['#6e4628', '#5e3c22', '#2a1a10'], feat: ['ears_round'] },
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
export const WAGES = { keeper: 120, cleaner: 90, vet: 160 };
export const VET_VISIT = 80; // llamar al veterinario una vez
export const FOOD_COST = 15;

export const ANIMAL_NAMES = ['Luna', 'Kiko', 'Nala', 'Bruno', 'Coco', 'Tula', 'Simba', 'Maya', 'Rufo', 'Kira', 'Toto', 'Lola', 'Bamba', 'Nube', 'Pipa', 'Zuri', 'Oto', 'Sol', 'Mora', 'Chispa', 'Duna', 'Leo', 'Nilo', 'Tara', 'Bimba', 'Canela', 'Trufa', 'Pelusa', 'Golfo', 'Jazmín', 'Lirio', 'Menta', 'Ocre', 'Pimienta', 'Ramón', 'Sombra', 'Tango', 'Uva', 'Vainilla', 'Yuca', 'Zafiro', 'Arena', 'Bombón', 'Cacao', 'Dátil', 'Eco', 'Fresa', 'Gofio', 'Higo', 'Indi', 'Jara', 'Kala', 'Lima', 'Mango', 'Nuez', 'Olivo', 'Pan', 'Queso', 'Roble', 'Salvia', 'Tomillo', 'Ulises', 'Vega', 'Wanda', 'Xoco', 'Yago', 'Zarza', 'Ámbar', 'Brisa', 'Cometa', 'Dino', 'Estrella', 'Faro', 'Gema', 'Hada', 'Iris', 'Jade', 'Kumo', 'Loto', 'Merlín', 'Niebla', 'Ópalo', 'Pompón', 'Quimera', 'Rizos', 'Saltarín', 'Trueno', 'Umbra', 'Volcán'];
export const CARNIVORES = ['leon', 'osopolar', 'tigre', 'osopardo', 'ligre', 'tigon', 'pizzly'];

// Cruces posibles en la naturaleza (o en cautividad) entre especies emparentadas.
// Los híbridos no se compran: solo se consiguen cruzando. Muchos son estériles, como en la realidad.
export const HYBRIDS = {
  cebrallo: { label: 'Cebrallo', biome: 'sabana', price: 2400, appeal: 6, space: 4, social: true, sterile: true, body: [0.9, 0.45, 0.33], legs: 0.62, neck: 0.4, head: 0.14, colors: ['#9a6a44', '#a87a52', '#1e1410'], feat: [], desc: 'Caballo × cebra: cuerpo de caballo con rayas en patas y grupa.' },
  cebrasno: { label: 'Cebrasno', biome: 'sabana', price: 2000, appeal: 5, space: 4, social: true, sterile: true, body: [0.75, 0.4, 0.31], legs: 0.52, neck: 0.32, head: 0.13, colors: ['#a8a29a', '#e0dad0', '#1e1a18'], feat: [], desc: 'Burro × cebra: orejas largas y patas rayadas.' },
  mula: { label: 'Mula', biome: 'granja', price: 900, appeal: 2, space: 4, social: true, sterile: true, body: [0.82, 0.42, 0.32], legs: 0.56, neck: 0.36, head: 0.14, colors: ['#6e4a30', '#a88a70', '#2a1a10'], feat: [], desc: 'Caballo × burro: fuerte y tranquila. Es estéril.' },
  ligre: { label: 'Ligre', biome: 'sabana', price: 9000, appeal: 11, space: 8, sterile: true, body: [1.15, 0.55, 0.43], legs: 0.54, neck: 0.15, head: 0.22, colors: ['#d89a50', '#f0dcb4', '#8a5a30'], feat: [], desc: 'León (macho) × tigresa: el felino más grande del mundo.' },
  tigon: { label: 'Tigón', biome: 'selva', price: 7000, appeal: 9, space: 6, sterile: true, body: [0.92, 0.46, 0.36], legs: 0.46, neck: 0.15, head: 0.19, colors: ['#d8964a', '#f2e2c4', '#3a2414'], feat: [], desc: 'Tigre (macho) × leona: rayas y una pequeña melena.' },
  pizzly: { label: 'Oso pizzly', biome: 'artico', price: 6000, appeal: 8, space: 7, body: [1.02, 0.6, 0.55], legs: 0.42, neck: 0.2, head: 0.22, colors: ['#c8ac86', '#b89a74', '#3a2a1a'], feat: [], desc: 'Oso polar × oso pardo: ocurre de verdad en el Ártico. Puede tener crías.' },
  huarizo: { label: 'Huarizo', biome: 'granja', price: 1200, appeal: 3, space: 3, social: true, body: [0.6, 0.4, 0.34], legs: 0.45, neck: 0.48, head: 0.13, colors: ['#ead8b8', '#f2e6d0', '#4a3a2a'], feat: [], desc: 'Llama × alpaca: lana suave. Puede tener crías.' },
};
// m/f: si importa quién es el padre y quién la madre
export const CROSSES = [
  { a: 'caballo', b: 'cebra', child: 'cebrallo' },
  { a: 'burro', b: 'cebra', child: 'cebrasno' },
  { a: 'caballo', b: 'burro', child: 'mula' },
  { m: 'leon', f: 'tigre', child: 'ligre' },
  { m: 'tigre', f: 'leon', child: 'tigon' },
  { a: 'osopolar', b: 'osopardo', child: 'pizzly' },
  { a: 'llama', b: 'alpaca', child: 'huarizo' },
];
export function crossChild(male, female) {
  if (male === female) return HYBRIDS[male]?.sterile ? null : male;
  const c = CROSSES.find((x) => (x.m ? x.m === male && x.f === female : (x.a === male && x.b === female) || (x.b === male && x.a === female)));
  return c ? c.child : null;
}
// Los híbridos viven en el parque como cualquier especie (pero no se venden en la tienda)
for (const [k, v] of Object.entries(HYBRIDS)) SPECIES[k] = { ...v, hybrid: true, fame: 0 };

// Carácter de cada animal: cambia lo que hace y lo que comentan los visitantes
export const TRAITS = {
  jugueton: { m: 'Juguetón', f: 'Juguetona', desc: 'Siempre buscando algo con lo que jugar.' },
  dormilon: { m: 'Dormilón', f: 'Dormilona', desc: 'Echa siestas a todas horas.' },
  gloton: { m: 'Glotón', f: 'Glotona', desc: 'Tiene hambre antes que nadie.' },
  curioso: { m: 'Curioso', f: 'Curiosa', desc: 'Se acerca a la valla a mirar a los visitantes. Les encanta.' },
  timido: { m: 'Tímido', f: 'Tímida', desc: 'Prefiere esconderse junto a árboles y rocas.' },
  presumido: { m: 'Presumido', f: 'Presumida', desc: 'Posa para las fotos. Los visitantes salen más contentos.' },
  grunon: { m: 'Gruñón', f: 'Gruñona', desc: 'Necesita su espacio: se aparta de los demás.' },
};
// Género gramatical de cada especie (para que los textos concuerden: "una cebra", "un león")
for (const k of ['cabra', 'alpaca', 'llama', 'cebra', 'jirafa', 'tortuga', 'mula']) SPECIES[k].fem = true;

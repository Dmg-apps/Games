// Parque Salvaje: datos del juego
export const N = 22; // tamaño del terreno (casillas)
export const ENTRANCE = { x: 11, z: 21 };

export const BIOMES = {
  granja: { label: 'Granja', color: '#9cc46a', ic: 'home' },
  pradera: { label: 'Pradera', color: '#c4cf7a', ic: 'sun' },
  bosque: { label: 'Bosque', color: '#6e9a56', ic: 'tree' },
};
// Enfermedades posibles de los animales (todas se curan con el veterinario)
export const ILLNESS = { resfriado: 'Resfriado', tripa: 'Dolor de tripa', pulgas: 'Pulgas', pata: 'Cojea de una pata' };
export const SIZES = { S: { label: 'Pequeño', n: 4, price: 400 }, M: { label: 'Mediano', n: 6, price: 800 }, L: { label: 'Grande', n: 8, price: 1400 } };

// Especies originales. Cuerpo [largo, alto, ancho], patas, cuello, cabeza; colores; rasgos para el modelo 3D.
export const SPECIES = {
  oveja: { label: 'Oveja', fem: true, biome: 'pradera', price: 250, appeal: 1, fame: 0, space: 2, social: true, len: 0.62, body: [0.5, 0.3, 0.26], legs: 0.24, neck: 0.08, head: 0.1, model: { any: ['q/animals/sheep'] }, noWalk: true, colors: ['#ece6d8'] },
  cerdo: { label: 'Cerdo', biome: 'granja', price: 300, appeal: 1, fame: 0, space: 3, social: true, len: 0.7, body: [0.56, 0.3, 0.3], legs: 0.18, neck: 0.06, head: 0.12, model: { any: ['q/animals/pig'] }, noWalk: true, colors: ['#f0b0a8'] },
  burro: { label: 'Burro', biome: 'granja', price: 350, appeal: 1, fame: 0, space: 3, social: true, len: 0.9, body: [0.7, 0.36, 0.3], legs: 0.4, neck: 0.18, head: 0.13, model: { any: ['donkey'] }, colors: ['#8d8780'] },
  alpaca: { label: 'Alpaca', fem: true, biome: 'pradera', price: 400, appeal: 2, fame: 0, space: 3, social: true, len: 0.78, body: [0.6, 0.38, 0.3], legs: 0.4, neck: 0.4, head: 0.12, model: { any: ['alpaca'] }, colors: ['#c8a070'] },
  vaca: { label: 'Vaca', m: 'Toro', fem: true, biome: 'granja', price: 450, appeal: 2, fame: 0, space: 4, social: true, len: 1.2, body: [0.95, 0.5, 0.42], legs: 0.4, neck: 0.15, head: 0.17, model: { f: ['cow'], m: ['bull'] }, colors: ['#8a5a30'] },
  caballo: { label: 'Caballo', biome: 'pradera', price: 600, appeal: 2, fame: 0.5, space: 4, social: true, len: 1.2, body: [0.95, 0.45, 0.32], legs: 0.5, neck: 0.3, head: 0.14, model: { any: ['horse', 'white_horse'] }, colors: ['#8a5634'] },
  perro: { label: 'Perro', biome: 'granja', price: 300, appeal: 3, fame: 0.5, space: 2, social: true, len: 0.5, body: [0.42, 0.26, 0.2], legs: 0.22, neck: 0.08, head: 0.1, model: { any: ['husky', 'shiba'] }, colors: ['#c88a40'] },
  ciervo: { label: 'Ciervo', f: 'Cierva', biome: 'bosque', price: 900, appeal: 3, fame: 1, space: 4, social: true, len: 0.95, body: [0.75, 0.42, 0.3], legs: 0.5, neck: 0.3, head: 0.13, model: { f: ['deer'], m: ['stag'] }, colors: ['#9a6a40'] },
  zorro: { label: 'Zorro', biome: 'bosque', price: 700, appeal: 3, fame: 1, space: 2, len: 0.6, body: [0.45, 0.24, 0.18], legs: 0.2, neck: 0.08, head: 0.1, model: { any: ['fox'] }, colors: ['#d8742a'] },
  gallina: { label: 'Gallina', fem: true, biome: 'granja', price: 60, appeal: 2, fame: 0, space: 1, social: true, len: 0.22, body: [0.18, 0.16, 0.14], legs: 0.06, neck: 0.04, head: 0.06, model: { any: ['q/animals/chick'] }, yaw: -Math.PI / 2, noWalk: true, colors: ['#f5d24a'] },
  gato: { label: 'Gato', biome: 'granja', price: 150, appeal: 3, fame: 0, space: 1, len: 0.28, body: [0.22, 0.14, 0.1], legs: 0.1, neck: 0.04, head: 0.06, model: { any: ['q/animals/cat'] }, yaw: -Math.PI / 2, colors: ['#3c3c42'] },
  llama: { label: 'Llama', fem: true, biome: 'pradera', price: 500, appeal: 2, fame: 0.5, space: 3, social: true, len: 0.8, body: [0.6, 0.4, 0.3], legs: 0.45, neck: 0.45, head: 0.12, model: { any: ['q/animals/llama'] }, noWalk: true, colors: ['#6a4028'] },
  aguila: { label: 'Águila', biome: 'bosque', price: 1200, appeal: 5, fame: 1.5, space: 3, len: 0.62, body: [0.35, 0.3, 0.3], legs: 0.12, neck: 0.08, head: 0.08, model: { any: ['q/animals/eagle'] }, yaw: Math.PI, flier: true, colors: ['#4a2a18'] },
  lobo: { label: 'Lobo', biome: 'bosque', price: 1800, appeal: 5, fame: 2, space: 5, social: true, len: 0.85, body: [0.65, 0.34, 0.24], legs: 0.34, neck: 0.1, head: 0.13, model: { any: ['wolf'] }, colors: ['#7a7a80'] },
};

// Objetos dentro de los recintos (enriquecimiento)
// biome: solo para ese hábitat (si no, vale para todos). hide: sirve de escondite. play: para jugar. water: para beber.
export const ENRICH = {
  arbol: { label: 'Árbol', price: 120, ic: 'tree', hide: true },
  roca: { label: 'Rocas', price: 90, ic: 'box', hide: true },
  charca: { label: 'Charca', price: 200, ic: 'drop', water: true },
  juguete: { label: 'Pelota gigante', price: 80, ic: 'ball', play: true },
  // Granja
  pajar: { label: 'Pacas de paja', price: 70, ic: 'box', biome: 'granja', hide: true },
  comedero: { label: 'Comedero de madera', price: 90, ic: 'food', biome: 'granja' },
  establo: { label: 'Establo', price: 260, ic: 'home', biome: 'granja', hide: true },
  // Pradera
  tronco: { label: 'Poste para rascarse', price: 90, ic: 'tree', biome: 'pradera', play: true },
  acacia: { label: 'Árbol de sombra', price: 150, ic: 'tree', biome: 'pradera', hide: true },
  juncos: { label: 'Hierba alta', price: 60, ic: 'leaf', biome: 'pradera', hide: true },
  // Bosque
  troncocaido: { label: 'Tronco caído', price: 100, ic: 'tree', biome: 'bosque', play: true },
  helechos: { label: 'Helechos', price: 70, ic: 'leaf', biome: 'bosque', hide: true },
  cuevaroca: { label: 'Madriguera de piedra', price: 280, ic: 'home', biome: 'bosque', hide: true },
};
// Objetos que se pueden poner en un recinto de cierto hábitat
export const enrichFor = (biome) => Object.entries(ENRICH).filter(([, v]) => !v.biome || v.biome === biome);
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
  fuente: { label: 'Pozo de los deseos', price: 900, cat: 'Decoración', decor: 8, ic: 'drop' },
};
export const PATH_PRICE = 10;
export const WAGES = { keeper: 120, cleaner: 90, vet: 160 };
export const VET_VISIT = 80; // llamar al veterinario una vez
export const FOOD_COST = 15;
export const SPONSOR = 25; // al día por cada animal rescatado que ya confía (padrinos)
export const CARE = { treat: { label: "Darle un premio", short: "Premio", ic: "heart", price: 10, gain: 6, cd: 180, desc: "Fruta, pescado o pienso especial, según la especie" }, keeper: { label: "Rato con su cuidador", short: "Cuidador", ic: "paw", price: 0, gain: 10, cd: 480, keeper: true, desc: "El cuidador se sienta cerca, sin prisa, y le habla bajito" }, toy: { label: "Juego de enriquecimiento", short: "Juego", ic: "sparkle", price: 25, gain: 8, cd: 720, happy: 12, desc: "Comida escondida en cajas y cuerdas para que la busque" } };

export const ANIMAL_NAMES = ['Luna', 'Kiko', 'Nala', 'Bruno', 'Coco', 'Tula', 'Simba', 'Maya', 'Rufo', 'Kira', 'Toto', 'Lola', 'Bamba', 'Nube', 'Pipa', 'Zuri', 'Oto', 'Sol', 'Mora', 'Chispa', 'Duna', 'Leo', 'Nilo', 'Tara', 'Bimba', 'Canela', 'Trufa', 'Pelusa', 'Golfo', 'Jazmín', 'Lirio', 'Menta', 'Ocre', 'Pimienta', 'Ramón', 'Sombra', 'Tango', 'Uva', 'Vainilla', 'Yuca', 'Zafiro', 'Arena', 'Bombón', 'Cacao', 'Dátil', 'Eco', 'Fresa', 'Gofio', 'Higo', 'Indi', 'Jara', 'Kala', 'Lima', 'Mango', 'Nuez', 'Olivo', 'Pan', 'Queso', 'Roble', 'Salvia', 'Tomillo', 'Ulises', 'Vega', 'Wanda', 'Xoco', 'Yago', 'Zarza', 'Ámbar', 'Brisa', 'Cometa', 'Dino', 'Estrella', 'Faro', 'Gema', 'Hada', 'Iris', 'Jade', 'Kumo', 'Loto', 'Merlín', 'Niebla', 'Ópalo', 'Pompón', 'Quimera', 'Rizos', 'Saltarín', 'Trueno', 'Umbra', 'Volcán'];
export const CARNIVORES = ['lobo', 'zorro', 'perro', 'gato', 'aguila'];

// Cruces posibles en la naturaleza (o en cautividad) entre especies emparentadas.
// Los híbridos no se compran: solo se consiguen cruzando. Muchos son estériles, como en la realidad.
export const HYBRIDS = {
  mula: { label: 'Mula', fem: true, biome: 'granja', price: 900, appeal: 2, space: 4, social: true, sterile: true, len: 1.0, body: [0.8, 0.42, 0.32], legs: 0.45, neck: 0.22, head: 0.14, model: { any: ['donkey'] }, tint: '#9a7050', colors: ['#6e4a30'], desc: 'Caballo × burro: fuerte y tranquila. Es estéril, como en la realidad.' },
};
// m/f: si importa quién es el padre y quién la madre
export const CROSSES = [
  { a: 'caballo', b: 'burro', child: 'mula' },
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
for (const k of ['oveja', 'alpaca', 'vaca', 'mula', 'gallina', 'llama']) (SPECIES[k] || {}).fem = true;

// ---------- Santuario: rescates y adopciones ----------
// Cada rescate trae una historia y un estado al llegar. trust: confianza inicial (0-100).
export const RESCUES = {
  circo: { title: 'Un circo cierra', ic: 'alert', trust: 10, fame: 0.15, species: ['caballo', 'burro', 'perro', 'cerdo', 'oveja', 'llama'], story: 'Viene de un circo que ha cerrado. Le asusta la gente y los ruidos: necesita calma.' },
  granja: { title: 'Granja abandonada', ic: 'home', trust: 30, hungry: true, fame: 0.08, species: ['oveja', 'burro', 'cerdo', 'vaca', 'alpaca', 'caballo', 'gallina', 'llama'], story: 'Lo encontraron en una granja abandonada, delgado y con poca comida. Agradecerá un buen plato.' },
  maltrato: { title: 'Rescate por maltrato', ic: 'alert', trust: 12, fame: 0.2, species: ['perro', 'gato', 'caballo', 'burro', 'vaca', 'cerdo', 'gallina'], story: 'Lo han rescatado de un lugar donde lo trataban mal. Desconfía de las personas y necesita paciencia.' },
  herido: { title: 'Herido, ya curado', ic: 'heart', trust: 35, injured: true, fame: 0.12, species: ['ciervo', 'zorro', 'lobo', 'aguila'], story: 'Sufrió un accidente en el monte y ya está curado, pero no puede volver a la naturaleza. Aún cojea un poco.' },
  huerfano: { title: 'Cría huérfana', ic: 'heart', trust: 25, baby: true, fame: 0.15, species: ['ciervo', 'zorro', 'lobo', 'oveja', 'vaca', 'caballo'], story: 'Cría huérfana: su madre no pudo cuidarla. Necesita compañía y alguien pendiente de ella.' },
  abandono: { title: 'Abandonado en la carretera', ic: 'users', trust: 40, fame: 0.06, species: ['perro', 'gato', 'oveja', 'cerdo', 'burro', 'gallina'], story: 'Lo dejaron abandonado junto a una carretera. Está asustado, pero se nota que ha vivido con personas.' },
  centro: { title: 'Otro centro sin sitio', ic: 'users', trust: 50, fame: 0.05, species: ['alpaca', 'llama', 'lobo', 'zorro', 'vaca', 'ciervo', 'caballo', 'aguila'], story: 'Otro centro de rescate se ha quedado sin sitio y busca un hogar tranquilo para él.' },
};

// Depredadores: tamaño máximo de presa (espacio que ocupa). Los grandes también cazan carnívoros más pequeños.
export const PREDATOR = { lobo: ['oveja', 'cerdo', 'alpaca', 'llama', 'ciervo', 'perro', 'zorro', 'gato', 'gallina'], zorro: ['gallina'], aguila: ['gallina'], perro: [] }; // a quién caza cada uno
// Clima de cada hábitat: no pueden ir pegados si son muy distintos
export const CLIMATE = { bosque: 1, granja: 2, pradera: 3 };
export const STAFF_NAMES = ['Lucía', 'Mateo', 'Nora', 'Iker', 'Alba', 'Hugo', 'Sara', 'Leo', 'Inés', 'Bruno', 'Vera', 'Marco', 'Ada', 'Pau', 'Noa', 'Teo', 'Lía', 'Gael', 'Irene', 'Dani', 'Olga', 'Rubén', 'Celia', 'Omar'];
export const ROLES = { keeper: { label: 'Cuidado de animales', short: 'Cuidados', ic: 'paw', color: '#2aa876' }, cleaner: { label: 'Limpieza', short: 'Limpieza', ic: 'broom', color: '#3a9bd6' }, vet: { label: 'Veterinaria', short: 'Veterinaria', ic: 'heart', color: '#ee6f47' } };

// Escala real de cada especie respecto a su modelo (1 casilla = 2 m; una persona mide unos 1,65 m).
// Ej.: elefante ~3 m a la cruz, jirafa ~5 m de alto, pingüino <1 m, zorro ~40 cm.
export const REAL_SCALE = {}; // los modelos ya vienen a su tamaño (len)

// Set de iconos propio (24×24, trazo redondeado). Coherente en todos los móviles, a diferencia de los emojis.
const P = {
  food: '<path d="M6 3v6a3 3 0 0 0 6 0V3M9 3v18"/><path d="M18 21V3c-2 1.5-3 4.5-3 9h3"/>',
  moon: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z"/>',
  drop: '<path d="M12 3s6.5 6.6 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 9.6 12 3 12 3z"/>',
  game: '<rect x="2.5" y="7" width="19" height="11" rx="5.5"/><path d="M7.5 10.5v4M5.5 12.5h4"/><circle cx="15.5" cy="11.5" r=".6" fill="currentColor"/><circle cx="17.8" cy="13.8" r=".6" fill="currentColor"/>',
  chat: '<path d="M20.5 11.5a8 8 0 0 1-11.7 7.1L4 20l1.3-4.4A8 8 0 1 1 20.5 11.5z"/>',
  toilet: '<path d="M6 3h5v7H6z"/><path d="M4 10h15a6.5 6.5 0 0 1-6.5 6.5L13.5 21h-5l1-4.6A6.5 6.5 0 0 1 4 10z"/>',
  heart: '<path d="M12 20s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.4C20 15.3 12 20 12 20z"/>',
  hearts: '<path d="M9.5 18S3 14.3 3 9.6A3.6 3.6 0 0 1 9.5 7.7 3.6 3.6 0 0 1 16 9.6"/><path d="M16.5 21s-5-2.9-5-6.4a2.6 2.6 0 0 1 5-1.2 2.6 2.6 0 0 1 5 1.2c0 3.5-5 6.4-5 6.4z"/>',
  heartbreak: '<path d="M12 20s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.4C20 15.3 12 20 12 20z"/><path d="M12 7l-1.5 4 3 2-1.5 4"/>',
  users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 14a5 5 0 0 1 5 5.5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  hammer: '<path d="M13.5 3.5l7 7-3 3-7-7z"/><path d="M11.5 8.5L3.8 16.2a2.1 2.1 0 0 0 3 3l7.7-7.7"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  play: '<path d="M7.5 5.2v13.6a1 1 0 0 0 1.5.9l10.4-6.8a1 1 0 0 0 0-1.7L9 4.4a1 1 0 0 0-1.5.8z" fill="currentColor" stroke="none"/>',
  ff: '<path d="M3 6.5v11l8-5.5zM12 6.5v11l8-5.5z" fill="currentColor" stroke-linejoin="round"/>',
  fff: '<path d="M1.5 7.5v9L7 12zM8.5 7.5v9L14 12zM15.5 7.5v9L21 12z" fill="currentColor" stroke-linejoin="round"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M15 8.6a4 4 0 1 0 0 6.8M7.5 11h6M7.5 13.5h5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  rotate: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  move: '<path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2M3 13h18"/>',
  backpack: '<path d="M6 10a6 6 0 0 1 12 0v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z"/><path d="M9.5 4.3V3h5v1.3M9 15h6v3H9z"/>',
  phone: '<path d="M5 3.5h3.5l2 5L8 10a11 11 0 0 0 6 6l1.5-2.5 5 2V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5.5a2 2 0 0 1 2-2z"/>',
  bottle: '<path d="M10 2.5h4M10.5 2.5V5L8 8.5V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V8.5L13.5 5V2.5M8 12.5h8"/>',
  home: '<path d="M3 11 12 3.5 21 11"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
  bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  alert: '<path d="M10.3 4.2 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4M12 17h.01"/>',
  sparkle: '<path d="M12 3l1.9 5.6L19.5 10.5l-5.6 1.9L12 18l-1.9-5.6L4.5 10.5l5.6-1.9z"/><path d="M19 16v4M17 18h4"/>',
  cloud: '<path d="M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.8 9a4.8 4.8 0 0 1-.3 9.5z"/>',
  zap: '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14a4.8 4.8 0 0 0 8 0M9 9.5h.01M15 9.5h.01"/>',
  frown: '<circle cx="12" cy="12" r="9"/><path d="M8.5 16.5a4.5 4.5 0 0 1 7 0M9 9.5h.01M15 9.5h.01"/>',
  meh: '<circle cx="12" cy="12" r="9"/><path d="M8.5 15h7M9 9.5h.01M15 9.5h.01"/>',
  star: '<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.6l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
  book: '<path d="M4 19.5V5a2 2 0 0 1 2-2h13.5v15H6a2 2 0 0 0-2 2 1.5 1.5 0 0 0 1.5 1.5h14"/>',
  pencil: '<path d="M4 20l1-4.5L16 4.5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M14 6.5l3 3"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  tv: '<rect x="3" y="5" width="18" height="12" rx="2.5"/><path d="M9 21h6M8 2.5l4 2.5 4-2.5"/>',
  monitor: '<rect x="3" y="4" width="18" height="12" rx="2.5"/><path d="M8.5 20.5h7M12 16v4.5"/>',
  bed: '<path d="M3 19V6M3 14h18v5M21 14v-2.5A2.5 2.5 0 0 0 18.5 9H11v5"/><circle cx="7" cy="11" r="1.6"/>',
  sofa: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3 18v-5a2 2 0 0 1 4 0v1.5h10V13a2 2 0 0 1 4 0v5zM5.5 18v2M18.5 18v2"/>',
  fridge: '<rect x="5.5" y="2.5" width="13" height="19" rx="2.5"/><path d="M5.5 9.5h13M9 5.5v2M9 12.5v3"/>',
  table: '<path d="M3 9h18M5 9v11M19 9v11M3 9l2-4h14l2 4"/>',
  lamp: '<path d="M8 3h8l3 7H5z"/><path d="M12 10v9M8.5 21h7"/>',
  rug: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M7 10h10M7 14h10"/>',
  tree: '<path d="M12 21v-5"/><path d="M12 3 6 11h3l-4 5h14l-4-5h3z"/>',
  ball: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 2.5 3 15.5 0 18M12 3c-3 2.5-3 15.5 0 18"/>',
  leaf: '<path d="M5 20c0-9 5-14.5 15-15.5C19 14 13.5 19 5 20z"/><path d="M5 20l7.5-7.5"/>',
  receipt: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
  ring: '<circle cx="12" cy="15" r="6"/><path d="M9.5 4.5 12 8.5l2.5-4-2.5-2z"/>',
  pizza: '<path d="M12 3 3.5 19a18 18 0 0 0 17 0z"/><path d="M5.5 15a16 16 0 0 0 13 0"/><circle cx="11" cy="11" r=".8" fill="currentColor"/><circle cx="13.5" cy="15.5" r=".8" fill="currentColor"/>',
  baby: '<circle cx="12" cy="10" r="6"/><path d="M10 10h.01M14 10h.01M10.5 13a2 2 0 0 0 3 0M8 20.5a5 5 0 0 1 8 0M12 4c0-1 1-1.5 1.5-1"/>',
  logout: '<path d="M15 17l5-5-5-5M20 12H9"/><path d="M12 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/>',
  pin: '<path d="M12 21.5s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="9.5" r="2.5"/>',
  save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v5h7M8 21v-7h8v7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M3 7.5 12 12l9-4.5M12 12v9"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5h.01"/>',
  bolt: '<path d="M13 2.5 4.5 13.5H11L10 21.5l8.5-11H12z"/>',
  plug: '<path d="M9 2.5v5M15 2.5v5M6 7.5h12v3a6 6 0 0 1-12 0zM12 16.5v5"/>',
  brush: '<path d="M14.5 4.5l5 5L11 18l-5-5z"/><path d="M6 13c-2 0-3 1.5-3 3.5S2 21 2 21s3.5 0 5-1 2.5-2 2-4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
  walls: '<path d="M3 20V9l9-5 9 5v11"/><path d="M3 13h18M9 13v7M15 13v7"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
};

export function icon(name, cls = '') {
  const body = P[name] || P.info;
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

// Imagen de un icono para dibujar dentro del canvas
const cache = new Map();
export function iconImage(name, color = '#1f2a44', strokeW = 2.2) {
  const key = name + color + strokeW;
  if (cache.has(key)) return cache.get(key);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round" stroke-linejoin="round">${(P[name] || P.info).replaceAll('currentColor', color)}</svg>`;
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  cache.set(key, img);
  return img;
}
export const ICON_NAMES = Object.keys(P);

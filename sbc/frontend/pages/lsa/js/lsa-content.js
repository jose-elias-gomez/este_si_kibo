/**
 * Contenido de ejemplo para la demo de UI.
 *
 * IMPORTANTE: las formas de mano de este archivo son ilustraciones
 * ESQUEMÁTICAS simplificadas para poder maquetar la interfaz — no están
 * verificadas con una referencia lingüística de LSA. Antes de usar esta
 * app para enseñar, reemplazá `hand` y `note` de cada seña con material
 * validado (foto/video de una referente sorda o fuente oficial de LSA).
 *
 * hand.fingers = [pulgar, índice, mayor, anular, meñique] (true = extendido)
 * hand.style   = 'default' | 'circle'
 * hand.color   = color de la palma (opcional, usado en "Colores")
 */

const openHand = { fingers: [true, true, true, true, true] };
const point = { fingers: [false, true, false, false, false] };

export const CATEGORIES = [
  {
    id: "alfabeto",
    label: "Alfabeto",
    icon: "🅰️",
    accent: "sky",
    meta: "8 letras",
    items: [
      { word: "A", hand: { fingers: [false, false, false, false, false] }, note: "Puño cerrado, pulgar apoyado al costado." },
      { word: "B", hand: { fingers: [false, true, true, true, true] }, note: "Mano plana, dedos juntos, pulgar cruzado en la palma." },
      { word: "V", hand: { fingers: [false, true, true, false, false] }, note: "Índice y mayor extendidos, separados en V." },
      { word: "L", hand: { fingers: [true, true, false, false, false] }, note: "Pulgar e índice extendidos formando una L." },
      { word: "Y", hand: { fingers: [true, false, false, false, true] }, note: "Pulgar y meñique extendidos, resto cerrado." },
      { word: "I", hand: { fingers: [false, false, false, false, true] }, note: "Sólo el meñique extendido." },
      { word: "U", hand: { fingers: [false, true, true, false, false] }, note: "Índice y mayor juntos y extendidos hacia arriba." },
      { word: "O", hand: { style: "circle" }, note: "Dedos curvados formando un círculo con el pulgar." },
    ],
  },
  {
    id: "numeros",
    label: "Números",
    icon: "🔢",
    accent: "sun",
    meta: "0 a 5",
    items: [
      { word: "0", hand: { style: "circle" }, note: "Forma de O con todos los dedos." },
      { word: "1", hand: point, note: "Índice extendido, resto cerrado." },
      { word: "2", hand: { fingers: [false, true, true, false, false] }, note: "Índice y mayor extendidos." },
      { word: "3", hand: { fingers: [true, true, true, false, false] }, note: "Pulgar, índice y mayor extendidos." },
      { word: "4", hand: { fingers: [false, true, true, true, true] }, note: "Cuatro dedos extendidos, pulgar cerrado." },
      { word: "5", hand: openHand, note: "Los cinco dedos extendidos y separados." },
    ],
  },
  {
    id: "saludos",
    label: "Saludos",
    icon: "👋",
    accent: "sky",
    meta: "5 señas",
    items: [
      { word: "Hola", hand: openHand, note: "Mano abierta cerca de la cabeza, se mueve de lado a lado." },
      { word: "Gracias", hand: openHand, note: "Mano abierta toca el mentón y se desplaza hacia adelante." },
      { word: "Por favor", hand: openHand, note: "Mano abierta sobre el pecho, movimiento circular suave." },
      { word: "Buenos días", hand: openHand, note: "El antebrazo sube, como el sol al amanecer." },
      { word: "Chau", hand: openHand, note: "Mano abierta que se agita suavemente, como despedida." },
    ],
  },
  {
    id: "colores",
    label: "Colores",
    icon: "🎨",
    accent: "sun",
    meta: "5 señas",
    items: [
      { word: "Rojo", hand: { ...point, color: "var(--color-error)" }, note: "El índice roza los labios, referencia al color." },
      { word: "Azul", hand: { ...point, color: "var(--color-accent-sky)" }, note: "Se señala o deletrea sobre un objeto azul de referencia." },
      { word: "Verde", hand: { ...point, color: "var(--color-success)" }, note: "Se señala un objeto verde de referencia." },
      { word: "Amarillo", hand: { ...point, color: "var(--color-accent-sun)" }, note: "Se señala un objeto amarillo de referencia." },
      { word: "Blanco", hand: { ...point, color: "#FFFFFF" }, note: "Se señala un objeto blanco de referencia." },
    ],
  },
  {
    id: "familia",
    label: "Familia",
    icon: "👪",
    accent: "sky",
    meta: "4 señas",
    items: [
      { word: "Mamá", hand: openHand, note: "El pulgar toca el mentón." },
      { word: "Papá", hand: openHand, note: "El pulgar toca la frente." },
      { word: "Hermano/a", hand: point, note: "Los índices se tocan, indicando igualdad." },
      { word: "Familia", hand: openHand, note: "Ambas manos en forma de C giran formando un círculo." },
    ],
  },
];

export function allItems() {
  const all = [];
  for (const category of CATEGORIES) {
    for (const item of category.items) {
      all.push({ ...item, category: category.label });
    }
  }
  return all;
}

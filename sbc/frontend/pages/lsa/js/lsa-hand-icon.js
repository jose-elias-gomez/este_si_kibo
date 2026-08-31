/**
 * Genera un ícono de mano estilizado a partir de un estado de dedos.
 * No busca precisión anatómica: es un recurso visual liviano y
 * consistente con el sistema de diseño (usa currentColor / variables CSS).
 */
const FINGER_DEFS = [
  { x: 30, angle: -26, len: 32 }, // pulgar
  { x: 44, angle: -6, len: 46 },  // índice
  { x: 60, angle: 0, len: 52 },   // mayor
  { x: 76, angle: 6, len: 46 },   // anular
  { x: 90, angle: 24, len: 34 },  // meñique
];

export function handIconSVG(hand = {}) {
  const color = hand.color || "var(--color-enabled)";

  if (hand.style === "circle") {
    return `
      <svg viewBox="0 0 120 140" class="hand-illustration" role="img" aria-label="seña con forma de círculo">
        <ellipse cx="60" cy="98" rx="32" ry="28" fill="${color}" opacity="0.18"/>
        <circle cx="60" cy="66" r="24" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round"/>
        <rect x="44" y="94" width="32" height="36" rx="16" fill="${color}"/>
      </svg>
    `;
  }

  const fingers = hand.fingers || [false, false, false, false, false];

  const fingerMarkup = FINGER_DEFS.map((f, i) => {
    if (fingers[i]) {
      return `<rect x="${f.x - 6}" y="${62 - f.len}" width="12" height="${f.len}" rx="6"
        fill="${color}" transform="rotate(${f.angle} ${f.x} 62)"/>`;
    }
    return `<circle cx="${f.x}" cy="56" r="9" fill="${color}" opacity="0.5"/>`;
  }).join("");

  return `
    <svg viewBox="0 0 120 140" class="hand-illustration" role="img" aria-label="seña con mano estilizada">
      <rect x="22" y="58" width="76" height="68" rx="28" fill="${color}"/>
      ${fingerMarkup}
    </svg>
  `;
}

import {
  input,
  InputAction
} from "../../../shared/js/inputController.js";

"use strict";

/* ============================================================
   ICONOS
============================================================ */

const ICONS = {
  volume2: `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
    >
      <path fill="none" stroke="none" d="M0 0h24v24H0z"/>
      <path d="M15 8a5 5 0 0 1 0 8m2.7-11a9 9 0 0 1 0 14M6 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2l3.5-4.5A.8.8 0 0 1 11 5v14a.8.8 0 0 1-1.5.5z"/>
    </svg>
  `,

  sun: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2"/>
      <path d="M12 20v2"/>
      <path d="m4.93 4.93 1.41 1.41"/>
      <path d="m17.66 17.66 1.41 1.41"/>
      <path d="M2 12h2"/>
      <path d="M20 12h2"/>
      <path d="m6.34 17.66-1.41 1.41"/>
      <path d="m19.07 4.93-1.41 1.41"/>
    </svg>
  `,

  wifi: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#fff"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
    >
      <path fill="none" stroke="none" d="M0 0h24v24H0z"/>
      <path d="M12 18h.01m-2.838-2.828a4 4 0 0 1 5.656 0m-8.485-2.829a8 8 0 0 1 11.314 0"/>
      <path d="M3.515 9.515c4.686-4.687 12.284-4.687 17 0"/>
    </svg>
  `,

  power: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
    >
      <path fill="none" stroke="none" d="M0 0h24v24H0z"/>
      <path d="M7 6a7.75 7.75 0 1 0 10 0m-5-2v8"/>
    </svg>
  `,

  restart: `
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      stroke-width="2"
    >
      <path fill="none" stroke="none" d="M0 0h24v24H0z"/>
      <path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/>
    </svg>
  `
};

/* ============================================================
   APLICACIONES
============================================================ */

const APPS = [
  {
    id: "games",
    title: "Juegos",
    bg: "#132d4d",
    glow: "rgba(19,45,77,0.45)",
    cover: "assets/apps/games.png"
  },
  {
    id: "movement",
    title: "Movimiento",
    bg: "#3ad0c9",
    glow: "rgba(58,208,201,0.45)",
    cover: "assets/apps/motion.png"
  },
  {
    id: "translator",
    title: "Traducción",
    bg: "#c47a3a",
    glow: "rgba(196,122,58,0.45)",
    cover: "assets/apps/translator.jpg"
  },
  {
    id: "assistant",
    title: "Asistente",
    bg: "#8fa3ba",
    glow: "rgba(143,163,186,0.45)",
    cover: "assets/apps/chat.png"
  },
  {
    id: "camera",
    title: "Cámara",
    bg: "#66a8dd",
    glow: "rgba(102,168,221,0.45)",
    cover: "assets/apps/camera.png"
  }
];

/* ============================================================
   OPCIONES DEL SISTEMA
============================================================ */

const SYSTEM = [
  {
    id: "volume",
    title: "Sonido",
    bg: "#9b59b6",
    glow: "rgba(155,89,182,0.5)",
    iconKey: "volume2"
  },
  {
    id: "brightness",
    title: "Brillo",
    bg: "#e0902b",
    glow: "rgba(224,144,43,0.5)",
    iconKey: "sun"
  },
  {
    id: "wifi",
    title: "WiFi",
    bg: "#16a085",
    glow: "rgba(22,160,133,0.5)",
    iconKey: "wifi"
  },
  {
    id: "power",
    title: "Apagado",
    bg: "#c43a3a",
    glow: "rgba(196,58,58,0.5)",
    iconKey: "power"
  }
];

/* ============================================================
   ESTADO
============================================================ */

let mode = "apps";
let index = 0;
let scrollAnimationFrame = null;

/* ============================================================
   ELEMENTOS DOM
============================================================ */

const scrollContainer = document.getElementById("scrollContainer");
const itemsTrack = document.getElementById("itemsTrack");
const dotsEl = document.getElementById("dots");
const btnUp = document.getElementById("btnUp");
const btnDown = document.getElementById("btnDown");
const consoleEl = document.getElementById("console");

/* ============================================================
   HELPERS
============================================================ */

function currentItems() {
  return mode === "apps" ? APPS : SYSTEM;
}

function cancelScrollAnimation() {
  if (scrollAnimationFrame !== null) {
    cancelAnimationFrame(scrollAnimationFrame);
    scrollAnimationFrame = null;
  }
}

/* ============================================================
   NAVEGACIÓN / ROUTING
============================================================ */

function openItem(id) {
  window.location.href =
    `/sbc/frontend/pages/${id}/${id}.html`;
}

function openOption(id) {
  const component = document.getElementById(`${id}-menu`);

  if (!component) {
    console.error(`[HOME] No se encontró ${id}-menu`);
    return;
  }

  component.open();
}

/* ============================================================
   ALTURA DISPONIBLE
============================================================ */

function availableSliderHeight() {
  if (!consoleEl) {
    return window.innerHeight;
  }

  const topbar = document.querySelector(".topbar");
  const footer = document.querySelector(".footer");
  const arrowRows = document.querySelectorAll(".arrow-row");

  let reserved = 0;

  if (topbar) {
    reserved += topbar.offsetHeight;
  }

  if (footer) {
    reserved += footer.offsetHeight;
  }

  for (const row of arrowRows) {
    reserved += row.offsetHeight;
  }

  const sliderPadding = 64;
  const safetyMargin = 16;

  return Math.max(
    0,
    consoleEl.clientHeight -
      reserved -
      sliderPadding -
      safetyMargin
  );
}

/* ============================================================
   TAMAÑOS
============================================================ */

function largeSize() {
  const maxByHeight =
    availableSliderHeight() * 0.8;

  return Math.min(
    500,
    window.innerWidth * 0.3,
    maxByHeight
  );
}

function smallSize() {
  return Math.min(
    300,
    window.innerWidth * 0.3,
    availableSliderHeight() * 0.8 * 0.7
  );
}

/* ============================================================
   ESTILOS DE CARD
============================================================ */

function applyCardStyle(card, item, focused, large, small) {
  card.style.width = `${focused ? large : small}px`;
  card.style.opacity = focused ? "1" : "0.68";

  card.style.boxShadow = focused
    ? `
      0 20px 45px -12px ${item.glow},
      0 6px 16px rgba(0,0,0,0.18)
    `
    : "0 6px 16px rgba(0,0,0,0.14)";
}

/* ============================================================
   CREAR CARD
============================================================ */

function createCard(item, focused, large, small) {
  const wrapper = document.createElement("div");
  wrapper.className = "item";

  if (focused) {
    wrapper.classList.add("is-focused");
  }

  const button = document.createElement("button");
  button.className = "item-btn";
  button.setAttribute("aria-label", item.title);

  const card = document.createElement("div");
  card.className = "card";
  card.style.backgroundColor = item.bg;

  applyCardStyle(
    card,
    item,
    focused,
    large,
    small
  );

  /* Imagen */

  if (item.cover) {
    const img = document.createElement("img");

    img.className = "cover";
    img.src = item.cover;
    img.alt = "";

    card.appendChild(img);
  }

  /* Icono */

  else if (item.icon) {
    const img = document.createElement("img");

    img.className = "icon-inner";
    img.src = item.icon;
    img.alt = "";

    card.appendChild(img);
  }

  /* SVG */

  else if (item.iconKey && ICONS[item.iconKey]) {
    const icon = document.createElement("span");

    icon.className = "icon-inner";
    icon.innerHTML = ICONS[item.iconKey];

    card.appendChild(icon);
  }

  button.appendChild(card);

  /* Título */

  const title = document.createElement("span");

  title.className = "item-title";
  title.textContent = item.title;

  wrapper.appendChild(button);
  wrapper.appendChild(title);

  return wrapper;
}

/* ============================================================
   RENDER ITEMS
============================================================ */

function renderItems() {
  cancelScrollAnimation();

  const items = currentItems();
  const large = largeSize();
  const small = smallSize();

  const fragment = document.createDocumentFragment();

  items.forEach((item, i) => {
    const wrapper = createCard(
      item,
      i === index,
      large,
      small
    );

    wrapper.dataset.index = i;

    fragment.appendChild(wrapper);
  });

  itemsTrack.replaceChildren(fragment);

  renderDots();

  scrollToFocused({
    instant: true
  });
}

/* ============================================================
   ACTUALIZAR FOCO
============================================================ */

function updateFocusStyles() {
  const wrappers =
    itemsTrack.querySelectorAll(".item");

  const items = currentItems();
  const large = largeSize();
  const small = smallSize();

  wrappers.forEach((wrapper, i) => {
    const focused = i === index;
    const card = wrapper.querySelector(".card");

    if (!card) {
      return;
    }

    wrapper.classList.toggle(
      "is-focused",
      focused
    );

    applyCardStyle(
      card,
      items[i],
      focused,
      large,
      small
    );
  });

  /*
   * Esperamos a que el navegador actualice
   * el layout antes de calcular la posición.
   */
  requestAnimationFrame(() => {
    scrollToFocused();
  });
}

/* ============================================================
   ANIMACIÓN DEL SCROLL
============================================================ */

function animateScrollTo(target) {
  cancelScrollAnimation();

  const start = scrollContainer.scrollLeft;
  const distance = target - start;

  if (Math.abs(distance) < 1) {
    scrollContainer.scrollLeft = target;
    return;
  }

  const duration = 450;
  const startTime = performance.now();

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animate(currentTime) {
    const progress = Math.min(
      (currentTime - startTime) / duration,
      1
    );

    const eased = easeOutCubic(progress);

    scrollContainer.scrollLeft =
      start + distance * eased;

    if (progress < 1) {
      scrollAnimationFrame =
        requestAnimationFrame(animate);
      return;
    }

    scrollAnimationFrame = null;
    scrollContainer.scrollLeft = target;
  }

  scrollAnimationFrame =
    requestAnimationFrame(animate);
}

/* ============================================================
   CENTRAR CARD
============================================================ */

function getFocusedTarget() {
  const focused =
    itemsTrack.querySelector(
      `.item[data-index="${index}"]`
    );

  if (!focused) {
    return 0;
  }

  /*
   * Usamos la posición real del elemento.
   * Esto evita depender de fórmulas manuales
   * para calcular gaps y tamaños.
   */

  const containerRect =
    scrollContainer.getBoundingClientRect();

  const cardRect =
    focused.getBoundingClientRect();

  const cardCenter =
    cardRect.left +
    cardRect.width / 2;

  const containerCenter =
    containerRect.left +
    containerRect.width / 2;

  const delta =
    cardCenter - containerCenter;

  return Math.max(
    0,
    scrollContainer.scrollLeft + delta
  );
}

function scrollToFocused({ instant = false } = {}) {
  if (!scrollContainer || !itemsTrack) return;

  const focusedItem = itemsTrack.querySelector(
    `.item[data-index="${index}"]`
  );

  if (!focusedItem) return;

  const card = focusedItem.querySelector(".card");

  if (!card) return;

  // Centro de la card respecto al documento del scroll
  const cardCenter =
    focusedItem.offsetLeft +
    card.offsetLeft +
    card.offsetWidth / 2;

  // Centro visible del slider
  const containerCenter =
    scrollContainer.clientWidth / 2;

  // Posición necesaria para que ambos centros coincidan
  const target =
    cardCenter - containerCenter;

  const finalTarget = Math.max(0, target);

  if (instant) {
    if (scrollAnimationFrame !== null) {
      cancelAnimationFrame(scrollAnimationFrame);
      scrollAnimationFrame = null;
    }

    scrollContainer.scrollLeft = finalTarget;
    return;
  }

  animateScrollTo(finalTarget);
}

/* ============================================================
   NAVEGACIÓN
============================================================ */

function navigate(next) {
  const items = currentItems();

  const newIndex = Math.max(
    0,
    Math.min(
      next,
      items.length - 1
    )
  );

  if (newIndex === index) {
    return;
  }

  index = newIndex;

  updateFocusStyles();
  renderDots();
}

/* ============================================================
   CAMBIO DE MODO
============================================================ */

function goToApps() {
  mode = "apps";
  index = 0;

  btnUp.hidden = true;
  btnDown.hidden = false;

  renderItems();
}

function goToSystem() {
  mode = "system";
  index = 0;

  btnUp.hidden = false;
  btnDown.hidden = true;

  renderItems();
}

/* ============================================================
   DOTS
============================================================ */

function renderDots() {
  dotsEl.replaceChildren();

  const fragment =
    document.createDocumentFragment();

  currentItems().forEach((_, i) => {
    const dot = document.createElement("span");

    dot.className = "dot";

    if (i === index) {
      dot.classList.add("active");
    }

    fragment.appendChild(dot);
  });

  dotsEl.appendChild(fragment);
}

/* ============================================================
   INPUT CONTROLLER
============================================================ */

input.on(
  InputAction.RIGHT,
  () => navigate(index + 1)
);

input.on(
  InputAction.LEFT,
  () => navigate(index - 1)
);

input.on(
  InputAction.DOWN,
  () => {
    if (mode === "apps") {
      goToSystem();
    }
  }
);

input.on(
  InputAction.UP,
  () => {
    if (mode === "system") {
      goToApps();
    }
  }
);

input.on(
  InputAction.CONFIRM,
  () => {
    const item = currentItems()[index];

    if (!item) {
      return;
    }

    if (mode === "apps") {
      openItem(item.id);
    } else {
      openOption(item.id);
    }
  }
);

/* ============================================================
   RESIZE
============================================================ */

let resizeFrame = null;

window.addEventListener("resize", () => {
  if (resizeFrame !== null) {
    cancelAnimationFrame(resizeFrame);
  }

  resizeFrame = requestAnimationFrame(() => {
    resizeFrame = null;

    updateFocusStyles();
  });
});

/* ============================================================
   INICIO
============================================================ */

btnUp.hidden = true;
btnDown.hidden = false;

document.body.classList.add("no-transitions");

renderItems();

/*
 * Esperamos dos frames para asegurarnos
 * de que el primer render ya terminó.
 */

requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.remove(
      "no-transitions"
    );
  });
});
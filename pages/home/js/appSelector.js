import { InputAction, input } from "../../../shared/js/inputController.js";

const APPS = [
  {
    name: "Camara",
    image: "assets/apps/camera.png",
    goto: "http://example.com",
  },
  {
    name: "Chat",
    image: "assets/apps/chat.png",
    goto: "https://example.com",
  },
  {
    name: "Juegos",
    image: "assets/apps/games.png",
    goto: "https://example.com",
  },
  {
    name: "Control",
    image: "assets/apps/motion.png",
    goto: "../movement/movement.html",
  },
  {
    name: "Traductor",
    image: "assets/apps/translator.png",
    goto: "https://example.com",
  },
];

function createCard(app) {
  var card = document.createElement("div");
  card.className = "card";
  card.dataset.name = app.name;
  card.dataset.image = app.image;
  card.dataset.goto = app.goto;

  var img = document.createElement("img");
  img.src = app.image;
  img.alt = app.name;

  card.appendChild(img);
  return card;
}

var group = document.querySelector(".app-selector .group");

const headerLayers = {
  a: document.querySelector("header .layer-a"),
  b: document.querySelector("header .layer-b"),
};
var headerActiveLayer = "a";

// Crossfade genérico: alterna entre dos bg-layer, seteando la imagen
// en la capa oculta y togueleando .visible para disparar la transición.
function crossfade(layers, activeKey, imageUrl) {
  var currentLayer = layers[activeKey];
  var nextKey = activeKey === "a" ? "b" : "a";
  var nextLayer = layers[nextKey];

  if (!nextLayer) return activeKey;

  nextLayer.style.backgroundImage = 'url("' + imageUrl + '")';
  // Forzamos reflow para asegurar que la transición de opacity se dispare
  void nextLayer.offsetWidth;

  nextLayer.classList.add("visible");
  if (currentLayer) {
    currentLayer.classList.remove("visible");
  }

  return nextKey;
}

APPS.forEach(function (app) {
  group.appendChild(createCard(app));
});

// Duplicamos las cartas dentro del mismo .group para asegurar
// que siempre haya suficientes tarjetas visibles para llenar la pantalla.
var originalCards = Array.from(group.querySelectorAll(".card"));

originalCards.forEach(function (card) {
  var clone = card.cloneNode(true);
  clone.setAttribute("aria-hidden", "true");
  group.appendChild(clone);
});

// 2. Panel izquierdo: muestra la imagen + nombre de la app que está
// al frente del carrusel (siempre group.firstElementChild). Como los
// clones tienen el mismo dataset que su original (cloneNode copia
// atributos), no importa si el "frente" es un original o un clon.
var leftPanelLayers = {
  a: document.querySelector(".left-panel .layer-a"),
  b: document.querySelector(".left-panel .layer-b"),
};
var leftPanelActiveLayer = "a"; // capa actualmente visible
var leftPanelTitle = document.querySelector(".left-panel strong");

function updateSelectedApp() {
  var front = group.lastElementChild;
  if (!front) return;

  leftPanelActiveLayer = crossfade(
    leftPanelLayers,
    leftPanelActiveLayer,
    front.dataset.image,
  );
  headerActiveLayer = crossfade(
    headerLayers,
    headerActiveLayer,
    front.dataset.image,
  );

  if (leftPanelTitle) {
    leftPanelTitle.textContent = front.dataset.name;
  }
}

updateSelectedApp();

var TRANSITION_MS = 300;
var TRANSITION_CSS =
  "transform " + TRANSITION_MS + "ms cubic-bezier(0.25, 1, 0.5, 1)";
var SAFETY_MARGIN_MS = 100; // colchón por si transitionend no llega a disparar

var isAnimating = false;
var activeDir = null; // 'left' | 'right' | null
var pendingDirection = null; // cola de 1 input para repetir la MISMA dirección
var currentFinish = null; // deja el DOM/transform en el estado final de ESTE paso
var currentCleanup = null; // saca el listener y el timeout de seguridad
var safetyTimeoutId = null;

// Obtener la distancia exacta a desplazar (Ancho de Card + Gap)
function getStepWidth() {
  var card = group.querySelector(".card");
  if (!card) return 0;

  var cardWidth = card.getBoundingClientRect().width;
  var style = window.getComputedStyle(group);
  var gap = parseFloat(style.gap) || 0;

  return cardWidth + gap;
}

function arm() {
  function handleTransitionEnd(e) {
    if (e.target !== group || e.propertyName !== "transform") return;
    settle();
  }

  group.addEventListener("transitionend", handleTransitionEnd);
  safetyTimeoutId = setTimeout(settle, TRANSITION_MS + SAFETY_MARGIN_MS);

  currentCleanup = function () {
    group.removeEventListener("transitionend", handleTransitionEnd);
    clearTimeout(safetyTimeoutId);
  };
}

// Se llama cuando el paso termina de forma natural (transitionend o fallback)
function settle() {
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  if (currentFinish) {
    currentFinish();
    currentFinish = null;
  }

  isAnimating = false;
  activeDir = null;

  updateSelectedApp();

  if (pendingDirection) {
    var dir = pendingDirection;
    pendingDirection = null;
    go(dir);
  }
}

// Corta el paso en curso YA (sin esperar) y lo deja en un estado final
// consistente, para poder arrancar el paso contrario de inmediato.
function forceFinishCurrent() {
  if (!isAnimating) return;
  if (currentCleanup) {
    currentCleanup();
    currentCleanup = null;
  }
  if (currentFinish) {
    currentFinish();
    currentFinish = null;
  }

  isAnimating = false;
  activeDir = null;
  pendingDirection = null; // el nuevo input del usuario tiene prioridad
}

function startRight() {
  var step = getStepWidth();
  if (step === 0) return;

  isAnimating = true;
  activeDir = "right";

  group.style.transition = TRANSITION_CSS;
  group.style.transform = "translateX(-" + step + "px)";

  currentFinish = function () {
    // Pasamos la primera tarjeta al final dentro de .group
    group.appendChild(group.firstElementChild);
    group.style.transition = "none";
    group.style.transform = "translateX(0)";
    void group.offsetHeight;
  };

  arm();
}

function startLeft() {
  var step = getStepWidth();
  if (step === 0) return;

  isAnimating = true;
  activeDir = "left";

  group.style.transition = "none";
  group.insertBefore(group.lastElementChild, group.firstElementChild);
  group.style.transform = "translateX(-" + step + "px)";
  void group.offsetHeight; // forzar reflow para registrar el cambio de posición

  group.style.transition = TRANSITION_CSS;
  group.style.transform = "translateX(0)";

  currentFinish = function () {
    group.style.transition = "none";
    group.style.transform = "translateX(0)";
    void group.offsetHeight;
  };

  arm();
}

function go(dir) {
  if (isAnimating) {
    if (dir === activeDir) {
      // Misma dirección: encolamos, sigue de largo apenas termine este paso
      pendingDirection = dir;
    } else {
      // Dirección contraria: cerramos YA este paso (sin esperar) y
      // arrancamos el nuevo en el sentido pedido.
      forceFinishCurrent();
      go(dir);
    }
    return;
  }

  if (dir === "right") startRight();
  else startLeft();
}

// Controles
input.on(InputAction.RIGHT, () => go("right"));
input.on(InputAction.LEFT, () => go("left"));

input.on(InputAction.CONFIRM, () => {
  const selectedCard = group.lastElementChild;

  if (!selectedCard) return;

  window.location.href = selectedCard.dataset.goto
});
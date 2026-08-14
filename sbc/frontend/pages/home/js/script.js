import { input, InputAction } from "../../../shared/js/inputController.js";

const ICONS = {
  volume2: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-volume" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M15 8a5 5 0 0 1 0 8m2.7-11a9 9 0 0 1 0 14M6 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2l3.5-4.5A.8.8 0 0 1 11 5v14a.8.8 0 0 1-1.5.5z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  wifi: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-wifi" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 18h.01m-2.838-2.828a4 4 0 0 1 5.656 0m-8.485-2.829a8 8 0 0 1 11.314 0"/><path d="M3.515 9.515c4.686-4.687 12.284-4.687 17 0"/></svg>`,
  power: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-power" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M7 6a7.75 7.75 0 1 0 10 0m-5-2v8"/></svg>`,
  restart: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-refresh" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>`,
}

const APPS = [
  { id: "games", title: "Juegos", bg: "#132d4d", glow: "rgba(19,45,77,0.45)", cover: "assets/apps/games.png", icon: null },
  { id: "movement", title: "Movimiento", bg: "#3ad0c9", glow: "rgba(58,208,201,0.45)", cover: "assets/apps/motion.png", icon: null },
  { id: "translator", title: "Traducción", bg: "#c47a3a", glow: "rgba(196,122,58,0.45)", cover: "assets/apps/translator.jpg", icon: null },
  { id: "chat", title: "Chat", bg: "#8fa3ba", glow: "rgba(143,163,186,0.45)", cover: "assets/apps/chat.png", icon: null },
  { id: "camera", title: "Cámara", bg: "#66a8dd", glow: "rgba(102,168,221,0.45)", cover: "assets/apps/camera.png", icon: null },
]

const SYSTEM = [
  { id: "volume", title: "Sonido", bg: "#9b59b6", glow: "rgba(155,89,182,0.5)", iconKey: "volume2" },
  { id: "brightness", title: "Brillo", bg: "#e0902b", glow: "rgba(224,144,43,0.5)", iconKey: "sun" },
  { id: "wifi", title: "WiFi", bg: "#16a085", glow: "rgba(22,160,133,0.5)", iconKey: "wifi" },
  { id: "power", title: "Apagado", bg: "#c43a3a", glow: "rgba(196,58,58,0.5)", iconKey: "power" },
]

let mode = "apps" // "apps" | "system"
let index = 0

const scrollContainer = document.getElementById("scrollContainer")
const itemsTrack = document.getElementById("itemsTrack")
const dotsEl = document.getElementById("dots")
const btnUp = document.getElementById("btnUp")
const btnDown = document.getElementById("btnDown")

function currentItems() {
  return mode === "apps" ? APPS : SYSTEM
}

// ============================================================
// Acción al "abrir" un ítem (equivalente a router.push(`/${id}`))
// Personalizar según tu enrutamiento real.
// ============================================================
function openItem(id) {
  window.location.href = `/pages/${id}/${id}.html`
}

function openOption(id) {
  id = id + "-menu";
  var popupComponent = document.getElementById(id);
  if (popupComponent === null) {
    console.error("Can't found popup option for " + id);
    return;
  }
  popupComponent.open();
}

// ============================================================
// Render de las tarjetas del modo actual
// ============================================================
function renderItems() {
  itemsTrack.innerHTML = ""
  const items = currentItems()

  items.forEach((item, i) => {
    const wrapper = document.createElement("div")
    wrapper.className = "item"
    wrapper.dataset.index = i

    const btn = document.createElement("button")
    btn.className = "item-btn"
    btn.setAttribute("aria-label", item.title)

    const isFocused = i === index
    const large = largeSize()
    const small = smallSize()

    const card = document.createElement("div")
    card.className = "card"
    card.style.backgroundColor = item.bg
    card.style.width = isFocused ? `${large}px` : `${small}px`
    card.style.opacity = isFocused ? "1" : "0.68"
    card.style.boxShadow = isFocused
      ? `0 20px 45px -12px ${item.glow}, 0 6px 16px rgba(0,0,0,0.18)`
      : "0 6px 16px rgba(0,0,0,0.14)"

    if (isFocused) wrapper.classList.add("is-focused")

    if (item.cover) {
      const img = document.createElement("img")
      img.className = "cover"
      img.src = item.cover
      img.alt = ""
      card.appendChild(img)
    } else if (item.icon) {
      const img = document.createElement("img")
      img.className = "icon-inner"
      img.src = item.icon
      img.alt = ""
      card.appendChild(img)
    } else if (item.iconKey && ICONS[item.iconKey]) {
      const iconWrap = document.createElement("span")
      iconWrap.className = "icon-inner"
      iconWrap.innerHTML = ICONS[item.iconKey]
      card.appendChild(iconWrap)
    }

    btn.appendChild(card)

    const title = document.createElement("span")
    title.className = "item-title"
    title.textContent = item.title

    wrapper.appendChild(btn)
    wrapper.appendChild(title)
    itemsTrack.appendChild(wrapper)
  })

  // Los estilos de foco ya se aplicaron al crear cada card (arriba),
  // así que aquí solo posicionamos el scroll — sin animación en la carga/cambio de modo.
  scrollToFocused(largeSize(), smallSize(), { instant: true })
  renderDots()
}

// ============================================================
// Alto real disponible para el slider.
//
// Antes, largeSize()/smallSize() usaban una fracción fija de
// window.innerHeight (0.5 / 0.35) como si el slider tuviera todo
// el alto de la pantalla disponible. Pero el slider comparte esa
// altura con el topbar, las dos arrow-row y el footer, y como
// .console tiene overflow:hidden, cualquier carta que termine más
// alta que el espacio real que le queda se recorta (justo el bug
// en 800x480, donde hay poco alto para repartir).
//
// Acá medimos el alto real disponible (alto del .console menos lo
// que ocupan topbar + arrow-rows + footer + padding del slider),
// así el cálculo se ajusta solo a cualquier resolución en vez de
// depender de un porcentaje adivinado.
// ============================================================
function availableSliderHeight() {
  const consoleEl = document.getElementById("console")
  if (!consoleEl) return window.innerHeight

  const topbar = document.querySelector(".topbar")
  const footer = document.querySelector(".footer")
  const arrowRows = document.querySelectorAll(".arrow-row")

  let reserved = 0
  if (topbar) reserved += topbar.offsetHeight
  if (footer) reserved += footer.offsetHeight
  arrowRows.forEach((row) => (reserved += row.offsetHeight))

  // Padding vertical del scroll-container (16px arriba + 16px abajo)
  // + un margen de seguridad para que el glow/box-shadow de la carta
  // enfocada tampoco quede pegado al borde.
  const sliderPadding = 64
  const safetyMargin = 16

  return Math.max(0, consoleEl.clientHeight - reserved - sliderPadding - safetyMargin)
}

// ============================================================
// Tamaños de tarjeta. El ancho se deriva del alto disponible
// usando el aspect-ratio 4:5 de .card (width = height * 4/5),
// para garantizar que la carta enfocada siempre entre sin cortarse.
// ============================================================
function largeSize() {
  const maxByHeight = availableSliderHeight() * (4 / 5)
  return Math.min(500, window.innerWidth * 0.3, maxByHeight)
}
function smallSize() {
  const maxByHeight = availableSliderHeight() * (4 / 5) * 0.7
  return Math.min(300, window.innerWidth * 0.3, maxByHeight)
}
// ============================================================
// Aplica estilos de foco/desenfoque a cada tarjeta
// ============================================================
function updateFocusStyles() {
  const wrappers = itemsTrack.querySelectorAll(".item")
  const large = largeSize()
  const small = smallSize()

  wrappers.forEach((wrapper, i) => {
    const isFocused = i === index
    const card = wrapper.querySelector(".card")
    const items = currentItems()
    const item = items[i]

    wrapper.classList.toggle("is-focused", isFocused)
    card.style.width = isFocused ? `${large}px` : `${small}px`
    card.style.opacity = isFocused ? "1" : "0.68"
    card.style.boxShadow = isFocused
      ? `0 20px 45px -12px ${item.glow}, 0 6px 16px rgba(0,0,0,0.18)`
      : "0 6px 16px rgba(0,0,0,0.14)"
  })

  scrollToFocused(large, small)
}

// ============================================================
// Centra la tarjeta enfocada (misma fórmula que el componente original)
// ============================================================
function scrollToFocused(large, small, { instant = false } = {}) {
  const spacerEl = scrollContainer.firstElementChild
  const spacer = spacerEl ? spacerEl.offsetWidth : window.innerWidth / 2
  const gap = 24

  const focusedCenter = spacer + gap * (index + 1) + small * index + large / 2
  const target = focusedCenter - scrollContainer.clientWidth / 2

  scrollContainer.scrollTo({ left: Math.max(0, target), behavior: instant ? "auto" : "smooth" })
}

// ============================================================
// Navegación
// ============================================================
function navigate(next) {
  const items = currentItems()
  next = Math.max(0, Math.min(next, items.length - 1))
  if (next === index) return
  index = next
  updateFocusStyles()
  renderDots()
}

function goToApps() {
  mode = "apps"
  index = 0
  btnUp.hidden = true
  btnDown.hidden = false
  renderItems()
}

function goToSystem() {
  mode = "system"
  index = 0
  btnUp.hidden = false
  btnDown.hidden = true
  renderItems()
}

// ============================================================
// Puntos de paginación (solo se muestran para el modo "apps")
// ============================================================
function renderDots() {
  dotsEl.innerHTML = ""
  const items = currentItems()
  items.forEach((_, d) => {
    const dot = document.createElement("span")
    dot.className = "dot"
    if (index === d) dot.classList.add("active")
    dotsEl.appendChild(dot)
  })
}

const brightness = document.getElementById("brightness");

input.on(InputAction.RIGHT, () => navigate(Math.min(index + 1, currentItems().length - 1)));
input.on(InputAction.LEFT, () => navigate(Math.max(index - 1, 0)));
input.on(InputAction.DOWN, () => {
  if (mode === "apps") {
    goToSystem();
  }
});
input.on(InputAction.UP, () => {
  if (mode === "system") {
    goToApps();
  }
});
input.on(InputAction.CONFIRM, () => {
  if (mode === "apps") {
    openItem(currentItems()[index].id);
    return;
  }
  openOption(currentItems()[index].id);
});

window.addEventListener("resize", () => updateFocusStyles())

btnUp.hidden = true

// Evita que la primera pintura anime (width/opacity/scroll) al cargar.
document.body.classList.add("no-transitions")
renderItems()
requestAnimationFrame(() => {
  requestAnimationFrame(() => {
    document.body.classList.remove("no-transitions")
  })
})
const ICONS = {
  volume2: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-volume" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M15 8a5 5 0 0 1 0 8m2.7-11a9 9 0 0 1 0 14M6 15H4a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h2l3.5-4.5A.8.8 0 0 1 11 5v14a.8.8 0 0 1-1.5.5z"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`,
  wifi: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="#fff" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-wifi" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M12 18h.01m-2.838-2.828a4 4 0 0 1 5.656 0m-8.485-2.829a8 8 0 0 1 11.314 0"/><path d="M3.515 9.515c4.686-4.687 12.284-4.687 17 0"/></svg>`,
  power: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-power" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M7 6a7.75 7.75 0 1 0 10 0m-5-2v8"/></svg>`,
  restart: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" class="icon icon-tabler icons-tabler-outline icon-tabler-refresh" viewBox="0 0 24 24"><path fill="none" stroke="none" d="M0 0h24v24H0z"/><path d="M20 11A8.1 8.1 0 0 0 4.5 9M4 5v4h4m-4 4a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>`,
}

// ============================================================
// Datos (equivalentes a APPS y SYSTEM del componente original)
// Reemplazar "icon"/"cover" por tus rutas reales, ej: "apps/juegos.svg"
// ============================================================
const APPS = [
  { id: "games", title: "Juegos", bg: "#132d4d", glow: "rgba(19,45,77,0.45)", cover: "assets/apps/games.png", icon: null },
  { id: "movement", title: "Movimiento", bg: "#3ad0c9", glow: "rgba(58,208,201,0.45)", cover: "assets/apps/motion.png", icon: null },
  { id: "camera", title: "Cámara", bg: "#66a8dd", glow: "rgba(102,168,221,0.45)", cover: "assets/apps/camera.png", icon: null },
  { id: "chat", title: "Chat", bg: "#8fa3ba", glow: "rgba(143,163,186,0.45)", cover: "assets/apps/chat.png", icon: null },
  { id: "translator", title: "Traducción", bg: "#c47a3a", glow: "rgba(196,122,58,0.45)", cover: "assets/apps/translator.png", icon: null },
]

const SYSTEM = [
  { id: "sonido", title: "Sonido", bg: "#9b59b6", glow: "rgba(155,89,182,0.5)", iconKey: "volume2" },
  { id: "brillo", title: "Brillo", bg: "#e0902b", glow: "rgba(224,144,43,0.5)", iconKey: "sun" },
  { id: "wifi", title: "WiFi", bg: "#16a085", glow: "rgba(22,160,133,0.5)", iconKey: "wifi" },
  { id: "apagado", title: "Apagado", bg: "#c43a3a", glow: "rgba(196,58,58,0.5)", iconKey: "power" },
  { id: "reinicio", title: "Reinicio", bg: "#2b7de9", glow: "rgba(43,125,233,0.5)", iconKey: "restart" },
]

// ============================================================
// Estado
// ============================================================
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

    const card = document.createElement("div")
    card.className = "card"
    card.style.backgroundColor = item.bg

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

  updateFocusStyles()
  renderDots()
}

// ============================================================
// Tamaños de tarjeta (equivalentes a min(430px,26vw,50vh) / min(270px,16vw,32vh))
// ============================================================
function largeSize() {
  return Math.min(500, window.innerWidth * 0.3, window.innerHeight * 0.5)
}
function smallSize() {
  return Math.min(300, window.innerWidth * 0.3, window.innerHeight * 0.35)
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
function scrollToFocused(large, small) {
  const spacerEl = scrollContainer.firstElementChild
  const spacer = spacerEl ? spacerEl.offsetWidth : window.innerWidth / 2
  const gap = 24

  const focusedCenter = spacer + gap * (index + 1) + small * index + large / 2
  const target = focusedCenter - scrollContainer.clientWidth / 2

  scrollContainer.scrollTo({ left: Math.max(0, target), behavior: "smooth" })
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

window.addEventListener("keydown", (e) => {
  const items = currentItems()
  if (e.key === "ArrowRight") {
    e.preventDefault()
    navigate(Math.min(index + 1, items.length - 1))
  }
  if (e.key === "ArrowLeft") {
    e.preventDefault()
    navigate(Math.max(index - 1, 0))
  }
  if (e.key === "ArrowDown" && mode === "apps") {
    e.preventDefault()
    goToSystem()
  }
  if (e.key === "ArrowUp" && mode === "system") {
    e.preventDefault()
    goToApps()
  }
  if (e.key === "Enter" || e.key === "x" || e.key === "X") {
    e.preventDefault()
    openItem(items[index].id)
  }
})

window.addEventListener("resize", () => updateFocusStyles())

// ============================================================
// Inicialización
// ============================================================
btnUp.hidden = true
renderItems()

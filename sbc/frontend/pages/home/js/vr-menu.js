import * as THREE from "three";

import { input, InputAction } from "../../../shared/js/inputController.js";

/* =========================================================
   CONFIG
   ========================================================= */

const APPS = [
    {
        id: "games",
        title: "Juegos",
        cover: "assets/apps/games.png",
        color: 0x132d4d,
    },

    {
        id: "movement",
        title: "Movimiento",
        cover: "assets/apps/motion.png",
        color: 0x3ad0c9,
    },

    {
        id: "translator",
        title: "Traducción",
        cover: "assets/apps/translator.jpg",
        color: 0xc47a3a,
    },

    {
        id: "assistant",
        title: "Asistente",
        cover: "assets/apps/chat.png",
        color: 0x8fa3ba,
    },

    {
        id: "camera",
        title: "Cámara",
        cover: "assets/apps/camera.png",
        color: 0x66a8dd,
    },

    {
        id: "music",
        title: "Música",
        cover: "assets/apps/music.png",
        color: 0x9c3a3a,
    },
];

/* =========================================================
   THREE
   ========================================================= */

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x020607);

/* Cámara */

const camera = new THREE.PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.01,
    100
);

camera.position.set(0, 1.6, 0);

/* Renderer */

const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: "high-performance",
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));

renderer.setSize(window.innerWidth, window.innerHeight);

renderer.xr.enabled = true;

document.body.appendChild(renderer.domElement);

/* =========================================================
   LUCES
   ========================================================= */

const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);

scene.add(ambientLight);

const pointLight = new THREE.PointLight(0x6ce7e7, 3, 8);

pointLight.position.set(0, 2, -2);

scene.add(pointLight);

/* =========================================================
   SUELO / AMBIENTE
   ========================================================= */

const grid = new THREE.GridHelper(20, 40, 0x17464a, 0x0a2225);

grid.position.y = 0;

scene.add(grid);

/* =========================================================
   KIBO CENTRAL
   ========================================================= */

const kiboGroup = new THREE.Group();

kiboGroup.position.set(0, 2.35, -3.8);

scene.add(kiboGroup);

/* Anillo */

const ringGeometry = new THREE.TorusGeometry(0.5, 0.025, 12, 64);

const ringMaterial = new THREE.MeshBasicMaterial({
    color: 0x6ce7e7,
    transparent: true,
    opacity: 0.75,
});

const ring = new THREE.Mesh(ringGeometry, ringMaterial);

kiboGroup.add(ring);

/* Núcleo */

const coreGeometry = new THREE.SphereGeometry(0.12, 16, 16);

const coreMaterial = new THREE.MeshBasicMaterial({
    color: 0x8ffff8,
});

const core = new THREE.Mesh(coreGeometry, coreMaterial);

kiboGroup.add(core);

/* Texto KIBO */

function createTextSprite(text) {
    const canvas = document.createElement("canvas");

    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.font = "600 54px Fredoka, Arial";

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillStyle = "rgba(255,255,255,0.9)";

    ctx.fillText(text, canvas.width / 2, canvas.height / 2);

    const texture = new THREE.CanvasTexture(canvas);

    const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
    });

    const sprite = new THREE.Sprite(material);

    sprite.scale.set(1.7, 0.42, 1);

    return sprite;
}

const kiboText = createTextSprite("K I B O");

kiboText.position.set(0, -0.7, 0);

kiboGroup.add(kiboText);

/* =========================================================
   TARJETAS
   ========================================================= */

const cards = [];

const textureLoader = new THREE.TextureLoader();

function createCard(app, index) {
    const group = new THREE.Group();

    const width = 1.65;
    const height = 2.05;

    const geometry = new THREE.PlaneGeometry(width, height);

    let texture;

    if (app.cover) {
        texture = textureLoader.load(app.cover);
    }

    const material = new THREE.MeshBasicMaterial({
        color: app.color,
        map: texture,
        transparent: true,
    });

    const mesh = new THREE.Mesh(geometry, material);

    /* Borde */

    const borderGeometry = new THREE.EdgesGeometry(geometry);

    const borderMaterial = new THREE.LineBasicMaterial({
        color: 0x6ce7e7,
        transparent: true,
        opacity: 0.15,
    });

    const border = new THREE.LineSegments(borderGeometry, borderMaterial);

    group.add(mesh);
    group.add(border);

    /* Posición inicial */

    const spacing = 2.0;

    const x = (index - (APPS.length - 1) / 2) * spacing;

    group.position.set(x, 1.45, -4);

    /* Rotación */

    group.rotation.y = -x * 0.045;

    scene.add(group);

    const title = createTextSprite(app.title.toUpperCase());

    title.position.set(0, -1.35, 0);

    title.scale.set(1.55, 0.38, 1);

    group.add(title);

    cards.push({
        group,
        mesh,
        border,
        title,
        app,
    });
}

APPS.forEach((app, index) => {
    createCard(app, index);
});

/* =========================================================
   SELECCIÓN
   ========================================================= */

let selectedIndex = 0;

const targetPositions = [];

for (let i = 0; i < cards.length; i++) {
    targetPositions.push(new THREE.Vector3());
}

function updateSelection() {
    cards.forEach((card, i) => {
        const selected = i === selectedIndex;

        const x = (i - selectedIndex) * 2.0;

        const targetZ = selected ? -2.8 : -4.0;

        const targetY = selected ? 1.55 : 1.45;

        targetPositions[i].set(x, targetY, targetZ);

        card.border.material.opacity = selected ? 0.95 : 0.12;

        card.mesh.material.opacity = selected ? 1 : 0.65;

        card.group.scale.setScalar(selected ? 1.08 : 0.92);

        card.title.material.opacity = selected ? 1 : 0.35;
    });
}

updateSelection();

/* =========================================================
   NAVEGACIÓN
   ========================================================= */

function navigate(direction) {
    const next = Math.max(
        0,
        Math.min(APPS.length - 1, selectedIndex + direction)
    );

    if (next === selectedIndex) {
        return;
    }

    selectedIndex = next;

    updateSelection();
}

function openSelected() {
    const app = APPS[selectedIndex];

    window.location.href = `../${app.id}/${app.id}.html`;
}

/* =========================================================
   GAMEPAD
   ========================================================= */

input.on(InputAction.RIGHT, () => navigate(1));

input.on(InputAction.LEFT, () => navigate(-1));

input.on(InputAction.CONFIRM, () => openSelected());

input.on(InputAction.BACK, () => {
    window.location.href = "../home/home.html";
});

/* =========================================================
   ANIMACIÓN
   ========================================================= */

const clock = new THREE.Clock();

function animate() {
    const elapsed = clock.getElapsedTime();

    /* Kibo */

    ring.rotation.z = elapsed * 0.4;

    ring.rotation.x = Math.sin(elapsed * 0.7) * 0.15;

    kiboGroup.position.y = 2.35 + Math.sin(elapsed * 1.2) * 0.04;

    /* Tarjetas */

    cards.forEach((card, i) => {
        card.group.position.lerp(targetPositions[i], 0.08);

        const selected = i === selectedIndex;

        if (selected) {
            card.group.position.z += Math.sin(elapsed * 2) * 0.005;
        }
    });

    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

/* =========================================================
   RESIZE
   ========================================================= */

window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;

    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
});

/* =========================================================
   WEBXR
   ========================================================= */

const enterButton = document.getElementById("enter-vr");

const message = document.getElementById("vr-message-text");

async function enterVR() {
    if (!navigator.xr) {
        message.textContent = "Este navegador no soporta WebXR";

        return;
    }

    const supported = await navigator.xr.isSessionSupported("immersive-vr");

    if (!supported) {
        message.textContent = "RV inmersiva no disponible en este dispositivo";

        return;
    }

    const session = await navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor"],
    });

    await renderer.xr.setSession(session);

    document.body.classList.add("in-vr");

    session.addEventListener("end", () => {
        document.body.classList.remove("in-vr");
    });
}

enterButton.addEventListener("click", enterVR);

/* =========================================================
   MENSAJE INICIAL
   ========================================================= */

if (!navigator.xr) {
    message.textContent = "Conectá un dispositivo compatible con WebXR";
} else {
    message.textContent = "Listo para iniciar el entorno virtual";
}

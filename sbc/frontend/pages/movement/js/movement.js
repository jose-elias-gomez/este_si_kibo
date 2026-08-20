import { InputAction, input } from "../../../shared/js/inputController.js";

// Volver a home ../../home/home.html
input.on(InputAction.BACK, () => {
    window.location.href = "../home/home.html"
});

let scene, camera, renderer, controls;
let modelRoot = null;
let selectedNodeName = null;
let activePivotMesh = null;

let modelCenter = new THREE.Vector3(0, 0.8, 0);
let cameraDistance = 3.5;

// 1. Configuración por pieza: Define eje único y límites (min, max)
const PARTS_CONFIG = {
    'Head':       { axis: 'y', min: -90, max: 90 },
    'LeftArm':    { axis: 'x', min: -45, max: 45 },
    'RightArm':   { axis: 'x', min: -45, max: 45 },
    'LeftWheel':  { axis: 'x', min: -180, max: 180 },
    'RightWheel': { axis: 'x', min: -180, max: 180 }
};

// Ángulos actuales guardados por pieza
const pivotAngles = {
    'Head': 0,
    'LeftArm': 0,
    'RightArm': 0,
    'LeftWheel': 0,
    'RightWheel': 0
};

// DOM Elements
const partButtons = document.querySelectorAll('.btn-part');
const slider = document.getElementById('angle-slider');
const angleVal = document.getElementById('angle-val');

function init3D() {
    const container = document.getElementById('canvas-container');
    
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 1.5, 3.5);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableRotate = false;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.target.copy(modelCenter);

    window.addEventListener('resize', onWindowResize);

    loadModel();
    
    // Seleccionar Head por defecto al iniciar (después de cargar)
    setTimeout(() => {
        const defaultBtn = document.querySelector('.btn-part[data-node="Head"]');
        if (defaultBtn) defaultBtn.click();
    }, 500);

    animate();
}

function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}

function onWindowResize() {
    const container = document.getElementById('canvas-container');
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
}

function transitionToView(targetView) {
    if (!modelRoot) return;

    let targetPos = new THREE.Vector3();

    if (targetView === 'front') {
        targetPos.set(modelCenter.x, modelCenter.y, modelCenter.z + cameraDistance);
    } else if (targetView === 'left') {
        targetPos.set(modelCenter.x - cameraDistance, modelCenter.y, modelCenter.z);
    } else if (targetView === 'right') {
        targetPos.set(modelCenter.x + cameraDistance, modelCenter.y, modelCenter.z);
    }

    gsap.to(camera.position, {
        x: targetPos.x,
        y: targetPos.y,
        z: targetPos.z,
        duration: 1.2,
        ease: "power2.inOut",
        onUpdate: () => {
            camera.lookAt(modelCenter);
            controls.target.copy(modelCenter);
            controls.update();
        }
    });
}

function findPivotInNode(parentName) {
    if (!modelRoot) return null;

    let parentObj = null;

    modelRoot.traverse((child) => {
        if (child.name === parentName) {
            parentObj = child;
        }
    });

    if (!parentObj) {
        console.warn(`No se encontró el nodo ${parentName}`);
        return null;
    }

    console.log(`Hijos de ${parentName}:`, parentObj.children);

    let pivotObj = null;

    // Buscar cualquier nodo cuyo nombre empiece por "Pivot"
    parentObj.traverse((child) => {
        if (child !== parentObj && child.name.startsWith('Pivot')) {
            pivotObj = child;
        }
    });

    console.log(
        pivotObj
            ? `Pivot encontrado para ${parentName}: ${pivotObj.name}`
            : `No se encontró ningún nodo que empiece por "Pivot" para ${parentName}`
    );

    return pivotObj || parentObj;
}

// Guardará la rotación inicial exacta de cada pieza tal como viene en el GLTF
const initialRotations = {};

function loadModel() {
    const loader = new THREE.GLTFLoader();

    loader.load(
        'assets/kibo_model.glb',
        function (gltf) {
            if (modelRoot) scene.remove(modelRoot);

            modelRoot = gltf.scene;

            modelRoot.traverse((child) => {
                if (child.isMesh && child.material) {
                    child.material = new THREE.MeshBasicMaterial({
                        map: child.material.map,
                        color: child.material.color,
                        transparent: child.material.transparent,
                        opacity: child.material.opacity
                    });
                }
            });

            scene.add(modelRoot);

            // Guardar la rotación inicial predeterminada de cada pivote configurado
            Object.keys(PARTS_CONFIG).forEach(partName => {
                const pivotMesh = findPivotInNode(partName);
                if (pivotMesh) {
                    initialRotations[partName] = pivotMesh.rotation.clone();
                }
            });

            const box = new THREE.Box3().setFromObject(modelRoot);
            box.getCenter(modelCenter);
            const size = box.getSize(new THREE.Vector3());

            cameraDistance = size.y * 1.8;
            controls.target.copy(modelCenter);

            camera.position.set(
                modelCenter.x,
                modelCenter.y,
                modelCenter.z + cameraDistance
            );

            camera.lookAt(modelCenter);
            controls.update();

            // Seleccionar Head por defecto al terminar de cargar
            const defaultBtn = document.querySelector('.btn-part[data-node="Head"]');
            if (defaultBtn) defaultBtn.click();
        },
        undefined,
        function (error) {
            console.error('Error cargando el modelo:', error);
        }
    );
}

// Selección de Componente + Aplicación de Configuración
function selectPart(node, view) {
    selectedNodeName = node;

    // Asignación correcta a la variable GLOBAL (sin el 'const')
    activePivotMesh = findPivotInNode(node);

    const config = PARTS_CONFIG[node] || { axis: 'y', min: -45, max: 45 };

    // Ajustar límites dinámicos del HTML Slider según la pieza
    slider.min = config.min;
    slider.max = config.max;
    slider.disabled = false;

    // Recuperar ángulo guardado
    const currentAngle = pivotAngles[node] || 0;
    slider.value = currentAngle;
    angleVal.textContent = `${currentAngle}° (${config.axis.toUpperCase()})`;

    transitionToView(view);
}

function resetPositions() {
    if (!modelRoot) return;

    // 1. Resetear todos los ángulos guardados a 0 (desplazamiento relativo)
    Object.keys(pivotAngles).forEach(part => {
        pivotAngles[part] = 0;
    });

    // 2. Restaurar la rotación base inicial guardada al cargar el modelo
    Object.keys(PARTS_CONFIG).forEach(partName => {
        const pivotMesh = findPivotInNode(partName);
        if (pivotMesh && initialRotations[partName]) {
            pivotMesh.rotation.copy(initialRotations[partName]);
        }
    });

    // 3. Volver a seleccionar la vista y botón de la Cabeza
    const headBtn = document.querySelector('.btn-part[data-node="Head"]');
    if (headBtn) {
        headBtn.click();
    } else {
        selectPart('Head', 'front');
    }
}

// Listeners para botones de selección
partButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        partButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const nodeName = btn.getAttribute('data-node');
        const targetView = btn.getAttribute('data-view');
        selectPart(nodeName, targetView);
    });
});

// Manejo del Slider (Rotación en el eje específico configurado)
slider.addEventListener('input', (e) => {
    const angleDegrees = parseFloat(e.target.value);

    if (selectedNodeName) {
        pivotAngles[selectedNodeName] = angleDegrees;
    }

    if (activePivotMesh && selectedNodeName) {
        const config = PARTS_CONFIG[selectedNodeName] || { axis: 'y' };
        const radiansOffset = THREE.MathUtils.degToRad(angleDegrees);

        // Obtener la rotación inicial del archivo 3D
        const baseRotation = initialRotations[selectedNodeName] || new THREE.Euler(0, 0, 0);

        // Restaurar rotaciones base de los 3 ejes
        activePivotMesh.rotation.copy(baseRotation);

        // Aplicar el offset/desplazamiento solo en el eje correspondiente
        activePivotMesh.rotation[config.axis] = baseRotation[config.axis] + radiansOffset;
        
        angleVal.textContent = `${angleDegrees}° (${config.axis.toUpperCase()})`;
    }
});

window.onload = init3D;
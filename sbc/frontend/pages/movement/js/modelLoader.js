/**
 * Busca un nodo por nombre dentro de la raíz del modelo.
 * @param {THREE.Object3D} modelRoot
 * @param {string} nodeName
 * @returns {THREE.Object3D|null}
 */
export function findNode(modelRoot, nodeName) {
    if (!modelRoot) return null;

    let found = null;
    modelRoot.traverse((child) => {
        if (child.name === nodeName) {
            found = child;
        }
    });

    if (!found) {
        console.warn(`No se encontró el nodo ${nodeName}`);
    }

    return found;
}

/**
 * Dado el nombre de un nodo "padre" (p.ej. una pieza como 'Head'),
 * devuelve su nodo pivote interno (cualquier hijo cuyo nombre empiece
 * por "Pivot"), o el propio nodo padre si no hay pivote específico.
 * @param {THREE.Object3D} modelRoot
 * @param {string} parentName
 * @returns {THREE.Object3D|null}
 */
export function findPivotInNode(modelRoot, parentName) {
    const parentObj = findNode(modelRoot, parentName);
    if (!parentObj) return null;

    let pivotObj = null;
    parentObj.traverse((child) => {
        if (child !== parentObj && child.name.startsWith("Pivot")) {
            pivotObj = child;
        }
    });

    return pivotObj || parentObj;
}

/**
 * Carga un modelo GLTF y normaliza sus materiales a MeshBasicMaterial
 * (conservando mapa de textura, color, transparencia y opacidad).
 * @param {string} url
 * @returns {Promise<THREE.Object3D>} la raíz del modelo cargado (gltf.scene)
 */
export function loadGltfModel(url) {
    const loader = new THREE.GLTFLoader();

    return new Promise((resolve, reject) => {
        loader.load(
            url,
            (gltf) => {
                const modelRoot = gltf.scene;

                modelRoot.traverse((child) => {
                    if (child.isMesh && child.material) {
                        child.material = new THREE.MeshBasicMaterial({
                            map: child.material.map,
                            color: child.material.color,
                            transparent: child.material.transparent,
                            opacity: child.material.opacity,
                        });
                    }
                });

                resolve(modelRoot);
            },
            undefined,
            (error) => {
                console.error("Error cargando el modelo:", error);
                reject(error);
            }
        );
    });
}

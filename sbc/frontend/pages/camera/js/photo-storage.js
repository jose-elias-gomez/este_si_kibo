const STORAGE_KEY = "kibo.camera.photos";

let photos = readFromStorage();

function readFromStorage() {
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

/**
 * Writes the in-memory list to localStorage.
 * If the quota is exceeded, the oldest photos are dropped until it fits.
 * @returns {boolean} true if saved, false if even a single photo does not fit.
 */
function persist() {
    while (true) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
            return true;
        } catch (error) {
            if (photos.length <= 1) {
                console.error("[PHOTO-STORAGE] Could not save photos:", error);
                return false;
            }
            photos.shift();
        }
    }
}

export function getPhotos() {
    return [...photos];
}

export function getPhotoCount() {
    return photos.length;
}

export function getPhoto(index) {
    return photos[index];
}

export function addPhoto(dataUrl) {
    const photo = {
        id: Date.now(),
        createdAt: new Date().toISOString(),
        dataUrl,
    };

    photos.push(photo);

    if (!persist()) {
        // Roll back the in-memory list to whatever is really in storage.
        photos = readFromStorage();
        return null;
    }

    return photo;
}

export function deletePhoto(id) {
    const index = photos.findIndex((photo) => photo.id === id);

    if (index === -1) {
        return false;
    }

    photos.splice(index, 1);
    persist();

    return true;
}

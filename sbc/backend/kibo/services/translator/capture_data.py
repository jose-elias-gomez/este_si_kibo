import csv
import os
import time
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision


# =========================
# CONFIGURATION
# =========================

DATA_DIR = "data"
DATA_FILE = os.path.join(DATA_DIR, "landmarks.csv")

# MediaPipe hand landmark model (Tasks API). Downloaded automatically
# on first run if it is not in the working directory.
HAND_MODEL_FILE = "hand_landmarker.task"
HAND_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)

os.makedirs(DATA_DIR, exist_ok=True)

# Camera rotation and mirroring.
# IMPORTANT: these values must be IDENTICAL to the ones used in
# _translator.py, otherwise the model trains on one orientation
# and predicts on another.
#
# CAMERA_ROTATION options:
#   cv2.ROTATE_90_CLOCKWISE
#   cv2.ROTATE_90_COUNTERCLOCKWISE
#   cv2.ROTATE_180
#   None (no rotation)
#
# If the image looks mirrored the wrong way, set CAMERA_MIRROR to False.
CAMERA_ROTATION = cv2.ROTATE_180
CAMERA_MIRROR = False

# Letters to recognize
CLASSES = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")

# Pairs of landmark indices that form the hand skeleton (for drawing).
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]


# =========================
# MEDIAPIPE
# =========================

if not os.path.exists(HAND_MODEL_FILE):
    print(f"Descargando {HAND_MODEL_FILE}...")
    urllib.request.urlretrieve(HAND_MODEL_URL, HAND_MODEL_FILE)

landmarker = vision.HandLandmarker.create_from_options(
    vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=HAND_MODEL_FILE),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=1,
        min_hand_detection_confidence=0.6,
        min_hand_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    )
)

# VIDEO mode requires strictly increasing timestamps.
last_timestamp_ms = 0


def next_timestamp_ms():
    """Returns a strictly increasing timestamp in milliseconds."""
    global last_timestamp_ms

    timestamp_ms = int(time.monotonic() * 1000)

    if timestamp_ms <= last_timestamp_ms:
        timestamp_ms = last_timestamp_ms + 1

    last_timestamp_ms = timestamp_ms
    return timestamp_ms


# =========================
# FUNCTIONS
# =========================

def normalize_landmarks(hand_landmarks):
    """
    Converts the 21 MediaPipe landmarks into 63 normalized values.

    Landmark 0 (wrist) is used as the origin and the result is scaled
    by the largest absolute value. Must stay identical to
    SignTranslator.normalize_landmarks() in _translator.py.
    """

    landmarks = []

    wrist = hand_landmarks[0]

    for landmark in hand_landmarks:
        landmarks.extend([
            landmark.x - wrist.x,
            landmark.y - wrist.y,
            landmark.z - wrist.z,
        ])

    # Scale normalization
    max_value = max(abs(value) for value in landmarks)

    if max_value > 0:
        landmarks = [value / max_value for value in landmarks]

    return landmarks


def draw_hand(frame, hand_landmarks):
    """
    Draws the hand skeleton on the frame (the Tasks API has no
    drawing_utils, so it is done by hand with OpenCV).
    """

    height, width = frame.shape[:2]

    points = [
        (int(landmark.x * width), int(landmark.y * height))
        for landmark in hand_landmarks
    ]

    for start, end in HAND_CONNECTIONS:
        cv2.line(frame, points[start], points[end], (255, 255, 255), 2)

    for point in points:
        cv2.circle(frame, point, 4, (0, 255, 0), -1)


def initialize_csv():
    """
    Creates the CSV if it does not exist yet.
    """

    if os.path.exists(DATA_FILE):
        return

    header = []

    for i in range(21):
        header.extend([f"x{i}", f"y{i}", f"z{i}"])

    header.append("label")

    with open(DATA_FILE, "w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(header)


# =========================
# INITIALIZE DATASET
# =========================

initialize_csv()

print()
print("======================================")
print("   CAPTURA DE DATOS - SIGN LANGUAGE")
print("======================================")
print()
print("Letras disponibles:")
print("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
print()
print("Escribí la letra que querés capturar.")
print("Ejemplo: A")
print("Escribí 'exit' para salir.")
print()

label = input("Letra: ").strip().upper()

if label == "EXIT":
    landmarker.close()
    exit()

if label not in CLASSES:
    print("Letra inválida.")
    landmarker.close()
    exit()


# =========================
# CAMERA
# =========================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    landmarker.close()
    raise RuntimeError("No se pudo abrir DroidCam.")


print()
print(f"Capturando datos para: {label}")
print()
print("Poné la mano haciendo la seña.")
print("Presioná ESPACIO para guardar una muestra.")
print("Presioná Q para salir.")
print()


samples_saved = 0


# =========================
# LOOP
# =========================

while True:

    success, frame = cap.read()

    if not success:
        print("No se pudo leer el frame.")
        continue

    if CAMERA_ROTATION is not None:
        frame = cv2.rotate(frame, CAMERA_ROTATION)

    if CAMERA_MIRROR:
        frame = cv2.flip(frame, 1)

    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
    result = landmarker.detect_for_video(mp_image, next_timestamp_ms())

    # Draw hand
    if result.hand_landmarks:
        draw_hand(frame, result.hand_landmarks[0])

    # Overlay text
    cv2.putText(
        frame,
        f"Clase: {label}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2,
    )

    cv2.putText(
        frame,
        f"Muestras: {samples_saved}",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2,
    )

    cv2.putText(
        frame,
        "ESPACIO = guardar | Q = salir",
        (20, 120),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2,
    )

    cv2.imshow("Sign Language - Dataset", frame)

    key = cv2.waitKey(1) & 0xFF

    # Save sample
    if key == 32:

        if result.hand_landmarks:

            features = normalize_landmarks(result.hand_landmarks[0])

            with open(DATA_FILE, "a", newline="", encoding="utf-8") as file:
                writer = csv.writer(file)
                writer.writerow(features + [label])

            samples_saved += 1

            print(f"Muestra guardada: {samples_saved}")

        else:
            print("No se detectó ninguna mano.")

    # Quit
    elif key == ord("q"):
        break


# =========================
# CLEANUP
# =========================

cap.release()
cv2.destroyAllWindows()
landmarker.close()

print()
print(f"Finalizado. Se agregaron {samples_saved} muestras de {label}.")

import csv
import os
import cv2
import mediapipe as mp


# =========================
# CONFIGURACIÓN
# =========================

DATA_DIR = "data"
DATA_FILE = os.path.join(DATA_DIR, "landmarks.csv")

os.makedirs(DATA_DIR, exist_ok=True)

# Letras que vamos a reconocer inicialmente
CLASSES = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")


# =========================
# MEDIAPIPE
# =========================

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=0.6,
    min_tracking_confidence=0.6,
)


# =========================
# FUNCIONES
# =========================

def normalize_landmarks(hand_landmarks):
    """
    Convierte los 21 landmarks de MediaPipe
    en 63 valores normalizados.

    El landmark 0 (muñeca) se utiliza como origen.
    """

    landmarks = []

    wrist = hand_landmarks.landmark[0]

    for landmark in hand_landmarks.landmark:
        x = landmark.x - wrist.x
        y = landmark.y - wrist.y
        z = landmark.z - wrist.z

        landmarks.extend([x, y, z])

    # Normalización por escala
    max_value = max(abs(value) for value in landmarks)

    if max_value > 0:
        landmarks = [
            value / max_value
            for value in landmarks
        ]

    return landmarks


def initialize_csv():
    """
    Crea el CSV si todavía no existe.
    """

    if os.path.exists(DATA_FILE):
        return

    header = []

    for i in range(21):
        header.extend([
            f"x{i}",
            f"y{i}",
            f"z{i}"
        ])

    header.append("label")

    with open(
        DATA_FILE,
        "w",
        newline="",
        encoding="utf-8"
    ) as file:

        writer = csv.writer(file)
        writer.writerow(header)


# =========================
# INICIALIZAR DATASET
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
    hands.close()
    exit()

if label not in CLASSES:
    print("Letra inválida.")
    hands.close()
    exit()


# =========================
# CÁMARA
# =========================

cap = cv2.VideoCapture(0)

if not cap.isOpened():
    hands.close()
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

    frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
    frame = cv2.flip(frame, 1)

    rgb_frame = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )

    results = hands.process(rgb_frame)

    # Dibujar mano
    if results.multi_hand_landmarks:

        for hand_landmarks in results.multi_hand_landmarks:

            mp_drawing.draw_landmarks(
                frame,
                hand_landmarks,
                mp_hands.HAND_CONNECTIONS
            )

    # Texto
    cv2.putText(
        frame,
        f"Clase: {label}",
        (20, 40),
        cv2.FONT_HERSHEY_SIMPLEX,
        1,
        (0, 255, 0),
        2
    )

    cv2.putText(
        frame,
        f"Muestras: {samples_saved}",
        (20, 80),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.8,
        (255, 255, 255),
        2
    )

    cv2.putText(
        frame,
        "ESPACIO = guardar | Q = salir",
        (20, 120),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.6,
        (255, 255, 255),
        2
    )

    cv2.imshow(
        "Sign Language - Dataset",
        frame
    )

    key = cv2.waitKey(1) & 0xFF

    # Guardar muestra
    if key == 32:

        if results.multi_hand_landmarks:

            hand_landmarks = results.multi_hand_landmarks[0]

            features = normalize_landmarks(
                hand_landmarks
            )

            with open(
                DATA_FILE,
                "a",
                newline="",
                encoding="utf-8"
            ) as file:

                writer = csv.writer(file)

                writer.writerow(
                    features + [label]
                )

            samples_saved += 1

            print(
                f"Muestra guardada: "
                f"{samples_saved}"
            )

        else:
            print(
                "No se detectó ninguna mano."
            )

    # Salir
    elif key == ord("q"):
        break


# =========================
# LIMPIAR
# =========================

cap.release()
cv2.destroyAllWindows()
hands.close()

print()
print(
    f"Finalizado. "
    f"Se agregaron {samples_saved} muestras de {label}."
)
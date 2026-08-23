import cv2
import mediapipe as mp
import pickle
import numpy as np
from collections import deque


# ============================================================
# CONFIGURACIÓN
# ============================================================

MODEL_FILE = "model.pkl"

CAMERA_INDEX = 0

MIN_DETECTION_CONFIDENCE = 0.2
MIN_TRACKING_CONFIDENCE = 0.2

# Cantidad de frames utilizados para suavizar la predicción
HISTORY_SIZE = 12

# Confianza mínima para aceptar una predicción
MIN_CONFIDENCE = 0.4

# Diferencia mínima entre la primera y segunda clase
# para considerar que la predicción es suficientemente clara.
MIN_MARGIN = 0.1

# Cantidad de frames consecutivos necesarios para
# considerar que una predicción es estable.
STABLE_FRAMES = 3


# ============================================================
# CARGAR MODELO
# ============================================================

try:

    with open(MODEL_FILE, "rb") as file:
        model = pickle.load(file)

except FileNotFoundError:

    raise FileNotFoundError(
        "No existe model.pkl. "
        "Ejecutá primero: python train.py"
    )


# ============================================================
# MEDIAPIPE
# ============================================================

mp_hands = mp.solutions.hands
mp_drawing = mp.solutions.drawing_utils

hands = mp_hands.Hands(
    static_image_mode=False,
    max_num_hands=1,
    min_detection_confidence=MIN_DETECTION_CONFIDENCE,
    min_tracking_confidence=MIN_TRACKING_CONFIDENCE,
)


# ============================================================
# NORMALIZACIÓN
# ============================================================

def normalize_landmarks(hand_landmarks):

    landmarks = []

    wrist = hand_landmarks.landmark[0]

    for landmark in hand_landmarks.landmark:

        x = landmark.x - wrist.x
        y = landmark.y - wrist.y
        z = landmark.z - wrist.z

        landmarks.extend([
            x,
            y,
            z
        ])

    max_value = max(
        abs(value)
        for value in landmarks
    )

    if max_value > 0:

        landmarks = [
            value / max_value
            for value in landmarks
        ]

    return landmarks


# ============================================================
# CÁMARA
# ============================================================

cap = cv2.VideoCapture(CAMERA_INDEX)

if not cap.isOpened():

    hands.close()

    raise RuntimeError(
        "No se pudo abrir DroidCam."
    )


# ============================================================
# HISTORIAL
# ============================================================

probability_history = deque(
    maxlen=HISTORY_SIZE
)

prediction_history = deque(
    maxlen=STABLE_FRAMES
)


last_stable_prediction = None

display_prediction = "NINGUNA"

display_confidence = 0.0

fps_counter = 0
fps_timer = cv2.getTickCount()
fps = 0


# ============================================================
# LOOP
# ============================================================

while True:

    success, frame = cap.read()

    if not success:

        print("No se pudo leer el frame.")
        continue


    # --------------------------------------------------------
    # FPS
    # --------------------------------------------------------

    fps_counter += 1

    current_tick = cv2.getTickCount()

    elapsed = (
        current_tick - fps_timer
    ) / cv2.getTickFrequency()

    if elapsed >= 1.0:

        fps = fps_counter / elapsed

        fps_counter = 0

        fps_timer = current_tick


    # --------------------------------------------------------
    # PREPROCESAMIENTO
    # --------------------------------------------------------

    frame = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
    frame = cv2.flip(frame, 1)      
    rgb_frame = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2RGB
    )


    # --------------------------------------------------------
    # MEDIA PIPE
    # --------------------------------------------------------

    results = hands.process(
        rgb_frame
    )


    if results.multi_hand_landmarks:

        hand_landmarks = (
            results.multi_hand_landmarks[0]
        )


        # ----------------------------------------------------
        # DIBUJAR LANDMARKS
        # ----------------------------------------------------

        mp_drawing.draw_landmarks(
            frame,
            hand_landmarks,
            mp_hands.HAND_CONNECTIONS
        )


        # ----------------------------------------------------
        # EXTRAER FEATURES
        # ----------------------------------------------------

        features = normalize_landmarks(
            hand_landmarks
        )

        features = np.asarray(
            features,
            dtype=np.float32
        ).reshape(1, -1)


        # ----------------------------------------------------
        # PREDICCIÓN
        # ----------------------------------------------------

        probabilities = model.predict_proba(
            features
        )[0]


        classes = model.classes_


        # Ordenar probabilidades
        sorted_indices = np.argsort(
            probabilities
        )[::-1]


        best_index = sorted_indices[0]

        second_index = sorted_indices[1]


        prediction = classes[
            best_index
        ]


        confidence = float(
            probabilities[best_index]
        )


        second_confidence = float(
            probabilities[second_index]
        )


        margin = (
            confidence -
            second_confidence
        )


        # ----------------------------------------------------
        # GUARDAR HISTORIAL
        # ----------------------------------------------------

        probability_history.append(
            probabilities
        )


        # ----------------------------------------------------
        # PROMEDIAR PROBABILIDADES
        # ----------------------------------------------------

        average_probabilities = np.mean(
            probability_history,
            axis=0
        )


        average_sorted = np.argsort(
            average_probabilities
        )[::-1]


        average_best_index = (
            average_sorted[0]
        )

        average_second_index = (
            average_sorted[1]
        )


        average_prediction = classes[
            average_best_index
        ]


        average_confidence = float(
            average_probabilities[
                average_best_index
            ]
        )


        average_second_confidence = float(
            average_probabilities[
                average_second_index
            ]
        )


        average_margin = (
            average_confidence -
            average_second_confidence
        )


        # ----------------------------------------------------
        # VALIDACIÓN
        # ----------------------------------------------------

        prediction_is_good = (
            average_confidence >= MIN_CONFIDENCE
            and
            average_margin >= MIN_MARGIN
        )


        if prediction_is_good:

            prediction_history.append(
                average_prediction
            )

        else:

            prediction_history.clear()


        # ----------------------------------------------------
        # ESTABILIDAD
        # ----------------------------------------------------

        if len(prediction_history) >= STABLE_FRAMES:

            values = list(
                prediction_history
            )

            most_common = max(
                set(values),
                key=values.count
            )

            count = values.count(
                most_common
            )


            if count >= STABLE_FRAMES:

                last_stable_prediction = (
                    most_common
                )

                display_prediction = (
                    most_common
                )

                display_confidence = (
                    average_confidence
                )


        # ----------------------------------------------------
        # INFORMACIÓN EN PANTALLA
        # ----------------------------------------------------

        cv2.rectangle(
            frame,
            (10, 10),
            (360, 155),
            (0, 0, 0),
            -1
        )


        cv2.putText(
            frame,
            f"Prediccion: {display_prediction}",
            (20, 45),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.9,
            (0, 255, 0),
            2
        )


        cv2.putText(
            frame,
            f"Confianza: {display_confidence * 100:.1f}%",
            (20, 80),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2
        )


        cv2.putText(
            frame,
            f"Margen: {average_margin * 100:.1f}%",
            (20, 110),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.65,
            (255, 255, 255),
            2
        )


        cv2.putText(
            frame,
            f"FPS: {fps:.1f}",
            (20, 140),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.55,
            (200, 200, 200),
            1
        )


        # ----------------------------------------------------
        # PREDICCIÓN ACTUAL
        # ----------------------------------------------------

        cv2.putText(
            frame,
            f"Actual: {average_prediction}",
            (20, 190),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (255, 255, 0),
            2
        )


        # ----------------------------------------------------
        # SEGUNDA OPCIÓN
        # ----------------------------------------------------

        cv2.putText(
            frame,
            (
                f"2da: "
                f"{classes[average_second_index]} "
                f"{average_second_confidence * 100:.1f}%"
            ),
            (20, 225),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (255, 255, 255),
            2
        )


    else:

        # No hay mano

        probability_history.clear()

        prediction_history.clear()

        cv2.putText(
            frame,
            "No se detecta ninguna mano",
            (20, 50),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (0, 0, 255),
            2
        )


    # ========================================================
    # MOSTRAR
    # ========================================================

    cv2.imshow(
        "Sign Language Translator",
        frame
    )


    # ========================================================
    # SALIR
    # ========================================================

    key = cv2.waitKey(1) & 0xFF

    if key == ord("q"):

        break


# ============================================================
# LIMPIAR
# ============================================================

cap.release()

cv2.destroyAllWindows()

hands.close()
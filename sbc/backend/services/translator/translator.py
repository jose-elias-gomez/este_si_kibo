import pickle

from collections import deque

import cv2
import mediapipe as mp
import numpy as np


HISTORY_SIZE = 12
MIN_CONFIDENCE = 0.4
MIN_MARGIN = 0.1
STABLE_FRAMES = 3


class SignTranslator:

    def __init__(self, model_path: str):
        print()
        print("=" * 60)
        print("CARGANDO TRADUCTOR DE SEÑAS")
        print("=" * 60)

        print("[TRANSLATOR] Cargando model.pkl...")

        with open(model_path, "rb") as file:
            self.model = pickle.load(file)

        print("[TRANSLATOR] Modelo cargado.")

        self.mp_hands = mp.solutions.hands

        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.2,
            min_tracking_confidence=0.2,
        )

        self.probability_history = deque(
            maxlen=HISTORY_SIZE
        )

        self.prediction_history = deque(
            maxlen=STABLE_FRAMES
        )

        self.last_stable_prediction = None

        # Word being built
        self.word = ""

        # Prevents the same held sign from being added
        # multiple times
        self.letter_locked = False

        print("[TRANSLATOR] Traductor listo.")
        print("=" * 60)
        print()

    # ========================================================
    # NORMALIZACIÓN
    # ========================================================

    def normalize_landmarks(
        self,
        hand_landmarks,
    ):
        landmarks = []

        wrist = hand_landmarks.landmark[0]

        for landmark in hand_landmarks.landmark:
            x = landmark.x - wrist.x
            y = landmark.y - wrist.y
            z = landmark.z - wrist.z

            landmarks.extend([
                x,
                y,
                z,
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

    # ========================================================
    # WORD
    # ========================================================

    def add_letter(self, letter):
        if not letter:
            return

        self.word += str(letter)

        print(
            f"[TRANSLATOR] Letra confirmada: "
            f"{letter} -> {self.word}"
        )

    def delete_last(self):
        if self.word:
            self.word = self.word[:-1]

        print(
            f"[TRANSLATOR] DELETE -> {self.word}"
        )

    def add_space(self):
        if self.word and not self.word.endswith(" "):
            self.word += " "

        print(
            f"[TRANSLATOR] SPACE -> '{self.word}'"
        )

    def clear_word(self):
        self.word = ""

        print("[TRANSLATOR] CLEAR")

    # ========================================================
    # CLEAR PREDICTION
    # ========================================================

    def clear_prediction_history(self):
        self.probability_history.clear()
        self.prediction_history.clear()
        self.last_stable_prediction = None

    # ========================================================
    # PROCESAR FRAME
    # ========================================================

    def process_frame(
        self,
        frame,
    ):
        rgb_frame = cv2.cvtColor(
            frame,
            cv2.COLOR_BGR2RGB,
        )

        results = self.hands.process(
            rgb_frame
        )

        # ----------------------------------------------------
        # NO HAY MANO
        # ----------------------------------------------------

        if not results.multi_hand_landmarks:
            self.clear_prediction_history()

            # Unlock the next letter
            self.letter_locked = False

            return {
                "detected": False,
                "prediction": None,
                "confidence": 0.0,
                "margin": 0.0,
                "stable": False,
                "stable_prediction": None,
                "confirmed": False,
                "confirmed_letter": None,
                "locked": False,
                "word": self.word,
            }

        # ----------------------------------------------------
        # LANDMARKS
        # ----------------------------------------------------

        hand_landmarks = (
            results.multi_hand_landmarks[0]
        )

        # ----------------------------------------------------
        # FEATURES
        # ----------------------------------------------------

        features = self.normalize_landmarks(
            hand_landmarks
        )

        features = np.asarray(
            features,
            dtype=np.float32,
        ).reshape(1, -1)

        # ----------------------------------------------------
        # PREDICCIÓN
        # ----------------------------------------------------

        probabilities = (
            self.model.predict_proba(features)[0]
        )

        classes = self.model.classes_

        sorted_indices = np.argsort(
            probabilities
        )[::-1]

        best_index = sorted_indices[0]
        second_index = sorted_indices[1]

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

        prediction = classes[
            best_index
        ]

        # ----------------------------------------------------
        # HISTORIAL DE PROBABILIDADES
        # ----------------------------------------------------

        self.probability_history.append(
            probabilities
        )

        average_probabilities = np.mean(
            self.probability_history,
            axis=0,
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
            self.prediction_history.append(
                average_prediction
            )
        else:
            self.prediction_history.clear()

        # ----------------------------------------------------
        # ESTABILIDAD
        # ----------------------------------------------------

        stable = False
        stable_prediction = None

        if (
            len(self.prediction_history)
            >= STABLE_FRAMES
        ):
            values = list(
                self.prediction_history
            )

            most_common = max(
                set(values),
                key=values.count,
            )

            count = values.count(
                most_common
            )

            if count >= STABLE_FRAMES:
                stable = True

                stable_prediction = (
                    most_common
                )

                self.last_stable_prediction = (
                    most_common
                )

        # ----------------------------------------------------
        # CONFIRMAR LETRA
        # ----------------------------------------------------

        confirmed = False
        confirmed_letter = None

        if (
            stable
            and stable_prediction is not None
            and not self.letter_locked
        ):
            confirmed = True

            confirmed_letter = str(
                stable_prediction
            )

            self.add_letter(
                confirmed_letter
            )

            # Lock the letter while the
            # hand is still visible
            self.letter_locked = True

        # ----------------------------------------------------
        # RESULTADO
        # ----------------------------------------------------

        return {
            "detected": True,

            "prediction": str(
                average_prediction
            ),

            "confidence": average_confidence,

            "margin": average_margin,

            "stable": stable,

            "stable_prediction": (
                str(stable_prediction)
                if stable_prediction is not None
                else None
            ),

            "second_prediction": str(
                classes[
                    average_second_index
                ]
            ),

            "second_confidence": (
                average_second_confidence
            ),

            "confirmed": confirmed,

            "confirmed_letter": (
                confirmed_letter
            ),

            "locked": self.letter_locked,

            "word": self.word,
        }

    # ========================================================
    # RESET
    # ========================================================

    def reset(self):
        self.clear_prediction_history()

        self.word = ""

        self.letter_locked = False

    # ========================================================
    # CLOSE
    # ========================================================

    def close(self):
        self.hands.close()


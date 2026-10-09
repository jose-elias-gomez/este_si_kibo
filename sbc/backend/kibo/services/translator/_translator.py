import logging
import pickle
import threading
import time
import urllib.request
from collections import deque
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python import vision

logger = logging.getLogger("[TRANSLATOR]")

# Default location of the trained classifier (put model.pkl next to this file).
DEFAULT_MODEL_PATH = Path(__file__).with_name("model.pkl")

# MediaPipe hand landmark model (Tasks API). It is downloaded automatically
# on first run if it is not already next to this file.
HAND_LANDMARKER_PATH = Path(__file__).with_name("hand_landmarker.task")
HAND_LANDMARKER_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task"
)

# Number of frames used to average the class probabilities.
HISTORY_SIZE = 12

# Minimum averaged confidence for a prediction to be considered valid.
MIN_CONFIDENCE = 0.2

# Minimum gap between the best and second-best averaged probabilities.
MIN_MARGIN = 0.03

# Consecutive identical valid predictions required to call a letter "stable".
STABLE_FRAMES = 2

# Camera rotation and mirroring.
# IMPORTANT: these must match EXACTLY CAMERA_ROTATION and CAMERA_MIRROR in
# capture_data.py. Otherwise the model predicts on an image oriented
# differently from the one it was trained on.
CAMERA_ROTATION = cv2.ROTATE_180
CAMERA_MIRROR = False


def ensure_hand_landmarker(path: Path = HAND_LANDMARKER_PATH) -> Path:
    """Downloads the MediaPipe hand landmarker model if it is missing."""
    if path.exists():
        return path

    logger.info("Downloading hand_landmarker.task to %s", path)
    urllib.request.urlretrieve(HAND_LANDMARKER_URL, path)
    return path


class SignTranslator:
    """Sign language letter recognizer built on MediaPipe HandLandmarker + a scikit-learn model.

    It keeps state (probability history, word being built), so a single
    instance represents a single signing session.
    """

    def __init__(
        self,
        model_path: str | Path = DEFAULT_MODEL_PATH,
        hand_model_path: str | Path = HAND_LANDMARKER_PATH,
    ):
        """Loads the trained classifier and initializes MediaPipe.

        Args:
            model_path (str | Path): Path to the pickled scikit-learn model.
            hand_model_path (str | Path): Path to hand_landmarker.task.
        """
        logger.info("Loading sign translator from %s", model_path)

        with open(model_path, "rb") as file:
            self.model = pickle.load(file)

        options = vision.HandLandmarkerOptions(
            base_options=BaseOptions(
                model_asset_path=str(ensure_hand_landmarker(Path(hand_model_path)))
            ),
            running_mode=vision.RunningMode.VIDEO,
            num_hands=1,
            min_hand_detection_confidence=0.2,
            min_hand_presence_confidence=0.2,
            min_tracking_confidence=0.2,
        )
        self.landmarker = vision.HandLandmarker.create_from_options(options)

        # VIDEO mode requires strictly increasing timestamps.
        self._last_timestamp_ms = 0

        self.probability_history = deque(maxlen=HISTORY_SIZE)
        self.prediction_history = deque(maxlen=STABLE_FRAMES)
        self.last_stable_prediction = None

        # Word being built
        self.word = ""

        # Prevents the same held sign from being added multiple times
        self.letter_locked = False

        # The landmarker's tracking state and the history buffers are not
        # thread-safe. Reentrant because process_frame() calls add_letter().
        self._lock = threading.RLock()

        logger.info("Sign translator ready")

    # ------------------------------------------------------------------
    # Normalization
    # ------------------------------------------------------------------

    @staticmethod
    def normalize_landmarks(hand_landmarks) -> list[float]:
        """Converts the 21 MediaPipe landmarks into 63 normalized values.

        The wrist (landmark 0) is used as the origin and the result is
        scaled by the largest absolute value. Must stay identical to
        normalize_landmarks() in capture_data.py.

        Args:
            hand_landmarks: List of 21 landmarks (Tasks API), each with x, y, z.

        Returns:
            list[float]: 63 normalized values (x, y, z per landmark).
        """
        landmarks = []

        wrist = hand_landmarks[0]

        for landmark in hand_landmarks:
            landmarks.extend([
                landmark.x - wrist.x,
                landmark.y - wrist.y,
                landmark.z - wrist.z,
            ])

        max_value = max(abs(value) for value in landmarks)

        if max_value > 0:
            landmarks = [value / max_value for value in landmarks]

        return landmarks

    # ------------------------------------------------------------------
    # Word
    # ------------------------------------------------------------------

    def add_letter(self, letter: str) -> None:
        """Appends a confirmed letter to the word."""
        if not letter:
            return

        with self._lock:
            self.word += str(letter)
            logger.info("Letter confirmed: %s -> %s", letter, self.word)

    def delete_last(self) -> None:
        """Removes the last character of the word."""
        with self._lock:
            if self.word:
                self.word = self.word[:-1]
            logger.info("DELETE -> %s", self.word)

    def add_space(self) -> None:
        """Appends a space, avoiding leading and duplicate spaces."""
        with self._lock:
            if self.word and not self.word.endswith(" "):
                self.word += " "
            logger.info("SPACE -> '%s'", self.word)

    def clear_word(self) -> None:
        """Empties the word."""
        with self._lock:
            self.word = ""
            logger.info("CLEAR")

    def get_word(self) -> str:
        """Returns the word built so far."""
        with self._lock:
            return self.word

    # ------------------------------------------------------------------
    # Prediction history
    # ------------------------------------------------------------------

    def clear_prediction_history(self) -> None:
        """Forgets recent predictions (e.g. when the hand disappears)."""
        self.probability_history.clear()
        self.prediction_history.clear()
        self.last_stable_prediction = None

    # ------------------------------------------------------------------
    # Frame processing
    # ------------------------------------------------------------------

    def process_image_bytes(self, image_bytes: bytes) -> dict | None:
        """Decodes an encoded image (JPEG/PNG) and processes it as a frame.

        Args:
            image_bytes (bytes): Encoded image.

        Returns:
            dict | None: Result of :meth:`process_frame`, or None if the
            bytes could not be decoded as an image.
        """
        if not image_bytes:
            return None

        buffer = np.frombuffer(image_bytes, dtype=np.uint8)
        frame = cv2.imdecode(buffer, cv2.IMREAD_COLOR)

        if frame is None:
            return None

        return self.process_frame(frame)

    def process_frame(self, frame: np.ndarray) -> dict:
        """Runs the full pipeline on a BGR frame.

        Args:
            frame (np.ndarray): BGR image as returned by OpenCV.

        Returns:
            dict: Detection state, prediction, confidence, stability,
            confirmed letter and the current word.
        """
        with self._lock:
            return self._process_frame(frame)

    def _next_timestamp_ms(self) -> int:
        """Returns a strictly increasing timestamp for VIDEO mode."""
        timestamp_ms = int(time.monotonic() * 1000)

        if timestamp_ms <= self._last_timestamp_ms:
            timestamp_ms = self._last_timestamp_ms + 1

        self._last_timestamp_ms = timestamp_ms
        return timestamp_ms

    def _process_frame(self, frame: np.ndarray) -> dict:
        if CAMERA_ROTATION is not None:
            frame = cv2.rotate(frame, CAMERA_ROTATION)

        if CAMERA_MIRROR:
            frame = cv2.flip(frame, 1)

        rgb_frame = np.ascontiguousarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))

        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        result = self.landmarker.detect_for_video(mp_image, self._next_timestamp_ms())

        # ----------------------------------------------------
        # No hand detected
        # ----------------------------------------------------

        if not result.hand_landmarks:
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
                "second_prediction": None,
                "second_confidence": 0.0,
                "confirmed": False,
                "confirmed_letter": None,
                "locked": False,
                "word": self.word,
            }

        # ----------------------------------------------------
        # Features
        # ----------------------------------------------------

        hand_landmarks = result.hand_landmarks[0]

        features = np.asarray(
            self.normalize_landmarks(hand_landmarks),
            dtype=np.float32,
        ).reshape(1, -1)

        # ----------------------------------------------------
        # Prediction
        # ----------------------------------------------------

        probabilities = self.model.predict_proba(features)[0]
        classes = self.model.classes_

        # ----------------------------------------------------
        # Probability history (temporal smoothing)
        # ----------------------------------------------------

        self.probability_history.append(probabilities)

        average_probabilities = np.mean(self.probability_history, axis=0)

        average_sorted = np.argsort(average_probabilities)[::-1]

        average_best_index = average_sorted[0]
        average_second_index = average_sorted[1]

        average_prediction = classes[average_best_index]

        average_confidence = float(average_probabilities[average_best_index])
        average_second_confidence = float(
            average_probabilities[average_second_index]
        )

        average_margin = average_confidence - average_second_confidence

        # ----------------------------------------------------
        # Validation
        # ----------------------------------------------------

        prediction_is_good = (
            average_confidence >= MIN_CONFIDENCE
            and average_margin >= MIN_MARGIN
        )

        if prediction_is_good:
            self.prediction_history.append(average_prediction)
        else:
            self.prediction_history.clear()

        # ----------------------------------------------------
        # Stability
        # ----------------------------------------------------

        stable = False
        stable_prediction = None

        if len(self.prediction_history) >= STABLE_FRAMES:
            values = list(self.prediction_history)

            most_common = max(set(values), key=values.count)

            if values.count(most_common) >= STABLE_FRAMES:
                stable = True
                stable_prediction = most_common
                self.last_stable_prediction = most_common

        # ----------------------------------------------------
        # Letter confirmation
        # ----------------------------------------------------

        confirmed = False
        confirmed_letter = None

        if stable and stable_prediction is not None and not self.letter_locked:
            confirmed = True
            confirmed_letter = str(stable_prediction)

            self.add_letter(confirmed_letter)

            # Keep the letter locked while the hand is still visible
            self.letter_locked = True

        # ----------------------------------------------------
        # Result
        # ----------------------------------------------------

        return {
            "detected": True,
            "prediction": str(average_prediction),
            "confidence": average_confidence,
            "margin": average_margin,
            "stable": stable,
            "stable_prediction": (
                str(stable_prediction) if stable_prediction is not None else None
            ),
            "second_prediction": str(classes[average_second_index]),
            "second_confidence": average_second_confidence,
            "confirmed": confirmed,
            "confirmed_letter": confirmed_letter,
            "locked": self.letter_locked,
            "word": self.word,
        }

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def reset(self) -> None:
        """Clears the prediction history, the word and the letter lock."""
        with self._lock:
            self.clear_prediction_history()
            self.word = ""
            self.letter_locked = False

    def close(self) -> None:
        """Releases the MediaPipe resources."""
        with self._lock:
            self.landmarker.close()

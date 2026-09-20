import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

MODELS_DIR = PROJECT_ROOT / "models"
TTS_MODEL_PATH = MODELS_DIR / "es_ES-carlfm-x_low.onnx"

API_ROUTE = "/api"
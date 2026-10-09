import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
SERIAL_PORT = os.getenv("SERIAL_PORT") or "/dev/ttyACM0"

EMAIL_SMTP_HOST = os.environ.get("EMAIL_SMTP_HOST", "smtp.gmail.com")
EMAIL_SMTP_PORT = int(os.environ.get("EMAIL_SMTP_PORT", "465"))
EMAIL_USER = os.environ.get("EMAIL_USER", "")
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")
EMAIL_DEFAULT_TO = os.environ.get("EMAIL_DEFAULT_TO", "tpfinal8@gmail.com")

MODELS_DIR = PROJECT_ROOT / "models"
TTS_MODEL_PATH = MODELS_DIR / "es_AR-daniela-high.onnx"

API_ROUTE = "/api"

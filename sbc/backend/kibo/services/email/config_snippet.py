# Agregar a kibo/config.py
import os

EMAIL_SMTP_HOST = os.environ.get("EMAIL_SMTP_HOST", "smtp.gmail.com")
EMAIL_SMTP_PORT = int(os.environ.get("EMAIL_SMTP_PORT", "465"))
EMAIL_USER = os.environ.get("EMAIL_USER", "")           # remitente
EMAIL_PASSWORD = os.environ.get("EMAIL_PASSWORD", "")   # contraseña de aplicación
EMAIL_DEFAULT_TO = os.environ.get("EMAIL_DEFAULT_TO", "")  # destinatario por defecto

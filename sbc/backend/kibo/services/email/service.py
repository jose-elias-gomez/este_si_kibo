from fastapi import FastAPI

from kibo.config import API_ROUTE
from kibo.services.email._email import EmailSender
from kibo.services.email._email_endpoint import Router


class EmailService:

    @staticmethod
    def start(webserver: FastAPI):
        webserver.include_router(Router, prefix=API_ROUTE)

    @staticmethod
    def send_email(
        title: str,
        subject: str,
        to: str | None = None,
        image_bytes: bytes | None = None,
        image_type: str | None = None,
        image_name: str | None = None,
    ) -> str:
        return EmailSender.send(title, subject, to, image_bytes, image_type, image_name)

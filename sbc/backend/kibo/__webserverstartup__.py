import uvicorn

from fastapi import FastAPI
from starlette.middleware.cors import CORSMiddleware

def start(
    host: str = "0.0.0.0",
    port: int = 25566,
    lifespan = None,
):
    app = FastAPI(
        title="Web server",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=[
            "X-Transcription",
            "X-Reply-Text",
        ],
    )

    @app.get("/api/ping")
    def ping(): return "pong"

    uvicorn.run(
        app,
        host=host,
        port=port,
        reload=False,
    )

    return app
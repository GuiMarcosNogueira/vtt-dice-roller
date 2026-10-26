from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes.recognition import router as recognition_router
from app.routes.rolls import router as rolls_router

app = FastAPI(
    title="VTT Dice Roller API",
    version="0.1.0",
    description="API de reconhecimento óptico de dados e distribuição para VTTs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(recognition_router)
app.include_router(rolls_router)


@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "provider": settings.vision_provider,
        "model": settings.vision_model,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.host, port=settings.port, reload=True)

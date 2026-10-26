from fastapi import APIRouter, HTTPException, status
from app.schemas.dice import RecognizeRequest, RecognitionResult
from app.services.vision_service import VisionService

router = APIRouter(prefix="/api", tags=["Recognition"])
vision_service = VisionService()

@router.post("/recognize", response_model=RecognitionResult, status_code=status.HTTP_200_OK)
async def recognize_dice_endpoint(request: RecognizeRequest):
    try:
        result = await vision_service.recognize_dice(
            image_base64=request.image_base64,
            die_type_hint=request.die_type_hint
        )
        return result
    except ValueError as ve:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Erro de validação nos dados reconhecidos: {str(ve)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Falha ao processar imagem no modelo de visão: {str(e)}"
        )

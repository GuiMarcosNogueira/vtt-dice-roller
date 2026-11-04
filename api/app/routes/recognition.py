from typing import Annotated

from fastapi import APIRouter, Depends, Header, status

from app.auth import require_token
from app.errors import MissingApiKeyError, ProviderAuthError, UpstreamError, to_http_error
from app.providers import get_provider
from app.schemas.dice import RecognitionResult, RecognizeRequest
from app.services.vision_service import VisionService

router = APIRouter(prefix="/api", tags=["Recognition"])
vision_service = VisionService()


@router.post(
    "/recognize",
    response_model=RecognitionResult,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_token)],
)
async def recognize_dice_endpoint(
    request: RecognizeRequest,
    x_vision_api_key: Annotated[str | None, Header()] = None,
):
    api_key = x_vision_api_key or None
    user_service: VisionService | None = None
    try:
        provider = get_provider(request.provider)
        service = vision_service
        if provider.requires_user_key:
            if not api_key:
                raise MissingApiKeyError(provider.id)
            # Cliente por requisição: a chave do usuário não fica guardada no servidor
            user_service = service = VisionService(
                api_key=api_key,
                base_url=provider.base_url,
                model=request.model or provider.default_model,
                extra_body=provider.request_extras or None,
            )
        try:
            return await service.recognize_dice(
                image_base64=request.image_base64, die_type_hint=request.die_type_hint
            )
        except ProviderAuthError as e:
            if user_service is not None:
                raise
            # A chave recusada é a do .env: o usuário não tem como corrigi-la, é falha do servidor
            raise UpstreamError("O provedor recusou a chave configurada no servidor") from e
    except Exception as e:
        raise to_http_error(e, api_key) from e
    finally:
        if user_service is not None:
            await user_service.client.close()

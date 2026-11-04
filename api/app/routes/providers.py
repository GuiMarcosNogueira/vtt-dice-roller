from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, Header

from app.auth import require_token
from app.config import settings
from app.errors import (
    MissingApiKeyError,
    ProviderAuthError,
    UnknownProviderError,
    UpstreamError,
    UpstreamTimeoutError,
    to_http_error,
)
from app.providers import extract_vision_models, get_provider, list_providers

router = APIRouter(prefix="/api", tags=["Providers"], dependencies=[Depends(require_token)])


def _http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=settings.vision_timeout_seconds)


@router.get("/providers")
def list_providers_endpoint():
    return [
        {
            "id": p.id,
            "name": p.name,
            "default_model": p.default_model,
            "requires_user_key": p.requires_user_key,
        }
        for p in list_providers()
    ]


@router.get("/models")
async def list_models_endpoint(
    provider: str,
    x_vision_api_key: Annotated[str | None, Header()] = None,
):
    api_key = x_vision_api_key or None
    try:
        info = get_provider(provider)
        if not info.requires_user_key:
            raise UnknownProviderError(f"{provider} (não permite listar modelos)")
        if not api_key:
            raise MissingApiKeyError(info.id)

        try:
            async with _http_client() as client:
                response = await client.get(
                    f"{info.base_url}/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
        except httpx.TimeoutException as e:
            raise UpstreamTimeoutError(
                f"O provedor não respondeu em {settings.vision_timeout_seconds:g}s"
            ) from e
        except httpx.HTTPError as e:
            raise UpstreamError(f"Não foi possível contatar o provedor ({type(e).__name__})") from e

        if response.status_code in (401, 403):
            raise ProviderAuthError("Chave de API recusada pelo provedor")
        if response.status_code >= 400:
            raise UpstreamError(f"O provedor respondeu HTTP {response.status_code}")
        try:
            payload = response.json()
        except ValueError as e:
            raise UpstreamError("O provedor retornou uma resposta ilegível") from e

        return {"provider": info.id, "models": extract_vision_models(payload)}
    except Exception as e:
        raise to_http_error(e, api_key, action="Falha ao listar modelos do provedor") from e

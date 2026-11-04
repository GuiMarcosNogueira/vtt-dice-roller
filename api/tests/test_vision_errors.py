from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import openai
import pytest

from app.schemas.dice import DieType, RecognitionResult
from app.services.vision_service import (
    SYSTEM_PROMPT,
    InvalidReadingError,
    NoDieDetectedError,
    ProviderAuthError,
    UpstreamError,
    UpstreamTimeoutError,
    VisionService,
)

REQUEST = httpx.Request("POST", "https://example.com/v1/chat/completions")


def _completion(content):
    completion = MagicMock()
    choice = MagicMock()
    choice.message.content = content
    completion.choices = [choice]
    return completion


async def _recognize_with(content=None, side_effect=None):
    service = VisionService(api_key="k", base_url="https://example.com/v1", model="m")
    with patch.object(
        service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        if side_effect is not None:
            mock_create.side_effect = side_effect
        else:
            mock_create.return_value = _completion(content)
        return await service.recognize_dice(image_base64="1234567890abcdefghij")


def test_client_uses_configured_timeout_and_single_retry():
    service = VisionService(api_key="k", base_url="https://example.com/v1", timeout=7.5)
    assert service.timeout == 7.5
    assert service.client.timeout == 7.5
    assert service.client.max_retries == 1


def test_client_timeout_defaults_to_settings():
    service = VisionService(api_key="k", base_url="https://example.com/v1")
    assert service.timeout == 30


@pytest.mark.anyio
async def test_d10_zero_is_normalized_to_ten():
    result = await _recognize_with('{"die_type": "d10", "value": 0, "confidence": 0.9}')
    assert isinstance(result, RecognitionResult)
    assert result.die_type == DieType.D10
    assert result.value == 10


@pytest.mark.anyio
async def test_zero_is_not_normalized_for_other_dice():
    with pytest.raises(InvalidReadingError):
        await _recognize_with('{"die_type": "d20", "value": 0}')


@pytest.mark.anyio
@pytest.mark.parametrize(
    "content",
    [
        '{"detected": false, "explanation": "imagem borrada"}',
        '{"explanation": "sem dado"}',
        '{"die_type": null, "value": 3}',
        "{}",
    ],
)
async def test_missing_die_raises_no_die_detected(content):
    with pytest.raises(NoDieDetectedError):
        await _recognize_with(content)


@pytest.mark.anyio
async def test_no_die_detected_carries_explanation_or_default():
    with pytest.raises(NoDieDetectedError, match="imagem borrada"):
        await _recognize_with('{"detected": false, "explanation": "imagem borrada"}')
    with pytest.raises(NoDieDetectedError, match="Nenhum dado identificado"):
        await _recognize_with('{"detected": false}')


@pytest.mark.anyio
@pytest.mark.parametrize(
    "content",
    [
        '{"die_type": "d6", "value": 9}',
        '{"die_type": "d3", "value": 2}',
        '{"die_type": "d6"}',
        '{"die_type": "d6", "value": "abc"}',
        '{"die_type": "d6", "value": 3, "confidence": 5}',
    ],
)
async def test_unusable_reading_raises_invalid_reading(content):
    with pytest.raises(InvalidReadingError):
        await _recognize_with(content)


@pytest.mark.anyio
@pytest.mark.parametrize("content", ["isto não é json", "[1, 2, 3]"])
async def test_unparseable_response_raises_upstream_error(content):
    with pytest.raises(UpstreamError):
        await _recognize_with(content)


@pytest.mark.anyio
async def test_provider_timeout_raises_upstream_timeout():
    with pytest.raises(UpstreamTimeoutError, match="30s"):
        await _recognize_with(side_effect=openai.APITimeoutError(request=REQUEST))


@pytest.mark.anyio
async def test_provider_api_error_raises_upstream_error():
    error = openai.APIError("cota excedida", request=REQUEST, body=None)
    with pytest.raises(UpstreamError, match="cota excedida") as exc_info:
        await _recognize_with(side_effect=error)
    assert not isinstance(exc_info.value, UpstreamTimeoutError)


def test_prompt_describes_not_detected_response():
    assert '"detected": false' in SYSTEM_PROMPT


@pytest.mark.anyio
@pytest.mark.parametrize(
    ("error_class", "status_code"),
    [(openai.AuthenticationError, 401), (openai.PermissionDeniedError, 403)],
)
async def test_auth_failure_raises_provider_auth_error_with_fixed_message(error_class, status_code):
    response = httpx.Response(status_code, request=REQUEST)
    error = error_class("Incorrect API key provided: sk-abc***xyz", response=response, body=None)

    with pytest.raises(ProviderAuthError) as exc_info:
        await _recognize_with(side_effect=error)

    assert "sk-abc" not in str(exc_info.value)
    assert not isinstance(exc_info.value, UpstreamError)


@pytest.mark.anyio
async def test_other_status_errors_stay_upstream_errors():
    response = httpx.Response(500, request=REQUEST)
    error = openai.InternalServerError("falha interna", response=response, body=None)

    with pytest.raises(UpstreamError) as exc_info:
        await _recognize_with(side_effect=error)

    assert not isinstance(exc_info.value, ProviderAuthError)


@pytest.mark.anyio
@pytest.mark.parametrize("extra", [None, {"thinking": {"type": "disabled"}}])
async def test_extra_body_is_forwarded_to_the_provider(extra):
    service = VisionService(
        api_key="k", base_url="https://example.com/v1", model="m", extra_body=extra
    )
    with patch.object(
        service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = _completion('{"die_type": "d6", "value": 3}')
        await service.recognize_dice(image_base64="1234567890abcdefghij")

    assert mock_create.call_args.kwargs["extra_body"] == extra

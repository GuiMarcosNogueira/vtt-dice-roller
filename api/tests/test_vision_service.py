from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.dice import DieType
from app.services.vision_service import SYSTEM_PROMPT, VisionService


@pytest.mark.anyio
async def test_vision_service_initialization_and_mock_call():
    service = VisionService(
        api_key="test_key",
        base_url="https://openrouter.ai/api/v1",
        model="google/gemini-2.0-flash-001",
    )

    mock_chat_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = (
        '{"die_type": "d20", "value": 18, "confidence": 0.98, "explanation": "Face 18 no topo"}'
    )
    mock_chat_completion.choices = [mock_choice]

    with patch.object(
        service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_chat_completion

        result = await service.recognize_dice(
            image_base64="1234567890abcdefghij", die_type_hint=DieType.D20
        )

        assert result.die_type == DieType.D20
        assert result.value == 18
        assert result.confidence == 0.98
        assert result.raw_explanation == "Face 18 no topo"

        # Verify call payload
        mock_create.assert_called_once()
        kwargs = mock_create.call_args.kwargs
        assert kwargs["model"] == "google/gemini-2.0-flash-001"
        assert kwargs["messages"][0]["content"] == SYSTEM_PROMPT
        assert "d20" in kwargs["messages"][1]["content"][0]["text"]
        assert kwargs["messages"][1]["content"][1]["image_url"]["url"].startswith(
            "data:image/jpeg;base64,"
        )


@pytest.mark.anyio
async def test_vision_service_non_openrouter_and_no_hint():
    # Non-openrouter base_url (ex: MGC AI Hub or local)
    service = VisionService(
        api_key="mgc_key",
        base_url="https://ai.magalucloud.com.br/v1",
        model="qwen-2.5-vl-72b",
    )

    # Response wrapped in markdown block
    mock_chat_completion = MagicMock()
    mock_choice = MagicMock()
    mock_choice.message.content = '```json\n{"die_type": "d6", "value": 5, "confidence": 0.95, "explanation": "Face 5 voltada para cima"}\n```'
    mock_chat_completion.choices = [mock_choice]

    with patch.object(
        service.client.chat.completions, "create", new_callable=AsyncMock
    ) as mock_create:
        mock_create.return_value = mock_chat_completion

        # Image that already has data:image prefix
        result = await service.recognize_dice(
            image_base64="data:image/png;base64,abcdef1234567890", die_type_hint=None
        )

        assert result.die_type == DieType.D6
        assert result.value == 5
        assert result.confidence == 0.95
        assert result.raw_explanation == "Face 5 voltada para cima"

        kwargs = mock_create.call_args.kwargs
        # Without hint, text prompt shouldn't contain hint text
        assert "Dica:" not in kwargs["messages"][1]["content"][0]["text"]
        assert kwargs["messages"][1]["content"][1]["image_url"]["url"].startswith(
            "data:image/png;base64,"
        )


def test_format_image_url_and_parse_json():
    service = VisionService()
    # Already formatted
    assert service.format_image_url("data:image/webp;base64,xyz") == "data:image/webp;base64,xyz"
    # Needs prefix
    assert service.format_image_url("xyz") == "data:image/jpeg;base64,xyz"

    # Markdown without json tag
    parsed = service.parse_json_response('```\n{"die_type": "d8", "value": 3}\n```')
    assert parsed["die_type"] == "d8"
    assert parsed["value"] == 3


def test_prompt_rules_contain_dice_types():
    assert "d4" in SYSTEM_PROMPT
    assert "d6" in SYSTEM_PROMPT
    assert "d8" in SYSTEM_PROMPT
    assert "d10" in SYSTEM_PROMPT
    assert "d12" in SYSTEM_PROMPT
    assert "d20" in SYSTEM_PROMPT
    assert "d100" in SYSTEM_PROMPT
    assert "SUPERIOR" in SYSTEM_PROMPT
    assert "ZÊNITE" in SYSTEM_PROMPT

import logging
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from app.errors import ProviderAuthError, UpstreamError
from app.schemas.dice import DieType, RecognitionResult
from main import app

client = TestClient(app)

KEY = "sk-chave-do-usuario-123"
BODY = {"image_base64": "data:image/jpeg;base64,1234567890abcdefghij"}
RESULT = RecognitionResult(die_type=DieType.D20, value=14, confidence=0.9)


class FakeVisionService:
    """Substitui VisionService para as chamadas com chave do usuário."""

    instances: list["FakeVisionService"] = []
    result: object = RESULT

    def __init__(self, api_key=None, base_url=None, model=None, timeout=None, extra_body=None):
        self.extra_body = extra_body
        self.api_key = api_key
        self.base_url = base_url
        self.model = model
        self.client = SimpleNamespace(close=AsyncMock())
        self.recognize_dice = AsyncMock(side_effect=self._recognize)
        FakeVisionService.instances.append(self)

    async def _recognize(self, **kwargs):
        if isinstance(FakeVisionService.result, Exception):
            raise FakeVisionService.result
        return FakeVisionService.result


@pytest.fixture
def fake_service():
    FakeVisionService.instances = []
    FakeVisionService.result = RESULT
    with patch("app.routes.recognition.VisionService", FakeVisionService):
        yield FakeVisionService


@pytest.fixture
def server_service():
    with patch(
        "app.routes.recognition.vision_service.recognize_dice", new_callable=AsyncMock
    ) as mock_recognize:
        mock_recognize.return_value = RESULT
        yield mock_recognize


def post(body=None, key=KEY):
    headers = {"X-Vision-Api-Key": key} if key is not None else {}
    return client.post("/api/recognize", json={**BODY, **(body or {})}, headers=headers)


def test_deepseek_uses_user_key_model_and_catalog_url(fake_service, server_service):
    response = post({"provider": "deepseek", "model": "deepseek-v4-x"})

    assert response.status_code == 200
    assert response.json()["value"] == 14
    (service,) = fake_service.instances
    assert service.api_key == KEY
    assert service.base_url == "https://api.deepseek.com"
    assert service.model == "deepseek-v4-x"
    service.recognize_dice.assert_awaited_once()
    server_service.assert_not_called()


@pytest.mark.parametrize(
    ("provider", "default_model"),
    [("deepseek", "deepseek-flash"), ("openrouter", "google/gemini-2.5-flash")],
)
def test_omitted_model_uses_provider_default(fake_service, provider, default_model):
    response = post({"provider": provider})

    assert response.status_code == 200
    assert fake_service.instances[0].model == default_model


def test_deepseek_runs_with_thinking_disabled_and_openrouter_without_extras(fake_service):
    post({"provider": "deepseek"})
    post({"provider": "openrouter"})

    deepseek, openrouter = fake_service.instances
    assert deepseek.extra_body == {"thinking": {"type": "disabled"}}
    assert openrouter.extra_body is None


def test_user_client_is_closed_after_success(fake_service):
    post({"provider": "openrouter"})

    fake_service.instances[0].client.close.assert_awaited_once()


@pytest.mark.parametrize("body", [{}, {"provider": "server"}, {"provider": None}])
def test_without_user_provider_uses_server_default(fake_service, server_service, body):
    response = post(body, key=None)

    assert response.status_code == 200
    server_service.assert_awaited_once()
    assert fake_service.instances == []


def test_server_provider_ignores_a_sent_key(fake_service, server_service):
    response = post({"provider": "server", "model": "qualquer"})

    assert response.status_code == 200
    server_service.assert_awaited_once()
    assert fake_service.instances == []


@pytest.mark.parametrize("key", [None, ""])
def test_missing_key_never_falls_back_to_server_key(fake_service, server_service, key):
    response = post({"provider": "deepseek"}, key=key)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "missing_api_key"
    assert fake_service.instances == []
    server_service.assert_not_called()


@pytest.mark.parametrize("provider", ["openai", "http://evil.example", "DeepSeek"])
def test_unknown_provider_is_rejected_before_any_call(fake_service, server_service, provider):
    response = post({"provider": provider})

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "unknown_provider"
    assert fake_service.instances == []
    server_service.assert_not_called()


def test_provider_rejecting_key_returns_400_and_closes_client(fake_service):
    fake_service.result = ProviderAuthError("Chave de API recusada pelo provedor")

    response = post({"provider": "deepseek"})

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "provider_auth_error"
    fake_service.instances[0].client.close.assert_awaited_once()


def test_key_never_appears_in_error_message_or_logs(fake_service, caplog):
    fake_service.result = UpstreamError(f"falha com a chave {KEY} no provedor")

    with caplog.at_level(logging.DEBUG):
        response = post({"provider": "deepseek"})

    assert response.status_code == 502
    assert KEY not in response.text
    assert "***" in response.json()["detail"]["message"]
    assert KEY not in caplog.text
    fake_service.instances[0].client.close.assert_awaited_once()


def test_key_header_does_not_replace_api_token_check(fake_service, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "api_token", "token-da-mesa")

    denied = post({"provider": "deepseek"})
    allowed = client.post(
        "/api/recognize",
        json={**BODY, "provider": "deepseek"},
        headers={"X-Vision-Api-Key": KEY, "Authorization": "Bearer token-da-mesa"},
    )

    assert denied.status_code == 401
    assert fake_service.instances and len(fake_service.instances) == 1
    assert allowed.status_code == 200


def test_rejected_server_key_is_a_server_failure_not_a_user_error(server_service):
    server_service.side_effect = ProviderAuthError("Chave de API recusada pelo provedor")

    response = post({}, key=None)

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert detail["code"] == "upstream_error"
    assert "chave configurada no servidor" in detail["message"]


def test_rejected_server_key_with_explicit_server_provider(server_service):
    server_service.side_effect = ProviderAuthError("Chave de API recusada pelo provedor")

    response = post({"provider": "server"}, key=None)

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "upstream_error"

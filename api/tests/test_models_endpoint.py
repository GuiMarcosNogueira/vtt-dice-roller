import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from main import app

client = TestClient(app)

KEY = "sk-chave-do-usuario-123"
HEADERS = {"X-Vision-Api-Key": KEY}

DEEPSEEK_MODELS = {
    "data": [
        {"id": "deepseek-v4-pro", "name": "DeepSeek-V4-Pro", "input_modalities": ["text"]},
        {
            "id": "deepseek-flash",
            "name": "DeepSeek-V4.1-Flash",
            "input_modalities": ["text", "image"],
        },
    ]
}
OPENROUTER_MODELS = {
    "data": [
        {
            "id": "google/gemini-2.5-flash",
            "name": "Google: Gemini 2.5 Flash",
            "architecture": {"input_modalities": ["text", "image"]},
        },
        {
            "id": "meta/text-only",
            "name": "Meta: Text Only",
            "architecture": {"input_modalities": ["text"]},
        },
    ]
}


@pytest.fixture
def upstream(monkeypatch):
    """Substitui o cliente HTTP por um transporte simulado e registra as chamadas."""
    calls: list[httpx.Request] = []
    state = {"handler": lambda request: httpx.Response(200, json={"data": []})}

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        return state["handler"](request)

    monkeypatch.setattr(
        "app.routes.providers._http_client",
        lambda: httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )
    return type("Upstream", (), {"calls": calls, "state": state})


def respond_with(upstream, handler):
    upstream.state["handler"] = handler


def test_deepseek_models_are_filtered_and_use_user_key(upstream):
    respond_with(upstream, lambda r: httpx.Response(200, json=DEEPSEEK_MODELS))

    response = client.get("/api/models", params={"provider": "deepseek"}, headers=HEADERS)

    assert response.status_code == 200
    assert response.json() == {
        "provider": "deepseek",
        "models": [{"id": "deepseek-flash", "name": "DeepSeek-V4.1-Flash"}],
    }
    assert len(upstream.calls) == 1
    assert str(upstream.calls[0].url) == "https://api.deepseek.com/models"
    assert upstream.calls[0].headers["Authorization"] == f"Bearer {KEY}"


def test_openrouter_models_are_filtered(upstream):
    respond_with(upstream, lambda r: httpx.Response(200, json=OPENROUTER_MODELS))

    response = client.get("/api/models", params={"provider": "openrouter"}, headers=HEADERS)

    assert response.status_code == 200
    assert response.json()["models"] == [
        {"id": "google/gemini-2.5-flash", "name": "Google: Gemini 2.5 Flash"}
    ]
    assert str(upstream.calls[0].url) == "https://openrouter.ai/api/v1/models"


@pytest.mark.parametrize("upstream_status", [401, 403])
def test_provider_rejecting_key_returns_provider_auth_error(upstream, upstream_status):
    respond_with(
        upstream, lambda r: httpx.Response(upstream_status, text=f"bad key {KEY} for request")
    )

    response = client.get("/api/models", params={"provider": "deepseek"}, headers=HEADERS)

    assert response.status_code == 400
    assert response.json()["detail"]["code"] == "provider_auth_error"
    assert KEY not in response.text


def test_provider_server_error_returns_upstream_error(upstream):
    respond_with(upstream, lambda r: httpx.Response(500, text=f"erro com {KEY}"))

    response = client.get("/api/models", params={"provider": "deepseek"}, headers=HEADERS)

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "upstream_error"
    assert "500" in response.json()["detail"]["message"]
    assert KEY not in response.text


def test_unreadable_response_returns_upstream_error(upstream):
    respond_with(upstream, lambda r: httpx.Response(200, text="isto não é json"))

    response = client.get("/api/models", params={"provider": "openrouter"}, headers=HEADERS)

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "upstream_error"


def test_provider_timeout_returns_upstream_timeout(upstream):
    def raise_timeout(request):
        raise httpx.ReadTimeout("lento", request=request)

    respond_with(upstream, raise_timeout)

    response = client.get("/api/models", params={"provider": "deepseek"}, headers=HEADERS)

    assert response.status_code == 504
    assert response.json()["detail"]["code"] == "upstream_timeout"
    assert f"{settings.vision_timeout_seconds:g}s" in response.json()["detail"]["message"]


def test_connection_failure_returns_upstream_error(upstream):
    def refuse(request):
        raise httpx.ConnectError(f"falhou com {KEY}", request=request)

    respond_with(upstream, refuse)

    response = client.get("/api/models", params={"provider": "deepseek"}, headers=HEADERS)

    assert response.status_code == 502
    assert response.json()["detail"]["code"] == "upstream_error"
    assert "ConnectError" in response.json()["detail"]["message"]
    assert KEY not in response.text


def test_missing_key_does_not_contact_provider(upstream):
    for headers in ({}, {"X-Vision-Api-Key": ""}):
        response = client.get("/api/models", params={"provider": "deepseek"}, headers=headers)

        assert response.status_code == 422
        assert response.json()["detail"]["code"] == "missing_api_key"
    assert upstream.calls == []


@pytest.mark.parametrize("provider", ["openai", "http://evil.example", "server"])
def test_unknown_or_server_provider_does_not_contact_anyone(upstream, provider):
    response = client.get("/api/models", params={"provider": provider}, headers=HEADERS)

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "unknown_provider"
    assert upstream.calls == []


def test_models_requires_api_token_when_configured(upstream, monkeypatch):
    monkeypatch.setattr(settings, "api_token", "token-da-mesa")
    respond_with(upstream, lambda r: httpx.Response(200, json=DEEPSEEK_MODELS))

    denied = client.get("/api/models", params={"provider": "deepseek"}, headers=HEADERS)
    allowed = client.get(
        "/api/models",
        params={"provider": "deepseek"},
        headers={**HEADERS, "Authorization": "Bearer token-da-mesa"},
    )

    assert denied.status_code == 401
    assert denied.json()["detail"]["code"] == "unauthorized"
    assert allowed.status_code == 200


def test_providers_endpoint_lists_catalog():
    response = client.get("/api/providers")

    assert response.status_code == 200
    providers = {p["id"]: p for p in response.json()}
    assert list(providers) == ["server", "deepseek", "openrouter"]
    assert providers["server"]["requires_user_key"] is False
    assert providers["deepseek"] == {
        "id": "deepseek",
        "name": "DeepSeek",
        "default_model": "deepseek-flash",
        "requires_user_key": True,
    }
    assert providers["openrouter"]["requires_user_key"] is True


def test_providers_endpoint_requires_api_token_when_configured(monkeypatch):
    monkeypatch.setattr(settings, "api_token", "token-da-mesa")

    assert client.get("/api/providers").status_code == 401
    ok = client.get("/api/providers", headers={"Authorization": "Bearer token-da-mesa"})
    assert ok.status_code == 200


def test_http_client_uses_configured_timeout():
    from app.routes.providers import _http_client

    assert _http_client().timeout.read == settings.vision_timeout_seconds

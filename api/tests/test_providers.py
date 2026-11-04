import pytest

from app.config import settings
from app.errors import UnknownProviderError
from app.providers import get_provider, list_providers


def test_catalog_contains_server_deepseek_and_openrouter():
    providers = {p.id: p for p in list_providers()}

    assert list(providers) == ["server", "deepseek", "openrouter"]
    assert providers["server"].requires_user_key is False
    assert providers["server"].base_url is None
    assert providers["deepseek"].requires_user_key is True
    assert providers["deepseek"].base_url == "https://api.deepseek.com"
    assert providers["deepseek"].default_model == "deepseek-flash"
    assert providers["openrouter"].requires_user_key is True
    assert providers["openrouter"].base_url == "https://openrouter.ai/api/v1"
    assert providers["openrouter"].default_model


def test_server_provider_reflects_current_settings(monkeypatch):
    monkeypatch.setattr(settings, "vision_model", "modelo-do-servidor")

    assert get_provider("server").default_model == "modelo-do-servidor"


@pytest.mark.parametrize("provider_id", [None, "server"])
def test_missing_or_server_id_resolves_to_server(provider_id):
    assert get_provider(provider_id).id == "server"


def test_get_provider_returns_catalog_entry():
    assert get_provider("deepseek").name == "DeepSeek"


@pytest.mark.parametrize("provider_id", ["openai", "", "DeepSeek", "http://evil.example"])
def test_unknown_provider_raises(provider_id):
    with pytest.raises(UnknownProviderError):
        get_provider(provider_id)


def test_deepseek_disables_thinking_and_other_providers_add_nothing():
    assert get_provider("deepseek").request_extras == {"thinking": {"type": "disabled"}}
    assert get_provider("openrouter").request_extras == {}
    assert get_provider("server").request_extras == {}

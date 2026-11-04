import importlib

import pytest

import app.config as config_module


@pytest.fixture
def restore_settings():
    original = config_module.settings
    yield
    importlib.reload(config_module)
    config_module.settings = original


def test_config_defaults(monkeypatch, restore_settings):
    monkeypatch.delenv("VISION_TIMEOUT_SECONDS", raising=False)
    monkeypatch.delenv("API_TOKEN", raising=False)
    monkeypatch.setattr("dotenv.load_dotenv", lambda *a, **k: False)
    reloaded = importlib.reload(config_module)
    assert reloaded.settings.vision_timeout_seconds == 30
    assert reloaded.settings.api_token == ""


def test_config_reads_environment(monkeypatch, restore_settings):
    monkeypatch.setenv("VISION_TIMEOUT_SECONDS", "12.5")
    monkeypatch.setenv("API_TOKEN", "segredo")
    reloaded = importlib.reload(config_module)
    assert reloaded.settings.vision_timeout_seconds == 12.5
    assert reloaded.settings.api_token == "segredo"

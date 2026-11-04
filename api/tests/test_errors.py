import pytest

from app.errors import (
    InvalidReadingError,
    MissingApiKeyError,
    NoDieDetectedError,
    ProviderAuthError,
    UnknownProviderError,
    UpstreamError,
    UpstreamTimeoutError,
    scrub,
    to_http_error,
)


@pytest.mark.parametrize(
    ("exc", "status_code", "code"),
    [
        (UnknownProviderError("openai"), 422, "unknown_provider"),
        (MissingApiKeyError("deepseek"), 422, "missing_api_key"),
        (ProviderAuthError("recusada"), 400, "provider_auth_error"),
        (NoDieDetectedError("borrada"), 422, "no_die_detected"),
        (InvalidReadingError("face 25"), 422, "invalid_reading"),
        (UpstreamTimeoutError("sem resposta"), 504, "upstream_timeout"),
        (UpstreamError("cota excedida"), 502, "upstream_error"),
        (RuntimeError("inesperado"), 502, "upstream_error"),
    ],
)
def test_to_http_error_maps_each_exception(exc, status_code, code):
    error = to_http_error(exc)

    assert error.status_code == status_code
    assert error.detail["code"] == code
    assert error.detail["message"]


def test_unknown_provider_message_names_the_provider():
    assert "openai" in to_http_error(UnknownProviderError("openai")).detail["message"]


def test_provider_auth_error_uses_fixed_message():
    error = to_http_error(ProviderAuthError("texto do provedor com sk-abc"))

    assert "sk-abc" not in error.detail["message"]


def test_generic_error_uses_given_action_prefix():
    error = to_http_error(RuntimeError("falhou"), action="Falha ao listar modelos")

    assert error.detail["message"] == "Falha ao listar modelos: falhou"


def test_to_http_error_scrubs_api_key_from_message():
    error = to_http_error(UpstreamError("chave sk-secreta-123 inválida"), api_key="sk-secreta-123")

    assert "sk-secreta-123" not in error.detail["message"]
    assert "***" in error.detail["message"]


def test_scrub_without_key_keeps_message():
    assert scrub("mensagem", None) == "mensagem"
    assert scrub("mensagem", "") == "mensagem"
    assert scrub("a sk-1 b sk-1", "sk-1") == "a *** b ***"

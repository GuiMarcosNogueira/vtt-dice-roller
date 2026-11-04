from fastapi import HTTPException


class NoDieDetectedError(Exception):
    """A imagem não contém um dado que possa ser lido."""


class InvalidReadingError(Exception):
    """O modelo retornou uma leitura incompatível com o dado."""


class UpstreamError(Exception):
    """O provedor de visão falhou ou retornou algo que não pode ser interpretado."""


class UpstreamTimeoutError(UpstreamError):
    """O provedor de visão não respondeu dentro do timeout configurado."""


class UnknownProviderError(Exception):
    """O provedor informado não existe no catálogo."""


class MissingApiKeyError(Exception):
    """O provedor exige a chave de API do usuário e ela não foi informada."""


class ProviderAuthError(Exception):
    """O provedor recusou a chave de API informada."""


def scrub(message: str, api_key: str | None) -> str:
    """Remove a chave de API do usuário de qualquer texto que vá para a resposta."""
    if not api_key:
        return message
    return message.replace(api_key, "***")


def to_http_error(
    exc: Exception,
    api_key: str | None = None,
    action: str = "Falha ao processar imagem no modelo de visão",
) -> HTTPException:
    """Traduz as exceções de domínio para o formato de erro {code, message}."""
    if isinstance(exc, UnknownProviderError):
        status_code, code, message = 422, "unknown_provider", f"Provedor desconhecido: {exc!s}"
    elif isinstance(exc, MissingApiKeyError):
        status_code, code, message = (
            422,
            "missing_api_key",
            "Informe a chave de API do provedor selecionado.",
        )
    elif isinstance(exc, ProviderAuthError):
        status_code, code, message = (
            400,
            "provider_auth_error",
            "A chave de API foi recusada pelo provedor.",
        )
    elif isinstance(exc, NoDieDetectedError):
        status_code, code, message = (
            422,
            "no_die_detected",
            f"Nenhum dado foi identificado na imagem: {exc!s}",
        )
    elif isinstance(exc, InvalidReadingError):
        status_code, code, message = (
            422,
            "invalid_reading",
            f"Erro de validação nos dados reconhecidos: {exc!s}",
        )
    elif isinstance(exc, UpstreamTimeoutError):
        status_code, code, message = 504, "upstream_timeout", str(exc)
    else:
        status_code, code, message = 502, "upstream_error", f"{action}: {exc!s}"

    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": scrub(message, api_key)},
    )

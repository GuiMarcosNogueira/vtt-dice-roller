from dataclasses import dataclass, field

from app.config import settings
from app.errors import UnknownProviderError

SERVER_PROVIDER_ID = "server"


@dataclass(frozen=True)
class Provider:
    id: str
    name: str
    base_url: str | None
    default_model: str
    requires_user_key: bool
    # Parâmetros extras (corpo da requisição) específicos do provedor
    request_extras: dict = field(default_factory=dict)


# URLs fixas: o usuário escolhe o provedor, nunca o endereço (evita SSRF).
_USER_KEY_PROVIDERS: dict[str, Provider] = {
    "deepseek": Provider(
        id="deepseek",
        name="DeepSeek",
        base_url="https://api.deepseek.com",
        default_model="deepseek-flash",
        requires_user_key=True,
        # O raciocínio vem ligado por padrão e consome o max_tokens curto da leitura antes
        # do JSON ser escrito (resposta cortada/vazia). Para ler um dado não é necessário.
        request_extras={"thinking": {"type": "disabled"}},
    ),
    "openrouter": Provider(
        id="openrouter",
        name="OpenRouter",
        base_url="https://openrouter.ai/api/v1",
        default_model="google/gemini-2.5-flash",
        requires_user_key=True,
    ),
}


def _server_provider() -> Provider:
    # Lido a cada chamada para refletir o .env atual do servidor
    return Provider(
        id=SERVER_PROVIDER_ID,
        name="Padrão do servidor",
        base_url=None,
        default_model=settings.vision_model,
        requires_user_key=False,
    )


def list_providers() -> list[Provider]:
    return [_server_provider(), *_USER_KEY_PROVIDERS.values()]


def get_provider(provider_id: str | None) -> Provider:
    """Resolve o provedor; `None` significa o padrão do servidor."""
    if provider_id is None or provider_id == SERVER_PROVIDER_ID:
        return _server_provider()
    try:
        return _USER_KEY_PROVIDERS[provider_id]
    except KeyError:
        raise UnknownProviderError(provider_id) from None


def _input_modalities(model: dict) -> list | None:
    """DeepSeek: `input_modalities`; OpenRouter: `architecture.input_modalities`."""
    modalities = model.get("input_modalities")
    if modalities is None:
        architecture = model.get("architecture")
        if isinstance(architecture, dict):
            modalities = architecture.get("input_modalities")
    return modalities if isinstance(modalities, list) else None


def extract_vision_models(payload: object) -> list[dict[str, str]]:
    """Filtra a resposta de `GET /models` mantendo os modelos que aceitam imagem.

    Modelos sem informação de modalidade são mantidos; só saem os que declaram
    explicitamente não aceitar imagem.
    """
    items = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(items, list):
        return []

    models = []
    for item in items:
        if not isinstance(item, dict) or not item.get("id"):
            continue
        modalities = _input_modalities(item)
        if modalities is not None and "image" not in modalities:
            continue
        models.append({"id": item["id"], "name": item.get("name") or item["id"]})
    return sorted(models, key=lambda m: m["name"].lower())

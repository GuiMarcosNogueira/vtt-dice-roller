from app.providers import extract_vision_models

# Formato do GET https://api.deepseek.com/models (documentação oficial)
DEEPSEEK_PAYLOAD = {
    "object": "list",
    "data": [
        {
            "id": "deepseek-v4-pro",
            "object": "model",
            "owned_by": "deepseek",
            "name": "DeepSeek-V4-Pro",
            "input_modalities": ["text"],
            "output_modalities": ["text"],
        },
        {
            "id": "deepseek-flash",
            "object": "model",
            "owned_by": "deepseek",
            "name": "DeepSeek-V4.1-Flash",
            "input_modalities": ["text", "image"],
            "output_modalities": ["text"],
        },
    ],
}

# Formato do GET https://openrouter.ai/api/v1/models
OPENROUTER_PAYLOAD = {
    "data": [
        {
            "id": "openai/gpt-text-only",
            "name": "OpenAI: Text Only",
            "architecture": {"modality": "text->text", "input_modalities": ["text"]},
        },
        {
            "id": "google/gemini-2.5-flash",
            "name": "Google: Gemini 2.5 Flash",
            "architecture": {
                "modality": "text+image->text",
                "input_modalities": ["text", "image"],
            },
        },
        {
            "id": "anthropic/claude-vision",
            "name": "Anthropic: Claude Vision",
            "architecture": {"input_modalities": ["image", "text", "file"]},
        },
    ]
}


def test_deepseek_keeps_only_models_with_image_input():
    assert extract_vision_models(DEEPSEEK_PAYLOAD) == [
        {"id": "deepseek-flash", "name": "DeepSeek-V4.1-Flash"}
    ]


def test_openrouter_keeps_only_models_with_image_input_sorted_by_name():
    assert extract_vision_models(OPENROUTER_PAYLOAD) == [
        {"id": "anthropic/claude-vision", "name": "Anthropic: Claude Vision"},
        {"id": "google/gemini-2.5-flash", "name": "Google: Gemini 2.5 Flash"},
    ]


def test_model_without_modality_info_is_kept():
    payload = {
        "data": [
            {"id": "sem-metadados", "name": "Sem Metadados"},
            {"id": "arquitetura-vazia", "architecture": {}},
            {"id": "modalidade-invalida", "input_modalities": "image"},
            {"id": "so-texto", "input_modalities": ["text"]},
        ]
    }

    assert extract_vision_models(payload) == [
        {"id": "arquitetura-vazia", "name": "arquitetura-vazia"},
        {"id": "modalidade-invalida", "name": "modalidade-invalida"},
        {"id": "sem-metadados", "name": "Sem Metadados"},
    ]


def test_name_falls_back_to_id():
    payload = {"data": [{"id": "so-id", "input_modalities": ["image"]}]}

    assert extract_vision_models(payload) == [{"id": "so-id", "name": "so-id"}]


def test_invalid_items_are_skipped():
    payload = {"data": ["texto", None, {"name": "sem id"}, {"id": ""}, {"id": "ok"}]}

    assert extract_vision_models(payload) == [{"id": "ok", "name": "ok"}]


def test_unexpected_payloads_return_empty_list():
    assert extract_vision_models({}) == []
    assert extract_vision_models({"data": "x"}) == []
    assert extract_vision_models([]) == []
    assert extract_vision_models(None) == []

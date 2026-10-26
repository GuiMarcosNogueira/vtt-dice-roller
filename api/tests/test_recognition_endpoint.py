from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.schemas.dice import DieType, RecognitionResult
from main import app

client = TestClient(app)


def test_recognize_endpoint_success():
    mock_result = RecognitionResult(
        die_type=DieType.D20,
        value=19,
        confidence=0.97,
        raw_explanation="Dado d20 com 19 voltado para cima.",
    )

    with patch(
        "app.routes.recognition.vision_service.recognize_dice", new_callable=AsyncMock
    ) as mock_recognize:
        mock_recognize.return_value = mock_result

        response = client.post(
            "/api/recognize",
            json={
                "image_base64": "data:image/jpeg;base64,1234567890abcdefghij",
                "die_type_hint": "d20",
            },
        )

        assert response.status_code == 200
        data = response.json()
        assert data["die_type"] == "d20"
        assert data["value"] == 19
        assert data["confidence"] == 0.97


def test_recognize_endpoint_invalid_body():
    # Empty image should fail schema validation (422)
    response = client.post("/api/recognize", json={"image_base64": ""})
    assert response.status_code == 422


def test_recognize_endpoint_value_error_raises_422():
    with patch(
        "app.routes.recognition.vision_service.recognize_dice", new_callable=AsyncMock
    ) as mock_recognize:
        mock_recognize.side_effect = ValueError("Dado d20 retornou face 25 inválida")

        response = client.post(
            "/api/recognize",
            json={"image_base64": "data:image/jpeg;base64,1234567890abcdefghij"},
        )

        assert response.status_code == 422
        data = response.json()
        assert "Erro de validação" in data["detail"]
        assert "25 inválida" in data["detail"]


def test_recognize_endpoint_upstream_exception_raises_502():
    with patch(
        "app.routes.recognition.vision_service.recognize_dice", new_callable=AsyncMock
    ) as mock_recognize:
        mock_recognize.side_effect = RuntimeError("Conexão expirada com OpenRouter")

        response = client.post(
            "/api/recognize",
            json={"image_base64": "data:image/jpeg;base64,1234567890abcdefghij"},
        )

        assert response.status_code == 502
        data = response.json()
        assert "Falha ao processar imagem" in data["detail"]
        assert "Conexão expirada" in data["detail"]

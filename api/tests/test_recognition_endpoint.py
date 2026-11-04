from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

from app.schemas.dice import DieType, RecognitionResult
from app.services.vision_service import (
    InvalidReadingError,
    NoDieDetectedError,
    UpstreamError,
    UpstreamTimeoutError,
)
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


def _post_with_error(exc):
    with patch(
        "app.routes.recognition.vision_service.recognize_dice", new_callable=AsyncMock
    ) as mock_recognize:
        mock_recognize.side_effect = exc
        return client.post(
            "/api/recognize",
            json={"image_base64": "data:image/jpeg;base64,1234567890abcdefghij"},
        )


def test_recognize_endpoint_invalid_reading_raises_422():
    response = _post_with_error(InvalidReadingError("Dado d20 retornou face 25 inválida"))

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "invalid_reading"
    assert "Erro de validação" in detail["message"]
    assert "25 inválida" in detail["message"]


def test_recognize_endpoint_no_die_detected_raises_422():
    response = _post_with_error(NoDieDetectedError("imagem borrada"))

    assert response.status_code == 422
    detail = response.json()["detail"]
    assert detail["code"] == "no_die_detected"
    assert "imagem borrada" in detail["message"]


def test_recognize_endpoint_timeout_raises_504():
    response = _post_with_error(UpstreamTimeoutError("sem resposta em 30s"))

    assert response.status_code == 504
    detail = response.json()["detail"]
    assert detail["code"] == "upstream_timeout"
    assert "30s" in detail["message"]


def test_recognize_endpoint_upstream_error_raises_502():
    response = _post_with_error(UpstreamError("cota excedida"))

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert detail["code"] == "upstream_error"
    assert "cota excedida" in detail["message"]


def test_recognize_endpoint_unexpected_exception_raises_502():
    response = _post_with_error(RuntimeError("Conexão expirada com OpenRouter"))

    assert response.status_code == 502
    detail = response.json()["detail"]
    assert detail["code"] == "upstream_error"
    assert "Falha ao processar imagem" in detail["message"]
    assert "Conexão expirada" in detail["message"]

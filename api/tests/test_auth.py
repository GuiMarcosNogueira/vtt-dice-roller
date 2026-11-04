from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.auth import is_token_valid, require_token
from app.config import settings
from app.schemas.dice import DieType, RecognitionResult
from app.services.websocket_manager import ws_manager
from main import app

client = TestClient(app)

TOKEN = "segredo-da-mesa"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
ROLL = {"id": "roll_auth_1", "die_type": "d20", "value": 12, "player_name": "Valeros"}
RECOGNIZE_BODY = {"image_base64": "data:image/jpeg;base64,1234567890abcdefghij"}


@pytest.fixture
def with_token(monkeypatch):
    monkeypatch.setattr(settings, "api_token", TOKEN)


def test_is_token_valid_when_disabled_accepts_anything():
    assert settings.api_token == ""
    assert is_token_valid(None)
    assert is_token_valid("qualquer")


def test_is_token_valid_with_token(with_token):
    assert is_token_valid(TOKEN)
    assert not is_token_valid("outro")
    assert not is_token_valid("")
    assert not is_token_valid(None)
    # compare_digest com caracteres não ASCII não pode lançar exceção
    assert not is_token_valid("tókén-inválido")


@pytest.mark.parametrize(
    "header",
    [None, "", TOKEN, "Basic " + TOKEN, "Bearer", "Bearer errado"],
)
def test_require_token_rejects_missing_or_wrong(with_token, header):
    with pytest.raises(HTTPException) as exc_info:
        require_token(header)
    assert exc_info.value.status_code == 401
    assert exc_info.value.detail["code"] == "unauthorized"


def test_require_token_accepts_bearer_case_insensitive(with_token):
    assert require_token(f"Bearer {TOKEN}") is None
    assert require_token(f"bearer {TOKEN}") is None


def test_require_token_disabled_accepts_missing_header():
    assert require_token(None) is None


def test_post_roll_requires_token(with_token):
    history_size = len(client.get("/api/rolls", headers=AUTH).json())

    assert client.post("/api/rolls", json=ROLL).status_code == 401
    assert (
        client.post("/api/rolls", json=ROLL, headers={"Authorization": "Bearer x"}).status_code
        == 401
    )
    assert len(client.get("/api/rolls", headers=AUTH).json()) == history_size

    response = client.post("/api/rolls", json=ROLL, headers=AUTH)
    assert response.status_code == 201


def test_get_rolls_requires_token(with_token):
    response = client.get("/api/rolls")
    assert response.status_code == 401
    assert response.json()["detail"]["code"] == "unauthorized"
    assert client.get("/api/rolls", headers=AUTH).status_code == 200


def test_recognize_requires_token_and_does_not_call_provider(with_token):
    with patch(
        "app.routes.recognition.vision_service.recognize_dice", new_callable=AsyncMock
    ) as mock_recognize:
        mock_recognize.return_value = RecognitionResult(die_type=DieType.D6, value=3)

        denied = client.post("/api/recognize", json=RECOGNIZE_BODY)
        assert denied.status_code == 401
        assert denied.json()["detail"]["code"] == "unauthorized"
        mock_recognize.assert_not_called()

        allowed = client.post("/api/recognize", json=RECOGNIZE_BODY, headers=AUTH)
        assert allowed.status_code == 200
        mock_recognize.assert_called_once()


def test_health_stays_public(with_token):
    assert client.get("/health").status_code == 200


def test_endpoints_open_when_token_not_configured():
    assert client.get("/api/rolls").status_code == 200
    assert client.post("/api/rolls", json=ROLL).status_code == 201


@pytest.mark.parametrize("query", ["", "?token=errado"])
def test_websocket_rejects_missing_or_wrong_token(with_token, query):
    before = len(ws_manager.active_connections)
    with client.websocket_connect(f"/ws/rolls{query}") as websocket:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            websocket.receive_json()
    assert exc_info.value.code == 1008
    assert len(ws_manager.active_connections) == before


def test_rejected_websocket_does_not_receive_broadcasts(with_token):
    with client.websocket_connect("/ws/rolls") as rejected:
        with client.websocket_connect(f"/ws/rolls?token={TOKEN}") as accepted:
            assert accepted.receive_json()["event"] == "connected"

            assert client.post("/api/rolls", json=ROLL, headers=AUTH).status_code == 201

            broadcast = accepted.receive_json()
            assert broadcast["event"] == "dice_roll"
            assert broadcast["data"]["id"] == "roll_auth_1"

        with pytest.raises(WebSocketDisconnect) as exc_info:
            rejected.receive_json()
        assert exc_info.value.code == 1008


def test_websocket_accepts_valid_token(with_token):
    with client.websocket_connect(f"/ws/rolls?token={TOKEN}") as websocket:
        assert websocket.receive_json()["event"] == "connected"


def test_websocket_open_when_token_not_configured():
    with client.websocket_connect("/ws/rolls") as websocket:
        assert websocket.receive_json()["event"] == "connected"

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.routes.rolls import websocket_rolls_endpoint
from app.services.websocket_manager import ConnectionManager, ws_manager
from main import app

client = TestClient(app)


@pytest.mark.anyio
async def test_connection_manager_logic_and_failures():
    manager = ConnectionManager()
    assert len(manager.active_connections) == 0

    mock_ws_healthy = MagicMock()
    mock_ws_healthy.send_json = AsyncMock()
    mock_ws_dead = MagicMock()
    mock_ws_dead.send_json = AsyncMock(side_effect=RuntimeError("Socket closed abruptly"))

    manager.active_connections.append(mock_ws_healthy)
    manager.active_connections.append(mock_ws_dead)
    assert len(manager.active_connections) == 2

    # Broadcast should catch the dead connection exception and remove it
    await manager.broadcast({"event": "test"})
    assert len(manager.active_connections) == 1
    assert mock_ws_healthy in manager.active_connections
    assert mock_ws_dead not in manager.active_connections

    # Disconnect an already removed or non-existent socket should not crash
    manager.disconnect(mock_ws_dead)
    assert len(manager.active_connections) == 1


def test_websocket_and_rolls_flow():
    # Testa conexão WebSocket com o TestClient
    with client.websocket_connect("/ws/rolls") as websocket:
        init_data = websocket.receive_json()
        assert init_data["event"] == "connected"
        assert "active_clients" in init_data

        # Testa ping / pong
        websocket.send_text("ping")
        pong_msg = websocket.receive_text()
        assert pong_msg == "pong"

        # Mensagem qualquer diferente de ping não responde pong
        websocket.send_text("hello")

        # Dispara uma nova rolagem via POST /api/rolls
        new_roll = {
            "id": "roll_test_123",
            "die_type": "d20",
            "value": 20,
            "player_name": "Valeros",
            "source": "optical_camera",
        }
        post_res = client.post("/api/rolls", json=new_roll)
        assert post_res.status_code == 201

        # O WebSocket deve receber a mensagem transmitida
        broadcast_msg = websocket.receive_json()
        assert broadcast_msg["event"] == "dice_roll"
        assert broadcast_msg["data"]["id"] == "roll_test_123"
        assert broadcast_msg["data"]["value"] == 20
        assert broadcast_msg["data"]["player_name"] == "Valeros"


def test_websocket_disconnect_handler():
    # Testa conexão e desconexão graciosa
    with client.websocket_connect("/ws/rolls") as websocket:
        websocket.receive_json()
        # Fecha a conexão
        websocket.close()


@pytest.mark.anyio
async def test_websocket_generic_exception():
    mock_ws = MagicMock()
    mock_ws.accept = AsyncMock()
    mock_ws.send_json = AsyncMock()
    mock_ws.receive_text = AsyncMock(side_effect=RuntimeError("Erro inesperado no stream"))
    await websocket_rolls_endpoint(mock_ws)
    assert mock_ws not in ws_manager.active_connections


def test_get_rolls_history():
    res = client.get("/api/rolls")
    assert res.status_code == 200
    rolls = res.json()
    assert isinstance(rolls, list)
    assert len(rolls) >= 1
    assert rolls[0]["id"] == "roll_test_123"

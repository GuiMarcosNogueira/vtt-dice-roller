from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from main import app
from app.schemas.dice import DieType, RecognitionResult

client = TestClient(app)

def test_full_e2e_optical_roll_to_vtt_flow():
    # 1. Simula o módulo do Foundry VTT conectado ao WebSocket
    with client.websocket_connect("/ws/rolls") as vtt_socket:
        init_payload = vtt_socket.receive_json()
        assert init_payload["event"] == "connected"

        # 2. O celular captura um frame e envia para POST /api/recognize
        mock_recognition = RecognitionResult(
            die_type=DieType.D20,
            value=20,
            confidence=0.99,
            raw_explanation="Dado d20 em repouso com face crítica 20 no topo (zênite)."
        )

        with patch("app.routes.recognition.vision_service.recognize_dice", new_callable=AsyncMock) as mock_recognize:
            mock_recognize.return_value = mock_recognition

            rec_response = client.post(
                "/api/recognize",
                json={
                    "image_base64": "data:image/jpeg;base64,sample_d20_capture_image_data_here",
                    "die_type_hint": "d20"
                }
            )
            assert rec_response.status_code == 200
            recognized = rec_response.json()
            assert recognized["die_type"] == "d20"
            assert recognized["value"] == 20

        # 3. O jogador visualiza na tela do celular e confirma a rolagem
        roll_confirm_payload = {
            "id": "roll_e2e_001",
            "die_type": recognized["die_type"],
            "value": recognized["value"],
            "player_name": "Mestre da Masmorra",
            "source": "camera_mobile"
        }

        publish_response = client.post("/api/rolls", json=roll_confirm_payload)
        assert publish_response.status_code == 201

        # 4. O Foundry VTT recebe a rolagem instantaneamente pelo WebSocket
        vtt_received = vtt_socket.receive_json()
        assert vtt_received["event"] == "dice_roll"
        assert vtt_received["data"]["id"] == "roll_e2e_001"
        assert vtt_received["data"]["die_type"] == "d20"
        assert vtt_received["data"]["value"] == 20
        assert vtt_received["data"]["player_name"] == "Mestre da Masmorra"

        # 5. O histórico do backend mantém o registro
        history_response = client.get("/api/rolls")
        assert history_response.status_code == 200
        history = history_response.json()
        assert any(r["id"] == "roll_e2e_001" for r in history)

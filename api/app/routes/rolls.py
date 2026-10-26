from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.schemas.dice import RollEvent
from app.services.websocket_manager import ws_manager

router = APIRouter(tags=["Rolls"])

# Armazenamento em memória para o MVP
rolls_history: list[RollEvent] = []


@router.websocket("/ws/rolls")
async def websocket_rolls_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Envia mensagem inicial de confirmação de conexão
        await websocket.send_json(
            {
                "event": "connected",
                "message": "Conectado ao hub de rolagens VTT Dice Roller",
                "active_clients": len(ws_manager.active_connections),
            }
        )
        while True:
            # Mantém conexão viva e escuta possíveis mensagens do cliente (ex: ping/pong)
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)


@router.post("/api/rolls", response_model=RollEvent, status_code=status.HTTP_201_CREATED)
async def create_and_broadcast_roll(roll: RollEvent):
    rolls_history.append(roll)
    # Broadcast em tempo real para todos os clientes conectados (Foundry VTT, UI, etc.)
    await ws_manager.broadcast({"event": "dice_roll", "data": roll.model_dump(mode="json")})
    return roll


@router.get("/api/rolls", response_model=list[RollEvent])
def get_rolls_history():
    # Retorna as últimas 50 rolagens
    return list(reversed(rolls_history[-50:]))

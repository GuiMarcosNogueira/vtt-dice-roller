from datetime import UTC, datetime
from enum import Enum

from pydantic import BaseModel, Field, field_validator


class DieType(str, Enum):
    D4 = "d4"
    D6 = "d6"
    D8 = "d8"
    D10 = "d10"
    D12 = "d12"
    D20 = "d20"
    D100 = "d100"


DICE_MAX_VALUES = {
    DieType.D4: 4,
    DieType.D6: 6,
    DieType.D8: 8,
    DieType.D10: 10,
    DieType.D12: 12,
    DieType.D20: 20,
    DieType.D100: 100,
}


class RecognizeRequest(BaseModel):
    image_base64: str = Field(..., description="Imagem em base64 com ou sem prefixo data:image/...")
    die_type_hint: DieType | None = Field(None, description="Dica opcional do tipo de dado")

    @field_validator("image_base64")
    @classmethod
    def validate_image_base64(cls, v: str) -> str:
        if not v or len(v.strip()) < 20:
            raise ValueError("image_base64 deve conter uma string base64 válida")
        return v


class RecognitionResult(BaseModel):
    die_type: DieType = Field(..., description="Tipo do dado reconhecido (d4, d6, etc.)")
    value: int = Field(..., description="Valor numérico da face superior do dado")
    confidence: float = Field(
        default=1.0,
        ge=0.0,
        le=1.0,
        description="Nível de confiança da leitura de 0 a 1",
    )
    raw_explanation: str | None = Field(
        None, description="Explicação detalhada fornecida pelo modelo de visão"
    )

    @field_validator("value")
    @classmethod
    def validate_value_range(cls, v: int, info) -> int:
        die_type = info.data.get("die_type")
        if die_type:
            # Para d100, permitimos 0 a 100 (ou múltiplos de 10 como 00, 10... até 100)
            if die_type == DieType.D100:
                if v < 0 or v > 100:
                    raise ValueError(
                        f"Valor para {die_type} deve estar entre 0 e 100, recebido {v}"
                    )
            else:
                max_val = DICE_MAX_VALUES.get(die_type, 20)
                if v < 1 or v > max_val:
                    raise ValueError(
                        f"Valor para {die_type} deve estar entre 1 e {max_val}, recebido {v}"
                    )
        return v


class RollEvent(BaseModel):
    id: str = Field(..., description="Identificador único da rolagem")
    die_type: DieType = Field(..., description="Tipo do dado rolado")
    value: int = Field(..., description="Valor do resultado")
    player_name: str = Field(default="Jogador", description="Nome do jogador")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(UTC),
        description="Momento da rolagem",
    )
    source: str = Field(default="optical_camera", description="Origem da rolagem")

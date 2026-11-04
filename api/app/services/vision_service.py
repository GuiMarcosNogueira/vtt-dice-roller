import json
import re

from openai import (
    APIError,
    APITimeoutError,
    AsyncOpenAI,
    AuthenticationError,
    PermissionDeniedError,
)

from app.config import settings
from app.errors import (
    InvalidReadingError,
    NoDieDetectedError,
    ProviderAuthError,
    UpstreamError,
    UpstreamTimeoutError,
)
from app.schemas.dice import DieType, RecognitionResult

SYSTEM_PROMPT = """Você é um especialista em visão computacional e reconhecimento óptico de dados de RPG de mesa (TTRPG).
Sua missão é analisar a imagem fornecida e identificar o dado rolado que está em repouso.

Tipos de dados suportados:
- d4 (tetraedro): valor no vértice superior apontando para cima OU na base horizontal, dependendo do design.
- d6 (cubo): valor de 1 a 6 na face horizontal superior.
- d8 (octaedro): valor de 1 a 8 na face horizontal superior.
- d10 (trapezoedro pentagonal): valor de 1 a 10. IMPORTANTE: A face '0' representa o valor 10.
- d12 (dodecaedro): valor de 1 a 12 na face horizontal superior.
- d20 (icosaedro): valor de 1 a 20 na face triangular superior apontada diretamente para cima (zênite). Ignore as faces adjacentes inclinadas.
- d100 / d00 (dezena de percentil): faces marcadas com '00', '10', '20', ..., '90'.

Regras cruciais:
1. IDENTIFIQUE APENAS A FACE SUPERIOR (VOLTADA PARA CIMA / ZÊNITE). Não leia números em faces laterais ou inclinadas.
2. Cuidado com 6 e 9: verifique a linha sublinhada ou ponto que indica a orientação correta do número.
3. Se houver mais de um dado, foque no dado central em destaque.
4. Se a imagem estiver borrada, vazia ou não contiver nenhum dado identificável, NÃO invente uma leitura: responda com "detected": false.

Formato de Resposta Obrigatório:
Retorne EXCLUSIVAMENTE um objeto JSON válido, sem texto adicional antes ou depois:
{
  "die_type": "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100",
  "value": <número inteiro>,
  "confidence": <número decimal entre 0.0 e 1.0>,
  "explanation": "<breve explicação de como o número no topo foi identificado>"
}

Quando nenhum dado puder ser lido, retorne exatamente:
{
  "detected": false,
  "explanation": "<motivo, ex: imagem borrada ou sem dado>"
}
"""


class VisionService:
    def __init__(
        self,
        api_key: str | None = None,
        base_url: str | None = None,
        model: str | None = None,
        timeout: float | None = None,
        extra_body: dict | None = None,
    ):
        self.api_key = api_key if api_key is not None else settings.vision_api_key
        self.base_url = base_url if base_url is not None else settings.vision_base_url
        self.model = model if model is not None else settings.vision_model
        self.timeout = timeout if timeout is not None else settings.vision_timeout_seconds
        self.extra_body = extra_body

        default_headers = {}
        if "openrouter" in (self.base_url or "").lower():
            default_headers["HTTP-Referer"] = "https://github.com/vtt-dice-roller"
            default_headers["X-Title"] = "VTT Dice Roller"

        self.client = AsyncOpenAI(
            api_key=self.api_key or "mock_key",
            base_url=self.base_url,
            default_headers=default_headers if default_headers else None,
            timeout=self.timeout,
            max_retries=1,
        )

    def format_image_url(self, raw_base64: str) -> str:
        clean = raw_base64.strip()
        if clean.startswith("data:image/"):
            return clean
        return f"data:image/jpeg;base64,{clean}"

    def parse_json_response(self, content: str) -> dict:
        content = content.strip()
        # Remove eventuais blocos markdown ```json ... ```
        match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", content)
        if match:
            content = match.group(1).strip()
        return json.loads(content)

    async def recognize_dice(
        self, image_base64: str, die_type_hint: DieType | None = None
    ) -> RecognitionResult:
        image_url = self.format_image_url(image_base64)

        user_content = [
            {
                "type": "text",
                "text": "Identifique o dado e a face superior voltada para cima.",
            }
        ]
        if die_type_hint:
            user_content[0]["text"] += (
                f" Dica: o dado rolado é esperado ser do tipo {die_type_hint.value}."
            )

        user_content.append({"type": "image_url", "image_url": {"url": image_url}})

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_content},
                ],
                response_format={"type": "json_object"},
                temperature=0.1,
                max_tokens=250,
                extra_body=self.extra_body,
            )
        except APITimeoutError as e:
            raise UpstreamTimeoutError(
                f"O provedor de visão não respondeu em {self.timeout:g}s"
            ) from e
        except (AuthenticationError, PermissionDeniedError) as e:
            # Mensagem fixa: o texto do provedor pode ecoar parte da chave
            raise ProviderAuthError("Chave de API recusada pelo provedor") from e
        except APIError as e:
            raise UpstreamError(f"O provedor de visão retornou um erro: {e}") from e

        content = response.choices[0].message.content or "{}"
        try:
            parsed = self.parse_json_response(content)
        except json.JSONDecodeError as e:
            raise UpstreamError("O provedor de visão retornou uma resposta ilegível") from e
        if not isinstance(parsed, dict):
            raise UpstreamError("O provedor de visão retornou uma resposta ilegível")

        if parsed.get("detected") is False or not parsed.get("die_type"):
            raise NoDieDetectedError(parsed.get("explanation") or "Nenhum dado identificado")

        try:
            die_type = DieType(str(parsed["die_type"]).lower())
            value = int(parsed["value"])
            if die_type == DieType.D10 and value == 0:
                value = 10
            return RecognitionResult(
                die_type=die_type,
                value=value,
                confidence=float(parsed.get("confidence", 1.0)),
                raw_explanation=parsed.get("explanation"),
            )
        except (KeyError, TypeError, ValueError) as e:
            raise InvalidReadingError(f"Leitura inválida retornada pelo modelo: {e}") from e

# Design

## Context

A motivação está em `proposal.md` (seção Why) e os requisitos estão nos deltas em `specs/`. Estado atual que influencia a solução:

- `RecognitionResult` exige `die_type`. Quando o modelo omite o tipo, o `parsed["die_type"]` em `vision_service.py` lança `KeyError`, que cai no `except Exception` da rota e vira um 502. O validador de `value` lança `ValueError`, que vira 422 com `detail` em string.
- `AsyncOpenAI` é criado sem `timeout`, então vale o padrão do SDK (600s, com retentativas).
- `page.tsx`, quando o reconhecimento falha, cria um resultado falso (`d20`, valor `1`, `confidence` 0.1). Com `autoSend` ligado, o `ReviewModal` faz a contagem e **envia esse valor falso para o VTT**.
- O módulo do Foundry declara compatibilidade com v10 a v12, usa `roll.evaluate({async: true})`, que é obsoleto no v12, e sobrescreve `terms[0].results` e `_total`, que são internos.
- A configuração vem de `Settings` (Pydantic) com padrões lidos por `os.getenv` no momento do import.

## Goals / Non-Goals

**Goals:**
- Erros de reconhecimento com código estável, que o frontend consiga tratar sem olhar o texto da mensagem.
- Um único ponto de verificação de token reaproveitado pelas rotas HTTP e pelo WebSocket.
- Manter a cobertura ≥ 95% em `api/` e `web/`.

**Non-Goals:**
- Tokens por jogador, expiração, rotação ou HTTPS/WSS. Continua sendo uma ferramenta de rede local; o token só barra quem está na rede sem conhecê-lo.
- Validar que o d100 vem em múltiplos de 10, ou mudar como o `00` é interpretado.
- Anexar o objeto `Roll` à `ChatMessage` (rolagem "nativa" no chat). Fica para uma change futura.
- Testes automatizados do módulo do Foundry. A CI continua só com `node --check`, e a verificação é manual.

## Decisions

### D1: Formato de erro `{code, message}` no `detail`
As rotas lançam `HTTPException(detail={"code": ..., "message": ...})`. Os códigos são `no_die_detected` (422), `invalid_reading` (422), `upstream_error` (502), `upstream_timeout` (504) e `unauthorized` (401).
- Para distinguir os casos sem `except` genérico, o `VisionService` lança exceções próprias (`NoDieDetectedError`, `InvalidReadingError`, `UpstreamError`, `UpstreamTimeoutError`) e a rota traduz cada uma para seu código. `openai.APITimeoutError` vira `UpstreamTimeoutError`. Os demais `openai.APIError`, e JSON que não pode ser interpretado, viram `UpstreamError`.
- *Alternativa*: um exception handler global do FastAPI. Foi descartado porque só uma rota produz esses erros, e o mapeamento local fica mais fácil de ler e de testar.

### D2: Detecção ausente sinalizada pelo modelo
O prompt passa a permitir `{"detected": false, "explanation": "..."}` quando não há dado identificável. O serviço trata como `NoDieDetectedError` quando `detected` é `false` ou quando `die_type` está ausente ou `null`.
- *Alternativa*: usar um limiar de `confidence` (ex: < 0.3). Foi descartado porque a confiança devolvida pelos LLMs é pouco calibrada, e um limiar fixo rejeitaria leituras corretas. A confiança continua visível na tela de revisão.

### D3: Normalização do d10 antes de validar
Em `recognize_dice`, antes de montar o `RecognitionResult`: se `die_type == d10` e `value == 0`, então `value = 10`. A regra fica no serviço de visão, que é quem sabe que o `0` vem da leitura da face do d10, e não no schema compartilhado. `POST /api/rolls` não valida o intervalo do valor hoje e isso não muda nesta change.

### D4: Timeout
Nova configuração `vision_timeout_seconds: float` (env `VISION_TIMEOUT_SECONDS`, padrão `30`), repassada a `AsyncOpenAI(timeout=..., max_retries=1)`. Com `max_retries=1`, o pior caso fica em cerca de 2× o timeout, em vez das retentativas padrão do SDK, o que importa porque o jogador está esperando na tela.

### D5: Token compartilhado
- Nova configuração `api_token: str` (env `API_TOKEN`, padrão vazio = desligado).
- No HTTP, uma dependência `require_token` em `app/auth.py` lê `Authorization: Bearer <token>` e compara com `secrets.compare_digest`. É aplicada em `POST /api/recognize`, `POST /api/rolls` e `GET /api/rolls`; `/health` fica livre.
- No WebSocket, navegadores e o Foundry não conseguem mandar headers no handshake, por isso o token vai em `?token=`. A verificação acontece **antes** de `ws_manager.connect`: com token inválido, o servidor faz `accept()` e logo em seguida `close(code=1008)`. Assim o cliente recebe o código de fechamento de forma confiável, o que não acontece se a conexão for recusada antes do accept.
- O token na query string pode aparecer em logs de acesso. Isso é aceitável dentro dos non-goals (rede local, sem TLS).
- *Alternativa*: subprotocolo `Sec-WebSocket-Protocol` carregando o token. Foi descartado porque complica o cliente do Foundry sem ganho real fora de TLS.

### D6: Frontend sem resultado falso
- `AppSettings` ganha `apiToken: string` (padrão `""`), editável no `SettingsModal` em um campo `type="password"`. Um helper `buildHeaders(settings)` em `page.tsx` adiciona `Authorization` quando o token está preenchido.
- `page.tsx` deixa de criar o resultado falso. Passa a guardar `recognitionError: {code, message} | null`, que vem do `detail.code` da resposta, ou de `network_error` quando o `fetch` falha.
- `ReviewModal` recebe a prop `error`. Quando ela está presente, mostra a mensagem correspondente (dado não detectado / token inválido / falha ou timeout da IA), mantém a seleção manual com o valor inicial atual (`d20` / `20`) e **não dispara o envio automático**. Esse último ponto corrige o bug descrito no Context.
- O `POST /api/rolls` com resposta 401 também mostra o aviso de token, e a rolagem não é marcada como enviada.

### D7: Dice So Nice via `Roll.fromData`
Em vez de avaliar uma rolagem aleatória e sobrescrever campos internos, o módulo monta uma rolagem já avaliada a partir de dados serializados:
```
Roll.fromData({
  class: "Roll", formula: `1d${faces}`, evaluated: true, total: value,
  terms: [{ class: "Die", number: 1, faces, evaluated: true,
            results: [{ result: value, active: true }] }]
})
```
Esse formato de serialização é estável entre v10 e v12, e é o mesmo que o Foundry usa para restaurar rolagens de mensagens de chat. Para `d100`, `faces = 100`. O token entra como nova configuração `serverToken` (escopo `client`, com `onChange` reconectando), e o módulo o adiciona à URL do WS como `?token=` quando está preenchido.
- *Alternativa*: `new Roll(...).evaluate()` e depois sobrescrever o resultado. Foi descartado porque ainda depende de campos internos e muda a assinatura entre versões.

### D8: `config.yaml`
Só o texto da linha do `web/` muda, para "frontend em Next.js (web responsivo, uso no navegador do celular)". Nenhuma outra chave é alterada.

## Risks / Trade-offs

- **[O modelo ignora o formato `detected: false` e inventa uma leitura]** → A tela de revisão continua permitindo correção manual. O prompt explicita a regra com exemplo.
- **[`Roll.fromData` muda numa versão futura do Foundry (v13+)]** → A chamada fica dentro do `try/catch` que já existe. A falha só desliga a animação 3D, e a mensagem de chat sai normalmente.
- **[Token exposto na URL do WS e no `localStorage`]** → É aceitável para rede local (ver Non-Goals) e fica documentado no README.
- **[Mudança no formato de `detail` quebra clientes externos]** → O único cliente conhecido é o `web/`, atualizado na mesma change.

## Migration Plan

Sem migração de dados. Sem `API_TOKEN`, o comportamento de acesso é idêntico ao atual. Para ativar, basta definir `API_TOKEN` no `.env` e informar o mesmo valor nas configurações do `web/` e do módulo do Foundry. Para reverter, é só remover a variável.

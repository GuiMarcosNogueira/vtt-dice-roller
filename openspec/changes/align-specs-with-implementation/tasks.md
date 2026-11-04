# Tasks

## 1. Backend: configuração e erros estruturados do reconhecimento

- [x] 1.1 Adicionar `vision_timeout_seconds` (`VISION_TIMEOUT_SECONDS`, padrão 30) e `api_token` (`API_TOKEN`, padrão vazio) em `api/app/config.py` e em `api/.env.example`, verificando com um teste que os padrões são aplicados quando as variáveis não estão definidas
- [x] 1.2 Criar as exceções `NoDieDetectedError`, `InvalidReadingError`, `UpstreamError` e `UpstreamTimeoutError` e passá-las a ser lançadas pelo `VisionService` (detected=false / die_type ausente, valor fora do intervalo, `openai.APIError` / JSON inválido, `openai.APITimeoutError`), verificando cada caminho em `tests/test_vision_service.py`
- [x] 1.3 Passar `timeout=settings.vision_timeout_seconds` e `max_retries=1` ao `AsyncOpenAI`, verificando em teste que o cliente é criado com esses valores
- [x] 1.4 Normalizar `d10` com valor `0` para `10` no `VisionService` antes de montar o `RecognitionResult`, verificando em teste que `d10` com valor `0` vira `10` e que `d20` com `0` continua sendo leitura inválida
- [x] 1.5 Atualizar o `SYSTEM_PROMPT` com a regra e o exemplo `{"detected": false, "explanation": ...}`, verificando em teste que o prompt contém a instrução
- [x] 1.6 Mapear as exceções para `HTTPException(detail={code, message})` em `app/routes/recognition.py` (422 `no_die_detected`, 422 `invalid_reading`, 502 `upstream_error`, 504 `upstream_timeout`), verificando status e `detail.code` de cada caso em `tests/test_recognition_endpoint.py`

## 2. Backend: autenticação por token compartilhado

- [x] 2.1 Implementar a dependência `require_token` em `api/app/auth.py` (Bearer + `secrets.compare_digest`, sem efeito quando `api_token` está vazio, 401 com `detail.code = "unauthorized"`), verificando com testes unitários de token ausente, inválido, válido e desligado
- [x] 2.2 Aplicar `require_token` em `POST /api/recognize`, `POST /api/rolls` e `GET /api/rolls`, mantendo `/health` público, verificando em testes de endpoint que retornam 401 sem token e 2xx com token quando `API_TOKEN` está definido
- [x] 2.3 Validar o `?token=` em `/ws/rolls` antes de `ws_manager.connect` (accept + `close(1008)` quando inválido), verificando em `tests/test_rolls.py` que o cliente rejeitado recebe código 1008 e não recebe broadcasts
- [x] 2.4 Rodar `pytest --cov=app --cov-branch` em `api/` e verificar que passa com cobertura ≥ 95%

## 3. Frontend: token e tratamento de erros na revisão

- [x] 3.1 Adicionar `apiToken` a `AppSettings`/`DEFAULT_SETTINGS` em `web/app/types.ts` e um campo `type="password"` no `SettingsModal`, verificando em `components.test.tsx` que o valor é editado e persistido
- [x] 3.2 Criar `buildHeaders(settings)` em `page.tsx` e usá-lo em `/api/recognize` e `/api/rolls`, verificando em `page.test.tsx` que o header `Authorization` só é enviado quando o token está preenchido
- [x] 3.3 Trocar o resultado falso por um estado `recognitionError` (vindo de `detail.code`, ou `network_error` quando o fetch falha) e repassá-lo ao `ReviewModal`, verificando em `page.test.tsx` os casos 422 `no_die_detected`, 504, 401 e falha de rede
- [x] 3.4 Mostrar no `ReviewModal` a mensagem de cada código, manter a seleção manual e não disparar o envio automático quando houver `error`, verificando em `components.test.tsx` (com fake timers) que o `onConfirm` não é chamado automaticamente em caso de erro
- [x] 3.5 Tratar 401 no `POST /api/rolls` mostrando o aviso de token, verificando em `page.test.tsx`
- [x] 3.6 Rodar `npm run test:coverage` em `web/` e verificar que passa com cobertura ≥ 95% em todas as métricas

## 4. Módulo Foundry VTT

- [x] 4.1 Registrar a configuração `serverToken` (client, `onChange` reconecta) e adicionar `?token=` à URL do WebSocket quando estiver preenchida, verificando com `node --check foundry-module/scripts/main.js` e uma conexão manual contra o backend com `API_TOKEN` definido
- [ ] 4.2 Substituir `evaluate({async})` e a escrita em `_total` por `Roll.fromData` com um termo `Die` já avaliado, verificando manualmente no Foundry com Dice So Nice (v12 e, se possível, v10/11) que a animação para no valor recebido sem avisos de API obsoleta no console

## 5. Documentação e configuração

- [x] 5.1 Documentar `VISION_TIMEOUT_SECONDS`, `API_TOKEN` e a configuração do token no web e no Foundry no `README.md`, verificando que os passos descritos funcionam do jeito que estão escritos
- [x] 5.2 Corrigir a descrição do `web/` em `openspec/config.yaml` para web responsivo (navegador do celular), verificando com `openspec validate --specs` sem erros

## 6. Integração

- [ ] 6.1 Teste ponta a ponta com `API_TOKEN` definido: captura no celular → reconhecimento → chat do Foundry, mais um caso de imagem sem dado mostrando a mensagem "nenhum dado detectado", verificando visualmente os dois fluxos

## Workflow follow-up

- Arquivar a change com `/opsx:archive` após a revisão.

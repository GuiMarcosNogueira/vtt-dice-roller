# Proposal

## Why

Uma revisão comparando as specs com o código achou seis pontos em que as specs prometem um comportamento que não existe. Exemplos: imagens sem dado viram um 502 genérico, não há timeout para o provedor de visão, o `0` do d10 só é tratado no prompt, o WebSocket aceita qualquer cliente mesmo a spec falando em "clientes autorizados", o módulo do Foundry usa APIs obsoletas para a animação 3D e o `config.yaml` descreve plataformas que não existem. Alinhar isso agora, antes de novas funcionalidades, evita construir em cima de garantias que não se cumprem.

## What Changes

- **Erros estruturados no reconhecimento**: `POST /api/recognize` passa a devolver `detail` como objeto `{code, message}` e diferencia quatro casos: nenhum dado detectado (`no_die_detected`, 422), leitura inválida (`invalid_reading`, 422), falha do provedor (`upstream_error`, 502) e timeout do provedor (`upstream_timeout`, 504). **BREAKING** para quem lia `detail` como string; o único cliente é o `web/`, que será atualizado junto.
- **Timeout configurável do provedor de visão** pela variável `VISION_TIMEOUT_SECONDS` (padrão 30s).
- **Normalização do d10 no servidor**: uma leitura `d10` com valor `0` vira `10` antes da validação, sem depender só do prompt.
- **Autenticação opcional por token compartilhado**: com `API_TOKEN` definida, os endpoints de reconhecimento e rolagens e o WebSocket `/ws/rolls` exigem o token. Sem ela, tudo continua aberto como hoje, então quem não configurar nada não é afetado. `web/` e o módulo do Foundry ganham um campo para o token.
- **Frontend**: a tela de revisão mostra uma mensagem específica para "nenhum dado detectado" e para timeout, mantendo a seleção manual disponível.
- **Módulo Foundry VTT**: a animação do Dice So Nice passa a ser montada com dados de rolagem serializados (`Roll.fromData`), sem `evaluate({async})` nem escrita em `_total`, compatível do Foundry v10 ao v12.
- **`openspec/config.yaml`**: o `web/` passa a ser descrito como web responsivo (navegador do celular), sem Android e iOS nativos.

## Capabilities

### New Capabilities

<!-- Nenhuma -->

### Modified Capabilities

- `optical-dice-recognition`: o d10 é normalizado no servidor, o timeout do provedor é configurável e as respostas de erro trazem um código (incluindo `no_die_detected` e `upstream_timeout`).
- `vtt-distribution`: autenticação opcional por token compartilhado para HTTP e WebSocket, e animação 3D no Foundry mostrando exatamente o valor lido.
- `roll-capture`: a revisão mostra mensagens próprias para os erros de reconhecimento e envia o token configurado.

## Impact

- **`api/`**: `app/config.py` (novas variáveis), `app/services/vision_service.py` (timeout, normalização, detecção ausente), `app/routes/recognition.py` (códigos de erro), `app/routes/rolls.py` (token no HTTP e no WS), uma nova dependência de autenticação, testes em `tests/` mantendo cobertura ≥ 95%, `.env.example`.
- **`web/`**: `app/types.ts` (`apiToken` em `AppSettings`), `app/page.tsx` (header `Authorization`, tratamento dos códigos de erro), `app/components/SettingsModal.tsx`, `app/components/ReviewModal.tsx`, testes em `__tests__/` mantendo cobertura ≥ 95%.
- **`foundry-module/`**: `scripts/main.js` (configuração do token, query param no WS, `Roll.fromData`).
- **Docs/config**: `README.md` (novas variáveis e configuração do token), `openspec/config.yaml`.

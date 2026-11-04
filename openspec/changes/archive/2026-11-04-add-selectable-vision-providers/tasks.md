# Tasks

## 1. Backend: catálogo de provedores e erros compartilhados

- [x] 1.1 Criar `api/app/providers.py` com o catálogo (`server`, `deepseek`, `openrouter`: id, nome, URL base, modelo padrão, `requires_user_key`) e `get_provider(id)` que levanta `UnknownProviderError`, verificando em `tests/test_providers.py` o conteúdo do catálogo e o erro para id desconhecido
- [x] 1.2 Criar `api/app/errors.py` com `MissingApiKeyError`, `ProviderAuthError`, `scrub(message, api_key)` e `to_http_error(exc, api_key)` cobrindo `unknown_provider` (422), `missing_api_key` (422), `provider_auth_error` (400) e os códigos já existentes (`no_die_detected`, `invalid_reading`, `upstream_error`, `upstream_timeout`), verificando em `tests/test_errors.py` cada mapeamento e que a chave é trocada por `***` na mensagem
- [x] 1.3 Mover a tradução de exceções de `app/routes/recognition.py` para `to_http_error`, verificando que todos os testes existentes de `tests/test_recognition_endpoint.py` continuam passando sem alteração de comportamento

## 2. Backend: listagem de modelos com suporte a imagem

- [x] 2.1 Implementar `extract_vision_models(provider_id, payload)` em `app/providers.py` (lê `input_modalities` do DeepSeek e `architecture.input_modalities` do OpenRouter, exclui os que declaram não aceitar imagem, mantém os sem informação, ordena por nome), verificando com payloads reais de exemplo de cada provedor, modelo só texto, modelo sem metadados e payload vazio
- [x] 2.2 Criar `GET /api/models` em `app/routes/providers.py` (protegida por `require_token`) que valida provedor e chave nesta ordem (`unknown_provider`, `missing_api_key`), consulta `{base_url}/models` com `httpx` e o timeout configurado e devolve `{provider, models: [{id, name}]}`, verificando em `tests/test_models_endpoint.py` com `httpx` simulado: sucesso para cada provedor, 401/403 do provedor → `provider_auth_error`, 5xx ou JSON inválido → `upstream_error`, timeout → `upstream_timeout`, `server` → `unknown_provider` e que a chave nunca aparece na resposta de erro
- [x] 2.3 Criar `GET /api/providers` (protegida por `require_token`) retornando o catálogo com `id`, `name`, `default_model` e `requires_user_key`, e registrar o router em `main.py`, verificando o conteúdo da resposta e o 401 quando `API_TOKEN` está definido e o token falta
- [x] 2.4 Rodar `pytest --cov=app --cov-branch` e `ruff check api/ && ruff format --check api/` em `api/`, verificando aprovação com cobertura ≥ 95%

## 3. Backend: reconhecimento com provedor, modelo e chave do usuário

- [x] 3.1 Adicionar `provider` e `model` opcionais (máx. 200 caracteres) ao `RecognizeRequest`, verificando em `tests/test_schemas.py` os valores padrão e o limite de tamanho
- [x] 3.2 Converter `openai.AuthenticationError` e `PermissionDeniedError` em `ProviderAuthError` no `VisionService`, antes do tratamento genérico de `APIError`, verificando em `tests/test_vision_errors.py` que 401/403 viram `ProviderAuthError` e que outros erros continuam `UpstreamError`
- [x] 3.3 Em `POST /api/recognize`, resolver o provedor e a chave (header `X-Vision-Api-Key`) na ordem `unknown_provider` → `missing_api_key`, criar um `VisionService` por requisição com a URL do catálogo, o modelo informado ou o padrão do provedor e fechar o cliente no `finally`; sem `provider` ou com `server`, manter o `vision_service` atual, verificando em `tests/test_recognition_endpoint.py`: DeepSeek com chave e modelo, modelo omitido usa o padrão, sem provedor usa o servidor, chave ausente não chama o provedor nem usa a chave do servidor, provedor desconhecido, chave recusada (400) e que o cliente é fechado
- [x] 3.4 Garantir que a chave do usuário nunca vai para logs nem para mensagens de erro, verificando em teste que um erro do provedor contendo a chave devolve a mensagem com `***` e que nenhum registro de log capturado (`caplog`) contém a chave
- [x] 3.5 Rodar `pytest --cov=app --cov-branch` e `ruff check api/ && ruff format --check api/`, verificando aprovação com cobertura ≥ 95%

- [x] 3.6 Converter a recusa da chave do servidor (provedor `server`) em `upstream_error` em vez de `provider_auth_error`, verificando em `tests/test_recognition_providers.py` o 502 com a mensagem da chave do servidor, com e sem `provider: "server"`, e que a chave do usuário continua gerando 400
- [x] 3.7 Desligar o raciocínio do DeepSeek via `request_extras` no catálogo, repassado como `extra_body` pelo `VisionService`, verificando em teste que o DeepSeek envia `{"thinking": {"type": "disabled"}}` e o OpenRouter não envia extras
- [x] 3.8 Trocar o modelo padrão `google/gemini-2.0-flash-001` (removido do OpenRouter) por `google/gemini-2.5-flash` no catálogo, em `config.py`, no `.env.example` e no README, verificando que nenhuma referência ao modelo antigo resta fora do histórico arquivado

## 4. Frontend: seleção de provedor, chave e modelo

- [x] 4.1 Adicionar `visionProvider`, `visionApiKey` e `visionModel` a `AppSettings` e `DEFAULT_SETTINGS` (`"server"`, `""`, `""`) e os tipos `VisionProvider` e `VisionModel` em `web/app/types.ts`, verificando em `page.test.tsx` que configurações antigas do `localStorage` sem esses campos continuam carregando com os padrões
- [x] 4.2 Criar o hook `useProviders(apiUrl, apiToken)` em `web/app/hooks/useProviders.ts` (busca `GET /api/providers` com o header `Authorization` quando houver token, trata falha com fallback para apenas `server`), verificando em `__tests__/useProviders.test.ts` sucesso, falha de rede, resposta não ok e o header de token
- [x] 4.3 Criar o hook `useVisionModels` em `web/app/hooks/useVisionModels.ts` (só busca com provedor que exige chave do usuário e chave preenchida, debounce de 600 ms, cancela a requisição anterior, expõe `models`, `isLoading`, `error` e `retry`; envia `X-Vision-Api-Key` e `Authorization`), verificando em `__tests__/useVisionModels.test.ts` com fake timers: sem chave não busca, debounce, resposta antiga ignorada, sucesso, erro com código, retry e limpeza ao trocar de provedor
- [x] 4.4 Criar o componente `ModelPicker` em `web/app/components/ModelPicker.tsx` (campo de busca, lista rolável, item selecionado destacado, estado vazio), verificando em `components.test.tsx` a filtragem pelo texto, a seleção e o estado sem resultados
- [x] 4.5 Atualizar o `SettingsModal` com o seletor de provedor (opções vindas de `useProviders`), o campo de chave `type="password"` e o `ModelPicker`; ocultar chave e modelo para `server`; pré-selecionar o modelo padrão do provedor quando estiver na lista (senão o primeiro); mostrar carregamento, mensagem de erro específica e botão de nova tentativa, sem bloquear o salvamento, verificando em `components.test.tsx` cada um desses estados e que o `onSave` recebe provedor, chave e modelo
- [x] 4.6 Enviar `provider`, `model` e o header `X-Vision-Api-Key` em `POST /api/recognize` somente quando `visionProvider !== "server"` em `web/app/page.tsx`, verificando em `page.test.tsx` os dois casos (a requisição para `server` fica idêntica à atual)
- [x] 4.7 Adicionar ao `ReviewModal` as mensagens para `unknown_provider`, `missing_api_key` e `provider_auth_error` orientando a corrigir provedor ou chave nas configurações, mantendo a seleção manual, verificando em `components.test.tsx` e em `page.test.tsx` com respostas simuladas de cada código
- [x] 4.8 Rodar `npm run lint`, `npx tsc --noEmit`, `npm run test:coverage` e `npm run build` em `web/`, verificando aprovação com cobertura ≥ 95% em todas as métricas

## 5. Documentação

- [x] 5.1 Documentar no `README.md` o seletor de provedor, o uso da chave própria (custo por conta do usuário), o catálogo atual, os endpoints `GET /api/providers` e `GET /api/models`, os novos códigos de erro e os avisos de segurança (chave em texto no navegador, HTTP sem criptografia na rede local, recomendação de chave com limite de gasto), verificando que os exemplos de `curl` descritos funcionam contra o backend local

## 6. Integração

- [ ] 6.1 Validar com uma chave real do DeepSeek: listar os modelos, escolher um com imagem e reconhecer um dado de verdade; repetir com uma chave inválida (mensagem `provider_auth_error`) e com o padrão do servidor (comportamento inalterado), verificando visualmente no navegador do celular

## Workflow follow-up

- Arquivar primeiro a change `align-specs-with-implementation` e depois esta, com `/opsx:archive`.

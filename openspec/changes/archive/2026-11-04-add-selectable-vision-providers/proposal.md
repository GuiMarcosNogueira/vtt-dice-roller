# Proposal

## Why

Hoje o provedor de visão e a chave de API são fixos no `.env` do servidor, então quem hospeda paga todas as leituras de todos os jogadores. Cada jogador deveria poder escolher o provedor de IA, usar a própria chave e arcar com o próprio custo, e o DeepSeek (cuja API aceita imagens no modelo `deepseek-flash`) é um provedor que os jogadores querem usar.

## What Changes

- **Catálogo de provedores no backend**: lista fixa com `deepseek` e `openrouter`, cada um com sua URL base e um modelo padrão, usado quando a requisição não informa o modelo. O usuário escolhe o provedor, mas nunca informa a URL. A opção `server` ("Padrão do servidor") continua usando as variáveis `VISION_*` do `.env`.
- **`GET /api/providers`**: devolve os provedores disponíveis para o seletor do frontend.
- **`GET /api/models`**: com provedor e chave do usuário, consulta a lista de modelos do provedor e devolve só os que aceitam imagem (`id`, `name`). Isso usa `input_modalities` do DeepSeek e `architecture.input_modalities` do OpenRouter.
- **`POST /api/recognize` aceita provedor, modelo e chave do usuário**: `provider` e `model` no corpo e a chave no header `X-Vision-Api-Key`. Sem `provider`, o comportamento atual (padrão do servidor) se mantém. A chave vale só para aquela requisição: não é guardada nem aparece em logs ou mensagens de erro.
- **Novos códigos de erro**: `unknown_provider`, `missing_api_key`, `provider_auth_error` (chave recusada pelo provedor).
- **Frontend**: nas configurações, seletor de provedor, campo de API key (oculto) e seletor de modelo com busca. Os modelos são carregados automaticamente quando provedor e chave estão preenchidos. A escolha fica salva no navegador e é enviada em cada reconhecimento.

## Capabilities

### New Capabilities

- `vision-provider-selection`: catálogo de provedores, listagem de modelos com suporte a imagem, uso da chave de API do próprio usuário com sigilo, e a escolha de provedor, chave e modelo no frontend.

### Modified Capabilities

- `optical-dice-recognition`: o reconhecimento passa a poder usar o provedor, o modelo e a chave informados na requisição. É um requisito novo (ADDED), sem alterar os existentes.

## Impact

- **`api/`**: novo `app/providers.py` (catálogo), novo `app/routes/providers.py` (`/api/providers` e `/api/models`), `app/routes/recognition.py` e `app/services/vision_service.py` (cliente por requisição, remoção da chave das mensagens de erro), `app/schemas/dice.py` (campos opcionais `provider` e `model`), testes mantendo cobertura ≥ 95%.
- **`web/`**: `app/types.ts`, `app/page.tsx`, `app/components/SettingsModal.tsx` (e um componente de seletor de modelo com busca), `app/components/ReviewModal.tsx` (mensagens dos novos códigos), testes mantendo cobertura ≥ 95%.
- **Segurança**: a chave do usuário passa pelo backend e fica em texto puro no `localStorage` do navegador. Em HTTP/WS comum ela trafega sem criptografia na rede local, como o `API_TOKEN`. Isso fica documentado no README.
- **Dependência de ordem**: a change pendente `align-specs-with-implementation` altera o requisito "Provedor de visão agnóstico" e os códigos de erro do reconhecimento. Esta change só adiciona requisitos e deve ser implementada depois dela. A `align-specs-with-implementation` precisa ser arquivada primeiro.
- **Foundry VTT**: sem mudanças.

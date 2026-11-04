# Design

## Context

A motivação está em `proposal.md` (Why) e os requisitos em `specs/`. Estado atual relevante:

- `VisionService` já recebe `api_key`, `base_url`, `model` e `timeout` no construtor e usa o cliente `AsyncOpenAI`. A rota de reconhecimento usa uma instância única (`vision_service`) criada no import, e os testes existentes fazem `patch` em `app.routes.recognition.vision_service.recognize_dice`.
- A change pendente `align-specs-with-implementation` (já implementada, ainda não arquivada) introduziu as exceções `NoDieDetectedError`, `InvalidReadingError`, `UpstreamError` e `UpstreamTimeoutError` no `VisionService`, o formato de erro `{code, message}` nas rotas e a autenticação opcional por `API_TOKEN` (`require_token`). Esta change se apoia em tudo isso.
- Fatos verificados nas documentações e respostas dos provedores:
  - **DeepSeek**: URL base `https://api.deepseek.com`; `GET /models` retorna `input_modalities` por modelo (`deepseek-flash` aceita texto e imagem, `deepseek-v4-pro` só texto); o chat aceita `image_url` com data URL base64 e `response_format: json_object`. Os metadados podem vir omitidos.
  - **OpenRouter**: `GET /api/v1/models` é público e traz `architecture.input_modalities`. Hoje são cerca de 300 modelos com imagem, então a lista no frontend precisa de busca.
- No frontend, `SettingsModal` é um formulário com cópia local das configurações (`formData`) e `page.tsx` monta os headers por `buildHeaders(settings)`.

## Goals / Non-Goals

**Goals:**
- Cada usuário usa a própria chave e escolhe provedor e modelo, sem mexer no `.env` do servidor.
- A chave nunca é armazenada nem registrada no backend, e não aparece em respostas de erro.
- Quem não escolhe nada continua exatamente como hoje (padrão do servidor).

**Non-Goals:**
- URL de provedor informada pelo usuário (evita que o backend seja usado para chamar hosts arbitrários).
- Outros provedores além de DeepSeek e OpenRouter (OpenAI, MGC etc.). O catálogo é feito para ser estendido numa change futura.
- Contas de usuário, guarda de chaves no servidor, criptografia da chave no navegador, ou exibição de custo.
- Avaliar qual modelo lê melhor os dados. A lista mostra os modelos que aceitam imagem, não os que acertam.

## Decisions

### D1: Catálogo fixo em `app/providers.py`
Um dicionário de `Provider(id, name, base_url, default_model, requires_user_key)`:

| id | base_url | default_model | requires_user_key |
|---|---|---|---|
| `server` | `None` (usa `settings`) | `settings.vision_model` | não |
| `deepseek` | `https://api.deepseek.com` | `deepseek-flash` | sim |
| `openrouter` | `https://openrouter.ai/api/v1` | `google/gemini-2.5-flash` | sim |

`get_provider(id)` levanta `UnknownProviderError` para ids fora do catálogo. Como a URL vem sempre do catálogo, não há como apontar o backend para outro host.

Cada entrada também pode levar `request_extras`, parâmetros extras do corpo da requisição específicos do provedor, repassados ao cliente como `extra_body`. O DeepSeek usa `{"thinking": {"type": "disabled"}}`: a documentação do provedor diz que o raciocínio vem ligado por padrão no `deepseek-flash`, e esse raciocínio consumiria o `max_tokens=250` da leitura antes do JSON ser escrito (resposta cortada ou vazia). Ler um dado não precisa de raciocínio, e desligá-lo reduz custo e tempo de resposta. O OpenRouter não leva extras.
- *Alternativa*: aceitar `base_url` livre ("qualquer provedor compatível com OpenAI"). Descartada por abrir SSRF: o backend faria requisições a endereços escolhidos pelo cliente, incluindo a rede interna.

### D2: Chave no header `X-Vision-Api-Key`
A chave do usuário viaja em `X-Vision-Api-Key`, não no corpo nem na query string. Fica fora de logs de acesso e de `repr` de modelos Pydantic. É independente do `Authorization: Bearer` do `API_TOKEN`, que protege o acesso ao backend, enquanto a chave autentica o usuário no provedor.

### D3: Cliente por requisição para provedores do usuário
Para `deepseek` e `openrouter`, a rota cria um `VisionService(api_key, base_url, model)` por requisição e fecha o cliente no `finally` (`await service.client.close()`). Para `server` (ou sem `provider`), continua usando a instância única `vision_service`, o que mantém os testes e o comportamento atuais. O cliente continua com `timeout=settings.vision_timeout_seconds` e `max_retries=1`.
- *Alternativa*: cache de clientes por chave. Descartada porque manteria a chave na memória do servidor além da requisição, contra o requisito de sigilo.

### D4: Listagem de modelos com `httpx` e filtro por modalidade
`GET /api/models?provider=<id>` (com `X-Vision-Api-Key`) chama `GET {base_url}/models` com `httpx.AsyncClient(timeout=settings.vision_timeout_seconds)`. A extração fica em uma função pura `extract_vision_models(provider_id, payload)`:
- lê as modalidades de `input_modalities` (DeepSeek) ou `architecture.input_modalities` (OpenRouter);
- exclui o modelo quando a lista existe e não contém `"image"`;
- **mantém** o modelo quando a informação está ausente (os metadados do DeepSeek podem vir omitidos);
- devolve `[{id, name}]` ordenado por nome, com `name` igual a `id` quando faltar.

O `httpx` já consta no `requirements.txt`, então não há dependência nova.
- *Alternativa*: `client.models.list()` do SDK da OpenAI. Descartada porque o SDK descarta ou esconde campos extras como `architecture`, e o parsing manual é mais previsível e testável.

### D5: Erros compartilhados em `app/errors.py`
A tradução de exceção para `HTTPException({code, message})` hoje está dentro de `recognition.py`. Ela sobe para `app/errors.py` (`to_http_error(exc, api_key)`) e passa a ser usada pelas duas rotas. Mapeamento:

| Exceção | HTTP | code |
|---|---|---|
| `UnknownProviderError` | 422 | `unknown_provider` |
| `MissingApiKeyError` | 422 | `missing_api_key` |
| `ProviderAuthError` | 400 | `provider_auth_error` |
| os da change anterior | iguais | iguais |

`ProviderAuthError` é nova e vem de `openai.AuthenticationError` / `PermissionDeniedError` (reconhecimento) e de respostas 401/403 (listagem), tratadas **antes** do `APIError` genérico. O status é 400 e não 401, porque o frontend já interpreta 401 como "token do backend inválido" (`unauthorized`).

Quando a chave recusada é a do servidor (`.env`, provedor `server`), a rota converte o `ProviderAuthError` em `UpstreamError` (502 `upstream_error`, mensagem "O provedor recusou a chave configurada no servidor"). `provider_auth_error` orienta o usuário a corrigir a própria chave, o que não faz sentido para uma chave que só o dono do servidor pode trocar.

### D6: Remoção da chave das mensagens
`to_http_error` aplica `scrub(message, api_key)`, que troca toda ocorrência da chave por `***`. Para `ProviderAuthError` a mensagem é fixa ("A chave de API foi recusada pelo provedor"), sem repetir texto do provedor. Nenhum código novo escreve a chave em log.

### D7: Ordem das validações no backend
`provider` desconhecido → `unknown_provider`; depois, provedor com `requires_user_key` sem chave → `missing_api_key`; só então a chamada externa. Provedor ausente ou `server` nunca exige chave do usuário nem consome a do servidor por engano em `deepseek`/`openrouter`. O `RecognizeRequest` ganha `provider: str | None` e `model: str | None` (máx. 200 caracteres). O modelo omitido usa o `default_model` do catálogo.

### D8: Frontend
- `AppSettings` ganha `visionProvider` (padrão `"server"`), `visionApiKey` (`""`) e `visionModel` (`""`). Configurações antigas salvas no navegador não os têm e assumem os padrões, ou seja, nada muda para elas.
- Dois hooks novos: `useProviders(apiUrl, apiToken)` busca `GET /api/providers` ao abrir as configurações; `useVisionModels(...)` busca `GET /api/models` quando há provedor com `requires_user_key` e chave preenchida, com debounce de 600 ms e `AbortController` para ignorar respostas antigas. Ambos usam os valores do formulário (`formData`), não os já salvos, para que o teste da chave aconteça antes de salvar.
- Um `ModelPicker` com campo de busca e lista rolável (necessário para os ~300 modelos do OpenRouter). Ao receber a lista, seleciona `default_model` se estiver nela; senão, o primeiro item. Trocar de provedor ou apagar a chave limpa a lista e o modelo.
- `page.tsx` só envia `provider`, `model` e `X-Vision-Api-Key` quando `visionProvider !== "server"`. Para `server`, a requisição é idêntica à atual.
- Se `/api/providers` falhar, o seletor mostra só "Padrão do servidor" e uma mensagem.
- `ReviewModal` ganha mensagens para `unknown_provider`, `missing_api_key` e `provider_auth_error`.

### D9: Armazenamento da chave no navegador
A chave fica em `localStorage`, junto das outras configurações, em um `<input type="password" autocomplete="off">`. Aceita-se o risco de texto puro no navegador do próprio usuário; o README documenta que ele deve usar uma chave com limite de gasto e que o tráfego HTTP na rede local não é criptografado.
- *Alternativa*: guardar só em `sessionStorage`. Descartada por obrigar o usuário a digitar a chave a cada sessão, mas é fácil de trocar depois.

## Risks / Trade-offs

- **[A leitura de imagem do DeepSeek não foi testada com uma chave real]** → A documentação indica `deepseek-flash` com entrada de imagem e `image_url` no chat, mas não há chave para testar aqui. A tarefa 6.1 é uma validação manual com chave real, e o filtro por `input_modalities` evita oferecer modelos só de texto.
- **[Raciocínio do DeepSeek desligado pode reduzir a precisão em casos difíceis]** → A tarefa é uma extração curta; o ganho em custo e tempo compensa e o `max_tokens` curto inviabilizaria o raciocínio de qualquer forma. A decisão fica no catálogo (`request_extras`) e é fácil de reverter.
- **[Modelo padrão deixar de existir no provedor]** → O padrão do OpenRouter e o do servidor (`VISION_MODEL`) são `google/gemini-2.5-flash`, escolhido depois que o `gemini-2.0-flash-001` saiu do catálogo do OpenRouter. Uma troca futura é uma linha no catálogo, em `config.py` e no `.env.example`.
- **[Modelo que aceita imagem mas lê mal o dado]** → A lista não garante qualidade. A tela de revisão continua permitindo corrigir o número.
- **[Chave trafega em HTTP puro na rede local e fica em texto no navegador]** → Documentado no README; o `API_TOKEN` e o uso em rede confiável continuam valendo. Recomendação de chave com limite de gasto.
- **[O backend vira intermediário de chaves de terceiros]** → Só fala com dois hosts fixos, não guarda nem registra a chave (D3, D6), e o `API_TOKEN` pode restringir quem usa o backend.
- **[Mensagem de erro do provedor com a chave dentro]** → `scrub` e mensagem fixa em erro de autenticação (D6), com teste dedicado.
- **[Duas changes mexendo nas mesmas specs]** → Esta só adiciona requisitos (ADDED), então não conflita com a change anterior no arquivamento, desde que a `align-specs-with-implementation` seja arquivada antes.

## Migration Plan

Sem migração de dados nem de variáveis de ambiente. As `VISION_*` do `.env` seguem valendo para o provedor `server`. Para reverter, basta remover a nova rota e os campos opcionais do corpo, sem efeito sobre quem usa o padrão do servidor.

## Open Questions

- Se o DeepSeek passar a recusar `max_tokens=250` ou `response_format` em algum modelo de visão, o ajuste é local ao `VisionService` e não muda specs nem tarefas. Será visto na validação manual da tarefa 6.1.

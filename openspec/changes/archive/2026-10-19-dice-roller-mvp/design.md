# Design

## Context

O projeto é estruturado como um monorepo contendo:
- `api/`: backend em Python (FastAPI).
- `web/`: frontend em Next.js voltado para uso web/mobile.
- Integração externa: Foundry VTT via módulo JavaScript.

Para a motivação e capacidades funcionais, consulte `proposal.md` e as especificações em `specs/`.

## Goals / Non-Goals

**Goals:**
- Prover uma interface mobile-first fluida no Next.js que acesse a câmera do smartphone, monitore a rolagem de dados via canvas (frame differencing) e acione captura automática quando o dado estabilizar.
- Prover fallback e controle manual para captura e correção rápida do resultado na tela antes do envio final.
- Construir um serviço de visão agnóstico em FastAPI compatível com a API padrão OpenAI (suportando OpenRouter, MGC AI Hub ou Google AI Studio).
- Reconhecer 1 dado poliédrico por rolagem entre os tipos padrão de RPG: `d4`, `d6`, `d8`, `d10`, `d12`, `d20` e `d100`.
- Implementar um hub WebSocket leve no backend para transmitir eventos de rolagem em tempo real.
- Criar um módulo cliente para Foundry VTT que consome o WebSocket e publica o resultado no chat nativo da sessão.

**Non-Goals:**
- Reconhecimento simultâneo de múltiplos dados (ex: pools como 4d6 ou 2d20 de vantagem) no escopo inicial do MVP.
- Treinamento ou fine-tuning de modelos locais de visão computacional (usaremos inferência via APIs de modelos multimodais de ponta).
- Extensão de navegador para Roll20 no primeiro marco (Roll20 fica mapeado para a fase subsequente).
- Autenticação de múltiplos usuários ou multi-tenancy complexo (foco em uso na rede local da mesa).

## Architecture

```
+---------------------------------------------------------------+
|                      Next.js Frontend (web/)                  |
|  - Camera Stream (getUserMedia)                               |
|  - Canvas Motion Engine (downsampled 160x120 grayscale)       |
|  - State Machine: IDLE -> ROLLING -> STABILIZING -> CAPTURING  |
|  - Review UI: visualiza crop/frame, exibe valor, edição rápida|
+-------------------------------+-------------------------------+
                                | POST /api/recognize (base64)
                                v
+---------------------------------------------------------------+
|                      FastAPI Backend (api/)                   |
|  - Endpoints: /api/recognize, /api/rolls, /ws/rolls           |
|  - VisionService: OpenAI-compatible client                    |
|    (Configurável: OpenRouter, MGC AI Hub, Google AI Studio)   |
|  - Prompt com regras espaciais para face superior (zênite)    |
|  - WebSocket Manager para broadcast de eventos                |
+-------------------------------+-------------------------------+
                                | WebSocket ws://host:port/ws/rolls
                                v
+---------------------------------------------------------------+
|                   Foundry VTT Module (foundry/)               |
|  - module.json + main.js                                      |
|  - Conecta ao WebSocket do backend                            |
|  - Cria ChatMessage no Foundry com o resultado e fórmula      |
+---------------------------------------------------------------+
```

## Decisions

### Decisão 1: Detecção de movimento no cliente via Canvas (Frame Differencing)
- **Rationale**: Enviar vídeo contínuo para modelos de visão em nuvem seria financeiramente inviável e lento. O navegador móvel processa um canvas reduzido (160x120 pixels em escala de cinza), calcula a diferença média de pixels entre quadros adjacentes e só extrai o snapshot JPEG em alta resolução quando a variação permanece abaixo de um limiar por ~800ms.
- **Alternativas consideradas**:
  - *Streaming contínuo WebRTC para a API*: descartado devido ao alto consumo de banda e complexidade de infraestrutura.
  - *Captura exclusivamente manual*: mantida como opção/fallback, mas a automação traz a melhor experiência de jogo.

### Decisão 2: Backend de Visão Agnóstico (OpenAI-Compatible Client)
- **Rationale**: Tanto o OpenRouter quanto o MGC AI Hub e outros gateways modernos suportam a especificação da OpenAI (`POST /v1/chat/completions` com blocos `image_url`). Utilizando a biblioteca padrão `openai` em Python apontando para `base_url` customizável, a troca de provedor e modelo ocorre unicamente via variáveis de ambiente (`VISION_BASE_URL`, `VISION_API_KEY`, `VISION_MODEL`).
- **Alternativas consideradas**:
  - *SDK específico da Google (`google-genai`)*: amarraria o projeto a um único fornecedor.
  - *Modelos locais via Ollama/Llama.cpp*: exige hardware com GPU dedicada no servidor local; a interface agnóstica permitirá isso no futuro sem refatoração.

### Decisão 3: Transmissão de Eventos via WebSocket Nativo
- **Rationale**: FastAPI possui suporte nativo assíncrono a WebSockets (`WebSocketEndpoint`). O Foundry VTT roda sobre Node.js/Chromium e consome WebSockets nativamente sem dependências extras.
- **Alternativas consideradas**:
  - *Server-Sent Events (SSE)*: unidirecional e bom para streaming, mas WebSockets permitem handshake bidirecional e controle de presença.
  - *Polling HTTP no Foundry*: gera tráfego desnecessário e latência perceptível para os jogadores.

### Decisão 4: Estrutura do Módulo Foundry VTT
- **Rationale**: Um módulo leve constituído por `module.json` e script cliente que se registra no hook `ready` do Foundry, abre o WebSocket para a API e, ao receber a mensagem, invoca `ChatMessage.create({ ... })`.
- **Alternativas consideradas**:
  - *Macros isoladas*: exigiriam configuração manual de cada usuário em vez de instalação padrão de módulo.

## Risks / Trade-offs

- **[Risco: Iluminação e reflexos em dados plásticos/metálicos]** $\rightarrow$ *Mitigação*: A interface do Next.js exibirá imediatamente o resultado detectado com um botão de confirmação e seletor rápido de valor para correção humana caso a IA erre o número.
- **[Risco: Ambiguidade no d20 onde múltiplas faces inclinadas são visíveis]** $\rightarrow$ *Mitigação*: Engenharia de prompt detalhada instruindo o modelo a considerar apenas a face horizontal perpendicular à câmera (zênite), preferindo modelos com alta acurácia visual (ex: Gemini 2.0 Flash ou Qwen 2.5 VL 72B).
- **[Risco: Comunicação entre celular e PC na rede local]** $\rightarrow$ *Mitigação*: O backend FastAPI informará o endereço IP local na inicialização e suportará configuração de CORS aberto para a rede local (`allow_origins=["*"]`).

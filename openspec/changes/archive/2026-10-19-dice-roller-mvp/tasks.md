# Tasks

## 1. Configuração do Backend e Dependências

- [x] 1.1 Configurar ambiente Python no diretório `api/` com FastAPI, Uvicorn, Pydantic, python-dotenv e cliente OpenAI, verificando a execução bem-sucedida de `uvicorn` em teste básico
- [x] 1.2 Definir modelos Pydantic para requisição de reconhecimento e resposta estruturada (`die_type`, `value`, `confidence`), verificando testes unitários de validação de schemas

## 2. Serviço de Reconhecimento Óptico de Visão (Agnóstico)

- [x] 2.1 Implementar `VisionService` com cliente compatível com OpenAI e carregamento de configurações de ambiente (`VISION_PROVIDER`, `VISION_BASE_URL`, `VISION_API_KEY`, `VISION_MODEL`), verificando chamada simulada com mock
- [x] 2.2 Desenvolver o prompt especializado com regras geométricas de leitura da face superior (zênite) para d4 a d100, verificando a geração correta de payload e headers
- [x] 2.3 Criar endpoint `POST /api/recognize` no FastAPI integrando `VisionService` e validação de imagem base64, verificando requisição com imagem de teste e retorno JSON estruturado

## 3. Transmissão em Tempo Real via WebSocket

- [x] 3.1 Implementar `ConnectionManager` no FastAPI para gerenciar conexões ativas de WebSocket, verificando testes de conexão simultânea e desconexão graciosa
- [x] 3.2 Criar endpoint `/ws/rolls` para transmissão de eventos de rolagem confirmada em tempo real, verificando recebimento de mensagens através de um cliente WebSocket de teste
- [x] 3.3 Adicionar endpoint `POST /api/rolls` para persistência em memória e disparo de broadcast pelo WebSocket, verificando o fluxo ponta a ponta

## 4. Frontend Next.js - Acesso à Câmera e Detecção de Movimento

- [x] 4.1 Implementar hook e componente de acesso à câmera via `navigator.mediaDevices.getUserMedia` com fallback e tratamento de permissão em `web/`, verificando renderização do preview de vídeo no navegador móvel e desktop
- [x] 4.2 Desenvolver o motor leve de detecção de movimento em `<canvas>` (frame differencing 160x120), verificando a transição de estados `IDLE -> ROLLING -> STABILIZING -> CAPTURING` no console e na UI
- [x] 4.3 Implementar botão de captura manual e mecanismo de congelamento de frame em alta resolução, verificando extração do frame em formato base64

## 5. Frontend Next.js - Interface de Revisão e Integração com API

- [x] 5.1 Criar tela de revisão com thumbnail da rolagem, exibição do dado/valor reconhecido e controles para ajuste rápido do número caso necessário, verificando usabilidade em tela de smartphone
- [x] 5.2 Integrar o cliente Next.js com os endpoints `POST /api/recognize` e `POST /api/rolls`, verificando o ciclo completo de envio da imagem e confirmação do resultado
- [x] 5.3 Implementar painel de configurações no frontend para definir a URL da API e preferências de câmera, verificando persistência no `localStorage`

## 6. Módulo Foundry VTT e Integração Ponta a Ponta

- [x] 6.1 Criar estrutura do módulo para Foundry VTT (`module.json` e `scripts/main.js`) com configuração do endereço WebSocket da API, verificando o carregamento do módulo no painel de módulos do Foundry
- [x] 6.2 Implementar cliente WebSocket no módulo do Foundry que escuta eventos de rolagem e invoca `ChatMessage.create`, verificando a publicação automática da mensagem no chat do jogo
- [x] 6.3 Executar teste integrado de ponta a ponta (captura na câmera do celular -> reconhecimento na API -> publicação no chat do Foundry VTT) e documentar instruções de execução no `README.md`

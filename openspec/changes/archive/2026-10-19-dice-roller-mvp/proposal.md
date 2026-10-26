# Proposal

## Why

Jogadores de RPG de mesa frequentemente preferem a sensação tátil de rolar dados físicos em vez de usar geradores digitais aleatórios nos Virtual Tabletop (VTTs). No entanto, ao jogar em mesas virtuais (como Foundry VTT), registrar manualmente os resultados no chat ou confiar apenas na palavra do jogador gera atrito e quebra a imersão.

Esta mudança introduz uma solução automatizada para reconhecer rolagens físicas de dados de RPG (d4 a d100) através da câmera do celular/computador usando modelos de visão multimodal e transmitir instantaneamente o resultado para mesas virtuais, iniciando pelo Foundry VTT.

## What Changes

- **Captura Web/Mobile**: Aplicação frontend em Next.js com acesso à câmera do dispositivo e detecção de movimento/estabilização do dado via canvas, permitindo captura automática ou disparo manual.
- **Reconhecimento Óptico de Dados**: Serviço de backend em Python com integração agnóstica a modelos de visão (OpenRouter, MGC AI Hub, Google AI Studio) compatíveis com a API OpenAI, identificando a face superior do dado rolado (d4, d6, d8, d10, d12, d20, d100) e retornando dados estruturados.
- **Transmissão em Tempo Real para VTT**: Hub WebSocket na API Python que transmite eventos de rolagens confirmadas para clientes integrados.
- **Módulo Foundry VTT**: Módulo cliente para Foundry VTT que conecta ao WebSocket do backend e publica o resultado no chat do jogo.

## Capabilities

### New Capabilities

- `roll-capture`: Captura de fluxo de vídeo da câmera, detecção de movimento e estabilização de rolagem com interface de revisão e confirmação do resultado no cliente.
- `optical-dice-recognition`: Análise de imagens por modelos de visão multimodal para identificar o tipo de dado de RPG e o valor da face superior voltada para cima.
- `vtt-distribution`: Distribuição de eventos de rolagem de dados em tempo real via WebSocket para mesas virtuais conectadas.

### Modified Capabilities

<!-- Nenhuma capacidade existente modificada (projeto inicial) -->

## Impact

- **Frontend (`web/`)**: Nova interface Next.js mobile-first com suporte a `getUserMedia`, manipulação de canvas e conexão WebSocket/HTTP com o backend.
- **Backend (`api/`)**: Nova API FastAPI em Python com endpoints `/api/recognize`, WebSocket `/ws/rolls`, cliente OpenAI-compatible para visão e schemas de validação Pydantic.
- **VTT (`foundry-module/` ou subpasta de distribuição)**: Módulo cliente para Foundry VTT para consumir rolagens via WebSocket.

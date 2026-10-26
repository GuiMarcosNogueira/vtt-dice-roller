# Spec Delta

## Purpose

Distribui eventos de rolagem de dados em tempo real via WebSocket para aplicações clientes e mesas virtuais conectadas, com integração ao Foundry VTT.

## ADDED Requirements

### Requirement: Transmissão de rolagens via WebSocket
O sistema SHALL disponibilizar um endpoint WebSocket persistente que aceita conexões de clientes autorizados e transmite eventos de rolagem em tempo real contendo identificador, tipo de dado, resultado e timestamp.

#### Scenario: Transmissão de rolagem para assinantes conectados
- **WHEN** uma rolagem confirmada é processada pelo backend
- **THEN** o sistema SHALL transmitir a mensagem de evento imediatamente para todas as sessões WebSocket conectadas

#### Scenario: Reconexão automática de clientes
- **WHEN** a conexão WebSocket de um cliente oscilar ou for reiniciada
- **THEN** o cliente SHALL tentar restabelecer a conexão automaticamente sem requerer reinicialização da página

### Requirement: Publicação no chat do Foundry VTT
O sistema SHALL fornecer um módulo para Foundry VTT capaz de escutar o fluxo WebSocket e criar mensagens de chat oficiais da mesa virtual exibindo o resultado do dado e a identificação do jogador.

#### Scenario: Criação de mensagem no chat do Foundry VTT
- **WHEN** o módulo do Foundry VTT recebe um evento de rolagem via WebSocket
- **THEN** o módulo SHALL instanciar uma mensagem de chat (`ChatMessage`) com a fórmula e o resultado recebido

#### Scenario: Indicador de status de conexão no Foundry VTT
- **WHEN** o módulo do Foundry VTT não conseguir se comunicar com o backend
- **THEN** o módulo SHALL exibir um aviso visual no painel de configurações ou console informando o estado desconectado

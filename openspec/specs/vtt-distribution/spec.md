# vtt-distribution Specification

## Purpose

Distribui eventos de rolagem de dados em tempo real via WebSocket para aplicações clientes e mesas virtuais conectadas, com integração ao Foundry VTT.

## Requirements

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

#### Scenario: Animação 3D com o valor lido
- **WHEN** o módulo Dice So Nice está ativo e uma rolagem é recebida, em Foundry VTT nas versões 10 a 12
- **THEN** o módulo SHALL exibir a animação 3D do tipo de dado recebido parando exatamente no valor lido pela câmera, sem emitir avisos de API obsoleta no console

### Requirement: Autenticação opcional por token compartilhado
Quando um token compartilhado estiver configurado no backend, o sistema SHALL exigi-lo nos endpoints de reconhecimento, de criação e de histórico de rolagens e no WebSocket de rolagens. Sem token configurado, o sistema SHALL aceitar todas as requisições sem autenticação. O endpoint de health check SHALL permanecer público.

#### Scenario: Requisição HTTP com token válido
- **WHEN** o token está configurado e o cliente envia `Authorization: Bearer <token>` correto
- **THEN** o sistema SHALL processar a requisição normalmente

#### Scenario: Requisição HTTP sem token ou com token inválido
- **WHEN** o token está configurado e a requisição chega sem o header `Authorization` ou com um token diferente
- **THEN** o sistema SHALL responder HTTP 401 com `detail.code` igual a `unauthorized`, sem executar o reconhecimento nem transmitir a rolagem

#### Scenario: WebSocket com token inválido
- **WHEN** o token está configurado e um cliente abre `/ws/rolls` sem o parâmetro `token` ou com valor incorreto
- **THEN** o sistema SHALL encerrar a conexão com o código de fechamento `1008` e SHALL NOT incluir o cliente na lista de destinatários do broadcast

#### Scenario: Backend sem token configurado
- **WHEN** o token não está configurado
- **THEN** o sistema SHALL aceitar requisições HTTP e conexões WebSocket sem credenciais, como no comportamento anterior

#### Scenario: Token configurado no módulo do Foundry VTT
- **WHEN** o administrador informa o token nas configurações do módulo do Foundry VTT
- **THEN** o módulo SHALL incluí-lo ao se conectar ao WebSocket e SHALL reconectar quando o valor for alterado

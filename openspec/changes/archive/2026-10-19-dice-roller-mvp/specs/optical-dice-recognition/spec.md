# Spec Delta

## Purpose

Fornece serviço de inteligência artificial de visão computacional agnóstico para identificar a geometria e o valor da face superior de dados de RPG rolados.

## ADDED Requirements

### Requirement: Reconhecimento do tipo de dado e face superior
O sistema SHALL analisar uma imagem de dado de RPG e identificar a geometria poliédrica (d4, d6, d8, d10, d12, d20 ou d100) e o valor numérico da face voltada diretamente para cima (zênite).

#### Scenario: Leitura bem-sucedida de d20
- **WHEN** uma imagem nítida de um d20 em repouso é enviada ao serviço
- **THEN** o sistema SHALL retornar o tipo `d20` e o número exibido na face superior

#### Scenario: Leitura de d10 e d100
- **WHEN** uma imagem de d10 com face `0` ou de d100 com face de dezenas (ex: `70`) é processada
- **THEN** o sistema SHALL interpretar o `0` do d10 como `10` e identificar corretamente o valor da dezena no d100

### Requirement: Provedor de visão agnóstico
O sistema SHALL comunicar-se com serviços de visão multimodal utilizando a especificação de API compatível com OpenAI, permitindo parametrização de endpoint, chave de API e modelo via variáveis de ambiente.

#### Scenario: Execução com provedor configurado
- **WHEN** a API recebe uma solicitação de reconhecimento e despacha a requisição para o provedor configurado (OpenRouter, MGC AI Hub ou similar)
- **THEN** o sistema SHALL enviar a imagem codificada em base64 e receber a interpretação estruturada

#### Scenario: Falha ou indisponibilidade do provedor
- **WHEN** o provedor de visão retornar erro HTTP 5xx, erro de cota ou atingir timeout configurado
- **THEN** o sistema SHALL retornar erro HTTP estruturado indicando a falha do serviço upstream com mensagem amigável

### Requirement: Resposta em schema estruturado e validação
O sistema SHALL validar e sanitizar o retorno do modelo de visão contra um schema estrito contendo o tipo de dado, o valor numérico e o nível de confiança da leitura.

#### Scenario: Saída estruturada válida
- **WHEN** o modelo de visão processa a imagem com sucesso
- **THEN** o sistema SHALL retornar um payload JSON contendo `die_type`, `value` e `confidence`

#### Scenario: Dado não detectado ou imagem ilegível
- **WHEN** a imagem enviada estiver borrada, vazia ou sem dado identificável
- **THEN** o sistema SHALL retornar status indicando que nenhum dado pôde ser lido confiavelmente

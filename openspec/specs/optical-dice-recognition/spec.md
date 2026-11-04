# optical-dice-recognition Specification

## Purpose

Fornece serviço de inteligência artificial de visão computacional agnóstico para identificar a geometria e o valor da face superior de dados de RPG rolados.

## Requirements

### Requirement: Reconhecimento do tipo de dado e face superior
O sistema SHALL analisar uma imagem de dado de RPG e identificar a geometria poliédrica (d4, d6, d8, d10, d12, d20 ou d100) e o valor numérico da face voltada diretamente para cima (zênite).

#### Scenario: Leitura bem-sucedida de d20
- **WHEN** uma imagem nítida de um d20 em repouso é enviada ao serviço
- **THEN** o sistema SHALL retornar o tipo `d20` e o número exibido na face superior

#### Scenario: Leitura de d10 e d100
- **WHEN** uma imagem de d10 com face `0` ou de d100 com face de dezenas (ex: `70`) é processada
- **THEN** o sistema SHALL interpretar o `0` do d10 como `10` e identificar corretamente o valor da dezena no d100

#### Scenario: Provedor retorna 0 para d10
- **WHEN** o modelo de visão retorna `die_type` `d10` com `value` `0`
- **THEN** o sistema SHALL normalizar o valor para `10` antes da validação e responder com sucesso, sem erro de validação

### Requirement: Provedor de visão agnóstico
O sistema SHALL comunicar-se com serviços de visão multimodal utilizando a especificação de API compatível com OpenAI, permitindo parametrização de endpoint, chave de API, modelo e timeout da requisição via variáveis de ambiente.

#### Scenario: Execução com provedor configurado
- **WHEN** a API recebe uma solicitação de reconhecimento e despacha a requisição para o provedor configurado (OpenRouter, MGC AI Hub ou similar)
- **THEN** o sistema SHALL enviar a imagem codificada em base64 e receber a interpretação estruturada

#### Scenario: Falha ou indisponibilidade do provedor
- **WHEN** o provedor de visão retornar erro HTTP 5xx, erro de cota ou resposta que não pode ser interpretada
- **THEN** o sistema SHALL retornar HTTP 502 com `detail.code` igual a `upstream_error` e `detail.message` com mensagem amigável

#### Scenario: Timeout do provedor
- **WHEN** o provedor de visão não responder dentro do timeout configurado (padrão de 30 segundos quando não definido)
- **THEN** o sistema SHALL interromper a requisição e retornar HTTP 504 com `detail.code` igual a `upstream_timeout`

### Requirement: Resposta em schema estruturado e validação
O sistema SHALL validar e sanitizar o retorno do modelo de visão contra um schema estrito contendo o tipo de dado, o valor numérico e o nível de confiança da leitura.

#### Scenario: Saída estruturada válida
- **WHEN** o modelo de visão processa a imagem com sucesso
- **THEN** o sistema SHALL retornar um payload JSON contendo `die_type`, `value` e `confidence`

#### Scenario: Dado não detectado ou imagem ilegível
- **WHEN** a imagem enviada estiver borrada, vazia ou sem dado identificável, e o modelo indicar que não detectou um dado ou omitir o tipo do dado
- **THEN** o sistema SHALL retornar HTTP 422 com `detail.code` igual a `no_die_detected`, distinguível de uma falha do provedor

#### Scenario: Leitura fora do intervalo do dado
- **WHEN** o modelo de visão retorna um valor incompatível com o tipo de dado (ex: `d6` com valor `9`)
- **THEN** o sistema SHALL retornar HTTP 422 com `detail.code` igual a `invalid_reading`

### Requirement: Reconhecimento com provedor, modelo e chave do usuário
O sistema SHALL aceitar, na requisição de reconhecimento, um provedor do catálogo, um modelo opcional e a chave de API do usuário, e SHALL executar a leitura nesse provedor com essa chave. Sem provedor informado, o sistema SHALL usar o padrão do servidor.

#### Scenario: Reconhecimento com DeepSeek e chave do usuário
- **WHEN** a requisição informa o provedor `deepseek`, um modelo e a chave do usuário
- **THEN** o sistema SHALL enviar a imagem ao DeepSeek usando essa chave e esse modelo, e SHALL retornar o mesmo payload estruturado (`die_type`, `value`, `confidence`) do padrão do servidor

#### Scenario: Modelo omitido
- **WHEN** a requisição informa um provedor do catálogo e a chave, mas não o modelo
- **THEN** o sistema SHALL usar o modelo padrão desse provedor

#### Scenario: Requisição sem provedor
- **WHEN** a requisição não informa provedor
- **THEN** o sistema SHALL usar o provedor, o modelo e a chave configurados no servidor, sem exigir chave do usuário

#### Scenario: Chave ausente para provedor do usuário
- **WHEN** a requisição informa `deepseek` ou `openrouter` sem a chave do usuário
- **THEN** o sistema SHALL retornar HTTP 422 com `detail.code` igual a `missing_api_key`, sem contatar o provedor e sem usar a chave do servidor

#### Scenario: Chave do usuário recusada pelo provedor
- **WHEN** o provedor responde à leitura com HTTP 401 ou 403 a uma requisição que usa a chave do usuário
- **THEN** o sistema SHALL retornar HTTP 400 com `detail.code` igual a `provider_auth_error`, distinguível de uma falha do provedor (`upstream_error`)

#### Scenario: Chave do servidor recusada pelo provedor
- **WHEN** o provedor responde à leitura com HTTP 401 ou 403 a uma requisição que usa o padrão do servidor
- **THEN** o sistema SHALL retornar HTTP 502 com `detail.code` igual a `upstream_error` e uma mensagem indicando que a chave configurada no servidor foi recusada, pois o usuário não tem como corrigi-la

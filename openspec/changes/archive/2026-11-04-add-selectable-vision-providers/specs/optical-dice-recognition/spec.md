# Spec Delta

## ADDED Requirements

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
